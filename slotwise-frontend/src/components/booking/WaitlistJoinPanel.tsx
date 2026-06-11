'use client';

import { ArrowRight, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type WaitlistJoinPanelProps = {
  selectedDate: string;
  hasPreferredTime?: boolean;
  /** guide = explain next step (no button); action = join button */
  variant?: 'guide' | 'action';
  /** wizard = multi-step booking; inline = name/email on same page */
  guideContext?: 'wizard' | 'inline';
  loading?: boolean;
  onJoin?: () => void;
};

export function WaitlistJoinPanel({
  selectedDate,
  hasPreferredTime,
  variant = 'action',
  guideContext = 'wizard',
  loading,
  onJoin,
}: WaitlistJoinPanelProps) {
  if (!selectedDate) return null;

  const dateLabel = selectedDate;

  if (variant === 'guide') {
    return (
      <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-800 dark:bg-brand-950/40">
        <div className="flex gap-3">
          <ListOrdered className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-brand-900 dark:text-brand-100">
              No times available on this date
            </p>
            <p className="mt-1 text-sm text-brand-800/90 dark:text-brand-200/90">
              {guideContext === 'inline' ? (
                <>
                  You can join the waitlist for <strong>{dateLabel}</strong>
                  {hasPreferredTime ? ' at your preferred time' : ''}. Fill in your name and email
                  below, then tap <strong>Join waitlist</strong>.
                </>
              ) : (
                <>
                  You can join the waitlist for <strong>{dateLabel}</strong>
                  {hasPreferredTime ? ' at your preferred time' : ''}. Select{' '}
                  <strong>Continue</strong> below, enter your name and email on the next step, then
                  tap <strong>Join waitlist</strong>.
                </>
              )}
            </p>
            {guideContext === 'wizard' && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                <ArrowRight className="h-3.5 w-3.5" />
                Use Continue — join waitlist
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/80 p-4 dark:border-brand-800 dark:bg-brand-950/40">
      <div className="flex gap-3">
        <ListOrdered className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-brand-900 dark:text-brand-100">Join the waitlist</p>
          <p className="mt-1 text-sm text-brand-800/90 dark:text-brand-200/90">
            For <strong>{dateLabel}</strong>
            {hasPreferredTime ? ' at your preferred time' : ''}. We will email you when a matching slot
            opens.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-brand-300 bg-white hover:bg-brand-50 dark:border-brand-700 dark:bg-slate-900 dark:hover:bg-brand-950/60"
            disabled={loading}
            onClick={onJoin}
          >
            {loading ? 'Joining…' : 'Join waitlist'}
          </Button>
        </div>
      </div>
    </div>
  );
}
