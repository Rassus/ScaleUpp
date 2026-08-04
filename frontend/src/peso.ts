/** Unidades de peso sólido (se manejan en gramos en la UI). */
export function esPesoSolido(sigla: string): boolean {
  const s = sigla.toUpperCase();
  return s === "KG" || s === "G" || s === "GR";
}

/** Volumen u otras unidades con cantidad decimal. */
export function esPesoVariable(sigla: string): boolean {
  const s = sigla.toUpperCase();
  return esPesoSolido(s) || s === "L" || s === "ML";
}

/** Convierte la cantidad en unidad del producto → gramos. */
export function cantidadAGramos(cantidad: number, sigla: string): number {
  const s = sigla.toUpperCase();
  if (s === "KG") return Math.round(cantidad * 1000);
  return Math.round(cantidad);
}

/** Convierte gramos → cantidad en unidad del producto. */
export function gramosACantidad(gramos: number, sigla: string): number {
  const g = Math.round(gramos);
  const s = sigla.toUpperCase();
  if (s === "KG") return g / 1000;
  return g;
}

/**
 * Muestra peso en gramos; si llega a 1000 g o más, en kg.
 * `cantidad` está en la unidad del producto (KG o G).
 */
export function formatPeso(cantidad: number, sigla: string): string {
  const g = cantidadAGramos(cantidad, sigla);
  if (g >= 1000) {
    const kg = g / 1000;
    return `${kg.toLocaleString("es-CL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })}\u00A0kg`;
  }
  return `${g.toLocaleString("es-CL")}\u00A0g`;
}

/** Paso de ± en unidad del producto (10 g). */
export function pasoPeso(sigla: string): number {
  return gramosACantidad(10, sigla);
}

/** Mínimo en unidad del producto (1 g). */
export function minPeso(sigla: string): number {
  return gramosACantidad(1, sigla);
}

/** Precio CLP redondeado según gramos y precio unitario del producto. */
export function precioDesdeGramos(
  gramos: number,
  sigla: string,
  precioUnitario: number,
): number {
  if (!Number.isFinite(gramos) || gramos <= 0 || precioUnitario <= 0) return 0;
  const qty = gramosACantidad(gramos, sigla);
  return Math.round(qty * precioUnitario);
}

/**
 * Gramos equivalentes a un precio cobrado (inverso de precioDesdeGramos).
 * Redondea al gramo más cercano.
 */
export function gramosDesdePrecio(
  precio: number,
  sigla: string,
  precioUnitario: number,
): number {
  if (!Number.isFinite(precio) || precio <= 0 || precioUnitario <= 0) return 0;
  const qty = precio / precioUnitario;
  return cantidadAGramos(qty, sigla);
}

/** Caja: se modela como KIT/BOM sobre un producto base. */
export function esUnidadCaja(sigla: string): boolean {
  const s = sigla.toUpperCase();
  return s === "CJ" || s === "CAJA";
}
