'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type PasswordFieldProps = {
  id: string;
  label: string;
  error?: string;
  showStrength?: boolean;
  password?: string;
} & React.ComponentProps<typeof Input>;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { id, label, error, className, showStrength: _showStrength, password: _password, ...inputProps },
    ref,
  ) {
    const [visible, setVisible] = useState(false);

    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <div className="relative mt-0">
          <Input
            id={id}
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={cn('pr-10', className)}
            aria-invalid={!!error}
            {...inputProps}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);

PasswordField.displayName = 'PasswordField';
