import { LEGAL, isRealEmail } from '@/lib/legal';

/** Small building blocks shared by the privacy, terms and cookie pages so they read the same. */
export function LegalTitle({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">{children}</h1>
      <p className="mt-1 text-xs text-slate-500">Last updated {LEGAL.lastUpdated}</p>
    </>
  );
}

export function LegalHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 font-semibold text-slate-900">{children}</h2>;
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-card border border-slate-200 bg-white">
      <table className="w-full min-w-[480px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-900">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The contact address, as a mailto link once a real address replaces the placeholder. */
export function ContactEmail() {
  const email = LEGAL.contactEmail;
  if (!isRealEmail(email)) return <span className="font-medium text-slate-900">{email}</span>;
  return (
    <a href={`mailto:${email}`} className="font-medium text-primary underline underline-offset-2">
      {email}
    </a>
  );
}
