/**
 * Generates a ticket number in the format TKT-YYYY-NNNNN
 * e.g. TKT-2026-00142
 */
export function generateTicketNumber(sequenceValue: number): string {
  const year = new Date().getFullYear();
  const padded = String(sequenceValue).padStart(5, '0');
  return `TKT-${year}-${padded}`;
}
