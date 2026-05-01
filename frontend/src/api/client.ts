// In Tauri production mode, files are served from tauri:// protocol,
// so API calls need an absolute URL to the cloud backend.
const isTauri = window.location.protocol === 'tauri:' || (window.location.protocol === 'https:' && window.location.hostname === 'tauri.localhost');
const BASE = isTauri ? 'https://teamflow.statlingo.ai/api' : '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json();
}

export const api = {
  // Auth
  register: (username: string, password: string, invite_code?: string) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, invite_code }),
    }),

  login: (username: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // Channels
  listChannels: () => request('/channels'),
  createChannel: (name: string) =>
    request('/channels', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  myChannels: () => request('/channels/mine'),
  joinChannel: (id: string) =>
    request(`/channels/${id}/join`, { method: 'POST' }),
  leaveChannel: (id: string) =>
    request(`/channels/${id}/leave`, { method: 'POST' }),
  channelMembers: (id: string) => request(`/channels/${id}/members`),
  channelHistory: (id: string, limit?: number, before?: string) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (before) params.set('before', before);
    const qs = params.toString();
    return request(`/channels/${id}/messages${qs ? '?' + qs : ''}`);
  },
  inviteToChannel: (id: string, user_id: string) =>
    request(`/channels/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify({ user_id }),
    }),
  getOrCreateDm: (userId: string) =>
    request(`/dm/${userId}`, { method: 'POST' }),

  // Users
  listUsers: () => request('/users'),
  onlineUsers: () => request('/online'),

  // Invites
  createInvite: (max_uses?: number, expires_in_hours?: number) =>
    request('/invites', {
      method: 'POST',
      body: JSON.stringify({ max_uses, expires_in_hours }),
    }),
  listInvites: () => request('/invites'),
  revokeInvite: (id: string) =>
    request(`/invites/${id}`, { method: 'DELETE' }),

  // Calls
  startCall: (channel_id: string) =>
    request('/calls', {
      method: 'POST',
      body: JSON.stringify({ channel_id }),
    }),
  activeCalls: () => request('/calls/active'),
  joinCall: (meetingId: string) =>
    request(`/calls/${meetingId}/join`, { method: 'POST' }),
  leaveCall: (meetingId: string) =>
    request(`/calls/${meetingId}/leave`, { method: 'POST' }),
  endCall: (meetingId: string) =>
    request(`/calls/${meetingId}`, { method: 'DELETE' }),
};
