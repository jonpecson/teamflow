import { useEffect, useRef } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useAppState } from '../../context/AppContext';
import MessageItem from './MessageItem';
import UnreadDivider from './UnreadDivider';
import type { MessageData } from '../../api/types';
import { MessageSquare } from 'lucide-react';

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

interface Props {
  onOpenThread?: (msg: MessageData) => void;
  onQuoteReply?: (msg: MessageData) => void;
}

export default function MessageList({ onOpenThread, onQuoteReply }: Props) {
  const { currentMessages } = useMessages();
  const state = useAppState();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  if (!state.currentChannelId) {
    return (
      <div className="messages">
        <div className="empty-state">
          <MessageSquare size={48} strokeWidth={1} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p>Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  // Determine unread divider position
  const lastReadTs = state.lastReadTimestamps.get(state.currentChannelId);
  const unreadCount = state.unreadCounts.get(state.currentChannelId) || 0;
  let unreadDividerInserted = false;

  return (
    <div className="messages">
      {currentMessages.length === 0 ? (
        <div className="empty-state">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        currentMessages.map((msg, i) => {
          const prev = i > 0 ? currentMessages[i - 1] : null;
          const isCompact = prev?.user_id === msg.user_id &&
            new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime() < 120000 &&
            new Date(msg.timestamp).toDateString() === new Date(prev.timestamp).toDateString();

          const msgDate = new Date(msg.timestamp);
          const prevDate = prev ? new Date(prev.timestamp) : null;
          const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

          // Show unread divider before first unread message
          let showUnread = false;
          if (!unreadDividerInserted && lastReadTs && unreadCount > 0) {
            if (msg.timestamp > lastReadTs && msg.user_id !== state.userId) {
              showUnread = true;
              unreadDividerInserted = true;
            }
          }

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="date-divider">
                  <span>{formatDate(msgDate)}</span>
                </div>
              )}
              {showUnread && <UnreadDivider channelId={state.currentChannelId!} />}
              <MessageItem
                message={msg}
                isOwn={msg.user_id === state.userId}
                isCompact={isCompact}
                onOpenThread={onOpenThread}
                onQuoteReply={onQuoteReply}
              />
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
