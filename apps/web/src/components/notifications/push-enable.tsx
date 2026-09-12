'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { publicEnv } from '@/lib/env';
import { errorMessage } from '@/lib/api-client';
import { getExistingSubscription, getPushState, subscribeToPush, unsubscribeFromPush, type PushState } from '@/lib/push-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PushEnableProps {
  /** Only prompt once the user has at least one rule (Launch Checklist: Onboarding). */
  hasRules: boolean;
}

export function PushEnable({ hasRules }: PushEnableProps) {
  const [state, setState] = useState<PushState>('unsupported');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = getPushState();
      const sub = s === 'granted' ? await getExistingSubscription() : null;
      if (cancelled) return;
      setState(s);
      setSubscribed(Boolean(sub));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const result = await subscribeToPush(publicEnv.vapidPublicKey);
      if (result === 'granted') {
        setState('granted');
        setSubscribed(true);
        toast.success('Push notifications enabled on this device');
      } else {
        setState('denied');
        toast.error('Notifications were blocked. You can re-enable them in your browser settings.');
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.success('Push notifications turned off on this device');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !hasRules) return null;

  let body: React.ReactNode;
  if (state === 'unsupported' || state === 'insecure') {
    body = (
      <p className="text-sm text-slate-600">
        This browser doesn&apos;t support push notifications. Email alerts still work, and you can add AllClear to your home screen on iOS 16.4+ to enable push.
      </p>
    );
  } else if (state === 'denied') {
    body = (
      <p className="text-sm text-slate-600">
        Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload this page.
      </p>
    );
  } else if (subscribed) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">Push notifications are on for this device.</p>
        <Button variant="outline" size="sm" onClick={() => void disable()} disabled={busy}>
          <BellOff className="h-4 w-4" aria-hidden /> Turn off on this device
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">Get alerts on this device even when AllClear isn&apos;t open.</p>
        <Button size="sm" onClick={() => void enable()} disabled={busy || !publicEnv.vapidPublicKey}>
          <BellRing className="h-4 w-4" aria-hidden /> {busy ? 'Enabling…' : 'Enable push notifications'}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary-soft/40">
      <CardContent className="p-4">{body}</CardContent>
    </Card>
  );
}
