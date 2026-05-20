export type BookingIntakeField = {
  id: string;
  label: string;
  helpText?: string | null;
  type: string;
  options?: string[] | null;
  required: boolean;
};

export function parseCheckboxSelection(raw?: string): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isIntakeValueEmpty(type: string, value: string): boolean {
  if (!value.trim()) return true;
  if (type === 'checkbox') return parseCheckboxSelection(value).length === 0;
  return false;
}

export function validateIntakeFields(
  fields: BookingIntakeField[],
  answers: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = answers[f.id]?.trim() ?? '';
    if (f.required && isIntakeValueEmpty(f.type, v)) {
      errors[f.id] = `${f.label} is required`;
    }
  }
  return errors;
}

export function buildIntakePayload(answers: Record<string, string>) {
  return Object.entries(answers)
    .filter(([, v]) => v.trim())
    .map(([fieldId, value]) => ({ fieldId, value }));
}
