'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type GoogleAuthButtonProps = {
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3c-1.65 4.66-6.08 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.16 7.96 3.04l5.66-5.66A19.93 19.93 0 0 0 24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.39-3.92Z"
      />
      <path
        fill="#FF3D00"
        d="M6.31 14.69 12.89 19.5C14.67 15.11 18.96 12 24 12c3.06 0 5.84 1.16 7.96 3.04l5.66-5.66A19.93 19.93 0 0 0 24 4c-7.68 0-14.36 4.34-17.69 10.69Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.17 0 9.86-1.98 13.41-5.2l-6.19-5.24C29.14 35.08 26.7 36 24 36c-5.2 0-9.62-3.32-11.28-7.96l-6.56 5.05A19.98 19.98 0 0 0 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.61 20.08H42V20H24v8h11.3a12.05 12.05 0 0 1-4.08 5.56l.01.01 6.19 5.24C36.98 39.2 44 34 44 24c0-1.34-.14-2.65-.39-3.92Z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  label,
  href,
  onClick,
  className,
  disabled,
}: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn('w-full', className)}
      disabled={disabled}
      onClick={() => {
        if (onClick) {
          onClick();
          return;
        }
        if (href) {
          window.location.assign(href);
        }
      }}
    >
      <GoogleIcon />
      {label}
    </Button>
  );
}
