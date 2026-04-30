import { useEffect, useRef, useState } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useAppState } from '../../context/AppContext';
import MessageItem from '../messages/MessageItem';

interface Props {
  send: (msg: object) => void;
  onClose: () => void;
}

export default function HuddleChatPanel({ send, onClose }: Props) {
  const { currentMessages, sendMessage } = useMessages();
  const state = useAppState();
  const [content, setContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage(send, content);
    setContent('');
    inputRef.current?.focus();
  };

  return (
    <div className="huddle-chat-panel">
      <div className="huddle-chat-header">
        <h4>Chat</h4>
        <button className="huddle-chat-close" onClick={onClose}>&times;</button>
      </div>
      <div className="huddle-chat-messages">
        {currentMessages.length === 0 ? (
          <div className="huddle-chat-empty">No messages yet</div>
        ) : (
          currentMessages.map((msg, i) => {
            const prev = i > 0 ? currentMessages[i - 1] : null;
            const isCompact = prev?.user_id === msg.user_id &&
              new Date(msg.timestamp).getTime() - new Date(prev.timestamp).getTime() < 120000;
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                isOwn={msg.user_id === state.userId}
                isCompact={isCompact}
              />
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form className="huddle-chat-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Send a message..."
          maxLength={4000}
          autoComplete="off"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button type="submit" className="huddle-chat-send">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </form>
    </div>
  );
}
