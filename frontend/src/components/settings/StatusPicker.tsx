import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '../../api/client';
import { useAppDispatch } from '../../context/AppContext';

interface Props {
  open: boolean;
  onClose: () => void;
  currentEmoji?: string | null;
  currentText?: string | null;
}

const PRESETS = [
  { emoji: '\uD83D\uDCBC', text: 'In a meeting' },
  { emoji: '\uD83C\uDFAF', text: 'Focusing' },
  { emoji: '\uD83D\uDCA4', text: 'Away' },
  { emoji: '\uD83C\uDFD6\uFE0F', text: 'On vacation' },
  { emoji: '\uD83C\uDFE0', text: 'Working remotely' },
];

export default function StatusPicker({ open, onClose, currentEmoji, currentText }: Props) {
  const [emoji, setEmoji] = useState(currentEmoji || '');
  const [text, setText] = useState(currentText || '');
  const dispatch = useAppDispatch();

  const handleSave = async () => {
    try {
      await api.setStatus(emoji || null, text || null);
      dispatch({
        type: 'SET_PROFILE',
      });
    } catch {
      // ignore
    }
    onClose();
  };

  const handleClear = async () => {
    try {
      await api.setStatus(null, null);
    } catch {
      // ignore
    }
    setEmoji('');
    setText('');
    onClose();
  };

  const handlePreset = (preset: { emoji: string; text: string }) => {
    setEmoji(preset.emoji);
    setText(preset.text);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', maxWidth: 400 }}>
        <DialogHeader>
          <DialogTitle>Set a status</DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            placeholder="\uD83D\uDE00"
            maxLength={32}
            style={{
              width: 56,
              padding: '8px',
              textAlign: 'center',
              fontSize: 20,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
            }}
          />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's your status?"
            maxLength={128}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          {PRESETS.map((p) => (
            <button
              key={p.text}
              onClick={() => handlePreset(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                color: 'var(--text-primary)',
                textAlign: 'left',
              }}
              className="hover-bg"
            >
              <span>{p.emoji}</span>
              <span>{p.text}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={handleClear}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius)',
              background: 'var(--accent)',
              color: '#fff',
              fontWeight: 500,
            }}
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
