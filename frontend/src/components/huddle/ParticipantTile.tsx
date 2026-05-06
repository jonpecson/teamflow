import { useRef, useEffect, useState } from 'react';
import { avatarColor, avatarInitial } from '../../utils/colors';

interface Props {
  username: string;
  isLocal: boolean;
  isSpeaking: boolean;
  hasVideo: boolean;
  stream: MediaStream | null;
  isMuted?: boolean;
  isCameraOff?: boolean;
}

export default function ParticipantTile({ username, isLocal, isSpeaking, hasVideo, stream, isMuted, isCameraOff }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoLive, setVideoLive] = useState(false);

  // Attach video stream
  useEffect(() => {
    if (!stream) {
      setVideoLive(false);
      return;
    }

    const checkVideo = () => {
      const hasVid = stream.getVideoTracks().length > 0 && stream.getVideoTracks().some(t => t.enabled);
      setVideoLive(hasVid);
    };

    stream.addEventListener('addtrack', checkVideo);
    stream.addEventListener('removetrack', checkVideo);
    checkVideo();

    return () => {
      stream.removeEventListener('addtrack', checkVideo);
      stream.removeEventListener('removetrack', checkVideo);
    };
  }, [stream]);

  // Set video srcObject
  useEffect(() => {
    if (videoRef.current && stream && (hasVideo || videoLive)) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, hasVideo, videoLive]);

  // Play remote audio separately (not muted)
  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [stream, isLocal]);

  const showVideo = hasVideo || videoLive;

  return (
    <div className={`participant-tile ${isSpeaking ? 'speaking' : ''} ${isLocal ? 'local' : ''}`}>
      {showVideo && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="participant-video"
        />
      ) : (
        <div className="participant-avatar" style={{ background: avatarColor(username) }}>
          {avatarInitial(username)}
        </div>
      )}
      {/* Hidden audio element for remote participants */}
      {!isLocal && stream && (
        <audio ref={audioRef} autoPlay playsInline />
      )}
      {/* Status badges */}
      {(isMuted || isCameraOff) && (
        <div className="participant-badge-bar">
          {isMuted && (
            <span className="participant-badge mic-off" title="Muted">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
              </svg>
            </span>
          )}
          {isCameraOff && (
            <span className="participant-badge cam-off" title="Camera Off">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </span>
          )}
        </div>
      )}
      <div className="participant-label">
        <span>{username}{isLocal ? ' (You)' : ''}</span>
      </div>
    </div>
  );
}
