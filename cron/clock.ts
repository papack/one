export interface CalendarFields {
  minute: number;
  hour: number;
  day: number;
  month: number;
  weekday: number;
}

export interface Clock {
  now(): Date;
  fields?(date: Date): CalendarFields;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class TimezoneClock extends SystemClock {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(timezone: string) {
    super();
    // Construct once, validating the timezone before any timers start.
    this.formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  }

  fields(date: Date): CalendarFields {
    const parts = this.formatter.formatToParts(date);
    const get = (type: string) =>
      Number(parts.find((part) => part.type === type)!.value);
    const year = get("year");
    const month = get("month");
    const day = get("day");
    return {
      minute: get("minute"),
      hour: get("hour"),
      day,
      month,
      weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    };
  }
}
