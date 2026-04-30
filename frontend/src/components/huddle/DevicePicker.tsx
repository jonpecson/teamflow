import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
}

interface DeviceGroup {
  audioinput: MediaDeviceInfo[];
  videoinput: MediaDeviceInfo[];
  audiooutput: MediaDeviceInfo[];
}

export default function DevicePicker({ onClose }: Props) {
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

  return (
    <div className="device-picker" onClick={(e) => e.stopPropagation()}>
      <div className="device-picker-header">
        <h4>Devices</h4>
        <button className="device-picker-close" onClick={onClose}>&times;</button>
      </div>
      {devices.audioinput.length > 0 && (
        <div className="device-group">
          <label>Microphone</label>
          <select>
            {devices.audioinput.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}
      {devices.videoinput.length > 0 && (
        <div className="device-group">
          <label>Camera</label>
          <select>
            {devices.videoinput.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}
      {devices.audiooutput.length > 0 && (
        <div className="device-group">
          <label>Speaker</label>
          <select>
            {devices.audiooutput.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
