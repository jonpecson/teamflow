import { useState, useEffect } from 'react';
import { useCalls } from '../../hooks/useCalls';
import { useAppState } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';

export default function CallPanel() {
  const { currentMeetingId, micEnabled, cameraEnabled, callStartTime, activeCalls, leaveCall, toggleMic, toggleCamera } = useCalls();
  const state = useAppState();
  const [timer, setTimer] = useState('00:00');

  const currentCall = currentMeetingId ? activeCalls.get(currentMeetingId) : null;

  useEffect(() => {
    if (!callStartTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      setTimer(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStartTime]);

  if (!currentCall) return null;

  return (
    <div className="call-panel">
      <div className="call-panel-header">
        <div className="call-info">
          <span className="call-dot" />
          <span>{currentCall.channel_name || 'Call'}</span>
          <span className="call-timer">{timer}</span>
          <span className="call-count">{currentCall.participants.length} participants</span>
        </div>
        <div className="call-controls">
          <button
            className={`call-control-btn ${micEnabled ? 'active' : 'muted'}`}
            title="Mute/Unmute"
            onClick={toggleMic}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <button
            className={`call-control-btn ${cameraEnabled ? 'active' : ''}`}
            title="Camera On/Off"
            onClick={toggleCamera}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          <button className="call-control-btn danger" title="Leave call" onClick={leaveCall}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="video-grid">
        {currentCall.participants.length === 0 ? (
          <div className="call-empty-state"><p>Waiting for participants...</p></div>
        ) : (
          currentCall.participants.map((username) => (
            <div key={username} className={`video-tile ${username === state.username ? 'local-video' : ''}`}>
              <div className="tile-avatar" style={{ background: avatarColor(username) }}>
                {avatarInitial(username)}
              </div>
              <span className="tile-name">{username}{username === state.username ? ' (You)' : ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
