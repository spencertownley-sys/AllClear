'use client';

import { useEffect, useState } from 'react';
import { fetchRadarIndex, type RadarFrame } from './radar';

const REFRESH_MS = 5 * 60_000; // RainViewer publishes a new frame roughly every 10 minutes.
const PLAY_INTERVAL_MS = 700;

export interface RadarFramesState {
  /** null while loading or if RainViewer is unreachable; the caller falls back to the legacy tile source. */
  host: string | null;
  frames: RadarFrame[];
  /** Index into `frames` currently shown (always valid once frames is non-empty). */
  index: number;
  playing: boolean;
  togglePlay: () => void;
}

/** Loads RainViewer's radar frame list and drives a simple play/pause loop over the last frames, when `enabled`. */
export function useRadarFrames(enabled: boolean): RadarFramesState {
  const [host, setHost] = useState<string | null>(null);
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      try {
        const idx = await fetchRadarIndex(controller.signal);
        if (cancelled) return;
        setHost(idx.host);
        setFrames(idx.frames);
        setIndex(idx.frames.length - 1); // default to the latest observed frame
      } catch {
        // Leave host null; the caller falls back to the legacy composite.
      }
    }
    void load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !playing || frames.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1 >= frames.length ? 0 : i + 1));
    }, PLAY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, playing, frames.length]);

  return { host, frames, index, playing, togglePlay: () => setPlaying((p) => !p) };
}
