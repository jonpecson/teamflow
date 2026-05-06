import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useChannels } from '../../hooks/useChannels';
import { usePresence } from '../../hooks/usePresence';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';
import ChannelList from '../channels/ChannelList';
import DmList from '../channels/DmList';
import OnlineList from '../users/OnlineList';
import SettingsModal from '../settings/SettingsModal';
import { SquarePen, Menu, X, Search, Sun, Settings, ChevronDown } from 'lucide-react';
import { useCollapsible } from '../../hooks/useCollapsible';
import StatusPicker from '../settings/StatusPicker';

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
  const dispatch = useAppDispatch();
  const [showSettings, setShowSettings] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const { toggle: toggleTheme } = useTheme();
  const [channelsOpen, toggleChannels] = useCollapsible('channels', true);
  const [dmsOpen, toggleDms] = useCollapsible('dms', true);
  const [teamOpen, toggleTeam] = useCollapsible('team', true);

  const setView = (view: 'threads' | 'dms' | 'mentions' | 'saved') => {
    dispatch({ type: 'SET_SIDEBAR_VIEW', view: state.sidebarView === view ? null : view });
    onChannelSelect(); // close mobile sidebar
  };

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
            <SquarePen size={16} />
          </button>
          <button className="sidebar-compose mobile-menu-btn" title="Menu" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {isOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-box">
        <Search size={14} />
        <input type="text" placeholder="Search channels..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Channel sections */}
      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="section-header">
            <button className="section-header-clickable" onClick={toggleChannels}>
              <ChevronDown size={12} className={`section-chevron ${!channelsOpen ? 'collapsed' : ''}`} />
              <h3>Channels</h3>
            </button>
            <button className="icon-btn" title="Create channel" onClick={onShowCreateChannel}>+</button>
          </div>
          {channelsOpen && (
            <ChannelList
              channels={filteredChannels}
              myChannelIds={myChannelIds}
              currentChannelId={currentChannelId}
              unreadCounts={state.unreadCounts}
              activeCalls={state.activeCalls}
              onSelect={handleSelectChannel}
            />
          )}
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <button className="section-header-clickable" onClick={toggleDms}>
              <ChevronDown size={12} className={`section-chevron ${!dmsOpen ? 'collapsed' : ''}`} />
              <h3>Direct Messages</h3>
            </button>
          </div>
          {dmsOpen && (
            <DmList
              channels={filteredDms}
              currentChannelId={currentChannelId}
              unreadCounts={state.unreadCounts}
              username={username || ''}
              onSelect={handleSelectChannel}
            />
          )}
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <button className="section-header-clickable" onClick={toggleTeam}>
              <ChevronDown size={12} className={`section-chevron ${!teamOpen ? 'collapsed' : ''}`} />
              <h3>Team</h3>
            </button>
            <span className="badge">{onlineUsers.size} online</span>
          </div>
          {teamOpen && (
            <OnlineList onlineUsers={onlineUsers} currentUserId={state.userId} />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={() => setShowSettings(true)}>
          <div className="sidebar-user-avatar" style={state.avatarUrl ? undefined : { background: avatarColor(username || '') }}>
            {state.avatarUrl
              ? <img src={state.avatarUrl} alt={state.displayName || username || ''} />
              : avatarInitial(username || '')
            }
            <span className="sidebar-user-status" />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{state.displayName || username}</span>
            <span className="sidebar-user-label" onClick={(e) => { e.stopPropagation(); setShowStatusPicker(true); }} style={{ cursor: 'pointer' }}>
              {state.allUsers.find((u) => u.id === state.userId)?.status_emoji || ''}{' '}
              {state.allUsers.find((u) => u.id === state.userId)?.status_text || 'Online'}
            </span>
          </div>
        </div>
        <button className="theme-toggle" title="Toggle theme" onClick={(e) => { e.stopPropagation(); toggleTheme(); }}>
          <Sun size={15} />
        </button>
        <button className="sidebar-action-btn" title="Settings" onClick={() => setShowSettings(true)}>
          <Settings size={15} />
        </button>
      </div>

      {showSettings && createPortal(
        <SettingsModal onClose={() => setShowSettings(false)} onShowInviteCode={onShowInviteCode} />,
        document.body
      )}
      {showStatusPicker && (
        <StatusPicker
          open={showStatusPicker}
          onClose={() => setShowStatusPicker(false)}
          currentEmoji={state.allUsers.find((u) => u.id === state.userId)?.status_emoji}
          currentText={state.allUsers.find((u) => u.id === state.userId)?.status_text}
        />
      )}
    </aside>
  );
}
