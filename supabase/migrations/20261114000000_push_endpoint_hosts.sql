-- NW-04: the worker POSTs to every stored push endpoint, so only real browser push services may be
-- stored. Otherwise a signed-in user could point the worker at arbitrary or internal hosts (blind SSRF),
-- including by writing the row directly through PostgREST and skipping the API's Zod check.
-- Mirrors PUSH_SERVICE_HOSTS / isPushServiceEndpoint in packages/shared/src/schemas.ts.
-- NOT VALID: existing rows are left alone (the worker also skips non-matching endpoints); new and
-- updated rows must match.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_push_service
  check (
    endpoint ~* '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)/'
  )
  not valid;
