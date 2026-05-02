import { useState } from 'react';
import type { MessageData } from '../../api/types';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { linkify, escapeMessage } from '../../utils/links';
import { useCalls } from '../../hooks/useCalls';
import { useAppState } from '../../context/AppContext';
import { api } from '../../api/client';
import MessageActions from './MessageActions';
import EmojiPicker from './EmojiPicker';
import Attachment from './Attachment';

interface MessageItemProps {
  message: MessageData;
  isOwn: boolean;
  isCompact: boolean;
  onOpenThread?: (msg: MessageData) => void;
  onQuoteReply?: (msg: MessageData) => void;
}

export default function MessageItem({ message, isOwn, isCompact, onOpenThread, onQuoteReply }: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [emojiPicker, setEmojiPicker] = useState<{ x: number; y: number } | null>(null);
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

  const handleEmojiSelect = async (emoji: string) => {
    try { await api.toggleReaction(message.id, emoji); } catch (e) { console.error(e); }
  };

  const handleShowEmoji = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEmojiPicker({ x: e.clientX, y: e.clientY });
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
          <div className="msg-text" dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(message.content)) }} />
          {reactions.length > 0 && <ReactionBar reactions={reactions} messageId={message.id} />}
        </div>
        {showActions && (
          <MessageActions
            messageId={message.id}
            isOwn={isOwn}
            onReply={() => onOpenThread?.(message)}
            onQuoteReply={() => onQuoteReply?.(message)}
            onShowEmojiPicker={handleShowEmoji}
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
      <div className="msg-avatar" style={avatarUrl ? undefined : { background: avatarColor(message.username) }}>
        {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : avatarInitial(message.username)}
      </div>
      <div className="msg-body">
        <div className="msg-header">
          <span className="msg-user">{displayName}</span>
          {message.role && <span className="msg-role">{message.role}</span>}
          <span className="msg-time">{timeStr}</span>
        </div>
        {/* Hide text for pure attachment messages */}
        {!message.content.startsWith('[image:') && !message.content.startsWith('[file:') && (
          <div className="msg-text" dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(message.content)) }} />
        )}
        {attachments.map((a) => <Attachment key={a.id} attachment={a} />)}
        {reactions.length > 0 && <ReactionBar reactions={reactions} messageId={message.id} />}
        {replyCount > 0 && (
          <button className="thread-reply-btn" onClick={() => onOpenThread?.(message)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
      {showActions && (
        <MessageActions
          messageId={message.id}
          isOwn={isOwn}
          onReply={() => onOpenThread?.(message)}
          onQuoteReply={() => onQuoteReply?.(message)}
          onShowEmojiPicker={handleShowEmoji}
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15.05 5A5 5 0 0119 8.95M15.05 1A9 9 0 0123 8.94m-1 7.98v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        </svg>
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
