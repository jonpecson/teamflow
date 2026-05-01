import { useRef, useCallback, useEffect, useState } from 'react';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Free TURN server for NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

interface PeerEntry {
  pc: RTCPeerConnection;
  stream: MediaStream;
  makingOffer: boolean;
  polite: boolean;
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
  const localStreamRef = useRef(localStream);
  meetingIdRef.current = meetingId;
  sendRef.current = send;
  localStreamRef.current = localStream;

  const updateStreams = useCallback(() => {
    const map = new Map<string, MediaStream>();
    peersRef.current.forEach((entry, username) => {
      map.set(username, entry.stream);
    });
    setRemoteStreams(new Map(map));
  }, []);

  const sendSignal = useCallback((targetUser: string, signalType: string, data: unknown) => {
    if (!meetingIdRef.current) return;
    console.log(`[WebRTC] Sending ${signalType} to ${targetUser}`);
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

    console.log(`[WebRTC] Creating peer for ${remoteUser}, polite=${polite}`);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const remoteStream = new MediaStream();
    const entry: PeerEntry = { pc, stream: remoteStream, makingOffer: false, polite };
    peersRef.current.set(remoteUser, entry);

    // Add current local tracks immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        console.log(`[WebRTC] Adding local ${track.kind} track to peer ${remoteUser}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Receive remote tracks
    pc.ontrack = (e) => {
      console.log(`[WebRTC] Got remote ${e.track.kind} track from ${remoteUser}`);
      remoteStream.addTrack(e.track);
      // Force re-render by creating new map
      updateStreams();
    };

    // Send ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(remoteUser, 'ice_candidate', e.candidate.toJSON());
      }
    };

    // Handle negotiation needed (fires when tracks are added)
    pc.onnegotiationneeded = async () => {
      console.log(`[WebRTC] Negotiation needed for ${remoteUser}`);
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal(remoteUser, 'offer', pc.localDescription!.toJSON());
      } catch (err) {
        console.error('[WebRTC] Negotiation failed:', err);
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${remoteUser}: ${pc.iceConnectionState}`);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${remoteUser}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        console.log(`[WebRTC] Connection failed for ${remoteUser}, closing`);
        pc.close();
        peersRef.current.delete(remoteUser);
        updateStreams();
      }
    };

    return pc;
  }, [sendSignal, updateStreams]);

  // When localStream changes (camera on/off), update tracks on all peers
  useEffect(() => {
    peersRef.current.forEach(async (entry, remoteUser) => {
      const pc = entry.pc;
      if (pc.connectionState === 'closed') return;

      const senders = pc.getSenders();
      const stream = localStreamRef.current;

      if (!stream) {
        // Remove all tracks
        senders.forEach((s) => {
          if (s.track) pc.removeTrack(s);
        });
        return;
      }

      const localTracks = stream.getTracks();

      // Add or replace tracks
      for (const track of localTracks) {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          console.log(`[WebRTC] Replacing ${track.kind} track for ${remoteUser}`);
          await sender.replaceTrack(track);
        } else {
          console.log(`[WebRTC] Adding new ${track.kind} track for ${remoteUser}`);
          pc.addTrack(track, stream);
          // onnegotiationneeded will fire and send a new offer
        }
      }

      // Remove tracks no longer in local stream
      for (const sender of senders) {
        if (sender.track && !localTracks.some((t) => t.kind === sender.track!.kind)) {
          pc.removeTrack(sender);
        }
      }
    });
  }, [localStream]);

  const handleSignal = useCallback(async (fromUser: string, signalType: string, data: unknown) => {
    let entry = peersRef.current.get(fromUser);
    console.log(`[WebRTC] Received ${signalType} from ${fromUser}`);

    if (signalType === 'offer') {
      if (!entry) {
        // Receiving unsolicited offer — we're the polite peer
        createPeer(fromUser, true);
        entry = peersRef.current.get(fromUser);
        if (!entry) return;
      }

      const pc = entry.pc;
      const offerCollision = entry.makingOffer || pc.signalingState !== 'stable';

      if (!entry.polite && offerCollision) {
        console.log(`[WebRTC] Ignoring colliding offer from ${fromUser} (we're impolite)`);
        return;
      }

      if (offerCollision) {
        // Polite peer rolls back
        console.log(`[WebRTC] Rolling back for offer from ${fromUser} (we're polite)`);
        await pc.setLocalDescription({ type: 'rollback' });
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
        await pc.setLocalDescription();
        console.log(`[WebRTC] Sending answer to ${fromUser}`);
        sendSignal(fromUser, 'answer', pc.localDescription!.toJSON());
      } catch (err) {
        console.error(`[WebRTC] Failed to handle offer from ${fromUser}:`, err);
      }
    } else if (signalType === 'answer') {
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
        console.log(`[WebRTC] Answer set from ${fromUser}`);
      } catch (err) {
        console.error(`[WebRTC] Failed to set answer from ${fromUser}:`, err);
      }
    } else if (signalType === 'ice_candidate') {
      if (!entry) return;
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit));
      } catch {
        // Ignore early ICE candidates
      }
    }
  }, [createPeer, sendSignal]);

  const removePeer = useCallback((username: string) => {
    const entry = peersRef.current.get(username);
    if (entry) {
      entry.pc.close();
      peersRef.current.delete(username);
      updateStreams();
    }
  }, [updateStreams]);

  // Cleanup on unmount or meeting change
  useEffect(() => {
    return () => {
      peersRef.current.forEach((entry) => entry.pc.close());
      peersRef.current.clear();
    };
  }, [meetingId]);

  return { remoteStreams, createPeer, removePeer, handleSignal };
}
