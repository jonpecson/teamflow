import ParticipantTile from './ParticipantTile';

interface Props {
  participants: string[];
  currentUser: string;
  speakingUsers: Set<string>;
  localStream: MediaStream | null;
  cameraEnabled: boolean;
  remoteStreams: Map<string, MediaStream>;
}

export default function ParticipantGrid({ participants, currentUser, speakingUsers, localStream, cameraEnabled, remoteStreams }: Props) {
  const count = participants.length;
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
        return (
          <ParticipantTile
            key={username}
            username={username}
            isLocal={isLocal}
            isSpeaking={speakingUsers.has(username)}
            hasVideo={isLocal ? cameraEnabled : hasRemoteVideo}
            stream={isLocal ? localStream : remoteStream || null}
          />
        );
      })}
    </div>
  );
}
