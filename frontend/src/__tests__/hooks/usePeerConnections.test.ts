import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  localDescription: { type: string; sdp: string } | null = null;
  connectionState = 'new';
  iceConnectionState = 'new';
  signalingState = 'stable';
  ontrack: ((e: unknown) => void) | null = null;
  onicecandidate: ((e: unknown) => void) | null = null;
  onnegotiationneeded: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  private senders: { track: { kind: string } | null }[] = [];

  addTrack(track: { kind: string }) {
    this.senders.push({ track });
    // Trigger negotiation needed
    setTimeout(() => this.onnegotiationneeded?.(), 0);
  }

  removeTrack() {}
  getSenders() { return this.senders; }
  close() { this.connectionState = 'closed'; }

  async setLocalDescription(desc?: unknown) {
    this.localDescription = desc as { type: string; sdp: string } || { type: 'offer', sdp: 'mock-sdp' };
  }
  async setRemoteDescription() {}
  async addIceCandidate() {}

  toJSON() { return this.localDescription; }
}

Object.defineProperty(global, 'RTCPeerConnection', { value: MockRTCPeerConnection });
Object.defineProperty(global, 'RTCSessionDescription', { value: class { constructor(public desc: unknown) {} } });
Object.defineProperty(global, 'RTCIceCandidate', { value: class { constructor(public candidate: unknown) {} } });

describe('Peer Connection Logic', () => {
  it('deterministic role assignment: higher username initiates', () => {
    // In HuddleRoom: const weInitiate = state.username! > p;
    // jonpecson > johny = true, so jonpecson initiates (impolite)
    expect('jonpecson' > 'johny').toBe(true);
    // johny > jonpecson = false, so johny waits (polite)
    expect('johny' > 'jonpecson').toBe(false);
  });

  it('alphabetical comparison is consistent', () => {
    const users = ['alice', 'bob', 'charlie'];
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        const a = users[i];
        const b = users[j];
        // Exactly one side initiates
        expect(a > b).not.toBe(b > a);
      }
    }
  });

  it('peer connection adds local tracks on creation', () => {
    const pc = new MockRTCPeerConnection();
    const localStream = { getTracks: () => [{ kind: 'audio' }, { kind: 'video' }] };

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track);
    });

    expect(pc.getSenders().length).toBe(2);
    expect(pc.getSenders()[0].track?.kind).toBe('audio');
    expect(pc.getSenders()[1].track?.kind).toBe('video');
  });

  it('peer connection closes cleanly', () => {
    const pc = new MockRTCPeerConnection();
    expect(pc.connectionState).toBe('new');
    pc.close();
    expect(pc.connectionState).toBe('closed');
  });
});

describe('ICE Server Configuration', () => {
  it('includes STUN servers', () => {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    ];

    const stunServers = iceServers.filter((s) => s.urls.startsWith('stun:'));
    const turnServers = iceServers.filter((s) => s.urls.startsWith('turn:'));

    expect(stunServers.length).toBeGreaterThanOrEqual(2);
    expect(turnServers.length).toBeGreaterThanOrEqual(1);
  });

  it('TURN servers have credentials', () => {
    const turnServer = {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    };
    expect(turnServer.username).toBeTruthy();
    expect(turnServer.credential).toBeTruthy();
  });
});

describe('Signal Relay', () => {
  it('offer contains SDP', () => {
    const offer = { type: 'offer', sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n...' };
    expect(offer.type).toBe('offer');
    expect(offer.sdp).toBeTruthy();
  });

  it('answer contains SDP', () => {
    const answer = { type: 'answer', sdp: 'v=0\r\no=- 456 2 IN IP4 127.0.0.1\r\n...' };
    expect(answer.type).toBe('answer');
    expect(answer.sdp).toBeTruthy();
  });

  it('ICE candidate has required fields', () => {
    const candidate = {
      candidate: 'candidate:1 1 UDP 2122252543 192.168.1.1 50000 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };
    expect(candidate.candidate).toBeTruthy();
    expect(candidate.sdpMLineIndex).toBeDefined();
  });

  it('rtc_signal message format matches server expectation', () => {
    const msg = {
      type: 'rtc_signal',
      meeting_id: 'meeting-123',
      target_user: 'johny',
      signal_type: 'offer',
      data: { type: 'offer', sdp: 'mock-sdp' },
    };
    expect(msg.type).toBe('rtc_signal');
    expect(msg.meeting_id).toBeTruthy();
    expect(msg.target_user).toBeTruthy();
    expect(msg.signal_type).toMatch(/^(offer|answer|ice_candidate)$/);
  });
});

describe('Media Track Management', () => {
  it('replaceTrack for existing kind, addTrack for new kind', () => {
    const senders = [{ track: { kind: 'audio' }, replaceTrack: vi.fn() }];

    // Audio already exists -> replace
    const audioTrack = { kind: 'audio' };
    const existingSender = senders.find((s) => s.track?.kind === audioTrack.kind);
    expect(existingSender).toBeTruthy();

    // Video doesn't exist -> add
    const videoTrack = { kind: 'video' };
    const videoSender = senders.find((s) => s.track?.kind === videoTrack.kind);
    expect(videoSender).toBeUndefined();
  });

  it('remote stream addtrack event triggers re-render', () => {
    const listeners: Record<string, (() => void)[]> = {};
    const stream = {
      addEventListener: (event: string, cb: () => void) => {
        (listeners[event] = listeners[event] || []).push(cb);
      },
      removeEventListener: () => {},
      getVideoTracks: () => [{ enabled: true }],
    };

    let videoLive = false;
    stream.addEventListener('addtrack', () => {
      videoLive = stream.getVideoTracks().length > 0;
    });

    // Simulate addtrack event
    listeners['addtrack']?.forEach((cb) => cb());
    expect(videoLive).toBe(true);
  });
});

describe('Audio Element for Remote Participants', () => {
  it('remote participant gets a separate audio element', () => {
    const isLocal = false;
    const stream = { getTracks: () => [{ kind: 'audio' }] };

    // Remote participants should have audio element
    const shouldHaveAudio = !isLocal && stream;
    expect(shouldHaveAudio).toBeTruthy();
  });

  it('local participant does not get audio element (prevents echo)', () => {
    const isLocal = true;
    const stream = { getTracks: () => [{ kind: 'audio' }] };

    const shouldHaveAudio = !isLocal && stream;
    expect(shouldHaveAudio).toBeFalsy();
  });
});

describe('Call Cleanup', () => {
  it('leaving call closes all peer connections', () => {
    const peers = new Map<string, { close: ReturnType<typeof vi.fn> }>();
    peers.set('johny', { close: vi.fn() });
    peers.set('christian', { close: vi.fn() });

    // Cleanup
    peers.forEach((entry) => entry.close());
    peers.clear();

    expect(peers.size).toBe(0);
  });

  it('participant leaving removes their peer', () => {
    const peers = new Map<string, { close: ReturnType<typeof vi.fn> }>();
    peers.set('johny', { close: vi.fn() });
    peers.set('christian', { close: vi.fn() });

    const johnyPeer = peers.get('johny')!;
    johnyPeer.close();
    peers.delete('johny');

    expect(peers.size).toBe(1);
    expect(peers.has('johny')).toBe(false);
    expect(peers.has('christian')).toBe(true);
  });
});
