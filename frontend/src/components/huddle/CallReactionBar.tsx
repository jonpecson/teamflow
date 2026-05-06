interface Props {
  onSelect: (emoji: string) => void;
}

const REACTIONS = ['\u{1F44D}', '\u{1F44F}', '\u{1F602}', '\u{2764}\u{FE0F}', '\u{1F389}', '\u{1F44B}'];

export default function CallReactionBar({ onSelect }: Props) {
  return (
    <div className="call-reaction-bar">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          className="call-reaction-btn"
          onClick={(e) => { e.stopPropagation(); onSelect(emoji); }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
