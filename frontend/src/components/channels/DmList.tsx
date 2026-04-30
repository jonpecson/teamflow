import type { Channel } from '../../api/types';
import { avatarColor, avatarInitial } from '../../utils/colors';

interface DmListProps {
  channels: Channel[];
  currentChannelId: string | null;
  unreadCounts: Map<string, number>;
  username: string;
  onSelect: (id: string) => void;
}

export default function DmList({ channels, currentChannelId, unreadCounts, username, onSelect }: DmListProps) {
  const dmDisplayName = (name: string) => {
    const parts = name.replace('dm-', '').split('-');
    return parts.find((p) => p !== username) || parts[0];
  };

  return (
    <ul className="channel-list">
      {channels.map((ch) => {
        const displayName = dmDisplayName(ch.name);
        return (
          <li
            key={ch.id}
            className={ch.id === currentChannelId ? 'active' : ''}
            onClick={() => onSelect(ch.id)}
          >
            <span
              className="msg-avatar"
              style={{ background: avatarColor(displayName), width: 24, height: 24, fontSize: 11, flexShrink: 0 }}
            >
              {avatarInitial(displayName)}
            </span>
            {displayName}
            {(unreadCounts.get(ch.id) || 0) > 0 && (
              <span className="unread">{unreadCounts.get(ch.id)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
