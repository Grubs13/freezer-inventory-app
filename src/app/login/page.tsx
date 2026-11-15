'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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
  const [error, setError] = useState(params.get('error') ? 'That sign-in link has expired. Ask for a new one.' : '');

  // Email links land here: invites carry the session in the URL hash, sign-in links carry a code.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get('code');
    const failed = hash.get('error_description') ?? params.get('error_description');
    if (failed) {
      setError(`${failed.replace(/\+/g, ' ')}. Ask for a new link.`);
      return;
    }
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (!code && !(accessToken && refreshToken)) return;
    setBusy(true);
    const auth = supabaseBrowser().auth;
    const signIn = code ? auth.exchangeCodeForSession(code) : auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });
    void signIn.then(({ error }) => {
      if (error) {
        setBusy(false);
        setError(code ? 'Open the sign-in link in the same browser you asked for it from, or ask for a new one.' : 'That link has expired. Ask for a new one.');
        return;
      }
      window.history.replaceState(null, '', '/login');
      router.replace('/');
      router.refresh();
    });
  }, [params, router]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/login` },
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
      <div className="auth__brand"><Mark size={36} />Frostbox</div>
      <div className="stack">
        <h1 className="t-title">Sign in</h1>
        <p className="muted">Use the email address you were invited with.</p>
      </div>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="stack">
          <label className="field"><span>Email</span>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </label>
          <Button type="submit" variant="primary" size="lg" block disabled={busy}>{busy ? 'Sending…' : 'Send sign-in email'}</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p>We sent an email to <b>{email}</b>. Tap the link in it to sign in. If the email shows a 6-digit code, you can type it here instead.</p>
          <label className="field"><span>Code from the email</span>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)}
              className="input num" style={{ textAlign: 'center', fontSize: 24, letterSpacing: '0.4em' }} />
          </label>
          <Button type="submit" variant="primary" size="lg" block disabled={busy}>{busy ? 'Checking…' : 'Sign in with code'}</Button>
          <Button variant="ghost" onClick={() => setStep('email')}>Use a different email</Button>
        </form>
      )}
      {error && <p role="alert" className="notice notice--error">{error}</p>}
    </main>
  );
}
