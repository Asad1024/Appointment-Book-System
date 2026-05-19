/** Format stored intake answer for display (checkbox JSON → comma-separated). */
export function formatIntakeDisplayValue(fieldType: string, value: string): string {
  if (fieldType !== 'checkbox') return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === 'string').join(', ');
    }
  } catch {
    /* fall through */
  }
  return value;
}
