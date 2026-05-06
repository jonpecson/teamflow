import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { api } from '../../api/client';

interface Props {
  userId: string;
  username: string;
  displayName?: string;
  role?: string;
  avatarUrl?: string;
  children: React.ReactNode;
}

export default function UserPopover({ userId, username, displayName, role, avatarUrl, children }: Props) {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const isOnline = state.onlineUsers.has(userId);
  const user = state.allUsers.find((u) => u.id === userId);
  const statusEmoji = (user as any)?.status_emoji;
  const statusText = (user as any)?.status_text;

  const handleMessage = async () => {
    try {
      const dm = (await api.getOrCreateDm(userId)) as any;
      dispatch({ type: 'ADD_DM_CHANNEL', channel: dm });
      dispatch({ type: 'ADD_MY_CHANNEL', channelId: dm.id });
      dispatch({ type: 'SELECT_CHANNEL', channelId: dm.id });
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (userId === state.userId) {
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              className="msg-avatar"
              style={{
                width: 56,
                height: 56,
                fontSize: 20,
                ...(avatarUrl ? {} : { background: avatarColor(username) }),
              }}
            >
              {avatarUrl ? <img src={avatarUrl} alt={displayName || username} /> : avatarInitial(username)}
              <span
                className="sidebar-user-status"
                style={{
                  width: 14,
                  height: 14,
                  border: '3px solid var(--bg-elevated)',
                  background: isOnline ? 'var(--success)' : 'var(--text-muted)',
                }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{displayName || username}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>@{username}</div>
              {role && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{role}</div>}
            </div>
          </div>

          {(statusEmoji || statusText) && (
            <div style={{ padding: '8px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius)', marginBottom: 12, fontSize: 13 }}>
              {statusEmoji && <span style={{ marginRight: 6 }}>{statusEmoji}</span>}
              {statusText && <span style={{ color: 'var(--text-secondary)' }}>{statusText}</span>}
            </div>
          )}

          <button
            onClick={handleMessage}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <MessageSquare size={16} />
            Message
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
