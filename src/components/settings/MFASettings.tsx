'use client';

import { useState } from 'react';

type Step = 'idle' | 'setup' | 'verify' | 'disable';

export function MFASettings({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [step, setStep] = useState<Step>('idle');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(mfaEnabled);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  async function startSetup() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSecret(data.secret);
      setOtpauthUrl(data.otpauth_url);
      setStep('setup');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnable() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers,
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnabled(true);
      setStep('idle');
      setCode('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDisable() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers,
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEnabled(false);
      setStep('idle');
      setPassword('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Build QR code image URL using Google Charts API (no external JS needed)
  const qrUrl = otpauthUrl
    ? `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauthUrl)}`
    : '';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Two-Factor Authentication
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Use an authenticator app to generate login codes.
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Idle state */}
      {step === 'idle' && (
        <button
          onClick={enabled ? () => setStep('disable') : startSetup}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            enabled
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Loading...' : enabled ? 'Disable 2FA' : 'Enable 2FA'}
        </button>
      )}

      {/* Setup — show QR code */}
      {step === 'setup' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scan this QR code with <strong>Google Authenticator</strong> or <strong>Authy</strong>, then enter the 6-digit code to confirm.
          </p>
          {qrUrl && (
            <div className="flex justify-center">
              <img src={qrUrl} alt="MFA QR Code" className="rounded border border-gray-200 dark:border-gray-600" width={200} height={200} />
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Can't scan? Enter this code manually: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{secret}</code>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-lg tracking-widest bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={confirmEnable}
              disabled={loading || code.length !== 6}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Confirm & Enable'}
            </button>
            <button
              onClick={() => { setStep('idle'); setError(''); setCode(''); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Disable — requires password */}
      {step === 'disable' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter your password to disable two-factor authentication.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={confirmDisable}
              disabled={loading || !password}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </button>
            <button
              onClick={() => { setStep('idle'); setError(''); setPassword(''); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
