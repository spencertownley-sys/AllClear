-- New data sources: EPA (UV index) and NOAA National Hurricane Center (tropical cyclones).
-- Enum additions live in their own migration because a new value can't be used in the same transaction.
alter type public.hazard_source add value if not exists 'epa';
alter type public.hazard_source add value if not exists 'nhc';
