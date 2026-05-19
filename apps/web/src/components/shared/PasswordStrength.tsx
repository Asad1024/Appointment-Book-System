'use client';

import { cn } from '@/lib/utils';

export function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

export function PasswordStrength({ password }: { password: string }) {
  const score = getPasswordStrength(password);
  return (
    <div className="mt-2 flex gap-1" aria-label="Password strength">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors',
            i < score ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700',
          )}
        />
      ))}
    </div>
  );
}
