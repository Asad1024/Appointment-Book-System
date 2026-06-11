import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export function StepIndicator({
  steps,
  current,
  accentColor,
}: {
  steps: string[];
  current: number;
  accentColor: string;
}) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex items-start">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const connectorFilled = i > 0 && i <= current;

          return (
            <li key={label} className="relative flex flex-1 flex-col items-center">
              {i > 0 && (
                <StepConnector
                  className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2"
                  filled={connectorFilled}
                  accentColor={accentColor}
                />
              )}
              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                  active && 'border-transparent text-white shadow-sm',
                  done && !active && 'border-transparent text-white',
                  !done && !active && 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500',
                )}
                style={
                  active
                    ? { backgroundColor: accentColor }
                    : done
                      ? { backgroundColor: accentColor, opacity: 0.85 }
                      : undefined
                }
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
              </div>
              <span
                className={cn(
                  'mt-2 hidden max-w-[4.5rem] text-center text-[10px] font-medium leading-tight sm:block sm:max-w-none sm:text-xs',
                  active ? 'text-slate-900 dark:text-slate-100' : done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300 sm:hidden">
        Step {current + 1} of {steps.length}: {steps[current]}
      </p>
    </nav>
  );
}

function StepConnector({
  className,
  filled,
  accentColor,
}: {
  className?: string;
  filled: boolean;
  accentColor: string;
}) {
  return (
    <div
      className={cn(className, 'rounded-full transition-colors', !filled && 'bg-slate-200 dark:bg-slate-700')}
      style={filled ? { backgroundColor: accentColor } : undefined}
      aria-hidden
    />
  );
}
