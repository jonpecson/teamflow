import { useRef, useEffect, useState } from 'react';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { MicOff, VideoOff } from 'lucide-react';

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
              <MicOff size={12} />
            </span>
          )}
          {isCameraOff && (
            <span className="participant-badge cam-off" title="Camera Off">
              <VideoOff size={12} />
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
