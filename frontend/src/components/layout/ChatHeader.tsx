import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useChannels } from '../../hooks/useChannels';
import { useCalls } from '../../hooks/useCalls';
import { useAppState } from '../../context/AppContext';
import type { ChannelMember } from '../../api/types';
import { Users, UserPlus, Phone, ChevronDown } from 'lucide-react';

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
              <Users size={12} style={{ opacity: 0.5 }} />
              {memberCount}
            </>
          )}
        </span>
        <ChevronDown size={12} style={{ opacity: 0.3, transform: showingDetail ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
      </div>
      <div className="chat-header-actions">
        {isMember && !isDm && (
          <button
            className={`call-btn ${isInCall ? 'in-call' : ''}`}
            title={isInCall ? 'In call' : 'Start huddle'}
            onClick={handleCall}
          >
            <Phone size={16} />
          </button>
        )}

        {isMember && !isDm && (
          <button className="invite-btn" onClick={onShowInvite} title="Invite member">
            <UserPlus size={14} />
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
