import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatHeader from './ChatHeader';
import MessageList from '../messages/MessageList';
import MessageInput from '../messages/MessageInput';
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

  useEffect(() => {
    loadChannels();
    loadUsers();
    loadActiveCalls();
    const pollInterval = setInterval(loadActiveCalls, 10000);
    return () => clearInterval(pollInterval);
  }, [loadChannels, loadUsers, loadActiveCalls]);

  // Close detail panel when switching channels
  useEffect(() => {
    setShowDetail(false);
  }, [currentChannelId]);

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
      {!isInCallOnCurrentChannel && (
        <Sidebar
          onShowCreateChannel={() => setShowCreateChannel(true)}
          onShowInviteCode={() => setShowInviteCode(true)}
        />
      )}
      <main className="main">
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
              <MessageList />
              {isMember && <MessageInput send={send} />}
            </div>
            {showDetail && currentChannelId && currentChannel && (
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
