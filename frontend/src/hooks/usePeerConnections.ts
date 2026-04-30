import { useRef, useCallback, useEffect, useState } from 'react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface PeerEntry {
  pc: RTCPeerConnection;
  stream: MediaStream;
  makingOffer: boolean;
}

export function usePeerConnections(
  send: (msg: object) => void,
  meetingId: string | null,
  localStream: MediaStream | null,
) {
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const meetingIdRef = useRef(meetingId);
  const sendRef = useRef(send);
  meetingIdRef.current = meetingId;
  sendRef.current = send;

  const updateStreams = useCallback(() => {
    const map = new Map<string, MediaStream>();
    peersRef.current.forEach((entry, username) => {
      map.set(username, entry.stream);
    });
    setRemoteStreams(new Map(map));
  }, []);

  const sendSignal = useCallback((targetUser: string, signalType: string, data: unknown) => {
    if (!meetingIdRef.current) return;
    sendRef.current({
      type: 'rtc_signal',
      meeting_id: meetingIdRef.current,
      target_user: targetUser,
      signal_type: signalType,
      data,
    });
  }, []);

  const createPeer = useCallback((remoteUser: string, polite: boolean) => {
    if (peersRef.current.has(remoteUser)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: remoteStream, makingOffer: false };
    peersRef.current.set(remoteUser, entry);

    // Receive remote tracks
    pc.ontrack = (e) => {
      remoteStream.addTrack(e.track);
      updateStreams();
    };

    // Send ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(remoteUser, 'ice_candidate', e.candidate.toJSON());
      }
    };

    // "Perfect negotiation" pattern: handle negotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal(remoteUser, 'offer', pc.localDescription!.toJSON());
      } catch (err) {
        console.error('Negotiation failed:', err);
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.close();
        peersRef.current.delete(remoteUser);
        updateStreams();
      }
    };

    // Store polite flag for signal handling
    (pc as unknown as Record<string, boolean>)._polite = polite;

    return pc;
  }, [sendSignal, updateStreams]);

  // Sync local tracks to all peer connections
  useEffect(() => {
    peersRef.current.forEach((entry) => {
      const pc = entry.pc;
      if (pc.connectionState === 'closed') return;

      const senders = pc.getSenders();

      if (!localStream) {
        // Remove all tracks
        senders.forEach((s) => {
          if (s.track) pc.removeTrack(s);
        });
        return;
      }

      const localTracks = localStream.getTracks();

      // Replace or add each local track
      for (const track of localTracks) {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, localStream);
        }
      }

      // Remove senders for kinds no longer in local stream
      for (const sender of senders) {
        if (sender.track && !localTracks.some((t) => t.kind === sender.track!.kind)) {
          pc.removeTrack(sender);
        }
      }
    });
  }, [localStream]);

  const handleSignal = useCallback(async (fromUser: string, signalType: string, data: unknown) => {
    let entry = peersRef.current.get(fromUser);

    if (signalType === 'offer') {
      if (!entry) {
        // We're the polite peer (receiving an unsolicited offer)
        createPeer(fromUser, true);
        entry = peersRef.current.get(fromUser);
        if (!entry) return;

        // Add current local tracks
        if (localStream) {
          localStream.getTracks().forEach((track) => {
            entry!.pc.addTrack(track, localStream);
          });
        }
      }

      const pc = entry.pc;
      const polite = (pc as unknown as Record<string, boolean>)._polite ?? true;
      const offerCollision = entry.makingOffer || pc.signalingState !== 'stable';

      if (!polite && offerCollision) {
        return; // Impolite peer ignores colliding offers
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
        await pc.setLocalDescription();
        sendSignal(fromUser, 'answer', pc.localDescription!.toJSON());
      } catch (err) {
        console.error('Failed to handle offer from', fromUser, err);
      }
    } else if (signalType === 'answer') {
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
      } catch (err) {
        console.error('Failed to set answer from', fromUser, err);
      }
    } else if (signalType === 'ice_candidate') {
      if (!entry) return;
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit));
      } catch (err) {
        // Ignore ICE candidate errors during early setup
      }
    }
  }, [createPeer, sendSignal, localStream]);

  const removePeer = useCallback((username: string) => {
    const entry = peersRef.current.get(username);
    if (entry) {
      entry.pc.close();
      peersRef.current.delete(username);
      updateStreams();
    }
  }, [updateStreams]);

  // Cleanup all peers on unmount or meeting change
  useEffect(() => {
    return () => {
      peersRef.current.forEach((entry) => entry.pc.close());
      peersRef.current.clear();
    };
  }, [meetingId]);

  return { remoteStreams, createPeer, removePeer, handleSignal };
}
