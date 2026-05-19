import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PLATFORM } from '@/lib/brand';
import { LogoMark } from '@/components/LogoMark';

export function Logo({
  className,
  showText = true,
  inverted = false,
  href = '/',
}: {
  className?: string;
  showText?: boolean;
  inverted?: boolean;
  href?: string;
}) {
  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={36} />
      {showText && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'font-display text-lg font-bold tracking-tight',
              inverted ? 'text-white' : 'text-slate-900 dark:text-slate-100',
            )}
          >
            {PLATFORM.name}
          </span>
          <span
            className={cn(
              'mt-0.5 text-[10px] font-medium uppercase tracking-wider',
              inverted ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400',
            )}
          >
            Scheduling
          </span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
        {content}
      </Link>
    );
  }

  return content;
}
