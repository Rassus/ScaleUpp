import { FormEvent, useEffect, useMemo, useState } from "react";
import BarcodeScanner from "../components/BarcodeScanner";
import DashTopbar from "../components/DashTopbar";
import { esPesoSolido, formatPeso } from "../peso";
import { formatClp } from "../money";
import "./DashboardPage.css";
import "./CompraPage.css";

export type CompraProducto = {
  id: number;
  nombre: string;
  codigo_barras: string | null;
  tipo: string;
  controla_caducidad: boolean;
  unidad_sigla?: string;
};

export type CompraListItem = {
  id: number;
  numero?: number;
  fecha: string;
  nota: string | null;
  costo_operacion_total: number;
  monto_total: number;
  num_items: number;
  creado_en: string;
};

export type CompraDetalleItem = {
  id: number;
  producto_id: number;
  producto_nombre: string;
  cantidad: string | number;
  precio_costo_neto: number;
  fecha_caducidad: string | null;
  monto_linea: number;
};

export type CompraDetalle = {
  id: number;
  numero?: number;
  fecha: string;
  nota: string | null;
  costo_operacion_total: number;
  monto_total: number;
  items: CompraDetalleItem[];
};

export type CompraUnidad = { id: number; nombre: string; sigla: string };
export type CompraCategoria = { id: number; nombre: string };

export type CompraLineaDraft = {
  key: string;
  producto_id: number;
  nombre: string;
  unidad_sigla: string;
  controla_caducidad: boolean;
  cantidad: string;
  /** Precio ingresado: unitario o total según costo_es_total */
  precio_ingresado: string;
  /** Si true, el precio es el total de la línea → costo unitario = total / cantidad */
  costo_es_total: boolean;
  fecha_caducidad: string;
};

type CompraPageProps = {
  productos: CompraProducto[];
  unidades: CompraUnidad[];
  categorias: CompraCategoria[];
  comprasRecientes: CompraListItem[];
  canWrite: boolean;
  saving: boolean;
  savingProducto?: boolean;
  error: string | null;
  okMsg: string | null;
  onOpenMenu: () => void;
  onLoadCompras: () => void | Promise<void>;
  onLoadDetalleCompra: (compraId: number) => Promise<CompraDetalle>;
  onCreateProducto?: (data: {
    nombre: string;
    codigo_barras: string;
    precio_venta: number;
    unidad_medida_id: number;
    categoria_id: number | null;
    controla_caducidad: boolean;
  }) => Promise<{ id: number; unidad_sigla?: string }>;
  onConfirmar: (data: {
    nota: string;
    costo_operacion_total: number;
    fecha: string | null;
    items: {
      producto_id: number;
      cantidad: number;
      precio_costo_neto: number;
      fecha_caducidad: string | null;
    }[];
  }) => Promise<void>;
};

function parseNum(v: string): number {
  return Number(String(v).replace(",", "."));
}

function unitCost(l: Pick<CompraLineaDraft, "cantidad" | "precio_ingresado" | "costo_es_total">): number {
  const qty = parseNum(l.cantidad);
  const price = parseNum(l.precio_ingresado);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) {
    return 0;
  }
  if (l.costo_es_total) {
    return Math.round(price / qty);
  }
  return Math.round(price);
}

function lineTotal(l: Pick<CompraLineaDraft, "cantidad" | "precio_ingresado" | "costo_es_total">): number {
  const qty = parseNum(l.cantidad);
  const price = parseNum(l.precio_ingresado);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) {
    return 0;
  }
  if (l.costo_es_total) {
    return Math.round(price);
  }
  return Math.round(qty * price);
}

function emptyFormFromProducto(p: CompraProducto): CompraLineaDraft {
  return {
    key: `${p.id}-${Date.now()}`,
    producto_id: p.id,
    nombre: p.nombre,
    unidad_sigla: p.unidad_sigla ?? "UND",
    controla_caducidad: p.controla_caducidad,
    cantidad: "1",
    precio_ingresado: "0",
    costo_es_total: false,
    fecha_caducidad: "",
  };
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 6.5l3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export default function CompraPage({
  productos,
  unidades,
  categorias,
  comprasRecientes,
  canWrite,
  saving,
  savingProducto = false,
  error,
  okMsg,
  onOpenMenu,
  onLoadCompras,
  onLoadDetalleCompra,
  onCreateProducto,
  onConfirmar,
}: CompraPageProps) {
  const [q, setQ] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [camara, setCamara] = useState(false);
  /** Formulario activo (agregar o editar) */
  const [form, setForm] = useState<CompraLineaDraft | null>(null);
  /** Si no null, el formulario está editando una línea ya en la lista */
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [lineas, setLineas] = useState<CompraLineaDraft[]>([]);
  const [nota, setNota] = useState("");
  const [costoOp, setCostoOp] = useState("0");
  const [fechaCompra, setFechaCompra] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [expandedCompraId, setExpandedCompraId] = useState<number | null>(null);
  const [detalleCache, setDetalleCache] = useState<
    Record<number, CompraDetalle>
  >({});
  const [loadingDetalleId, setLoadingDetalleId] = useState<number | null>(null);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [crearOpen, setCrearOpen] = useState(false);
  const [crearNombre, setCrearNombre] = useState("");
  const [crearCodigo, setCrearCodigo] = useState("");
  const [crearPrecio, setCrearPrecio] = useState("1000");
  const [crearUnidadId, setCrearUnidadId] = useState<number | "">(
    unidades[0]?.id ?? "",
  );
  const [crearCategoriaId, setCrearCategoriaId] = useState<number | "">("");
  const [crearCaduca, setCrearCaduca] = useState(false);

  useEffect(() => {
    void onLoadCompras();
  }, [onLoadCompras]);

  useEffect(() => {
    if (crearUnidadId === "" && unidades[0]) {
      setCrearUnidadId(unidades[0].id);
    }
  }, [unidades, crearUnidadId]);

  const simpleProductos = useMemo(
    () => productos.filter((p) => p.tipo !== "KIT"),
    [productos],
  );

  const resultados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return simpleProductos
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          (p.codigo_barras ?? "").toLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [simpleProductos, q]);

  const noMatch =
    showResults && q.trim().length > 0 && resultados.length === 0;

  const subtotalLineas = useMemo(
    () => lineas.reduce((s, l) => s + lineTotal(l), 0),
    [lineas],
  );
  const op = Number(costoOp) || 0;
  const totalInversion = subtotalLineas + (op > 0 ? op : 0);
  const isEditing = editingKey != null;

  /** Carga el producto en el formulario (no lo manda aún a la lista). */
  function loadProductoEnFormulario(p: CompraProducto) {
    setLocalError(null);
    const existing = lineas.find((l) => l.producto_id === p.id);
    if (existing) {
      setForm({ ...existing });
      setEditingKey(existing.key);
    } else {
      setForm(emptyFormFromProducto(p));
      setEditingKey(null);
    }
    setQ("");
    setShowResults(false);
    setCamara(false);
  }

  function loadLineaEnFormulario(l: CompraLineaDraft) {
    setLocalError(null);
    setForm({ ...l });
    setEditingKey(l.key);
    setShowResults(false);
    setCamara(false);
  }

  function clearFormulario() {
    setForm(null);
    setEditingKey(null);
  }

  function patchForm(patch: Partial<CompraLineaDraft>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) {
      setShowResults(true);
      return;
    }
    const byCode = simpleProductos.find(
      (p) => (p.codigo_barras ?? "").toLowerCase() === term.toLowerCase(),
    );
    if (byCode) {
      loadProductoEnFormulario(byCode);
      return;
    }
    setShowResults(true);
  }

  async function toggleCompraDetalle(compraId: number) {
    if (expandedCompraId === compraId) {
      setExpandedCompraId(null);
      setDetalleError(null);
      return;
    }
    setExpandedCompraId(compraId);
    setDetalleError(null);
    if (detalleCache[compraId]) return;
    setLoadingDetalleId(compraId);
    try {
      const detalle = await onLoadDetalleCompra(compraId);
      setDetalleCache((prev) => ({ ...prev, [compraId]: detalle }));
    } catch (err) {
      setDetalleError(
        err instanceof Error ? err.message : "No se pudo cargar el detalle",
      );
    } finally {
      setLoadingDetalleId(null);
    }
  }

  function openCrearProducto(prefillCode?: string) {
    setCrearCodigo(prefillCode ?? q.trim());
    setCrearNombre("");
    setCrearPrecio("1000");
    setCrearCategoriaId("");
    setCrearCaduca(false);
    setCrearUnidadId(unidades[0]?.id ?? "");
    setCrearOpen(true);
    setShowResults(false);
    setCamara(false);
  }

  async function handleCrearProducto(e: FormEvent) {
    e.preventDefault();
    if (!onCreateProducto || crearUnidadId === "") return;
    setLocalError(null);
    try {
      const created = await onCreateProducto({
        nombre: crearNombre.trim(),
        codigo_barras: crearCodigo.trim(),
        precio_venta: Math.round(Number(crearPrecio) || 0),
        unidad_medida_id: crearUnidadId,
        categoria_id: crearCategoriaId === "" ? null : crearCategoriaId,
        controla_caducidad: crearCaduca,
      });
      const sigla =
        created.unidad_sigla ??
        unidades.find((u) => u.id === crearUnidadId)?.sigla ??
        "UND";
      setCrearOpen(false);
      loadProductoEnFormulario({
        id: created.id,
        nombre: crearNombre.trim(),
        codigo_barras: crearCodigo.trim() || null,
        tipo: "SIMPLE",
        controla_caducidad: crearCaduca,
        unidad_sigla: sigla,
      });
      setQ("");
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "No se pudo crear el producto",
      );
    }
  }

  function validateForm(l: CompraLineaDraft): string | null {
    const qty = parseNum(l.cantidad);
    const costo = unitCost(l);
    if (!Number.isFinite(qty) || qty <= 0) {
      return `Cantidad inválida en ${l.nombre}`;
    }
    if (!Number.isFinite(costo) || costo < 0) {
      return `Costo inválido en ${l.nombre}`;
    }
    if (l.controla_caducidad && !l.fecha_caducidad) {
      return `Indica caducidad para ${l.nombre}`;
    }
    return null;
  }

  function commitFormulario() {
    if (!form) return;
    setLocalError(null);
    const err = validateForm(form);
    if (err) {
      setLocalError(err);
      return;
    }
    if (editingKey) {
      setLineas((prev) =>
        prev.map((l) => (l.key === editingKey ? { ...form, key: editingKey } : l)),
      );
    } else {
      const key = form.key || `${form.producto_id}-${Date.now()}`;
      setLineas((prev) => {
        const withoutSame = prev.filter((l) => l.producto_id !== form.producto_id);
        // Pila: lo nuevo queda arriba; lo primero ingresado al final
        return [{ ...form, key }, ...withoutSame];
      });
    }
    clearFormulario();
  }

  function quitarDesdeFormulario() {
    if (!form) return;
    if (editingKey) {
      setLineas((prev) => prev.filter((l) => l.key !== editingKey));
    }
    clearFormulario();
  }

  async function handleConfirmar() {
    setLocalError(null);
    if (form) {
      setLocalError(
        "Tienes un producto en el formulario. Agrégalo a la lista o cancélalo antes de confirmar.",
      );
      return;
    }
    if (lineas.length === 0) {
      setLocalError("Agrega al menos un producto.");
      return;
    }
    for (const l of lineas) {
      const err = validateForm(l);
      if (err) {
        setLocalError(err);
        loadLineaEnFormulario(l);
        return;
      }
    }
    try {
      await onConfirmar({
        nota: nota.trim(),
        costo_operacion_total: Math.max(0, Math.round(Number(costoOp) || 0)),
        fecha: fechaCompra.trim() || null,
        items: lineas.map((l) => ({
          producto_id: l.producto_id,
          cantidad: parseNum(l.cantidad),
          precio_costo_neto: unitCost(l),
          fecha_caducidad: l.controla_caducidad
            ? l.fecha_caducidad || null
            : null,
        })),
      });
      setLineas([]);
      setNota("");
      setCostoOp("0");
      setFechaCompra("");
      clearFormulario();
      void onLoadCompras();
    } catch {
      /* error vía props.error */
    }
  }

  return (
    <div className="compra-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="compra-mark" />

      <main className="compra-main">
        <h1 className="compra-title">Compras</h1>
        <p className="compra-lead">
          Registra la mercadería que entra al negocio. Cada producto se suma al
          stock (FIFO). Si no existe en el catálogo, créalo aquí mismo. Queda
          como inversión (no como gasto de caja).
        </p>

        {(error || localError) && (
          <p className="compra-error" role="alert">
            {localError || error}
          </p>
        )}
        {okMsg && <p className="compra-ok">{okMsg}</p>}

        <form className="compra-search" onSubmit={onSearchSubmit}>
          <div className="compra-search-row">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShowResults(true);
              }}
              placeholder="Buscar o escanear código…"
              autoComplete="off"
              aria-label="Código de barras o búsqueda"
            />
            <button
              type="button"
              className={`compra-cam-btn${camara ? " is-active" : ""}`}
              onClick={() => {
                setLocalError(null);
                setCamara(true);
              }}
              aria-label="Abrir cámara"
            >
              <CameraIcon />
            </button>
          </div>
          <button type="submit" className="compra-add-btn">
            Buscar
          </button>
        </form>

        {camara && (
          <div className="compra-scanner">
            <BarcodeScanner
              hideLaunchButton
              active={camara}
              onActiveChange={setCamara}
              onDetected={(code) => {
                setQ(code);
                const p = simpleProductos.find(
                  (x) =>
                    (x.codigo_barras ?? "").toLowerCase() ===
                    code.toLowerCase(),
                );
                if (p) loadProductoEnFormulario(p);
                else {
                  setShowResults(true);
                  if (canWrite && onCreateProducto) {
                    openCrearProducto(code);
                  }
                }
              }}
              onError={(msg) => {
                if (msg) setLocalError(msg);
              }}
            />
          </div>
        )}

        {showResults && resultados.length > 0 && (
          <ul className="compra-results">
            {resultados.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => loadProductoEnFormulario(p)}>
                  <strong>{p.nombre}</strong>
                  <span>{p.codigo_barras ?? "Sin código"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {noMatch && (
          <div className="compra-nomatch">
            <p>
              No hay producto con “{q.trim()}”.
              {canWrite && onCreateProducto
                ? " Puedes crearlo y cargarlo en el formulario."
                : ""}
            </p>
            {canWrite && onCreateProducto && (
              <button
                type="button"
                className="compra-create-inline"
                onClick={() => openCrearProducto()}
              >
                + Crear producto
              </button>
            )}
          </div>
        )}

        {form && (
          <section
            className="compra-form-card"
            aria-label={isEditing ? "Editar línea" : "Producto a agregar"}
          >
            <div className="compra-form-head">
              <div>
                <p className="compra-form-kicker">
                  {isEditing ? "Editando línea" : "Producto seleccionado"}
                </p>
                <strong>{form.nombre}</strong>
              </div>
              <button
                type="button"
                className="compra-form-cancel"
                onClick={clearFormulario}
              >
                Cancelar
              </button>
            </div>

            <div className="compra-linea-grid">
              <label>
                Cant.{" "}
                {esPesoSolido(form.unidad_sigla)
                  ? "(kg)"
                  : `(${form.unidad_sigla})`}
                <input
                  type="number"
                  min={esPesoSolido(form.unidad_sigla) ? 0.001 : 0.01}
                  step={esPesoSolido(form.unidad_sigla) ? 0.001 : 1}
                  value={form.cantidad}
                  onChange={(e) => patchForm({ cantidad: e.target.value })}
                />
              </label>

              <label>
                Tipo de precio
                <select
                  value={form.costo_es_total ? "total" : "unidad"}
                  onChange={(e) =>
                    patchForm({ costo_es_total: e.target.value === "total" })
                  }
                >
                  <option value="unidad">Costo por unidad</option>
                  <option value="total">Costo total del lote</option>
                </select>
              </label>

              <label>
                {form.costo_es_total
                  ? "Costo total (CLP)"
                  : `Costo / ${esPesoSolido(form.unidad_sigla) ? "kg" : "u"}`}
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.precio_ingresado}
                  onChange={(e) =>
                    patchForm({ precio_ingresado: e.target.value })
                  }
                />
              </label>

              {form.controla_caducidad && (
                <label className="compra-caduca">
                  Caducidad
                  <input
                    type="date"
                    value={form.fecha_caducidad}
                    onChange={(e) =>
                      patchForm({ fecha_caducidad: e.target.value })
                    }
                    required
                  />
                </label>
              )}
            </div>

            {form.costo_es_total && parseNum(form.cantidad) > 0 && (
              <p className="compra-unit-hint">
                Costo unitario calculado:{" "}
                <strong>{formatClp(unitCost(form))}</strong>
              </p>
            )}

            <p className="compra-linea-total">
              Total línea: {formatClp(lineTotal(form))}
            </p>

            <div className="compra-form-actions">
              {isEditing && (
                <button
                  type="button"
                  className="compra-remove"
                  onClick={quitarDesdeFormulario}
                >
                  Quitar
                </button>
              )}
              <button
                type="button"
                className="compra-form-commit"
                onClick={commitFormulario}
              >
                {isEditing ? "Guardar cambios" : "Agregar a la lista"}
              </button>
            </div>
          </section>
        )}

        <section className="compra-lineas" aria-label="Líneas de compra">
          <h2>Líneas ({lineas.length})</h2>
          {lineas.length === 0 && (
            <p className="compra-empty">
              Completa el formulario de un producto y agrégalo a la lista.
            </p>
          )}
          <ul>
            {lineas.map((l) => {
              const sigla = l.unidad_sigla;
              const peso = esPesoSolido(sigla);
              const qty = parseNum(l.cantidad);
              const active = editingKey === l.key;
              const u = unitCost(l);
              const tot = lineTotal(l);
              return (
                <li
                  key={l.key}
                  className={`compra-linea-row${active ? " is-active" : ""}`}
                >
                  <div className="compra-linea-main">
                    <strong>{l.nombre}</strong>
                    <span>
                      {peso && qty > 0
                        ? `${formatPeso(qty, sigla)} · `
                        : `${qty.toLocaleString("es-CL")} ${sigla} · `}
                      u. {formatClp(u)} · total {formatClp(tot)}
                    </span>
                  </div>
                  <div className="compra-linea-actions">
                    <button
                      type="button"
                      className="compra-edit-btn"
                      aria-label={`Editar ${l.nombre}`}
                      onClick={() => loadLineaEnFormulario(l)}
                    >
                      <PencilIcon />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="compra-meta">
          <label>
            Fecha de la compra
            <input
              type="date"
              value={fechaCompra}
              onChange={(e) => setFechaCompra(e.target.value)}
            />
            <span className="compra-field-hint">
              Opcional. Si lo dejas vacío, se usa hoy.
            </span>
          </label>
          <label>
            Nota / proveedor
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej. Líder, mayorista…"
              maxLength={255}
            />
          </label>
          <label>
            Costo operación (flete, etc.)
            <input
              type="number"
              min={0}
              step={1}
              value={costoOp}
              onChange={(e) => setCostoOp(e.target.value)}
            />
            <span className="compra-field-hint">
              Se suma a la inversión y se prorratea al costo unitario real de
              cada producto en el stock.
            </span>
          </label>
        </section>

        <div className="compra-summary">
          <div>
            <span>Subtotal productos</span>
            <strong>{formatClp(subtotalLineas)}</strong>
          </div>
          <div>
            <span>Costo operación</span>
            <strong>{formatClp(op > 0 ? op : 0)}</strong>
          </div>
          <div>
            <span>Inversión total</span>
            <strong>{formatClp(totalInversion)}</strong>
          </div>
        </div>

        {canWrite && (
          <button
            type="button"
            className="compra-confirm"
            disabled={saving || lineas.length === 0}
            onClick={() => void handleConfirmar()}
          >
            {saving ? "Guardando…" : "Confirmar compra e inversión"}
          </button>
        )}

        <section className="compra-historial">
          <h2>Compras recientes</h2>
          <ul>
            {comprasRecientes.map((c) => {
              const open = expandedCompraId === c.id;
              const detalle = detalleCache[c.id];
              const loading = loadingDetalleId === c.id;
              const subtotalItems =
                detalle?.items.reduce((s, it) => s + it.monto_linea, 0) ?? 0;
              return (
                <li
                  key={c.id}
                  className={`compra-hist-item${open ? " is-open" : ""}`}
                >
                  <button
                    type="button"
                    className="compra-hist-toggle"
                    aria-expanded={open}
                    onClick={() => void toggleCompraDetalle(c.id)}
                  >
                    <div>
                      <strong>
                        #{c.numero ?? c.id} · {c.fecha}
                      </strong>
                      <span>
                        {c.num_items} ítem{c.num_items === 1 ? "" : "s"}
                        {c.nota ? ` · ${c.nota}` : ""}
                      </span>
                    </div>
                    <div className="compra-hist-right">
                      <em>{formatClp(c.monto_total)}</em>
                      <span className="compra-hist-chevron" aria-hidden="true">
                        {open ? "▾" : "▸"}
                      </span>
                    </div>
                  </button>

                  {open && (
                    <div className="compra-hist-detail">
                      {loading && (
                        <p className="compra-empty">Cargando detalle…</p>
                      )}
                      {!loading && detalleError && expandedCompraId === c.id && (
                        <p className="compra-error" role="alert">
                          {detalleError}
                        </p>
                      )}
                      {!loading && detalle && (
                        <>
                          <ul className="compra-hist-items">
                            {detalle.items.map((it) => {
                              const qty = Number(it.cantidad);
                              return (
                                <li key={it.id}>
                                  <div>
                                    <strong>{it.producto_nombre}</strong>
                                    <span>
                                      {qty.toLocaleString("es-CL")} · u.{" "}
                                      {formatClp(it.precio_costo_neto)}
                                      {it.fecha_caducidad
                                        ? ` · cad. ${it.fecha_caducidad}`
                                        : ""}
                                    </span>
                                  </div>
                                  <em>{formatClp(it.monto_linea)}</em>
                                </li>
                              );
                            })}
                          </ul>
                          <div className="compra-hist-totals">
                            <div>
                              <span>Subtotal productos</span>
                              <strong>{formatClp(subtotalItems)}</strong>
                            </div>
                            <div>
                              <span>Costo operación</span>
                              <strong>
                                {formatClp(detalle.costo_operacion_total)}
                              </strong>
                            </div>
                            <div>
                              <span>Inversión total</span>
                              <strong>{formatClp(detalle.monto_total)}</strong>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {comprasRecientes.length === 0 && (
              <li className="compra-empty">Sin compras registradas.</li>
            )}
          </ul>
        </section>
      </main>

      {crearOpen && (
        <div
          className="compra-modal-backdrop"
          role="presentation"
          onClick={() => !savingProducto && setCrearOpen(false)}
        >
          <form
            className="compra-modal"
            onSubmit={(e) => void handleCrearProducto(e)}
            onClick={(e) => e.stopPropagation()}
            aria-labelledby="compra-crear-title"
          >
            <h2 id="compra-crear-title">Nuevo producto</h2>
            <p className="compra-modal-lead">
              Se creará en el catálogo y se cargará en el formulario de compra.
            </p>
            <div className="compra-modal-form">
              <label>
                Nombre
                <input
                  value={crearNombre}
                  onChange={(e) => setCrearNombre(e.target.value)}
                  required
                  minLength={1}
                  autoFocus
                />
              </label>
              <label>
                Código de barras
                <input
                  value={crearCodigo}
                  onChange={(e) => setCrearCodigo(e.target.value)}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Precio venta (CLP)
                <input
                  type="number"
                  min={0}
                  value={crearPrecio}
                  onChange={(e) => setCrearPrecio(e.target.value)}
                  required
                />
              </label>
              <label>
                Unidad
                <select
                  value={crearUnidadId}
                  onChange={(e) => setCrearUnidadId(Number(e.target.value))}
                  required
                >
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre} ({u.sigla})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Categoría
                <select
                  value={crearCategoriaId}
                  onChange={(e) =>
                    setCrearCategoriaId(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
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
              <label className="compra-check">
                <input
                  type="checkbox"
                  checked={crearCaduca}
                  onChange={(e) => setCrearCaduca(e.target.checked)}
                />
                Controla caducidad
              </label>
            </div>
            <div className="compra-modal-actions">
              <button
                type="button"
                className="compra-modal-cancel"
                onClick={() => setCrearOpen(false)}
                disabled={savingProducto}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="compra-modal-done"
                disabled={savingProducto}
              >
                {savingProducto ? "Creando…" : "Crear y cargar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
