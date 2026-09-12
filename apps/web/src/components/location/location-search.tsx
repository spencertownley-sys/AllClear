'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { GeocodeResult } from '@allclear/shared';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HazardMap } from '@/components/map/hazard-map';

interface LocationSearchProps {
  onSelect: (result: GeocodeResult) => void;
  selected: GeocodeResult | null;
}

/** Address/city search with autocomplete, or drop a pin on a map (PRD §3.1). */
export function LocationSearch({ onSelect, selected }: LocationSearchProps) {
  const [mode, setMode] = useState<'search' | 'pin'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (mode !== 'search') return;
    const q = query.trim();
    if (q.length < 2) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const { data } = await apiFetch<{ data: GeocodeResult[] }>(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (id !== requestId.current) return;
        setResults(data);
        setError(data.length === 0 ? "Couldn't find that location. Try adding a state, e.g. “Bend, OR”." : null);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(errorMessage(err));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, mode]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      requestId.current += 1;
      setResults([]);
      setError(null);
      setLoading(false);
    }
  }

  async function dropPin(latlng: { latitude: number; longitude: number }) {
    setPinBusy(true);
    setError(null);
    try {
      const { data } = await apiFetch<{ data: GeocodeResult | null }>(
        `/api/geocode?lat=${latlng.latitude.toFixed(5)}&lng=${latlng.longitude.toFixed(5)}`,
      );
      onSelect(
        data ?? {
          display_name: `${latlng.latitude.toFixed(4)}, ${latlng.longitude.toFixed(4)}`,
          latitude: latlng.latitude,
          longitude: latlng.longitude,
          city_name: null,
          state: null,
          postal_code: null,
          country: 'US',
        },
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="tablist" aria-label="How to add a location">
        <Button
          type="button"
          role="tab"
          aria-selected={mode === 'search'}
          variant={mode === 'search' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setMode('search')}
        >
          <Search className="h-4 w-4" aria-hidden /> Search
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={mode === 'pin'}
          variant={mode === 'pin' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setMode('pin')}
        >
          <MapPin className="h-4 w-4" aria-hidden /> Drop a pin
        </Button>
      </div>

      {mode === 'search' ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="location-query" className="text-sm font-medium text-slate-800">
            City or address
          </label>
          <Input
            id="location-query"
            placeholder="e.g. Bend, OR or 123 Main St, Boise"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            autoComplete="off"
            autoFocus
            aria-describedby={error ? 'location-query-error' : undefined}
            invalid={Boolean(error)}
          />
          {loading ? (
            <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Searching">
              <li><Skeleton className="h-11 w-full" /></li>
              <li><Skeleton className="h-11 w-3/4" /></li>
            </ul>
          ) : results.length > 0 ? (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-card border border-slate-200 bg-white" role="listbox" aria-label="Matching places">
              {results.map((r) => {
                const isSelected = selected?.latitude === r.latitude && selected?.longitude === r.longitude;
                return (
                  <li key={`${r.latitude},${r.longitude}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelect(r)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50',
                        isSelected && 'bg-primary-soft',
                      )}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-slate-800">{r.display_name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {error ? (
            <p id="location-query-error" role="alert" className="text-sm text-alert-foreground">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-600">Tap the map to place a pin where you want to watch.</p>
          <div className="h-72 overflow-hidden rounded-card border border-slate-200">
            <HazardMap
              center={selected ? [selected.latitude, selected.longitude] : [39.5, -98.35]}
              zoom={selected ? 9 : 4}
              onClick={dropPin}
              pins={selected ? [{ latitude: selected.latitude, longitude: selected.longitude, label: selected.display_name }] : []}
              className="h-72 w-full"
              ariaLabel="Pin placement map"
            />
          </div>
          {pinBusy ? <p className="text-sm text-slate-500">Looking up that spot…</p> : null}
          {error ? (
            <p role="alert" className="text-sm text-alert-foreground">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {selected ? (
        <div className="rounded-card border border-primary/20 bg-primary-soft px-4 py-3 text-sm text-slate-800">
          <span className="font-medium">Selected:</span> {selected.display_name}
        </div>
      ) : null}
    </div>
  );
}
