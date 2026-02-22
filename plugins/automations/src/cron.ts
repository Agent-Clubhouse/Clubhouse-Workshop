/**
 * Lightweight 5-field cron parser and matcher.
 * Fields: minute hour dom month dow
 */

export function parseField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    const step = stepMatch ? parseInt(stepMatch[2], 10) : 1;
    const range = stepMatch ? stepMatch[1] : part;

    // Guard against step <= 0 which would cause an infinite loop
    if (step <= 0) continue;

    let start: number;
    let end: number;
    if (range === '*') {
      start = min;
      end = max;
    } else if (range.includes('-')) {
      const [a, b] = range.split('-').map(Number);
      start = a;
      end = b;
    } else {
      start = parseInt(range, 10);
      end = start;
    }

    // Clamp start/end to valid range
    start = Math.max(min, Math.min(max, start));
    end = Math.max(min, Math.min(max, end));

    for (let i = start; i <= end; i += step) {
      values.add(i);
    }
  }
  return values;
}

export function matchesCron(expression: string, date: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const minute = parseField(fields[0], 0, 59);
  const hour = parseField(fields[1], 0, 23);
  const dom = parseField(fields[2], 1, 31);
  const month = parseField(fields[3], 1, 12);
  const dow = parseField(fields[4], 0, 6);

  return (
    minute.has(date.getMinutes()) &&
    hour.has(date.getHours()) &&
    dom.has(date.getDate()) &&
    month.has(date.getMonth() + 1) &&
    dow.has(date.getDay())
  );
}

/** Field limits: [min, max] for each of the 5 cron fields. */
const FIELD_LIMITS: [number, number][] = [
  [0, 59],  // minute
  [0, 23],  // hour
  [1, 31],  // day of month
  [1, 12],  // month
  [0, 6],   // day of week
];

const FIELD_NAMES = ['minute', 'hour', 'day-of-month', 'month', 'day-of-week'];

/**
 * Validates a cron expression and returns an error message, or null if valid.
 */
export function validateCronExpression(expression: string): string | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return `Expected 5 fields, got ${fields.length}`;
  }

  for (let f = 0; f < 5; f++) {
    const [min, max] = FIELD_LIMITS[f];
    const fieldName = FIELD_NAMES[f];

    for (const part of fields[f].split(',')) {
      const stepMatch = part.match(/^(.+)\/(\d+)$/);
      const stepStr = stepMatch ? stepMatch[2] : null;
      const range = stepMatch ? stepMatch[1] : part;

      // Validate step
      if (stepStr !== null) {
        const step = parseInt(stepStr, 10);
        if (step <= 0) {
          return `Invalid step value 0 in ${fieldName} field`;
        }
      }

      // Validate range / value
      if (range === '*') {
        // wildcard is always valid
      } else if (range.includes('-')) {
        const parts = range.split('-');
        if (parts.length !== 2) {
          return `Invalid range "${range}" in ${fieldName} field`;
        }
        const [a, b] = parts.map(Number);
        if (isNaN(a) || isNaN(b)) {
          return `Non-numeric range "${range}" in ${fieldName} field`;
        }
        if (a < min || a > max || b < min || b > max) {
          return `Value out of range (${min}-${max}) in ${fieldName} field`;
        }
        if (a > b) {
          return `Invalid range "${range}" in ${fieldName} field (start > end)`;
        }
      } else {
        const val = parseInt(range, 10);
        if (isNaN(val)) {
          return `Non-numeric value "${range}" in ${fieldName} field`;
        }
        if (val < min || val > max) {
          return `Value ${val} out of range (${min}-${max}) in ${fieldName} field`;
        }
      }
    }
  }

  return null;
}

export function describeSchedule(expression: string): string {
  const preset = PRESETS.find((p) => p.value === expression);
  if (preset) return preset.label;

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return expression;

  const [min, hour, dom, mon, dow] = fields;

  // Every N minutes
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${min.slice(2)} minutes`;
  }

  // Specific minute every hour
  if (/^\d+$/.test(min) && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every hour at :${min.padStart(2, '0')}`;
  }

  // Specific time daily
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '*') {
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Daily at ${h12}:${min.padStart(2, '0')} ${ampm}`;
  }

  // Weekdays at specific time
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && dow === '1-5') {
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Weekdays at ${h12}:${min.padStart(2, '0')} ${ampm}`;
  }

  // Specific day of week at specific time
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*' && /^\d$/.test(dow)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const dayName = dayNames[parseInt(dow, 10)] ?? dow;
    return `${dayName} at ${h12}:${min.padStart(2, '0')} ${ampm}`;
  }

  // Every N hours
  if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${hour.slice(2)} hours`;
  }

  return expression;
}

export const PRESETS = [
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Every Monday', value: '0 9 * * 1' },
  { label: 'Saturday at noon', value: '0 12 * * 6' },
] as const;
