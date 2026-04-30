import { useRef, useEffect } from 'react';
import ParticipantTile from './ParticipantTile';

interface Props {
  sharer: string;
  participants: string[];
  currentUser: string;
  onStopShare: () => void;
  screenStream: MediaStream | null;
  localStream: MediaStream | null;
  cameraEnabled: boolean;
  remoteStreams: Map<string, MediaStream>;
}

export default function ScreenShareView({ sharer, participants, currentUser, onStopShare, screenStream, localStream, cameraEnabled, remoteStreams }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLocalSharing = sharer === currentUser;

  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  return (
    <div className="screen-share-layout">
      <div className="screen-share-main">
        {screenStream ? (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 'var(--radius-lg)' }}
            />
            {isLocalSharing && (
              <button className="btn-primary" onClick={onStopShare} style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}>
                Stop Sharing
              </button>
            )}
          </div>
        ) : (
          <div className="screen-share-placeholder">
            <p>{sharer} is sharing their screen</p>
          </div>
        )}
      </div>
      <div className="screen-share-sidebar">
        {participants.map((username) => {
          const isLocal = username === currentUser;
          const remoteStream = remoteStreams.get(username);
          const hasRemoteVideo = remoteStream ? remoteStream.getVideoTracks().length > 0 : false;
          return (
            <ParticipantTile
              key={username}
              username={username}
              isLocal={isLocal}
              isSpeaking={false}
              hasVideo={isLocal ? cameraEnabled : hasRemoteVideo}
              stream={isLocal ? localStream : remoteStream || null}
            />
          );
        })}
      </div>
    </div>
  );
}
