import { useMemo, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import { formatClpLabel as formatClp, formatClp as formatMoney } from "../money";
import "./DashboardPage.css";

export type DashboardKpis = {
  fecha_referencia: string;
  venta_diaria: number;
  venta_mensual: number;
  ganancia_diaria: number;
  ganancia_mensual: number;
  num_ventas_dia: number;
  num_ventas_mes: number;
  productos_por_vencer: {
    nombre: string;
    cantidad_actual: string | number;
    fecha_caducidad: string;
    dias_restantes: number;
  }[];
  productos_estrella: {
    nombre: string;
    cantidad_vendida: string | number;
    total_venta: number;
  }[];
  productos_bajo_stock: {
    nombre: string;
    stock_actual: string | number;
  }[];
};

export type DashboardVenta = {
  id: number;
  numero?: number;
  total_venta: number;
  ganancia: number;
  costo_total?: number;
  metodo_pago: string;
  fecha_hora: string;
  anulada?: boolean;
  items?: Array<{
    id: number;
    producto_nombre: string;
    cantidad: string | number;
    subtotal: number;
  }>;
};

type DashboardPageProps = {
  kpis: DashboardKpis | null;
  ventas?: DashboardVenta[];
  negocioNombre: string | null;
  onOpenMenu: () => void;
  onViewReports: () => void;
};

type ModalKind = "ventas-hoy" | "margen" | null;

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function formatHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M4 19V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 19V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 19v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 19H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MarginIcon({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 9;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        stroke="#14b8a6"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 12 12)"
      />
      <text
        x="12"
        y="13.5"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="#6b7280"
      >
        %
      </text>
    </svg>
  );
}

function ProductGlyph({ name }: { name: string }) {
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span className="dash-glyph" aria-hidden="true">
      {letter}
    </span>
  );
}

function AlertIcon() {
  return (
    <span className="dash-alert-badge" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M12 7v6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1.2" fill="#fff" />
      </svg>
    </span>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage({
  kpis,
  ventas = [],
  negocioNombre,
  onOpenMenu,
  onViewReports,
}: DashboardPageProps) {
  const [modal, setModal] = useState<ModalKind>(null);

  const refDay = kpis?.fecha_referencia?.slice(0, 10) ?? "";
  const refMonth = refDay.slice(0, 7);

  const margen =
    kpis && kpis.venta_mensual > 0
      ? Math.round((kpis.ganancia_mensual / kpis.venta_mensual) * 100)
      : 0;

  const top = kpis?.productos_estrella.slice(0, 5) ?? [];
  const alertsVencer = kpis?.productos_por_vencer.slice(0, 4) ?? [];
  const alertsStock = kpis?.productos_bajo_stock.slice(0, 3) ?? [];

  const ventasHoy = useMemo(() => {
    if (!refDay) return [];
    return ventas
      .filter((v) => !v.anulada && dayKey(v.fecha_hora) === refDay)
      .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)));
  }, [ventas, refDay]);

  const ventasMes = useMemo(() => {
    if (!refMonth) return [];
    return ventas
      .filter((v) => !v.anulada && monthKey(v.fecha_hora) === refMonth)
      .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)));
  }, [ventas, refMonth]);

  const margenBreakdown = useMemo(() => {
    const ventaMes =
      kpis?.venta_mensual ??
      ventasMes.reduce((s, v) => s + v.total_venta, 0);
    const gananciaMes =
      kpis?.ganancia_mensual ??
      ventasMes.reduce((s, v) => s + v.ganancia, 0);
    const costoMes = Math.max(0, ventaMes - gananciaMes);
    const pct = ventaMes > 0 ? (gananciaMes / ventaMes) * 100 : 0;
    return { ventaMes, gananciaMes, costoMes, pct };
  }, [kpis, ventasMes]);

  return (
    <div className="dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="dash-mark" />

      <main className="dash-main">
        <h1 className="dash-title">Resumen del Negocio</h1>
        {negocioNombre && <p className="dash-negocio">{negocioNombre}</p>}

        <section className="dash-kpi-card" aria-label="Indicadores principales">
          <button
            type="button"
            className="dash-kpi-col dash-kpi-btn"
            onClick={() => setModal("ventas-hoy")}
            disabled={!kpis}
          >
            <p className="dash-kpi-label">Ventas Hoy:</p>
            <div className="dash-kpi-value-row">
              <span className="dash-kpi-icon">
                <ChartIcon />
              </span>
              <strong>{kpis ? formatClp(kpis.venta_diaria) : "—"}</strong>
            </div>
            <em className="dash-kpi-hint">Ver detalle</em>
          </button>
          <div className="dash-kpi-divider" aria-hidden="true" />
          <button
            type="button"
            className="dash-kpi-col dash-kpi-btn"
            onClick={() => setModal("margen")}
            disabled={!kpis}
          >
            <p className="dash-kpi-label">Margen Bruto (Mes):</p>
            <div className="dash-kpi-value-row">
              <MarginIcon percent={margen} />
              <strong>{kpis ? `${margen}%` : "—"}</strong>
            </div>
            <em className="dash-kpi-hint">Ver composición</em>
          </button>
        </section>

        <section className="dash-section">
          <h2>Productos Top (Ventas)</h2>
          <ul className="dash-list">
            {top.map((p) => (
              <li key={p.nombre} className="dash-list-item">
                <ProductGlyph name={p.nombre} />
                <div className="dash-list-body">
                  <strong>{p.nombre}</strong>
                  <span>
                    {Number(p.cantidad_vendida).toLocaleString("es-CL")} unids. |{" "}
                    {formatMoney(p.total_venta)}
                  </span>
                </div>
                <em className="dash-list-amount">{formatMoney(p.total_venta)}</em>
              </li>
            ))}
            {top.length === 0 && (
              <li className="dash-empty">Sin ventas en el mes aún.</li>
            )}
          </ul>
        </section>

        <section className="dash-section">
          <h2>Alertas de Stock/Vencimiento</h2>
          <ul className="dash-list">
            {alertsVencer.map((p) => (
              <li
                key={`${p.nombre}-${p.fecha_caducidad}`}
                className="dash-list-item"
              >
                <ProductGlyph name={p.nombre} />
                <div className="dash-list-body">
                  <strong>{p.nombre}</strong>
                  <span>
                    {Number(p.cantidad_actual).toLocaleString("es-CL")} unids. - Vence
                    en{" "}
                    <span className="dash-danger">
                      {p.dias_restantes} {p.dias_restantes === 1 ? "día" : "días"}
                    </span>
                  </span>
                </div>
                <AlertIcon />
              </li>
            ))}
            {alertsStock.map((p) => (
              <li key={`stock-${p.nombre}`} className="dash-list-item">
                <ProductGlyph name={p.nombre} />
                <div className="dash-list-body">
                  <strong>{p.nombre}</strong>
                  <span>
                    Stock actual: {Number(p.stock_actual).toLocaleString("es-CL")} —{" "}
                    <span className="dash-danger">bajo stock</span>
                  </span>
                </div>
                <AlertIcon />
              </li>
            ))}
            {alertsVencer.length === 0 && alertsStock.length === 0 && (
              <li className="dash-empty">Sin alertas por ahora.</li>
            )}
          </ul>
        </section>
      </main>

      <footer className="dash-footer">
        <button type="button" className="dash-reports-btn" onClick={onViewReports}>
          <ReportIcon />
          Ver Reportes Detallados
        </button>
      </footer>

      {modal === "ventas-hoy" && (
        <div
          className="dash-modal-backdrop"
          role="presentation"
          onClick={() => setModal(null)}
        >
          <div
            className="dash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-ventas-hoy-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dash-ventas-hoy-title">Ventas de hoy</h2>
            <p className="dash-modal-lead">
              Total{" "}
              <strong>
                {formatMoney(kpis?.venta_diaria ?? 0)}
              </strong>{" "}
              · {kpis?.num_ventas_dia ?? ventasHoy.length} venta
              {(kpis?.num_ventas_dia ?? ventasHoy.length) === 1 ? "" : "s"}
            </p>
            <ul className="dash-modal-list">
              {ventasHoy.map((v) => (
                <li key={v.id}>
                  <div>
                    <strong>#{v.numero ?? v.id}</strong>
                    <span>
                      {formatHora(v.fecha_hora)} · {v.metodo_pago}
                      {v.items && v.items.length > 0
                        ? ` · ${v.items.length} ítem${v.items.length === 1 ? "" : "s"}`
                        : ""}
                    </span>
                  </div>
                  <em>{formatMoney(v.total_venta)}</em>
                </li>
              ))}
              {ventasHoy.length === 0 && (
                <li className="dash-empty">No hay ventas registradas hoy.</li>
              )}
            </ul>
            <button
              type="button"
              className="dash-modal-close"
              onClick={() => setModal(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {modal === "margen" && (
        <div
          className="dash-modal-backdrop"
          role="presentation"
          onClick={() => setModal(null)}
        >
          <div
            className="dash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-margen-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dash-margen-title">Composición del margen bruto</h2>
            <p className="dash-modal-lead">
              Mes de referencia · margen{" "}
              <strong>{Math.round(margenBreakdown.pct)}%</strong>
            </p>

            <dl className="dash-margen-formula">
              <div>
                <dt>Ventas del mes</dt>
                <dd>{formatMoney(margenBreakdown.ventaMes)}</dd>
              </div>
              <div>
                <dt>− Costos del mes</dt>
                <dd>{formatMoney(margenBreakdown.costoMes)}</dd>
              </div>
              <div className="is-result">
                <dt>= Ganancia bruta</dt>
                <dd>{formatMoney(margenBreakdown.gananciaMes)}</dd>
              </div>
              <div className="is-pct">
                <dt>Margen</dt>
                <dd>
                  {formatMoney(margenBreakdown.gananciaMes)} ÷{" "}
                  {formatMoney(margenBreakdown.ventaMes)} ={" "}
                  <strong>{Math.round(margenBreakdown.pct)}%</strong>
                </dd>
              </div>
            </dl>

            <h3 className="dash-modal-sub">Ventas del mes</h3>
            <ul className="dash-modal-list">
              {ventasMes.map((v) => {
                const costo =
                  v.costo_total ?? Math.max(0, v.total_venta - v.ganancia);
                return (
                  <li key={v.id}>
                    <div>
                      <strong>
                        #{v.numero ?? v.id} · {formatFechaCorta(v.fecha_hora)}
                      </strong>
                      <span>
                        Venta {formatMoney(v.total_venta)} · Costo{" "}
                        {formatMoney(costo)} · Ganancia{" "}
                        {formatMoney(v.ganancia)}
                      </span>
                    </div>
                    <em>
                      {v.total_venta > 0
                        ? `${Math.round((v.ganancia / v.total_venta) * 100)}%`
                        : "—"}
                    </em>
                  </li>
                );
              })}
              {ventasMes.length === 0 && (
                <li className="dash-empty">Sin ventas en el mes.</li>
              )}
            </ul>
            <button
              type="button"
              className="dash-modal-close"
              onClick={() => setModal(null)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
