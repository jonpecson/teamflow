import { useState } from 'react';
import { useCalls } from '../../hooks/useCalls';
import type { useLocalMedia } from '../../hooks/useLocalMedia';
import DevicePicker from './DevicePicker';

interface Props {
  media: ReturnType<typeof useLocalMedia>;
  showChat: boolean;
  onToggleChat: () => void;
}

export default function HuddleControls({ media, showChat, onToggleChat }: Props) {
  const { leaveCall, endCall, currentMeetingId, activeCalls } = useCalls();
  const [showDevices, setShowDevices] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const currentCall = currentMeetingId ? activeCalls.get(currentMeetingId) : null;
  const isCreator = currentCall?.started_by === localStorage.getItem('username');

  const handleScreenShare = async () => {
    if (media.screenSharing) {
      media.stopScreenShare();
    } else {
      await media.startScreenShare();
    }
    setShowMore(false);
  };

  const handleLeave = () => {
    media.stopAll();
    leaveCall();
  };

  const handleEnd = () => {
    media.stopAll();
    endCall();
  };

  return (
    <div className="huddle-controls-bar">
      <div className="huddle-controls-group">
        {/* Always visible: Mic */}
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

        {/* Desktop only: Camera, Screen Share, Chat, Devices */}
        <button
          className={`huddle-ctrl-btn desktop-only ${media.cameraEnabled ? 'active' : ''}`}
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
          className={`huddle-ctrl-btn desktop-only ${media.screenSharing ? 'active' : ''}`}
          onClick={handleScreenShare}
          title={media.screenSharing ? 'Stop Sharing' : 'Share Screen'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </button>
        <button
          className={`huddle-ctrl-btn desktop-only ${showChat ? 'active' : ''}`}
          onClick={onToggleChat}
          title={showChat ? 'Hide Chat' : 'Show Chat'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
        <button
          className="huddle-ctrl-btn desktop-only device-btn"
          onClick={() => setShowDevices(!showDevices)}
          title="Devices"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
        {showDevices && <DevicePicker onClose={() => setShowDevices(false)} />}

        {/* Mobile only: More button */}
        <div className="mobile-more-wrapper mobile-only">
          <button
            className={`huddle-ctrl-btn ${showMore ? 'active' : ''}`}
            onClick={() => setShowMore(!showMore)}
            title="More"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
            </svg>
          </button>
          {showMore && (
            <div className="mobile-call-menu">
              <button onClick={() => { media.toggleCamera(); setShowMore(false); }}>
                {media.cameraEnabled ? '📷 Camera Off' : '📷 Camera On'}
              </button>
              <button onClick={handleScreenShare}>
                {media.screenSharing ? '🖥 Stop Share' : '🖥 Share Screen'}
              </button>
              <button onClick={() => { onToggleChat(); setShowMore(false); }}>
                💬 {showChat ? 'Hide Chat' : 'Show Chat'}
              </button>
              <button onClick={() => { setShowDevices(!showDevices); setShowMore(false); }}>
                ⚙️ Devices
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="huddle-controls-group">
        <button className="huddle-ctrl-btn leave" onClick={handleLeave} title="Leave Huddle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <span>Leave</span>
        </button>
        {isCreator && (
          <button className="huddle-ctrl-btn end" onClick={handleEnd} title="End for Everyone">
            <span>End</span>
          </button>
        )}
      </div>
    </div>
  );
}
