import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea className={cn('input-field min-h-[80px] resize-y', className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = 'Textarea';
