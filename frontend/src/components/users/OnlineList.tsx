import { useChannels } from '../../hooks/useChannels';

interface OnlineListProps {
  onlineUsers: Map<string, string>;
  currentUserId: string | null;
}

export default function OnlineList({ onlineUsers, currentUserId }: OnlineListProps) {
  const { openDm } = useChannels();

  return (
    <ul className="online-list">
      {Array.from(onlineUsers.entries()).map(([userId, username]) => (
        <li
          key={userId}
          className={userId !== currentUserId ? 'clickable' : ''}
          onClick={() => {
            if (userId !== currentUserId) openDm(userId);
          }}
        >
          <span className="online-dot" />
          {username}
          {userId === currentUserId && <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 4 }}>(you)</span>}
        </li>
      ))}
    </ul>
  );
}
