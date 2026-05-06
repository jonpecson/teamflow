import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCalls } from '../../hooks/useCalls';
import { useAppDispatch } from '../../context/AppContext';

import { avatarColor, avatarInitial } from '../../utils/colors';
import type { useLocalMedia } from '../../hooks/useLocalMedia';
import { Mic, Video, PhoneOff } from 'lucide-react';

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
          <Mic size={14} />
        </button>
        <button
          className={`huddle-mini-btn ${media?.cameraEnabled ? '' : 'muted'}`}
          onClick={(e) => { e.stopPropagation(); media?.toggleCamera(); }}
          title={media?.cameraEnabled ? 'Camera Off' : 'Camera On'}
        >
          <Video size={14} />
        </button>
        <button
          className="huddle-mini-btn danger"
          onClick={(e) => { e.stopPropagation(); media?.stopAll(); leaveCall(); }}
          title="Leave"
        >
          <PhoneOff size={14} />
        </button>
      </div>
    </div>,
    document.body
  );
}
