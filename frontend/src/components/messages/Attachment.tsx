import { useState } from 'react';
import type { AttachmentData } from '../../api/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function fileIcon(contentType: string): string {
  if (contentType.includes('pdf')) return '📄';
  if (contentType.includes('word') || contentType.includes('document')) return '📝';
  if (contentType.includes('excel') || contentType.includes('sheet') || contentType.includes('csv')) return '📊';
  if (contentType.includes('text')) return '📃';
  return '📎';
}

export default function Attachment({ attachment }: { attachment: AttachmentData }) {
  const [lightbox, setLightbox] = useState(false);

  if (isImage(attachment.content_type)) {
    return (
      <>
        <div className="attachment-image" onClick={() => setLightbox(true)}>
          <img
            src={attachment.url}
            alt={attachment.file_name}
            style={{ maxWidth: Math.min(attachment.width || 400, 400), maxHeight: 300 }}
            loading="lazy"
          />
        </div>
        {lightbox && (
          <div className="lightbox" onClick={() => setLightbox(false)}>
            <button className="lightbox-close" onClick={() => setLightbox(false)}>&times;</button>
            <img src={attachment.url} alt={attachment.file_name} />
            <div className="lightbox-info">
              {attachment.file_name} · {formatSize(attachment.file_size)}
              {attachment.width && attachment.height && ` · ${attachment.width}×${attachment.height}`}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="attachment-file">
      <span className="attachment-file-icon">{fileIcon(attachment.content_type)}</span>
      <div className="attachment-file-info">
        <span className="attachment-file-name">{attachment.file_name}</span>
        <span className="attachment-file-size">{formatSize(attachment.file_size)}</span>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.4 }}>
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </a>
  );
}
