import { Logo } from '@/components/nav/app-shell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center px-4 py-10">
      <Logo className="mb-8 text-xl" />
      <div className="w-full max-w-md rounded-card border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
