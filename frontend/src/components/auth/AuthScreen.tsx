import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (tab === 'login') {
        await login(username, password);
      } else {
        await register(username, password, inviteCode || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
          <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
          <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>Sign Up</button>
        </div>
        <form id="auth-form" autoComplete="off" onSubmit={handleSubmit}>
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
          <button type="submit" id="auth-submit">{tab === 'login' ? 'Sign In' : 'Sign Up'}</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
