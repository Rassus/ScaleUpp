import { FormEvent, useCallback, useMemo, useState } from "react";
import BarcodeScanner from "../components/BarcodeScanner";
import DashTopbar from "../components/DashTopbar";
import ProductTags from "../components/ProductTags";
import { useHardwareBack } from "../hooks/useHardwareBack";
import {
  cantidadAGramos,
  esPesoSolido,
  esPesoVariable,
  formatPeso,
  gramosACantidad,
  gramosDesdePrecio,
  minCantidad,
  pasoCantidad,
  precioDesdeGramos,
} from "../peso";
import { formatClp as formatMoney, formatClpLabel as formatClp, redondearEfectivo } from "../money";
import "./DashboardPage.css";
import "./OrdenPage.css";

export type OrdenLinea = {
  producto_id: number;
  nombre: string;
  tipo: string;
  precio_unitario: number;
  precio_lista?: number;
  cantidad: number;
  unidad_sigla?: string;
  /** Pedido sin stock (demanda faltante; no se cobra). */
  sin_stock?: boolean;
};

export type OrdenProducto = {
  id: number;
  nombre: string;
  codigo_barras: string | null;
  precio_venta: number;
  tipo: string;
  categoria_id: number | null;
};

export type OrdenCategoria = {
  id: number;
  nombre: string;
  acceso_rapido?: boolean;
};

export type OrdenCaja = {
  id: number;
  fecha: string;
  monto_apertura: number;
} | null;

type OrdenPageProps = {
  caja: OrdenCaja;
  ordenNumero: number;
  lineas: OrdenLinea[];
  /** Catálogo completo (incluye sin stock, para registrar demanda). */
  productos: OrdenProducto[];
  stockByProducto: Record<number, number>;
  bajoStockByProducto?: Record<number, boolean>;
  caducidadByProducto?: Record<number, number>;
  categorias: OrdenCategoria[];
  clientes?: Array<{
    id: number;
    nombre: string;
    limite_credito: number;
    porcentaje_recargo: number | string;
    disponible: number;
    deuda_actual: number;
    activo: boolean;
  }>;
  clienteCreditoId?: number | null;
  metodoPago: string;
  scanCode: string;
  selling: boolean;
  error: string | null;
  onMetodoPagoChange: (v: string) => void;
  onClienteCreditoChange?: (id: number | null) => void;
  onScanCodeChange: (v: string) => void;
  onScanSubmit: (e: FormEvent) => void;
  onAddProducto: (p: OrdenProducto) => void | Promise<void>;
  onAddByCode: (code: string) => void | Promise<void>;
  onChangeCantidad: (
    productoId: number,
    cantidad: number,
    precioUnitario?: number,
  ) => void;
  onRemoveLinea: (productoId: number) => void;
  onRegistrarMerma?: (
    productoId: number,
    cantidad: number,
    motivo: string,
  ) => Promise<void>;
  onCobrar: () => void;
  onOpenMenu: () => void;
  onError: (msg: string) => void;
};

function formatCupo(c: { limite_credito: number; disponible: number }): string {
  if (Number(c.limite_credito) <= 0) return "Sin límite";
  return formatMoney(c.disponible);
}

function CategoryIcon({ name }: { name: string }) {
  const n = name.toLowerCase();

  if (n.includes("fruta") || n.includes("verdura") || n.includes("vegetal")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <circle cx="12" cy="13" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 7c1-2 3-3 4-3-1 2-1 3.5-1 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (n.includes("carne") || n.includes("ave") || n.includes("pollo")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M7 14c0-4 3-7 7-7 2 0 4 1 5 3-3 1-5 3-5 6 0 2-1 4-3 4s-4-2-4-6z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    );
  }
  if (n.includes("pescado") || n.includes("marisco")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M4 12c4-5 8-6 12-4 1 3 1 5 0 8-4 2-8 1-12-4z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <circle cx="8.5" cy="11.5" r="0.8" fill="currentColor" />
      </svg>
    );
  }
  if (n.includes("fiambre") || n.includes("charcut") || n.includes("queso")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path d="M5 9c0-2 3-4 7-4s7 2 7 4v8H5V9z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 12h14" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (n.includes("pan") || n.includes("panader") || n.includes("pasteler")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M4 14c0-4 3-7 8-7s8 3 8 7v2H4v-2z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M8 10v3M12 9v4M16 10v3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (
    n.includes("arroz") ||
    n.includes("legumbre") ||
    n.includes("pasta") ||
    n.includes("conserva") ||
    n.includes("aceite") ||
    n.includes("condimento")
  ) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path d="M7 8h10l1 12H6L7 8z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (n.includes("desayuno") || n.includes("merienda")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M6 9h10v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M16 11h2a2 2 0 0 1 0 4h-2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (
    n.includes("leche") ||
    n.includes("yogur") ||
    n.includes("mantequilla") ||
    n.includes("margarina") ||
    n.includes("láct") ||
    n.includes("lact")
  ) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path d="M8 7h8l1 13H7L8 7z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (
    n.includes("congel") ||
    n.includes("helado") ||
    n.includes("comida lista") ||
    n.includes("plato")
  ) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M12 3v18M6 7l12 10M18 7L6 17"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (
    n.includes("beb") ||
    n.includes("agua") ||
    n.includes("jugo") ||
    n.includes("cerveza") ||
    n.includes("vino") ||
    n.includes("licor") ||
    n.includes("refresc")
  ) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M9 3h6l1 4v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7l1-4z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M9 8h6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (
    n.includes("higiene") ||
    n.includes("salud") ||
    n.includes("afeitado") ||
    n.includes("capilar") ||
    n.includes("oral")
  ) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <rect x="8" y="3" width="8" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 10h8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (
    n.includes("limpieza") ||
    n.includes("ropa") ||
    n.includes("celulosa") ||
    n.includes("utensilio")
  ) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path d="M8 4h8l-1 4H9L8 4z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9 8h6l1 12H8L9 8z" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (n.includes("mascota")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="16" cy="8" r="1.5" fill="currentColor" />
        <circle cx="5.5" cy="12" r="1.5" fill="currentColor" />
        <circle cx="18.5" cy="12" r="1.5" fill="currentColor" />
        <ellipse cx="12" cy="15" rx="4" ry="3.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (n.includes("bebé") || n.includes("bebe")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M7 19c1.5-2 3.5-3 5-3s3.5 1 5 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (n.includes("bazar") || n.includes("hogar")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M4 10l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (n.includes("cigarr") || n.includes("tabaco")) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <rect x="3" y="12" width="14" height="4" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <path d="M17 12h3v4h-3" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M19 8c0 1.5-1 2-1 3.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (
    n.includes("dulce") ||
    n.includes("snack") ||
    n.includes("golos") ||
    n.includes("confiter")
  ) {
    return (
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
        <path
          d="M8 12c0-2 1.5-3.5 4-3.5s4 1.5 4 3.5-1.5 3.5-4 3.5-4-1.5-4-3.5z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="M5 9l3 3M19 9l-3 3M5 15l3-3M19 15l-3-3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function OrdenPage({
  caja,
  ordenNumero,
  lineas,
  productos,
  stockByProducto,
  bajoStockByProducto = {},
  caducidadByProducto = {},
  categorias,
  clientes = [],
  clienteCreditoId = null,
  metodoPago,
  scanCode,
  selling,
  error,
  onMetodoPagoChange,
  onClienteCreditoChange,
  onScanCodeChange,
  onScanSubmit,
  onAddProducto,
  onAddByCode,
  onChangeCantidad,
  onRemoveLinea,
  onRegistrarMerma,
  onCobrar,
  onOpenMenu,
  onError,
}: OrdenPageProps) {
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [rapidoAbierto, setRapidoAbierto] = useState(false);
  const [editPeso, setEditPeso] = useState<{
    producto_id: number;
    nombre: string;
    sigla: string;
    stock: number;
    sinStock?: boolean;
    value: string;
    precioUnitario: number;
    precio: string;
  } | null>(null);
  const [editPesoSaving, setEditPesoSaving] = useState(false);

  useHardwareBack(
    useCallback(() => {
      if (editPeso) {
        if (!editPesoSaving) setEditPeso(null);
        return true;
      }
      if (camaraActiva) {
        setCamaraActiva(false);
        return true;
      }
      if (rapidoAbierto) {
        setRapidoAbierto(false);
        return true;
      }
      if (showResults) {
        setShowResults(false);
        setCategoriaId(null);
        return true;
      }
      return false;
    }, [editPeso, editPesoSaving, camaraActiva, rapidoAbierto, showResults]),
  );

  const total = useMemo(
    () =>
      lineas
        .filter(
          (l) => !l.sin_stock && (stockByProducto[l.producto_id] ?? 0) > 0,
        )
        .reduce((s, l) => s + l.precio_unitario * l.cantidad, 0),
    [lineas, stockByProducto],
  );

  const faltantesCount = useMemo(
    () =>
      lineas.filter(
        (l) => l.sin_stock || (stockByProducto[l.producto_id] ?? 0) <= 0,
      ).length,
    [lineas, stockByProducto],
  );

  const soloFaltantes =
    lineas.length > 0 &&
    lineas.every(
      (l) => l.sin_stock || (stockByProducto[l.producto_id] ?? 0) <= 0,
    );

  const clienteCredito = useMemo(
    () => clientes.find((c) => c.id === clienteCreditoId) ?? null,
    [clientes, clienteCreditoId],
  );

  const recargoPct =
    metodoPago === "CREDITO" && clienteCredito
      ? Number(clienteCredito.porcentaje_recargo) || 0
      : 0;

  const montoRecargo = useMemo(() => {
    if (recargoPct <= 0) return 0;
    return Math.round(total * (recargoPct / 100));
  }, [total, recargoPct]);

  const totalConRecargo = useMemo(
    () => total + montoRecargo,
    [total, montoRecargo],
  );

  const totalACobrar = useMemo(() => {
    const base = metodoPago === "CREDITO" ? totalConRecargo : total;
    return metodoPago === "EFECTIVO" ? redondearEfectivo(base) : Math.round(base);
  }, [metodoPago, total, totalConRecargo]);

  const ajusteEfectivo = useMemo(() => {
    if (metodoPago !== "EFECTIVO") return 0;
    return totalACobrar - Math.round(total);
  }, [metodoPago, totalACobrar, total]);

  const clientesConCupo = useMemo(
    () =>
      clientes.filter((c) => {
        if (!c.activo) return false;
        if (c.id === clienteCreditoId) return true;
        // limite 0 = ilimitado
        if (Number(c.limite_credito) <= 0) return true;
        return c.disponible > 0;
      }),
    [clientes, clienteCreditoId],
  );

  const itemsCount = useMemo(
    () => lineas.reduce((s, l) => s + l.cantidad, 0),
    [lineas],
  );

  const accesoRapido = useMemo(
    () => categorias.filter((c) => c.acceso_rapido),
    [categorias],
  );

  const resultados = useMemo(() => {
    const q = scanCode.trim().toLowerCase();
    return productos
      .filter((p) => {
        if (categoriaId != null && p.categoria_id !== categoriaId) return false;
        if (!q) return categoriaId != null;
        return (
          p.nombre.toLowerCase().includes(q) ||
          (p.codigo_barras ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [productos, scanCode, categoriaId]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = scanCode.trim();
    if (!q) {
      setShowResults(true);
      return;
    }
    const byCode = productos.find(
      (p) => (p.codigo_barras ?? "").toLowerCase() === q.toLowerCase(),
    );
    if (byCode) {
      void onAddProducto(byCode);
      onScanCodeChange("");
      setShowResults(false);
      setCategoriaId(null);
      return;
    }
    setShowResults(true);
    onScanSubmit(e);
  }

  function pickCategoria(id: number) {
    setCategoriaId((prev) => (prev === id ? null : id));
    setShowResults(true);
    onScanCodeChange("");
  }

  function pickProducto(p: OrdenProducto) {
    void onAddProducto(p);
    setShowResults(false);
    setCategoriaId(null);
    onScanCodeChange("");
  }

  async function confirmarEditPeso() {
    if (!editPeso || editPesoSaving) return;
    const raw = Number(editPeso.value.replace(",", "."));
    if (!Number.isFinite(raw) || raw <= 0) {
      onError("Ingresa un peso válido");
      return;
    }
    const solido = esPesoSolido(editPeso.sigla);
    let qty: number;
    let mermaQty = 0;
    let precioUnitOverride: number | undefined;

    if (solido) {
      const gramosReales = Math.round(raw);
      const pu = editPeso.precioUnitario;
      const precioCalc = precioDesdeGramos(gramosReales, editPeso.sigla, pu);
      const precioCobrar = Math.round(
        Number(String(editPeso.precio).replace(",", ".")),
      );
      if (!Number.isFinite(precioCobrar) || precioCobrar < 0) {
        onError("Ingresa un precio válido");
        return;
      }
      const realQty = gramosACantidad(gramosReales, editPeso.sigla);
      if (pu <= 0) {
        qty = realQty;
      } else if (precioCobrar < precioCalc) {
        const gVend = Math.min(
          gramosReales,
          gramosDesdePrecio(precioCobrar, editPeso.sigla, pu),
        );
        const mermaG = gramosReales - gVend;
        const mermaRaw = mermaG > 0 ? gramosACantidad(mermaG, editPeso.sigla) : 0;
        const mermaRounded = Math.round(mermaRaw * 100) / 100;
        if (mermaRounded >= 0.01) {
          mermaQty = mermaRounded;
          qty = Math.round((realQty - mermaQty) * 1000) / 1000;
          if (qty <= 0) {
            onError("El precio es demasiado bajo respecto al peso");
            return;
          }
        } else {
          qty = realQty;
          precioUnitOverride = Math.round(precioCobrar / realQty);
        }
      } else if (precioCobrar > precioCalc && realQty > 0) {
        qty = realQty;
        precioUnitOverride = Math.round(precioCobrar / realQty);
      } else {
        qty = realQty;
      }
    } else {
      qty = Math.round(raw * 1000) / 1000;
    }

    const total = Math.round((qty + mermaQty) * 1000) / 1000;
    if (!editPeso.sinStock && total > editPeso.stock) {
      onError(
        `Stock insuficiente. Disponible: ${
          solido
            ? formatPeso(editPeso.stock, editPeso.sigla)
            : `${editPeso.stock} ${editPeso.sigla}`
        }`,
      );
      return;
    }

    setEditPesoSaving(true);
    try {
      if (!editPeso.sinStock && mermaQty > 0 && onRegistrarMerma) {
        await onRegistrarMerma(
          editPeso.producto_id,
          mermaQty,
          "Diferencia de precio/pesaje en venta",
        );
      }
      await onChangeCantidad(
        editPeso.producto_id,
        qty,
        precioUnitOverride,
      );
      setEditPeso(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "No se pudo guardar el peso");
    } finally {
      setEditPesoSaving(false);
    }
  }

  return (
    <div className="venta-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="venta-mark" />

      <main className="venta-main">
        <h1 className="venta-title">
          Nueva Venta <span>#{ordenNumero}</span>
        </h1>

        <div className="venta-search-row">
          <form className="venta-search" onSubmit={handleSearchSubmit}>
            <input
              value={scanCode}
              onChange={(e) => {
                onScanCodeChange(e.target.value);
                setShowResults(true);
                setCategoriaId(null);
              }}
              placeholder="Código de barra / Buscar"
              autoFocus
              aria-label="Código de barra o buscar"
            />
            <button type="submit" className="venta-search-icon" aria-label="Buscar">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M16 16l4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </form>

          <button
            type="button"
            className={`venta-cam-btn${camaraActiva ? " is-active" : ""}`}
            aria-label="Escanear con cámara"
            aria-pressed={camaraActiva}
            onClick={() => setCamaraActiva((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </button>
        </div>

        {camaraActiva && (
          <div className="venta-scanner">
            <BarcodeScanner
              hideLaunchButton
              active={camaraActiva}
              onActiveChange={setCamaraActiva}
              onDetected={(code) => {
                void onAddByCode(code);
              }}
              onError={(msg) => {
                if (msg) onError(msg);
              }}
            />
          </div>
        )}

        <div className="venta-rapido">
          <button
            type="button"
            className="venta-rapido-toggle"
            aria-expanded={rapidoAbierto}
            onClick={() => setRapidoAbierto((v) => !v)}
          >
            <h3>Acceso Rápido</h3>
            <span>
              {rapidoAbierto ? "Ocultar" : `${accesoRapido.length} categorías`}
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                className={rapidoAbierto ? "is-open" : undefined}
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
            </span>
          </button>
          {rapidoAbierto && (
            <div className="venta-rapido-grid">
              {accesoRapido.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={
                    categoriaId === c.id
                      ? "venta-rapido-btn is-active"
                      : "venta-rapido-btn"
                  }
                  onClick={() => pickCategoria(c.id)}
                >
                  <CategoryIcon name={c.nombre} />
                  <span>{c.nombre}</span>
                </button>
              ))}
              {accesoRapido.length === 0 && (
                <p className="venta-rapido-empty">
                  Sin acceso rápido. Márcalos con ★ en Configuración → Categorías.
                </p>
              )}
            </div>
          )}
        </div>

        {showResults && resultados.length > 0 && (
          <ul className="venta-results" aria-label="Resultados de búsqueda">
            {resultados.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => pickProducto(p)}>
                  <span className="venta-result-main">
                    <strong className="prod-tags-row">
                      <span>{p.nombre}</span>
                      <ProductTags
                        tipo={p.tipo}
                        stock={stockByProducto[p.id] ?? 0}
                        alertaBajoStock={!!bajoStockByProducto[p.id]}
                        diasCaducidad={caducidadByProducto[p.id]}
                      />
                    </strong>
                    <em>Stock {stockByProducto[p.id] ?? 0}</em>
                  </span>
                  <span>{formatMoney(p.precio_venta)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {showResults &&
          (scanCode.trim() !== "" || categoriaId != null) &&
          resultados.length === 0 && (
            <p className="venta-hint">No hay productos que coincidan.</p>
          )}

        {error && (
          <p className="venta-error" role="alert">
            {error}
          </p>
        )}

        <section className="venta-carrito" aria-label="Carrito">
          <h2>Tu Carrito</h2>
          <ul className="venta-cart-list">
            {lineas.map((l) => {
              const stock = stockByProducto[l.producto_id] ?? 0;
              const sigla = (l.unidad_sigla ?? "UND").toUpperCase();
              const solido = esPesoSolido(sigla);
              const peso = esPesoVariable(sigla);
              const step = pasoCantidad(sigla);
              const minQty = minCantidad(sigla);
              const sinStock = !!l.sin_stock || stock <= 0;
              const atMax = !sinStock && l.cantidad >= stock;
              const montoLinea = Math.round(l.precio_unitario * l.cantidad);
              return (
                <li
                  key={l.producto_id}
                  className={`venta-cart-item${sinStock ? " is-faltante" : ""}`}
                >
                  <p className="venta-cart-name">
                    <span className="prod-tags-row">
                      <span>{l.nombre}</span>
                      {sinStock && (
                        <span
                          className="venta-faltante-badge"
                          title="Se registra como demanda sin stock"
                        >
                          Pedido faltante
                        </span>
                      )}
                      {l.precio_lista != null &&
                        l.precio_unitario < l.precio_lista && (
                          <span className="venta-promo-badge" title="Precio promoción">
                            Promo
                          </span>
                        )}
                      <ProductTags
                        tipo={l.tipo}
                        stock={stock}
                        alertaBajoStock={!!bajoStockByProducto[l.producto_id]}
                        diasCaducidad={caducidadByProducto[l.producto_id]}
                      />
                    </span>{" "}
                    —{" "}
                    <strong>
                      {formatMoney(montoLinea)}
                      {sinStock ? " (ref.)" : ""}
                    </strong>
                    {!sinStock &&
                      l.precio_lista != null &&
                      l.precio_unitario < l.precio_lista && (
                        <em className="venta-lista-tachado">
                          {" "}
                          {formatMoney(Math.round(l.precio_lista * l.cantidad))}
                        </em>
                      )}
                    <em className="venta-stock-tag">
                      Disp.{" "}
                      {solido
                        ? formatPeso(stock, sigla)
                        : `${stock}${l.unidad_sigla ? ` ${l.unidad_sigla}` : ""}`}
                    </em>
                  </p>
                  <div className="venta-qty">
                    <button
                      type="button"
                      className="venta-qty-btn"
                      aria-label="Menos"
                      onClick={() => {
                        if (l.cantidad <= minQty) onRemoveLinea(l.producto_id);
                        else
                          onChangeCantidad(
                            l.producto_id,
                            solido
                              ? gramosACantidad(
                                  cantidadAGramos(l.cantidad, sigla) - 10,
                                  sigla,
                                )
                              : Math.round((l.cantidad - step) * 1000) / 1000,
                          );
                      }}
                    >
                      −
                    </button>
                    {peso ? (
                      <button
                        type="button"
                        className="venta-qty-edit"
                        aria-label={`Editar peso de ${l.nombre}`}
                        title="Toca para editar el peso"
                        onClick={() => {
                          const g = solido
                            ? String(cantidadAGramos(l.cantidad, sigla))
                            : String(l.cantidad);
                          const gNum = solido
                            ? cantidadAGramos(l.cantidad, sigla)
                            : 0;
                          setEditPeso({
                            producto_id: l.producto_id,
                            nombre: l.nombre,
                            sigla: l.unidad_sigla ?? sigla,
                            stock,
                            sinStock,
                            value: g,
                            precioUnitario: l.precio_unitario,
                            precio: solido
                              ? String(
                                  precioDesdeGramos(
                                    gNum,
                                    sigla,
                                    l.precio_unitario,
                                  ),
                                )
                              : "",
                          });
                        }}
                      >
                        {solido
                          ? formatPeso(l.cantidad, sigla)
                          : l.cantidad.toLocaleString("es-CL", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 3,
                            })}
                      </button>
                    ) : (
                      <input
                        type="number"
                        className="venta-qty-input"
                        min={minQty}
                        step={step}
                        max={sinStock ? undefined : stock}
                        value={l.cantidad}
                        aria-label={`Cantidad de ${l.nombre}`}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          onChangeCantidad(l.producto_id, v);
                        }}
                      />
                    )}
                    <button
                      type="button"
                      className="venta-qty-btn"
                      aria-label="Más"
                      disabled={atMax}
                      title={atMax ? "Sin stock suficiente" : undefined}
                      onClick={() =>
                        onChangeCantidad(
                          l.producto_id,
                          solido
                            ? gramosACantidad(
                                cantidadAGramos(l.cantidad, sigla) + 10,
                                sigla,
                              )
                            : Math.round((l.cantidad + step) * 1000) / 1000,
                        )
                      }
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="venta-cart-remove"
                      aria-label={`Quitar ${l.nombre} del carrito`}
                      title="Quitar producto"
                      onClick={() => onRemoveLinea(l.producto_id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
            {lineas.length === 0 && (
              <li className="venta-cart-empty">
                Carrito vacío. Escanea o busca un producto.
              </li>
            )}
          </ul>
        </section>
      </main>

      <footer className="venta-footer">
        <div className="venta-summary">
          <span>
            Ítems: <strong>{itemsCount}</strong>
          </span>
          {faltantesCount > 0 && (
            <span className="venta-faltante-summary">
              Faltantes: <strong>{faltantesCount}</strong>
            </span>
          )}
          {soloFaltantes ? (
            <span>
              Solo pedidos sin stock (no se cobra)
            </span>
          ) : metodoPago === "CREDITO" && montoRecargo > 0 ? (
            <>
              <span>
                Subtotal: <strong>{formatClp(total)}</strong>
              </span>
              <span className="venta-recargo-line">
                Recargo fiado ({recargoPct}%):{" "}
                <strong>{formatClp(montoRecargo)}</strong>
              </span>
              <span>
                Total: <strong>{formatClp(totalConRecargo)}</strong>
              </span>
            </>
          ) : metodoPago === "EFECTIVO" && ajusteEfectivo !== 0 ? (
            <>
              <span>
                Subtotal: <strong>{formatClp(total)}</strong>
              </span>
              <span className="venta-recargo-line">
                Redondeo efectivo:{" "}
                <strong>
                  {ajusteEfectivo > 0 ? "+" : ""}
                  {formatClp(ajusteEfectivo)}
                </strong>
              </span>
              <span>
                Total a cobrar: <strong>{formatClp(totalACobrar)}</strong>
              </span>
            </>
          ) : (
            <span>
              Total: <strong>{formatClp(totalACobrar)}</strong>
            </span>
          )}
        </div>

        {!soloFaltantes && (
        <label className="venta-pago">
          <span className="sr-only">Tipo de pago</span>
          <select
            value={metodoPago}
            onChange={(e) => onMetodoPagoChange(e.target.value)}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </label>
        )}

        {!soloFaltantes && metodoPago === "CREDITO" && (
          <label className="venta-pago venta-cliente-credito">
            <span className="sr-only">Cliente a fiar</span>
            <select
              value={clienteCreditoId ?? ""}
              onChange={(e) =>
                onClienteCreditoChange?.(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">Cliente a fiar…</option>
              {clientesConCupo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {formatCupo(c)} · {Number(c.porcentaje_recargo)}%
                </option>
              ))}
            </select>
            {clienteCredito && (
              <em className="venta-cupo-hint">
                Cupo {formatCupo(clienteCredito)}
                {Number(clienteCredito.limite_credito) > 0 &&
                totalConRecargo > clienteCredito.disponible
                  ? " · supera cupo"
                  : ""}
              </em>
            )}
          </label>
        )}

        <button
          type="button"
          className="venta-cobrar"
          onClick={onCobrar}
          disabled={
            selling ||
            lineas.length === 0 ||
            !caja ||
            (!soloFaltantes &&
              metodoPago === "CREDITO" &&
              (clienteCreditoId == null ||
                (clienteCredito != null &&
                  Number(clienteCredito.limite_credito) > 0 &&
                  totalConRecargo > clienteCredito.disponible)))
          }
          title={!caja ? "Abre la caja para cobrar" : undefined}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M8 12l2.5 2.5L16 9"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {selling
            ? soloFaltantes
              ? "Registrando…"
              : "Cobrando…"
            : soloFaltantes
              ? `Registrar ${faltantesCount} faltante${faltantesCount === 1 ? "" : "s"}`
              : faltantesCount > 0
                ? `Cobrar ${formatClp(totalACobrar)} (+${faltantesCount} falt.)`
                : `Cobrar ${formatClp(totalACobrar)}`}
        </button>
      </footer>

      {editPeso && (
        <div
          className="venta-peso-backdrop"
          role="presentation"
          onClick={() => !editPesoSaving && setEditPeso(null)}
        >
          <div
            className="venta-peso-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="venta-peso-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="venta-peso-title">
              {esPesoSolido(editPeso.sigla) ? "Editar gramos" : "Editar peso"}
            </h2>
            <p className="venta-peso-lead">
              {editPeso.nombre} · disp.{" "}
              {esPesoSolido(editPeso.sigla)
                ? formatPeso(editPeso.stock, editPeso.sigla)
                : `${editPeso.stock} ${editPeso.sigla}`}
            </p>
            <label>
              {esPesoSolido(editPeso.sigla)
                ? "Gramos (g)"
                : `Cantidad (${editPeso.sigla})`}
              <input
                type="number"
                min={esPesoSolido(editPeso.sigla) ? 1 : 0.001}
                step={esPesoSolido(editPeso.sigla) ? 1 : 0.001}
                value={editPeso.value}
                autoFocus
                disabled={editPesoSaving}
                onChange={(e) => {
                  const v = e.target.value;
                  const g = Number(String(v).replace(",", "."));
                  const next: typeof editPeso = { ...editPeso, value: v };
                  if (
                    esPesoSolido(editPeso.sigla) &&
                    Number.isFinite(g) &&
                    g > 0
                  ) {
                    next.precio = String(
                      precioDesdeGramos(g, editPeso.sigla, editPeso.precioUnitario),
                    );
                  }
                  setEditPeso(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void confirmarEditPeso();
                  }
                }}
              />
            </label>
            {esPesoSolido(editPeso.sigla) && Number(editPeso.value) > 0 && (
              <p className="venta-peso-lead" style={{ marginTop: "0.5rem" }}>
                ={" "}
                {formatPeso(
                  gramosACantidad(Number(editPeso.value), editPeso.sigla),
                  editPeso.sigla,
                )}
              </p>
            )}
            {esPesoSolido(editPeso.sigla) && (
              <div className="venta-peso-merma">
                <label>
                  Precio a cobrar (CLP)
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editPeso.precio}
                    disabled={editPesoSaving}
                    onChange={(e) =>
                      setEditPeso({ ...editPeso, precio: e.target.value })
                    }
                  />
                </label>
                {(() => {
                  const g = Math.round(
                    Number(String(editPeso.value).replace(",", ".")),
                  );
                  const pu = editPeso.precioUnitario;
                  if (!Number.isFinite(g) || g <= 0 || pu <= 0) return null;
                  const calc = precioDesdeGramos(g, editPeso.sigla, pu);
                  const cobrar = Math.round(
                    Number(String(editPeso.precio).replace(",", ".")),
                  );
                  if (!Number.isFinite(cobrar)) return null;
                  if (cobrar < calc) {
                    const gVend = Math.min(
                      g,
                      gramosDesdePrecio(cobrar, editPeso.sigla, pu),
                    );
                    const mermaG = g - gVend;
                    const mermaQty = gramosACantidad(mermaG, editPeso.sigla);
                    const mermaRounded = Math.round(mermaQty * 100) / 100;
                    if (mermaG <= 0) return null;
                    if (mermaRounded < 0.01) {
                      return (
                        <p className="venta-peso-lead">
                          Ajuste de precio ($
                          {calc.toLocaleString("es-CL")} → $
                          {cobrar.toLocaleString("es-CL")}); diferencia menor a
                          10&nbsp;g, sin merma de stock.
                        </p>
                      );
                    }
                    return (
                      <p className="venta-peso-merma-diff">
                        Merma: {formatPeso(mermaRounded, editPeso.sigla)}{" "}
                        (calc. ${calc.toLocaleString("es-CL")} → $
                        {cobrar.toLocaleString("es-CL")})
                      </p>
                    );
                  }
                  if (cobrar > calc) {
                    return (
                      <p className="venta-peso-lead">
                        Precio sobre el cálculo (${calc.toLocaleString("es-CL")}
                        ): se cobra el monto ingresado sin merma.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            <div className="venta-peso-actions">
              <button
                type="button"
                disabled={editPesoSaving}
                onClick={() => setEditPeso(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="is-primary"
                disabled={editPesoSaving}
                onClick={() => void confirmarEditPeso()}
              >
                {editPesoSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
