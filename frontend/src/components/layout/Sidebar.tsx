import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useChannels } from '../../hooks/useChannels';
import { usePresence } from '../../hooks/usePresence';
import { useAppState } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';
import ChannelList from '../channels/ChannelList';
import DmList from '../channels/DmList';
import OnlineList from '../users/OnlineList';
import SettingsModal from '../settings/SettingsModal';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onShowCreateChannel: () => void;
  onShowInviteCode: () => void;
  onChannelSelect: () => void;
}

function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('tf-theme') || 'system';
  });

  useEffect(() => {
    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('tf-theme', theme);
  }, [theme]);

  const toggle = () => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggle };
}

export default function Sidebar({ isOpen, onToggle, onShowCreateChannel, onShowInviteCode, onChannelSelect }: SidebarProps) {
  const { username, logout } = useAuth();
  const { channels, dmChannels, myChannelIds, currentChannelId, selectChannel } = useChannels();
  const { onlineUsers } = usePresence();
  const state = useAppState();
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const { toggle: toggleTheme } = useTheme();

  const filteredChannels = search
    ? channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : channels;

  const filteredDms = search
    ? dmChannels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : dmChannels;

  const handleSelectChannel = (id: string) => {
    selectChannel(id);
    onChannelSelect();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header" onClick={onToggle}>
        <div className="sidebar-brand">
          <img src="/images/logo.svg" alt="TF" />
          <span>TeamFlow</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="sidebar-compose" title="New message" onClick={(e) => { e.stopPropagation(); onShowCreateChannel(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button className="sidebar-compose mobile-menu-btn" title="Menu" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isOpen ? <path d="M18 6L6 18M6 6l12 12"/> : <path d="M3 12h18M3 6h18M3 18h18"/>}
            </svg>
          </button>
        </div>
      </div>

      {/* Nav Items (placeholder) */}
      <nav className="sidebar-nav">
        <button className="sidebar-nav-item" title="Coming soon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          Threads
        </button>
        <button className="sidebar-nav-item" title="Coming soon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          All DMs
        </button>
        <button className="sidebar-nav-item" title="Coming soon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          Mentions &amp; Reactions
        </button>
        <button className="sidebar-nav-item" title="Coming soon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          Saved Items
        </button>
        <button className="sidebar-nav-item" title="Coming soon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          More
        </button>
      </nav>

      {/* Search */}
      <div className="search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search channels..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Channel sections */}
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="section-header">
            <h3>Channels</h3>
            <button className="icon-btn" title="Create channel" onClick={onShowCreateChannel}>+</button>
          </div>
          <ChannelList
            channels={filteredChannels}
            myChannelIds={myChannelIds}
            currentChannelId={currentChannelId}
            unreadCounts={state.unreadCounts}
            activeCalls={state.activeCalls}
            onSelect={handleSelectChannel}
          />
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <h3>Direct Messages</h3>
          </div>
          <DmList
            channels={filteredDms}
            currentChannelId={currentChannelId}
            unreadCounts={state.unreadCounts}
            username={username || ''}
            onSelect={handleSelectChannel}
          />
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <h3>Team</h3>
            <span className="badge">{onlineUsers.size} online</span>
          </div>
          <OnlineList onlineUsers={onlineUsers} currentUserId={state.userId} />
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={() => setShowSettings(true)}>
          <div className="sidebar-user-avatar" style={{ background: avatarColor(username || '') }}>
            {avatarInitial(username || '')}
            <span className="sidebar-user-status" />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{username}</span>
            <span className="sidebar-user-label">Online</span>
          </div>
        </div>
        <button className="theme-toggle" title="Toggle theme" onClick={(e) => { e.stopPropagation(); toggleTheme(); }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        </button>
        <button className="sidebar-action-btn" title="Settings" onClick={() => setShowSettings(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </button>
      </div>

      {showSettings && createPortal(
        <SettingsModal onClose={() => setShowSettings(false)} onShowInviteCode={onShowInviteCode} />,
        document.body
      )}
    </aside>
  );
}
