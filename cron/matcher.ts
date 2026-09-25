import type { CalendarFields } from "./clock";
import type { ParsedCron } from "./parser";

export function matches(
  cron: ParsedCron,
  date: Date | CalendarFields,
): boolean {
  const fields =
    date instanceof Date
      ? {
          minute: date.getMinutes(),
          hour: date.getHours(),
          day: date.getDate(),
          month: date.getMonth() + 1,
          weekday: date.getDay(),
        }
      : date;
  return (
    cron.minute.has(fields.minute) &&
    cron.hour.has(fields.hour) &&
    cron.day.has(fields.day) &&
    cron.month.has(fields.month) &&
    cron.weekday.has(fields.weekday)
  );
}
