import { useEffect, useRef } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useAppState } from '../../context/AppContext';
import MessageItem from './MessageItem';

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

export default function MessageList() {
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
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.2, marginBottom: 12 }}>
            <rect x="4" y="8" width="40" height="28" rx="6" stroke="currentColor" strokeWidth="2"/>
            <path d="M14 20h20M14 26h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p>Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

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

          // Date divider: show when date changes between messages
          const msgDate = new Date(msg.timestamp);
          const prevDate = prev ? new Date(prev.timestamp) : null;
          const showDateDivider = !prevDate || msgDate.toDateString() !== prevDate.toDateString();

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="date-divider">
                  <span>{formatDate(msgDate)}</span>
                </div>
              )}
              <MessageItem
                message={msg}
                isOwn={msg.user_id === state.userId}
                isCompact={isCompact}
              />
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
