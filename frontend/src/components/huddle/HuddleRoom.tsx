import { useState, useEffect, useCallback } from 'react';
import { useCalls } from '../../hooks/useCalls';
import { useLocalMedia } from '../../hooks/useLocalMedia';
import { usePeerConnections } from '../../hooks/usePeerConnections';
import { useAppState } from '../../context/AppContext';
import ParticipantGrid from './ParticipantGrid';
import HuddleControls from './HuddleControls';
import HuddleChatPanel from './HuddleChatPanel';
import ScreenShareView from './ScreenShareView';

interface Props {
  send: (msg: object) => void;
  setRtcSignalHandler: (handler: ((fromUser: string, signalType: string, data: unknown) => void) | null) => void;
}

export default function HuddleRoom({ send, setRtcSignalHandler }: Props) {
  const { currentMeetingId, activeCalls, callStartTime } = useCalls();
  const media = useLocalMedia();
  const state = useAppState();
  const [timer, setTimer] = useState('00:00');
  const [showChat, setShowChat] = useState(false);

  const currentCall = currentMeetingId ? activeCalls.get(currentMeetingId) : null;
  const { remoteStreams, createPeer, removePeer, handleSignal } = usePeerConnections(send, currentMeetingId, media.localStream);

  // Register RTC signal handler
  useEffect(() => {
    setRtcSignalHandler(handleSignal);
    return () => setRtcSignalHandler(null);
  }, [handleSignal, setRtcSignalHandler]);

  // Auto-start mic on mount (voice-first huddle)
  useEffect(() => {
    media.startMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When participants change, create peer connections.
  // Use alphabetical order to determine roles: lower name = polite, higher = impolite (initiator).
  // This ensures exactly one side initiates, avoiding offer collisions.
  useEffect(() => {
    if (!currentCall || !state.username) return;
    currentCall.participants.forEach((p) => {
      if (p !== state.username) {
        // The user with the alphabetically "higher" name initiates
        const weInitiate = state.username! > p;
        createPeer(p, !weInitiate); // polite = we don't initiate
      }
    });
  }, [currentCall?.participants.join(','), state.username, createPeer]);

  useEffect(() => {
    if (!callStartTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      setTimer(`${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStartTime]);

  if (!currentCall) return null;

  return (
    <div className={`huddle-room ${showChat ? 'with-chat' : ''}`}>
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
          ) : (
            <ParticipantGrid
              participants={currentCall.participants}
              currentUser={state.username || ''}
              speakingUsers={new Set()}
              localStream={media.localStream}
              cameraEnabled={media.cameraEnabled}
              remoteStreams={remoteStreams}
            />
          )}
        </div>
        {showChat && <HuddleChatPanel send={send} onClose={() => setShowChat(false)} />}
      </div>
      <HuddleControls media={media} showChat={showChat} onToggleChat={() => setShowChat(!showChat)} />
    </div>
  );
}
