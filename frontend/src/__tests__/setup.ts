import '@testing-library/jest-dom';

// Mock localStorage
const store: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  },
});

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  async resume() {}
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 440 },
      connect: () => ({ connect: () => {} }),
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => ({ connect: () => {} }),
    };
  }
  get destination() { return {}; }
  get currentTime() { return 0; }
}

Object.defineProperty(window, 'AudioContext', { value: MockAudioContext });

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send() {}
  close() {}
}
Object.defineProperty(window, 'WebSocket', { value: MockWebSocket });

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    enumerateDevices: async () => [],
    getUserMedia: async () => ({}),
    getDisplayMedia: async () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
  },
});

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: async () => {} },
});
