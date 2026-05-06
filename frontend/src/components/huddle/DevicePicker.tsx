import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
  onSwitchMic?: (deviceId: string) => void;
  onSwitchCamera?: (deviceId: string) => void;
  onSwitchSpeaker?: (deviceId: string) => void;
  selectedMicId?: string | null;
  selectedCameraId?: string | null;
  selectedSpeakerId?: string | null;
  filterKind?: 'audioinput' | 'videoinput' | 'audiooutput';
}

interface DeviceGroup {
  audioinput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
}

export default function DevicePicker({
  onClose,
  onSwitchMic,
  onSwitchCamera,
  onSwitchSpeaker,
  selectedMicId,
  selectedCameraId,
  selectedSpeakerId,
  filterKind,
}: Props) {
  const [devices, setDevices] = useState<DeviceGroup>({ audioinput: [], videoinput: [], audiooutput: [] });

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          audioinput: all.filter((d) => d.kind === 'audioinput'),
          videoinput: all.filter((d) => d.kind === 'videoinput'),
          audiooutput: all.filter((d) => d.kind === 'audiooutput'),
        });
      } catch { /* permissions not granted */ }
    };
    loadDevices();

    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
  }, []);

  const showMic = !filterKind || filterKind === 'audioinput';
  const showCamera = !filterKind || filterKind === 'videoinput';
  const showSpeaker = !filterKind || filterKind === 'audiooutput';

  return (
    <div className={`device-picker ${filterKind ? 'device-picker-narrow' : ''}`} onClick={(e) => e.stopPropagation()}>
      {!filterKind && (
        <div className="device-picker-header">
          <h4>Devices</h4>
          <button className="device-picker-close" onClick={onClose}>&times;</button>
        </div>
      )}
      {showMic && devices.audioinput.length > 0 && (
        <div className="device-group">
          <label>Microphone</label>
          <select
            value={selectedMicId || ''}
            onChange={(e) => onSwitchMic?.(e.target.value)}
          >
            {devices.audioinput.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}
      {showCamera && devices.videoinput.length > 0 && (
        <div className="device-group">
          <label>Camera</label>
          <select
            value={selectedCameraId || ''}
            onChange={(e) => onSwitchCamera?.(e.target.value)}
          >
            {devices.videoinput.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}
      {showSpeaker && devices.audiooutput.length > 0 && (
        <div className="device-group">
          <label>Speaker</label>
          <select
            value={selectedSpeakerId || ''}
            onChange={(e) => onSwitchSpeaker?.(e.target.value)}
          >
            {devices.audiooutput.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
