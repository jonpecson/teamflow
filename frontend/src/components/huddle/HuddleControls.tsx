import { useState, useRef, useEffect, useCallback } from 'react';
import { useCalls } from '../../hooks/useCalls';
import type { useLocalMedia } from '../../hooks/useLocalMedia';
import DevicePicker from './DevicePicker';
import CallReactionBar from './CallReactionBar';

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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
              <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17"/>
              <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>
        <button
          className="ctrl-chevron"
          onClick={() => { setShowMicDevices(!showMicDevices); setShowCamDevices(false); }}
          title="Select microphone"
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M5 0l5 6H0z"/></svg>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          )}
        </button>
        <button
          className="ctrl-chevron"
          onClick={() => { setShowCamDevices(!showCamDevices); setShowMicDevices(false); }}
          title="Select camera"
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M5 0l5 6H0z"/></svg>
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </button>

      {/* Chat */}
      <button
        className={`huddle-ctrl-btn ${showChat ? 'active' : ''}`}
        onClick={onToggleChat}
        title={showChat ? 'Hide Chat' : 'Show Chat'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      </button>

      {/* Reactions */}
      <button
        className={`huddle-ctrl-btn ${showReactions ? 'active' : ''}`}
        onClick={toggleReactions}
        title="React"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </button>

      {/* Leave */}
      <button className="huddle-ctrl-btn leave" onClick={handleLeave} title="Leave Huddle">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
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
