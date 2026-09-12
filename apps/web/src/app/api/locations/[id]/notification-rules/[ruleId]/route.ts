import { updateRuleSchema } from '@allclear/shared';
import { authed } from '@/lib/api/context';
import { assertUuid, parseJsonBody } from '@/lib/api/parse';
import { json, noContent, withErrorHandling } from '@/lib/api/respond';
import { getOwnedLocation } from '@/lib/data/locations';
import { deleteRule, updateRule } from '@/lib/data/rules';

type Context = { params: Promise<{ id: string; ruleId: string }> };

export const PATCH = withErrorHandling<Context>(async (request, { params }) => {
  const { supabase, headers } = await authed();
  const { id, ruleId } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  const input = await parseJsonBody(request, updateRuleSchema);
  const rule = await updateRule(supabase, location.id, assertUuid(ruleId, 'ruleId'), input);
  return json(rule, { headers });
});

export const DELETE = withErrorHandling<Context>(async (_request, { params }) => {
  const { supabase, headers } = await authed();
  const { id, ruleId } = await params;
  const location = await getOwnedLocation(supabase, assertUuid(id));
  await deleteRule(supabase, location.id, assertUuid(ruleId, 'ruleId'));
  return noContent({ headers });
});
