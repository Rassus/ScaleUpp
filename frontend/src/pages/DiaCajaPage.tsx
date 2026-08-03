import { FormEvent, useEffect, useMemo, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import { formatClpLabel as formatClp, formatClp as formatMoney } from "../money";
import "./DashboardPage.css";
import "./DiaCajaPage.css";

export type DiaCajaState = {
  id: number;
  numero?: number;
  fecha: string;
  nombre_vendedor?: string;
  monto_apertura: number;
  estado: string;
  abierta_por_nombre?: string | null;
  cuadre?: {
    efectivo_teorico: number;
    total_ventas?: number;
    ventas_efectivo: number;
    ventas_tarjeta: number;
    ventas_transferencia: number;
    ventas_credito?: number;
    cobros_credito?: number;
    egresos_efectivo: number;
    inyecciones_efectivo?: number;
  };
} | null;

export type DiaCajaMovimiento = {
  id: number;
  tipo_transaccion: string;
  monto: number;
  descripcion: string;
  medio_pago: string;
  venta_id?: number | null;
  fecha_hora: string;
};

export type DiaCajaVenta = {
  id: number;
  numero?: number;
  total_venta: number;
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

type DiaCajaPageProps = {
  caja: DiaCajaState;
  movimientos: DiaCajaMovimiento[];
  ventas?: DiaCajaVenta[];
  loadingMovimientos: boolean;
  canWrite?: boolean;
  stockAlertNombre: string | null;
  montoApertura: string;
  nombreVendedor: string;
  equipo?: Array<{
    id: number;
    nombre: string;
    activo: boolean;
    rol: string;
    membresia_activa: boolean;
  }>;
  gastoTipo: string;
  gastoMonto: string;
  gastoDesc: string;
  onMontoAperturaChange: (v: string) => void;
  onNombreVendedorChange: (v: string) => void;
  onGastoTipoChange: (v: string) => void;
  onGastoMontoChange: (v: string) => void;
  onGastoDescChange: (v: string) => void;
  onAbrirCaja: (e: FormEvent) => void;
  onCerrarCaja: () => void | Promise<void>;
  onRegistrarGasto: (e: FormEvent) => void | Promise<void>;
  onAnularVenta?: (ventaId: number) => Promise<void>;
  onRefreshMovimientos?: () => void;
  onOpenMenu: () => void;
  onNuevaOrden: () => void;
  onLoadEquipo?: () => void | Promise<void>;
  error: string | null;
};

function formatFechaLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d
    .toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "")
    .toUpperCase();
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function tipoLabel(tipo: string): string {
  if (tipo === "INGRESO_VENTA") return "Venta";
  if (tipo === "INYECCION_CAJA") return "Inyección";
  if (tipo === "GASTO_OPERATIVO") return "Gasto operativo";
  if (tipo === "GASTO_GENERAL") return "Gasto general";
  if (tipo === "COBRO_CREDITO") return "Cobro crédito";
  return tipo;
}

function ChartUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
      <path d="M4 19V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 19V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 19v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 19V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M15 5h5v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M20 5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function DiaCajaPage({
  caja,
  movimientos,
  ventas = [],
  loadingMovimientos,
  canWrite = false,
  stockAlertNombre,
  montoApertura,
  nombreVendedor,
  equipo = [],
  gastoTipo,
  gastoMonto,
  gastoDesc,
  onMontoAperturaChange,
  onNombreVendedorChange,
  onGastoTipoChange,
  onGastoMontoChange,
  onGastoDescChange,
  onAbrirCaja,
  onCerrarCaja,
  onRegistrarGasto,
  onAnularVenta,
  onRefreshMovimientos,
  onOpenMenu,
  onNuevaOrden,
  onLoadEquipo,
  error,
}: DiaCajaPageProps) {
  const fecha = caja?.fecha ?? todayIso();
  const [confirmCierre, setConfirmCierre] = useState(false);
  const [gastoModalOpen, setGastoModalOpen] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [expandedMovId, setExpandedMovId] = useState<number | null>(null);
  const [anulandoId, setAnulandoId] = useState<number | null>(null);

  useEffect(() => {
    void onLoadEquipo?.();
  }, [onLoadEquipo]);

  const vendedoresEquipo = useMemo(
    () => equipo.filter((m) => m.activo && m.membresia_activa),
    [equipo],
  );

  const ventasById = useMemo(() => {
    const map = new Map<number, DiaCajaVenta>();
    for (const v of ventas) map.set(v.id, v);
    return map;
  }, [ventas]);

  const totalTurno = caja?.cuadre
    ? (caja.cuadre.total_ventas ??
        caja.cuadre.ventas_efectivo +
          caja.cuadre.ventas_tarjeta +
          caja.cuadre.ventas_transferencia +
          (caja.cuadre.ventas_credito ?? 0))
    : 0;

  useEffect(() => {
    setConfirmCierre(false);
    setExpandedMovId(null);
  }, [caja?.id]);

  async function confirmarCierre() {
    setCerrando(true);
    try {
      await onCerrarCaja();
      setConfirmCierre(false);
    } finally {
      setCerrando(false);
    }
  }

  async function handleGasto(e: FormEvent) {
    e.preventDefault();
    setGuardandoGasto(true);
    try {
      await onRegistrarGasto(e);
      setGastoModalOpen(false);
    } finally {
      setGuardandoGasto(false);
    }
  }

  async function handleAnular(ventaId: number, ventaNumero?: number) {
    if (!onAnularVenta) return;
    const label = ventaNumero ?? ventaId;
    const ok = window.confirm(
      `¿Anular la venta #${label}? Se devolverá el stock a los lotes originales.`,
    );
    if (!ok) return;
    setAnulandoId(ventaId);
    try {
      await onAnularVenta(ventaId);
      setExpandedMovId(null);
    } catch {
      /* error en catalogError */
    } finally {
      setAnulandoId(null);
    }
  }

  function handleNuevaOrden() {
    if (!caja) {
      window.alert("Debes abrir la caja antes de crear una orden.");
      return;
    }
    onNuevaOrden();
  }

  return (
    <div className="caja-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="caja-mark" />

      <main className="caja-main">
        <div className="caja-date-bar" aria-label="Fecha del día de caja">
          TURNO DE CAJA | {formatFechaLabel(fecha)}
        </div>

        <section
          className={`caja-status ${caja ? "is-open" : "is-closed"}`}
          aria-label="Estado de caja"
        >
          {caja ? (
            <div>
              <strong>
                Caja ABIERTA #{caja.numero ?? caja.id}
                {caja.nombre_vendedor ? ` · ${caja.nombre_vendedor}` : ""}
              </strong>
              <span>
                Apertura {formatMoney(caja.monto_apertura)}
                {caja.cuadre
                  ? ` · efectivo teórico ${formatMoney(caja.cuadre.efectivo_teorico)}`
                  : ""}
              </span>
            </div>
          ) : (
            <form className="caja-open-form" onSubmit={onAbrirCaja}>
              <div className="caja-open-copy">
                <strong>Sin caja abierta</strong>
                <span>
                  Abre un turno eligiendo un miembro del equipo y el monto
                  inicial. Sin caja abierta no se registran ventas.
                </span>
              </div>
              <select
                value={nombreVendedor}
                onChange={(e) => onNombreVendedorChange(e.target.value)}
                required
                aria-label="Vendedor del equipo"
              >
                <option value="">Selecciona del equipo…</option>
                {vendedoresEquipo.map((m) => (
                  <option key={m.id} value={m.nombre}>
                    {m.nombre}
                    {m.rol === "owner" ? " (dueño)" : ""}
                  </option>
                ))}
              </select>
              {vendedoresEquipo.length === 0 && (
                <p className="caja-open-hint">
                  No hay miembros activos. Agrégalos en Equipo antes de abrir
                  caja.
                </p>
              )}
              <input
                type="number"
                min={0}
                value={montoApertura}
                onChange={(e) => onMontoAperturaChange(e.target.value)}
                placeholder="Monto apertura"
                required
                aria-label="Monto de apertura"
              />
              <button type="submit" disabled={vendedoresEquipo.length === 0}>
                Abrir caja
              </button>
            </form>
          )}
        </section>

        {error && (
          <p className="caja-error" role="alert">
            {error}
          </p>
        )}

        {caja ? (
          <>
            <section className="caja-summary-card" aria-label="Resumen del turno">
              <div className="caja-summary-left">
                <span className="caja-summary-icon">
                  <ChartUpIcon />
                </span>
                <div>
                  <p className="caja-summary-label">Ventas de este turno</p>
                  <strong>{formatClp(totalTurno)}</strong>
                  {caja.cuadre && (
                    <p className="caja-summary-medios-line">
                      Ef {formatMoney(caja.cuadre.ventas_efectivo)} · Tar{" "}
                      {formatMoney(caja.cuadre.ventas_tarjeta)} · Trf{" "}
                      {formatMoney(caja.cuadre.ventas_transferencia)} · Créd{" "}
                      {formatMoney(caja.cuadre.ventas_credito ?? 0)}
                      {(caja.cuadre.cobros_credito ?? 0) > 0
                        ? ` · Cobros créd ${formatMoney(caja.cuadre.cobros_credito ?? 0)}`
                        : ""}
                    </p>
                  )}
                </div>
              </div>
              <div className="caja-summary-right">
                <p className="caja-summary-label">Egresos / Inyecciones</p>
                <strong className="caja-summary-medios">
                  {formatMoney(caja.cuadre?.egresos_efectivo ?? 0)}
                  {" / "}
                  {formatMoney(caja.cuadre?.inyecciones_efectivo ?? 0)}
                </strong>
              </div>
            </section>

            <section className="caja-movs" aria-label="Movimientos del turno">
              <div className="caja-movs-head">
                <h2>Movimientos del turno</h2>
                <button
                  type="button"
                  className="caja-movs-refresh"
                  onClick={() => onRefreshMovimientos?.()}
                  disabled={loadingMovimientos}
                >
                  Actualizar
                </button>
              </div>
              {loadingMovimientos && (
                <p className="caja-movs-empty">Cargando…</p>
              )}
              {!loadingMovimientos && (
                <ul className="caja-movs-list">
                  {movimientos.map((m) => {
                    const esVenta =
                      m.tipo_transaccion === "INGRESO_VENTA" && m.venta_id != null;
                    const venta = esVenta
                      ? ventasById.get(m.venta_id as number)
                      : undefined;
                    const open = expandedMovId === m.id;
                    const esGasto = m.tipo_transaccion.startsWith("GASTO");
                    return (
                      <li
                        key={m.id}
                        className={`caja-mov-row${open ? " is-open" : ""}${
                          venta?.anulada ? " is-anulada" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="caja-mov-toggle"
                          onClick={() =>
                            setExpandedMovId((prev) =>
                              prev === m.id ? null : m.id,
                            )
                          }
                          aria-expanded={open}
                        >
                          <div>
                            <strong>
                              {tipoLabel(m.tipo_transaccion)}
                              {esVenta
                                ? ` #${venta?.numero ?? m.venta_id}`
                                : ""}
                              {venta?.anulada ? " · ANULADA" : ""}
                            </strong>
                            <span>
                              {m.descripcion}
                              {m.medio_pago ? ` · ${m.medio_pago}` : ""}
                            </span>
                            <span className="caja-movs-hora">
                              {new Date(m.fecha_hora).toLocaleTimeString(
                                "es-CL",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                          <strong className={esGasto ? "is-out" : "is-in"}>
                            {esGasto ? "−" : "+"}
                            {formatMoney(m.monto)}
                          </strong>
                        </button>

                        {open && (
                          <div className="caja-mov-detail">
                            {esVenta ? (
                              <>
                                <ul className="caja-mov-items">
                                  {(venta?.items ?? []).map((it) => (
                                    <li key={it.id}>
                                      <span>
                                        {it.producto_nombre} (x
                                        {Number(it.cantidad).toLocaleString(
                                          "es-CL",
                                        )}
                                        )
                                      </span>
                                      <span>{formatMoney(it.subtotal)}</span>
                                    </li>
                                  ))}
                                  {(venta?.items ?? []).length === 0 && (
                                    <li className="caja-movs-empty">
                                      Sin detalle de ítems.
                                    </li>
                                  )}
                                </ul>
                                {canWrite &&
                                  onAnularVenta &&
                                  m.venta_id != null &&
                                  !venta?.anulada && (
                                    <button
                                      type="button"
                                      className="caja-mov-anular"
                                      disabled={anulandoId === m.venta_id}
                                      onClick={() =>
                                        void handleAnular(
                                          m.venta_id as number,
                                          venta?.numero,
                                        )
                                      }
                                    >
                                      {anulandoId === m.venta_id
                                        ? "Anulando…"
                                        : "Anular venta"}
                                    </button>
                                  )}
                              </>
                            ) : (
                              <p className="caja-mov-meta">
                                {m.descripcion} · {m.medio_pago} ·{" "}
                                {formatMoney(m.monto)}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {movimientos.length === 0 && (
                    <li className="caja-movs-empty">
                      Sin movimientos aún en este turno.
                    </li>
                  )}
                </ul>
              )}
            </section>

            <section className="caja-gasto-card" aria-label="Registrar movimiento">
              <div className="caja-gasto-head">
                <h2>Gasto / inyección</h2>
                <button
                  type="button"
                  className="caja-gasto-open-btn"
                  onClick={() => setGastoModalOpen(true)}
                >
                  + Registrar
                </button>
              </div>
              <p className="caja-gasto-hint">
                Registra egresos o inyecciones de efectivo del turno.
              </p>
            </section>

            {stockAlertNombre && (
              <div className="caja-stock-alert" role="status">
                <span className="caja-stock-badge" aria-hidden="true">
                  !
                </span>
                <p>
                  Alerta stock bajo: <strong>{stockAlertNombre}</strong>
                </p>
              </div>
            )}

            <section className="caja-cierre-final" aria-label="Cierre de caja">
              <button
                type="button"
                className="caja-close-btn"
                onClick={() => setConfirmCierre(true)}
              >
                Cerrar caja
              </button>
            </section>
          </>
        ) : (
          <section className="caja-empty-turno" aria-label="Sin turno">
            <p>No hay caja abierta. Las ventas del turno aparecerán aquí al abrir.</p>
          </section>
        )}
      </main>

      <footer className="caja-footer">
        <button
          type="button"
          className="caja-nueva-orden"
          onClick={handleNuevaOrden}
          disabled={!caja}
        >
          Nueva Venta
        </button>
      </footer>

      {gastoModalOpen && (
        <div
          className="caja-modal-backdrop"
          role="presentation"
          onClick={() => !guardandoGasto && setGastoModalOpen(false)}
        >
          <div
            className="caja-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="caja-gasto-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="caja-gasto-title">Gasto / inyección</h2>
            <form
              className="caja-gasto-form"
              onSubmit={(e) => void handleGasto(e)}
            >
              <label>
                Tipo
                <select
                  value={gastoTipo}
                  onChange={(e) => onGastoTipoChange(e.target.value)}
                >
                  <option value="GASTO_OPERATIVO">Gasto operativo</option>
                  <option value="GASTO_GENERAL">Gasto general</option>
                  <option value="INYECCION_CAJA">Inyección de caja</option>
                </select>
              </label>
              <label>
                Monto
                <input
                  type="number"
                  min={1}
                  value={gastoMonto}
                  onChange={(e) => onGastoMontoChange(e.target.value)}
                  required
                />
              </label>
              <label>
                Descripción
                <input
                  type="text"
                  minLength={3}
                  maxLength={255}
                  value={gastoDesc}
                  onChange={(e) => onGastoDescChange(e.target.value)}
                  required
                />
              </label>
              <div className="caja-modal-actions">
                <button
                  type="button"
                  className="caja-modal-cancel"
                  onClick={() => setGastoModalOpen(false)}
                  disabled={guardandoGasto}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="caja-modal-confirm"
                  disabled={guardandoGasto}
                >
                  {guardandoGasto ? "Guardando…" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmCierre && (
        <div className="caja-modal-backdrop" role="presentation">
          <div
            className="caja-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="caja-close-title"
            aria-describedby="caja-close-desc"
          >
            <h2 id="caja-close-title">¿Cerrar esta caja?</h2>
            <p id="caja-close-desc">
              Se cerrará el turno de {caja?.nombre_vendedor ?? "vendedor"} con el
              efectivo teórico (
              {formatMoney(caja?.cuadre?.efectivo_teorico ?? caja?.monto_apertura ?? 0)}
              ). Podrás abrir otra caja el mismo día con otro vendedor.
            </p>
            <div className="caja-modal-actions">
              <button
                type="button"
                className="caja-modal-cancel"
                onClick={() => setConfirmCierre(false)}
                disabled={cerrando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="caja-modal-confirm"
                onClick={() => void confirmarCierre()}
                disabled={cerrando}
              >
                {cerrando ? "Cerrando…" : "Sí, cerrar caja"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
