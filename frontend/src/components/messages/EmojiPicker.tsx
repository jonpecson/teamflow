import { useEffect, useRef } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export default function EmojiPicker({ onSelect, onClose, position }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Position the picker above or below the trigger
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 200,
    left: Math.min(position.x, window.innerWidth - 360),
    top: position.y > window.innerHeight / 2 ? position.y - 440 : position.y + 10,
  };

  return (
    <div ref={ref} style={style}>
      <Picker
        data={data}
        onEmojiSelect={(emoji: { native: string }) => {
          onSelect(emoji.native);
          onClose();
        }}
        theme="dark"
        previewPosition="none"
        skinTonePosition="none"
        maxFrequentRows={2}
      />
    </div>
  );
}
