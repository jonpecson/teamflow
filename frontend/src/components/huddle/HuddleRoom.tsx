import { useState, useEffect, useCallback, useRef } from 'react';
import { useCalls } from '../../hooks/useCalls';
import type { useLocalMedia } from '../../hooks/useLocalMedia';
import { usePeerConnections } from '../../hooks/usePeerConnections';
import { useAppState } from '../../context/AppContext';
import { useAudioLevels } from '../../hooks/useAudioLevels';
import ParticipantGrid from './ParticipantGrid';
import HuddleControls from './HuddleControls';
import HuddleChatPanel from './HuddleChatPanel';
import ScreenShareView from './ScreenShareView';
import FloatingReaction from './FloatingReaction';

interface Props {
  send: (msg: object) => void;
  setRtcSignalHandler: (handler: ((fromUser: string, signalType: string, data: unknown) => void) | null) => void;
  setCallReactionHandler: (handler: ((username: string, emoji: string) => void) | null) => void;
  media: ReturnType<typeof useLocalMedia>;
}

interface Reaction {
  id: string;
  emoji: string;
  username: string;
}

export default function HuddleRoom({ send, setRtcSignalHandler, setCallReactionHandler, media }: Props) {
  const { currentMeetingId, activeCalls, callStartTime } = useCalls();
  const state = useAppState();
  const [timer, setTimer] = useState('00:00');
  const [showChat, setShowChat] = useState(false);
  const [mouseActivity, setMouseActivity] = useState(0);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const reactionIdRef = useRef(0);

  const currentCall = currentMeetingId ? activeCalls.get(currentMeetingId) : null;
  const { remoteStreams, createPeer, removePeer, handleSignal } = usePeerConnections(send, currentMeetingId, media.localStream, media.screenStream);

  // Audio levels
  const { speakingUsers, dominantSpeaker } = useAudioLevels(remoteStreams, media.localStream, state.username || '');

  // Reaction handler
  const handleReaction = useCallback((username: string, emoji: string) => {
    const id = `r-${++reactionIdRef.current}`;
    setReactions((prev) => [...prev, { id, emoji, username }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  }, []);

  useEffect(() => {
    setCallReactionHandler(handleReaction);
    return () => setCallReactionHandler(null);
  }, [handleReaction, setCallReactionHandler]);

  // Broadcast screen share state
  useEffect(() => {
    if (!currentMeetingId || !currentCall) return;
    if (media.screenSharing) {
      send({ type: 'call_screen_share_on', meeting_id: currentMeetingId });
    } else {
      send({ type: 'call_screen_share_off', meeting_id: currentMeetingId });
    }
  }, [media.screenSharing, currentMeetingId]);

  // Register RTC signal handler
  useEffect(() => {
    setRtcSignalHandler(handleSignal);
    return () => setRtcSignalHandler(null);
  }, [handleSignal, setRtcSignalHandler]);

  // Auto-start mic on mount
  useEffect(() => {
    media.startMic();
  }, []);

  // Peer connections
  useEffect(() => {
    if (!currentCall || !state.username) return;
    currentCall.participants.forEach((p) => {
      if (p !== state.username) {
        const weInitiate = state.username! > p;
        createPeer(p, !weInitiate);
      }
    });
  }, [currentCall?.participants.join(','), state.username, createPeer]);

  // Timer
  useEffect(() => {
    if (!callStartTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      setTimer(`${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStartTime]);

  // Remote screen sharer
  const remoteScreenSharer = (() => {
    for (const [username, stream] of remoteStreams) {
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length >= 2) {
        const screenTrack = videoTracks[videoTracks.length - 1];
        return { username, stream: new MediaStream([screenTrack]) };
      }
    }
    return null;
  })();

  if (!currentCall) return null;

  return (
    <div
      className={`huddle-room ${showChat ? 'with-chat' : ''}`}
      onMouseMove={() => setMouseActivity((n) => n + 1)}
    >
      <div className="huddle-room-header">
        <div className="huddle-room-info">
          <span className="huddle-pulse" />
          <span className="huddle-room-channel">#{currentCall.channel_name}</span>
          <span className="call-timer">{timer}</span>
          <span className="call-count">{currentCall.participants.length} participants</span>
        </div>
      </div>
      <div className="huddle-room-body">
        <div className="huddle-room-content">
          {media.screenSharing && media.screenStream ? (
            <ScreenShareView
              sharer={state.username || ''}
              participants={currentCall.participants}
              currentUser={state.username || ''}
              onStopShare={media.stopScreenShare}
              screenStream={media.screenStream}
              localStream={media.localStream}
              cameraEnabled={media.cameraEnabled}
              remoteStreams={remoteStreams}
            />
          ) : remoteScreenSharer ? (
            <ScreenShareView
              sharer={remoteScreenSharer.username}
              participants={currentCall.participants}
              currentUser={state.username || ''}
              onStopShare={() => {}}
              screenStream={remoteScreenSharer.stream}
              localStream={media.localStream}
              cameraEnabled={media.cameraEnabled}
              remoteStreams={remoteStreams}
            />
          ) : (
            <ParticipantGrid
              participants={currentCall.participants}
              currentUser={state.username || ''}
              speakingUsers={speakingUsers}
              localStream={media.localStream}
              cameraEnabled={media.cameraEnabled}
              remoteStreams={remoteStreams}
              dominantSpeaker={dominantSpeaker}
              participantMedia={state.callParticipantMedia}
            />
          )}
          {/* Floating reactions */}
          {reactions.map((r) => (
            <FloatingReaction
              key={r.id}
              emoji={r.emoji}
              style={{
                bottom: '100px',
                left: `${30 + Math.random() * 40}%`,
              }}
              onDone={() => setReactions((prev) => prev.filter((x) => x.id !== r.id))}
            />
          ))}
        </div>
        {showChat && <HuddleChatPanel send={send} onClose={() => setShowChat(false)} />}
      </div>
      <HuddleControls
        media={media}
        showChat={showChat}
        onToggleChat={() => setShowChat(!showChat)}
        onMouseActivity={() => {}}
        send={send}
      />
    </div>
  );
}
