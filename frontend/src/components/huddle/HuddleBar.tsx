import { useCalls } from '../../hooks/useCalls';
import { useAppState } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';
import type { ActiveCall } from '../../api/types';

interface HuddleBarProps {
  call: ActiveCall;
}

export default function HuddleBar({ call }: HuddleBarProps) {
  const { joinCall, currentMeetingId } = useCalls();
  const state = useAppState();

  // Don't show if user is already in this call
  if (currentMeetingId === call.meeting_id) return null;
  if (call.participants.includes(state.username || '')) return null;

  const elapsed = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);

  return (
    <div className="huddle-bar">
      <div className="huddle-bar-left">
        <span className="huddle-pulse" />
        <div className="huddle-bar-avatars">
          {call.participants.slice(0, 5).map((p) => (
            <span
              key={p}
              className="huddle-bar-avatar"
              style={{ background: avatarColor(p) }}
              title={p}
            >
              {avatarInitial(p)}
            </span>
          ))}
          {call.participants.length > 5 && (
            <span className="huddle-bar-overflow">+{call.participants.length - 5}</span>
          )}
        </div>
        <span className="huddle-bar-text">
          {call.started_by} started a huddle {mins > 0 ? `${mins}m ago` : 'just now'}
        </span>
      </div>
      <button className="huddle-join-btn" onClick={() => joinCall(call.meeting_id)}>
        Join
      </button>
    </div>
  );
}
