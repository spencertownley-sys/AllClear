import Link from 'next/link';
import { LEGAL, isRealEmail } from '@/lib/legal';

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-slate-200 py-6 text-xs text-slate-500">
      <p className="max-w-3xl">
        NimbusWatch relays publicly available data from government and scientific agencies. It is not an official emergency
        notification system and should never be your only source of safety information. Follow instructions from local
        authorities.
      </p>
      <p className="mt-2">
        Run by {LEGAL.operatorName}. Contact:{' '}
        {isRealEmail(LEGAL.contactEmail) ? (
          <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-slate-700">
            {LEGAL.contactEmail}
          </a>
        ) : (
          LEGAL.contactEmail
        )}
      </p>
      <nav className="mt-3 flex flex-wrap gap-4" aria-label="Legal">
        <Link href="/privacy" className="hover:text-slate-700">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-slate-700">
          Terms of Service
        </Link>
        <Link href="/cookies" className="hover:text-slate-700">
          Cookies
        </Link>
      </nav>
    </footer>
  );
}
