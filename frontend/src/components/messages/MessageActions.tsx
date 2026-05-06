import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';

interface Props {
  messageId: string;
  isOwn: boolean;
  onReply: () => void;
  onQuoteReply: () => void;
  onShowEmojiPicker: (e: React.MouseEvent) => void;
}

export default function MessageActions({ messageId, isOwn, onReply, onQuoteReply, onShowEmojiPicker }: Props) {
  const [showMore, setShowMore] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore]);

  const handleCopy = async () => {
    const msgEl = document.querySelector(`[data-msg-id="${messageId}"] .msg-text`);
    if (msgEl) {
      await navigator.clipboard.writeText(msgEl.textContent || '');
    }
    setShowMore(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteMessage(messageId);
    } catch (err) {
      console.error('Delete failed:', err);
    }
    setShowMore(false);
  };

  const handleBookmark = async () => {
    try {
      await api.toggleBookmark(messageId);
    } catch (err) {
      console.error('Bookmark failed:', err);
    }
    setShowMore(false);
  };

  return (
    <div className="msg-actions">
      <button className="msg-action-btn" title="React" onClick={onShowEmojiPicker}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
      </button>
      <button className="msg-action-btn" title="Reply in Thread" onClick={onReply}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      </button>
      <button className="msg-action-btn" title="Bookmark" onClick={handleBookmark}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
        </svg>
      </button>
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button className="msg-action-btn" title="More" onClick={() => setShowMore(!showMore)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
          </svg>
        </button>
        {showMore && (
          <div className="msg-more-menu">
            <button onClick={() => { onQuoteReply(); setShowMore(false); }}>Quote Reply</button>
            <button onClick={handleCopy}>Copy Text</button>
            {isOwn && <button className="danger" onClick={handleDelete}>Delete Message</button>}
          </div>
        )}
      </div>
    </div>
  );
}
