import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';

interface UrlPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
}

// Global cache to avoid re-fetching across re-renders
const previewCache = new Map<string, UrlPreviewData | null>();

interface Props {
  url: string;
}

export default function LinkPreview({ url }: Props) {
  const [preview, setPreview] = useState<UrlPreviewData | null>(previewCache.get(url) || null);
  const [loading, setLoading] = useState(!previewCache.has(url));
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url) || null);
      setLoading(false);
      return;
    }
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const result = (await api.unfurl(url)) as UrlPreviewData;
        if (result.title || result.description) {
          previewCache.set(url, result);
          setPreview(result);
        } else {
          previewCache.set(url, null);
        }
      } catch {
        previewCache.set(url, null);
      }
      setLoading(false);
    })();
  }, [url]);

  if (loading || !preview) return null;

  return (
    <div className="link-preview">
      <div className="link-preview-content">
        {preview.site_name && (
          <div className="link-preview-site">{preview.site_name}</div>
        )}
        {preview.title && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="link-preview-title">
            {preview.title}
          </a>
        )}
        {preview.description && (
          <div className="link-preview-desc">{preview.description}</div>
        )}
      </div>
      {preview.image_url && (
        <img
          src={preview.image_url}
          alt=""
          className="link-preview-image"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}
