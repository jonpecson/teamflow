import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { useChannels } from '../../hooks/useChannels';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { linkify, escapeMessage } from '../../utils/links';
import type { MessageData } from '../../api/types';

interface ThreadItem {
  id: string; channel_id: string; user_id: string; username: string;
  display_name?: string; avatar_url?: string; content: string;
  created_at: string; reply_count: number; last_reply_at?: string;
  channel_name: string;
}

interface MentionItem {
  id: string; channel_id: string; user_id: string; username: string;
  display_name?: string; avatar_url?: string; content: string;
  created_at: string; channel_name: string;
}

interface SavedItem {
  id: string; message_id: string; channel_id: string; user_id: string;
  username: string; display_name?: string; content: string;
  created_at: string; saved_at: string;
}

interface Props {
  view: 'threads' | 'dms' | 'mentions' | 'saved';
  onOpenThread?: (msg: MessageData) => void;
}

export default function SidebarViewPanel({ view, onOpenThread }: Props) {
  const dispatch = useAppDispatch();

  const title = {
    threads: 'Threads',
    dms: 'All DMs',
    mentions: 'Mentions & Reactions',
    saved: 'Saved Items',
  }[view];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="chat-header" style={{ justifyContent: 'space-between' }}>
        <h2>{title}</h2>
        <button
          onClick={() => dispatch({ type: 'SET_SIDEBAR_VIEW', view: null })}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}
        >
          &times;
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {view === 'threads' && <ThreadsView onOpenThread={onOpenThread} />}
        {view === 'dms' && <DmsView />}
        {view === 'mentions' && <MentionsView />}
        {view === 'saved' && <SavedView />}
      </div>
    </div>
  );
}

function ThreadsView({ onOpenThread }: { onOpenThread?: (msg: MessageData) => void }) {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listThreads().then((data) => { setThreads(data as ThreadItem[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <EmptyView text="Loading..." />;
  if (threads.length === 0) return <EmptyView text="No threads yet. Reply to a message to start one." />;

  return (
    <div>
      {threads.map((t) => (
        <button
          key={t.id}
          className="sidebar-view-item"
          onClick={() => onOpenThread?.({
            id: t.id, channel_id: t.channel_id, user_id: t.user_id,
            username: t.username, display_name: t.display_name,
            avatar_url: t.avatar_url, content: t.content,
            timestamp: t.created_at, reply_count: t.reply_count,
          })}
        >
          <div className="sidebar-view-item-avatar" style={t.avatar_url ? undefined : { background: avatarColor(t.username) }}>
            {t.avatar_url ? <img src={t.avatar_url} alt="" /> : avatarInitial(t.username)}
          </div>
          <div className="sidebar-view-item-body">
            <div className="sidebar-view-item-header">
              <span className="sidebar-view-item-name">{t.display_name || t.username}</span>
              <span className="sidebar-view-item-channel">#{t.channel_name}</span>
            </div>
            <div className="sidebar-view-item-text">{t.content.slice(0, 80)}{t.content.length > 80 ? '...' : ''}</div>
            <div className="sidebar-view-item-meta">
              {t.reply_count} {t.reply_count === 1 ? 'reply' : 'replies'}
              {t.last_reply_at && ` · ${formatTimeAgo(t.last_reply_at)}`}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function DmsView() {
  const state = useAppState();
  const { selectChannel, dmChannels } = useChannels();
  const dispatch = useAppDispatch();

  if (dmChannels.length === 0) return <EmptyView text="No direct messages yet." />;

  const handleSelect = (id: string) => {
    selectChannel(id);
    dispatch({ type: 'SET_SIDEBAR_VIEW', view: null });
  };

  return (
    <div>
      {dmChannels.map((dm) => {
        const otherName = dm.name.replace('dm-', '').split('-').filter((n) => n !== state.username).join(', ') || dm.name;
        return (
          <button key={dm.id} className="sidebar-view-item" onClick={() => handleSelect(dm.id)}>
            <div className="sidebar-view-item-avatar" style={{ background: avatarColor(otherName) }}>
              {avatarInitial(otherName)}
            </div>
            <div className="sidebar-view-item-body">
              <div className="sidebar-view-item-name">{otherName}</div>
              <div className="sidebar-view-item-meta">Direct message</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MentionsView() {
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectChannel } = useChannels();
  const dispatch = useAppDispatch();

  useEffect(() => {
    api.listMentions().then((data) => { setMentions(data as MentionItem[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <EmptyView text="Loading..." />;
  if (mentions.length === 0) return <EmptyView text="No mentions yet. You'll see messages that @mention you here." />;

  return (
    <div>
      {mentions.map((m) => (
        <button
          key={m.id}
          className="sidebar-view-item"
          onClick={() => { selectChannel(m.channel_id); dispatch({ type: 'SET_SIDEBAR_VIEW', view: null }); }}
        >
          <div className="sidebar-view-item-avatar" style={m.avatar_url ? undefined : { background: avatarColor(m.username) }}>
            {m.avatar_url ? <img src={m.avatar_url} alt="" /> : avatarInitial(m.username)}
          </div>
          <div className="sidebar-view-item-body">
            <div className="sidebar-view-item-header">
              <span className="sidebar-view-item-name">{m.display_name || m.username}</span>
              <span className="sidebar-view-item-channel">#{m.channel_name}</span>
            </div>
            <div className="sidebar-view-item-text" dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(m.content.slice(0, 120))) }} />
            <div className="sidebar-view-item-meta">{formatTimeAgo(m.created_at)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function SavedView() {
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectChannel } = useChannels();
  const dispatch = useAppDispatch();

  useEffect(() => {
    api.listBookmarks().then((data) => { setSaved(data as SavedItem[]); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <EmptyView text="Loading..." />;
  if (saved.length === 0) return <EmptyView text="No saved messages. Bookmark a message to save it here." />;

  return (
    <div>
      {saved.map((s) => (
        <button
          key={s.id}
          className="sidebar-view-item"
          onClick={() => { selectChannel(s.channel_id); dispatch({ type: 'SET_SIDEBAR_VIEW', view: null }); }}
        >
          <div className="sidebar-view-item-avatar" style={{ background: avatarColor(s.username) }}>
            {avatarInitial(s.username)}
          </div>
          <div className="sidebar-view-item-body">
            <div className="sidebar-view-item-name">{s.display_name || s.username}</div>
            <div className="sidebar-view-item-text">{s.content.slice(0, 100)}{s.content.length > 100 ? '...' : ''}</div>
            <div className="sidebar-view-item-meta">Saved {formatTimeAgo(s.saved_at)}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyView({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, color: 'var(--text-muted)', fontSize: 14, padding: 20, textAlign: 'center' }}>
      {text}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
