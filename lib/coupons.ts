export function isBirthdayWeek(day: number | null, month: number | null, date = new Date()) {
  if (!day || !month) return false;

  const start = new Date(date);
  const weekday = start.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const birthday = new Date(start.getFullYear(), month - 1, day);
  return birthday >= start && birthday <= end;
}
