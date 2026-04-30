interface Props {
  quality: number; // 1-5
}

export default function CallQualityIndicator({ quality }: Props) {
  const color = quality >= 4 ? 'var(--success)' : quality >= 2 ? 'var(--warning)' : 'var(--danger)';
  const bars = [1, 2, 3, 4, 5];

  return (
    <div className="quality-indicator" title={`Connection quality: ${quality}/5`}>
      {bars.map((bar) => (
        <div
          key={bar}
          className="quality-bar"
          style={{
            height: `${bar * 3 + 2}px`,
            background: bar <= quality ? color : 'rgba(255,255,255,0.15)',
          }}
        />
      ))}
    </div>
  );
}
