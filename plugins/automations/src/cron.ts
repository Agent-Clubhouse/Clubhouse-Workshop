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

// ── Helper formatters for describeSchedule ──────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatHour12(h: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${ampm}`;
}

function formatTime12(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Checks if a set contains a contiguous range from `start` to `end`. */
function isContiguousRange(values: Set<number>): { start: number; end: number } | null {
  if (values.size === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return null;
  }
  return { start: sorted[0], end: sorted[sorted.length - 1] };
}

/** Checks if a set contains values at a regular step interval from `min` to `max`. */
function detectStep(values: Set<number>, min: number, max: number): number | null {
  if (values.size <= 1) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted[0] !== min) return null;
  const step = sorted[1] - sorted[0];
  if (step <= 0) return null;
  for (let i = 2; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] !== step) return null;
  }
  // Verify the last value is correct for the step
  if (sorted[sorted.length - 1] !== min + step * (sorted.length - 1)) return null;
  // Ensure it covers the full range
  if (sorted[sorted.length - 1] + step > max + 1) return null;
  return step;
}

function describeDaySet(values: Set<number>): string {
  if (values.size === 7) return '';
  if (values.size === 5) {
    const weekdays = new Set([1, 2, 3, 4, 5]);
    if ([...values].every((v) => weekdays.has(v))) return 'Monday through Friday';
  }
  if (values.size === 2) {
    const weekend = new Set([0, 6]);
    if ([...values].every((v) => weekend.has(v))) return 'Saturday and Sunday';
  }
  const range = isContiguousRange(values);
  if (range) {
    if (range.start === range.end) return DAY_NAMES[range.start];
    return `${DAY_NAMES[range.start]} through ${DAY_NAMES[range.end]}`;
  }
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 2) return `${DAY_NAMES[sorted[0]]} and ${DAY_NAMES[sorted[1]]}`;
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

function describeMonthSet(values: Set<number>): string {
  if (values.size === 12) return '';
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return `in ${MONTH_NAMES[sorted[0]]}`;
  const range = isContiguousRange(values);
  if (range) return `${MONTH_NAMES[range.start]} through ${MONTH_NAMES[range.end]}`;
  return `in ${sorted.map((m) => MONTH_NAMES[m]).join(', ')}`;
}

function describeDomSet(values: Set<number>): string {
  if (values.size === 31) return '';
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) {
    const d = sorted[0];
    const suffix = d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th';
    return `on the ${d}${suffix}`;
  }
  const range = isContiguousRange(values);
  if (range) return `on days ${range.start}–${range.end}`;
  return `on days ${sorted.join(', ')}`;
}

export function describeSchedule(expression: string): string {
  const preset = PRESETS.find((p) => p.value === expression);
  if (preset) return preset.label;

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return expression;

  const [minF, hourF, domF, monF, dowF] = fields;

  const minutes = parseField(minF, 0, 59);
  const hours = parseField(hourF, 0, 23);
  const doms = parseField(domF, 1, 31);
  const months = parseField(monF, 1, 12);
  const dows = parseField(dowF, 0, 6);

  const allMinutes = minutes.size === 60;
  const allHours = hours.size === 24;
  const allDoms = doms.size === 31;
  const allMonths = months.size === 12;
  const allDows = dows.size === 7;

  // Build parts
  const parts: string[] = [];

  // ── Time description ──

  const minuteStep = detectStep(minutes, 0, 59);
  const hourStep = detectStep(hours, 0, 23);

  if (allMinutes && allHours) {
    // Every minute
    parts.push('Every minute');
  } else if (minuteStep && minuteStep > 1 && allHours) {
    // Every N minutes
    parts.push(`Every ${minuteStep} minutes`);
  } else if (allMinutes && !allHours) {
    // Every minute during specific hours
    const hourRange = isContiguousRange(hours);
    if (hourRange) {
      parts.push(`Every minute from ${formatHour12(hourRange.start)} to ${formatHour12(hourRange.end)}`);
    } else {
      parts.push('Every minute during select hours');
    }
  } else if (minutes.size === 1 && allHours) {
    // Every hour at :MM
    const m = [...minutes][0];
    parts.push(`Every hour at :${String(m).padStart(2, '0')}`);
  } else if (minutes.size === 1 && hourStep && hourStep > 1) {
    // Every N hours (at :MM)
    const m = [...minutes][0];
    if (m === 0) {
      parts.push(`Every ${hourStep} hours`);
    } else {
      parts.push(`Every ${hourStep} hours at :${String(m).padStart(2, '0')}`);
    }
  } else if (minutes.size === 1 && hours.size === 1) {
    // Specific time
    const m = [...minutes][0];
    const h = [...hours][0];
    parts.push(`At ${formatTime12(h, m)}`);
  } else if (minutes.size === 1 && !allHours) {
    // Specific minute during hour range/set
    const m = [...minutes][0];
    const hourRange = isContiguousRange(hours);
    if (hourRange) {
      if (hourRange.start === hourRange.end) {
        parts.push(`At ${formatTime12(hourRange.start, m)}`);
      } else {
        parts.push(`Every hour from ${formatHour12(hourRange.start)} to ${formatHour12(hourRange.end)} at :${String(m).padStart(2, '0')}`);
      }
    } else if (hourStep && hourStep > 1) {
      parts.push(`Every ${hourStep} hours at :${String(m).padStart(2, '0')}`);
    } else {
      const times = [...hours].sort((a, b) => a - b).map((h) => formatTime12(h, m));
      if (times.length <= 3) {
        parts.push(`At ${times.join(', ')}`);
      } else {
        parts.push(`${times.length} times daily at :${String(m).padStart(2, '0')}`);
      }
    }
  } else if (minuteStep && minuteStep > 1 && !allHours) {
    // Every N minutes during hour range
    const hourRange = isContiguousRange(hours);
    if (hourRange) {
      parts.push(`Every ${minuteStep} minutes from ${formatHour12(hourRange.start)} to ${formatHour12(hourRange.end)}`);
    } else {
      parts.push(`Every ${minuteStep} minutes during select hours`);
    }
  } else {
    // Complex — fall back to raw for time part
    parts.push(`${minF} ${hourF}`);
  }

  // ── Day-of-week / day-of-month ──

  if (!allDows) {
    const dayDesc = describeDaySet(dows);
    if (dayDesc) parts.push(dayDesc);
  } else if (!allDoms) {
    const domDesc = describeDomSet(doms);
    if (domDesc) parts.push(domDesc);
  }
  // if both are wildcard, no day qualifier needed

  // ── Month ──

  if (!allMonths) {
    const monthDesc = describeMonthSet(months);
    if (monthDesc) parts.push(monthDesc);
  }

  // Combine with commas, converting first "At" to appropriate prefix
  if (parts.length === 0) return expression;

  let result = parts.join(', ');

  // If the only part starts with "At" and there are day/month qualifiers, adjust phrasing
  if (parts.length > 1 && parts[0].startsWith('At ')) {
    // "At 9:00 AM, Monday through Friday" reads fine
  }

  return result;
}

export const PRESETS = [
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Every Monday', value: '0 9 * * 1' },
  { label: 'Saturday at noon', value: '0 12 * * 6' },
] as const;
