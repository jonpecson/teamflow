import { useState, useRef, useEffect, useCallback } from 'react';
import { useCalls } from '../../hooks/useCalls';
import type { useLocalMedia } from '../../hooks/useLocalMedia';
import DevicePicker from './DevicePicker';
import CallReactionBar from './CallReactionBar';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MessageSquare, Smile, ChevronUp } from 'lucide-react';

interface Props {
  media: ReturnType<typeof useLocalMedia>;
  showChat: boolean;
  onToggleChat: () => void;
  onMouseActivity?: () => void;
  send?: (msg: object) => void;
}

export default function HuddleControls({ media, showChat, onToggleChat, onMouseActivity, send }: Props) {
  const { leaveCall, endCall, currentMeetingId, activeCalls } = useCalls();
  const [showMicDevices, setShowMicDevices] = useState(false);
  const [showCamDevices, setShowCamDevices] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [pillVisible, setPillVisible] = useState(true);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const reactionTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const currentCall = currentMeetingId ? activeCalls.get(currentMeetingId) : null;
  const isCreator = currentCall?.started_by === localStorage.getItem('username');

  const resetFadeTimer = useCallback(() => {
    setPillVisible(true);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => setPillVisible(false), 5000);
  }, []);

  useEffect(() => {
    resetFadeTimer();
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [resetFadeTimer]);

  // Listen for mouse activity from parent
  useEffect(() => {
    if (onMouseActivity) {
      resetFadeTimer();
    }
  }, [onMouseActivity, resetFadeTimer]);

  const handleScreenShare = async () => {
    if (media.screenSharing) {
      media.stopScreenShare();
    } else {
      await media.startScreenShare();
    }
  };

  const handleLeave = () => {
    media.stopAll();
    leaveCall();
  };

  const handleEnd = () => {
    media.stopAll();
    endCall();
  };

  const handleReaction = (emoji: string) => {
    if (send && currentMeetingId) {
      send({ type: 'call_reaction', meeting_id: currentMeetingId, emoji });
    }
    setShowReactions(false);
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
  };

  const toggleReactions = () => {
    const next = !showReactions;
    setShowReactions(next);
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
    if (next) {
      reactionTimeoutRef.current = setTimeout(() => setShowReactions(false), 3000);
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        setShowMicDevices(false);
        setShowCamDevices(false);
        setShowReactions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMicDevices(false);
        setShowCamDevices(false);
        setShowReactions(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      ref={pillRef}
      className={`huddle-pill ${pillVisible ? '' : 'faded'}`}
      onMouseEnter={() => setPillVisible(true)}
      onMouseLeave={resetFadeTimer}
      onMouseMove={resetFadeTimer}
    >
      {/* Reaction bar floating above */}
      {showReactions && <CallReactionBar onSelect={handleReaction} />}

      {/* Mic with chevron */}
      <div className="ctrl-split">
        <button
          className={`huddle-ctrl-btn ${media.micEnabled ? 'active' : 'muted'}`}
          onClick={media.toggleMic}
          title={media.micEnabled ? 'Mute' : 'Unmute'}
        >
          {media.micEnabled ? (
            <Mic size={20} />
          ) : (
            <MicOff size={20} />
          )}
        </button>
        <button
          className="ctrl-chevron"
          onClick={() => { setShowMicDevices(!showMicDevices); setShowCamDevices(false); }}
          title="Select microphone"
        >
          <ChevronUp size={10} />
        </button>
        {showMicDevices && (
          <div className="chevron-dropdown">
            <DevicePicker
              onClose={() => setShowMicDevices(false)}
              filterKind="audioinput"
              onSwitchMic={media.switchMic}
              selectedMicId={media.selectedMicId}
            />
          </div>
        )}
      </div>

      {/* Camera with chevron */}
      <div className="ctrl-split">
        <button
          className={`huddle-ctrl-btn ${media.cameraEnabled ? 'active' : ''}`}
          onClick={media.toggleCamera}
          title={media.cameraEnabled ? 'Camera Off' : 'Camera On'}
        >
          {media.cameraEnabled ? (
            <Video size={20} />
          ) : (
            <VideoOff size={20} />
          )}
        </button>
        <button
          className="ctrl-chevron"
          onClick={() => { setShowCamDevices(!showCamDevices); setShowMicDevices(false); }}
          title="Select camera"
        >
          <ChevronUp size={10} />
        </button>
        {showCamDevices && (
          <div className="chevron-dropdown">
            <DevicePicker
              onClose={() => setShowCamDevices(false)}
              filterKind="videoinput"
              onSwitchCamera={media.switchCamera}
              selectedCameraId={media.selectedCameraId}
            />
          </div>
        )}
      </div>

      {/* Screen share */}
      <button
        className={`huddle-ctrl-btn ${media.screenSharing ? 'active' : ''}`}
        onClick={handleScreenShare}
        title={media.screenSharing ? 'Stop Sharing' : 'Share Screen'}
      >
        <Monitor size={20} />
      </button>

      {/* Chat */}
      <button
        className={`huddle-ctrl-btn ${showChat ? 'active' : ''}`}
        onClick={onToggleChat}
        title={showChat ? 'Hide Chat' : 'Show Chat'}
      >
        <MessageSquare size={20} />
      </button>

      {/* Reactions */}
      <button
        className={`huddle-ctrl-btn ${showReactions ? 'active' : ''}`}
        onClick={toggleReactions}
        title="React"
      >
        <Smile size={20} />
      </button>

      {/* Leave */}
      <button className="huddle-ctrl-btn leave" onClick={handleLeave} title="Leave Huddle">
        <PhoneOff size={18} />
      </button>

      {/* End (creator only) */}
      {isCreator && (
        <button className="huddle-ctrl-btn end" onClick={handleEnd} title="End for Everyone">
          End
        </button>
      )}
    </div>
  );
}
