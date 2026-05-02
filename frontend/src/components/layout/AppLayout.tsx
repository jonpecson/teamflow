import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import ChatHeader from './ChatHeader';
import MessageList from '../messages/MessageList';
import MessageInput from '../messages/MessageInput';
import ThreadPanel from '../messages/ThreadPanel';
import { requestNotificationPermission } from '../../utils/notifications';
import HuddleRoom from '../huddle/HuddleRoom';
import HuddleMiniWindow from '../huddle/HuddleMiniWindow';
import ChannelDetailPanel from '../channels/ChannelDetailPanel';
import CreateChannelModal from '../modals/CreateChannelModal';
import InviteModal from '../modals/InviteModal';
import InviteCodeModal from '../modals/InviteCodeModal';
import { useChannels } from '../../hooks/useChannels';
import { usePresence } from '../../hooks/usePresence';
import { useCalls } from '../../hooks/useCalls';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAppState } from '../../context/AppContext';
import type { MessageData } from '../../api/types';

export default function AppLayout() {
  const { loadChannels, currentChannelId, myChannelIds, channels, dmChannels } = useChannels();
  const { loadUsers } = usePresence();
  const { loadActiveCalls, currentMeetingId, activeCalls } = useCalls();
  const { send, setRtcSignalHandler } = useWebSocket();
  const state = useAppState();

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threadMessage, setThreadMessage] = useState<MessageData | null>(null);
  const [quotePrefix, setQuotePrefix] = useState('');

  useEffect(() => {
    loadChannels();
    loadUsers();
    loadActiveCalls();
    requestNotificationPermission();
    const pollInterval = setInterval(loadActiveCalls, 10000);
    return () => clearInterval(pollInterval);
  }, [loadChannels, loadUsers, loadActiveCalls]);

  // Close panels when switching channels
  useEffect(() => {
    setShowDetail(false);
    setThreadMessage(null);
  }, [currentChannelId]);

  const handleOpenThread = useCallback((msg: MessageData) => {
    setThreadMessage(msg);
    setShowDetail(false);
  }, []);

  const handleQuoteReply = useCallback((msg: MessageData) => {
    const name = msg.display_name || msg.username;
    setQuotePrefix(`> **${name}:** ${msg.content.slice(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`);
  }, []);

  // Auto-leave call on tab close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentMeetingId) {
        const token = localStorage.getItem('token');
        if (token) {
          fetch(`/api/calls/${currentMeetingId}/leave`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentMeetingId]);

  const isMember = currentChannelId ? myChannelIds.has(currentChannelId) : false;
  const isInCallOnCurrentChannel = currentMeetingId
    ? Array.from(activeCalls.values()).some((c) => c.meeting_id === currentMeetingId && c.channel_id === currentChannelId)
    : false;
  const showMiniWindow = currentMeetingId && !isInCallOnCurrentChannel;

  const allChannels = [...channels, ...dmChannels];
  const currentChannel = allChannels.find((c) => c.id === currentChannelId);

  return (
    <div className={`app ${isInCallOnCurrentChannel ? 'in-call' : ''}`}>
      {/* Sidebar: always available on mobile (collapsible), hidden on desktop during calls */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onShowCreateChannel={() => setShowCreateChannel(true)}
        onShowInviteCode={() => setShowInviteCode(true)}
        onChannelSelect={() => setSidebarOpen(false)}
      />
      <main className="main" onClick={() => sidebarOpen && setSidebarOpen(false)}>
        {!isInCallOnCurrentChannel && (
          <ChatHeader
            onShowInvite={() => setShowInvite(true)}
            onToggleDetail={() => setShowDetail(!showDetail)}
            showingDetail={showDetail}
          />
        )}

        {isInCallOnCurrentChannel ? (
          <HuddleRoom send={send} setRtcSignalHandler={setRtcSignalHandler} />
        ) : (
          <div className="chat-body">
            <div className="chat-content">
              <MessageList onOpenThread={handleOpenThread} onQuoteReply={handleQuoteReply} />
              {isMember && <MessageInput send={send} quotePrefix={quotePrefix} onClearQuote={() => setQuotePrefix('')} />}
            </div>
            {threadMessage && (
              <ThreadPanel
                parentMessage={threadMessage}
                send={send}
                onClose={() => setThreadMessage(null)}
              />
            )}
            {showDetail && currentChannelId && currentChannel && !threadMessage && (
              <ChannelDetailPanel
                channelId={currentChannelId}
                channelName={currentChannel.name}
                isDm={currentChannel.is_dm}
                onClose={() => setShowDetail(false)}
                onInvite={() => setShowInvite(true)}
              />
            )}
          </div>
        )}
      </main>

      {showMiniWindow && <HuddleMiniWindow />}

      {showCreateChannel && <CreateChannelModal onClose={() => setShowCreateChannel(false)} />}
      {showInvite && currentChannelId && <InviteModal channelId={currentChannelId} onClose={() => setShowInvite(false)} />}
      {showInviteCode && <InviteCodeModal onClose={() => setShowInviteCode(false)} />}
    </div>
  );
}
