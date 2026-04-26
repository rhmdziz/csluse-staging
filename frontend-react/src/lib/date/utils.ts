export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function toStartOfDay(value: string) {
  return value ? `${value}T00:00:00` : "";
}

export function toEndOfDay(value: string) {
  return value ? `${value}T23:59:59` : "";
}

export function getDateKeyFromValue(value?: string | null) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function toLocalDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toLocalDayEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function eventCoversDate(
  startValue: string,
  endValue: string | null | undefined,
  date: Date,
) {
  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return false;

  const end = endValue ? new Date(endValue) : start;
  const safeEnd = Number.isNaN(end.getTime()) ? start : end;
  const selectedDay = toLocalDayStart(date);
  const startDay = toLocalDayStart(start);
  const endDay = toLocalDayStart(safeEnd);

  return selectedDay >= startDay && selectedDay <= endDay;
}

export function eventOverlapsDateRange(
  startValue: string,
  endValue: string | null | undefined,
  range?: { from?: Date; to?: Date },
) {
  if (!range?.from && !range?.to) return true;

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return false;

  const end = endValue ? new Date(endValue) : start;
  const safeEnd = Number.isNaN(end.getTime()) ? start : end;
  const eventStart = toLocalDayStart(start);
  const eventEnd = toLocalDayEnd(safeEnd);

  if (range.from) {
    const rangeStart = toLocalDayStart(range.from);
    if (eventEnd < rangeStart) return false;
  }

  if (range.to) {
    const rangeEnd = toLocalDayEnd(range.to);
    if (eventStart > rangeEnd) return false;
  }

  return true;
}

export function getEventDateKeys(
  startValue: string,
  endValue?: string | null,
) {
  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return [];

  const end = endValue ? new Date(endValue) : start;
  const safeEnd = Number.isNaN(end.getTime()) ? start : end;
  const current = toLocalDayStart(start);
  const last = toLocalDayStart(safeEnd);
  const keys: string[] = [];

  while (current <= last) {
    keys.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return keys;
}
