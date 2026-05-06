import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAppState } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';
import type { ChannelMember } from '../../api/types';
import { Users, Plus } from 'lucide-react';

interface Props {
  channelId: string;
  channelName: string;
  isDm: boolean;
  onClose: () => void;
  onInvite: () => void;
}

export default function ChannelDetailPanel({ channelId, channelName, isDm, onClose, onInvite }: Props) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const state = useAppState();

  useEffect(() => {
    api.channelMembers(channelId).then((m) => {
      setMembers(m as ChannelMember[]);
    }).catch(() => {});
  }, [channelId]);

  return (
    <div className="channel-detail-panel">
      <div className="channel-detail-header">
        <h3>{isDm ? 'Conversation' : `#${channelName}`}</h3>
        <button className="channel-detail-close" onClick={onClose}>&times;</button>
      </div>

      {!isDm && (
        <div className="channel-detail-section">
          <div className="channel-detail-label">About</div>
          <div className="channel-detail-about">
            <div className="channel-detail-row">
              <Users size={14} />
              <span>Created {members.length > 0 ? new Date(members[0]?.joined_at).toLocaleDateString() : ''}</span>
            </div>
            <div className="channel-detail-row">
              <Users size={14} />
              <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      <div className="channel-detail-section">
        <div className="channel-detail-label">
          <span>Members ({members.length})</span>
          {!isDm && (
            <button className="channel-detail-add" onClick={onInvite}>
              <Plus size={14} />
              Add
            </button>
          )}
        </div>
        <ul className="channel-detail-members">
          {members.map((m) => {
            const isOnline = state.onlineUsers.has(m.user_id);
            const isYou = m.user_id === state.userId;
            return (
              <li key={m.user_id} className="channel-detail-member">
                <div className="channel-detail-member-avatar" style={{ background: avatarColor(m.username) }}>
                  {avatarInitial(m.username)}
                  {isOnline && <span className="channel-detail-member-status" />}
                </div>
                <div className="channel-detail-member-info">
                  <span className="channel-detail-member-name">
                    {m.username}
                    {isYou && <span className="channel-detail-you">(you)</span>}
                  </span>
                  <span className="channel-detail-member-role">{isOnline ? 'Online' : 'Offline'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
