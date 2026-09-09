export type PayrollPeriodMode = 'MES' | '1Q' | '2Q' | 'HISTORICO';

export const PAYROLL_MONTHS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
] as const;

export const LAST_CLOSED_PAYROLL_PERIOD = {
  year: 2026,
  monthIndex: 7
} as const;

export const LAST_CLOSED_PAYROLL_PERIOD_LABEL =
  `${PAYROLL_MONTHS[LAST_CLOSED_PAYROLL_PERIOD.monthIndex]} ${LAST_CLOSED_PAYROLL_PERIOD.year}`;

export function parsePayrollDate(dateStr: string | null | undefined): Date | null {
  const match = dateStr?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) return null;

  return date;
}

export function addPayrollDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function getPayrollDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

// Algoritmo gregoriano de Meeus/Jones/Butcher para obtener Pascua.
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getTransferredHoliday(year: number, monthIndex: number, day: number): Date {
  const holiday = new Date(year, monthIndex, day);
  const weekday = holiday.getDay();

  // Ley 27.399: martes/miércoles pasan al lunes anterior; jueves/viernes,
  // al lunes siguiente. Los traslados de sábado/domingo requieren una
  // resolución anual, por lo que no se infieren automáticamente.
  if (weekday === 2 || weekday === 3) return addPayrollDays(holiday, -(weekday - 1));
  if (weekday === 4 || weekday === 5) return addPayrollDays(holiday, 8 - weekday);
  return holiday;
}

const holidayCache = new Map<number, Set<string>>();
const OFFICIAL_WEEKEND_TRANSFERS: Record<number, string[]> = {
  // Resolución 139/2025: el 12 de octubre de 2025 pasó al viernes 10.
  2025: ['2025-10-10']
};

function getPayrollNonBusinessDayKeys(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easterSunday = getEasterSunday(year);
  // Se incluyen feriados nacionales obligatorios y el día UOCRA. Los días
  // turísticos/Jueves Santo no se excluyen porque, para empleadores privados,
  // su descanso depende de la decisión empresarial.
  const holidays = [
    new Date(year, 0, 1),
    addPayrollDays(easterSunday, -48),
    addPayrollDays(easterSunday, -47),
    new Date(year, 2, 24),
    addPayrollDays(easterSunday, -2),
    new Date(year, 3, 2),
    // CCT UOCRA 76/75, art. 19: Día de los Obreros de la Construcción.
    new Date(year, 3, 22),
    new Date(year, 4, 1),
    new Date(year, 4, 25),
    getTransferredHoliday(year, 5, 17),
    new Date(year, 5, 20),
    new Date(year, 6, 9),
    getTransferredHoliday(year, 7, 17),
    getTransferredHoliday(year, 9, 12),
    getTransferredHoliday(year, 10, 20),
    new Date(year, 11, 8),
    new Date(year, 11, 25)
  ];

  const keys = new Set([
    ...holidays.map(getPayrollDateKey),
    ...(OFFICIAL_WEEKEND_TRANSFERS[year] || [])
  ]);
  holidayCache.set(year, keys);
  return keys;
}

export function isPayrollBusinessDay(date: Date): boolean {
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return false;
  return !getPayrollNonBusinessDayKeys(date.getFullYear()).has(getPayrollDateKey(date));
}

export function countPayrollBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor <= end) {
    if (isPayrollBusinessDay(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function isAfterLastClosedPayrollPeriod(year: number, monthName: string): boolean {
  const monthIndex = PAYROLL_MONTHS.indexOf(monthName as typeof PAYROLL_MONTHS[number]);
  if (monthIndex < 0) return false;

  return year > LAST_CLOSED_PAYROLL_PERIOD.year ||
    (year === LAST_CLOSED_PAYROLL_PERIOD.year && monthIndex > LAST_CLOSED_PAYROLL_PERIOD.monthIndex);
}

export function getPayrollPeriodBounds(
  year: number,
  monthName: string,
  mode: PayrollPeriodMode
): { start: Date; end: Date } {
  if (mode === 'HISTORICO') {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31)
    };
  }

  const index = PAYROLL_MONTHS.indexOf(monthName as typeof PAYROLL_MONTHS[number]);
  const monthIndex = index >= 0 ? index : 0;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const startDay = mode === '2Q' ? 16 : 1;
  const endDay = mode === '1Q' ? Math.min(15, lastDay) : lastDay;

  return {
    start: new Date(year, monthIndex, startDay),
    end: new Date(year, monthIndex, endDay)
  };
}
