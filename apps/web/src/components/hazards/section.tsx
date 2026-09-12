import * as React from 'react';
import type { HazardSource } from '@allclear/shared';
import { SourceLabel } from '@/components/ui/source-label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HazardSectionProps {
  title: string;
  source: HazardSource;
  fetchedAt?: string | null;
  stale?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}

/** One clearly titled, source-labelled section per layer (UI/UX Notes §3 "Location Detail"). */
export function HazardSection({ title, source, fetchedAt, stale, icon, children, id }: HazardSectionProps) {
  return (
    <Card id={id} className="scroll-mt-20">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          {icon}
          {title}
        </CardTitle>
        <SourceLabel source={source} fetchedAt={fetchedAt} stale={stale} className="text-right" />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
