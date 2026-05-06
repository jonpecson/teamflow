import { useState, useRef, useCallback } from 'react';
import { MessageSquare, Phone } from 'lucide-react';
import type { MessageData } from '../../api/types';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { linkify, escapeMessage } from '../../utils/links';
import { useCalls } from '../../hooks/useCalls';
import { useAppState } from '../../context/AppContext';
import { api } from '../../api/client';
import MessageActions from './MessageActions';
import EmojiPicker from './EmojiPicker';
import Attachment from './Attachment';
import LinkPreview from './LinkPreview';
import UserPopover from '../users/UserPopover';

// Extract URLs from message content for link previews
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/g;
  return Array.from(text.matchAll(urlRegex), (m) => m[0]);
}

interface MessageItemProps {
  message: MessageData;
  isOwn: boolean;
  isCompact: boolean;
  onOpenThread?: (msg: MessageData) => void;
  onQuoteReply?: (msg: MessageData) => void;
  onEditLast?: () => void;
}

export default function MessageItem({ message, isOwn, isCompact, onOpenThread, onQuoteReply }: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState<{ x: number; y: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const time = new Date(message.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // System messages
  if (message.content.startsWith('__call_started__')) {
    const parts = message.content.split('__');
    return <CallSystemMessage caller={parts[2]} meetingId={parts[3]} type="started" time={timeStr} />;
  }
  if (message.content.startsWith('__call_ended__')) {
    return (
      <div className="msg-system">
        <span className="msg-system-icon">📞</span> Call ended · {timeStr}
      </div>
    );
  }

  const displayName = message.display_name || message.username;
  const avatarUrl = message.avatar_url;
  const reactions = message.reactions || [];
  const attachments = message.attachments || [];
  const replyCount = message.reply_count || 0;
  const urls = extractUrls(message.content);

  const handleEmojiSelect = async (emoji: string) => {
    try { await api.toggleReaction(message.id, emoji); } catch (e) { console.error(e); }
  };

  const handleShowEmoji = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEmojiPicker({ x: e.clientX, y: e.clientY });
  };

  const startEdit = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [message.content]);

  const cancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const saveEdit = async () => {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      cancelEdit();
      return;
    }
    setEditSaving(true);
    try {
      await api.editMessage(message.id, trimmed);
      setIsEditing(false);
    } catch (e) {
      console.error('Edit failed:', e);
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const editedMarker = message.edited_at ? <span className="msg-edited-marker">(edited)</span> : null;

  const renderContent = () => {
    if (isEditing) {
      return (
        <div className="msg-edit-form">
          <textarea
            ref={editRef}
            className="msg-edit-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleEditKeyDown}
            maxLength={4000}
            rows={2}
          />
          <div className="msg-edit-actions">
            <button className="msg-edit-save" onClick={saveEdit} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save'}
            </button>
            <button className="msg-edit-cancel" onClick={cancelEdit}>Cancel</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Esc to cancel &middot; Enter to save
            </span>
          </div>
        </div>
      );
    }
    if (message.content.startsWith('[image:') || message.content.startsWith('[file:')) return null;
    return (
      <>
        <div className="msg-text">
          <span dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(message.content)) }} />
          {editedMarker}
        </div>
        {urls.length > 0 && urls.slice(0, 3).map((url) => <LinkPreview key={url} url={url} />)}
      </>
    );
  };

  if (isCompact) {
    return (
      <div
        className="msg compact"
        data-msg-id={message.id}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="msg-body">
          {renderContent()}
          {reactions.length > 0 && <ReactionBar reactions={reactions} messageId={message.id} />}
        </div>
        {showActions && !isEditing && (
          <MessageActions
            messageId={message.id}
            isOwn={isOwn}
            onReply={() => onOpenThread?.(message)}
            onQuoteReply={() => onQuoteReply?.(message)}
            onShowEmojiPicker={handleShowEmoji}
            onEdit={isOwn ? startEdit : undefined}
          />
        )}
        {emojiPicker && <EmojiPicker position={emojiPicker} onSelect={handleEmojiSelect} onClose={() => setEmojiPicker(null)} />}
      </div>
    );
  }

  return (
    <div
      className="msg"
      data-msg-id={message.id}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <UserPopover
        userId={message.user_id}
        username={message.username}
        displayName={displayName}
        role={message.role}
        avatarUrl={avatarUrl}
      >
        <div className="msg-avatar" style={{ ...(avatarUrl ? {} : { background: avatarColor(message.username) }), cursor: 'pointer' }}>
          {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : avatarInitial(message.username)}
        </div>
      </UserPopover>
      <div className="msg-body">
        <div className="msg-header">
          <UserPopover
            userId={message.user_id}
            username={message.username}
            displayName={displayName}
            role={message.role}
            avatarUrl={avatarUrl}
          >
            <span className="msg-user" style={{ cursor: 'pointer' }}>{displayName}</span>
          </UserPopover>
          {message.role && <span className="msg-role">{message.role}</span>}
          <span className="msg-time">{timeStr}</span>
        </div>
        {renderContent()}
        {attachments.map((a) => <Attachment key={a.id} attachment={a} />)}
        {reactions.length > 0 && <ReactionBar reactions={reactions} messageId={message.id} />}
        {replyCount > 0 && (
          <button className="thread-reply-btn" onClick={() => onOpenThread?.(message)}>
            <MessageSquare size={14} />
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
      {showActions && !isEditing && (
        <MessageActions
          messageId={message.id}
          isOwn={isOwn}
          onReply={() => onOpenThread?.(message)}
          onQuoteReply={() => onQuoteReply?.(message)}
          onShowEmojiPicker={handleShowEmoji}
          onEdit={isOwn ? startEdit : undefined}
        />
      )}
      {emojiPicker && <EmojiPicker position={emojiPicker} onSelect={handleEmojiSelect} onClose={() => setEmojiPicker(null)} />}
    </div>
  );
}

function ReactionBar({ reactions, messageId }: { reactions: { emoji: string; count: number; users: string[] }[]; messageId: string }) {
  const handleToggle = async (emoji: string) => {
    try { await api.toggleReaction(messageId, emoji); } catch (e) { console.error(e); }
  };

  return (
    <div className="reaction-bar">
      {reactions.map((r) => (
        <button key={r.emoji} className="reaction-chip" onClick={() => handleToggle(r.emoji)} title={r.users.join(', ')}>
          <span>{r.emoji}</span>
          <span className="reaction-count">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

function CallSystemMessage({ caller, meetingId, type, time }: { caller: string; meetingId: string; type: string; time: string }) {
  const { joinCall, activeCalls, currentMeetingId } = useCalls();
  const call = activeCalls.get(meetingId);
  const isActive = !!call;
  const isInThisCall = currentMeetingId === meetingId;

  return (
    <div className="call-system-msg">
      <div className="call-system-icon">
        <Phone size={16} />
      </div>
      <div className="call-system-content">
        <span className="call-system-text">{caller} started a call</span>
        <span className="call-system-time">{time}</span>
        {isActive && call && (
          <span className="call-system-participants">{call.participants.length} participant{call.participants.length !== 1 ? 's' : ''}</span>
        )}
      </div>
      {isActive && !isInThisCall && <button className="call-system-join" onClick={() => joinCall(meetingId)}>Join</button>}
      {isActive && isInThisCall && <span className="call-system-badge">In call</span>}
      {!isActive && type === 'started' && <span className="call-system-badge ended">Ended</span>}
    </div>
  );
}
