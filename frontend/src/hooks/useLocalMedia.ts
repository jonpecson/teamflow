import { useState, useCallback, useRef, useEffect } from 'react';

export interface LocalMediaState {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  selectedMicId: string | null;
  selectedCameraId: string | null;
  selectedSpeakerId: string | null;
}

export function useLocalMedia() {
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [selectedMicId, setSelectedMicId] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const startMic = useCallback(async (deviceId?: string | null) => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (localStreamRef.current) {
        stream.getAudioTracks().forEach((t) => localStreamRef.current!.addTrack(t));
      } else {
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
      setMicEnabled(true);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  }, []);

  const stopMic = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.stop();
        localStreamRef.current!.removeTrack(t);
      });
    }
    setMicEnabled(false);
  }, []);

  const toggleMic = useCallback(() => {
    if (micEnabled) {
      stopMic();
    } else {
      startMic(selectedMicId);
    }
  }, [micEnabled, startMic, stopMic, selectedMicId]);

  const switchMic = useCallback(async (deviceId: string) => {
    setSelectedMicId(deviceId);
    if (micEnabled) {
      // Stop current audio tracks
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.stop();
          localStreamRef.current!.removeTrack(t);
        });
      }
      // Start with new device
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
        if (localStreamRef.current) {
          stream.getAudioTracks().forEach((t) => localStreamRef.current!.addTrack(t));
        } else {
          localStreamRef.current = stream;
        }
        setLocalStream(new MediaStream(localStreamRef.current!.getTracks()));
      } catch (err) {
        console.error('Mic switch failed:', err);
      }
    }
  }, [micEnabled]);

  const startCamera = useCallback(async (deviceId?: string | null) => {
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (localStreamRef.current) {
        stream.getVideoTracks().forEach((t) => localStreamRef.current!.addTrack(t));
      } else {
        localStreamRef.current = stream;
      }
      setLocalStream(new MediaStream(localStreamRef.current!.getTracks()));
      setCameraEnabled(true);
    } catch (err) {
      console.error('Camera access denied:', err);
    }
  }, []);

  const switchCamera = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    if (cameraEnabled) {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current!.removeTrack(t);
        });
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
        if (localStreamRef.current) {
          stream.getVideoTracks().forEach((t) => localStreamRef.current!.addTrack(t));
        } else {
          localStreamRef.current = stream;
        }
        setLocalStream(new MediaStream(localStreamRef.current!.getTracks()));
      } catch (err) {
        console.error('Camera switch failed:', err);
      }
    }
  }, [cameraEnabled]);

  const switchSpeaker = useCallback((deviceId: string) => {
    setSelectedSpeakerId(deviceId);
  }, []);

  const stopCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current!.removeTrack(t);
      });
      setLocalStream(localStreamRef.current.getTracks().length > 0 ? new MediaStream(localStreamRef.current.getTracks()) : null);
    }
    setCameraEnabled(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraEnabled) {
      stopCamera();
    } else {
      startCamera(selectedCameraId);
    }
  }, [cameraEnabled, startCamera, stopCamera, selectedCameraId]);

  const startScreenShare = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setScreenSharing(true);
      // Auto-stop when user clicks browser's "Stop sharing"
      stream.getVideoTracks()[0].onended = () => {
        setScreenSharing(false);
        setScreenStream(null);
        screenStreamRef.current = null;
      };
      return true;
    } catch {
      return false;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setScreenSharing(false);
  }, []);

  const stopAll = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setLocalStream(null);
    setScreenStream(null);
    setMicEnabled(false);
    setCameraEnabled(false);
    setScreenSharing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    localStream,
    screenStream,
    micEnabled,
    cameraEnabled,
    screenSharing,
    selectedMicId,
    selectedCameraId,
    selectedSpeakerId,
    toggleMic,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    startMic,
    stopAll,
    switchMic,
    switchCamera,
    switchSpeaker,
  };
}
