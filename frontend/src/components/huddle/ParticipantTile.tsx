import { useRef, useEffect } from 'react';
import { avatarColor, avatarInitial } from '../../utils/colors';

interface Props {
  username: string;
  isLocal: boolean;
  isSpeaking: boolean;
  hasVideo: boolean;
  stream: MediaStream | null;
}

export default function ParticipantTile({ username, isLocal, isSpeaking, hasVideo, stream }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream && hasVideo) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, hasVideo]);

  return (
    <div className={`participant-tile ${isSpeaking ? 'speaking' : ''} ${isLocal ? 'local' : ''}`}>
      {hasVideo && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="participant-video"
        />
      ) : (
        <div className="participant-avatar" style={{ background: avatarColor(username) }}>
          {avatarInitial(username)}
        </div>
      )}
      <div className="participant-label">
        <span>{username}{isLocal ? ' (You)' : ''}</span>
      </div>
    </div>
  );
}
