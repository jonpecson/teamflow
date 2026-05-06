import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCalls } from '../../hooks/useCalls';
import { useAppDispatch } from '../../context/AppContext';

import { avatarColor, avatarInitial } from '../../utils/colors';
import type { useLocalMedia } from '../../hooks/useLocalMedia';

interface Props {
  media?: ReturnType<typeof useLocalMedia>;
  callChannelId?: string;
}

export default function HuddleMiniWindow({ media, callChannelId }: Props) {
  const { currentMeetingId, activeCalls, callStartTime, leaveCall } = useCalls();
  const dispatch = useAppDispatch();
  const [pos, setPos] = useState({ x: window.innerWidth - 280, y: window.innerHeight - 220 });
  const [dragging, setDragging] = useState(false);
  const [timer, setTimer] = useState('00:00');
  const [wasDragged, setWasDragged] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentCall = currentMeetingId ? activeCalls.get(currentMeetingId) : null;
  const username = localStorage.getItem('username') || '';

  useEffect(() => {
    if (!callStartTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      setTimer(`${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStartTime]);

  // Attach local video
  useEffect(() => {
    if (videoRef.current && media?.localStream && media.cameraEnabled) {
      videoRef.current.srcObject = media.localStream;
      videoRef.current.play().catch(() => {});
    }
  }, [media?.localStream, media?.cameraEnabled]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    setWasDragged(false);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
      setWasDragged(true);
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const handleClick = () => {
    if (!wasDragged && callChannelId) {
      dispatch({ type: 'SELECT_CHANNEL', channelId: callChannelId });
    }
  };

  if (!currentCall) return null;

  const showVideo = media?.cameraEnabled && media?.localStream;

  return createPortal(
    <div
      className="huddle-mini"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Video preview or avatar */}
      <div className="huddle-mini-video-area">
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="huddle-mini-video"
          />
        ) : (
          <div className="huddle-mini-avatar" style={{ background: avatarColor(username) }}>
            {avatarInitial(username)}
          </div>
        )}
      </div>
      <div className="huddle-mini-header">
        <span className="huddle-pulse" />
        <span className="huddle-mini-channel">#{currentCall.channel_name}</span>
        <span className="huddle-mini-count">{currentCall.participants.length}</span>
      </div>
      <div className="huddle-mini-timer">{timer}</div>
      <div className="huddle-mini-controls">
        <button
          className={`huddle-mini-btn ${media?.micEnabled === false ? 'muted' : ''}`}
          onClick={(e) => { e.stopPropagation(); media?.toggleMic(); }}
          title={media?.micEnabled ? 'Mute' : 'Unmute'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
          </svg>
        </button>
        <button
          className={`huddle-mini-btn ${media?.cameraEnabled ? '' : 'muted'}`}
          onClick={(e) => { e.stopPropagation(); media?.toggleCamera(); }}
          title={media?.cameraEnabled ? 'Camera Off' : 'Camera On'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </button>
        <button
          className="huddle-mini-btn danger"
          onClick={(e) => { e.stopPropagation(); media?.stopAll(); leaveCall(); }}
          title="Leave"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
}
