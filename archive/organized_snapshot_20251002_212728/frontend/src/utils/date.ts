export function toDateTime(v?: string | number | Date | null): Date {
  if (!v && v !== 0) return new Date(0);
  try {
    return new Date(v as any);
  } catch (e) {
    return new Date(0);
  }
}

export function toLocale(v?: string | number | Date | null): string {
  const d = toDateTime(v);
  if (!d || Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
}
