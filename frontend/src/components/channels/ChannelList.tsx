import type { Channel, ActiveCall } from '../../api/types';

interface ChannelListProps {
  channels: Channel[];
  myChannelIds: Set<string>;
  currentChannelId: string | null;
  unreadCounts: Map<string, number>;
  activeCalls: Map<string, ActiveCall>;
  onSelect: (id: string) => void;
}

export default function ChannelList({ channels, myChannelIds, currentChannelId, unreadCounts, activeCalls, onSelect }: ChannelListProps) {
  const hasActiveCall = (channelId: string) =>
    Array.from(activeCalls.values()).some((c) => c.channel_id === channelId);

  return (
    <ul className="channel-list">
      {channels.map((ch) => (
        <li
          key={ch.id}
          className={ch.id === currentChannelId ? 'active' : ''}
          onClick={() => onSelect(ch.id)}
        >
          <span className="channel-prefix">#</span>
          {ch.name}
          {hasActiveCall(ch.id) && <span className="call-active-badge" />}
          {(unreadCounts.get(ch.id) || 0) > 0 && (
            <span className="unread">{unreadCounts.get(ch.id)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
