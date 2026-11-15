'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button, Mark } from '@/components/frostbox/ui';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ? 'That sign-in link has expired. Ask for a code instead.' : '');

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      setError(
        /signups not allowed|not found/i.test(error.message)
          ? 'No account for this email yet. If you were invited, tap the link in your invite email first. Otherwise ask a household owner to invite you.'
          : error.message,
      );
      return;
    }
    setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) {
      setError('That code did not work. Check the latest email and try again.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="auth">
      <div className="auth__brand"><Mark size={20} />Frostbox</div>
      <div className="stack">
        <h1 className="t-title">Sign in</h1>
        <p className="muted">Use the email address you were invited with.</p>
      </div>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="stack">
          <label className="field"><span>Email</span>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </label>
          <Button type="submit" variant="primary" size="lg" block disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <label className="field"><span>Code sent to {email}</span>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)}
              className="input num" style={{ textAlign: 'center', fontSize: 24, letterSpacing: '0.4em' }} />
          </label>
          <Button type="submit" variant="primary" size="lg" block disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</Button>
          <Button variant="ghost" onClick={() => setStep('email')}>Use a different email</Button>
        </form>
      )}
      {error && <p role="alert" className="notice notice--error">{error}</p>}
    </main>
  );
}
