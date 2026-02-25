import { describe, it, expect } from 'vitest';
import { parseField, matchesCron, describeSchedule, validateCronExpression, PRESETS } from './cron';

// ── parseField ──────────────────────────────────────────────────────────

describe('parseField', () => {
  it('parses wildcard', () => {
    const result = parseField('*', 0, 5);
    expect(result).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it('parses single value', () => {
    expect(parseField('3', 0, 59)).toEqual(new Set([3]));
  });

  it('parses range', () => {
    expect(parseField('2-5', 0, 59)).toEqual(new Set([2, 3, 4, 5]));
  });

  it('parses list', () => {
    expect(parseField('1,3,5', 0, 59)).toEqual(new Set([1, 3, 5]));
  });

  it('parses step on wildcard', () => {
    const result = parseField('*/15', 0, 59);
    expect(result).toEqual(new Set([0, 15, 30, 45]));
  });

  it('parses step on range', () => {
    const result = parseField('10-20/5', 0, 59);
    expect(result).toEqual(new Set([10, 15, 20]));
  });

  it('parses combined list and range', () => {
    const result = parseField('1,10-12', 0, 59);
    expect(result).toEqual(new Set([1, 10, 11, 12]));
  });

  it('handles min = max single value range', () => {
    expect(parseField('*', 5, 5)).toEqual(new Set([5]));
  });

  it('handles step larger than range', () => {
    const result = parseField('*/60', 0, 59);
    expect(result).toEqual(new Set([0]));
  });

  it('returns empty set for step=0 (prevents infinite loop)', () => {
    const result = parseField('*/0', 0, 59);
    expect(result).toEqual(new Set());
  });

  it('returns empty set for step=0 on range', () => {
    const result = parseField('1-10/0', 0, 59);
    expect(result).toEqual(new Set());
  });

  it('clamps out-of-range start value to min', () => {
    // Value below min gets clamped
    const result = parseField('0', 1, 31);
    expect(result).toEqual(new Set([1]));
  });

  it('clamps out-of-range end value to max', () => {
    // Range end above max gets clamped
    const result = parseField('55-65', 0, 59);
    expect(result).toEqual(new Set([55, 56, 57, 58, 59]));
  });

  it('still processes other parts when one part has step=0', () => {
    const result = parseField('*/0,5', 0, 59);
    expect(result).toEqual(new Set([5]));
  });
});

// ── matchesCron ─────────────────────────────────────────────────────────

describe('matchesCron', () => {
  it('matches every minute', () => {
    const date = new Date(2026, 1, 15, 10, 30); // Feb 15 2026 10:30 (Sunday)
    expect(matchesCron('* * * * *', date)).toBe(true);
  });

  it('matches specific minute and hour', () => {
    const date = new Date(2026, 1, 15, 9, 0);
    expect(matchesCron('0 9 * * *', date)).toBe(true);
  });

  it('rejects non-matching minute', () => {
    const date = new Date(2026, 1, 15, 9, 5);
    expect(matchesCron('0 9 * * *', date)).toBe(false);
  });

  it('matches day of month', () => {
    const date = new Date(2026, 0, 1, 0, 0); // Jan 1
    expect(matchesCron('0 0 1 * *', date)).toBe(true);
  });

  it('rejects wrong day of month', () => {
    const date = new Date(2026, 0, 2, 0, 0); // Jan 2
    expect(matchesCron('0 0 1 * *', date)).toBe(false);
  });

  it('matches month', () => {
    const date = new Date(2026, 5, 15, 10, 0); // June
    expect(matchesCron('0 10 * 6 *', date)).toBe(true);
  });

  it('rejects wrong month', () => {
    const date = new Date(2026, 4, 15, 10, 0); // May
    expect(matchesCron('0 10 * 6 *', date)).toBe(false);
  });

  it('matches day of week (0=Sunday)', () => {
    const date = new Date(2026, 1, 15, 0, 0); // Feb 15 2026 is Sunday
    expect(matchesCron('0 0 * * 0', date)).toBe(true);
  });

  it('matches weekdays (1-5)', () => {
    const date = new Date(2026, 1, 16, 9, 0); // Feb 16 2026 is Monday
    expect(matchesCron('0 9 * * 1-5', date)).toBe(true);
  });

  it('rejects weekend on weekday filter', () => {
    const date = new Date(2026, 1, 15, 9, 0); // Feb 15 2026 is Sunday
    expect(matchesCron('0 9 * * 1-5', date)).toBe(false);
  });

  it('matches step pattern */5 for minutes', () => {
    const date = new Date(2026, 1, 15, 10, 15);
    expect(matchesCron('*/5 * * * *', date)).toBe(true);
  });

  it('rejects non-step minute', () => {
    const date = new Date(2026, 1, 15, 10, 13);
    expect(matchesCron('*/5 * * * *', date)).toBe(false);
  });

  it('returns false for invalid expression (wrong field count)', () => {
    const date = new Date();
    expect(matchesCron('* * *', date)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(matchesCron('', new Date())).toBe(false);
  });

  it('does not hang on */0 expression (step=0 guard)', () => {
    const date = new Date(2026, 1, 15, 10, 30);
    // This should return false (empty minute set), not hang
    expect(matchesCron('*/0 * * * *', date)).toBe(false);
  });
});

// ── describeSchedule ────────────────────────────────────────────────────

describe('describeSchedule', () => {
  it('describes known presets by label', () => {
    expect(describeSchedule('*/5 * * * *')).toBe('Every 5 min');
    expect(describeSchedule('0 * * * *')).toBe('Every hour');
    expect(describeSchedule('0 6 * * *')).toBe('Daily at 6 AM');
  });

  it('describes every N minutes pattern', () => {
    expect(describeSchedule('*/3 * * * *')).toBe('Every 3 minutes');
  });

  it('describes hourly at specific minute', () => {
    expect(describeSchedule('15 * * * *')).toBe('Every hour at :15');
  });

  it('describes daily at specific time (AM)', () => {
    expect(describeSchedule('30 8 * * *')).toBe('At 8:30 AM');
  });

  it('describes daily at specific time (PM)', () => {
    expect(describeSchedule('0 14 * * *')).toBe('At 2:00 PM');
  });

  it('describes daily at midnight', () => {
    expect(describeSchedule('0 0 * * *')).toBe('At 12:00 AM');
  });

  it('describes weekday schedule', () => {
    expect(describeSchedule('0 9 * * 1-5')).toBe('At 9:00 AM, Monday through Friday');
  });

  it('describes specific day of week at time', () => {
    expect(describeSchedule('0 9 * * 1')).toBe('Every Monday');
    expect(describeSchedule('0 12 * * 6')).toBe('Saturday at noon');
    expect(describeSchedule('0 15 * * 0')).toBe('At 3:00 PM, Sunday');
  });

  it('describes every N hours pattern', () => {
    expect(describeSchedule('0 */2 * * *')).toBe('Every 2 hours');
    expect(describeSchedule('0 */6 * * *')).toBe('Every 6 hours');
  });

  // ── Rich description tests ──

  it('describes hour range with weekdays', () => {
    expect(describeSchedule('0 6-20 * * 1-5')).toBe('Every hour from 6 AM to 8 PM at :00, Monday through Friday');
  });

  it('describes every N minutes during hour range', () => {
    expect(describeSchedule('*/15 9-17 * * *')).toBe('Every 15 minutes from 9 AM to 5 PM');
  });

  it('describes every N minutes during hour range on weekdays', () => {
    expect(describeSchedule('*/30 8-18 * * 1-5')).toBe('Every 30 minutes from 8 AM to 6 PM, Monday through Friday');
  });

  it('describes specific time on specific day-of-month', () => {
    expect(describeSchedule('0 9 1 * *')).toBe('At 9:00 AM, on the 1st');
  });

  it('describes specific time in specific month', () => {
    expect(describeSchedule('0 9 * 6 *')).toBe('At 9:00 AM, in June');
  });

  it('describes weekend days', () => {
    expect(describeSchedule('0 10 * * 0,6')).toBe('At 10:00 AM, Saturday and Sunday');
  });

  it('describes day range (Tuesday through Thursday)', () => {
    expect(describeSchedule('0 12 * * 2-4')).toBe('At 12:00 PM, Tuesday through Thursday');
  });

  it('describes specific day-of-month ordinal suffixes', () => {
    expect(describeSchedule('0 8 2 * *')).toBe('At 8:00 AM, on the 2nd');
    expect(describeSchedule('0 8 3 * *')).toBe('At 8:00 AM, on the 3rd');
    expect(describeSchedule('0 8 4 * *')).toBe('At 8:00 AM, on the 4th');
    expect(describeSchedule('0 8 21 * *')).toBe('At 8:00 AM, on the 21st');
    expect(describeSchedule('0 8 22 * *')).toBe('At 8:00 AM, on the 22nd');
    expect(describeSchedule('0 8 23 * *')).toBe('At 8:00 AM, on the 23rd');
    expect(describeSchedule('0 8 31 * *')).toBe('At 8:00 AM, on the 31st');
  });

  it('describes month range', () => {
    expect(describeSchedule('0 9 * 3-5 *')).toBe('At 9:00 AM, March through May');
  });

  it('describes every minute', () => {
    expect(describeSchedule('* * * * *')).toBe('Every minute');
  });

  it('describes complex: specific time, day-of-month, and month', () => {
    expect(describeSchedule('0 9 15 6 *')).toBe('At 9:00 AM, on the 15th, in June');
  });

  it('returns raw expression for invalid field count', () => {
    expect(describeSchedule('foo')).toBe('foo');
  });
});

// ── validateCronExpression ──────────────────────────────────────────────

describe('validateCronExpression', () => {
  it('returns null for valid expressions', () => {
    expect(validateCronExpression('* * * * *')).toBeNull();
    expect(validateCronExpression('0 9 * * *')).toBeNull();
    expect(validateCronExpression('*/5 * * * *')).toBeNull();
    expect(validateCronExpression('0 9 * * 1-5')).toBeNull();
    expect(validateCronExpression('0,30 9 1,15 * *')).toBeNull();
  });

  it('rejects wrong field count', () => {
    expect(validateCronExpression('* * *')).toContain('Expected 5 fields');
    expect(validateCronExpression('* * * * * *')).toContain('Expected 5 fields');
  });

  it('rejects step=0', () => {
    const err = validateCronExpression('*/0 * * * *');
    expect(err).toContain('step value 0');
  });

  it('rejects step=0 in any field', () => {
    expect(validateCronExpression('* */0 * * *')).toContain('step value 0');
    expect(validateCronExpression('* * */0 * *')).toContain('step value 0');
  });

  it('rejects out-of-range values', () => {
    expect(validateCronExpression('60 * * * *')).toContain('out of range');
    expect(validateCronExpression('* 24 * * *')).toContain('out of range');
    expect(validateCronExpression('* * 0 * *')).toContain('out of range');
    expect(validateCronExpression('* * * 13 *')).toContain('out of range');
    expect(validateCronExpression('* * * * 7')).toContain('out of range');
  });

  it('rejects non-numeric values', () => {
    expect(validateCronExpression('abc * * * *')).toContain('Non-numeric');
  });

  it('rejects range where start > end', () => {
    expect(validateCronExpression('5-2 * * * *')).toContain('start > end');
  });

  it('validates all preset expressions', () => {
    for (const p of PRESETS) {
      expect(validateCronExpression(p.value)).toBeNull();
    }
  });
});

// ── PRESETS ─────────────────────────────────────────────────────────────

describe('PRESETS', () => {
  it('is a non-empty array', () => {
    expect(PRESETS.length).toBeGreaterThan(0);
  });

  it('each preset has label and value', () => {
    for (const p of PRESETS) {
      expect(typeof p.label).toBe('string');
      expect(typeof p.value).toBe('string');
    }
  });

  it('each preset value is a valid 5-field cron expression', () => {
    for (const p of PRESETS) {
      const fields = p.value.trim().split(/\s+/);
      expect(fields).toHaveLength(5);
    }
  });

  it('has no duplicate values', () => {
    const values = PRESETS.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
