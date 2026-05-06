import { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';
import { Smile, MessageSquare, Bookmark, MoreHorizontal, Pencil } from 'lucide-react';

interface Props {
  messageId: string;
  isOwn: boolean;
  onReply: () => void;
  onQuoteReply: () => void;
  onShowEmojiPicker: (e: React.MouseEvent) => void;
  onEdit?: () => void;
}

export default function MessageActions({ messageId, isOwn, onReply, onQuoteReply, onShowEmojiPicker, onEdit }: Props) {
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
        <Smile size={18} />
      </button>
      {isOwn && onEdit && (
        <button className="msg-action-btn" title="Edit" onClick={onEdit}>
          <Pencil size={18} />
        </button>
      )}
      <button className="msg-action-btn" title="Reply in Thread" onClick={onReply}>
        <MessageSquare size={18} />
      </button>
      <button className="msg-action-btn" title="Bookmark" onClick={handleBookmark}>
        <Bookmark size={18} />
      </button>
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button className="msg-action-btn" title="More" onClick={() => setShowMore(!showMore)}>
          <MoreHorizontal size={18} />
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
