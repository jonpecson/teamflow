import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import { avatarColor, avatarInitial } from '../../utils/colors';
import MfaSetup from './MfaSetup';

interface Props {
  onClose: () => void;
  onShowInviteCode: () => void;
}

export default function SettingsModal({ onClose, onShowInviteCode }: Props) {
  const { username, logout } = useAuth();
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    api.mfaStatus().then((r) => setMfaEnabled(r.enabled)).catch(() => {});
  }, []);

  if (showMfaSetup) {
    return <MfaSetup onClose={() => { setShowMfaSetup(false); setMfaEnabled(true); }} />;
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content settings-modal">
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        {/* Profile section */}
        <div className="settings-section">
          <div className="settings-profile">
            <div className="settings-avatar" style={{ background: avatarColor(username || '') }}>
              {avatarInitial(username || '')}
            </div>
            <div>
              <div className="settings-username">{username}</div>
              <div className="settings-role">Team Member</div>
            </div>
          </div>
        </div>

        {/* Security section */}
        <div className="settings-section">
          <div className="settings-section-title">Security</div>

          <button className="settings-item" onClick={() => !mfaEnabled && setShowMfaSetup(true)} style={mfaEnabled ? { cursor: 'default' } : undefined}>
            <div className="settings-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mfaEnabled ? 'var(--success, #34d399)' : 'currentColor'} strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Two-Factor Authentication</div>
              <div className="settings-item-desc">
                {mfaEnabled === null ? 'Checking...' : mfaEnabled ? 'Enabled — your account is protected' : 'Add an extra layer of security with TOTP'}
              </div>
            </div>
            {mfaEnabled ? (
              <span style={{ fontSize: 11, color: 'var(--success, #34d399)', fontWeight: 600, whiteSpace: 'nowrap' }}>Active</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>
        </div>

        {/* Team section */}
        <div className="settings-section">
          <div className="settings-section-title">Team</div>

          <button className="settings-item" onClick={() => { onClose(); onShowInviteCode(); }}>
            <div className="settings-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Invite Team Members</div>
              <div className="settings-item-desc">Generate invite codes for your team</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {/* Account section */}
        <div className="settings-section">
          <button className="settings-item settings-item-danger" onClick={() => { logout(); onClose(); }}>
            <div className="settings-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Sign Out</div>
            </div>
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '12px 0 4px', fontSize: 11, color: 'var(--text-muted)' }}>
          TeamFlow v0.2.0
        </div>
      </div>
    </div>
  );
}
