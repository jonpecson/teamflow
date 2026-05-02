import { useState, useRef, useCallback, useEffect } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useAppState } from '../../context/AppContext';

interface MessageInputProps {
  send: (msg: object) => void;
  quotePrefix?: string;
  onClearQuote?: () => void;
}

export default function MessageInput({ send, quotePrefix, onClearQuote }: MessageInputProps) {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);
  const { sendMessage } = useMessages();
  const state = useAppState();

  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current > 2000 && state.currentChannelId) {
      lastTypingRef.current = now;
      send({ type: 'typing', channel_id: state.currentChannelId });
    }
  }, [send, state.currentChannelId]);

  // Apply quote prefix when it changes
  useEffect(() => {
    if (quotePrefix) {
      setContent(quotePrefix);
      onClearQuote?.();
      inputRef.current?.focus();
    }
  }, [quotePrefix, onClearQuote]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage(send, content);
    setContent('');
    inputRef.current?.focus();
  };

  // Typing indicator display
  const typingMap = state.currentChannelId
    ? state.typingUsers.get(state.currentChannelId)
    : null;
  const typingNames = typingMap ? Array.from(typingMap.keys()) : [];

  return (
    <>
      {typingNames.length > 0 && (
        <div className="typing-indicator">
          <span className="typing-dots"><span /><span /><span /></span>
          {typingNames.length === 1
            ? `${typingNames[0]} is typing...`
            : typingNames.length === 2
            ? `${typingNames[0]} and ${typingNames[1]} are typing...`
            : `${typingNames.length} people are typing...`
          }
        </div>
      )}
      <form className="message-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Message..."
          maxLength={4000}
          autoComplete="off"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (e.target.value) handleTyping();
          }}
        />
        <button type="submit" className="send-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </form>
    </>
  );
}
