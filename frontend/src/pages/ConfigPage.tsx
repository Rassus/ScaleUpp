import { FormEvent, useEffect, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import "./DashboardPage.css";
import "./ConfigPage.css";

export type NegocioConfig = {
  negocio_id: number;
  alerta_stock_cantidad: number | string;
  alerta_stock_porcentaje: number;
  dias_caducidad_alerta: number;
  ingresos_visibles?: number;
};

export type NegocioPerfil = {
  id: number;
  nombre: string;
  slug: string;
  comuna: string | null;
  activo: boolean;
};

export type PlanPagoItem = {
  id: number;
  monto: number;
  periodo_inicio: string;
  periodo_fin: string;
  estado: "PENDIENTE" | "PAGADO" | "VENCIDO" | "ANULADO";
  pagado_en: string | null;
  nota: string | null;
  monto_mensual_ref?: number | null;
};

export type PlanResumen = {
  meses_pagados: number;
  total_pagado_clp: number;
  pagos_pendientes: number;
  monto_pendiente_clp: number;
  pagos: PlanPagoItem[];
};

export type ConfigCategoria = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  acceso_rapido: boolean;
  activo: boolean;
};

type ConfigTab = "negocio" | "alertas" | "categorias";

type ConfigPageProps = {
  config: NegocioConfig | null;
  negocioPerfil: NegocioPerfil | null;
  planResumen: PlanResumen | null;
  categorias: ConfigCategoria[];
  loading: boolean;
  saving: boolean;
  savingCategoria?: boolean;
  error: string | null;
  onOpenMenu: () => void;
  onLoad: () => void | Promise<void>;
  onSave: (data: {
    alerta_stock_cantidad: number;
    alerta_stock_porcentaje: number;
    dias_caducidad_alerta: number;
    ingresos_visibles: number;
  }) => Promise<void>;
  onSaveNegocio: (data: {
    nombre: string;
    comuna: string;
  }) => Promise<void>;
  onCreateCategoria: (data: {
    nombre: string;
    descripcion: string;
    acceso_rapido: boolean;
  }) => Promise<void>;
  onUpdateCategoria: (
    id: number,
    data: {
      nombre?: string;
      descripcion?: string | null;
      acceso_rapido?: boolean;
    },
  ) => Promise<void>;
  onDeleteCategoria: (id: number) => Promise<void>;
  onToggleAccesoRapido: (id: number, acceso_rapido: boolean) => Promise<void>;
  onSetAccesoRapidoMasivo: (acceso_rapido: boolean) => Promise<void>;
};

function formatClp(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

function estadoPagoLabel(e: string) {
  if (e === "PAGADO") return "Pagado";
  if (e === "PENDIENTE") return "Pendiente";
  if (e === "VENCIDO") return "Vencido";
  return e;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 3.6l2.4 4.86 5.36.78-3.88 3.78.92 5.34L12 15.9l-4.8 2.52.92-5.34-3.88-3.78 5.36-.78L12 3.6z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ConfigPage({
  config,
  negocioPerfil,
  planResumen,
  categorias,
  loading,
  saving,
  savingCategoria = false,
  error,
  onOpenMenu,
  onLoad,
  onSave,
  onSaveNegocio,
  onCreateCategoria,
  onUpdateCategoria,
  onDeleteCategoria,
  onToggleAccesoRapido,
  onSetAccesoRapidoMasivo,
}: ConfigPageProps) {
  const [tab, setTab] = useState<ConfigTab>("negocio");
  const [cantidad, setCantidad] = useState("5");
  const [porcentaje, setPorcentaje] = useState("15");
  const [dias, setDias] = useState("30");
  const [ingresosVisibles, setIngresosVisibles] = useState("3");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [atajosOpen, setAtajosOpen] = useState(false);

  const [negocioNombre, setNegocioNombre] = useState("");
  const [negocioComuna, setNegocioComuna] = useState("");

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [accesoRapidoNuevo, setAccesoRapidoNuevo] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    void onLoad();
  }, [onLoad]);

  useEffect(() => {
    if (!config) return;
    setCantidad(String(config.alerta_stock_cantidad));
    setPorcentaje(String(config.alerta_stock_porcentaje));
    setDias(String(config.dias_caducidad_alerta));
    setIngresosVisibles(String(config.ingresos_visibles ?? 3));
  }, [config]);

  useEffect(() => {
    if (!negocioPerfil) return;
    setNegocioNombre(negocioPerfil.nombre);
    setNegocioComuna(negocioPerfil.comuna ?? "");
  }, [negocioPerfil]);

  async function handleSubmitNegocio(e: FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    try {
      await onSaveNegocio({
        nombre: negocioNombre.trim(),
        comuna: negocioComuna.trim(),
      });
      setOkMsg("Datos del negocio guardados.");
    } catch {
      /* error vía props */
    }
  }

  async function handleSubmitAlertas(e: FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    try {
      await onSave({
        alerta_stock_cantidad: Number(cantidad),
        alerta_stock_porcentaje: Number(porcentaje),
        dias_caducidad_alerta: Number(dias),
        ingresos_visibles: Math.max(1, Math.round(Number(ingresosVisibles) || 3)),
      });
      setOkMsg("Configuración guardada.");
    } catch {
      /* error ya mostrado vía props.error */
    }
  }

  async function handleCreateCategoria(e: FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    try {
      await onCreateCategoria({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        acceso_rapido: accesoRapidoNuevo,
      });
      setNombre("");
      setDescripcion("");
      setAccesoRapidoNuevo(false);
      setOkMsg("Categoría creada.");
    } catch {
      /* props.error */
    }
  }

  function startEdit(c: ConfigCategoria) {
    setEditingId(c.id);
    setEditNombre(c.nombre);
    setEditDesc(c.descripcion ?? "");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    setOkMsg(null);
    try {
      await onUpdateCategoria(editingId, {
        nombre: editNombre.trim(),
        descripcion: editDesc.trim() || null,
      });
      setEditingId(null);
      setOkMsg("Categoría actualizada.");
    } catch {
      /* props.error */
    }
  }

  async function handleDelete(c: ConfigCategoria) {
    const ok = window.confirm(
      `¿Eliminar la categoría “${c.nombre}”? Dejará de aparecer en el catálogo.`,
    );
    if (!ok) return;
    setOkMsg(null);
    try {
      await onDeleteCategoria(c.id);
      if (editingId === c.id) setEditingId(null);
      setOkMsg("Categoría eliminada.");
    } catch {
      /* props.error */
    }
  }

  async function handleMasivo(acceso_rapido: boolean) {
    setOkMsg(null);
    try {
      await onSetAccesoRapidoMasivo(acceso_rapido);
      setOkMsg(
        acceso_rapido
          ? "Todas las categorías quedaron en favoritos."
          : "Se quitaron todas de favoritos.",
      );
    } catch {
      /* props.error */
    }
  }

  const activas = categorias.filter((c) => c.activo);

  return (
    <div className="cfg-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="cfg-mark" />

      <main className="cfg-main">
        <h1 className="cfg-title">Configuración</h1>
        <p className="cfg-lead">
          Datos de la sucursal, alertas y categorías del catálogo.
        </p>

        <div className="cfg-tabs" role="tablist" aria-label="Secciones">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "negocio"}
            className={`cfg-tab${tab === "negocio" ? " is-active" : ""}`}
            onClick={() => {
              setTab("negocio");
              setOkMsg(null);
            }}
          >
            Negocio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "alertas"}
            className={`cfg-tab${tab === "alertas" ? " is-active" : ""}`}
            onClick={() => {
              setTab("alertas");
              setOkMsg(null);
            }}
          >
            Alertas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "categorias"}
            className={`cfg-tab${tab === "categorias" ? " is-active" : ""}`}
            onClick={() => {
              setTab("categorias");
              setOkMsg(null);
            }}
          >
            Categorías
          </button>
        </div>

        {error && (
          <p className="cfg-error" role="alert">
            {error}
          </p>
        )}
        {okMsg && <p className="cfg-ok">{okMsg}</p>}

        {tab === "negocio" && (
          <>
            {loading && !negocioPerfil && (
              <p className="cfg-muted">Cargando…</p>
            )}
            <form
              className="cfg-card"
              onSubmit={(e) => void handleSubmitNegocio(e)}
            >
              <h2>Datos de la sucursal</h2>
              <p className="cfg-hint">
                Nombre y comuna para identificar esta sucursal.
              </p>
              <label>
                Nombre del negocio
                <input
                  value={negocioNombre}
                  onChange={(e) => setNegocioNombre(e.target.value)}
                  required
                  minLength={2}
                  maxLength={150}
                />
              </label>
              <label>
                Comuna
                <input
                  value={negocioComuna}
                  onChange={(e) => setNegocioComuna(e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Ej. Providencia, Maipú…"
                />
              </label>
              {negocioPerfil && (
                <p className="cfg-hint">
                  Identificador (slug): <code>{negocioPerfil.slug}</code>
                </p>
              )}
              <button type="submit" disabled={saving || loading}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </form>

            <section className="cfg-card" aria-label="Plan ScaleUpp">
              <h2>Plan ScaleUpp</h2>
              <p className="cfg-hint">
                Meses que has pagado por el servicio de esta sucursal.
              </p>
              {loading && !planResumen && (
                <p className="cfg-muted">Cargando pagos…</p>
              )}
              {planResumen && (
                <>
                  <div className="cfg-plan-stats">
                    <article>
                      <p>Meses pagados</p>
                      <strong>{planResumen.meses_pagados}</strong>
                    </article>
                    <article>
                      <p>Total pagado</p>
                      <strong>{formatClp(planResumen.total_pagado_clp)}</strong>
                    </article>
                    <article>
                      <p>Pendiente</p>
                      <strong>
                        {formatClp(planResumen.monto_pendiente_clp)}
                      </strong>
                    </article>
                  </div>
                  <ul className="cfg-plan-list">
                    {planResumen.pagos.map((p) => (
                      <li key={p.id}>
                        <div>
                          <strong>
                            {p.periodo_inicio} → {p.periodo_fin}
                          </strong>
                          <span>
                            {formatClp(p.monto)}
                            {p.pagado_en
                              ? ` · pagado ${new Date(p.pagado_en).toLocaleDateString("es-CL")}`
                              : ""}
                          </span>
                        </div>
                        <em
                          className={`cfg-plan-badge is-${p.estado.toLowerCase()}`}
                        >
                          {estadoPagoLabel(p.estado)}
                        </em>
                      </li>
                    ))}
                    {planResumen.pagos.length === 0 && (
                      <li className="cfg-muted">
                        Aún no hay cuotas registradas.
                      </li>
                    )}
                  </ul>
                </>
              )}
            </section>
          </>
        )}

        {tab === "alertas" && (
          <>
            {loading && !config && <p className="cfg-muted">Cargando…</p>}
            <form
              className="cfg-card"
              onSubmit={(e) => void handleSubmitAlertas(e)}
            >
              <h2>Alerta de pocos productos</h2>
              <p className="cfg-hint">
                Se dispara si el stock es menor o igual a la cantidad, o —si el
                producto tiene stock ideal— si cae bajo el porcentaje del ideal.
              </p>
              <label>
                Cantidad mínima
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                />
              </label>
              <label>
                Porcentaje del stock ideal (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  required
                />
              </label>

              <h2 className="cfg-section">Caducidad</h2>
              <label>
                Días de anticipación
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  required
                />
              </label>
              <p className="cfg-hint">
                Avisa cuando un lote vence dentro de estos días.
              </p>

              <h2 className="cfg-section">Detalle de producto</h2>
              <label>
                Ingresos visibles
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={ingresosVisibles}
                  onChange={(e) => setIngresosVisibles(e.target.value)}
                  required
                />
              </label>
              <p className="cfg-hint">
                Cuántos ingresos recientes mostrar expandibles en el detalle
                (el resto va en “Mostrar más”).
              </p>

              <button type="submit" disabled={saving || loading}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </form>
          </>
        )}

        {tab === "categorias" && (
          <>
            <form
              className="cfg-card"
              onSubmit={(e) => void handleCreateCategoria(e)}
            >
              <h2>Nueva categoría</h2>
              <label>
                Nombre
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  minLength={1}
                  maxLength={100}
                  placeholder="Ej. Lácteos"
                />
              </label>
              <label>
                Descripción (opcional)
                <input
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  maxLength={500}
                />
              </label>
              <label className="cfg-check">
                <input
                  type="checkbox"
                  checked={accesoRapidoNuevo}
                  onChange={(e) => setAccesoRapidoNuevo(e.target.checked)}
                />
                Marcar como acceso rápido en Orden
              </label>
              <button type="submit" disabled={savingCategoria}>
                {savingCategoria ? "Guardando…" : "Agregar categoría"}
              </button>
            </form>

            <section className="cfg-card cfg-atajos" aria-label="Atajos">
              <button
                type="button"
                className="cfg-atajos-toggle"
                aria-expanded={atajosOpen}
                onClick={() => setAtajosOpen((v) => !v)}
              >
                <div>
                  <h2>Atajos</h2>
                  <p>Acciones rápidas sobre favoritos</p>
                </div>
                <span aria-hidden="true">{atajosOpen ? "▾" : "▸"}</span>
              </button>
              {atajosOpen && (
                <div className="cfg-atajos-body">
                  <button
                    type="button"
                    className="cfg-atajo-btn"
                    disabled={savingCategoria || activas.length === 0}
                    onClick={() => void handleMasivo(true)}
                  >
                    Agregar todos a favorito
                  </button>
                  <button
                    type="button"
                    className="cfg-atajo-btn is-muted"
                    disabled={savingCategoria || activas.length === 0}
                    onClick={() => void handleMasivo(false)}
                  >
                    Quitar todos de favorito
                  </button>
                </div>
              )}
            </section>

            <section className="cfg-card cfg-cat-list" aria-label="Categorías">
              <h2>Categorías ({activas.length})</h2>
              <p className="cfg-hint">
                Toca la estrella para mostrar u ocultar la categoría en el acceso
                rápido de Orden.
              </p>
              {activas.length === 0 ? (
                <p className="cfg-muted">Aún no hay categorías activas.</p>
              ) : (
                <ul className="cfg-cats">
                  {activas.map((c) => (
                    <li
                      key={c.id}
                      className={`cfg-cat-item${
                        c.acceso_rapido ? " is-starred" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`cfg-star${
                          c.acceso_rapido ? " is-on" : ""
                        }`}
                        aria-label={
                          c.acceso_rapido
                            ? `Quitar ${c.nombre} de acceso rápido`
                            : `Marcar ${c.nombre} como acceso rápido`
                        }
                        aria-pressed={c.acceso_rapido}
                        disabled={savingCategoria}
                        onClick={() =>
                          void onToggleAccesoRapido(c.id, !c.acceso_rapido)
                        }
                      >
                        <StarIcon filled={c.acceso_rapido} />
                      </button>

                      {editingId === c.id ? (
                        <form
                          className="cfg-cat-edit"
                          onSubmit={(e) => void saveEdit(e)}
                        >
                          <input
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            required
                            maxLength={100}
                            aria-label="Nombre"
                          />
                          <input
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            maxLength={500}
                            placeholder="Descripción"
                            aria-label="Descripción"
                          />
                          <div className="cfg-cat-edit-actions">
                            <button
                              type="button"
                              className="cfg-link"
                              onClick={() => setEditingId(null)}
                              disabled={savingCategoria}
                            >
                              Cancelar
                            </button>
                            <button type="submit" disabled={savingCategoria}>
                              Guardar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="cfg-cat-body">
                          <strong>{c.nombre}</strong>
                          {c.descripcion ? <span>{c.descripcion}</span> : null}
                          <div className="cfg-cat-actions">
                            <button
                              type="button"
                              className="cfg-link"
                              onClick={() => startEdit(c)}
                              disabled={savingCategoria}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="cfg-link is-danger"
                              onClick={() => void handleDelete(c)}
                              disabled={savingCategoria}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
