import { useState } from 'react';
import { useChannels } from '../../hooks/useChannels';

interface Props {
  onClose: () => void;
}

export default function CreateChannelModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { createChannel } = useChannels();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createChannel(name.toLowerCase());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    }
  };

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <h3>Create Channel</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="channel-name"
            pattern="[a-zA-Z0-9_-]+"
            maxLength={64}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="hint">Lowercase letters, numbers, hyphens, underscores</p>
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
