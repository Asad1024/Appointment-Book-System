'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardBody } from '@/components/ui/card';

export function BookingWizardLayout({
  summary,
  children,
  header,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  header?: React.ReactNode;
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  return (
    <div className="space-y-6">
      {header}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="hidden w-80 shrink-0 lg:block">
          <div className="sticky top-6">
            <Card>
              <CardBody>{summary}</CardBody>
            </Card>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 shadow-card dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-expanded={summaryOpen}
            >
              <span>Booking summary</span>
              <ChevronDown
                className={cn('h-4 w-4 text-slate-500 transition-transform dark:text-slate-400', summaryOpen && 'rotate-180')}
              />
            </button>
            {summaryOpen && (
              <Card className="mt-2">
                <CardBody className="py-4">{summary}</CardBody>
              </Card>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
