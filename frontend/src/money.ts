/** Formato de moneda CLP con separador de miles. */
export function formatClp(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CL")}`;
}

export function formatClpLabel(value: number): string {
  return `${formatClp(value)} CLP`;
}
