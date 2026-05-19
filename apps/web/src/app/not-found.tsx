import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLATFORM } from '@/lib/brand';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <FileQuestion className="h-8 w-8" aria-hidden />
      </div>
      <p className="mt-6 text-sm font-medium text-brand-600">{PLATFORM.name}</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-text-primary">Page not found</h1>
      <p className="mt-3 max-w-md text-text-secondary">
        The page you are looking for does not exist or may have been moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button>Go home</Button>
        </Link>
        <Link href="/book">
          <Button variant="outline">Book appointment</Button>
        </Link>
      </div>
    </div>
  );
}
