'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { relativeTime, type EventType, type SafetyCheckinDTO } from '@allclear/shared';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  locationId: string;
  hazardEventId: string | null;
  eventType: EventType;
  eventTitle: string;
  /** Server-rendered initial state (from the location's already-loaded check-ins), so there's no loading flash. */
  initialCheckin: SafetyCheckinDTO | null;
  className?: string;
}

/**
 * A personal "I'm safe" marker against one specific hazard event. This is a private record on the
 * user's own account only — it is never shared with anyone else and never notifies anyone
 * (the app has no social features by design; see CLAUDE.md non-goals).
 */
export function SafetyCheckInButton({ locationId, hazardEventId, eventType, eventTitle, initialCheckin, className }: Props) {
  const [checkin, setCheckin] = useState<SafetyCheckinDTO | null>(initialCheckin);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markSafe() {
    setPending(true);
    setError(null);
    try {
      const created = await apiFetch<SafetyCheckinDTO>(`/api/locations/${locationId}/checkins`, {
        method: 'POST',
        json: { hazard_event_id: hazardEventId, event_type: eventType, event_title: eventTitle },
      });
      setCheckin(created);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that. Try again."));
    } finally {
      setPending(false);
    }
  }

  async function undo() {
    if (!checkin) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/api/locations/${locationId}/checkins/${checkin.id}`, { method: 'DELETE' });
      setCheckin(null);
    } catch (err) {
      setError(errorMessage(err, "Couldn't undo that. Try again."));
    } finally {
      setPending(false);
    }
  }

  if (checkin) {
    return (
      <div className={cn('inline-flex flex-wrap items-center gap-1.5 text-xs', className)}>
        <span className="inline-flex items-center gap-1 rounded-full border border-good/30 bg-good-soft px-2 py-1 font-medium text-good">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          You marked yourself safe {relativeTime(checkin.created_at)}
        </span>
        <button type="button" onClick={undo} disabled={pending} className="text-slate-500 underline-offset-2 hover:underline disabled:opacity-50">
          Undo
        </button>
        {error ? <span className="block w-full text-alert-foreground">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex flex-col items-start gap-1', className)}>
      <Button type="button" variant="outline" size="sm" onClick={markSafe} disabled={pending}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {pending ? 'Marking…' : 'Mark myself safe'}
      </Button>
      {error ? <span className="text-xs text-alert-foreground">{error}</span> : null}
    </div>
  );
}
