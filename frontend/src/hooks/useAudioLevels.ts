import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioLevelState {
  audioLevels: Map<string, number>;
  dominantSpeaker: string | null;
  speakingUsers: Set<string>;
}

const THRESHOLD = 0.05;
const ALPHA = 0.3;
const DOMINANT_HOLD_MS = 1000;
const SAMPLE_INTERVAL_MS = 100; // ~10Hz

export function useAudioLevels(
  remoteStreams: Map<string, MediaStream>,
  localStream: MediaStream | null,
  localUsername: string
): AudioLevelState {
  const [state, setState] = useState<AudioLevelState>({
    audioLevels: new Map(),
    dominantSpeaker: null,
    speakingUsers: new Set(),
  });

  const contextsRef = useRef<Map<string, { ctx: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>>(new Map());
  const levelsRef = useRef<Map<string, number>>(new Map());
  const dominantRef = useRef<string | null>(null);
  const dominantTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const lastSampleRef = useRef<number>(0);

  const setupAnalyser = useCallback((username: string, stream: MediaStream) => {
    const existing = contextsRef.current.get(username);
    if (existing) {
      existing.source.disconnect();
      existing.ctx.close().catch(() => {});
    }

    if (stream.getAudioTracks().length === 0) return;

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      contextsRef.current.set(username, { ctx, analyser, source });
    } catch {
      // AudioContext creation can fail in some environments
    }
  }, []);

  // Setup/cleanup analysers when streams change
  useEffect(() => {
    const activeUsers = new Set<string>();

    // Local stream
    if (localStream && localUsername) {
      activeUsers.add(localUsername);
      const existing = contextsRef.current.get(localUsername);
      if (!existing || existing.source.mediaStream !== localStream) {
        setupAnalyser(localUsername, localStream);
      }
    }

    // Remote streams
    for (const [username, stream] of remoteStreams) {
      activeUsers.add(username);
      const existing = contextsRef.current.get(username);
      if (!existing || existing.source.mediaStream !== stream) {
        setupAnalyser(username, stream);
      }
    }

    // Cleanup removed streams
    for (const [username, entry] of contextsRef.current) {
      if (!activeUsers.has(username)) {
        entry.source.disconnect();
        entry.ctx.close().catch(() => {});
        contextsRef.current.delete(username);
        levelsRef.current.delete(username);
      }
    }
  }, [remoteStreams, localStream, localUsername, setupAnalyser]);

  // Sampling loop
  useEffect(() => {
    let running = true;

    const sample = (timestamp: number) => {
      if (!running) return;

      if (timestamp - lastSampleRef.current >= SAMPLE_INTERVAL_MS) {
        lastSampleRef.current = timestamp;

        const speaking = new Set<string>();
        let maxLevel = 0;
        let maxUser: string | null = null;

        for (const [username, entry] of contextsRef.current) {
          if (entry.ctx.state === 'suspended') {
            entry.ctx.resume().catch(() => {});
          }

          const data = new Uint8Array(entry.analyser.frequencyBinCount);
          entry.analyser.getByteFrequencyData(data);

          // Compute RMS
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const normalized = data[i] / 255;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / data.length);

          // Exponential moving average
          const prev = levelsRef.current.get(username) || 0;
          const smoothed = ALPHA * rms + (1 - ALPHA) * prev;
          levelsRef.current.set(username, smoothed);

          if (smoothed > THRESHOLD) {
            speaking.add(username);
          }

          if (smoothed > maxLevel) {
            maxLevel = smoothed;
            maxUser = username;
          }
        }

        // Dominant speaker with hold timer
        const now = Date.now();
        if (maxUser && maxLevel > THRESHOLD) {
          if (maxUser !== dominantRef.current) {
            if (now - dominantTimeRef.current > DOMINANT_HOLD_MS) {
              dominantRef.current = maxUser;
              dominantTimeRef.current = now;
            }
          }
        }

        setState({
          audioLevels: new Map(levelsRef.current),
          dominantSpeaker: dominantRef.current,
          speakingUsers: speaking,
        });
      }

      rafRef.current = requestAnimationFrame(sample);
    };

    rafRef.current = requestAnimationFrame(sample);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Cleanup all contexts on unmount
  useEffect(() => {
    return () => {
      for (const [, entry] of contextsRef.current) {
        entry.source.disconnect();
        entry.ctx.close().catch(() => {});
      }
      contextsRef.current.clear();
    };
  }, []);

  return state;
}
