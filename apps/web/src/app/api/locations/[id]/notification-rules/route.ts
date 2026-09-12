import { createRuleSchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { assertUuid, parseJsonBody } from '@/lib/api/parse';
import { json, withErrorHandling } from '@/lib/api/respond';
import { getOwnedLocation } from '@/lib/data/locations';
import { createRule, listRules } from '@/lib/data/rules';

type Context = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  return json({ data: await listRules(supabase, location.id) }, { headers });
});

export const POST = withErrorHandling<Context>(async (request, { params }) => {
  const { supabase, headers } = await authed();
  const { id } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  const input = await parseJsonBody(request, createRuleSchema);
  const rule = await createRule(supabase, location.id, input);
  return json(rule, { status: 201, headers });
});
