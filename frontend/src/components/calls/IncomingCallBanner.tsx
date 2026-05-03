import { useEffect, useRef } from 'react';
import { useCalls } from '../../hooks/useCalls';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { SoundEngine } from '../../utils/sounds';
import type { ActiveCall } from '../../api/types';

interface Props {
  calls: ActiveCall[];
}

export default function IncomingCallBanner({ calls }: Props) {
  const { joinCall, dismissCall } = useCalls();
  const ringingRef = useRef(false);

  // Play ringtone when there are incoming calls
  useEffect(() => {
    if (calls.length > 0 && !ringingRef.current) {
      ringingRef.current = true;
      SoundEngine.playRingtone();
    } else if (calls.length === 0 && ringingRef.current) {
      ringingRef.current = false;
      SoundEngine.stopRingtone();
    }
    return () => {
      if (ringingRef.current) {
        SoundEngine.stopRingtone();
        ringingRef.current = false;
      }
    };
  }, [calls.length]);

  if (calls.length === 0) return null;

  return (
    <div className="incoming-call-banner">
      {calls.map((call) => {
        const isDm = call.channel_name.startsWith('dm-');
        const displayChannel = isDm
          ? call.started_by
          : `#${call.channel_name}`;
        const callLabel = isDm
          ? 'is calling you'
          : 'started a huddle';

        return (
          <div key={call.meeting_id} className="incoming-call-card">
            <div className="incoming-call-avatar" style={{ background: avatarColor(call.started_by) }}>
              {avatarInitial(call.started_by)}
            </div>
            <div className="incoming-call-info">
              <div className="caller-name">
                {call.started_by} <span>{callLabel}</span>
              </div>
              <div className="channel-label">
                {isDm ? 'Direct message' : displayChannel}
                {call.participants.length > 1 && ` · ${call.participants.length} participants`}
              </div>
            </div>
            <div className="incoming-call-actions">
              <button className="incoming-accept-btn" onClick={() => { SoundEngine.stopRingtone(); joinCall(call.meeting_id); }}>
                {isDm ? 'Answer' : 'Join'}
              </button>
              <button className="incoming-decline-btn" onClick={() => { SoundEngine.stopRingtone(); dismissCall(call.meeting_id); }}>
                {isDm ? 'Decline' : 'Dismiss'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
