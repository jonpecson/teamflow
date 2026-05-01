import { useRef, useEffect, useState } from 'react';
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoLive, setVideoLive] = useState(false);

  // Attach video stream
  useEffect(() => {
    if (!stream) {
      setVideoLive(false);
      return;
    }

    // Listen for track additions on the remote stream
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
          muted // Always mute video element (audio plays via separate element)
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
      <div className="participant-label">
        <span>{username}{isLocal ? ' (You)' : ''}</span>
      </div>
    </div>
  );
}
