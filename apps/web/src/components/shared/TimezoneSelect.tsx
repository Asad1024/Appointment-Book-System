'use client';

import { useMemo } from 'react';
import { formatTimezoneLabel } from '@/lib/booking-dates';
import { timezoneOptionsFor } from '@/lib/booking-timezone';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type TimezoneSelectProps = {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (timezone: string) => void;
  className?: string;
  triggerClassName?: string;
  required?: boolean;
};

/** IANA timezone picker — includes common zones plus the current saved value. */
export function TimezoneSelect({
  id = 'timezone',
  label = 'Timezone',
  value,
  onValueChange,
  className,
  triggerClassName,
  required,
}: TimezoneSelectProps) {
  const options = useMemo(() => timezoneOptionsFor(value), [value]);
  const selectValue = value?.trim() || options[0] || 'UTC';

  return (
    <div className={className}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select value={selectValue} onValueChange={onValueChange} required={required}>
        <SelectTrigger id={id} className={cn(label && 'mt-1.5', triggerClassName)}>
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent>
          {options.map((tz) => (
            <SelectItem key={tz} value={tz}>
              {formatTimezoneLabel(tz)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
