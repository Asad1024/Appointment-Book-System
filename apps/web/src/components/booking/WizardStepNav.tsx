'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
  showNext?: boolean;
  primaryColor?: string;
  className?: string;
};

export function WizardStepNav({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  showBack = true,
  showNext = true,
  primaryColor,
  className,
}: Props) {
  if (!showBack && !showNext) return null;

  return (
    <div
      className={cn(
        'mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800',
        className,
      )}
    >
      {showBack && onBack ? (
        <Button type="button" variant="outline" onClick={onBack} className="sm:min-w-[100px]">
          Back
        </Button>
      ) : (
        <div className="hidden sm:block" />
      )}
      {showNext && onNext ? (
        <Button
          type="button"
          disabled={nextDisabled}
          onClick={onNext}
          className="sm:min-w-[120px]"
          style={primaryColor ? { backgroundColor: primaryColor } : undefined}
        >
          {nextLabel}
        </Button>
      ) : null}
    </div>
  );
}
