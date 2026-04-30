import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import type { InviteCode } from '../../api/types';

interface Props {
  onClose: () => void;
}

export default function InviteCodeModal({ onClose }: Props) {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [maxUses, setMaxUses] = useState(10);
  const [expiryHours, setExpiryHours] = useState<number | undefined>(168);

  const loadCodes = useCallback(async () => {
    const list = await api.listInvites() as InviteCode[];
    setCodes(list);
  }, []);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const handleGenerate = async () => {
    await api.createInvite(maxUses, expiryHours);
    loadCodes();
  };

  const handleRevoke = async (id: string) => {
    await api.revokeInvite(id);
    loadCodes();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 440 }}>
        <h3>Invite Team Members</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Generate an invite code and share it with your teammates.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Max uses:</label>
          <input
            type="number"
            value={maxUses}
            min={1}
            max={50}
            onChange={(e) => setMaxUses(Number(e.target.value))}
            style={{ width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-pill)', padding: '7px 10px', outline: 'none', textAlign: 'center' }}
          />
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Expires:</label>
          <select
            value={expiryHours ?? ''}
            onChange={(e) => setExpiryHours(e.target.value ? Number(e.target.value) : undefined)}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-pill)', padding: '7px 12px', outline: 'none', color: 'var(--text-primary)' }}
          >
            <option value="24">24h</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
            <option value="">Never</option>
          </select>
          <button className="btn-primary" style={{ padding: '7px 16px', whiteSpace: 'nowrap' }} onClick={handleGenerate}>Generate</button>
        </div>
        <h4 style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Active Codes</h4>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {codes.map((code) => (
            <div key={code.id} className="invite-code-card">
              <div>
                <div className="code">{code.code}</div>
                <div className="meta">
                  {code.uses}/{code.max_uses} uses
                  {code.expires_at && ` · expires ${new Date(code.expires_at).toLocaleDateString()}`}
                </div>
              </div>
              <div className="invite-code-actions">
                <button className="copy-btn" onClick={() => handleCopy(code.code)}>Copy</button>
                <button className="revoke-btn" onClick={() => handleRevoke(code.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
          {codes.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>No active codes</p>
          )}
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
