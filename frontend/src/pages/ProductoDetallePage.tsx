import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import ProductTags from "../components/ProductTags";
import { useHardwareBack } from "../hooks/useHardwareBack";
import { formatClp as formatMoney } from "../money";
import { esUnidadCaja } from "../peso";
import type { ProductoFormValues } from "./ProductosPage";
import "./DashboardPage.css";
import "./ProductoDetallePage.css";

export type DetalleProducto = {
  id: number;
  nombre: string;
  codigo_barras: string | null;
  precio_venta: number;
  tipo: string;
  unidad_medida_id: number;
  categoria_id: number | null;
  controla_caducidad: boolean;
  imagen_base64?: string | null;
};

export type DetalleUnidad = { id: number; nombre: string; sigla: string };
export type DetalleCategoria = { id: number; nombre: string };

export type DetalleLote = {
  id: number;
  cantidad_inicial?: string | number;
  cantidad_actual: string | number;
  cantidad_vendida?: string | number;
  cantidad_merma?: string | number;
  fecha_caducidad: string | null;
  fecha_ingreso: string;
  activo: boolean;
  precio_costo_neto?: number;
  costo_operacion_prorrateado?: number;
  costo_unitario_real?: number;
  iva_porcentaje?: number | string;
};

export type DetalleVentaItem = {
  producto_id?: number;
  producto_nombre?: string;
  cantidad: string | number;
  subtotal: number;
};

export type DetalleVenta = {
  fecha_hora: string;
  anulada?: boolean;
  items?: DetalleVentaItem[];
};

export const MERMA_MOTIVOS = [
  "Venció / caducado",
  "Se rompió",
  "Se abrió",
  "Dañado / mal estado",
  "Robo / hurto",
  "Error de inventario",
  "Contaminado / no apto",
  "Otro",
] as const;

type ProductoDetallePageProps = {
  producto: DetalleProducto;
  stock: number;
  alertaBajoStock?: boolean;
  diasCaducidadAlerta?: number;
  ingresosVisibles?: number;
  imagen: string | null;
  lotes: DetalleLote[];
  ventas?: DetalleVenta[];
  unidades: DetalleUnidad[];
  categorias: DetalleCategoria[];
  /** Productos SIMPLE disponibles como base de una caja (CJ). */
  productosBase?: Array<{ id: number; nombre: string }>;
  loading: boolean;
  error: string | null;
  canWrite: boolean;
  saving: boolean;
  savingProducto?: boolean;
  onOpenMenu: () => void;
  onBack: () => void;
  onUpdateProducto?: (values: ProductoFormValues) => Promise<void> | void;
  onRegistrarEntrada: (data: {
    cantidad: string;
    costo: string;
    costoOp: string;
    fechaCaducidad: string;
  }) => Promise<void> | void;
  onRegistrarMerma: (data: {
    cantidad: string;
    motivo: string;
  }) => Promise<void> | void;
  historialPrecios?: Array<{
    id: number;
    producto_id: number;
    producto_nombre: string;
    precio_anterior: number;
    precio_nuevo: number;
    usuario_nombre?: string | null;
    fecha_hora: string;
  }>;
  loadingHistorialPrecios?: boolean;
};

function formatUnidades(n: number): string {
  return n.toLocaleString("es-CL");
}

function formatCaducidad(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatIngreso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dayKeyFromIso(iso: string): string {
  if (!iso) return "";
  if (iso.length >= 10) return iso.slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function diasHasta(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(12, 0, 0, 0);
  return Math.ceil((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function dayKey(fechaHora: string): string {
  return fechaHora.slice(0, 10);
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcIngresoMetrics(lote: DetalleLote, precioVenta: number) {
  const inicial = Number(lote.cantidad_inicial ?? lote.cantidad_actual) || 0;
  const actual = Number(lote.cantidad_actual) || 0;
  const vendidos = Number(lote.cantidad_vendida ?? 0) || 0;
  const merma = Number(lote.cantidad_merma ?? 0) || 0;
  const costoNeto = Math.round(lote.precio_costo_neto ?? 0);
  const costoExtra = Math.round(lote.costo_operacion_prorrateado ?? 0);
  const costoFinal = costoNeto + costoExtra;
  const ivaPct = Number(lote.iva_porcentaje ?? 19) || 19;
  const costoFinalIva = Math.round(costoFinal * (1 + ivaPct / 100));
  const precioVentaNeto = Math.round(precioVenta / (1 + ivaPct / 100));
  const gananciaNeta = precioVentaNeto - costoFinal;
  const gananciaIva = precioVenta - costoFinalIva;
  const margenPct =
    costoFinal > 0
      ? Math.round(((precioVenta - costoFinal) / costoFinal) * 1000) / 10
      : null;
  return {
    inicial,
    actual,
    vendidos,
    merma,
    costoNeto,
    costoExtra,
    costoFinal,
    ivaPct,
    costoFinalIva,
    gananciaNeta,
    gananciaIva,
    margenPct,
  };
}

function MiniBarChart({
  bars,
  color,
  formatValue,
  emptyLabel,
}: {
  bars: { label: string; value: number; title?: string }[];
  color: string;
  formatValue?: (n: number) => string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const hasData = bars.some((b) => b.value > 0);
  if (!hasData) {
    return <p className="pdet-muted">{emptyLabel}</p>;
  }
  const fmt = formatValue ?? ((n: number) => String(n));
  return (
    <div className="pdet-bars" role="img">
      {bars.map((b, i) => (
        <div key={`${b.label}-${i}`} className="pdet-bar-group">
          <span className="pdet-bar-value">{fmt(b.value)}</span>
          <div className="pdet-bar-track">
            <span
              className="pdet-bar"
              style={{
                height: `${Math.max(b.value > 0 ? 8 : 2, (b.value / max) * 100)}%`,
                background: color,
              }}
              title={b.title ?? `${b.label}: ${fmt(b.value)}`}
            />
          </div>
          <span className="pdet-bar-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function IngresoCard({
  lote,
  precioVenta,
  diasCaducidadAlerta,
  expanded,
  onToggle,
  fifoTag,
}: {
  lote: DetalleLote;
  precioVenta: number;
  diasCaducidadAlerta: number;
  expanded: boolean;
  onToggle: () => void;
  fifoTag?: boolean;
}) {
  const m = calcIngresoMetrics(lote, precioVenta);
  const dias = diasHasta(lote.fecha_caducidad);
  const alerta =
    dias != null && dias <= diasCaducidadAlerta && m.actual > 0;
  const venceLabel = lote.fecha_caducidad
    ? formatCaducidad(lote.fecha_caducidad)
    : null;

  return (
    <li className={`pdet-ingreso${expanded ? " is-open" : ""}${fifoTag ? " is-next" : ""}`}>
      <button
        type="button"
        className="pdet-ingreso-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="pdet-ingreso-summary">
          {fifoTag && <em className="pdet-fifo-tag">Siguiente a vender</em>}
          <strong>Ingreso {formatIngreso(lote.fecha_ingreso)}</strong>
          <span>
            {formatUnidades(m.inicial)} u. · Costo final {formatMoney(m.costoFinal)}
            {m.actual > 0 ? ` · quedan ${formatUnidades(m.actual)}` : ""}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          className={expanded ? "is-open" : undefined}
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="pdet-ingreso-detail">
          <p>
            Ingreso: <strong>{formatIngreso(lote.fecha_ingreso)}</strong>
          </p>
          {venceLabel && (
            <p>
              Vence: <strong>{venceLabel}</strong>
              {dias != null ? ` (${dias} d)` : ""}
              {alerta ? " · alerta" : ""}
            </p>
          )}
          <p>
            Cantidad: <strong>{formatUnidades(m.inicial)}</strong>
            {m.inicial !== m.actual
              ? ` (quedan ${formatUnidades(m.actual)})`
              : ""}
          </p>
          {(m.vendidos > 0 || m.merma > 0) && (
            <p>
              Movimiento:{" "}
              <strong>
                {formatUnidades(m.vendidos)} vendidos
                {m.merma > 0 ? ` / ${formatUnidades(m.merma)} merma` : ""}
              </strong>
            </p>
          )}
          <p>
            Costo neto: <strong>{formatMoney(m.costoNeto)}</strong>
          </p>
          <p>
            Costo extra: <strong>{formatMoney(m.costoExtra)}</strong>
          </p>
          <p>
            Costo final: <strong>{formatMoney(m.costoFinal)}</strong>
          </p>
          <p>
            Costo final + IVA ({m.ivaPct}%):{" "}
            <strong>{formatMoney(m.costoFinalIva)}</strong>
          </p>
          <p>
            Ganancia neta: <strong>{formatMoney(m.gananciaNeta)}</strong>
          </p>
          <p>
            Ganancia IVA: <strong>{formatMoney(m.gananciaIva)}</strong>
          </p>
          {m.margenPct != null && (
            <p>
              Margen s/ costo:{" "}
              <strong>
                {m.margenPct > 0 ? "+" : ""}
                {m.margenPct}%
              </strong>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function ProductoDetallePage({
  producto,
  stock,
  alertaBajoStock = false,
  diasCaducidadAlerta = 30,
  ingresosVisibles = 3,
  imagen,
  lotes,
  ventas = [],
  unidades,
  categorias,
  productosBase = [],
  loading,
  error,
  canWrite,
  saving,
  savingProducto = false,
  onOpenMenu,
  onBack,
  onUpdateProducto,
  onRegistrarEntrada,
  onRegistrarMerma,
  historialPrecios = [],
  loadingHistorialPrecios = false,
}: ProductoDetallePageProps) {
  const [gestionarOpen, setGestionarOpen] = useState(false);
  const [mermaOpen, setMermaOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<ProductoFormValues>({
    nombre: producto.nombre,
    codigo_barras: producto.codigo_barras ?? "",
    precio_venta: String(producto.precio_venta),
    unidad_medida_id: producto.unidad_medida_id,
    categoria_id: producto.categoria_id ?? "",
    controla_caducidad: producto.controla_caducidad,
    tipo: producto.tipo === "KIT" ? "KIT" : "SIMPLE",
    imagen_data: imagen,
    producto_base_id: "",
    cantidad_base: "12",
  });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [cantidad, setCantidad] = useState("10");
  const [costo, setCosto] = useState("500");
  const [costoEsTotal, setCostoEsTotal] = useState(false);
  const [costoOp, setCostoOp] = useState("0");
  const [fechaCaducidad, setFechaCaducidad] = useState("");
  const [mermaCantidad, setMermaCantidad] = useState("1");
  const [motivoKey, setMotivoKey] =
    useState<(typeof MERMA_MOTIVOS)[number]>("Venció / caducado");
  const [motivoOtro, setMotivoOtro] = useState("");

  useHardwareBack(
    useCallback(() => {
      if (editOpen) {
        setEditOpen(false);
        return true;
      }
      if (mermaOpen) {
        setMermaOpen(false);
        return true;
      }
      if (gestionarOpen) {
        setGestionarOpen(false);
        return true;
      }
      if (historialOpen) {
        setHistorialOpen(false);
        return true;
      }
      return false;
    }, [editOpen, mermaOpen, gestionarOpen, historialOpen]),
  );

  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState(todayIso);
  const [pageSize] = useState(10);
  const [pageVisible, setPageVisible] = useState(10);

  const diasCaducidadTag = useMemo(() => {
    let min: number | null = null;
    for (const lote of lotes) {
      if (Number(lote.cantidad_actual) <= 0) continue;
      const d = diasHasta(lote.fecha_caducidad);
      if (d == null) continue;
      if (min == null || d < min) min = d;
    }
    if (min == null) return null;
    if (min < 0) return min;
    if (min <= diasCaducidadAlerta) return min;
    return null;
  }, [lotes, diasCaducidadAlerta]);

  const lotesRecientes = useMemo(
    () =>
      [...lotes].sort((a, b) =>
        String(b.fecha_ingreso).localeCompare(String(a.fecha_ingreso)),
      ),
    [lotes],
  );

  const lotesPreview = useMemo(
    () => lotesRecientes.slice(0, Math.max(1, ingresosVisibles)),
    [lotesRecientes, ingresosVisibles],
  );

  const fifoNextId = useMemo(() => {
    const conStock = [...lotes]
      .filter((l) => Number(l.cantidad_actual) > 0)
      .sort((a, b) =>
        String(a.fecha_ingreso).localeCompare(String(b.fecha_ingreso)),
      );
    return conStock[0]?.id ?? null;
  }, [lotes]);

  const lotesFiltradosModal = useMemo(() => {
    const desde = filtroDesde.trim();
    const hasta = filtroHasta.trim() || todayIso();
    return lotesRecientes.filter((l) => {
      const key = dayKeyFromIso(l.fecha_ingreso);
      if (!key) return true;
      if (desde && key < desde) return false;
      if (hasta && key > hasta) return false;
      return true;
    });
  }, [lotesRecientes, filtroDesde, filtroHasta]);

  const lotesModalPage = useMemo(
    () => lotesFiltradosModal.slice(0, pageVisible),
    [lotesFiltradosModal, pageVisible],
  );

  const lotesParaPrecio = useMemo(
    () =>
      [...lotes].sort((a, b) =>
        String(a.fecha_ingreso).localeCompare(String(b.fecha_ingreso)),
      ),
    [lotes],
  );

  const ventasPorDiaBars = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const v of ventas) {
      if (v.anulada) continue;
      for (const it of v.items ?? []) {
        const match =
          it.producto_id === producto.id ||
          (it.producto_id == null && it.producto_nombre === producto.nombre);
        if (!match) continue;
        const k = dayKey(v.fecha_hora);
        byDay.set(k, (byDay.get(k) ?? 0) + Number(it.cantidad || 0));
      }
    }
    const keys = [...byDay.keys()].sort();
    const last = keys.slice(-14);
    return last.map((k) => {
      const d = new Date(`${k}T12:00:00`);
      const qty = byDay.get(k) ?? 0;
      return {
        label: d.toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "2-digit",
        }),
        value: qty,
        title: `${k}: ${qty.toLocaleString("es-CL")} uds`,
      };
    });
  }, [ventas, producto.id, producto.nombre]);

  const preciosLoteBars = useMemo(
    () =>
      lotesParaPrecio.map((l) => {
        const precio = l.costo_unitario_real ?? l.precio_costo_neto ?? 0;
        return {
          label: formatIngreso(l.fecha_ingreso).slice(0, 5),
          value: precio,
          title: `Ingreso ${formatIngreso(l.fecha_ingreso)} · ${formatMoney(precio)}`,
        };
      }),
    [lotesParaPrecio],
  );

  const puedeStock = canWrite && producto.tipo !== "KIT" && stock > 0;

  const costoRefStock = useMemo(() => {
    const activos = lotes.filter((l) => Number(l.cantidad_actual) > 0);
    if (activos.length === 0) return null;
    const fifo = [...activos].sort(
      (a, b) =>
        new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime(),
    )[0];
    return (
      fifo.costo_unitario_real ??
      (fifo.precio_costo_neto ?? 0) + (fifo.costo_operacion_prorrateado ?? 0)
    );
  }, [lotes]);

  const margenEditPct = useMemo(() => {
    const precio = Number(editForm.precio_venta);
    if (!costoRefStock || costoRefStock <= 0 || !Number.isFinite(precio)) {
      return null;
    }
    return Math.round(((precio - costoRefStock) / costoRefStock) * 1000) / 10;
  }, [editForm.precio_venta, costoRefStock]);

  const margenEntradaPct = useMemo(() => {
    const qty = Number(String(cantidad).replace(",", "."));
    const precioIngresado = Number(String(costo).replace(",", "."));
    const cOp = Number(String(costoOp).replace(",", ".")) || 0;
    if (
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(precioIngresado) ||
      precioIngresado < 0
    ) {
      return null;
    }
    const costoNetoUnit = costoEsTotal
      ? Math.round(precioIngresado / qty)
      : Math.round(precioIngresado);
    const costoUnit = costoNetoUnit + cOp / qty;
    if (costoUnit <= 0) return null;
    return (
      Math.round(((producto.precio_venta - costoUnit) / costoUnit) * 1000) / 10
    );
  }, [cantidad, costo, costoEsTotal, costoOp, producto.precio_venta]);

  const costoUnitarioCalculado = useMemo(() => {
    if (!costoEsTotal) return null;
    const qty = Number(String(cantidad).replace(",", "."));
    const precioIngresado = Number(String(costo).replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(precioIngresado)) {
      return null;
    }
    return Math.round(precioIngresado / qty);
  }, [cantidad, costo, costoEsTotal]);

  useEffect(() => {
    if (!editOpen) return;
    setEditForm({
      nombre: producto.nombre,
      codigo_barras: producto.codigo_barras ?? "",
      precio_venta: String(producto.precio_venta),
      unidad_medida_id: producto.unidad_medida_id,
      categoria_id: producto.categoria_id ?? "",
      controla_caducidad: producto.controla_caducidad,
      tipo: producto.tipo === "KIT" ? "KIT" : "SIMPLE",
      imagen_data: imagen ?? producto.imagen_base64 ?? null,
      producto_base_id: "",
      cantidad_base: "12",
    });
  }, [editOpen, producto, imagen]);

  function openEdit() {
    setEditOpen(true);
  }

  async function onPickImage(file: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : null;
      if (!raw) return;
      const img = new Image();
      img.onload = () => {
        const maxSide = 720;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setEditForm((f) => ({ ...f, imagen_data: raw }));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        setEditForm((f) => ({
          ...f,
          imagen_data: canvas.toDataURL("image/jpeg", 0.72),
        }));
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onUpdateProducto) return;
    await onUpdateProducto(editForm);
    setEditOpen(false);
  }

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openHistorial() {
    setFiltroDesde("");
    setFiltroHasta(todayIso());
    setPageVisible(pageSize);
    setHistorialOpen(true);
  }

  async function handleEntrada(e: FormEvent) {
    e.preventDefault();
    const qty = Number(String(cantidad).replace(",", "."));
    const precioIngresado = Number(String(costo).replace(",", "."));
    const costoNetoUnit =
      costoEsTotal && qty > 0
        ? Math.round(precioIngresado / qty)
        : Math.round(precioIngresado);
    await onRegistrarEntrada({
      cantidad,
      costo: String(costoNetoUnit),
      costoOp,
      fechaCaducidad,
    });
    setGestionarOpen(false);
    setCantidad("10");
    setCosto("500");
    setCostoEsTotal(false);
    setCostoOp("0");
    setFechaCaducidad("");
  }

  async function handleMerma(e: FormEvent) {
    e.preventDefault();
    const motivo =
      motivoKey === "Otro" ? motivoOtro.trim() || "Otro" : motivoKey;
    await onRegistrarMerma({
      cantidad: mermaCantidad,
      motivo,
    });
    setMermaOpen(false);
    setMermaCantidad("1");
    setMotivoKey("Venció / caducado");
    setMotivoOtro("");
  }

  return (
    <div className="pdet-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} onBack={onBack} gradientId="pdet-mark" />

      <main className="pdet-main">
        <div className="pdet-title-row">
          <h1 className="pdet-title">
            Detalle Producto: <span>{producto.nombre}</span>{" "}
            <ProductTags
              tipo={producto.tipo}
              stock={stock}
              alertaBajoStock={alertaBajoStock}
              diasCaducidad={diasCaducidadTag}
            />
          </h1>
          {canWrite && onUpdateProducto && (
            <button
              type="button"
              className="pdet-edit-btn"
              onClick={openEdit}
              aria-label="Editar producto"
              title="Editar producto"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                <path
                  d="M4 20h4l10-10-4-4L4 16v4z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path
                  d="M13 7l4 4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        <div className="pdet-image-card">
          {imagen ? (
            <img src={imagen} alt={producto.nombre} />
          ) : (
            <div className="pdet-image-fallback">
              {(producto.nombre.trim()[0] ?? "?").toUpperCase()}
            </div>
          )}
        </div>

        <section className="pdet-meta" aria-label="Precio y stock">
          <p className="pdet-price">
            Precio venta:{" "}
            <strong>{formatMoney(producto.precio_venta)}</strong>
          </p>
          <div className="pdet-stock">
            <span className="pdet-stock-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" />
                <path
                  d="M12 16V8m0 0l-3.5 3.5M12 8l3.5 3.5"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p>
              Stock Disponible:{" "}
              <strong>{formatUnidades(stock)} u.</strong>
            </p>
          </div>
        </section>

        {error && (
          <p className="pdet-error" role="alert">
            {error}
          </p>
        )}

        <section className="pdet-lotes" aria-label="Ingresos">
          <h2>Ingresos</h2>
          <p className="pdet-hint">
            Últimos {Math.max(1, ingresosVisibles)} ingresos (más recientes).
            Expande para ver costos y movimientos.
          </p>
          {loading ? (
            <p className="pdet-muted">Cargando ingresos…</p>
          ) : (
            <>
              <ul className="pdet-ingresos">
                {lotesPreview.map((lote) => (
                  <IngresoCard
                    key={lote.id}
                    lote={lote}
                    precioVenta={producto.precio_venta}
                    diasCaducidadAlerta={diasCaducidadAlerta}
                    expanded={expandedIds.has(lote.id)}
                    onToggle={() => toggleExpanded(lote.id)}
                    fifoTag={lote.id === fifoNextId}
                  />
                ))}
                {lotesPreview.length === 0 && (
                  <li className="pdet-empty">Sin ingresos registrados.</li>
                )}
              </ul>
              {lotesRecientes.length > lotesPreview.length ? (
                <button
                  type="button"
                  className="pdet-more-btn"
                  onClick={openHistorial}
                >
                  Mostrar más ({lotesRecientes.length - lotesPreview.length}{" "}
                  más)
                </button>
              ) : (
                lotesRecientes.length > 0 && (
                  <button
                    type="button"
                    className="pdet-more-btn is-ghost"
                    onClick={openHistorial}
                  >
                    Ver historial / filtrar
                  </button>
                )
              )}
            </>
          )}
        </section>

        <section className="pdet-chart-card" aria-label="Ventas por día">
          <h2>Ventas por día</h2>
          <p className="pdet-hint">Cantidad vendida por día (últimos con venta).</p>
          <MiniBarChart
            bars={ventasPorDiaBars}
            color="#0d9488"
            formatValue={(n) => n.toLocaleString("es-CL")}
            emptyLabel="Aún no hay ventas registradas de este producto."
          />
        </section>

        <section className="pdet-lotes" aria-label="Historial de precios">
          <h2>Historial de precios</h2>
          <p className="pdet-hint">
            Cada cambio de precio de venta de este producto.
          </p>
          {loadingHistorialPrecios ? (
            <p className="pdet-muted">Cargando historial…</p>
          ) : (
            <ul className="pdet-precio-list">
              {historialPrecios.map((h) => {
                const d = new Date(h.fecha_hora);
                const fecha = Number.isNaN(d.getTime())
                  ? h.fecha_hora.slice(0, 16)
                  : d.toLocaleString("es-CL", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                const delta = h.precio_nuevo - h.precio_anterior;
                return (
                  <li key={h.id} className="pdet-precio-row">
                    <div>
                      <strong>
                        {formatMoney(h.precio_anterior)} →{" "}
                        {formatMoney(h.precio_nuevo)}
                      </strong>
                      <span>
                        {fecha}
                        {h.usuario_nombre ? ` · ${h.usuario_nombre}` : ""}
                      </span>
                    </div>
                    <em
                      className={
                        delta > 0 ? "is-up" : delta < 0 ? "is-down" : undefined
                      }
                    >
                      {delta > 0 ? "+" : ""}
                      {formatMoney(delta)}
                    </em>
                  </li>
                );
              })}
              {historialPrecios.length === 0 && (
                <li className="pdet-empty">Sin cambios de precio aún.</li>
              )}
            </ul>
          )}
        </section>

        <section className="pdet-chart-card" aria-label="Precios por lote">
          <h2>Precios por lote</h2>
          <p className="pdet-hint">
            Costo unitario de cada ingreso (más antiguo → más reciente).
          </p>
          <MiniBarChart
            bars={preciosLoteBars}
            color="#3b82f6"
            formatValue={formatMoney}
            emptyLabel="Sin lotes para comparar precios."
          />
        </section>
      </main>

      <footer className="pdet-footer">
        <button
          type="button"
          className="pdet-gestionar"
          onClick={() => setGestionarOpen(true)}
          disabled={!canWrite || producto.tipo === "KIT"}
          title={
            producto.tipo === "KIT"
              ? "Los kits no tienen lotes propios"
              : undefined
          }
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M4 8h16M4 16h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
            <circle cx="16" cy="16" r="2" fill="currentColor" />
          </svg>
          Nueva entrada de stock
        </button>
        <button
          type="button"
          className="pdet-merma-btn"
          onClick={() => setMermaOpen(true)}
          disabled={!puedeStock}
          title={
            producto.tipo === "KIT"
              ? "Los kits no tienen merma directa"
              : stock <= 0
                ? "Sin stock para dar de baja"
                : undefined
          }
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M12 8v5M12 16.5h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M10.3 4.5h3.4L20 18.5H4L10.3 4.5z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
          Registrar merma
        </button>
      </footer>

      {historialOpen && (
        <div
          className="pdet-modal-backdrop"
          role="presentation"
          onClick={() => setHistorialOpen(false)}
        >
          <div
            className="pdet-modal pdet-historial-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdet-historial-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pdet-historial-title">Historial de ingresos</h2>
            <p className="pdet-modal-lead">{producto.nombre}</p>

            <div className="pdet-filters">
              <label>
                Desde
                <input
                  type="date"
                  value={filtroDesde}
                  max={filtroHasta || todayIso()}
                  onChange={(e) => {
                    setFiltroDesde(e.target.value);
                    setPageVisible(pageSize);
                  }}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={filtroHasta}
                  max={todayIso()}
                  min={filtroDesde || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    const hoy = todayIso();
                    setFiltroHasta(v && v > hoy ? hoy : v);
                    setPageVisible(pageSize);
                  }}
                />
              </label>
            </div>
            <p className="pdet-hint">
              Mostrando {lotesModalPage.length} de {lotesFiltradosModal.length}{" "}
              ingresos.
            </p>

            <ul className="pdet-ingresos pdet-ingresos-modal">
              {lotesModalPage.map((lote) => (
                <IngresoCard
                  key={lote.id}
                  lote={lote}
                  precioVenta={producto.precio_venta}
                  diasCaducidadAlerta={diasCaducidadAlerta}
                  expanded={expandedIds.has(lote.id)}
                  onToggle={() => toggleExpanded(lote.id)}
                  fifoTag={lote.id === fifoNextId}
                />
              ))}
              {lotesModalPage.length === 0 && (
                <li className="pdet-empty">
                  Sin ingresos en el rango seleccionado.
                </li>
              )}
            </ul>

            {pageVisible < lotesFiltradosModal.length && (
              <button
                type="button"
                className="pdet-more-btn"
                onClick={() => setPageVisible((n) => n + pageSize)}
              >
                Cargar 10 más
              </button>
            )}

            <div className="pdet-modal-actions">
              <button
                type="button"
                className="pdet-modal-cancel"
                onClick={() => setHistorialOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {gestionarOpen && (
        <div className="pdet-modal-backdrop" role="presentation">
          <form
            className="pdet-modal"
            onSubmit={(e) => void handleEntrada(e)}
            aria-labelledby="pdet-gestionar-title"
          >
            <h2 id="pdet-gestionar-title">Nueva entrada de stock</h2>
            <p className="pdet-modal-lead">{producto.nombre}</p>

            <label>
              Cantidad
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                required
              />
            </label>
            <label>
              Tipo de precio
              <select
                value={costoEsTotal ? "total" : "unidad"}
                onChange={(e) => setCostoEsTotal(e.target.value === "total")}
              >
                <option value="unidad">Costo por unidad</option>
                <option value="total">Costo total del lote</option>
              </select>
            </label>
            <label>
              {costoEsTotal
                ? "Costo total neto (CLP)"
                : "Costo neto unitario (CLP)"}
              <input
                type="number"
                min={0}
                step="0.01"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                required
              />
            </label>
            {costoUnitarioCalculado != null && (
              <p className="pdet-hint">
                Costo unitario calculado:{" "}
                <strong>{formatMoney(costoUnitarioCalculado)}</strong>
              </p>
            )}
            <label>
              Costo operación total (CLP)
              <input
                type="number"
                min={0}
                step="0.01"
                value={costoOp}
                onChange={(e) => setCostoOp(e.target.value)}
              />
            </label>
            {margenEntradaPct != null && (
              <p className="pdet-hint">
                Diferencia vs precio de venta ({formatMoney(producto.precio_venta)}
                ):{" "}
                <strong>
                  {margenEntradaPct > 0 ? "+" : ""}
                  {margenEntradaPct}%
                </strong>{" "}
                sobre el costo unitario.
              </p>
            )}
            {producto.controla_caducidad && (
              <label>
                Fecha de caducidad
                <input
                  type="date"
                  value={fechaCaducidad}
                  onChange={(e) => setFechaCaducidad(e.target.value)}
                  required
                />
              </label>
            )}

            <div className="pdet-modal-actions">
              <button
                type="button"
                className="pdet-modal-cancel"
                onClick={() => setGestionarOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="pdet-modal-save" disabled={saving}>
                {saving ? "Guardando…" : "Registrar lote"}
              </button>
            </div>
          </form>
        </div>
      )}

      {mermaOpen && (
        <div className="pdet-modal-backdrop" role="presentation">
          <form
            className="pdet-modal"
            onSubmit={(e) => void handleMerma(e)}
            aria-labelledby="pdet-merma-title"
          >
            <h2 id="pdet-merma-title">Registrar merma</h2>
            <p className="pdet-modal-lead">{producto.nombre}</p>
            <p className="pdet-stock-hint">
              Stock disponible: {formatUnidades(stock)} u. La baja usa FIFO
              (ingresos más antiguos primero).
            </p>

            <label>
              Cantidad a dar de baja
              <input
                type="number"
                min={0.01}
                max={stock}
                step="0.01"
                value={mermaCantidad}
                onChange={(e) => setMermaCantidad(e.target.value)}
                required
              />
            </label>

            <div>
              <p className="pdet-stock-hint" style={{ marginBottom: "0.45rem" }}>
                Motivo
              </p>
              <div className="pdet-reasons" role="group" aria-label="Motivo de merma">
                {MERMA_MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`pdet-reason${motivoKey === m ? " is-active" : ""}`}
                    onClick={() => setMotivoKey(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {motivoKey === "Otro" && (
              <label>
                Describe el motivo
                <input
                  value={motivoOtro}
                  onChange={(e) => setMotivoOtro(e.target.value)}
                  placeholder="Ej. derrame en bodega"
                  required
                  maxLength={255}
                />
              </label>
            )}

            <div className="pdet-modal-actions">
              <button
                type="button"
                className="pdet-modal-cancel"
                onClick={() => setMermaOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="pdet-modal-save is-danger"
                disabled={saving || Number(mermaCantidad) <= 0}
              >
                {saving ? "Registrando…" : "Confirmar merma"}
              </button>
            </div>
          </form>
        </div>
      )}

      {editOpen && (
        <div
          className="pdet-modal-backdrop"
          role="presentation"
          onClick={() => !savingProducto && setEditOpen(false)}
        >
          <form
            className="pdet-modal pdet-edit-modal"
            onSubmit={(e) => void handleEditSubmit(e)}
            aria-labelledby="pdet-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pdet-edit-title">Editar producto</h2>

            <div className="pdet-edit-image">
              {editForm.imagen_data ? (
                <img src={editForm.imagen_data} alt="" />
              ) : (
                <div className="pdet-edit-image-empty">Sin imagen</div>
              )}
              <div className="pdet-edit-image-actions">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  Galería
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                >
                  Cámara
                </button>
                {editForm.imagen_data && (
                  <button
                    type="button"
                    className="is-muted"
                    onClick={() =>
                      setEditForm((f) => ({ ...f, imagen_data: null }))
                    }
                  >
                    Quitar
                  </button>
                )}
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void onPickImage(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  void onPickImage(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>

            <label>
              Nombre
              <input
                value={editForm.nombre}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, nombre: e.target.value }))
                }
                required
              />
            </label>
            <label>
              Código de barras
              <input
                value={editForm.codigo_barras}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, codigo_barras: e.target.value }))
                }
                placeholder="Opcional"
              />
            </label>
            <label>
              Precio venta (CLP)
              <input
                type="number"
                min={0}
                step="1"
                value={editForm.precio_venta}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, precio_venta: e.target.value }))
                }
                required
              />
            </label>
            {margenEditPct != null && (
              <p className="pdet-hint">
                Diferencia vs costo de stock ({formatMoney(costoRefStock!)}):{" "}
                <strong>
                  {margenEditPct > 0 ? "+" : ""}
                  {margenEditPct}%
                </strong>
              </p>
            )}
            <label>
              Unidad
              <select
                value={editForm.unidad_medida_id}
                onChange={(e) => {
                  const unidadId = Number(e.target.value);
                  const sigla =
                    unidades.find((u) => u.id === unidadId)?.sigla ?? "";
                  setEditForm((f) => ({
                    ...f,
                    unidad_medida_id: unidadId,
                    tipo: esUnidadCaja(sigla)
                      ? "KIT"
                      : f.tipo === "KIT"
                        ? "KIT"
                        : "SIMPLE",
                    controla_caducidad: esUnidadCaja(sigla)
                      ? false
                      : f.controla_caducidad,
                  }));
                }}
                required
              >
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.sigla})
                  </option>
                ))}
              </select>
            </label>
            {esUnidadCaja(
              unidades.find((u) => u.id === editForm.unidad_medida_id)?.sigla ??
                "",
            ) && (
              <>
                <p className="pdet-hint">
                  La caja es un combo (BOM). Elige el producto base y cuántas
                  unidades lleva cada caja.
                </p>
                <label>
                  Producto base
                  <select
                    value={editForm.producto_base_id}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        producto_base_id:
                          e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    required
                  >
                    <option value="">Selecciona producto…</option>
                    {productosBase.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Unidades por caja
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={editForm.cantidad_base}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        cantidad_base: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </>
            )}
            <label>
              Categoría
              <select
                value={editForm.categoria_id}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    categoria_id:
                      e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            {producto.tipo !== "KIT" &&
              !esUnidadCaja(
                unidades.find((u) => u.id === editForm.unidad_medida_id)
                  ?.sigla ?? "",
              ) && (
              <label className="pdet-edit-check">
                <input
                  type="checkbox"
                  checked={editForm.controla_caducidad}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      controla_caducidad: e.target.checked,
                    }))
                  }
                />
                Controla caducidad
              </label>
            )}

            <div className="pdet-modal-actions">
              <button
                type="button"
                className="pdet-modal-cancel"
                onClick={() => setEditOpen(false)}
                disabled={savingProducto}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="pdet-modal-save"
                disabled={savingProducto}
              >
                {savingProducto ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
