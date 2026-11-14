'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-4xl">🧊</p>
        <h1 className="mt-2 text-2xl font-semibold">Freezer</h1>
        <p className="text-muted mt-1">Sign in with the email you were invited with.</p>
      </div>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          <button disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="code">Code sent to {email}</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} className="field text-center text-2xl tracking-[0.4em]" />
          <button disabled={busy} className="btn-primary">{busy ? 'Checking…' : 'Sign in'}</button>
          <button type="button" onClick={() => setStep('email')} className="text-muted text-sm underline">Use a different email</button>
        </form>
      )}
      {error && <p role="alert" className="text-danger text-sm">{error}</p>}
    </main>
  );
}
