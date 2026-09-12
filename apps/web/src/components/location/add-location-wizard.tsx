'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { GeocodeResult, LayerConfigDTO, LocationDTO } from '@allclear/shared';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { LocationSearch } from './location-search';
import { LayerEditor, defaultLayers } from './layer-editor';

interface WizardProps {
  firstTime: boolean;
  initial?: { latitude: number; longitude: number; label?: string; city_name?: string; state?: string; postal_code?: string } | null;
}

/**
 * Two-step wizard (UI/UX Notes §3 "Onboarding"): (1) add a location, (2) pick what to watch.
 * Also reused as the "Add Location" flow from the dashboard.
 */
export function AddLocationWizard({ firstTime, initial }: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<GeocodeResult | null>(
    initial
      ? {
          display_name: [initial.city_name, initial.state].filter(Boolean).join(', ') || `${initial.latitude.toFixed(3)}, ${initial.longitude.toFixed(3)}`,
          latitude: initial.latitude,
          longitude: initial.longitude,
          city_name: initial.city_name ?? null,
          state: initial.state ?? null,
          postal_code: initial.postal_code ?? null,
          country: 'US',
        }
      : null,
  );
  const [label, setLabel] = useState(initial?.label ?? '');
  const [labelTouched, setLabelTouched] = useState(Boolean(initial?.label));
  const [labelError, setLabelError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerConfigDTO[]>(defaultLayers());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function pick(result: GeocodeResult) {
    setSelected(result);
    if (!labelTouched) setLabel(firstTime ? 'Home' : (result.city_name ?? result.display_name.split(',')[0] ?? ''));
  }

  function validateLabel(): boolean {
    const trimmed = label.trim();
    if (!trimmed) {
      setLabelError('Give this place a label, like “Home” or “Mom’s house”.');
      return false;
    }
    if (trimmed.length > 60) {
      setLabelError('Keep labels under 60 characters.');
      return false;
    }
    setLabelError(null);
    return true;
  }

  function next() {
    if (!selected) return;
    if (!validateLabel()) return;
    setStep(2);
  }

  async function save() {
    if (!selected || !validateLabel()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const location = await apiFetch<LocationDTO>('/api/locations', {
        method: 'POST',
        json: {
          label: label.trim(),
          latitude: selected.latitude,
          longitude: selected.longitude,
          city_name: selected.city_name,
          state: selected.state,
          postal_code: selected.postal_code ?? null,
          country: selected.country,
        },
      });
      await apiFetch(`/api/locations/${location.id}/layers`, { method: 'PUT', json: layers });
      toast.success(`${location.label} added to your Watch List`);
      router.push(`/dashboard`);
      router.refresh();
    } catch (err) {
      setSaveError(errorMessage(err, "Couldn't save that location. Please try again."));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <ol className="flex items-center gap-3 text-sm" aria-label="Progress">
        {[1, 2].map((n) => (
          <li key={n} className="flex items-center gap-2">
            <span
              className={
                step >= n
                  ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white'
                  : 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600'
              }
              aria-current={step === n ? 'step' : undefined}
            >
              {step > n ? <Check className="h-4 w-4" aria-hidden /> : n}
            </span>
            <span className={step === n ? 'font-medium text-slate-900' : 'text-slate-500'}>
              {n === 1 ? 'Where' : 'What to watch'}
            </span>
            {n === 1 ? <span className="mx-1 h-px w-8 bg-slate-300" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold">{firstTime ? 'Add your first location' : 'Add a location'}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {firstTime
                ? 'Start with home. You can add family, friends and trips afterwards.'
                : 'Search for a city or address, or drop a pin on the map.'}
            </p>
          </div>
          <LocationSearch onSelect={pick} selected={selected} />
          {selected ? (
            <Field id="label" label="Label" error={labelError} hint="How you think of this place — e.g. Home, Mom’s house, Cabin.">
              <Input
                id="label"
                value={label}
                maxLength={60}
                invalid={Boolean(labelError)}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setLabelTouched(true);
                }}
                onBlur={validateLabel}
              />
            </Field>
          ) : null}
          <div className="flex justify-end">
            <Button size="lg" onClick={next} disabled={!selected}>
              Continue <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold">What do you want to watch at {label.trim() || 'this place'}?</h1>
            <p className="mt-1 text-sm text-slate-500">Everything is on by default. Turn off anything you don&apos;t care about.</p>
          </div>
          <LayerEditor layers={layers} onChange={setLayers} disabled={saving} />
          {saveError ? (
            <p role="alert" className="rounded-control border border-alert/30 bg-alert-soft px-3 py-2 text-sm text-alert-foreground">
              {saveError}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-between">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            <Button size="lg" onClick={() => void save()} disabled={saving}>
              {saving ? <Spinner className="text-white" /> : <Check className="h-4 w-4" aria-hidden />}
              {saving ? 'Adding…' : 'Add to my Watch List'}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
