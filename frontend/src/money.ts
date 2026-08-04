/** Formato de moneda CLP con separador de miles. */
export function formatClp(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CL")}`;
}

export function formatClpLabel(value: number): string {
  return `${formatClp(value)} CLP`;
}

/**
 * Redondeo chileno a múltiplo de $10 para cobro en efectivo.
 * Dígito final 0–4 → abajo; 5–9 → arriba.
 */
export function redondearEfectivo(monto: number): number {
  const n = Math.round(monto);
  if (!Number.isFinite(n)) return 0;
  const signo = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const resto = abs % 10;
  if (resto === 0) return n;
  const rounded = resto >= 5 ? abs + (10 - resto) : abs - resto;
  return signo * rounded;
}
