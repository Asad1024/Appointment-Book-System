import { Logo } from '@/components/Logo';
import { Card, CardContent } from '@/components/ui/card';
import { PLATFORM } from '@/lib/brand';

export function AuthShell({
  children,
  title,
  subtitle,
  headerRight,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-brand-600 to-brand-800 p-12 text-white lg:flex">
        <Logo inverted href="/" />
        <blockquote className="max-w-md">
          <p className="font-display text-3xl font-semibold leading-snug">
            &ldquo;{PLATFORM.name} turned our scheduling chaos into a five-minute setup.&rdquo;
          </p>
          <footer className="mt-4 text-sm text-white/70">— Demo Company team</footer>
        </blockquote>
        <p className="text-sm text-white/60">{PLATFORM.description}</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center bg-surface-subtle p-6">
        <div className="mb-6 lg:hidden">
          <Logo href="/" />
        </div>
        <Card className="w-full max-w-md shadow-float">
          <CardContent className="p-8">
            <div className="mb-6 flex items-center justify-between">
              <Logo href="/" className="hidden lg:flex" />
              {headerRight ? <div className="ml-auto">{headerRight}</div> : null}
            </div>
            {title && (
              <h1 className="font-display text-2xl font-bold text-text-primary">{title}</h1>
            )}
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
