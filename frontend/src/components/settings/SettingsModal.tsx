import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';
import MfaSetup from './MfaSetup';

interface Props {
  onClose: () => void;
  onShowInviteCode: () => void;
}

export default function SettingsModal({ onClose, onShowInviteCode }: Props) {
  const { username, logout } = useAuth();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(state.displayName || '');
  const [role, setRole] = useState(state.role || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.mfaStatus().then((r) => setMfaEnabled(r.enabled)).catch(() => {});
  }, []);

  if (showMfaSetup) {
    return <MfaSetup onClose={() => { setShowMfaSetup(false); setMfaEnabled(true); }} />;
  }

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        display_name: displayName.trim() || undefined,
        role: role.trim() || undefined,
      });
      dispatch({
        type: 'SET_PROFILE',
        displayName: displayName.trim() || null,
        role: role.trim() || null,
      });
      setEditingProfile(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const result = await api.uploadAvatar(file);
      dispatch({ type: 'SET_PROFILE', avatarUrl: result.avatar_url });
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const shownName = state.displayName || username || '';
  const shownRole = state.role || 'Team Member';

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content settings-modal">
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>

        {/* Profile section */}
        <div className="settings-section">
          {editingProfile ? (
            <div style={{ padding: 8 }}>
              <div className="onboarding-field" style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Display Name</label>
                <input
                  type="text" placeholder="e.g. Dr. John Smith"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={64} autoFocus
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', outline: 'none', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="onboarding-field" style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Role / Title</label>
                <input
                  type="text" placeholder="e.g. Nurse, Physician"
                  value={role} onChange={(e) => setRole(e.target.value)}
                  maxLength={64}
                  style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', outline: 'none', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="settings-profile" style={{ cursor: 'pointer' }} onClick={() => setEditingProfile(true)}>
              <div
                className="settings-avatar"
                style={state.avatarUrl ? undefined : { background: avatarColor(username || '') }}
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                title="Change photo"
              >
                {state.avatarUrl
                  ? <img src={state.avatarUrl} alt={shownName} />
                  : avatarInitial(username || '')
                }
                {uploadingAvatar && <span style={{ position: 'absolute', fontSize: 10 }}>...</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div className="settings-username">{shownName}</div>
                <div className="settings-role">{shownRole}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
        </div>

        {/* Security section */}
        <div className="settings-section">
          <div className="settings-section-title">Security</div>
          <button className="settings-item" onClick={() => !mfaEnabled && setShowMfaSetup(true)} style={mfaEnabled ? { cursor: 'default' } : undefined}>
            <div className="settings-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mfaEnabled ? 'var(--success)' : 'currentColor'} strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Two-Factor Authentication</div>
              <div className="settings-item-desc">
                {mfaEnabled === null ? 'Checking...' : mfaEnabled ? 'Enabled — your account is protected' : 'Add an extra layer of security with TOTP'}
              </div>
            </div>
            {mfaEnabled ? (
              <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, whiteSpace: 'nowrap' }}>Active</span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}><polyline points="9 18 15 12 9 6"/></svg>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {/* Account section */}
        <div className="settings-section">
          <button className="settings-item settings-item-danger" onClick={() => { logout(); onClose(); }}>
            <div className="settings-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <div className="settings-item-content">
              <div className="settings-item-label">Sign Out</div>
            </div>
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '12px 0 4px', fontSize: 11, color: 'var(--text-muted)' }}>
          TeamFlow v0.3.0
        </div>
      </div>
    </div>
  );
}
