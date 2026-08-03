import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import { formatClpLabel as formatClp } from "../money";
import "./DashboardPage.css";
import "./PromocionesPage.css";

export type PromoProducto = {
  id: number;
  nombre: string;
  precio_venta: number;
  tipo: string;
};

export type PromoItem = {
  id?: number;
  producto_id: number;
  producto_nombre?: string;
  tipo: "FIJO" | "PORCENTAJE";
  valor: number;
  precio_lista?: number;
  costo_piso?: number | null;
  precio_efectivo?: number;
};

export type Promo = {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean;
  vigente: boolean;
  items: PromoItem[];
};

type DraftItem = {
  key: string;
  producto_id: number | "";
  tipo: "FIJO" | "PORCENTAJE";
  valor: string;
  precio_lista: number;
  costo_piso: number | null;
  precio_efectivo: number | null;
  error: string | null;
};

type PromocionesPageProps = {
  token: string;
  negocioId: number;
  apiBase: string;
  authHeaders: (token: string, negocioId: number | null) => HeadersInit;
  productos: PromoProducto[];
  canWrite: boolean;
  onOpenMenu: () => void;
};

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function ceil(n: number): number {
  return Math.ceil(n);
}

function calcEfectivo(
  lista: number,
  tipo: "FIJO" | "PORCENTAJE",
  valor: number,
): number {
  if (tipo === "FIJO") return Math.round(valor);
  const pct = Math.min(Math.max(valor, 0), 80);
  return Math.ceil(lista * (1 - pct / 100));
}

function minimoPermitido(lista: number, costo: number | null): number {
  const pisoLista = lista > 0 ? ceil(lista * 0.2) : 0;
  if (costo == null) return pisoLista;
  return Math.max(costo, pisoLista);
}

function newDraftItem(): DraftItem {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    producto_id: "",
    tipo: "PORCENTAJE",
    valor: "10",
    precio_lista: 0,
    costo_piso: null,
    precio_efectivo: null,
    error: null,
  };
}

export default function PromocionesPage({
  token,
  negocioId,
  apiBase,
  authHeaders,
  productos,
  canWrite,
  onOpenMenu,
}: PromocionesPageProps) {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState(todayIso());
  const [fechaFin, setFechaFin] = useState(todayIso());
  const [activa, setActiva] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/promociones`, {
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = (await res.json()) as Promo[];
      setPromos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar promociones");
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders, negocioId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const productosById = useMemo(() => {
    const m = new Map<number, PromoProducto>();
    for (const p of productos) m.set(p.id, p);
    return m;
  }, [productos]);

  async function fetchCostoPiso(productoId: number): Promise<number | null> {
    const res = await fetch(`${apiBase}/productos/${productoId}/precio-efectivo`, {
      headers: authHeaders(token, negocioId),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { costo_piso?: number | null };
    return data.costo_piso ?? null;
  }

  function resetForm() {
    setEditingId(null);
    setNombre("");
    setFechaInicio(todayIso());
    setFechaFin(todayIso());
    setActiva(true);
    setItems([newDraftItem()]);
    setShowForm(false);
    setError(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(p: Promo) {
    setEditingId(p.id);
    setNombre(p.nombre);
    setFechaInicio(p.fecha_inicio.slice(0, 10));
    setFechaFin(p.fecha_fin.slice(0, 10));
    setActiva(p.activa);
    setItems(
      p.items.length
        ? p.items.map((it) => {
            const lista = it.precio_lista ?? productosById.get(it.producto_id)?.precio_venta ?? 0;
            const costo = it.costo_piso ?? null;
            const efectivo =
              it.precio_efectivo ??
              calcEfectivo(lista, it.tipo, it.valor);
            const min = minimoPermitido(lista, costo);
            return {
              key: `e-${it.id ?? it.producto_id}`,
              producto_id: it.producto_id,
              tipo: it.tipo,
              valor: String(it.valor),
              precio_lista: lista,
              costo_piso: costo,
              precio_efectivo: efectivo,
              error:
                costo == null
                  ? "Sin costo de referencia"
                  : efectivo < min
                    ? `Bajo el mínimo (${formatClp(min)})`
                    : null,
            };
          })
        : [newDraftItem()],
    );
    setShowForm(true);
    setError(null);
  }

  async function onPickProducto(key: string, productoId: number | "") {
    if (productoId === "") {
      setItems((prev) =>
        prev.map((it) =>
          it.key === key
            ? { ...newDraftItem(), key: it.key, tipo: it.tipo, valor: it.valor }
            : it,
        ),
      );
      return;
    }
    const prod = productosById.get(productoId);
    if (!prod) return;
    const costo = await fetchCostoPiso(productoId);
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const valorNum = Number(it.valor) || 0;
        const efectivo = calcEfectivo(prod.precio_venta, it.tipo, valorNum);
        const min = minimoPermitido(prod.precio_venta, costo);
        let err: string | null = null;
        if (costo == null) err = "Sin costo de referencia — no se permite promo";
        else if (efectivo < min) err = `Precio bajo el mínimo (${formatClp(min)})`;
        return {
          ...it,
          producto_id: productoId,
          precio_lista: prod.precio_venta,
          costo_piso: costo,
          precio_efectivo: efectivo,
          error: err,
        };
      }),
    );
  }

  function updateItem(
    key: string,
    patch: Partial<Pick<DraftItem, "tipo" | "valor">>,
  ) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, ...patch };
        const valorNum = Number(next.valor) || 0;
        if (next.producto_id === "") {
          return { ...next, precio_efectivo: null, error: null };
        }
        const efectivo = calcEfectivo(next.precio_lista, next.tipo, valorNum);
        const min = minimoPermitido(next.precio_lista, next.costo_piso);
        let err: string | null = null;
        if (next.costo_piso == null) err = "Sin costo de referencia — no se permite promo";
        else if (next.tipo === "PORCENTAJE" && valorNum > 80)
          err = "Máximo 80% de descuento";
        else if (efectivo < min) err = `Precio bajo el mínimo (${formatClp(min)})`;
        return { ...next, precio_efectivo: efectivo, error: err };
      }),
    );
  }

  const formInvalid = useMemo(() => {
    if (!nombre.trim()) return true;
    if (fechaFin < fechaInicio) return true;
    if (items.length === 0) return true;
    return items.some(
      (it) =>
        it.producto_id === "" ||
        !Number(it.valor) ||
        it.error != null ||
        it.costo_piso == null,
    );
  }, [nombre, fechaInicio, fechaFin, items]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || formInvalid) return;
    setSaving(true);
    setError(null);
    const body = {
      nombre: nombre.trim(),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      activa,
      items: items.map((it) => ({
        producto_id: it.producto_id as number,
        tipo: it.tipo,
        valor: Math.round(Number(it.valor)),
      })),
    };
    try {
      const url =
        editingId != null
          ? `${apiBase}/promociones/${editingId}`
          : `${apiBase}/promociones`;
      const res = await fetch(url, {
        method: editingId != null ? "PATCH" : "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          typeof errBody.detail === "string"
            ? errBody.detail
            : `Error ${res.status}`,
        );
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActiva(p: Promo) {
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/promociones/${p.id}`, {
        method: "PATCH",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({ activa: !p.activa }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          typeof errBody.detail === "string"
            ? errBody.detail
            : `Error ${res.status}`,
        );
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="promo-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="promo-mark" />

      <main className="promo-main">
        <div className="promo-head">
          <div>
            <h1 className="promo-title">Promociones</h1>
            <p className="promo-lead">
              Precios especiales por producto con vigencia y tope del 80% sobre lista.
            </p>
          </div>
          {canWrite && !showForm && (
            <button type="button" className="promo-new-btn" onClick={openCreate}>
              Nueva
            </button>
          )}
        </div>

        {error && <p className="promo-error">{error}</p>}

        {showForm && canWrite && (
          <form className="promo-form" onSubmit={onSubmit}>
            <div className="promo-form-head">
              <button
                type="button"
                className="promo-back-btn"
                onClick={resetForm}
                aria-label="Volver al listado"
              >
                ← Volver
              </button>
              <h2>{editingId != null ? "Editar promoción" : "Nueva promoción"}</h2>
            </div>
            <label>
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                maxLength={150}
              />
            </label>
            <div className="promo-dates">
              <label>
                Desde
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  required
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required
                />
              </label>
            </div>
            <label className="promo-check">
              <input
                type="checkbox"
                checked={activa}
                onChange={(e) => setActiva(e.target.checked)}
              />
              Activa
            </label>

            <div className="promo-items-head">
              <strong>Productos</strong>
              <button
                type="button"
                className="promo-link-btn"
                onClick={() => setItems((prev) => [...prev, newDraftItem()])}
              >
                + Agregar
              </button>
            </div>

            <ul className="promo-draft-list">
              {items.map((it) => (
                <li key={it.key} className="promo-draft-item">
                  <label>
                    Producto
                    <select
                      value={it.producto_id === "" ? "" : String(it.producto_id)}
                      onChange={(e) => {
                        const v = e.target.value;
                        void onPickProducto(it.key, v ? Number(v) : "");
                      }}
                    >
                      <option value="">Elegir…</option>
                      {productos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="promo-draft-row">
                    <label>
                      Tipo
                      <select
                        value={it.tipo}
                        onChange={(e) =>
                          updateItem(it.key, {
                            tipo: e.target.value as "FIJO" | "PORCENTAJE",
                          })
                        }
                      >
                        <option value="PORCENTAJE">% descuento</option>
                        <option value="FIJO">Precio fijo</option>
                      </select>
                    </label>
                    <label>
                      Valor
                      <input
                        inputMode="numeric"
                        value={it.valor}
                        onChange={(e) => updateItem(it.key, { valor: e.target.value })}
                      />
                    </label>
                  </div>
                  {it.producto_id !== "" && (
                    <p className="promo-preview">
                      Lista {formatClp(it.precio_lista)}
                      {it.costo_piso != null
                        ? ` · Costo piso ${formatClp(it.costo_piso)}`
                        : " · Sin costo"}
                      {it.precio_efectivo != null
                        ? ` · Efectivo ${formatClp(it.precio_efectivo)}`
                        : ""}
                    </p>
                  )}
                  {it.error && <p className="promo-item-error">{it.error}</p>}
                  {items.length > 1 && (
                    <button
                      type="button"
                      className="promo-link-btn danger"
                      onClick={() =>
                        setItems((prev) => prev.filter((x) => x.key !== it.key))
                      }
                    >
                      Quitar
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="promo-form-actions">
              <button type="button" className="promo-btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
              <button
                type="submit"
                className="promo-btn-primary"
                disabled={saving || formInvalid}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="promo-muted">Cargando…</p>
        ) : promos.length === 0 ? (
          <p className="promo-muted">Aún no hay promociones.</p>
        ) : (
          <ul className="promo-list">
            {promos.map((p) => (
              <li key={p.id} className="promo-card">
                <div className="promo-card-top">
                  <div>
                    <strong>{p.nombre}</strong>
                    <p className="promo-meta">
                      {p.fecha_inicio.slice(0, 10)} → {p.fecha_fin.slice(0, 10)}
                    </p>
                  </div>
                  <span
                    className={`promo-badge${
                      p.vigente ? " on" : p.activa ? "" : " off"
                    }`}
                  >
                    {p.vigente ? "Vigente" : p.activa ? "Fuera de vigencia" : "Inactiva"}
                  </span>
                </div>
                <ul className="promo-card-items">
                  {p.items.map((it) => (
                    <li key={it.id ?? it.producto_id}>
                      {it.producto_nombre ?? `#${it.producto_id}`}
                      {" · "}
                      {it.tipo === "PORCENTAJE"
                        ? `${it.valor}%`
                        : formatClp(it.valor)}
                      {it.precio_efectivo != null
                        ? ` → ${formatClp(it.precio_efectivo)}`
                        : ""}
                    </li>
                  ))}
                </ul>
                {canWrite && (
                  <div className="promo-card-actions">
                    <button type="button" className="promo-link-btn" onClick={() => openEdit(p)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="promo-link-btn"
                      disabled={saving}
                      onClick={() => void toggleActiva(p)}
                    >
                      {p.activa ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
