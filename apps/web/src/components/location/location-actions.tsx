'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Layers, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LayerConfigDTO, LocationDTO } from '@allclear/shared';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { LayerEditor } from './layer-editor';

interface LocationActionsProps {
  location: LocationDTO;
  layers: LayerConfigDTO[];
}

/** Edit label / primary, edit layers, notification settings link, remove (with confirmation). */
export function LocationActions({ location, layers: initialLayers }: LocationActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [label, setLabel] = useState(location.label);
  const [isPrimary, setIsPrimary] = useState(location.is_primary);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerConfigDTO[]>(initialLayers);
  const [busy, setBusy] = useState(false);

  async function saveEdit() {
    const trimmed = label.trim();
    if (!trimmed) {
      setLabelError('Label can’t be empty');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/locations/${location.id}`, { method: 'PATCH', json: { label: trimmed, is_primary: isPrimary } });
      toast.success('Location updated');
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveLayers() {
    setBusy(true);
    try {
      await apiFetch(`/api/locations/${location.id}/layers`, { method: 'PUT', json: layers });
      toast.success('Layers updated');
      setLayersOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/locations/${location.id}`, { method: 'DELETE' });
      toast.success(`${location.label} removed from your Watch List`);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" aria-hidden /> Edit
      </Button>
      <Button variant="outline" size="sm" onClick={() => setLayersOpen(true)}>
        <Layers className="h-4 w-4" aria-hidden /> Edit layers
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/settings/notifications?location=${location.id}`}>
          <Bell className="h-4 w-4" aria-hidden /> Notifications
        </Link>
      </Button>
      <Button variant="ghost" size="sm" className="text-alert-foreground hover:bg-alert-soft" onClick={() => setRemoveOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden /> Remove
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title="Edit location">
          <div className="flex flex-col gap-4">
            <Field id="edit-label" label="Label" error={labelError}>
              <Input id="edit-label" value={label} maxLength={60} invalid={Boolean(labelError)} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="edit-primary" className="text-sm font-medium text-slate-800">
                Primary location
              </label>
              <Switch id="edit-primary" checked={isPrimary} onCheckedChange={setIsPrimary} />
            </div>
            <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <DialogClose asChild>
                <Button variant="outline" disabled={busy}>Cancel</Button>
              </DialogClose>
              <Button onClick={() => void saveEdit()} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={layersOpen} onOpenChange={setLayersOpen}>
        <DialogContent title="Edit layers" description={`Choose what to watch at ${location.label}.`}>
          <LayerEditor layers={layers} onChange={setLayers} disabled={busy} />
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={busy}>Cancel</Button>
            </DialogClose>
            <Button onClick={() => void saveLayers()} disabled={busy}>{busy ? 'Saving…' : 'Save layers'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove ${location.label}?`}
        description="This deletes the location, its layer settings and notification rules. Past alerts stay in your history."
        confirmLabel="Remove location"
        busy={busy}
        onConfirm={remove}
      />
    </div>
  );
}
