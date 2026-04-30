import { useState, useRef } from 'react';
import { useMessages } from '../../hooks/useMessages';

interface MessageInputProps {
  send: (msg: object) => void;
}

export default function MessageInput({ send }: MessageInputProps) {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { sendMessage } = useMessages();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage(send, content);
    setContent('');
    inputRef.current?.focus();
  };

  return (
    <form className="message-form" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        type="text"
        placeholder="Type something for sent..."
        maxLength={4000}
        autoComplete="off"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button type="submit" className="send-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </form>
  );
}
