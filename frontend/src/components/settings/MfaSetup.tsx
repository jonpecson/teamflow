import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { api } from '../../api/client';

interface Props {
  onClose: () => void;
}

interface MfaSetupData {
  secret: string;
  uri: string;
}

function QrImage({ data }: { data: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(data, { width: 200, margin: 1 }).then(setSrc);
  }, [data]);
  if (!src) return <div style={{ width: 200, height: 200 }} />;
  return <img src={src} alt="QR Code" width={200} height={200} style={{ borderRadius: 8 }} />;
}

export default function MfaSetup({ onClose }: Props) {
  const [step, setStep] = useState<'intro' | 'scan' | 'verify' | 'done'>('intro');
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.setupMfa() as MfaSetupData;
      setSetupData(data);
      setStep('scan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.verifyMfa(code);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content settings-modal">
        {step === 'intro' && (
          <div style={{ padding: '20px 24px' }}>
            <h3>Enable Two-Factor Authentication</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Add an extra layer of security to your account. You'll need an authenticator app like
              Google Authenticator, Authy, or 1Password.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleSetup} disabled={loading}>
                {loading ? 'Setting up...' : 'Set Up MFA'}
              </button>
            </div>
            {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        )}

        {step === 'scan' && setupData && (
          <div style={{ padding: '20px 24px' }}>
            <h3>Scan QR Code</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Scan this QR code with your authenticator app, or enter the secret key manually.
            </p>

            <div style={{
              background: '#fff', borderRadius: 12, padding: 16, textAlign: 'center', marginBottom: 16
            }}>
              <QrImage data={setupData.uri} />
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius)', padding: 12, marginBottom: 16
            }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Manual entry key:</p>
              <p style={{
                fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--accent-light)',
                letterSpacing: 2, wordBreak: 'break-all'
              }}>
                {setupData.secret}
              </p>
            </div>

            <button className="btn-primary" style={{ width: '100%' }} onClick={() => setStep('verify')}>
              I've scanned the code
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div style={{ padding: '20px 24px' }}>
            <h3>Verify Code</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              Enter the 6-digit code from your authenticator app to confirm setup.
            </p>
            <form onSubmit={handleVerify}>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ textAlign: 'center', fontSize: 28, letterSpacing: 8, fontWeight: 700, fontFamily: 'monospace' }}
              />
              {error && <p className="error" style={{ marginTop: 8 }}>{error}</p>}
              <div className="modal-actions" style={{ marginTop: 16 }}>
                <button type="button" className="btn-secondary" onClick={() => setStep('scan')}>Back</button>
                <button type="submit" className="btn-primary" disabled={loading || code.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 'done' && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" style={{ marginBottom: 12 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <h3>MFA Enabled!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                Your account is now protected with two-factor authentication.
                You'll need your authenticator app every time you sign in.
              </p>
            </div>
            <button className="btn-primary" style={{ width: '100%' }} onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
