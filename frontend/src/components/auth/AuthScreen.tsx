import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const APP_VERSION = '0.2.0';

export default function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const { login, validateMfa, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        const result = await login(username, password);
        if (result.mfa_required && result.user_id) {
          setMfaRequired(true);
          setMfaUserId(result.user_id);
        }
      } else {
        await register(username, password, inviteCode || undefined);
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError('Cannot connect to server.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await validateMfa(mfaUserId, mfaCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  // MFA code entry screen
  if (mfaRequired) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 4 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="1.5" style={{ opacity: 0.8 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>Two-Factor Authentication</h2>
          <p className="auth-subtitle">Enter the 6-digit code from your authenticator app</p>
          <form id="auth-form" onSubmit={handleMfaSubmit} noValidate>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ textAlign: 'center', fontSize: 28, letterSpacing: 8, fontWeight: 700, fontFamily: 'monospace' }}
            />
            <button type="submit" id="auth-submit" disabled={loading || mfaCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
          <button
            type="button"
            onClick={() => { setMfaRequired(false); setMfaCode(''); setError(''); }}
            style={{ marginTop: 16, background: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', border: 'none' }}
          >
            Back to login
          </button>
          <div className="auth-version">v{APP_VERSION}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 4 }}>
            <img src="/images/logo.svg" alt="TeamFlow" style={{ width: 48, height: 48, borderRadius: 12 }} />
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>TeamFlow</h1>
          </div>
        </div>
        <p className="auth-subtitle">Fast chat for small teams</p>
        <div className="auth-tabs">
          <button type="button" className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>Sign In</button>
          <button type="button" className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>Sign Up</button>
        </div>
        <form id="auth-form" autoComplete="off" onSubmit={handleSubmit} noValidate>
          <input
            type="text"
            placeholder="Username"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {tab === 'register' && (
            <input
              type="text"
              placeholder="Invite code (e.g. TF-A3X9K2)"
              autoComplete="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          )}
          <button type="submit" id="auth-submit" disabled={loading}>
            {loading ? 'Connecting...' : tab === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
        <div className="auth-version">v{APP_VERSION}</div>
      </div>
    </div>
  );
}
