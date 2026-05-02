import { useState } from 'react';
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

export default function Sidebar({ isOpen, onToggle, onShowCreateChannel, onShowInviteCode, onChannelSelect }: SidebarProps) {
  const { username, logout } = useAuth();
  const { channels, dmChannels, myChannelIds, currentChannelId, selectChannel } = useChannels();
  const { onlineUsers } = usePresence();
  const state = useAppState();
  const [search, setSearch] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMfa, setShowMfa] = useState(false);

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
        <div style={{ display: 'flex', gap: 8 }}>
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

      {/* Footer — User profile */}
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={() => setShowUserMenu(!showUserMenu)}>
          <div className="sidebar-user-avatar" style={{ background: avatarColor(username || '') }}>
            {avatarInitial(username || '')}
            <span className="sidebar-user-status" />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{username}</span>
            <span className="sidebar-user-label">Online</span>
          </div>
          <div className="sidebar-user-actions">
            <button className="sidebar-action-btn" title="Settings" onClick={(e) => { e.stopPropagation(); setShowMfa(true); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </button>
            <button className="sidebar-action-btn" title="Sign out" onClick={(e) => { e.stopPropagation(); logout(); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </div>

      {showMfa && createPortal(
        <SettingsModal onClose={() => setShowMfa(false)} onShowInviteCode={onShowInviteCode} />,
        document.body
      )}
    </aside>
  );
}
