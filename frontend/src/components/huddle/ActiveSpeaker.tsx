import { avatarColor, avatarInitial } from '../../utils/colors';

interface Props {
  username: string;
}

export default function ActiveSpeaker({ username }: Props) {
  return (
    <div className="active-speaker">
      <div className="active-speaker-glow" style={{ borderColor: 'var(--success)' }}>
        <div className="participant-avatar" style={{ background: avatarColor(username) }}>
          {avatarInitial(username)}
        </div>
      </div>
      <span className="active-speaker-name">{username}</span>
    </div>
  );
}
