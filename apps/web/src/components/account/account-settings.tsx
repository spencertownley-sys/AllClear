'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LocationDTO } from '@allclear/shared';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { createClient } from '@/lib/supabase/client';
import { placeLine } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface Props {
  email: string;
  locations: LocationDTO[];
}

export function AccountSettings({ email, locations }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LocationDTO | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setPasswordError('Use at least 8 characters');
      return;
    }
    setPasswordError(null);
    setSavingPassword(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      toast.success('Password updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  async function removeLocation() {
    if (!removeTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/locations/${removeTarget.id}`, { method: 'DELETE' });
      toast.success(`${removeTarget.label} removed`);
      setRemoveTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await apiFetch('/api/account', { method: 'DELETE' });
      toast.success('Your account has been deleted');
      router.push('/');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="flex flex-col gap-3 md:max-w-sm" noValidate>
            <Field id="new-password" label="New password" error={passwordError} hint="At least 8 characters.">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                invalid={Boolean(passwordError)}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <div>
              <Button type="submit" disabled={savingPassword || password.length === 0}>
                {savingPassword ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Watch Locations</CardTitle>
          <CardDescription>{locations.length === 0 ? 'No locations saved yet.' : `${locations.length} saved.`}</CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <Button variant="outline" asChild>
              <Link href="/onboarding">Add a location</Link>
            </Button>
          ) : (
            <ul className="divide-y divide-slate-200">
              {locations.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <Link href={`/dashboard/${l.id}`} className="font-medium text-slate-900 hover:underline">
                      {l.label}
                    </Link>
                    <p className="text-sm text-slate-500">{placeLine(l) || `${l.latitude.toFixed(3)}, ${l.longitude.toFixed(3)}`}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-alert-foreground hover:bg-alert-soft" onClick={() => setRemoveTarget(l)} aria-label={`Remove ${l.label}`}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-alert/30">
        <CardHeader>
          <CardTitle className="text-alert-foreground">Danger zone</CardTitle>
          <CardDescription>Deleting your account removes your locations, rules, subscriptions and alert history. This can&apos;t be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.label ?? 'this location'}?`}
        description="This deletes the location, its layer settings and notification rules."
        confirmLabel="Remove location"
        busy={busy}
        onConfirm={removeLocation}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="Everything associated with your account will be permanently deleted."
        confirmLabel="Delete my account"
        busy={busy}
        onConfirm={deleteAccount}
      />
    </div>
  );
}
