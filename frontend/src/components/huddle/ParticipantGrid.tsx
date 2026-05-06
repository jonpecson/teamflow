import { useRef } from 'react';
import ParticipantTile from './ParticipantTile';

interface Props {
  participants: string[];
  currentUser: string;
  speakingUsers: Set<string>;
  localStream: MediaStream | null;
  cameraEnabled: boolean;
  remoteStreams: Map<string, MediaStream>;
  dominantSpeaker?: string | null;
  participantMedia?: Map<string, { muted: boolean; cameraOff: boolean }>;
}

export default function ParticipantGrid({
  participants, currentUser, speakingUsers, localStream, cameraEnabled,
  remoteStreams, dominantSpeaker, participantMedia,
}: Props) {
  const prevDominantRef = useRef<string | null>(null);
  const count = participants.length;

  const useDominantLayout = dominantSpeaker && count > 2;

  if (useDominantLayout) {
    const others = participants.filter((p) => p !== dominantSpeaker);
    const dominantStream = dominantSpeaker === currentUser ? localStream : remoteStreams.get(dominantSpeaker) || null;
    const dominantHasVideo = dominantSpeaker === currentUser ? cameraEnabled : (dominantStream?.getVideoTracks().length ?? 0) > 0;
    const dominantMedia = participantMedia?.get(dominantSpeaker);
    const crossfade = prevDominantRef.current !== dominantSpeaker;
    prevDominantRef.current = dominantSpeaker;

    return (
      <div className="participant-grid dominant-layout">
        <div className={`dominant-tile ${crossfade ? 'dominant-transition' : ''}`} key={dominantSpeaker}>
          <ParticipantTile
            username={dominantSpeaker}
            isLocal={dominantSpeaker === currentUser}
            isSpeaking={speakingUsers.has(dominantSpeaker)}
            hasVideo={dominantHasVideo}
            stream={dominantStream}
            isMuted={dominantMedia?.muted}
            isCameraOff={dominantMedia?.cameraOff}
          />
        </div>
        <div className="participant-strip">
          {others.map((username) => {
            const isLocal = username === currentUser;
            const remoteStream = remoteStreams.get(username);
            const hasRemoteVideo = remoteStream ? remoteStream.getVideoTracks().length > 0 : false;
            const media = participantMedia?.get(username);
            return (
              <ParticipantTile
                key={username}
                username={username}
                isLocal={isLocal}
                isSpeaking={speakingUsers.has(username)}
                hasVideo={isLocal ? cameraEnabled : hasRemoteVideo}
                stream={isLocal ? localStream : remoteStream || null}
                isMuted={media?.muted}
                isCameraOff={media?.cameraOff}
              />
            );
          })}
        </div>
      </div>
    );
  }

  prevDominantRef.current = null;

  const gridClass =
    count <= 1 ? 'grid-1' :
    count <= 2 ? 'grid-2' :
    count <= 4 ? 'grid-4' :
    count <= 9 ? 'grid-9' : 'grid-many';

  return (
    <div className={`participant-grid ${gridClass}`}>
      {participants.map((username) => {
        const isLocal = username === currentUser;
        const remoteStream = remoteStreams.get(username);
        const hasRemoteVideo = remoteStream ? remoteStream.getVideoTracks().length > 0 : false;
        const media = participantMedia?.get(username);
        return (
          <ParticipantTile
            key={username}
            username={username}
            isLocal={isLocal}
            isSpeaking={speakingUsers.has(username)}
            hasVideo={isLocal ? cameraEnabled : hasRemoteVideo}
            stream={isLocal ? localStream : remoteStream || null}
            isMuted={media?.muted}
            isCameraOff={media?.cameraOff}
          />
        );
      })}
    </div>
  );
}
