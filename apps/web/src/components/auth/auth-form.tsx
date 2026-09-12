'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

interface AuthFormProps {
  mode: 'login' | 'signup';
}

function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Enter your email address';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'That doesn’t look like an email address';
  return null;
}

function validatePassword(value: string, mode: 'login' | 'signup'): string | null {
  if (!value) return 'Enter your password';
  if (mode === 'signup' && value.length < 8) return 'Use at least 8 characters';
  return null;
}

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '';
}

/** Centred email/password form with inline validation on blur (UI/UX Notes §3, §5). */
export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(params.get('error') === 'confirm' ? 'That confirmation link is invalid or expired. Please log in or sign up again.' : null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ee = validateEmail(email);
    const pe = validatePassword(password, mode);
    setEmailError(ee);
    setPasswordError(pe);
    if (ee || pe) return;
    if (!hasSupabaseConfig()) {
      setFormError('Accounts aren’t configured on this deployment yet.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const supabase = createClient();
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || '/onboarding')}` },
        });
        if (error) {
          setFormError(error.message);
          return;
        }
        if (data.session) {
          router.replace(next || '/onboarding');
          router.refresh();
          return;
        }
        setCheckEmail(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setFormError(error.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : error.message);
          return;
        }
        router.replace(next || '/dashboard');
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="rounded-card border border-primary/20 bg-primary-soft px-5 py-6 text-center">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-slate-700">
          We sent a confirmation link to <span className="font-medium">{email}</span>. Open it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="email" label="Email" error={emailError}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          invalid={Boolean(emailError)}
          aria-describedby={emailError ? 'email-error' : undefined}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setEmailError(validateEmail(email))}
          required
        />
      </Field>
      <Field id="password" label="Password" error={passwordError} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
        <Input
          id="password"
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          invalid={Boolean(passwordError)}
          aria-describedby={passwordError ? 'password-error' : undefined}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setPasswordError(validatePassword(password, mode))}
          required
        />
      </Field>
      {formError ? (
        <p role="alert" className="rounded-control border border-alert/30 bg-alert-soft px-3 py-2 text-sm text-alert-foreground">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={submitting} className="mt-2">
        {submitting ? <Spinner className="text-white" /> : null}
        {mode === 'signup' ? 'Sign up' : 'Log in'}
      </Button>
      <p className="text-center text-sm text-slate-600">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary underline-offset-2 hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to AllClear?{' '}
            <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-primary underline-offset-2 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
