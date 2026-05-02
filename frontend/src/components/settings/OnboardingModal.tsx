import { useState, useRef } from 'react';
import { api } from '../../api/client';
import { useAppDispatch } from '../../context/AppContext';
import { avatarColor, avatarInitial } from '../../utils/colors';

interface Props {
  username: string;
  onComplete: () => void;
}

export default function OnboardingModal({ username, onComplete }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('');
  const [theme, setTheme] = useState('system');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const dispatch = useAppDispatch();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Avatar must be under 5MB');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      // Upload avatar if selected
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const result = await api.uploadAvatar(avatarFile);
        avatarUrl = result.avatar_url;
      }

      // Update profile
      await api.updateProfile({
        display_name: displayName.trim() || undefined,
        role: role.trim() || undefined,
        theme,
      });

      dispatch({
        type: 'SET_PROFILE',
        displayName: displayName.trim() || null,
        role: role.trim() || null,
        avatarUrl,
        theme,
        onboarded: true,
      });

      // Apply theme
      const resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : theme;
      document.documentElement.setAttribute('data-theme', resolved);
      localStorage.setItem('tf-theme', theme);

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content onboarding-modal">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 20, marginBottom: 4 }}>Welcome to TeamFlow</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Set up your profile so your team knows who you are</p>
        </div>

        {/* Avatar upload */}
        <div
          className="onboarding-avatar-upload"
          style={{ background: avatarPreview ? undefined : avatarColor(username), fontSize: 28, fontWeight: 700, color: '#fff' }}
          onClick={() => fileRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" />
          ) : (
            avatarInitial(username)
          )}
          <div className="onboarding-avatar-overlay">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Click to upload photo</p>

        {/* Display name */}
        <div className="onboarding-field">
          <label>Display Name</label>
          <input
            type="text"
            placeholder="e.g. Dr. John Smith"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={64}
            autoFocus
          />
        </div>

        {/* Role */}
        <div className="onboarding-field">
          <label>Role / Title</label>
          <input
            type="text"
            placeholder="e.g. Nurse, Physician, Station 3"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={64}
          />
        </div>

        {/* Theme */}
        <div className="onboarding-field">
          <label>Theme Preference</label>
          <div className="theme-selector">
            <button
              className={`theme-option ${theme === 'dark' ? 'selected' : ''}`}
              onClick={() => setTheme('dark')}
            >
              🌙 Dark
            </button>
            <button
              className={`theme-option ${theme === 'light' ? 'selected' : ''}`}
              onClick={() => setTheme('light')}
            >
              ☀️ Light
            </button>
            <button
              className={`theme-option ${theme === 'system' ? 'selected' : ''}`}
              onClick={() => setTheme('system')}
            >
              💻 System
            </button>
          </div>
        </div>

        {error && <p className="error" style={{ marginBottom: 8 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onComplete}>
            Skip for now
          </button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}
