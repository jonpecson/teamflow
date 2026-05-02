import { useEffect, useRef, useCallback } from 'react';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { SoundEngine } from '../utils/sounds';
import { notifyMessage, notifyCallStarted, notifyCallJoined } from '../utils/notifications';
import type { WsServerMsg } from '../api/types';

type RtcSignalHandler = (fromUser: string, signalType: string, data: unknown) => void;

export function useWebSocket() {
  const { token, currentChannelId } = useAppState();
  const dispatch = useAppDispatch();
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentChannelRef = useRef(currentChannelId);
  const rtcHandlerRef = useRef<RtcSignalHandler | null>(null);

  currentChannelRef.current = currentChannelId;

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const setRtcSignalHandler = useCallback((handler: RtcSignalHandler | null) => {
    rtcHandlerRef.current = handler;
  }, []);

  useEffect(() => {
    if (!token) return;

    const isTauri = window.location.protocol === 'tauri:' || (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost');
    const wsUrl = isTauri
      ? `wss://teamflow.statlingo.ai/ws?token=${token}`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 12000);
    };

    ws.onmessage = (event) => {
      const msg: WsServerMsg = JSON.parse(event.data);

      switch (msg.type) {
        case 'message':
          dispatch({
            type: 'ADD_MESSAGE',
            message: {
              id: msg.id,
              channel_id: msg.channel_id,
              user_id: msg.user_id,
              username: msg.username,
              content: msg.content,
              timestamp: msg.timestamp,
            },
          });
          if (msg.channel_id !== currentChannelRef.current) {
            dispatch({ type: 'INCREMENT_UNREAD', channelId: msg.channel_id });
            notifyMessage(msg.username, msg.content, msg.channel_id);
          }
          SoundEngine.playMessage();
          break;

        case 'presence':
          if (msg.status === 'online') {
            dispatch({ type: 'USER_ONLINE', userId: msg.user_id, username: msg.username });
          } else {
            dispatch({ type: 'USER_OFFLINE', userId: msg.user_id });
          }
          break;

        case 'channel_joined':
          dispatch({ type: 'ADD_MY_CHANNEL', channelId: msg.channel_id });
          break;

        case 'channel_left':
          dispatch({ type: 'REMOVE_MY_CHANNEL', channelId: msg.channel_id });
          break;

        case 'invited':
          dispatch({
            type: 'ADD_CHANNEL',
            channel: { id: msg.channel_id, name: msg.channel_name, created_by: '', is_dm: false, created_at: '' },
          });
          dispatch({ type: 'ADD_MY_CHANNEL', channelId: msg.channel_id });
          break;

        case 'call_started': {
          // Deduplicate: CALL_STARTED is idempotent (won't add if already exists)
          dispatch({
            type: 'CALL_STARTED',
            call: {
              meeting_id: msg.meeting_id,
              channel_id: msg.channel_id,
              channel_name: msg.channel_name,
              started_by: msg.started_by,
              participants: [msg.started_by],
              started_at: new Date().toISOString(),
            },
          });
          // Add system message (id-based, won't duplicate if already added by startCall)
          dispatch({
            type: 'ADD_MESSAGE',
            message: {
              id: `call-started-${msg.meeting_id}`,
              channel_id: msg.channel_id,
              user_id: 'system',
              username: 'system',
              content: `__call_started__${msg.started_by}__${msg.meeting_id}`,
              timestamp: new Date().toISOString(),
            },
          });
          SoundEngine.playTone(880, 0.15, 0.1);
          notifyCallStarted(msg.started_by, msg.channel_name);
          break;
        }

        case 'call_ended':
          dispatch({ type: 'CALL_ENDED', meetingId: msg.meeting_id });
          // Add a system message for call ended
          dispatch({
            type: 'ADD_MESSAGE',
            message: {
              id: `call-ended-${msg.meeting_id}`,
              channel_id: msg.channel_id,
              user_id: 'system',
              username: 'system',
              content: `__call_ended__${msg.meeting_id}`,
              timestamp: new Date().toISOString(),
            },
          });
          break;

        case 'call_participant_joined':
          dispatch({ type: 'CALL_PARTICIPANT_JOINED', meetingId: msg.meeting_id, username: msg.username });
          SoundEngine.playJoin();
          notifyCallJoined(msg.username, msg.channel_id || '');
          break;

        case 'call_participant_left':
          dispatch({ type: 'CALL_PARTICIPANT_LEFT', meetingId: msg.meeting_id, username: msg.username });
          SoundEngine.playLeave();
          break;

        case 'typing':
          dispatch({ type: 'SET_TYPING', channelId: msg.channel_id, username: msg.username });
          // Auto-clear after 3 seconds
          setTimeout(() => {
            dispatch({ type: 'CLEAR_TYPING', channelId: msg.channel_id, username: msg.username });
          }, 3000);
          break;

        case 'rtc_signal':
          rtcHandlerRef.current?.(msg.from_user, msg.signal_type, msg.data);
          break;

        case 'pong':
          break;

        case 'error':
          console.error('WS error:', msg.message);
          break;
      }
    };

    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
      setTimeout(() => {
        if (localStorage.getItem('token')) {
          dispatch({ type: 'LOGIN', token: localStorage.getItem('token')!, userId: localStorage.getItem('userId')!, username: localStorage.getItem('username')! });
        }
      }, 3000);
    };

    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      ws.close();
    };
  }, [token, dispatch]);

  return { send, ws: wsRef, setRtcSignalHandler };
}
