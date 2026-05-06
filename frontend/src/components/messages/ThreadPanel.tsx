import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useAppState } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { linkify, escapeMessage } from '../../utils/links';
import type { MessageData } from '../../api/types';
import { SendHorizontal } from 'lucide-react';

interface Props {
  parentMessage: MessageData;
  send: (msg: object) => void;
  onClose: () => void;
}

interface ThreadReply {
  id: string;
  channel_id: string;
  parent_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  role?: string;
  avatar_url?: string;
  content: string;
  created_at: string;
}

export default function ThreadPanel({ parentMessage, send, onClose }: Props) {
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [content, setContent] = useState('');
  const state = useAppState();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.threadReplies(parentMessage.id).then((data) => {
      setReplies(data as ThreadReply[]);
    }).catch(console.error);
  }, [parentMessage.id]);

  // Listen for new thread replies via WS (from context updates)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    send({
      type: 'thread_reply',
      channel_id: parentMessage.channel_id,
      parent_id: parentMessage.id,
      content,
    });
    // Optimistic add
    setReplies((prev) => [...prev, {
      id: `temp-${Date.now()}`,
      channel_id: parentMessage.channel_id,
      parent_id: parentMessage.id,
      user_id: state.userId || '',
      username: state.username || '',
      content,
      created_at: new Date().toISOString(),
    }]);
    setContent('');
  };

  const parentDisplay = parentMessage.display_name || parentMessage.username;
  const time = new Date(parentMessage.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <h3>Thread</h3>
        <button className="thread-panel-close" onClick={onClose}>&times;</button>
      </div>

      <div className="thread-panel-body">
        {/* Parent message */}
        <div className="msg" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="msg-avatar" style={parentMessage.avatar_url ? undefined : { background: avatarColor(parentMessage.username) }}>
            {parentMessage.avatar_url
              ? <img src={parentMessage.avatar_url} alt={parentDisplay} />
              : avatarInitial(parentMessage.username)
            }
          </div>
          <div className="msg-body">
            <div className="msg-header">
              <span className="msg-user">{parentDisplay}</span>
              <span className="msg-time">{timeStr}</span>
            </div>
            <div className="msg-text" dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(parentMessage.content)) }} />
          </div>
        </div>

        {/* Reply count */}
        {replies.length > 0 && (
          <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </div>
        )}

        {/* Replies */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {replies.map((reply) => {
            const replyDisplay = reply.display_name || reply.username;
            const replyTime = new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={reply.id} className="msg" style={{ padding: '6px 16px' }}>
                <div className="msg-avatar" style={reply.avatar_url ? undefined : { background: avatarColor(reply.username) }}>
                  {reply.avatar_url
                    ? <img src={reply.avatar_url} alt={replyDisplay} />
                    : avatarInitial(reply.username)
                  }
                </div>
                <div className="msg-body">
                  <div className="msg-header">
                    <span className="msg-user">{replyDisplay}</span>
                    <span className="msg-time">{replyTime}</span>
                  </div>
                  <div className="msg-text" dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(reply.content)) }} />
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply input */}
      <form onSubmit={handleSubmit} style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Reply..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={4000}
          autoComplete="off"
          autoFocus
          style={{
            flex: 1, background: 'var(--bg-hover)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '8px 12px', outline: 'none', fontSize: 13,
            color: 'var(--text-primary)',
          }}
        />
        <button type="submit" className="send-btn" style={{ width: 36, height: 36 }}>
          <SendHorizontal size={16} />
        </button>
      </form>
    </div>
  );
}
