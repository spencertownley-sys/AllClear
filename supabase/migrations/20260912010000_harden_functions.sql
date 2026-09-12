-- Security-linter follow-ups (Supabase advisors):
--  * pin search_path on the updated_at helper
--  * trigger functions are not meant to be callable through PostgREST by API roles

alter function public.set_updated_at() set search_path = public;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.create_default_layers() from public, anon, authenticated;
revoke execute on function public.watch_locations_before_write() from public, anon, authenticated;
