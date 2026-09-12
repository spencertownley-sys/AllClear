import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-slate-200 py-6 text-xs text-slate-500">
      <p className="max-w-3xl">
        AllClear relays publicly available data from government and scientific agencies. It is not an official emergency
        notification system and should never be your only source of safety information. Follow instructions from local
        authorities.
      </p>
      <nav className="mt-3 flex flex-wrap gap-4" aria-label="Legal">
        <Link href="/privacy" className="hover:text-slate-700">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-slate-700">
          Terms of Service
        </Link>
      </nav>
    </footer>
  );
}
