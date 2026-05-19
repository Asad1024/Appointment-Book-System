import { cn } from '@/lib/cn';

export function PageShell({
  title,
  description,
  children,
  className,
  wide,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide ? 'max-w-5xl' : 'max-w-2xl', 'mx-auto animate-fade-in', className)}>
      {(title || description) && (
        <header className="mb-8">
          {title && <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>}
          {description && <p className="mt-2 text-slate-600 dark:text-slate-300">{description}</p>}
        </header>
      )}
      {children}
    </div>
  );
}
