import { useAppDispatch } from '../../context/AppContext';

interface Props {
  channelId: string;
}

export default function UnreadDivider({ channelId }: Props) {
  const dispatch = useAppDispatch();

  const handleMarkRead = () => {
    dispatch({ type: 'SET_LAST_READ', channelId, timestamp: new Date().toISOString() });
    dispatch({ type: 'CLEAR_UNREAD', channelId });
  };

  return (
    <div className="unread-divider">
      <span className="unread-divider-label">New messages</span>
      <button className="unread-divider-mark" onClick={handleMarkRead}>
        Mark as read
      </button>
    </div>
  );
}
