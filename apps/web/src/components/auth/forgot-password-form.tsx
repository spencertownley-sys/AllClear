'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { hasSupabaseConfig } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

/**
 * Sends a password-reset email (NW-18). The link signs the user in through /auth/callback and lands
 * on Settings, Account, where a fresh reset session may set a new password without the old one.
 * The answer is the same whether or not the address has an account.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Enter the email address you signed up with');
      return;
    }
    setEmailError(null);
    if (!hasSupabaseConfig()) {
      setFormError('Accounts aren’t configured on this deployment yet.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings/account')}`,
      });
      if (error) {
        console.error('[auth] reset request failed', error.message);
        if (error.status === 429) {
          setFormError('Too many requests. Please wait a minute and try again.');
          return;
        }
      }
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-card border border-primary/20 bg-primary-soft px-5 py-6 text-center">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-slate-700">
          If an account exists for <span className="font-medium">{email.trim()}</span>, we sent a link to reset its
          password. The link works once and expires soon.
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
          onChange={(e) => setEmail(e.target.value)}
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
        Send reset link
      </Button>
      <p className="text-center text-sm text-slate-600">
        <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
