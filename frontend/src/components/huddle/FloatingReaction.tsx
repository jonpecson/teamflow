interface Props {
  emoji: string;
  style?: React.CSSProperties;
  onDone: () => void;
}

export default function FloatingReaction({ emoji, style, onDone }: Props) {
  return (
    <div
      className="floating-reaction"
      style={style}
      onAnimationEnd={onDone}
    >
      {emoji}
    </div>
  );
}
