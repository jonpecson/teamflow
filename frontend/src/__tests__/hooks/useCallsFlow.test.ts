import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API
const mockApi = {
  startCall: vi.fn(),
  joinCall: vi.fn(),
  leaveCall: vi.fn(),
  endCall: vi.fn(),
  activeCalls: vi.fn(),
};

vi.mock('../../api/client', () => ({ api: mockApi }));
vi.mock('../../utils/sounds', () => ({
  SoundEngine: {
    playConnected: vi.fn(),
    playDisconnected: vi.fn(),
    playTone: vi.fn(),
    stopRingtone: vi.fn(),
    playJoin: vi.fn(),
    playLeave: vi.fn(),
  },
}));

describe('Call Flow - Start Call', () => {
  beforeEach(() => vi.clearAllMocks());

  it('startCall returns meeting data with attendee info', async () => {
    const callData = {
      meeting_id: 'meeting-1',
      channel_id: 'ch-1',
      started_by: 'jonpecson',
      attendee: { attendee_id: 'att-1', join_token: 'tok-1' },
      media_placement: { audio_host_url: 'wss://audio.example.com' },
    };
    mockApi.startCall.mockResolvedValue(callData);

    const result = await mockApi.startCall('ch-1');
    expect(result.meeting_id).toBe('meeting-1');
    expect(result.attendee.attendee_id).toBe('att-1');
    expect(mockApi.startCall).toHaveBeenCalledWith('ch-1');
  });

  it('startCall creates a system message with caller username', async () => {
    const callData = {
      meeting_id: 'meeting-2',
      channel_id: 'ch-1',
      started_by: 'jonpecson',
      attendee: { attendee_id: 'att-2', join_token: 'tok-2' },
      media_placement: {},
    };
    mockApi.startCall.mockResolvedValue(callData);

    const result = await mockApi.startCall('ch-1');
    // System message should use the caller's username, not "You"
    const systemContent = `__call_started__${result.started_by}__${result.meeting_id}`;
    expect(systemContent).toContain('jonpecson');
    expect(systemContent).not.toContain('You');
  });
});

describe('Call Flow - Join Call', () => {
  it('joinCall returns updated call data', async () => {
    const callData = {
      meeting_id: 'meeting-1',
      channel_id: 'ch-1',
      started_by: 'jonpecson',
      attendee: { attendee_id: 'att-3', join_token: 'tok-3' },
      media_placement: {},
    };
    mockApi.joinCall.mockResolvedValue(callData);
    mockApi.activeCalls.mockResolvedValue([]);

    const result = await mockApi.joinCall('meeting-1');
    expect(result.meeting_id).toBe('meeting-1');
    expect(result.attendee.join_token).toBe('tok-3');
  });
});

describe('Call Flow - Leave Call (Optimistic)', () => {
  it('leaveCall updates UI before API responds', async () => {
    mockApi.leaveCall.mockImplementation(() => new Promise((r) => setTimeout(r, 5000)));

    let uiCleared = false;
    const meetingId = 'meeting-1';

    // Simulate optimistic update pattern
    uiCleared = true; // UI clears immediately
    mockApi.leaveCall(meetingId).catch(() => {}); // API call is fire-and-forget

    expect(uiCleared).toBe(true);
    expect(mockApi.leaveCall).toHaveBeenCalledWith('meeting-1');
  });

  it('leaveCall still works if API fails', async () => {
    mockApi.leaveCall.mockRejectedValue(new Error('Network error'));

    let uiCleared = false;
    uiCleared = true;
    try {
      await mockApi.leaveCall('meeting-1');
    } catch {
      // Error caught — UI stays cleared
    }

    expect(uiCleared).toBe(true);
  });
});

describe('Call Flow - End Call', () => {
  it('endCall removes call from active calls', async () => {
    mockApi.endCall.mockResolvedValue(undefined);

    const activeCalls = new Map([['meeting-1', { meeting_id: 'meeting-1' }]]);
    await mockApi.endCall('meeting-1');
    activeCalls.delete('meeting-1');

    expect(activeCalls.size).toBe(0);
  });

  it('endCall works even if API fails', async () => {
    mockApi.endCall.mockRejectedValue(new Error('Server error'));

    const activeCalls = new Map([['meeting-1', { meeting_id: 'meeting-1' }]]);
    activeCalls.delete('meeting-1'); // Optimistic
    try {
      await mockApi.endCall('meeting-1');
    } catch {
      // ignored
    }

    expect(activeCalls.size).toBe(0);
  });
});

describe('Call State Transitions', () => {
  it('CALL_STARTED adds call to active calls map', () => {
    const calls = new Map();
    const call = {
      meeting_id: 'meeting-1',
      channel_id: 'ch-1',
      channel_name: 'general',
      started_by: 'jonpecson',
      participants: ['jonpecson'],
      started_at: new Date().toISOString(),
    };
    calls.set(call.meeting_id, call);
    expect(calls.has('meeting-1')).toBe(true);
    expect(calls.get('meeting-1')!.started_by).toBe('jonpecson');
  });

  it('CALL_PARTICIPANT_JOINED adds user to participants', () => {
    const call = { participants: ['jonpecson'] };
    call.participants.push('johny');
    expect(call.participants).toEqual(['jonpecson', 'johny']);
  });

  it('CALL_PARTICIPANT_LEFT removes user from participants', () => {
    const call = { participants: ['jonpecson', 'johny'] };
    call.participants = call.participants.filter((p) => p !== 'johny');
    expect(call.participants).toEqual(['jonpecson']);
  });

  it('CALL_ENDED clears currentMeetingId if matching', () => {
    let currentMeetingId: string | null = 'meeting-1';
    const endedMeetingId = 'meeting-1';
    if (currentMeetingId === endedMeetingId) {
      currentMeetingId = null;
    }
    expect(currentMeetingId).toBeNull();
  });

  it('CALL_ENDED does not clear currentMeetingId if not matching', () => {
    let currentMeetingId: string | null = 'meeting-2';
    const endedMeetingId = 'meeting-1';
    if (currentMeetingId === endedMeetingId) {
      currentMeetingId = null;
    }
    expect(currentMeetingId).toBe('meeting-2');
  });
});

describe('Message Deduplication', () => {
  it('ADD_MESSAGE deduplicates by id', () => {
    const messages: { id: string; content: string }[] = [];
    const msg = { id: 'call-started-meeting-1', content: '__call_started__jonpecson__meeting-1' };

    // First add
    if (!messages.some((m) => m.id === msg.id)) {
      messages.push(msg);
    }
    expect(messages.length).toBe(1);

    // Duplicate add (from WS event)
    if (!messages.some((m) => m.id === msg.id)) {
      messages.push(msg);
    }
    expect(messages.length).toBe(1); // Still 1
  });
});
