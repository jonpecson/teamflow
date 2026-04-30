import { useCallback } from 'react';
import { api } from '../api/client';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { SoundEngine } from '../utils/sounds';
import type { CallResponse, ActiveCall } from '../api/types';

declare global {
  interface Window {
    ChimeSDK: {
      ConsoleLogger: new (name: string, level: number) => unknown;
      DefaultDeviceController: new (logger: unknown) => unknown;
      DefaultMeetingSession: new (config: unknown, logger: unknown, deviceController: unknown) => MeetingSession;
      MeetingSessionConfiguration: new (meeting: unknown, attendee: unknown) => unknown;
      LogLevel: { INFO: number };
    };
  }
}

interface MeetingSession {
  audioVideo: {
    start: () => void;
    stop: () => void;
    realtimeMuteLocalAudio: () => void;
    realtimeUnmuteLocalAudio: () => void;
    startLocalVideoTile: () => void;
    stopLocalVideoTile: () => void;
    startVideoInput: (device: MediaStream | string | null) => Promise<void>;
    stopVideoInput: () => Promise<void>;
    listAudioInputDevices: () => Promise<MediaDeviceInfo[]>;
    listVideoInputDevices: () => Promise<MediaDeviceInfo[]>;
    startAudioInput: (device: string) => Promise<void>;
    bindVideoElement: (tileId: number, element: HTMLVideoElement) => void;
    addObserver: (observer: unknown) => void;
    removeObserver: (observer: unknown) => void;
  };
}

let meetingSession: MeetingSession | null = null;

export function useCalls() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const loadActiveCalls = useCallback(async () => {
    const calls = await api.activeCalls() as ActiveCall[];
    dispatch({ type: 'SET_ACTIVE_CALLS', calls });
  }, [dispatch]);

  const startCall = useCallback(async (channelId: string) => {
    const data = await api.startCall(channelId) as CallResponse;
    // Chime session is optional — WebRTC handles media peer-to-peer
    initChimeSession(data).catch((e) => console.warn('Chime session init skipped:', e));
    const channelName = state.channels.find((c) => c.id === channelId)?.name
      || state.dmChannels.find((c) => c.id === channelId)?.name
      || '';
    dispatch({
      type: 'CALL_STARTED',
      call: {
        meeting_id: data.meeting_id,
        channel_id: data.channel_id,
        channel_name: channelName,
        started_by: data.started_by,
        participants: [state.username || ''],
        started_at: new Date().toISOString(),
      },
    });
    // Add system message visible to the caller too
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `call-started-${data.meeting_id}`,
        channel_id: data.channel_id,
        user_id: 'system',
        username: 'system',
        content: `__call_started__${state.username}__${data.meeting_id}`,
        timestamp: new Date().toISOString(),
      },
    });
    dispatch({ type: 'SET_CURRENT_MEETING', meetingId: data.meeting_id, startTime: Date.now() });
    SoundEngine.playConnected();
  }, [dispatch, state.channels, state.dmChannels, state.username]);

  const joinCall = useCallback(async (meetingId: string) => {
    const data = await api.joinCall(meetingId) as CallResponse;
    initChimeSession(data).catch((e) => console.warn('Chime session init skipped:', e));
    const calls = await api.activeCalls() as ActiveCall[];
    dispatch({ type: 'SET_ACTIVE_CALLS', calls });
    dispatch({ type: 'SET_CURRENT_MEETING', meetingId: data.meeting_id, startTime: Date.now() });
    SoundEngine.playConnected();
  }, [dispatch]);

  const leaveCall = useCallback(async () => {
    if (!state.currentMeetingId) return;
    const meetingId = state.currentMeetingId;
    // Update UI immediately (optimistic) — never leave user stuck
    try { meetingSession?.audioVideo.stop(); } catch { /* ignore */ }
    meetingSession = null;
    dispatch({ type: 'CALL_PARTICIPANT_LEFT', meetingId, username: state.username || '' });
    dispatch({ type: 'SET_CURRENT_MEETING', meetingId: null, startTime: null });
    SoundEngine.playDisconnected();
    // Then notify server (best-effort)
    api.leaveCall(meetingId).catch((e) => console.warn('Leave call API failed:', e));
  }, [state.currentMeetingId, state.username, dispatch]);

  const endCall = useCallback(async () => {
    if (!state.currentMeetingId) return;
    const meetingId = state.currentMeetingId;
    // Update UI immediately (optimistic) — never leave user stuck
    try { meetingSession?.audioVideo.stop(); } catch { /* ignore */ }
    meetingSession = null;
    dispatch({ type: 'CALL_ENDED', meetingId });
    dispatch({ type: 'SET_CURRENT_MEETING', meetingId: null, startTime: null });
    SoundEngine.playDisconnected();
    // Then notify server (best-effort)
    api.endCall(meetingId).catch((e) => console.warn('End call API failed:', e));
  }, [state.currentMeetingId, dispatch]);

  const toggleMic = useCallback(() => {
    if (meetingSession) {
      if (state.micEnabled) {
        meetingSession.audioVideo.realtimeMuteLocalAudio();
      } else {
        meetingSession.audioVideo.realtimeUnmuteLocalAudio();
      }
    }
    dispatch({ type: 'TOGGLE_MIC' });
  }, [state.micEnabled, dispatch]);

  const toggleCamera = useCallback(async () => {
    if (meetingSession) {
      if (state.cameraEnabled) {
        meetingSession.audioVideo.stopLocalVideoTile();
        await meetingSession.audioVideo.stopVideoInput();
      } else {
        const devices = await meetingSession.audioVideo.listVideoInputDevices();
        if (devices.length > 0) {
          await meetingSession.audioVideo.startVideoInput(devices[0].deviceId);
          meetingSession.audioVideo.startLocalVideoTile();
        }
      }
    }
    dispatch({ type: 'TOGGLE_CAMERA' });
  }, [state.cameraEnabled, dispatch]);

  const dismissCall = useCallback((meetingId: string) => {
    SoundEngine.stopRingtone();
    dispatch({ type: 'CALL_ENDED', meetingId });
  }, [dispatch]);

  return {
    activeCalls: state.activeCalls,
    currentMeetingId: state.currentMeetingId,
    micEnabled: state.micEnabled,
    cameraEnabled: state.cameraEnabled,
    callStartTime: state.callStartTime,
    loadActiveCalls,
    startCall,
    joinCall,
    leaveCall,
    endCall,
    toggleMic,
    toggleCamera,
    dismissCall,
    getMeetingSession: () => meetingSession,
  };
}

async function initChimeSession(data: CallResponse) {
  const SDK = window.ChimeSDK;
  if (!SDK) {
    console.error('Chime SDK not loaded');
    return;
  }

  const logger = new SDK.ConsoleLogger('TeamFlow', SDK.LogLevel.INFO);
  const deviceController = new SDK.DefaultDeviceController(logger);

  const meetingResp = {
    Meeting: {
      MeetingId: data.meeting_id,
      MediaPlacement: {
        AudioHostUrl: data.media_placement.audio_host_url,
        AudioFallbackUrl: data.media_placement.audio_fallback_url,
        SignalingUrl: data.media_placement.signaling_url,
        TurnControlUrl: data.media_placement.turn_control_url,
        EventIngestionUrl: data.media_placement.event_ingestion_url,
      },
    },
  };

  const attendeeResp = {
    Attendee: {
      AttendeeId: data.attendee.attendee_id,
      JoinToken: data.attendee.join_token,
    },
  };

  const config = new SDK.MeetingSessionConfiguration(meetingResp, attendeeResp);
  meetingSession = new SDK.DefaultMeetingSession(config, logger, deviceController);

  // Start audio
  const audioInputs = await meetingSession.audioVideo.listAudioInputDevices();
  if (audioInputs.length > 0) {
    await meetingSession.audioVideo.startAudioInput(audioInputs[0].deviceId);
  }

  meetingSession.audioVideo.start();
}
