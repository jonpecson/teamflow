import { useCalls } from '../../hooks/useCalls';
import { avatarColor, avatarInitial } from '../../utils/colors';
import type { ActiveCall } from '../../api/types';

interface Props {
  calls: ActiveCall[];
}

export default function IncomingCallBanner({ calls }: Props) {
  const { joinCall, dismissCall } = useCalls();

  if (calls.length === 0) return null;

  return (
    <div className="incoming-call-banner">
      {calls.map((call) => (
        <div key={call.meeting_id} className="incoming-call-card">
          <div className="incoming-call-avatar" style={{ background: avatarColor(call.started_by) }}>
            {avatarInitial(call.started_by)}
          </div>
          <div className="incoming-call-info">
            <div className="caller-name">
              {call.started_by} <span>is calling</span>
            </div>
            <div className="channel-label">#{call.channel_name}</div>
          </div>
          <div className="incoming-call-actions">
            <button className="incoming-accept-btn" onClick={() => joinCall(call.meeting_id)}>Join</button>
            <button className="incoming-decline-btn" onClick={() => dismissCall(call.meeting_id)}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );
}
