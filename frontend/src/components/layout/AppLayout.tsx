import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatHeader from './ChatHeader';
import MessageList from '../messages/MessageList';
import MessageInput from '../messages/MessageInput';
import ThreadPanel from '../messages/ThreadPanel';
import DropZone from '../messages/DropZone';
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
import { useLocalMedia } from '../../hooks/useLocalMedia';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { api } from '../../api/client';
import OnboardingModal from '../settings/OnboardingModal';
import SidebarViewPanel from './SidebarViewPanel';
import IncomingCallBanner from '../calls/IncomingCallBanner';
import type { MessageData, ActiveCall } from '../../api/types';

export default function AppLayout() {
  const { loadChannels, currentChannelId, myChannelIds, channels, dmChannels } = useChannels();
  const { loadUsers } = usePresence();
  const { loadActiveCalls, currentMeetingId, activeCalls } = useCalls();
  const { send, setRtcSignalHandler, setCallReactionHandler } = useWebSocket();
  const media = useLocalMedia();
  const state = useAppState();
  const dispatch = useAppDispatch();

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threadMessage, setThreadMessage] = useState<MessageData | null>(null);
  const [quotePrefix, setQuotePrefix] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    loadChannels();
    loadUsers();
    loadActiveCalls();
    requestNotificationPermission();
    const callPoll = setInterval(loadActiveCalls, 10000);
    const presencePoll = setInterval(loadUsers, 30000);
    return () => { clearInterval(callPoll); clearInterval(presencePoll); };
  }, [loadChannels, loadUsers, loadActiveCalls]);

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

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && currentChannelId) {
      try {
        await api.uploadFile(currentChannelId, file);
      } catch (err) {
        console.error('Drop upload failed:', err);
      }
    }
  }, [currentChannelId]);

  // Compute incoming calls
  const incomingCalls: ActiveCall[] = [];
  for (const [, call] of activeCalls) {
    if (call.meeting_id === currentMeetingId) continue;
    if (!myChannelIds.has(call.channel_id)) continue;
    if (call.started_by === state.username) continue;
    incomingCalls.push(call);
  }

  const isMember = currentChannelId ? myChannelIds.has(currentChannelId) : false;
  const isInCallOnCurrentChannel = currentMeetingId
    ? Array.from(activeCalls.values()).some((c) => c.meeting_id === currentMeetingId && c.channel_id === currentChannelId)
    : false;
  const showMiniWindow = currentMeetingId && !isInCallOnCurrentChannel;

  // Find the channel the user is in a call on (for mini window click-to-navigate)
  const callChannelId = currentMeetingId
    ? Array.from(activeCalls.values()).find((c) => c.meeting_id === currentMeetingId)?.channel_id
    : undefined;

  const allChannels = [...channels, ...dmChannels];
  const currentChannel = allChannels.find((c) => c.id === currentChannelId);

  return (
    <div className={`app ${isInCallOnCurrentChannel ? 'in-call' : ''}`}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onShowCreateChannel={() => setShowCreateChannel(true)}
        onShowInviteCode={() => setShowInviteCode(true)}
        onChannelSelect={() => setSidebarOpen(false)}
      />
      <main className="main" onClick={() => sidebarOpen && setSidebarOpen(false)}>
        {state.sidebarView ? (
          <SidebarViewPanel view={state.sidebarView} onOpenThread={handleOpenThread} />
        ) : (
          <>
            {!isInCallOnCurrentChannel && (
              <ChatHeader
                onShowInvite={() => setShowInvite(true)}
                onToggleDetail={() => setShowDetail(!showDetail)}
                showingDetail={showDetail}
              />
            )}

            {isInCallOnCurrentChannel && (
              <HuddleRoom
                send={send}
                setRtcSignalHandler={setRtcSignalHandler}
                setCallReactionHandler={setCallReactionHandler}
                media={media}
              />
            )}
            {!isInCallOnCurrentChannel && (
              <div className="chat-body">
                <div
                  className="chat-content"
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{ position: 'relative' }}
                >
                  {isDragging && <DropZone />}
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
            {isInCallOnCurrentChannel && isMember && (
              <MessageInput send={send} quotePrefix={quotePrefix} onClearQuote={() => setQuotePrefix('')} />
            )}
          </>
        )}
      </main>

      {showMiniWindow && <HuddleMiniWindow media={media} callChannelId={callChannelId} />}
      <IncomingCallBanner calls={incomingCalls} />

      {showCreateChannel && <CreateChannelModal onClose={() => setShowCreateChannel(false)} />}
      {showInvite && currentChannelId && <InviteModal channelId={currentChannelId} onClose={() => setShowInvite(false)} />}
      {showInviteCode && <InviteCodeModal onClose={() => setShowInviteCode(false)} />}
      {!!state.token && !state.onboarded && (
        <OnboardingModal
          username={state.username || ''}
          onComplete={() => dispatch({ type: 'SET_PROFILE', onboarded: true })}
        />
      )}
    </div>
  );
}
