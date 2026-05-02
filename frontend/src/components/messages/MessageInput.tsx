import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useMessages } from '../../hooks/useMessages';
import { useAppState } from '../../context/AppContext';

interface MessageInputProps {
  send: (msg: object) => void;
  quotePrefix?: string;
  onClearQuote?: () => void;
}

export default function MessageInput({ send, quotePrefix, onClearQuote }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
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

  useEffect(() => {
    if (quotePrefix) {
      setContent(quotePrefix);
      onClearQuote?.();
      inputRef.current?.focus();
    }
  }, [quotePrefix, onClearQuote]);

  // Build mention candidates from allUsers
  const mentionCandidates = useMemo(() => {
    const users = state.allUsers.map((u) => ({
      username: u.username,
      display: u.username,
    }));
    // Add @channel and @here
    users.push({ username: 'channel', display: '@channel — notify all members' });
    users.push({ username: 'here', display: '@here — notify online members' });
    return users;
  }, [state.allUsers]);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionCandidates
      .filter((u) => u.username.toLowerCase().includes(q) || u.display.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, mentionCandidates]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setContent(val);
    if (val) handleTyping();

    // Detect @mention
    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (username: string) => {
    const cursorPos = inputRef.current?.selectionStart || content.length;
    const textBeforeCursor = content.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf('@');
    if (atIdx >= 0) {
      const before = content.slice(0, atIdx);
      const after = content.slice(cursorPos);
      setContent(`${before}@${username} ${after}`);
    }
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex].username);
        return;
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    sendMessage(send, content);
    setContent('');
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  // Markdown toolbar insert helpers
  const insertMd = (prefix: string, suffix: string = prefix) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      input.focus();
      const newPos = selected ? start + prefix.length + selected.length + suffix.length : start + prefix.length;
      input.setSelectionRange(newPos, newPos);
    }, 0);
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
      <div className="message-form" style={{ position: 'relative' }}>
        <div className="message-input-container">
          {/* Mention autocomplete dropdown */}
          {mentionQuery !== null && filteredMentions.length > 0 && (
            <div className="mention-dropdown">
              {filteredMentions.map((user, i) => (
                <button
                  key={user.username}
                  className={`mention-option ${i === mentionIndex ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(user.username); }}
                >
                  <span className="mention-at">@</span>{user.display}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Message..."
              maxLength={4000}
              autoComplete="off"
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
            />
            <button type="submit" className="send-btn" style={{ margin: '4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </form>
          {/* Markdown toolbar */}
          <div className="md-toolbar">
            <button type="button" className="md-toolbar-btn" title="Bold" onClick={() => insertMd('**')}>B</button>
            <button type="button" className="md-toolbar-btn" title="Italic" onClick={() => insertMd('_')} style={{ fontStyle: 'italic' }}>I</button>
            <button type="button" className="md-toolbar-btn" title="Strikethrough" onClick={() => insertMd('~~')} style={{ textDecoration: 'line-through' }}>S</button>
            <div className="md-toolbar-separator" />
            <button type="button" className="md-toolbar-btn" title="Code" onClick={() => insertMd('`')} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>&lt;/&gt;</button>
            <button type="button" className="md-toolbar-btn" title="Code block" onClick={() => insertMd('```\n', '\n```')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </button>
            <div className="md-toolbar-separator" />
            <button type="button" className="md-toolbar-btn" title="Link" onClick={() => insertMd('[', '](url)')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </button>
            <button type="button" className="md-toolbar-btn" title="Bulleted list" onClick={() => insertMd('- ', '')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
