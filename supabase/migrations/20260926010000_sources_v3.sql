-- New forecast sources: Open-Meteo (16-day model forecast) and NOAA CPC (6-10 / 8-14 day outlooks).
alter type public.hazard_source add value if not exists 'open_meteo';
alter type public.hazard_source add value if not exists 'cpc';
