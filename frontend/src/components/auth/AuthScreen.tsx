import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const APP_VERSION = '0.1.0';

export default function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(username, password);
      } else {
        await register(username, password, inviteCode || undefined);
      }
    } catch (err) {
      if (err instanceof Error) {
        // Improve error messages for common cases
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError('Cannot connect to server. Is the backend running?');
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
