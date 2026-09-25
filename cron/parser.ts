type FieldName = "minute" | "hour" | "day" | "month" | "weekday";

interface FieldSpec {
  min: number;
  max: number;
}

const FIELD_SPECS: Record<FieldName, FieldSpec> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  day: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  weekday: { min: 0, max: 6 },
};

export interface ParsedCron {
  minute: Set<number>;
  hour: Set<number>;
  day: Set<number>;
  month: Set<number>;
  weekday: Set<number>;
}

export function parse(expression: string): ParsedCron {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error("Cron expression must have 5 fields");
  }

  const [minute, hour, day, month, weekday] = parts;

  return {
    minute: parseField(minute!, FIELD_SPECS.minute),
    hour: parseField(hour!, FIELD_SPECS.hour),
    day: parseField(day!, FIELD_SPECS.day),
    month: parseField(month!, FIELD_SPECS.month),
    weekday: parseField(weekday!, FIELD_SPECS.weekday),
  };
}

function parseField(value: string, spec: FieldSpec): Set<number> {
  const result = new Set<number>();

  // *
  if (value === "*") {
    for (let i = spec.min; i <= spec.max; i++) {
      result.add(i);
    }
    return result;
  }

  // */n
  if (/^\*\/\d+$/.test(value)) {
    const step = Number(value.slice(2));
    if (!Number.isSafeInteger(step) || step <= 0) {
      throw new Error(`Invalid step value: ${value}`);
    }

    for (let i = spec.min; i <= spec.max; i += step) {
      result.add(i);
    }
    return result;
  }

  // number
  const num = Number(value);
  if (
    /^\d+$/.test(value) &&
    Number.isInteger(num) &&
    num >= spec.min &&
    num <= spec.max
  ) {
    result.add(num);
    return result;
  }

  throw new Error(`Invalid cron field: ${value}`);
}
