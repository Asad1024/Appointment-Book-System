'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type BookingIntakeField,
  parseCheckboxSelection,
} from '@/lib/booking-intake';

export function IntakeFieldsForm({
  fields,
  answers,
  errors,
  onChange,
}: {
  fields: BookingIntakeField[];
  answers: Record<string, string>;
  errors: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-slate-100 pt-6 dark:border-slate-800">
      <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
        A few more details
      </h3>
      {fields.map((field) => (
        <div key={field.id}>
          <Label className="font-semibold">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </Label>
          {field.helpText && (
            <p className="mt-0.5 text-sm text-text-muted">{field.helpText}</p>
          )}
          {field.type === 'textarea' ? (
            <Textarea
              className="mt-2"
              rows={3}
              value={answers[field.id] ?? ''}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          ) : field.type === 'select' ? (
            <Select
              value={answers[field.id] ?? ''}
              onValueChange={(v) => onChange(field.id, v)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === 'checkbox' ? (
            <div className="mt-2 space-y-2">
              {(field.options ?? []).map((o) => {
                const selected = parseCheckboxSelection(answers[field.id]);
                const checked = selected.includes(o);
                return (
                  <label key={o} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selected.filter((x) => x !== o)
                          : [...selected, o];
                        onChange(field.id, JSON.stringify(next));
                      }}
                      className="rounded border-slate-300 dark:border-slate-600 dark:bg-slate-900"
                    />
                    {o}
                  </label>
                );
              })}
            </div>
          ) : (
            <Input
              className="mt-2"
              type={field.type === 'number' ? 'number' : 'text'}
              value={answers[field.id] ?? ''}
              onChange={(e) => onChange(field.id, e.target.value)}
            />
          )}
          {errors[field.id] && (
            <p className="mt-1 text-sm text-red-600">{errors[field.id]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
