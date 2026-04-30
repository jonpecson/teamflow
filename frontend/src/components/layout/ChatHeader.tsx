import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useChannels } from '../../hooks/useChannels';
import { useCalls } from '../../hooks/useCalls';
import { useAppState } from '../../context/AppContext';
import type { ChannelMember } from '../../api/types';

interface ChatHeaderProps {
  onShowInvite: () => void;
  onToggleDetail: () => void;
  showingDetail: boolean;
}

export default function ChatHeader({ onShowInvite, onToggleDetail, showingDetail }: ChatHeaderProps) {
  const { channels, dmChannels, currentChannelId, myChannelIds, joinChannel, leaveChannel } = useChannels();
  const { startCall, activeCalls, currentMeetingId } = useCalls();
  const state = useAppState();
  const [memberCount, setMemberCount] = useState(0);

  const allChannels = [...channels, ...dmChannels];
  const currentChannel = allChannels.find((c) => c.id === currentChannelId);
  const isMember = currentChannelId ? myChannelIds.has(currentChannelId) : false;
  const isDm = currentChannel?.is_dm ?? false;

  const channelCall = Array.from(activeCalls.values()).find((c) => c.channel_id === currentChannelId);
  const isInCall = !!currentMeetingId;

  useEffect(() => {
    if (!currentChannelId) return;
    api.channelMembers(currentChannelId).then((members) => {
      setMemberCount((members as ChannelMember[]).length);
    }).catch(() => {});
  }, [currentChannelId]);

  const channelDisplayName = currentChannel
    ? isDm
      ? currentChannel.name.replace('dm-', '').replace(state.username || '', '').replace('-', '').trim()
      : `#${currentChannel.name}`
    : '#general';

  const handleCall = async () => {
    if (!currentChannelId) return;
    try {
      await startCall(currentChannelId);
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  return (
    <div className="chat-header">
      <div className="chat-header-left" onClick={onToggleDetail} role="button" tabIndex={0}>
        <h2>
          {channelDisplayName}
          {channelCall && <span className="call-active-badge" />}
        </h2>
        <span className="member-count">
          {memberCount > 0 && (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {memberCount}
            </>
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3, transform: showingDetail ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div className="chat-header-actions">
        {isMember && !isDm && (
          <button
            className={`call-btn ${isInCall ? 'in-call' : ''}`}
            title={isInCall ? 'In call' : 'Start huddle'}
            onClick={handleCall}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15.05 5A5 5 0 0119 8.95M15.05 1A9 9 0 0123 8.94m-1 7.98v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
        )}

        {isMember && !isDm && (
          <button className="invite-btn" onClick={onShowInvite} title="Invite member">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
          </button>
        )}

        {!isDm && currentChannelId && (
          <button
            className={`join-leave-btn ${isMember ? 'leave' : 'join'}`}
            onClick={() => isMember ? leaveChannel(currentChannelId) : joinChannel(currentChannelId)}
          >
            {isMember ? 'Leave' : 'Join'}
          </button>
        )}
      </div>
    </div>
  );
}
