
let yearlyCounters: Record<string, number> = {};

export function generateSequentialOrderNumber(): string {
  const year = new Date().getFullYear().toString();

  if (!yearlyCounters[year]) {
    yearlyCounters[year] = 0;
  }

  yearlyCounters[year] += 1;

  const padded = yearlyCounters[year].toString().padStart(4, "0");

  return `TH-${year}-${padded}`;
}
