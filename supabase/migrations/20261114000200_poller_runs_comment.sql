-- NW-22: the Supabase advisor flags poller_runs as "RLS enabled, no policies". That is intended:
-- only the worker's service role (which bypasses RLS) reads and writes it. Record that on the table.
comment on table public.poller_runs is 'Service role only; RLS deny-all by design';
