import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { usePresence } from '../../hooks/usePresence';
import { avatarColor, avatarInitial } from '../../utils/colors';
import type { ChannelMember } from '../../api/types';

interface Props {
  channelId: string;
  onClose: () => void;
}

export default function InviteModal({ channelId, onClose }: Props) {
  const { allUsers } = usePresence();
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [channelName, setChannelName] = useState('');

  useEffect(() => {
    api.channelMembers(channelId).then((m) => {
      const memberList = m as ChannelMember[];
      setMembers(new Set(memberList.map((u) => u.user_id)));
    }).catch(() => {});

    api.listChannels().then((channels) => {
      const ch = (channels as { id: string; name: string }[]).find((c) => c.id === channelId);
      if (ch) setChannelName(ch.name);
    }).catch(() => {});
  }, [channelId]);

  const handleInvite = async (userId: string) => {
    try {
      await api.inviteToChannel(channelId, userId);
      setMembers((prev) => new Set([...prev, userId]));
    } catch (err) {
      console.error('Invite failed:', err);
    }
  };

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <h3>Invite to <span>#{channelName}</span></h3>
        <ul className="invite-user-list">
          {allUsers.map((user) => {
            const isMember = members.has(user.id);
            return (
              <li key={user.id}>
                <div className="invite-user-info">
                  <span className="invite-avatar" style={{ background: avatarColor(user.username) }}>
                    {avatarInitial(user.username)}
                  </span>
                  <span>{user.username}</span>
                </div>
                <button
                  className={`invite-action ${isMember ? 'joined' : 'invite'}`}
                  onClick={() => !isMember && handleInvite(user.id)}
                  disabled={isMember}
                >
                  {isMember ? 'Joined' : 'Invite'}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
