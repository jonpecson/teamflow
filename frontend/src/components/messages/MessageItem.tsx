import type { MessageData } from '../../api/types';
import { avatarColor, avatarInitial } from '../../utils/colors';
import { linkify, escapeMessage } from '../../utils/links';
import { useCalls } from '../../hooks/useCalls';
import { useAppState } from '../../context/AppContext';

interface MessageItemProps {
  message: MessageData;
  isOwn: boolean;
  isCompact: boolean;
}

export default function MessageItem({ message, isOwn, isCompact }: MessageItemProps) {
  const time = new Date(message.timestamp);
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // System message: call started
  if (message.content.startsWith('__call_started__')) {
    const parts = message.content.split('__');
    const caller = parts[2];
    const meetingId = parts[3];
    return <CallSystemMessage caller={caller} meetingId={meetingId} type="started" time={timeStr} />;
  }

  // System message: call ended
  if (message.content.startsWith('__call_ended__')) {
    return (
      <div className="msg-system">
        <span className="msg-system-icon">📞</span> Call ended · {timeStr}
      </div>
    );
  }

  if (isCompact) {
    return (
      <div className={`msg compact ${isOwn ? 'own' : ''}`}>
        <div className="msg-body">
          <div
            className="msg-text"
            dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(message.content)) }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`msg ${isOwn ? 'own' : ''}`}>
      <div
        className="msg-avatar"
        style={{ background: avatarColor(message.username) }}
      >
        {avatarInitial(message.username)}
      </div>
      <div className="msg-body">
        <div className="msg-header">
          <span className="msg-user">{message.username}</span>
          <span className="msg-time">{timeStr}</span>
        </div>
        <div
          className="msg-text"
          dangerouslySetInnerHTML={{ __html: linkify(escapeMessage(message.content)) }}
        />
      </div>
    </div>
  );
}

function CallSystemMessage({ caller, meetingId, type, time }: { caller: string; meetingId: string; type: string; time: string }) {
  const { joinCall, activeCalls, currentMeetingId } = useCalls();
  const state = useAppState();

  const call = activeCalls.get(meetingId);
  const isActive = !!call;
  const isInThisCall = currentMeetingId === meetingId;
  const isMe = caller === state.username;

  return (
    <div className="call-system-msg">
      <div className="call-system-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15.05 5A5 5 0 0119 8.95M15.05 1A9 9 0 0123 8.94m-1 7.98v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
        </svg>
      </div>
      <div className="call-system-content">
        <span className="call-system-text">
          {caller} started a call
        </span>
        <span className="call-system-time">{time}</span>
        {isActive && call && (
          <span className="call-system-participants">
            {call.participants.length} participant{call.participants.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {isActive && !isInThisCall && (
        <button className="call-system-join" onClick={() => joinCall(meetingId)}>
          Join
        </button>
      )}
      {isActive && isInThisCall && (
        <span className="call-system-badge">In call</span>
      )}
      {!isActive && type === 'started' && (
        <span className="call-system-badge ended">Ended</span>
      )}
    </div>
  );
}
