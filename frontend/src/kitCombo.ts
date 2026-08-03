/** Detección de combos/kits a partir de líneas simples del carrito. */

export type KitBom = {
  kitId: number;
  nombre: string;
  precioVenta: number;
  componentes: { productoId: number; cantidad: number }[];
};

export type ComboSugerencia = {
  kitId: number;
  nombre: string;
  nKits: number;
  precioKitUnit: number;
  totalCombo: number;
  totalComponentes: number;
  ahorro: number;
  consume: { productoId: number; cantidad: number }[];
};

type CartLike = {
  producto_id: number;
  tipo: string;
  cantidad: number;
  precio_unitario: number;
};

function floorKits(qtyCart: number, need: number): number {
  if (need <= 0) return 0;
  return Math.floor((qtyCart + 1e-9) / need);
}

/** Cuántos kits se pueden armar con las líneas SIMPLE del carrito. */
export function detectarCombos(
  lineas: CartLike[],
  boms: KitBom[],
): ComboSugerencia[] {
  const qty = new Map<number, number>();
  const precio = new Map<number, number>();
  for (const l of lineas) {
    if ((l.tipo ?? "").toUpperCase() === "KIT") continue;
    qty.set(l.producto_id, (qty.get(l.producto_id) ?? 0) + Number(l.cantidad));
    precio.set(l.producto_id, l.precio_unitario);
  }

  const out: ComboSugerencia[] = [];
  for (const bom of boms) {
    if (!bom.componentes.length) continue;
    let nKits = Infinity;
    for (const c of bom.componentes) {
      const have = qty.get(c.productoId) ?? 0;
      nKits = Math.min(nKits, floorKits(have, c.cantidad));
    }
    if (!Number.isFinite(nKits) || nKits < 1) continue;

    const n = Math.floor(nKits);
    const consume = bom.componentes.map((c) => ({
      productoId: c.productoId,
      cantidad: Math.round(c.cantidad * n * 1000) / 1000,
    }));
    let totalComponentes = 0;
    for (const c of bom.componentes) {
      const p = precio.get(c.productoId) ?? 0;
      totalComponentes += Math.round(p * c.cantidad * n);
    }
    const totalCombo = bom.precioVenta * n;
    out.push({
      kitId: bom.kitId,
      nombre: bom.nombre,
      nKits: n,
      precioKitUnit: bom.precioVenta,
      totalCombo,
      totalComponentes,
      ahorro: totalComponentes - totalCombo,
      consume,
    });
  }

  return out.sort(
    (a, b) => b.ahorro - a.ahorro || b.nKits - a.nKits || a.nombre.localeCompare(b.nombre),
  );
}

/** Resta componentes y agrega (o suma) la línea del kit. */
export function aplicarComboEnCarrito<T extends CartLike>(
  lineas: T[],
  sug: ComboSugerencia,
  kitLine: T,
): T[] {
  const restar = new Map(sug.consume.map((c) => [c.productoId, c.cantidad]));
  const next: T[] = [];
  for (const l of lineas) {
    const take = restar.get(l.producto_id);
    if (take == null || (l.tipo ?? "").toUpperCase() === "KIT") {
      next.push(l);
      continue;
    }
    const left = Math.round((l.cantidad - take) * 1000) / 1000;
    restar.delete(l.producto_id);
    if (left > 1e-9) {
      next.push({ ...l, cantidad: left });
    }
  }

  const existing = next.find((l) => l.producto_id === sug.kitId);
  if (existing) {
    return next.map((l) =>
      l.producto_id === sug.kitId
        ? { ...l, cantidad: Math.round((l.cantidad + sug.nKits) * 1000) / 1000 }
        : l,
    );
  }
  return [...next, { ...kitLine, cantidad: sug.nKits }];
}
