import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Supabase email-confirmation / magic-link landing: exchanges the code for a session. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/onboarding';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
