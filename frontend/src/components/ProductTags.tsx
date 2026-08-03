import "./ProductTags.css";

export type ProductTagKind =
  | "Combo"
  | "Sin stock"
  | "Bajo stock"
  | "Por caducar"
  | "Caducado";

export type ProductTagInput = {
  tipo?: string | null;
  /** Stock actual. Si es 0 o menos → Sin stock. */
  stock?: number | null;
  /** Desde resumen de stock / KPIs. Solo aplica si hay stock. */
  alertaBajoStock?: boolean;
  /**
   * Días hasta la caducidad más cercana (lotes con stock).
   * < 0 = Caducado; >= 0 y conocido = Por caducar (ya filtrado por umbral en backend).
   * null/undefined = sin info de caducidad.
   */
  diasCaducidad?: number | null;
};

const TAG_CLASS: Record<ProductTagKind, string> = {
  Combo: "is-combo",
  "Sin stock": "is-sin-stock",
  "Bajo stock": "is-bajo-stock",
  "Por caducar": "is-por-caducar",
  Caducado: "is-caducado",
};

export function buildProductTags(input: ProductTagInput): ProductTagKind[] {
  const tags: ProductTagKind[] = [];
  if ((input.tipo ?? "").toUpperCase() === "KIT") tags.push("Combo");

  const stock =
    input.stock == null || Number.isNaN(Number(input.stock))
      ? null
      : Number(input.stock);

  if (stock != null && stock <= 0) {
    tags.push("Sin stock");
  } else if (input.alertaBajoStock && (stock == null || stock > 0)) {
    tags.push("Bajo stock");
  }

  if (input.diasCaducidad != null && Number.isFinite(input.diasCaducidad)) {
    if (input.diasCaducidad < 0) tags.push("Caducado");
    else tags.push("Por caducar");
  }

  return tags;
}

export default function ProductTags({
  tipo,
  stock,
  alertaBajoStock,
  diasCaducidad,
  className,
}: ProductTagInput & { className?: string }) {
  const tags = buildProductTags({
    tipo,
    stock,
    alertaBajoStock,
    diasCaducidad,
  });
  if (tags.length === 0) return null;
  return (
    <span className={`prod-tags${className ? ` ${className}` : ""}`}>
      {tags.map((t) => (
        <span key={t} className={`prod-tag ${TAG_CLASS[t]}`}>
          {t}
        </span>
      ))}
    </span>
  );
}
