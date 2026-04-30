import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from 'react';
import type { Channel, ActiveCall, MessageData, OnlineUser } from '../api/types';

export interface AppState {
  // Auth
  token: string | null;
  userId: string | null;
  username: string | null;

  // Channels
  channels: Channel[];
  dmChannels: Channel[];
  myChannelIds: Set<string>;
  currentChannelId: string | null;

  // Messages
  messages: Map<string, MessageData[]>;

  // Users
  allUsers: { id: string; username: string }[];
  onlineUsers: Map<string, string>; // userId -> username

  // Calls
  activeCalls: Map<string, ActiveCall>; // meetingId -> ActiveCall
  currentMeetingId: string | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  callStartTime: number | null;

  // Unread
  unreadCounts: Map<string, number>;
}

export type AppAction =
  | { type: 'LOGIN'; token: string; userId: string; username: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_CHANNELS'; channels: Channel[]; dmChannels: Channel[] }
  | { type: 'SET_MY_CHANNEL_IDS'; ids: string[] }
  | { type: 'ADD_CHANNEL'; channel: Channel }
  | { type: 'ADD_MY_CHANNEL'; channelId: string }
  | { type: 'REMOVE_MY_CHANNEL'; channelId: string }
  | { type: 'SELECT_CHANNEL'; channelId: string }
  | { type: 'SET_MESSAGES'; channelId: string; messages: MessageData[] }
  | { type: 'ADD_MESSAGE'; message: MessageData }
  | { type: 'SET_USERS'; users: { id: string; username: string }[] }
  | { type: 'SET_ONLINE_USERS'; users: OnlineUser[] }
  | { type: 'USER_ONLINE'; userId: string; username: string }
  | { type: 'USER_OFFLINE'; userId: string }
  | { type: 'SET_ACTIVE_CALLS'; calls: ActiveCall[] }
  | { type: 'CALL_STARTED'; call: ActiveCall }
  | { type: 'CALL_ENDED'; meetingId: string }
  | { type: 'CALL_PARTICIPANT_JOINED'; meetingId: string; username: string }
  | { type: 'CALL_PARTICIPANT_LEFT'; meetingId: string; username: string }
  | { type: 'SET_CURRENT_MEETING'; meetingId: string | null; startTime?: number | null }
  | { type: 'TOGGLE_MIC' }
  | { type: 'TOGGLE_CAMERA' }
  | { type: 'INCREMENT_UNREAD'; channelId: string }
  | { type: 'CLEAR_UNREAD'; channelId: string }
  | { type: 'ADD_DM_CHANNEL'; channel: Channel };

const initialState: AppState = {
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId'),
  username: localStorage.getItem('username'),
  channels: [],
  dmChannels: [],
  myChannelIds: new Set(),
  currentChannelId: null,
  messages: new Map(),
  allUsers: [],
  onlineUsers: new Map(),
  activeCalls: new Map(),
  currentMeetingId: null,
  micEnabled: true,
  cameraEnabled: false,
  callStartTime: null,
  unreadCounts: new Map(),
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN': {
      localStorage.setItem('token', action.token);
      localStorage.setItem('userId', action.userId);
      localStorage.setItem('username', action.username);
      return { ...state, token: action.token, userId: action.userId, username: action.username };
    }
    case 'LOGOUT': {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      return { ...initialState, token: null, userId: null, username: null };
    }
    case 'SET_CHANNELS':
      return { ...state, channels: action.channels, dmChannels: action.dmChannels };
    case 'SET_MY_CHANNEL_IDS':
      return { ...state, myChannelIds: new Set(action.ids) };
    case 'ADD_CHANNEL': {
      if (action.channel.is_dm) {
        if (state.dmChannels.some((c) => c.id === action.channel.id)) return state;
        return { ...state, dmChannels: [...state.dmChannels, action.channel] };
      }
      if (state.channels.some((c) => c.id === action.channel.id)) return state;
      return { ...state, channels: [...state.channels, action.channel] };
    }
    case 'ADD_MY_CHANNEL': {
      const ids = new Set(state.myChannelIds);
      ids.add(action.channelId);
      return { ...state, myChannelIds: ids };
    }
    case 'REMOVE_MY_CHANNEL': {
      const ids = new Set(state.myChannelIds);
      ids.delete(action.channelId);
      return { ...state, myChannelIds: ids };
    }
    case 'SELECT_CHANNEL':
      return { ...state, currentChannelId: action.channelId };
    case 'SET_MESSAGES': {
      const msgs = new Map(state.messages);
      msgs.set(action.channelId, action.messages);
      return { ...state, messages: msgs };
    }
    case 'ADD_MESSAGE': {
      const msgs = new Map(state.messages);
      const existing = msgs.get(action.message.channel_id) || [];
      msgs.set(action.message.channel_id, [...existing, action.message]);
      return { ...state, messages: msgs };
    }
    case 'SET_USERS':
      return { ...state, allUsers: action.users };
    case 'SET_ONLINE_USERS': {
      const online = new Map<string, string>();
      action.users.forEach((u) => online.set(u.user_id, u.username));
      return { ...state, onlineUsers: online };
    }
    case 'USER_ONLINE': {
      const online = new Map(state.onlineUsers);
      online.set(action.userId, action.username);
      return { ...state, onlineUsers: online };
    }
    case 'USER_OFFLINE': {
      const online = new Map(state.onlineUsers);
      online.delete(action.userId);
      return { ...state, onlineUsers: online };
    }
    case 'SET_ACTIVE_CALLS': {
      const calls = new Map<string, ActiveCall>();
      action.calls.forEach((c) => calls.set(c.meeting_id, c));
      return { ...state, activeCalls: calls };
    }
    case 'CALL_STARTED': {
      const calls = new Map(state.activeCalls);
      calls.set(action.call.meeting_id, action.call);
      return { ...state, activeCalls: calls };
    }
    case 'CALL_ENDED': {
      const calls = new Map(state.activeCalls);
      calls.delete(action.meetingId);
      const currentMeetingId = state.currentMeetingId === action.meetingId ? null : state.currentMeetingId;
      const callStartTime = currentMeetingId === null ? null : state.callStartTime;
      return { ...state, activeCalls: calls, currentMeetingId, callStartTime };
    }
    case 'CALL_PARTICIPANT_JOINED': {
      const calls = new Map(state.activeCalls);
      const call = calls.get(action.meetingId);
      if (call && !call.participants.includes(action.username)) {
        calls.set(action.meetingId, { ...call, participants: [...call.participants, action.username] });
      }
      return { ...state, activeCalls: calls };
    }
    case 'CALL_PARTICIPANT_LEFT': {
      const calls = new Map(state.activeCalls);
      const call = calls.get(action.meetingId);
      if (call) {
        calls.set(action.meetingId, { ...call, participants: call.participants.filter((p) => p !== action.username) });
      }
      return { ...state, activeCalls: calls };
    }
    case 'SET_CURRENT_MEETING':
      return { ...state, currentMeetingId: action.meetingId, callStartTime: action.startTime ?? state.callStartTime };
    case 'TOGGLE_MIC':
      return { ...state, micEnabled: !state.micEnabled };
    case 'TOGGLE_CAMERA':
      return { ...state, cameraEnabled: !state.cameraEnabled };
    case 'INCREMENT_UNREAD': {
      const counts = new Map(state.unreadCounts);
      counts.set(action.channelId, (counts.get(action.channelId) || 0) + 1);
      return { ...state, unreadCounts: counts };
    }
    case 'CLEAR_UNREAD': {
      const counts = new Map(state.unreadCounts);
      counts.delete(action.channelId);
      return { ...state, unreadCounts: counts };
    }
    case 'ADD_DM_CHANNEL': {
      if (state.dmChannels.some((c) => c.id === action.channel.id)) return state;
      return { ...state, dmChannels: [...state.dmChannels, action.channel] };
    }
    default:
      return state;
  }
}

const AppContext = createContext<AppState>(initialState);
const DispatchContext = createContext<Dispatch<AppAction>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </AppContext.Provider>
  );
}

export function useAppState() {
  return useContext(AppContext);
}

export function useAppDispatch() {
  return useContext(DispatchContext);
}
