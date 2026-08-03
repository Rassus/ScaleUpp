import { useEffect, useMemo, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import type { KitBom } from "../kitCombo";
import { formatClpLabel as formatClp, formatClp as formatMoney } from "../money";
import "./DashboardPage.css";
import "./FinanzasPage.css";

export type FinVentaItem = {
  id: number;
  producto_id?: number;
  producto_nombre: string;
  cantidad: string | number;
  subtotal: number;
};

export type FinVenta = {
  id: number;
  total_venta: number;
  ganancia: number;
  costo_total?: number;
  metodo_pago: string;
  fecha_hora: string;
  items?: FinVentaItem[];
};

export type FinKpis = {
  venta_diaria: number;
  venta_mensual: number;
  venta_anual?: number;
  ganancia_diaria: number;
  ganancia_mensual: number;
  ganancia_anual?: number;
  num_ventas_dia: number;
  num_ventas_mes: number;
  num_ventas_anio?: number;
  gastos_anuales?: number;
  merma_anual?: number;
  productos_estrella: {
    nombre: string;
    cantidad_vendida: string | number;
    total_venta: number;
  }[];
  productos_bajo_stock: {
    nombre: string;
    stock_actual: string | number;
  }[];
  productos_por_vencer: {
    producto_id?: number;
    nombre: string;
    dias_restantes: number;
    fecha_caducidad: string;
    cantidad_actual?: string | number;
  }[];
};

export type FinMovimiento = {
  id: number;
  producto_id: number;
  tipo_movimiento: string;
  cantidad: string | number;
  costo_unitario_aplicado: number;
  motivo: string | null;
  fecha_hora: string;
};

export type FinLote = {
  id: number;
  producto_id: number;
  cantidad_actual: string | number;
  costo_unitario_real: number;
  fecha_caducidad: string | null;
};

export type FinStockItem = {
  producto_id: number;
  producto_nombre: string;
  stock_actual: string | number;
  alerta_bajo_stock: boolean;
};

type FinProducto = {
  id: number;
  nombre: string;
  categoria_id: number | null;
  tipo?: string;
  precio_venta?: number;
};

type FinCategoria = { id: number; nombre: string };

type FinCaja = {
  cuadre?: {
    egresos_efectivo: number;
    ventas_efectivo: number;
    ventas_tarjeta: number;
    ventas_transferencia: number;
    ventas_credito?: number;
    cobros_credito?: number;
    ingresos_efectivo?: number;
  };
} | null;

type FinTab = "resumen" | "cajas" | "caja-chica" | "kits" | "mermas" | "kpis";

type Slice = { label: string; value: number; color: string };

type FinCajaVentaItem = {
  id: number;
  producto_nombre: string;
  cantidad: string | number;
  subtotal: number;
};

type FinCajaVenta = {
  id: number;
  numero?: number;
  total_venta: number;
  metodo_pago: string;
  fecha_hora: string;
  anulada?: boolean;
  items?: FinCajaVentaItem[];
};

type FinCajaTx = {
  id: number;
  tipo_transaccion: string;
  monto: number;
  descripcion: string;
  medio_pago: string;
  venta_id?: number | null;
  fecha_hora: string;
};

type FinCajaDelDia = {
  id: number;
  numero?: number;
  fecha: string;
  nombre_vendedor: string;
  estado: string;
  monto_apertura: number;
  creado_en: string;
  cerrada_en?: string | null;
  cuadre?: {
    total_ventas: number;
    ventas_efectivo: number;
    ventas_tarjeta: number;
    ventas_transferencia: number;
    ventas_credito?: number;
    cobros_credito?: number;
    efectivo_teorico: number;
    egresos_efectivo?: number;
  } | null;
};

type FinGastoMesItem = FinCajaTx & {
  caja_fecha: string;
  caja_numero?: number;
};

type MetricModalId =
  | "flujo"
  | "utilidad"
  | "gastos"
  | "merma"
  | "ganancias-netas"
  | "ganancias-brutas"
  | null;

function isGastoTx(tipo: string) {
  return tipo === "GASTO_OPERATIVO" || tipo === "GASTO_GENERAL";
}

export type FinMovimientoNegocio = {
  id: number;
  tipo: string;
  monto: number;
  descripcion: string;
  compra_id: number | null;
  fecha_hora: string;
};

export type FinInversionResumen = {
  total_periodo: number;
  por_mes: { mes: string; total: number }[];
  movimientos: FinMovimientoNegocio[];
};

type FinanzasPageProps = {
  kpis: FinKpis | null;
  ventas: FinVenta[];
  productos: FinProducto[];
  categorias: FinCategoria[];
  caja: FinCaja;
  movimientos: FinMovimiento[];
  lotes: FinLote[];
  stockResumen: FinStockItem[];
  inversiones: FinInversionResumen | null;
  kitBoms: KitBom[];
  onOpenMenu: () => void;
  onGoCompra: () => void;
  onFetchCajasPorFecha: (fecha: string) => Promise<FinCajaDelDia[]>;
  onFetchVentasCaja: (cajaId: number) => Promise<FinCajaVenta[]>;
  onFetchTransaccionesCaja: (cajaId: number) => Promise<FinCajaTx[]>;
  onFetchVentasPeriodo: (desde: string, hasta: string) => Promise<FinVenta[]>;
  onAnularVenta: (ventaId: number) => Promise<void>;
};

const PIE_COLORS = [
  "#0d9488",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#64748b",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ec4899",
];

function formatMoneyShort(value: number): string {
  const n = Math.round(value);
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toLocaleString("es-CL", {
      maximumFractionDigits: 1,
    })}M`;
  }
  if (Math.abs(n) >= 10_000) {
    return `$${(n / 1000).toLocaleString("es-CL", {
      maximumFractionDigits: 0,
    })}k`;
  }
  return formatMoney(n);
}

function formatPct(value: number): string {
  return `${value.toLocaleString("es-CL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKey(fechaHora: string): string {
  return fechaHora.slice(0, 10);
}

function monthKey(fechaHora: string): string {
  return fechaHora.slice(0, 7);
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d
    .toLocaleDateString("es-CL", { month: "short", year: "numeric" })
    .replace(/\./g, "");
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  });
}

function eachDayIso(from: string, to: string): string[] {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function formatHora(fechaHora: string): string {
  const d = new Date(fechaHora);
  if (Number.isNaN(d.getTime())) return fechaHora.slice(11, 16) || fechaHora;
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

function formatGastoTipo(tipo: string): string {
  if (tipo === "GASTO_OPERATIVO") return "Operativo";
  if (tipo === "GASTO_GENERAL") return "General";
  return tipo;
}

function mermaValor(m: FinMovimiento): number {
  return Math.abs(Number(m.cantidad)) * (m.costo_unitario_aplicado || 0);
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function PieChart({ slices, size = 160 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  if (total <= 0) {
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" />
      </svg>
    );
  }

  const positive = slices.filter((s) => s.value > 0);
  if (positive.length === 1 || positive.some((s) => s.value / total > 0.999)) {
    const only = positive[0];
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
        <circle cx={cx} cy={cy} r={r} fill={only.color} />
      </svg>
    );
  }

  let angle = 0;
  const paths: { d: string; color: string; key: string }[] = [];
  for (const s of positive) {
    const sweep = (s.value / total) * 360;
    const start = polar(cx, cy, r, angle);
    const end = polar(cx, cy, r, angle + sweep);
    const large = sweep > 180 ? 1 : 0;
    const d = [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`,
      "Z",
    ].join(" ");
    paths.push({ d, color: s.color, key: s.label });
    angle += sweep;
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.color} />
      ))}
    </svg>
  );
}

function BarChart({
  bars,
  color = "#3b82f6",
  height = 160,
}: {
  bars: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="fin-bars" style={{ height }} role="img">
      {bars.map((b) => (
        <div key={b.label} className="fin-bar-group">
          <span className="fin-bar-value">{formatMoneyShort(b.value)}</span>
          <div className="fin-bar-pair fin-bar-pair-single">
            <span
              className="fin-bar"
              style={{
                height: `${Math.max(b.value > 0 ? 6 : 2, (b.value / max) * 100)}%`,
                background: color,
                width: "70%",
                maxWidth: "1rem",
              }}
              title={formatMoney(b.value)}
            />
          </div>
          <span className="fin-bar-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function formatCountShort(value: number): string {
  const n = Math.round(value);
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("es-CL", {
      maximumFractionDigits: 1,
    })}M`;
  }
  if (Math.abs(n) >= 10_000) {
    return `${(n / 1000).toLocaleString("es-CL", {
      maximumFractionDigits: 0,
    })}k`;
  }
  return n.toLocaleString("es-CL");
}

function LineChart({
  points,
  color = "#0d9488",
  height = 200,
  format = "money",
}: {
  points: { label: string; value: number }[];
  color?: string;
  height?: number;
  format?: "money" | "number";
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const padX = 3;
  const padTop = 24;
  const padBottom = 6;
  const n = points.length;
  const fmt = (v: number) =>
    format === "money" ? formatMoneyShort(v) : formatCountShort(v);
  const fmtFull = (v: number) =>
    format === "money"
      ? formatMoney(v)
      : Math.round(v).toLocaleString("es-CL");
  const coords = points.map((p, i) => {
    const x = n <= 1 ? 50 : padX + (i / (n - 1)) * (100 - padX * 2);
    const y = padTop + (1 - p.value / max) * (100 - padTop - padBottom);
    return { x, y, ...p };
  });
  const line = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const area =
    n > 0
      ? `${line} L${coords[n - 1].x.toFixed(2)} 100 L${coords[0].x.toFixed(2)} 100 Z`
      : "";

  const dayLabelEvery = Math.max(1, Math.ceil(n / 8));

  // Monto visible en cada día con venta (alterna altura para reducir solape).
  const labeledIdx = coords
    .map((c, i) => (c.value > 0 ? i : -1))
    .filter((i) => i >= 0);

  return (
    <div className="fin-line-chart" style={{ height }} role="img">
      <div className="fin-line-scale" aria-hidden>
        <span>{fmt(max)}</span>
        <span>{format === "money" ? "$0" : "0"}</span>
      </div>
      <div className="fin-line-body">
        <div className="fin-line-plot">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="fin-line-svg"
          >
            <line
              x1={padX}
              y1={padTop}
              x2={100 - padX}
              y2={padTop}
              stroke="#e5e7eb"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={padX}
              y1={(padTop + 100 - padBottom) / 2}
              x2={100 - padX}
              y2={(padTop + 100 - padBottom) / 2}
              stroke="#f3f4f6"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <path d={area} fill={color} opacity="0.12" />
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {coords.map((c, i) =>
            c.value > 0 ? (
              <span
                key={`dot-${i}`}
                className="fin-line-dot"
                style={{
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  background: color,
                }}
                title={`${c.label}: ${fmtFull(c.value)}`}
              />
            ) : null,
          )}
          {labeledIdx.map((i, order) => {
            const c = coords[i];
            if (!c || c.value <= 0) return null;
            const stagger = order % 2 === 0 ? 0 : 12;
            return (
              <span
                key={`amt-${i}`}
                className="fin-line-amt"
                style={{
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  transform: `translate(-50%, calc(-100% - ${6 + stagger}px))`,
                }}
                title={fmtFull(c.value)}
              >
                {fmt(c.value)}
              </span>
            );
          })}
        </div>
        <div className="fin-line-labels">
          {points.map((p, i) => (
            <span
              key={`lb-${i}`}
              className="fin-line-label"
              style={{
                opacity: i % dayLabelEvery === 0 || i === n - 1 ? 1 : 0,
              }}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupedBarChart({
  bars,
}: {
  bars: { label: string; a: number; b: number }[];
}) {
  const max = Math.max(1, ...bars.flatMap((d) => [d.a, d.b]));
  return (
    <div className="fin-bars" role="img">
      {bars.map((d) => (
        <div key={d.label} className="fin-bar-group">
          <span className="fin-bar-value" title={`${formatMoney(d.a)} / ${formatMoney(d.b)}`}>
            {formatMoneyShort(d.a)}
            <em>/{formatMoneyShort(d.b)}</em>
          </span>
          <div className="fin-bar-pair">
            <span
              className="fin-bar fin-bar-ingreso"
              style={{ height: `${Math.max(4, (d.a / max) * 100)}%` }}
              title={formatMoney(d.a)}
            />
            <span
              className="fin-bar fin-bar-gasto"
              style={{ height: `${Math.max(4, (d.b / max) * 100)}%` }}
              title={formatMoney(d.b)}
            />
          </div>
          <span className="fin-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HourBars({
  hours,
}: {
  hours: { hour: number; value: number }[];
}) {
  const max = Math.max(1, ...hours.map((h) => h.value));
  return (
    <div className="fin-hour-bars" role="img" aria-label="Ventas por hora">
      {hours.map((h) => (
        <div key={h.hour} className="fin-hour-col">
          <span className="fin-hour-value">{formatMoneyShort(h.value)}</span>
          <span
            className="fin-hour-bar"
            style={{ height: `${Math.max(h.value > 0 ? 8 : 2, (h.value / max) * 100)}%` }}
            title={`${h.hour}:00 · ${formatMoney(h.value)}`}
          />
          <span className="fin-hour-label">
            {String(h.hour).padStart(2, "0")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FinanzasPage({
  kpis,
  ventas,
  productos,
  categorias,
  caja,
  movimientos,
  lotes,
  stockResumen,
  inversiones,
  kitBoms,
  onOpenMenu,
  onGoCompra,
  onFetchCajasPorFecha,
  onFetchVentasCaja,
  onFetchTransaccionesCaja,
  onFetchVentasPeriodo,
  onAnularVenta,
}: FinanzasPageProps) {
  const [tab, setTab] = useState<FinTab>("resumen");
  const hoy = todayIso();
  const mesActual = hoy.slice(0, 7);
  const anioActual = hoy.slice(0, 4);
  const [fechaCajas, setFechaCajas] = useState(hoy);
  const [fechaChicaDesde, setFechaChicaDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [fechaChicaHasta, setFechaChicaHasta] = useState(hoy);
  const [fechaKitsDesde, setFechaKitsDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [fechaKitsHasta, setFechaKitsHasta] = useState(hoy);
  const [fechaMermasDesde, setFechaMermasDesde] = useState(
    `${hoy.slice(0, 7)}-01`,
  );
  const [fechaMermasHasta, setFechaMermasHasta] = useState(hoy);
  const [ventasAnio, setVentasAnio] = useState<FinVenta[]>([]);
  const [loadingVentasAnio, setLoadingVentasAnio] = useState(false);
  const [cajasDelDia, setCajasDelDia] = useState<FinCajaDelDia[]>([]);
  const [loadingCajas, setLoadingCajas] = useState(false);
  const [cajasError, setCajasError] = useState<string | null>(null);
  const [expandedCaja, setExpandedCaja] = useState<Record<number, boolean>>({});
  const [ventasPorCaja, setVentasPorCaja] = useState<
    Record<number, FinCajaVenta[]>
  >({});
  const [txsPorCaja, setTxsPorCaja] = useState<Record<number, FinCajaTx[]>>({});
  const [loadingVentasCaja, setLoadingVentasCaja] = useState<
    Record<number, boolean>
  >({});
  const [errorVentasCaja, setErrorVentasCaja] = useState<
    Record<number, string>
  >({});
  const [expandedOrden, setExpandedOrden] = useState<Record<number, boolean>>(
    {},
  );
  const [anulandoId, setAnulandoId] = useState<number | null>(null);
  const [metricModal, setMetricModal] = useState<MetricModalId>(null);
  const [gastosMes, setGastosMes] = useState<number | null>(null);
  const [gastosMesItems, setGastosMesItems] = useState<FinGastoMesItem[]>([]);
  const [gastosPorDia, setGastosPorDia] = useState<Record<string, number>>({});
  const [loadingGastosMes, setLoadingGastosMes] = useState(false);

  useEffect(() => {
    if (tab !== "resumen") return;
    let cancelled = false;
    setLoadingGastosMes(true);
    const [y, m] = mesActual.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const dates = Array.from(
      { length: daysInMonth },
      (_, i) => `${mesActual}-${String(i + 1).padStart(2, "0")}`,
    );

    void (async () => {
      try {
        const results = await Promise.all(
          dates.map((d) => onFetchCajasPorFecha(d).catch(() => [] as FinCajaDelDia[])),
        );
        if (cancelled) return;
        const allCajas = results.flat();
        const totalEgresos = allCajas.reduce(
          (s, c) => s + (c.cuadre?.egresos_efectivo ?? 0),
          0,
        );
        setGastosMes(totalEgresos);

        const withGastos = allCajas.filter(
          (c) => (c.cuadre?.egresos_efectivo ?? 0) > 0,
        );
        const nested = await Promise.all(
          withGastos.map(async (c) => {
            const txs = await onFetchTransaccionesCaja(c.id).catch(
              () => [] as FinCajaTx[],
            );
            return txs
              .filter((t) => isGastoTx(t.tipo_transaccion))
              .map(
                (t): FinGastoMesItem => ({
                  ...t,
                  caja_fecha: c.fecha,
                  caja_numero: c.numero,
                }),
              );
          }),
        );
        if (cancelled) return;
        const items = nested.flat().sort((a, b) =>
          b.fecha_hora.localeCompare(a.fecha_hora),
        );
        setGastosMesItems(items);
        const byDay: Record<string, number> = {};
        for (const g of items) {
          const k = dayKey(g.fecha_hora);
          byDay[k] = (byDay[k] ?? 0) + g.monto;
        }
        setGastosPorDia(byDay);
      } catch {
        if (!cancelled) {
          setGastosMes(caja?.cuadre?.egresos_efectivo ?? 0);
          setGastosMesItems([]);
          setGastosPorDia({});
        }
      } finally {
        if (!cancelled) setLoadingGastosMes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    tab,
    mesActual,
    onFetchCajasPorFecha,
    onFetchTransaccionesCaja,
    caja?.cuadre?.egresos_efectivo,
  ]);

  useEffect(() => {
    if (tab !== "cajas") return;
    let cancelled = false;
    setLoadingCajas(true);
    setCajasError(null);
    setExpandedCaja({});
    setVentasPorCaja({});
    setTxsPorCaja({});
    setErrorVentasCaja({});
    setExpandedOrden({});
    void onFetchCajasPorFecha(fechaCajas)
      .then((rows) => {
        if (!cancelled) setCajasDelDia(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCajasDelDia([]);
          setCajasError(
            err instanceof Error ? err.message : "No se pudieron cargar las cajas",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCajas(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, fechaCajas, onFetchCajasPorFecha]);

  useEffect(() => {
    if (tab !== "kpis") return;
    let cancelled = false;
    setLoadingVentasAnio(true);
    void onFetchVentasPeriodo(`${anioActual}-01-01`, hoy)
      .then((rows) => {
        if (!cancelled) setVentasAnio(rows);
      })
      .catch(() => {
        if (!cancelled) setVentasAnio([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingVentasAnio(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, anioActual, hoy, onFetchVentasPeriodo]);

  async function toggleCajaOrdenes(cajaId: number) {
    const willOpen = !expandedCaja[cajaId];
    setExpandedCaja((prev) => ({ ...prev, [cajaId]: willOpen }));
    if (!willOpen || ventasPorCaja[cajaId]) return;

    setLoadingVentasCaja((prev) => ({ ...prev, [cajaId]: true }));
    setErrorVentasCaja((prev) => {
      const next = { ...prev };
      delete next[cajaId];
      return next;
    });
    try {
      const [rows, txs] = await Promise.all([
        onFetchVentasCaja(cajaId),
        onFetchTransaccionesCaja(cajaId),
      ]);
      setVentasPorCaja((prev) => ({ ...prev, [cajaId]: rows }));
      setTxsPorCaja((prev) => ({ ...prev, [cajaId]: txs }));
    } catch (err: unknown) {
      setErrorVentasCaja((prev) => ({
        ...prev,
        [cajaId]:
          err instanceof Error ? err.message : "No se pudieron cargar las órdenes",
      }));
    } finally {
      setLoadingVentasCaja((prev) => ({ ...prev, [cajaId]: false }));
    }
  }

  async function handleAnular(
    cajaId: number,
    ventaId: number,
    ventaNumero?: number,
  ) {
    if (
      !window.confirm(
        `¿Anular la venta #${ventaNumero ?? ventaId}? Se devolverá el stock a los lotes originales.`,
      )
    ) {
      return;
    }
    setAnulandoId(ventaId);
    try {
      await onAnularVenta(ventaId);
      const [rows, txs] = await Promise.all([
        onFetchVentasCaja(cajaId),
        onFetchTransaccionesCaja(cajaId),
      ]);
      setVentasPorCaja((prev) => ({ ...prev, [cajaId]: rows }));
      setTxsPorCaja((prev) => ({ ...prev, [cajaId]: txs }));
    } catch {
      /* error handled upstream */
    } finally {
      setAnulandoId(null);
    }
  }

  const totalCajasDia = useMemo(
    () =>
      cajasDelDia.reduce((s, c) => s + (c.cuadre?.total_ventas ?? 0), 0),
    [cajasDelDia],
  );

  const prodById = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos],
  );
  const catById = useMemo(
    () => new Map(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );
  const kitIds = useMemo(
    () => new Set(productos.filter((p) => p.tipo === "KIT").map((p) => p.id)),
    [productos],
  );

  const mermas = useMemo(
    () => movimientos.filter((m) => m.tipo_movimiento === "SALIDA_MERMA"),
    [movimientos],
  );

  const inversionPorMes = useMemo(() => {
    if (inversiones?.por_mes?.length) {
      return inversiones.por_mes.slice(0, 6);
    }
    return [];
  }, [inversiones]);

  const inversionTotal = inversiones?.total_periodo ?? 0;

  const mermaMes = useMemo(
    () =>
      mermas
        .filter((m) => monthKey(m.fecha_hora) === mesActual)
        .reduce((s, m) => s + mermaValor(m), 0),
    [mermas, mesActual],
  );

  const gastos = gastosMes ?? (caja?.cuadre?.egresos_efectivo ?? 0);
  const ventaMes = kpis?.venta_mensual ?? 0;
  const utilidadBruta = kpis?.ganancia_mensual ?? 0;
  const costoMes = Math.max(0, ventaMes - utilidadBruta);
  const margenPct =
    ventaMes > 0 ? (utilidadBruta / ventaMes) * 100 : 0;
  const gananciasBrutas = utilidadBruta;
  const gananciasNetas = utilidadBruta - gastos - mermaMes;
  const flujoCaja = ventaMes - gastos - mermaMes;

  const ventasDelMes = useMemo(
    () => ventas.filter((v) => monthKey(v.fecha_hora) === mesActual),
    [ventas, mesActual],
  );
  const mermasDelMes = useMemo(
    () => mermas.filter((m) => monthKey(m.fecha_hora) === mesActual),
    [mermas, mesActual],
  );

  const weeklyBars = useMemo(() => {
    const days: { label: string; a: number; b: number }[] = [];
    const labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(12, 0, 0, 0);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const jsDay = d.getDay();
      const label = labels[jsDay === 0 ? 6 : jsDay - 1];
      const dayVentas = ventas.filter((v) => dayKey(v.fecha_hora) === key);
      const ingresos = dayVentas.reduce((s, v) => s + v.total_venta, 0);
      const cogs = dayVentas.reduce((s, v) => {
        const costo =
          v.costo_total ?? Math.max(0, v.total_venta - v.ganancia);
        return s + costo;
      }, 0);
      const mermaDia = mermas
        .filter((m) => dayKey(m.fecha_hora) === key)
        .reduce((s, m) => s + mermaValor(m), 0);
      const egreso = gastosPorDia[key] ?? 0;
      days.push({ label, a: ingresos, b: cogs + mermaDia + egreso });
    }
    return days;
  }, [ventas, mermas, gastosPorDia]);

  const mermaDailyBars = useMemo(() => {
    const now = new Date();
    const bars: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setHours(12, 0, 0, 0);
      d.setDate(now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = String(d.getDate()).padStart(2, "0");
      const value = mermas
        .filter((m) => dayKey(m.fecha_hora) === key)
        .reduce((s, m) => s + mermaValor(m), 0);
      bars.push({ label, value });
    }
    return bars;
  }, [mermas]);

  const ventasMesPoints = useMemo(() => {
    const [y, m] = mesActual.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDay = new Map<string, number>();
    for (const v of ventas) {
      if (monthKey(v.fecha_hora) !== mesActual) continue;
      const k = dayKey(v.fecha_hora);
      byDay.set(k, (byDay.get(k) ?? 0) + v.total_venta);
    }
    const points: { label: string; value: number }[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${mesActual}-${String(day).padStart(2, "0")}`;
      points.push({
        label: String(day),
        value: byDay.get(key) ?? 0,
      });
    }
    return points;
  }, [ventas, mesActual]);

  // —— Caja chica (resumen de ventas por rango) ——
  const chicaRango = useMemo(() => {
    const desde =
      fechaChicaDesde <= fechaChicaHasta ? fechaChicaDesde : fechaChicaHasta;
    const hasta =
      fechaChicaDesde <= fechaChicaHasta ? fechaChicaHasta : fechaChicaDesde;
    return { desde, hasta };
  }, [fechaChicaDesde, fechaChicaHasta]);

  const ventasChica = useMemo(
    () =>
      ventas.filter((v) => {
        const d = dayKey(v.fecha_hora);
        return d >= chicaRango.desde && d <= chicaRango.hasta;
      }),
    [ventas, chicaRango],
  );

  const chicaNumVentas = ventasChica.length;
  const chicaMontoTotal = ventasChica.reduce((s, v) => s + v.total_venta, 0);
  const chicaProductosVendidos = ventasChica.reduce(
    (acc, v) =>
      acc + (v.items?.reduce((s, it) => s + Number(it.cantidad), 0) ?? 0),
    0,
  );

  const catSlices = useMemo(() => {
    const totals = new Map<string, number>();
    for (const v of ventasChica) {
      for (const it of v.items ?? []) {
        const prod =
          (it.producto_id != null ? prodById.get(it.producto_id) : undefined) ??
          [...prodById.values()].find((p) => p.nombre === it.producto_nombre);
        const nombre =
          (prod?.categoria_id != null
            ? catById.get(prod.categoria_id)
            : null) ?? "Sin categoría";
        totals.set(nombre, (totals.get(nombre) ?? 0) + it.subtotal);
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], i) => ({
        label,
        value,
        color: PIE_COLORS[i % PIE_COLORS.length],
      }));
  }, [ventasChica, prodById, catById]);

  const mejorMes = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const v of ventasChica) {
      const k = monthKey(v.fecha_hora);
      byMonth.set(k, (byMonth.get(k) ?? 0) + v.total_venta);
    }
    let best: { mes: string; total: number } | null = null;
    for (const [mes, total] of byMonth) {
      if (!best || total > best.total) best = { mes, total };
    }
    return best;
  }, [ventasChica]);

  const mejorDiaPorMes = useMemo(() => {
    const byMonthDay = new Map<string, Map<string, number>>();
    for (const v of ventasChica) {
      const mk = monthKey(v.fecha_hora);
      const dk = dayKey(v.fecha_hora);
      if (!byMonthDay.has(mk)) byMonthDay.set(mk, new Map());
      const days = byMonthDay.get(mk)!;
      days.set(dk, (days.get(dk) ?? 0) + v.total_venta);
    }
    return [...byMonthDay.entries()]
      .map(([mes, days]) => {
        let bestDay = "";
        let bestTotal = -1;
        for (const [day, total] of days) {
          if (total > bestTotal) {
            bestDay = day;
            bestTotal = total;
          }
        }
        return { mes, dia: bestDay, total: bestTotal };
      })
      .sort((a, b) => b.mes.localeCompare(a.mes));
  }, [ventasChica]);

  const chicaTrendMonto = useMemo(() => {
    const days = eachDayIso(chicaRango.desde, chicaRango.hasta);
    const byDay = new Map<string, number>();
    for (const v of ventasChica) {
      const k = dayKey(v.fecha_hora);
      byDay.set(k, (byDay.get(k) ?? 0) + v.total_venta);
    }
    return days.map((d) => ({
      label: d.slice(8),
      value: byDay.get(d) ?? 0,
    }));
  }, [ventasChica, chicaRango]);

  const chicaTrendCantidad = useMemo(() => {
    const days = eachDayIso(chicaRango.desde, chicaRango.hasta);
    const byDay = new Map<string, number>();
    for (const v of ventasChica) {
      const k = dayKey(v.fecha_hora);
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    return days.map((d) => ({
      label: d.slice(8),
      value: byDay.get(d) ?? 0,
    }));
  }, [ventasChica, chicaRango]);

  const chicaTrendUnidades = useMemo(() => {
    const days = eachDayIso(chicaRango.desde, chicaRango.hasta);
    const byDay = new Map<string, number>();
    for (const v of ventasChica) {
      const k = dayKey(v.fecha_hora);
      const qty =
        v.items?.reduce((s, it) => s + Number(it.cantidad), 0) ?? 0;
      byDay.set(k, (byDay.get(k) ?? 0) + qty);
    }
    return days.map((d) => ({
      label: d.slice(8),
      value: byDay.get(d) ?? 0,
    }));
  }, [ventasChica, chicaRango]);

  // —— Kits ——
  const kitsRango = useMemo(() => {
    const desde =
      fechaKitsDesde <= fechaKitsHasta ? fechaKitsDesde : fechaKitsHasta;
    const hasta =
      fechaKitsDesde <= fechaKitsHasta ? fechaKitsHasta : fechaKitsDesde;
    return { desde, hasta };
  }, [fechaKitsDesde, fechaKitsHasta]);

  const ventasKitsRango = useMemo(
    () =>
      ventas.filter((v) => {
        const d = dayKey(v.fecha_hora);
        return d >= kitsRango.desde && d <= kitsRango.hasta;
      }),
    [ventas, kitsRango],
  );

  const bomByKitId = useMemo(() => {
    const map = new Map<number, KitBom>();
    for (const b of kitBoms) map.set(b.kitId, b);
    return map;
  }, [kitBoms]);

  const kitPerfRows = useMemo(() => {
    const days = eachDayIso(kitsRango.desde, kitsRango.hasta);
    const dias = Math.max(1, days.length);
    const kitProducts = productos.filter((p) => p.tipo === "KIT");

    type Acc = {
      kitQty: number;
      kitRevenue: number;
      looseByComp: Map<number, number>;
    };
    const acc = new Map<number, Acc>();
    for (const p of kitProducts) {
      acc.set(p.id, {
        kitQty: 0,
        kitRevenue: 0,
        looseByComp: new Map(),
      });
    }

    const isKitItem = (it: FinVentaItem) => {
      if (it.producto_id != null && kitIds.has(it.producto_id)) return true;
      return productos.some(
        (p) => p.tipo === "KIT" && p.nombre === it.producto_nombre,
      );
    };

    for (const v of ventasKitsRango) {
      for (const it of v.items ?? []) {
        if (isKitItem(it)) {
          const kid =
            it.producto_id != null && kitIds.has(it.producto_id)
              ? it.producto_id
              : productos.find(
                  (p) => p.tipo === "KIT" && p.nombre === it.producto_nombre,
                )?.id;
          if (kid == null) continue;
          const row = acc.get(kid);
          if (!row) continue;
          row.kitQty += Number(it.cantidad);
          row.kitRevenue += it.subtotal;
          continue;
        }
        const pid = it.producto_id;
        if (pid == null) continue;
        for (const [kitId, row] of acc) {
          const bom = bomByKitId.get(kitId);
          if (!bom?.componentes.some((c) => c.productoId === pid)) continue;
          row.looseByComp.set(
            pid,
            (row.looseByComp.get(pid) ?? 0) + Number(it.cantidad),
          );
        }
      }
    }

    const rows = kitProducts.map((p) => {
      const bom = bomByKitId.get(p.id);
      const a = acc.get(p.id)!;
      let equivLoose = 0;
      const hasBom = Boolean(bom && bom.componentes.length > 0);
      if (hasBom && bom) {
        let n = Infinity;
        for (const c of bom.componentes) {
          const have = a.looseByComp.get(c.productoId) ?? 0;
          const need = Number(c.cantidad);
          if (need <= 0) continue;
          n = Math.min(n, Math.floor((have + 1e-9) / need));
        }
        equivLoose = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      }
      const totalForms = a.kitQty + equivLoose;
      const mix = totalForms > 0 ? (a.kitQty / totalForms) * 100 : 0;
      const velKit = a.kitQty / dias;
      const velLoose = equivLoose / dias;
      let velocidadTxt = "Sin movimiento en el rango";
      if (a.kitQty > 0 && equivLoose <= 0) {
        velocidadTxt = "Solo se vende como kit";
      } else if (a.kitQty <= 0 && equivLoose > 0) {
        velocidadTxt = "Solo se vende en partes sueltas";
      } else if (a.kitQty > 0 && equivLoose > 0) {
        const ratio = velKit / velLoose;
        if (ratio >= 1) {
          velocidadTxt = `El kit sale ${ratio.toLocaleString("es-CL", {
            maximumFractionDigits: 1,
          })}× más rápido que las partes`;
        } else {
          velocidadTxt = `Las partes salen ${(1 / ratio).toLocaleString("es-CL", {
            maximumFractionDigits: 1,
          })}× más rápido que el kit`;
        }
      } else if (!hasBom) {
        velocidadTxt = "Sin receta BOM para comparar";
      }

      const componentesLabel = bom?.componentes.length
        ? bom.componentes
            .map((c) => {
              const nombre =
                prodById.get(c.productoId)?.nombre ?? `#${c.productoId}`;
              return `${Number(c.cantidad).toLocaleString("es-CL")}× ${nombre}`;
            })
            .join(" · ")
        : "Sin receta configurada";

      const precio =
        bom?.precioVenta ?? p.precio_venta ?? 0;

      return {
        kitId: p.id,
        nombre: p.nombre,
        precioVenta: precio,
        hasBom,
        componentesLabel,
        kitQty: a.kitQty,
        kitRevenue: a.kitRevenue,
        equivLoose,
        mix,
        velKit,
        velLoose,
        velocidadTxt,
      };
    });

    return rows.sort(
      (a, b) =>
        b.kitRevenue - a.kitRevenue ||
        b.kitQty - a.kitQty ||
        a.nombre.localeCompare(b.nombre),
    );
  }, [
    productos,
    kitIds,
    bomByKitId,
    ventasKitsRango,
    kitsRango,
    prodById,
  ]);

  const kitsIngresos = kitPerfRows.reduce((s, r) => s + r.kitRevenue, 0);
  const kitsUsos = kitPerfRows.reduce((s, r) => s + r.kitQty, 0);
  const kitsEquivTotal = kitPerfRows.reduce((s, r) => s + r.equivLoose, 0);
  const kitsMixGlobal =
    kitsUsos + kitsEquivTotal > 0
      ? (kitsUsos / (kitsUsos + kitsEquivTotal)) * 100
      : 0;
  const kitsConMovimiento = kitPerfRows.filter(
    (r) => r.kitQty > 0 || r.equivLoose > 0,
  ).length;

  const kitsTrend = useMemo(() => {
    const days = eachDayIso(kitsRango.desde, kitsRango.hasta);
    const kitByDay = new Map<string, number>();
    const looseAccByDay = new Map<
      string,
      Map<number, Map<number, number>>
    >();
    // day -> kitId -> compId -> qty

    const isKitItem = (it: FinVentaItem) => {
      if (it.producto_id != null && kitIds.has(it.producto_id)) return true;
      return productos.some(
        (p) => p.tipo === "KIT" && p.nombre === it.producto_nombre,
      );
    };

    for (const v of ventasKitsRango) {
      const d = dayKey(v.fecha_hora);
      for (const it of v.items ?? []) {
        if (isKitItem(it)) {
          kitByDay.set(d, (kitByDay.get(d) ?? 0) + Number(it.cantidad));
          continue;
        }
        const pid = it.producto_id;
        if (pid == null) continue;
        for (const bom of kitBoms) {
          if (!bom.componentes.some((c) => c.productoId === pid)) continue;
          if (!looseAccByDay.has(d)) looseAccByDay.set(d, new Map());
          const byKit = looseAccByDay.get(d)!;
          if (!byKit.has(bom.kitId)) byKit.set(bom.kitId, new Map());
          const comps = byKit.get(bom.kitId)!;
          comps.set(pid, (comps.get(pid) ?? 0) + Number(it.cantidad));
        }
      }
    }

    const kitPoints: { label: string; value: number }[] = [];
    const loosePoints: { label: string; value: number }[] = [];
    for (const d of days) {
      kitPoints.push({ label: d.slice(8), value: kitByDay.get(d) ?? 0 });
      let equiv = 0;
      const byKit = looseAccByDay.get(d);
      if (byKit) {
        for (const bom of kitBoms) {
          const comps = byKit.get(bom.kitId);
          if (!comps || !bom.componentes.length) continue;
          let n = Infinity;
          for (const c of bom.componentes) {
            const have = comps.get(c.productoId) ?? 0;
            const need = Number(c.cantidad);
            if (need <= 0) continue;
            n = Math.min(n, Math.floor((have + 1e-9) / need));
          }
          if (Number.isFinite(n)) equiv += Math.max(0, Math.floor(n));
        }
      }
      loosePoints.push({ label: d.slice(8), value: equiv });
    }
    return { kitPoints, loosePoints };
  }, [kitsRango, ventasKitsRango, kitIds, productos, kitBoms]);

  // —— Mermas (tab dedicado) ——
  const mermasRango = useMemo(() => {
    const desde =
      fechaMermasDesde <= fechaMermasHasta
        ? fechaMermasDesde
        : fechaMermasHasta;
    const hasta =
      fechaMermasDesde <= fechaMermasHasta
        ? fechaMermasHasta
        : fechaMermasDesde;
    return { desde, hasta };
  }, [fechaMermasDesde, fechaMermasHasta]);

  const mermasFiltradas = useMemo(
    () =>
      mermas.filter((m) => {
        const d = dayKey(m.fecha_hora);
        return d >= mermasRango.desde && d <= mermasRango.hasta;
      }),
    [mermas, mermasRango],
  );

  const mermaTabValor = useMemo(
    () => mermasFiltradas.reduce((s, m) => s + mermaValor(m), 0),
    [mermasFiltradas],
  );
  const mermaTabUnidades = useMemo(
    () => mermasFiltradas.reduce((s, m) => s + Math.abs(Number(m.cantidad)), 0),
    [mermasFiltradas],
  );
  const mermaTabMovimientos = mermasFiltradas.length;

  const ventaRangoMerma = useMemo(
    () =>
      ventas
        .filter((v) => {
          const d = dayKey(v.fecha_hora);
          return d >= mermasRango.desde && d <= mermasRango.hasta;
        })
        .reduce((s, v) => s + v.total_venta, 0),
    [ventas, mermasRango],
  );
  const mermaTabPctVentas =
    ventaRangoMerma > 0
      ? (mermaTabValor / ventaRangoMerma) * 100
      : mermaTabValor > 0
        ? 100
        : 0;

  const mermaTabPorProducto = useMemo(() => {
    const byProd = new Map<
      number,
      { nombre: string; valor: number; unidades: number; movimientos: number }
    >();
    for (const m of mermasFiltradas) {
      const prev = byProd.get(m.producto_id) ?? {
        nombre:
          prodById.get(m.producto_id)?.nombre ?? `Producto #${m.producto_id}`,
        valor: 0,
        unidades: 0,
        movimientos: 0,
      };
      prev.valor += mermaValor(m);
      prev.unidades += Math.abs(Number(m.cantidad));
      prev.movimientos += 1;
      byProd.set(m.producto_id, prev);
    }
    return [...byProd.entries()]
      .map(([productoId, row]) => ({ productoId, ...row }))
      .sort((a, b) => b.valor - a.valor);
  }, [mermasFiltradas, prodById]);

  const mermaTabSlices = useMemo(
    () =>
      mermaTabPorProducto.slice(0, 8).map((row, i) => ({
        label: row.nombre,
        value: row.valor,
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
    [mermaTabPorProducto],
  );

  const mermaTrendValor = useMemo(() => {
    const days = eachDayIso(mermasRango.desde, mermasRango.hasta);
    const byDay = new Map<string, number>();
    for (const m of mermasFiltradas) {
      const k = dayKey(m.fecha_hora);
      byDay.set(k, (byDay.get(k) ?? 0) + mermaValor(m));
    }
    return days.map((d) => ({
      label: d.slice(8),
      value: byDay.get(d) ?? 0,
    }));
  }, [mermasFiltradas, mermasRango]);

  const mermaTrendUnidades = useMemo(() => {
    const days = eachDayIso(mermasRango.desde, mermasRango.hasta);
    const byDay = new Map<string, number>();
    for (const m of mermasFiltradas) {
      const k = dayKey(m.fecha_hora);
      byDay.set(k, (byDay.get(k) ?? 0) + Math.abs(Number(m.cantidad)));
    }
    return days.map((d) => ({
      label: d.slice(8),
      value: byDay.get(d) ?? 0,
    }));
  }, [mermasFiltradas, mermasRango]);

  // —— KPIs (año calendario) ——
  const ventaAnio = kpis?.venta_anual ?? 0;
  const utilidadAnio = kpis?.ganancia_anual ?? 0;
  const numVentasAnio = kpis?.num_ventas_anio ?? 0;
  const gastosAnio = kpis?.gastos_anuales ?? 0;
  const mermaAnio = kpis?.merma_anual ?? 0;
  const margenAnioPct =
    ventaAnio > 0 ? (utilidadAnio / ventaAnio) * 100 : 0;
  const flujoAnio = ventaAnio - gastosAnio - mermaAnio;
  const costoAnio = Math.max(0, ventaAnio - utilidadAnio);

  const ventaPromedio =
    numVentasAnio > 0
      ? ventaAnio / numVentasAnio
      : ventasAnio.length > 0
        ? ventasAnio.reduce((s, v) => s + v.total_venta, 0) / ventasAnio.length
        : 0;

  const ventasPorDia = useMemo(() => {
    const byDay = new Map<string, { monto: number; ventas: number }>();
    for (const v of ventasAnio) {
      const k = dayKey(v.fecha_hora);
      if (!k.startsWith(anioActual)) continue;
      const prev = byDay.get(k) ?? { monto: 0, ventas: 0 };
      byDay.set(k, {
        monto: prev.monto + v.total_venta,
        ventas: prev.ventas + 1,
      });
    }
    const diasConVenta = byDay.size;
    const start = new Date(`${anioActual}-01-01T12:00:00`);
    const end = new Date(`${hoy}T12:00:00`);
    const diasCalendario = Math.max(
      1,
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1,
    );
    const dias = diasConVenta > 0 ? diasConVenta : diasCalendario;

    let montoTotal = ventaAnio;
    let ventasTotal = numVentasAnio;
    if (montoTotal <= 0) {
      for (const d of byDay.values()) {
        montoTotal += d.monto;
        ventasTotal += d.ventas;
      }
    }

    if (montoTotal <= 0) {
      return {
        montoPromedio: 0,
        ventasPromedio: 0,
        dias: 0,
        usaDiasConVenta: false,
      };
    }

    return {
      montoPromedio: montoTotal / dias,
      ventasPromedio: ventasTotal / dias,
      dias,
      usaDiasConVenta: diasConVenta > 0,
    };
  }, [ventasAnio, anioActual, hoy, ventaAnio, numVentasAnio]);

  const productosAnioVendidos = useMemo(
    () =>
      ventasAnio.reduce(
        (acc, v) =>
          acc + (v.items?.reduce((s, it) => s + Number(it.cantidad), 0) ?? 0),
        0,
      ),
    [ventasAnio],
  );
  const productosPromedioPorVenta =
    ventasAnio.length > 0
      ? productosAnioVendidos / ventasAnio.length
      : numVentasAnio > 0
        ? productosAnioVendidos / numVentasAnio
        : 0;

  const horas = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, hour) => ({ hour, value: 0 }));
    for (const v of ventasAnio) {
      const d = new Date(v.fecha_hora);
      if (Number.isNaN(d.getTime())) continue;
      arr[d.getHours()].value += v.total_venta;
    }
    const active = arr.filter((h) => h.value > 0);
    const minH = active.length ? Math.min(...active.map((h) => h.hour), 8) : 8;
    const maxH = active.length ? Math.max(...active.map((h) => h.hour), 21) : 21;
    return arr.slice(Math.min(minH, 8), Math.max(maxH, 21) + 1);
  }, [ventasAnio]);

  const valorInventario = useMemo(
    () =>
      lotes.reduce(
        (s, l) => s + Number(l.cantidad_actual) * (l.costo_unitario_real || 0),
        0,
      ),
    [lotes],
  );

  const cogsPeriodo = useMemo(() => {
    if (costoAnio > 0) return costoAnio;
    return ventasAnio.reduce((s, v) => {
      const costo =
        v.costo_total ?? Math.max(0, v.total_venta - v.ganancia);
      return s + costo;
    }, 0);
  }, [costoAnio, ventasAnio]);

  const rotacion =
    valorInventario > 0 ? cogsPeriodo / valorInventario : 0;

  const valorPorVencer = useMemo(() => {
    const costoByProd = new Map<number, number>();
    for (const l of lotes) {
      costoByProd.set(l.producto_id, l.costo_unitario_real);
    }
    return (kpis?.productos_por_vencer ?? []).reduce((s, p) => {
      const prodId =
        p.producto_id ?? productos.find((x) => x.nombre === p.nombre)?.id;
      const costo = prodId != null ? (costoByProd.get(prodId) ?? 0) : 0;
      const qty = Number(p.cantidad_actual ?? 0);
      return s + qty * costo;
    }, 0);
  }, [kpis, lotes, productos]);

  const mermaPctVentas =
    ventaAnio > 0 ? (mermaAnio / ventaAnio) * 100 : mermaAnio > 0 ? 100 : 0;

  const bajoStock = stockResumen.filter((s) => s.alerta_bajo_stock).length;
  const catalogoActivo = Math.max(stockResumen.length, 1);
  const tasaQuiebre = (bajoStock / catalogoActivo) * 100;

  const costosFijosProxy = Math.max(gastosAnio, 0);
  const puntoEquilibrio =
    margenAnioPct > 0
      ? Math.round(costosFijosProxy / (margenAnioPct / 100))
      : 0;

  const metricCards: {
    id: Exclude<MetricModalId, null>;
    label: string;
    value: string;
    hint: string;
  }[] = [
    {
      id: "flujo",
      label: "Flujo de caja",
      value: formatClp(flujoCaja),
      hint: "Ventas − gastos − merma (mes)",
    },
    {
      id: "utilidad",
      label: "Utilidad bruta",
      value: formatPct(margenPct),
      hint: "Margen sobre ventas del mes",
    },
    {
      id: "gastos",
      label: "Gastos",
      value: loadingGastosMes && gastosMes == null ? "…" : formatClp(gastos),
      hint: "Egresos del mes en caja",
    },
    {
      id: "merma",
      label: "Merma",
      value: formatClp(mermaMes),
      hint: "SALIDA_MERMA del mes",
    },
    {
      id: "ganancias-netas",
      label: "Ganancias netas",
      value: formatClp(gananciasNetas),
      hint: "Bruta − gastos − merma",
    },
    {
      id: "ganancias-brutas",
      label: "Ganancias brutas",
      value: formatClp(gananciasBrutas),
      hint: "Ventas − costo FIFO (mes)",
    },
  ];

  const kpiCards: {
    title: string;
    value: string;
    detail?: string;
    desc: string;
    chart?: "hours";
  }[] = [
    {
      title: "Margen de utilidad bruta",
      value: formatPct(margenAnioPct),
      detail: `${formatMoney(utilidadAnio)} de ${formatMoney(ventaAnio)} · año ${anioActual}`,
      desc: "Porcentaje de los ingresos del año que queda libre tras descontar el costo de adquisición. Vital para fijar precios en CLP frente a inflación o alza de proveedores.",
    },
    {
      title: "Flujo de caja (Cash Flow)",
      value: formatClp(flujoAnio),
      detail: `Ingresos año ${formatMoney(ventaAnio)} · gastos ${formatMoney(gastosAnio)} · merma ${formatMoney(mermaAnio)}`,
      desc: "Dinero real que entra y sale en el año (ventas − gastos de caja − merma). Un negocio puede ser rentable en papel, pero sin efectivo puede quebrar.",
    },
    {
      title: "Punto de equilibrio",
      value: puntoEquilibrio > 0 ? formatClp(puntoEquilibrio) : "—",
      detail:
        costosFijosProxy > 0
          ? `Con gastos anuales ${formatMoney(costosFijosProxy)}`
          : "Registra gastos en caja para estimarlo",
      desc: "Nivel de ventas en el que los ingresos cubren costos fijos y variables del año. Todo lo que vendas por encima ya es ganancia neta. (Usa gastos de caja del año como proxy de fijos.)",
    },
    {
      title: "Venta promedio",
      value: formatClp(ventaPromedio),
      detail: `${numVentasAnio} ventas del año ${anioActual}`,
      desc: "Cuánto gasta, en promedio, un cliente cada vez que hace una venta en el año. Sirve para evaluar kits/packs y ofertas de acceso rápido en el mostrador.",
    },
    {
      title: "Monto por día (promedio)",
      value:
        ventasPorDia.montoPromedio > 0
          ? formatClp(ventasPorDia.montoPromedio)
          : "—",
      detail:
        ventasPorDia.dias > 0
          ? `Sobre ${ventasPorDia.dias} día${
              ventasPorDia.dias === 1 ? "" : "s"
            }${ventasPorDia.usaDiasConVenta ? " con venta" : " del año"}`
          : "Sin ventas en el año",
      desc: "Cuánto vendes en plata, en promedio, cada día del año. Sirve para metas diarias de recaudación y comparar si un día estuvo bajo o alto en monto.",
    },
    {
      title: "Ventas por día (promedio)",
      value:
        ventasPorDia.ventasPromedio > 0
          ? ventasPorDia.ventasPromedio.toLocaleString("es-CL", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 0,
            })
          : "—",
      detail:
        ventasPorDia.dias > 0
          ? `${ventasPorDia.dias} día${
              ventasPorDia.dias === 1 ? "" : "s"
            }${ventasPorDia.usaDiasConVenta ? " con venta" : " del año"} · ${numVentasAnio} ventas del año`
          : "Sin ventas en el año",
      desc: "Cuántas ventas (órdenes) haces, en promedio, cada día del año. Independiente del monto: puedes vender mucho en pocas órdenes o poco en muchas.",
    },
    {
      title: "Productos promedio por venta",
      value:
        productosPromedioPorVenta > 0
          ? productosPromedioPorVenta.toLocaleString("es-CL", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 0,
            })
          : "—",
      detail: loadingVentasAnio
        ? "Cargando detalle del año…"
        : `${Math.round(productosAnioVendidos)} unidades en ${ventasAnio.length || numVentasAnio} ventas`,
      desc: "Cantidad media de productos (unidades) que lleva el cliente por cada venta en el año. Útil para medir si los packs y el acceso rápido elevan la canasta.",
    },
    {
      title: "Venta por hora / franjas",
      value: (() => {
        const peak = [...horas].sort((a, b) => b.value - a.value)[0];
        return peak && peak.value > 0
          ? `${String(peak.hour).padStart(2, "0")}:00`
          : "—";
      })(),
      detail: loadingVentasAnio
        ? "Cargando franjas del año…"
        : `Hora pico del año ${anioActual}`,
      desc: "Identifica momentos de mayor congestión en el mostrador a lo largo del año. Fundamental para turnos de cajeros y velocidad en el POS.",
      chart: "hours",
    },
    {
      title: "Rotación de inventario",
      value: rotacion > 0 ? `${rotacion.toFixed(2)}×` : "—",
      detail: `COGS año ${formatMoney(cogsPeriodo)} · inventario ${formatMoney(valorInventario)}`,
      desc: "Cuántas veces se vacía y se vuelve a llenar el almacén en el año. Alta rotación en abarrotes significa capital que no está estancado.",
    },
    {
      title: "Mermas e inventario vencido",
      value: formatPct(mermaPctVentas),
      detail: `Merma año ${formatMoney(mermaAnio)} · por vencer ~${formatMoney(valorPorVencer)}`,
      desc: "Porcentaje de productos perdidos por daño, robo o vencimiento respecto a las ventas del año. Mide la eficiencia de tus alertas FIFO.",
    },
    {
      title: "Tasa de quiebre de stock",
      value: formatPct(tasaQuiebre),
      detail: `${bajoStock} productos en alerta de ${stockResumen.length}`,
      desc: "Frecuencia con la que un producto de alta demanda no tiene unidades. Un quiebre es una venta perdida que beneficia a la competencia.",
    },
  ];

  return (
    <div className="fin-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="fin-mark" />

      <main className="fin-main">
        {tab === "resumen" && (
          <>
            <h1 className="fin-title">Resumen Financiero</h1>

            <section className="fin-metric-grid" aria-label="Indicadores">
              {metricCards.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="fin-metric-tile fin-metric-btn"
                  onClick={() => setMetricModal(m.id)}
                >
                  <p className="fin-metric-label">{m.label}</p>
                  <strong className="fin-metric-value">{m.value}</strong>
                  <span className="fin-metric-hint">{m.hint}</span>
                  <em className="fin-metric-more">Ver detalle</em>
                </button>
              ))}
            </section>

            <section className="fin-chart-card">
              <h2>Mermas (semanal)</h2>
              <BarChart bars={mermaDailyBars} color="#ef4444" />
            </section>

            <section className="fin-chart-card">
              <h2>Ingresos vs Gastos (semanal)</h2>
              <div className="fin-chart-legend">
                <span>
                  <i className="fin-dot fin-dot-ingreso" /> Ingresos
                </span>
                <span>
                  <i className="fin-dot fin-dot-gasto" /> Costos / gastos
                </span>
              </div>
              <GroupedBarChart bars={weeklyBars} />
            </section>

            <section className="fin-chart-card">
              <h2>Ventas diarias (mes actual)</h2>
              <LineChart points={ventasMesPoints} color="#0d9488" height={210} />
            </section>
          </>
        )}

        {tab === "cajas" && (
          <>
            <h1 className="fin-title">Cajas por día</h1>
            <p className="fin-lead">
              Consulta los turnos de un día: vendedor, estado y ventas de cada
              caja.
            </p>

            <label className="fin-cajas-fecha">
              Día
              <input
                type="date"
                value={fechaCajas}
                onChange={(e) => setFechaCajas(e.target.value)}
              />
            </label>

            {loadingCajas && <p className="fin-kpi-detail">Cargando cajas…</p>}
            {cajasError && (
              <p className="fin-kpi-detail" role="alert">
                {cajasError}
              </p>
            )}

            {!loadingCajas && !cajasError && (
              <>
                <section className="fin-metric-grid fin-metric-grid-3">
                  <article className="fin-metric-tile">
                    <p className="fin-metric-label">Cajas</p>
                    <strong className="fin-metric-value">
                      {cajasDelDia.length}
                    </strong>
                    <span className="fin-metric-hint">Turnos del día</span>
                  </article>
                  <article className="fin-metric-tile">
                    <p className="fin-metric-label">Total vendido</p>
                    <strong className="fin-metric-value fin-metric-value-sm">
                      {formatClp(totalCajasDia)}
                    </strong>
                  </article>
                  <article className="fin-metric-tile">
                    <p className="fin-metric-label">Abiertas</p>
                    <strong className="fin-metric-value">
                      {
                        cajasDelDia.filter((c) => c.estado === "ABIERTA")
                          .length
                      }
                    </strong>
                    <span className="fin-metric-hint">En curso</span>
                  </article>
                </section>

                <section className="fin-chart-card" aria-label="Listado de cajas">
                  <h2>Turnos</h2>
                  <ul className="fin-cajas-list">
                    {cajasDelDia.map((c) => {
                      const open = Boolean(expandedCaja[c.id]);
                      const ordenes = ventasPorCaja[c.id] ?? [];
                      const txs = (txsPorCaja[c.id] ?? []).filter(
                        (t) => t.tipo_transaccion !== "INGRESO_VENTA",
                      );
                      return (
                        <li
                          key={c.id}
                          className={`fin-caja-row ${open ? "is-open" : ""}`}
                        >
                          <button
                            type="button"
                            className="fin-caja-toggle"
                            onClick={() => void toggleCajaOrdenes(c.id)}
                            aria-expanded={open}
                          >
                            <div className="fin-caja-toggle-main">
                              <strong>{c.nombre_vendedor}</strong>
                              <span>
                                #{c.numero ?? c.id} · {c.estado}
                                {c.creado_en
                                  ? ` · ${new Date(
                                      c.creado_en,
                                    ).toLocaleTimeString("es-CL", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}`
                                  : ""}
                              </span>
                              <span className="fin-cajas-medios">
                                Ef {formatMoney(c.cuadre?.ventas_efectivo ?? 0)}{" "}
                                · Tar{" "}
                                {formatMoney(c.cuadre?.ventas_tarjeta ?? 0)} ·
                                Trf{" "}
                                {formatMoney(
                                  c.cuadre?.ventas_transferencia ?? 0,
                                )}{" "}
                                · Créd{" "}
                                {formatMoney(c.cuadre?.ventas_credito ?? 0)}
                              </span>
                            </div>
                            <div className="fin-caja-toggle-right">
                              <strong className="fin-cajas-total">
                                {formatMoney(c.cuadre?.total_ventas ?? 0)}
                              </strong>
                              <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                className={open ? "is-open" : undefined}
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
                            </div>
                          </button>

                          {open && (
                            <div className="fin-caja-ordenes">
                              {loadingVentasCaja[c.id] && (
                                <p className="fin-caja-ordenes-msg">
                                  Cargando movimientos…
                                </p>
                              )}
                              {errorVentasCaja[c.id] && (
                                <p
                                  className="fin-caja-ordenes-msg"
                                  role="alert"
                                >
                                  {errorVentasCaja[c.id]}
                                </p>
                              )}
                              {!loadingVentasCaja[c.id] &&
                                !errorVentasCaja[c.id] && (
                                  <>
                                    <h3 className="fin-caja-subhead">Órdenes</h3>
                                    <ul className="fin-caja-orden-list">
                                      {ordenes.map((v) => {
                                        const ordenOpen = Boolean(
                                          expandedOrden[v.id],
                                        );
                                        return (
                                          <li
                                            key={v.id}
                                            className={`fin-caja-orden ${v.anulada ? "is-anulada" : ""}`}
                                          >
                                            <button
                                              type="button"
                                              className="fin-caja-orden-toggle"
                                              onClick={() =>
                                                setExpandedOrden((prev) => ({
                                                  ...prev,
                                                  [v.id]: !prev[v.id],
                                                }))
                                              }
                                              aria-expanded={ordenOpen}
                                            >
                                              <span>
                                                Orden #{v.numero ?? v.id}
                                                {v.anulada ? " · ANULADA" : ""} ·{" "}
                                                {new Date(
                                                  v.fecha_hora,
                                                ).toLocaleTimeString("es-CL", {
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                                })}
                                              </span>
                                              <span>
                                                {formatMoney(v.total_venta)} ·{" "}
                                                {v.metodo_pago}
                                              </span>
                                            </button>
                                            {ordenOpen && (
                                              <>
                                                <ul className="fin-caja-orden-items">
                                                  {(v.items ?? []).map((it) => (
                                                    <li key={it.id}>
                                                      <span>
                                                        {it.producto_nombre} (x
                                                        {Number(
                                                          it.cantidad,
                                                        ).toLocaleString("es-CL")}
                                                        )
                                                      </span>
                                                      <span>
                                                        {formatMoney(it.subtotal)}
                                                      </span>
                                                    </li>
                                                  ))}
                                                  {(v.items ?? []).length ===
                                                    0 && (
                                                    <li className="fin-empty">
                                                      Sin detalle de ítems.
                                                    </li>
                                                  )}
                                                </ul>
                                                {!v.anulada && (
                                                  <button
                                                    type="button"
                                                    className="fin-caja-anular"
                                                    disabled={anulandoId === v.id}
                                                    onClick={() =>
                                                      void handleAnular(
                                                        c.id,
                                                        v.id,
                                                        v.numero,
                                                      )
                                                    }
                                                  >
                                                    {anulandoId === v.id
                                                      ? "Anulando…"
                                                      : "Anular venta"}
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </li>
                                        );
                                      })}
                                      {ordenes.length === 0 && (
                                        <li className="fin-empty">
                                          Sin órdenes en esta caja.
                                        </li>
                                      )}
                                    </ul>

                                    <h3 className="fin-caja-subhead">
                                      Gastos / inyecciones
                                    </h3>
                                    <ul className="fin-caja-orden-list">
                                      {txs.map((t) => (
                                        <li key={t.id} className="fin-caja-orden">
                                          <div className="fin-caja-tx-row">
                                            <span>
                                              {t.tipo_transaccion.replaceAll(
                                                "_",
                                                " ",
                                              )}{" "}
                                              · {t.descripcion}
                                            </span>
                                            <strong>
                                              {formatMoney(t.monto)}
                                            </strong>
                                          </div>
                                        </li>
                                      ))}
                                      {txs.length === 0 && (
                                        <li className="fin-empty">
                                          Sin gastos ni inyecciones.
                                        </li>
                                      )}
                                    </ul>
                                  </>
                                )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                    {cajasDelDia.length === 0 && (
                      <li className="fin-empty">No hay cajas ese día.</li>
                    )}
                  </ul>
                </section>
              </>
            )}
          </>
        )}

        {tab === "caja-chica" && (
          <>
            <h1 className="fin-title">Caja Chica</h1>
            <p className="fin-lead">
              Resumen de ventas del historial cargado, filtrado por el rango que
              elijas.
            </p>

            <div className="fin-date-range" aria-label="Rango de fechas">
              <label className="fin-cajas-fecha">
                Desde
                <input
                  type="date"
                  value={fechaChicaDesde}
                  max={fechaChicaHasta}
                  onChange={(e) => setFechaChicaDesde(e.target.value)}
                />
              </label>
              <label className="fin-cajas-fecha">
                Hasta
                <input
                  type="date"
                  value={fechaChicaHasta}
                  min={fechaChicaDesde}
                  max={hoy}
                  onChange={(e) => setFechaChicaHasta(e.target.value)}
                />
              </label>
            </div>

            <section className="fin-metric-grid fin-metric-grid-3">
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Ventas totales</p>
                <strong className="fin-metric-value">{chicaNumVentas}</strong>
                <span className="fin-metric-hint">Ventas</span>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Monto total</p>
                <strong className="fin-metric-value fin-metric-value-sm">
                  {formatClp(chicaMontoTotal)}
                </strong>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Productos vendidos</p>
                <strong className="fin-metric-value">
                  {Math.round(chicaProductosVendidos)}
                </strong>
                <span className="fin-metric-hint">Unidades</span>
              </article>
            </section>

            <section className="fin-chart-card">
              <h2>Tendencia de monto</h2>
              <LineChart
                points={chicaTrendMonto}
                color="#0d9488"
                height={190}
                format="money"
              />
            </section>

            <section className="fin-chart-card">
              <h2>Tendencia de ventas</h2>
              <LineChart
                points={chicaTrendCantidad}
                color="#3b82f6"
                height={190}
                format="number"
              />
            </section>

            <section className="fin-chart-card">
              <h2>Tendencia de unidades</h2>
              <LineChart
                points={chicaTrendUnidades}
                color="#f59e0b"
                height={190}
                format="number"
              />
            </section>

            <section className="fin-chart-card">
              <h2>Ventas por categoría</h2>
              <div className="fin-pie-row">
                <PieChart slices={catSlices} />
                <ul className="fin-pie-legend">
                  {catSlices.map((s) => (
                    <li key={s.label}>
                      <i style={{ background: s.color }} />
                      <span>{s.label}</span>
                      <strong>{formatMoney(s.value)}</strong>
                    </li>
                  ))}
                  {catSlices.length === 0 && (
                    <li className="fin-empty">Sin ventas con categorías.</li>
                  )}
                </ul>
              </div>
            </section>

            <section className="fin-chart-card">
              <h2>Mejor mes</h2>
              {mejorMes ? (
                <p className="fin-highlight">
                  <strong>{monthLabel(mejorMes.mes)}</strong>
                  <span>{formatClp(mejorMes.total)}</span>
                </p>
              ) : (
                <p className="fin-empty">Sin datos aún.</p>
              )}
            </section>

            <section className="fin-chart-card">
              <h2>Mejor día de cada mes</h2>
              <ul className="fin-cat-list">
                {mejorDiaPorMes.map((row) => (
                  <li key={row.mes}>
                    <span>
                      {monthLabel(row.mes)} · {dayLabel(row.dia)}
                    </span>
                    <strong>{formatMoney(row.total)}</strong>
                  </li>
                ))}
                {mejorDiaPorMes.length === 0 && (
                  <li className="fin-empty">Sin datos aún.</li>
                )}
              </ul>
            </section>
          </>
        )}

        {tab === "kits" && (
          <>
            <h1 className="fin-title">Kits</h1>
            <p className="fin-lead">
              Éxito de cada kit frente a la venta de sus partes sueltas, sobre el
              historial cargado y el rango elegido.
            </p>

            <div className="fin-date-range" aria-label="Rango de fechas kits">
              <label className="fin-cajas-fecha">
                Desde
                <input
                  type="date"
                  value={fechaKitsDesde}
                  max={fechaKitsHasta}
                  onChange={(e) => setFechaKitsDesde(e.target.value)}
                />
              </label>
              <label className="fin-cajas-fecha">
                Hasta
                <input
                  type="date"
                  value={fechaKitsHasta}
                  min={fechaKitsDesde}
                  max={hoy}
                  onChange={(e) => setFechaKitsHasta(e.target.value)}
                />
              </label>
            </div>

            <section className="fin-metric-grid">
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Ingresos kits</p>
                <strong className="fin-metric-value fin-metric-value-sm">
                  {formatClp(kitsIngresos)}
                </strong>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Unidades kit</p>
                <strong className="fin-metric-value">
                  {Math.round(kitsUsos).toLocaleString("es-CL")}
                </strong>
                <span className="fin-metric-hint">
                  {kitsEquivTotal > 0
                    ? `${Math.round(kitsEquivTotal).toLocaleString("es-CL")} equiv. sueltos`
                    : "Sin equivalentes sueltos"}
                </span>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Mix kit</p>
                <strong className="fin-metric-value">
                  {kitsUsos + kitsEquivTotal > 0
                    ? `${kitsMixGlobal.toLocaleString("es-CL", {
                        maximumFractionDigits: 0,
                      })}%`
                    : "—"}
                </strong>
                <span className="fin-metric-hint">
                  Kit ÷ (kit + partes)
                </span>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Kits activos</p>
                <strong className="fin-metric-value">
                  {kitsConMovimiento}/{kitPerfRows.length}
                </strong>
                <span className="fin-metric-hint">Con movimiento</span>
              </article>
            </section>

            <section className="fin-chart-card">
              <h2>Tendencia: kit vs partes sueltas</h2>
              <div className="fin-chart-legend">
                <span>
                  <i className="fin-dot fin-dot-ingreso" /> Unidades kit
                </span>
                <span>
                  <i className="fin-dot fin-dot-gasto" /> Equiv. sueltos
                </span>
              </div>
              <LineChart
                points={kitsTrend.kitPoints}
                color="#0d9488"
                height={170}
                format="number"
              />
              <LineChart
                points={kitsTrend.loosePoints}
                color="#9ca3af"
                height={170}
                format="number"
              />
            </section>

            <section className="fin-chart-card">
              <h2>Desempeño por kit</h2>
              <ul className="fin-kit-list">
                {kitPerfRows.map((k) => (
                  <li key={k.kitId} className="fin-kit-card">
                    <div className="fin-kit-card-head">
                      <strong>{k.nombre}</strong>
                      <span>{formatMoney(k.precioVenta)}</span>
                    </div>
                    <p className="fin-kit-bom">{k.componentesLabel}</p>
                    <div className="fin-kit-stats">
                      <span>
                        Kit{" "}
                        <em>
                          {k.kitQty.toLocaleString("es-CL", {
                            maximumFractionDigits: 1,
                          })}{" "}
                          un · {formatMoney(k.kitRevenue)}
                        </em>
                      </span>
                      <span>
                        Sueltos{" "}
                        <em>
                          {k.equivLoose.toLocaleString("es-CL")} equiv.
                        </em>
                      </span>
                    </div>
                    <div className="fin-kit-mix" aria-label={`Mix kit ${Math.round(k.mix)}%`}>
                      <div className="fin-kit-mix-track">
                        <span
                          className="fin-kit-mix-fill"
                          style={{ width: `${Math.min(100, Math.max(0, k.mix))}%` }}
                        />
                      </div>
                      <em>
                        {k.kitQty + k.equivLoose > 0
                          ? `Mix kit ${k.mix.toLocaleString("es-CL", {
                              maximumFractionDigits: 0,
                            })}%`
                          : "Sin ventas"}
                      </em>
                    </div>
                    <p className="fin-kit-vel">{k.velocidadTxt}</p>
                  </li>
                ))}
                {kitPerfRows.length === 0 && (
                  <li className="fin-empty">No hay productos tipo kit en el catálogo.</li>
                )}
              </ul>
            </section>

            <section className="fin-chart-card">
              <h2>Inversión en mercadería</h2>
              <p className="fin-hint-inline">
                Compras por lote registradas como inversión del negocio (no
                gasto de caja). Total: {formatClp(inversionTotal)}.
              </p>
              <ul className="fin-cat-list">
                {inversionPorMes.map((row) => (
                  <li key={row.mes}>
                    <span>{monthLabel(row.mes)}</span>
                    <strong>{formatClp(row.total)}</strong>
                  </li>
                ))}
                {inversionPorMes.length === 0 && (
                  <li className="fin-empty">Sin compras de mercadería aún.</li>
                )}
              </ul>
              <button type="button" className="fin-cta" onClick={onGoCompra}>
                Registrar compra
              </button>
            </section>
          </>
        )}

        {tab === "mermas" && (
          <>
            <h1 className="fin-title">Mermas</h1>
            <p className="fin-lead">
              Pérdidas por SALIDA_MERMA del historial cargado, filtradas por el
              rango que elijas.
            </p>

            <div className="fin-date-range" aria-label="Rango de fechas mermas">
              <label className="fin-cajas-fecha">
                Desde
                <input
                  type="date"
                  value={fechaMermasDesde}
                  max={fechaMermasHasta}
                  onChange={(e) => setFechaMermasDesde(e.target.value)}
                />
              </label>
              <label className="fin-cajas-fecha">
                Hasta
                <input
                  type="date"
                  value={fechaMermasHasta}
                  min={fechaMermasDesde}
                  max={hoy}
                  onChange={(e) => setFechaMermasHasta(e.target.value)}
                />
              </label>
            </div>

            <section className="fin-metric-grid">
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Valor merma</p>
                <strong className="fin-metric-value fin-metric-value-sm">
                  {formatClp(mermaTabValor)}
                </strong>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Movimientos</p>
                <strong className="fin-metric-value">
                  {mermaTabMovimientos.toLocaleString("es-CL")}
                </strong>
                <span className="fin-metric-hint">Registros</span>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">Unidades</p>
                <strong className="fin-metric-value">
                  {mermaTabUnidades.toLocaleString("es-CL", {
                    maximumFractionDigits: 1,
                  })}
                </strong>
              </article>
              <article className="fin-metric-tile">
                <p className="fin-metric-label">% sobre ventas</p>
                <strong className="fin-metric-value">
                  {ventaRangoMerma > 0 || mermaTabValor > 0
                    ? formatPct(mermaTabPctVentas)
                    : "—"}
                </strong>
                <span className="fin-metric-hint">
                  Ventas rango {formatMoney(ventaRangoMerma)}
                </span>
              </article>
            </section>

            <section className="fin-chart-card">
              <h2>Tendencia de valor</h2>
              <LineChart
                points={mermaTrendValor}
                color="#ef4444"
                height={180}
                format="money"
              />
            </section>

            <section className="fin-chart-card">
              <h2>Tendencia de unidades</h2>
              <LineChart
                points={mermaTrendUnidades}
                color="#f97316"
                height={180}
                format="number"
              />
            </section>

            <section className="fin-chart-card">
              <h2>Merma por producto</h2>
              <div className="fin-pie-row">
                <PieChart slices={mermaTabSlices} />
                <ul className="fin-pie-legend">
                  {mermaTabSlices.map((s) => (
                    <li key={s.label}>
                      <i style={{ background: s.color }} />
                      <span>{s.label}</span>
                      <strong>{formatMoney(s.value)}</strong>
                    </li>
                  ))}
                  {mermaTabSlices.length === 0 && (
                    <li className="fin-empty">Sin mermas en el rango.</li>
                  )}
                </ul>
              </div>
            </section>

            <section className="fin-chart-card">
              <h2>Ranking de productos</h2>
              <ul className="fin-cat-list">
                {mermaTabPorProducto.map((row) => (
                  <li key={row.productoId}>
                    <span>
                      {row.nombre}
                      <em className="fin-merma-sub">
                        {" "}
                        · {row.unidades.toLocaleString("es-CL", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        un · {row.movimientos} mov.
                      </em>
                    </span>
                    <strong>{formatMoney(row.valor)}</strong>
                  </li>
                ))}
                {mermaTabPorProducto.length === 0 && (
                  <li className="fin-empty">Sin mermas en el rango.</li>
                )}
              </ul>
            </section>

            <section className="fin-chart-card">
              <h2>Detalle de movimientos</h2>
              <ul className="fin-cat-list">
                {[...mermasFiltradas]
                  .sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora))
                  .slice(0, 40)
                  .map((m) => {
                    const nombre =
                      prodById.get(m.producto_id)?.nombre ??
                      `Producto #${m.producto_id}`;
                    return (
                      <li key={m.id}>
                        <span>
                          {nombre}
                          <em className="fin-merma-sub">
                            {" "}
                            · {dayLabel(dayKey(m.fecha_hora))} ·{" "}
                            {Math.abs(Number(m.cantidad)).toLocaleString(
                              "es-CL",
                              { maximumFractionDigits: 1 },
                            )}{" "}
                            un
                            {m.motivo ? ` · ${m.motivo}` : ""}
                          </em>
                        </span>
                        <strong>{formatMoney(mermaValor(m))}</strong>
                      </li>
                    );
                  })}
                {mermasFiltradas.length === 0 && (
                  <li className="fin-empty">Sin movimientos en el rango.</li>
                )}
              </ul>
            </section>
          </>
        )}

        {tab === "kpis" && (
          <>
            <h1 className="fin-title">KPIs</h1>
            <p className="fin-lead">
              Indicadores del año calendario {anioActual} (1 ene – hoy).
            </p>
            <div className="fin-kpi-stack">
              {kpiCards.map((k) => (
                <article key={k.title} className="fin-kpi-card">
                  <h2>{k.title}</h2>
                  <strong className="fin-kpi-value">{k.value}</strong>
                  {k.detail && <p className="fin-kpi-detail">{k.detail}</p>}
                  {k.chart === "hours" && <HourBars hours={horas} />}
                  <p className="fin-kpi-desc">{k.desc}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      <nav className="fin-bottom-nav" aria-label="Finanzas">
        <button
          type="button"
          className={tab === "resumen" ? "active" : undefined}
          onClick={() => setTab("resumen")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Resumen
        </button>
        <button
          type="button"
          className={tab === "cajas" ? "active" : undefined}
          onClick={() => setTab("cajas")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M4 7h16v3H4V7zM4 12h7v7H4v-7zM13 12h7v7h-7v-7z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Cajas
        </button>
        <button
          type="button"
          className={tab === "caja-chica" ? "active" : undefined}
          onClick={() => setTab("caja-chica")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M3 8h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M3 8l2-4h14l2 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13" r="2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          Caja Chica
        </button>
        <button
          type="button"
          className={tab === "kits" ? "active" : undefined}
          onClick={() => setTab("kits")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d="M4 9h16v11H4V9z" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M4 9l2-4h12l2 4M12 5v15"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Kits
        </button>
        <button
          type="button"
          className={tab === "mermas" ? "active" : undefined}
          onClick={() => setTab("mermas")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M12 3v6M8 7l4 8 4-8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 19h14M7 19l1.5-3h7L17 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Mermas
        </button>
        <button
          type="button"
          className={tab === "kpis" ? "active" : undefined}
          onClick={() => setTab("kpis")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M4 19V9M10 19V5M16 19v-7M22 19H2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M4 11l6-4 6 3 6-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          KPIs
        </button>
      </nav>

      {metricModal && (
        <div
          className="dash-modal-backdrop"
          role="presentation"
          onClick={() => setMetricModal(null)}
        >
          <div
            className="dash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fin-metric-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {metricModal === "flujo" && (
              <>
                <h2 id="fin-metric-modal-title">Flujo de caja</h2>
                <p className="dash-modal-lead">
                  Mes actual · dinero disponible tras gastos y merma
                </p>
                <dl className="dash-margen-formula">
                  <div>
                    <dt>Ventas del mes</dt>
                    <dd>{formatMoney(ventaMes)}</dd>
                  </div>
                  <div>
                    <dt>− Gastos del mes</dt>
                    <dd>{formatMoney(gastos)}</dd>
                  </div>
                  <div>
                    <dt>− Merma del mes</dt>
                    <dd>{formatMoney(mermaMes)}</dd>
                  </div>
                  <div className="is-result">
                    <dt>= Flujo de caja</dt>
                    <dd>{formatMoney(flujoCaja)}</dd>
                  </div>
                </dl>
              </>
            )}

            {metricModal === "utilidad" && (
              <>
                <h2 id="fin-metric-modal-title">Utilidad bruta</h2>
                <p className="dash-modal-lead">
                  Margen sobre ventas del mes ·{" "}
                  <strong>{formatPct(margenPct)}</strong>
                </p>
                <dl className="dash-margen-formula">
                  <div>
                    <dt>Ventas del mes</dt>
                    <dd>{formatMoney(ventaMes)}</dd>
                  </div>
                  <div>
                    <dt>− Costos del mes</dt>
                    <dd>{formatMoney(costoMes)}</dd>
                  </div>
                  <div className="is-result">
                    <dt>= Ganancia bruta</dt>
                    <dd>{formatMoney(utilidadBruta)}</dd>
                  </div>
                  <div className="is-pct">
                    <dt>Margen</dt>
                    <dd>
                      {formatMoney(utilidadBruta)} ÷ {formatMoney(ventaMes)} ={" "}
                      <strong>{formatPct(margenPct)}</strong>
                    </dd>
                  </div>
                </dl>
              </>
            )}

            {metricModal === "gastos" && (
              <>
                <h2 id="fin-metric-modal-title">Gastos del mes</h2>
                <p className="dash-modal-lead">
                  Total <strong>{formatMoney(gastos)}</strong>
                  {loadingGastosMes ? " · actualizando…" : ""}
                  {" · "}
                  {gastosMesItems.length} registro
                  {gastosMesItems.length === 1 ? "" : "s"}
                </p>
                <ul className="dash-modal-list">
                  {gastosMesItems.map((g) => (
                    <li key={g.id}>
                      <div>
                        <strong>{g.descripcion || formatGastoTipo(g.tipo_transaccion)}</strong>
                        <span>
                          {dayLabel(dayKey(g.fecha_hora))} · {formatHora(g.fecha_hora)}
                          {" · "}
                          {formatGastoTipo(g.tipo_transaccion)}
                          {g.caja_numero != null ? ` · caja #${g.caja_numero}` : ""}
                        </span>
                      </div>
                      <em>{formatMoney(g.monto)}</em>
                    </li>
                  ))}
                  {!loadingGastosMes && gastosMesItems.length === 0 && (
                    <li className="dash-empty">Sin gastos registrados este mes.</li>
                  )}
                </ul>
              </>
            )}

            {metricModal === "merma" && (
              <>
                <h2 id="fin-metric-modal-title">Merma del mes</h2>
                <p className="dash-modal-lead">
                  Total <strong>{formatMoney(mermaMes)}</strong>
                  {" · "}
                  {mermasDelMes.length} movimiento
                  {mermasDelMes.length === 1 ? "" : "s"}
                </p>
                <ul className="dash-modal-list">
                  {mermasDelMes.map((m) => {
                    const nombre =
                      prodById.get(m.producto_id)?.nombre ??
                      `Producto #${m.producto_id}`;
                    const valor = mermaValor(m);
                    return (
                      <li key={m.id}>
                        <div>
                          <strong>{nombre}</strong>
                          <span>
                            {dayLabel(dayKey(m.fecha_hora))} ·{" "}
                            {Number(m.cantidad).toLocaleString("es-CL")} unids.
                            {m.motivo ? ` · ${m.motivo}` : ""}
                          </span>
                        </div>
                        <em>{formatMoney(valor)}</em>
                      </li>
                    );
                  })}
                  {mermasDelMes.length === 0 && (
                    <li className="dash-empty">Sin merma registrada este mes.</li>
                  )}
                </ul>
              </>
            )}

            {metricModal === "ganancias-netas" && (
              <>
                <h2 id="fin-metric-modal-title">Ganancias netas</h2>
                <p className="dash-modal-lead">
                  Ganancia bruta menos gastos y merma del mes
                </p>
                <dl className="dash-margen-formula">
                  <div>
                    <dt>Ganancias brutas</dt>
                    <dd>{formatMoney(gananciasBrutas)}</dd>
                  </div>
                  <div>
                    <dt>− Gastos</dt>
                    <dd>{formatMoney(gastos)}</dd>
                  </div>
                  <div>
                    <dt>− Merma</dt>
                    <dd>{formatMoney(mermaMes)}</dd>
                  </div>
                  <div className="is-result">
                    <dt>= Ganancias netas</dt>
                    <dd>{formatMoney(gananciasNetas)}</dd>
                  </div>
                </dl>
              </>
            )}

            {metricModal === "ganancias-brutas" && (
              <>
                <h2 id="fin-metric-modal-title">Ganancias brutas</h2>
                <p className="dash-modal-lead">
                  Ventas menos costo FIFO del mes ·{" "}
                  <strong>{formatMoney(gananciasBrutas)}</strong>
                </p>
                <dl className="dash-margen-formula">
                  <div>
                    <dt>Ventas del mes</dt>
                    <dd>{formatMoney(ventaMes)}</dd>
                  </div>
                  <div>
                    <dt>− Costos del mes</dt>
                    <dd>{formatMoney(costoMes)}</dd>
                  </div>
                  <div className="is-result">
                    <dt>= Ganancias brutas</dt>
                    <dd>{formatMoney(gananciasBrutas)}</dd>
                  </div>
                </dl>
                <h3 className="dash-modal-sub">Ventas del mes (muestra)</h3>
                <ul className="dash-modal-list">
                  {ventasDelMes.map((v) => {
                    const costo =
                      v.costo_total ?? Math.max(0, v.total_venta - v.ganancia);
                    return (
                      <li key={v.id}>
                        <div>
                          <strong>#{v.id}</strong>
                          <span>
                            {dayLabel(dayKey(v.fecha_hora))} · {formatHora(v.fecha_hora)}
                            {" · costo "}
                            {formatMoney(costo)}
                          </span>
                        </div>
                        <em>{formatMoney(v.ganancia)}</em>
                      </li>
                    );
                  })}
                  {ventasDelMes.length === 0 && (
                    <li className="dash-empty">Sin ventas cargadas del mes.</li>
                  )}
                </ul>
              </>
            )}

            <button
              type="button"
              className="dash-modal-close"
              onClick={() => setMetricModal(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
