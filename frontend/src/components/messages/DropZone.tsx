import { Upload } from 'lucide-react';

export default function DropZone() {
  return (
    <div className="drop-zone">
      <div className="drop-zone-content">
        <Upload size={48} strokeWidth={1.5} />
        <span>Drop to upload</span>
      </div>
    </div>
  );
}
