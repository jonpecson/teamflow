export interface AuthResponse {
  token: string;
  user_id: string;
  username: string;
}

export interface Channel {
  id: string;
  name: string;
  created_by: string;
  is_dm: boolean;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface OnlineUser {
  user_id: string;
  username: string;
  status_emoji?: string | null;
  status_text?: string | null;
}

export interface ReactionData {
  emoji: string;
  count: number;
  users: string[];
}

export interface AttachmentData {
  id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  url: string;
  width?: number;
  height?: number;
}

export interface MessageData {
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  role?: string;
  avatar_url?: string;
  content: string;
  timestamp: string;
  edited_at?: string;
  created_at?: string;
  parent_id?: string;
  reply_count?: number;
  last_reply_at?: string;
  reactions?: ReactionData[];
  attachments?: AttachmentData[];
}

export interface ChannelMember {
  user_id: string;
  username: string;
  joined_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  created_by: string;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

export interface AttendeeInfo {
  attendee_id: string;
  join_token: string;
}

export interface CallResponse {
  meeting_id: string;
  channel_id: string;
  started_by: string;
  attendee: AttendeeInfo;
  media_placement: Record<string, string>;
}

export interface ActiveCall {
  meeting_id: string;
  channel_id: string;
  channel_name: string;
  started_by: string;
  participants: string[];
  started_at: string;
}

// WebSocket message types
export interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

export interface WsMessage {
  type: 'message';
  id: string;
  channel_id: string;
  user_id: string;
  username: string;
  content: string;
  timestamp: string;
}

export interface WsPresence {
  type: 'presence';
  user_id: string;
  username: string;
  status: 'online' | 'offline';
}

export interface WsChannelJoined {
  type: 'channel_joined';
  channel_id: string;
  user_id: string;
  username: string;
}

export interface WsChannelLeft {
  type: 'channel_left';
  channel_id: string;
  user_id: string;
  username: string;
}

export interface WsInvited {
  type: 'invited';
  channel_id: string;
  channel_name: string;
  invited_by: string;
}

export interface WsCallStarted {
  type: 'call_started';
  meeting_id: string;
  channel_id: string;
  started_by: string;
  channel_name: string;
}

export interface WsCallEnded {
  type: 'call_ended';
  meeting_id: string;
  channel_id: string;
}

export interface WsCallParticipantJoined {
  type: 'call_participant_joined';
  meeting_id: string;
  channel_id: string;
  username: string;
}

export interface WsCallParticipantLeft {
  type: 'call_participant_left';
  meeting_id: string;
  channel_id: string;
  username: string;
}

export interface WsCallMediaEvent {
  type: 'call_muted' | 'call_unmuted' | 'call_video_on' | 'call_video_off' | 'call_screen_share_on' | 'call_screen_share_off' | 'call_declined';
  meeting_id: string;
  channel_id: string;
  username: string;
}

export interface WsCallSpeaking {
  type: 'call_speaking';
  meeting_id: string;
  channel_id: string;
  username: string;
  speaking: boolean;
}

export interface WsCallNetworkQuality {
  type: 'call_network_quality';
  meeting_id: string;
  channel_id: string;
  username: string;
  quality: number;
}

export interface WsCallReaction {
  type: 'call_reaction';
  meeting_id: string;
  channel_id: string;
  username: string;
  emoji: string;
}

export interface WsRtcSignal {
  type: 'rtc_signal';
  meeting_id: string;
  from_user: string;
  signal_type: string;
  data: unknown;
}

export interface WsError {
  type: 'error';
  message: string;
}

export interface WsTyping {
  type: 'typing';
  channel_id: string;
  user_id: string;
  username: string;
}

export interface WsReactionUpdate {
  type: 'reaction_update';
  message_id: string;
  channel_id: string;
  emoji: string;
  user_id: string;
  username: string;
  added: boolean;
}

export interface WsThreadReply {
  type: 'thread_reply';
  id: string;
  channel_id: string;
  parent_id: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  content: string;
  timestamp: string;
}

export interface WsMessageDeleted {
  type: 'message_deleted';
  message_id: string;
  channel_id: string;
}

export interface WsPong {
  type: 'pong';
}

export interface WsMessageEdited {
  type: 'message_edited';
  message_id: string;
  channel_id: string;
  content: string;
  edited_at: string;
}

export interface WsUserStatusChanged {
  type: 'user_status_changed';
  user_id: string;
  username: string;
  status_emoji: string | null;
  status_text: string | null;
}

export type WsServerMsg =
  | WsMessage
  | WsPresence
  | WsChannelJoined
  | WsChannelLeft
  | WsInvited
  | WsCallStarted
  | WsCallEnded
  | WsCallParticipantJoined
  | WsCallParticipantLeft
  | WsCallMediaEvent
  | WsCallSpeaking
  | WsCallNetworkQuality
  | WsCallReaction
  | WsTyping
  | WsReactionUpdate
  | WsThreadReply
  | WsMessageDeleted
  | WsMessageEdited
  | WsUserStatusChanged
  | WsRtcSignal
  | WsError
  | WsPong;
