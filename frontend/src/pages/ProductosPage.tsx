import { FormEvent, useCallback, useMemo, useRef, useState } from "react";
import BarcodeScanner from "../components/BarcodeScanner";
import DashTopbar from "../components/DashTopbar";
import ProductTags, {
  buildProductTags,
  type ProductTagKind,
} from "../components/ProductTags";
import { useHardwareBack } from "../hooks/useHardwareBack";
import { formatClpLabel as formatClp, formatClp as formatMoney } from "../money";
import { esUnidadCaja } from "../peso";
import "./DashboardPage.css";
import "./ProductosPage.css";

export type MaestroProducto = {
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

export type MaestroUnidad = { id: number; nombre: string; sigla: string };
export type MaestroCategoria = { id: number; nombre: string };

export type MaestroAlertaStock = {
  producto_id?: number;
  nombre: string;
  stock_actual: string | number;
};

export type MaestroAlertaVencer = {
  producto_id?: number;
  nombre: string;
  cantidad_actual: string | number;
  dias_restantes: number;
};

export type ProductoFormValues = {
  nombre: string;
  codigo_barras: string;
  precio_venta: string;
  unidad_medida_id: number | "";
  categoria_id: number | "";
  controla_caducidad: boolean;
  tipo: "SIMPLE" | "KIT";
  imagen_data: string | null;
  /** Solo si unidad = Caja (CJ): producto SIMPLE que compone la caja. */
  producto_base_id: number | "";
  /** Unidades del producto base por cada caja. */
  cantidad_base: string;
};

type ProductosPageProps = {
  productos: MaestroProducto[];
  stockByProducto: Record<number, number>;
  bajoStockByProducto?: Record<number, boolean>;
  unidades: MaestroUnidad[];
  categorias: MaestroCategoria[];
  alertasStock: MaestroAlertaStock[];
  alertasVencer: MaestroAlertaVencer[];
  canWrite: boolean;
  error: string | null;
  saving: boolean;
  onOpenMenu: () => void;
  onOpenDetalle?: (productoId: number) => void;
  onCreate: (values: ProductoFormValues) => Promise<{ id: number } | void> | { id: number } | void;
  onUpdate: (id: number, values: ProductoFormValues) => Promise<void> | void;
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

const IMG_LEGACY_KEY = "scaleupp_product_images";

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : null;
      if (!raw) {
        reject(new Error("Imagen inválida"));
        return;
      }
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
          resolve(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

const TAG_FILTERS: { kind: ProductTagKind; className: string }[] = [
  { kind: "Combo", className: "is-combo" },
  { kind: "Sin stock", className: "is-sin-stock" },
  { kind: "Bajo stock", className: "is-bajo-stock" },
  { kind: "Por caducar", className: "is-por-caducar" },
  { kind: "Caducado", className: "is-caducado" },
];

function emptyForm(unidadId: number | "" = ""): ProductoFormValues {
  return {
    nombre: "",
    codigo_barras: "",
    precio_venta: "1000",
    unidad_medida_id: unidadId,
    categoria_id: "",
    controla_caducidad: false,
    tipo: "SIMPLE",
    imagen_data: null,
    producto_base_id: "",
    cantidad_base: "12",
  };
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export default function ProductosPage({
  productos,
  stockByProducto,
  bajoStockByProducto = {},
  unidades,
  categorias,
  alertasStock,
  alertasVencer,
  canWrite,
  error,
  saving,
  onOpenMenu,
  onOpenDetalle,
  onCreate,
  onUpdate,
  historialPrecios = [],
  loadingHistorialPrecios = false,
}: ProductosPageProps) {
  const [q, setQ] = useState("");
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [filtroTags, setFiltroTags] = useState<ProductTagKind[]>([]);
  const [filtroCategorias, setFiltroCategorias] = useState<number[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductoFormValues>(() =>
    emptyForm(unidades[0]?.id ?? ""),
  );
  const [searchCam, setSearchCam] = useState(false);
  const [formCam, setFormCam] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useHardwareBack(
    useCallback(() => {
      if (formCam) {
        setFormCam(false);
        return true;
      }
      if (formOpen) {
        setFormOpen(false);
        setEditingId(null);
        return true;
      }
      if (searchCam) {
        setSearchCam(false);
        return true;
      }
      if (filtrosOpen) {
        setFiltrosOpen(false);
        return true;
      }
      return false;
    }, [formCam, formOpen, searchCam, filtrosOpen]),
  );

  // Migrar una vez imágenes viejas de localStorage → se muestran hasta guardar en API
  const legacyImages = useMemo(() => {
    try {
      const raw = localStorage.getItem(IMG_LEGACY_KEY);
      if (!raw) return {} as Record<string, string>;
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  }, []);

  const { caducidadByProducto, caducidadByNombre } = useMemo(() => {
    const byId: Record<number, number> = {};
    const byName: Record<string, number> = {};
    for (const a of alertasVencer) {
      const dias = Number(a.dias_restantes);
      if (!Number.isFinite(dias)) continue;
      if (a.producto_id != null) {
        const prev = byId[a.producto_id];
        if (prev == null || dias < prev) byId[a.producto_id] = dias;
      }
      const key = a.nombre.trim().toLowerCase();
      if (key) {
        const prev = byName[key];
        if (prev == null || dias < prev) byName[key] = dias;
      }
    }
    return { caducidadByProducto: byId, caducidadByNombre: byName };
  }, [alertasVencer]);

  const filtrosActivos = filtroTags.length + filtroCategorias.length;

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return productos.filter((p) => {
      if (term) {
        const matchTerm =
          p.nombre.toLowerCase().includes(term) ||
          (p.codigo_barras ?? "").toLowerCase().includes(term);
        if (!matchTerm) return false;
      }
      if (
        filtroCategorias.length > 0 &&
        (p.categoria_id == null || !filtroCategorias.includes(p.categoria_id))
      ) {
        return false;
      }
      if (filtroTags.length > 0) {
        const stock = stockByProducto[p.id];
        const diasCad =
          caducidadByProducto[p.id] ??
          caducidadByNombre[p.nombre.trim().toLowerCase()];
        const tags = buildProductTags({
          tipo: p.tipo,
          stock,
          alertaBajoStock: !!bajoStockByProducto[p.id],
          diasCaducidad: diasCad,
        });
        if (!filtroTags.some((t) => tags.includes(t))) return false;
      }
      return true;
    });
  }, [
    productos,
    q,
    filtroCategorias,
    filtroTags,
    stockByProducto,
    bajoStockByProducto,
    caducidadByProducto,
    caducidadByNombre,
  ]);

  function productImage(p: MaestroProducto): string | null {
    return p.imagen_base64 ?? legacyImages[String(p.id)] ?? null;
  }

  function toggleTag(tag: ProductTagKind) {
    setFiltroTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function toggleCategoria(id: number) {
    setFiltroCategorias((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function limpiarFiltros() {
    setFiltroTags([]);
    setFiltroCategorias([]);
  }

  function openNuevo() {
    setEditingId(null);
    setForm(emptyForm(unidades[0]?.id ?? ""));
    setFormCam(false);
    setFormOpen(true);
  }

  function openEditar(p: MaestroProducto) {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre,
      codigo_barras: p.codigo_barras ?? "",
      precio_venta: String(p.precio_venta),
      unidad_medida_id: p.unidad_medida_id,
      categoria_id: p.categoria_id ?? "",
      controla_caducidad: p.controla_caducidad,
      tipo: p.tipo === "KIT" ? "KIT" : "SIMPLE",
      imagen_data: productImage(p),
      producto_base_id: "",
      cantidad_base: "12",
    });
    setFormCam(false);
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const unidad = unidades.find((u) => u.id === form.unidad_medida_id);
    const esCaja = !!(unidad && esUnidadCaja(unidad.sigla));
    if (esCaja) {
      const creando = editingId == null;
      if (creando || form.producto_base_id !== "") {
        if (form.producto_base_id === "") {
          setScanError("Elige el producto base de la caja.");
          return;
        }
        const qty = Number(String(form.cantidad_base).replace(",", "."));
        if (!Number.isFinite(qty) || qty <= 0) {
          setScanError("Indica cuántas unidades van en cada caja.");
          return;
        }
      }
    }
    try {
      if (editingId != null) {
        await onUpdate(editingId, form);
      } else {
        await onCreate(form);
      }
      setFormOpen(false);
      setEditingId(null);
      setScanError(null);
    } catch {
      // Mantener el formulario abierto si falló el guardado
    }
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScanError("Selecciona un archivo de imagen.");
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setForm((prev) => ({ ...prev, imagen_data: dataUrl }));
      setScanError(null);
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : "No se pudo cargar la imagen",
      );
    }
  }

  const hasAlertas = alertasStock.length > 0 || alertasVencer.length > 0;

  return (
    <div className="prod-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="prod-mark" />

      <main className="prod-main">
        <h1 className="prod-title">Maestra de productos</h1>

        <div className="prod-search-row">
          <label className="prod-search">
            <span className="prod-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path
                  d="M4 7V5a1 1 0 0 1 1-1h2M18 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M6 20H5a1 1 0 0 1-1-1v-2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <path d="M7 9h10v6H7z" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto o código"
              aria-label="Buscar producto o código"
            />
            <span className="prod-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M16 16l4 4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </label>
          <button
            type="button"
            className={`prod-cam-btn${searchCam ? " is-active" : ""}`}
            aria-label="Buscar por cámara"
            aria-pressed={searchCam}
            onClick={() => {
              setSearchCam((v) => !v);
              setScanError(null);
            }}
          >
            <CameraIcon />
          </button>
        </div>

        {searchCam && (
          <div className="prod-scanner">
            <BarcodeScanner
              hideLaunchButton
              active={searchCam}
              onActiveChange={setSearchCam}
              onDetected={(code) => {
                setQ(code);
                setSearchCam(false);
              }}
              onError={(msg) => {
                if (msg) setScanError(msg);
              }}
            />
          </div>
        )}

        <section className="prod-filtros" aria-label="Filtros">
          <button
            type="button"
            className="prod-filtros-toggle"
            aria-expanded={filtrosOpen}
            onClick={() => setFiltrosOpen((v) => !v)}
          >
            <span>
              Filtros
              {filtrosActivos > 0 ? ` (${filtrosActivos})` : ""}
            </span>
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              className={filtrosOpen ? "is-open" : undefined}
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

          {filtrosOpen && (
            <div className="prod-filtros-body">
              <div className="prod-filtros-group">
                <p className="prod-filtros-label">Etiquetas</p>
                <div className="prod-filtros-chips" role="group" aria-label="Etiquetas">
                  {TAG_FILTERS.map(({ kind, className }) => {
                    const active = filtroTags.includes(kind);
                    return (
                      <button
                        key={kind}
                        type="button"
                        className={`prod-filtro-chip ${className}${active ? " is-active" : ""}`}
                        aria-pressed={active}
                        onClick={() => toggleTag(kind)}
                      >
                        {kind}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="prod-filtros-group">
                <p className="prod-filtros-label">Categoría</p>
                <div className="prod-filtros-chips" role="group" aria-label="Categorías">
                  {categorias.map((c) => {
                    const active = filtroCategorias.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`prod-filtro-chip${active ? " is-active" : ""}`}
                        aria-pressed={active}
                        onClick={() => toggleCategoria(c.id)}
                      >
                        {c.nombre}
                      </button>
                    );
                  })}
                  {categorias.length === 0 && (
                    <span className="prod-filtros-empty">Sin categorías</span>
                  )}
                </div>
              </div>

              {filtrosActivos > 0 && (
                <button
                  type="button"
                  className="prod-filtros-clear"
                  onClick={limpiarFiltros}
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </section>

        {(error || scanError) && (
          <p className="prod-error" role="alert">
            {error || scanError}
          </p>
        )}

        <section className="prod-historial-precios" aria-label="Cambios de precio">
          <h2>Cambios de precio</h2>
          <p className="prod-historial-lead">
            Cada ajuste de precio de venta queda registrado aquí.
          </p>
          {loadingHistorialPrecios ? (
            <p className="prod-historial-empty">Cargando historial…</p>
          ) : (
            <ul className="prod-historial-list">
              {historialPrecios.slice(0, 30).map((h) => {
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
                  <li key={h.id}>
                    <button
                      type="button"
                      className="prod-historial-item"
                      onClick={() => onOpenDetalle?.(h.producto_id)}
                    >
                      <div>
                        <strong>{h.producto_nombre}</strong>
                        <span>
                          {fecha}
                          {h.usuario_nombre ? ` · ${h.usuario_nombre}` : ""}
                        </span>
                      </div>
                      <em>
                        {formatMoney(h.precio_anterior)} →{" "}
                        {formatMoney(h.precio_nuevo)}
                        <small
                          className={
                            delta > 0
                              ? "is-up"
                              : delta < 0
                                ? "is-down"
                                : undefined
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {formatMoney(delta)}
                        </small>
                      </em>
                    </button>
                  </li>
                );
              })}
              {historialPrecios.length === 0 && (
                <li className="prod-historial-empty">
                  Aún no hay cambios de precio registrados.
                </li>
              )}
            </ul>
          )}
        </section>

        <ul className="prod-list">
          {filtrados.map((p) => {
            const stock = stockByProducto[p.id];
            const sku = p.codigo_barras || `ID${p.id}`;
            const img = productImage(p);
            const diasCad =
              caducidadByProducto[p.id] ??
              caducidadByNombre[p.nombre.trim().toLowerCase()];
            return (
              <li key={p.id} className="prod-item">
                <button
                  type="button"
                  className="prod-item-main"
                  onClick={() => onOpenDetalle?.(p.id)}
                >
                  {img ? (
                    <img className="prod-thumb-img" src={img} alt="" />
                  ) : (
                    <span className="prod-thumb" aria-hidden="true">
                      {(p.nombre.trim()[0] ?? "?").toUpperCase()}
                    </span>
                  )}
                  <div className="prod-info">
                    <strong className="prod-tags-row">
                      <span>{p.nombre}</span>
                      <ProductTags
                        tipo={p.tipo}
                        stock={stock}
                        alertaBajoStock={!!bajoStockByProducto[p.id]}
                        diasCaducidad={diasCad}
                      />
                    </strong>
                    <span>
                      #{sku}
                      {stock != null
                        ? ` | ${Number(stock).toLocaleString("es-CL")} unids.`
                        : ""}
                    </span>
                    <span className="prod-price">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                        <path
                          d="M8 12.5l2.5 2.5L16 9.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {formatClp(p.precio_venta)}
                    </span>
                  </div>
                </button>
                {canWrite && (
                  <button
                    type="button"
                    className="prod-edit"
                    onClick={() => openEditar(p)}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                      <path
                        d="M4 20h4l10-10-4-4L4 16v4z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M13 7l4 4"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    Edit
                  </button>
                )}
              </li>
            );
          })}
          {filtrados.length === 0 && (
            <li className="prod-empty">No hay productos que coincidan.</li>
          )}
        </ul>

        {hasAlertas && (
          <section className="prod-alertas" aria-label="Alertas">
            <h2>Alertas de stock / vencimiento</h2>
            <div className="prod-alertas-grid">
              {alertasStock.slice(0, 4).map((a) => (
                <div key={`s-${a.nombre}`} className="prod-alerta">
                  <span className="prod-alerta-badge" aria-hidden="true">
                    !
                  </span>
                  <p>
                    {a.nombre} — Bajo stock:{" "}
                    <strong>
                      {Number(a.stock_actual).toLocaleString("es-CL")} unids.
                    </strong>
                  </p>
                </div>
              ))}
              {alertasVencer.slice(0, 4).map((a) => (
                <div
                  key={`v-${a.producto_id ?? a.nombre}-${a.dias_restantes}`}
                  className="prod-alerta"
                >
                  <span className="prod-alerta-badge" aria-hidden="true">
                    !
                  </span>
                  <p>
                    {a.nombre} —{" "}
                    {a.dias_restantes < 0 ? (
                      <>
                        Caducado hace{" "}
                        <strong>
                          {Math.abs(a.dias_restantes)}{" "}
                          {Math.abs(a.dias_restantes) === 1 ? "día" : "días"}
                        </strong>
                      </>
                    ) : (
                      <>
                        Vence en{" "}
                        <strong>
                          {a.dias_restantes}{" "}
                          {a.dias_restantes === 1 ? "día" : "días"}
                        </strong>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {canWrite && (
        <footer className="prod-footer">
          <button type="button" className="prod-nuevo" onClick={openNuevo}>
            + Nuevo Producto
          </button>
        </footer>
      )}

      {formOpen && (
        <div className="prod-modal-backdrop" role="presentation">
          <form
            className="prod-modal"
            onSubmit={(e) => void handleSubmit(e)}
            aria-labelledby="prod-form-title"
          >
            <h2 id="prod-form-title">
              {editingId != null ? "Editar producto" : "Nuevo producto"}
            </h2>

            <div className="prod-image-block">
              {form.imagen_data ? (
                <img src={form.imagen_data} alt="Vista previa" className="prod-image-preview" />
              ) : (
                <div className="prod-image-placeholder">Sin imagen</div>
              )}
              <div className="prod-image-actions">
                <button
                  type="button"
                  className="prod-image-btn"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  Galería
                </button>
                <button
                  type="button"
                  className="prod-image-btn"
                  onClick={() => imageInputRef.current?.click()}
                >
                  Cámara
                </button>
                {form.imagen_data && (
                  <button
                    type="button"
                    className="prod-image-btn is-muted"
                    onClick={() => setForm({ ...form, imagen_data: null })}
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
                  onPickImage(e.target.files?.[0] ?? null);
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
                  onPickImage(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>

            <label>
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </label>

            <div className="prod-barcode-field">
              <span className="prod-barcode-label">Código de barras</span>
              <div className="prod-barcode-row">
                <input
                  value={form.codigo_barras}
                  onChange={(e) =>
                    setForm({ ...form, codigo_barras: e.target.value })
                  }
                  placeholder="Escanear o escribir"
                />
                <button
                  type="button"
                  className="prod-sku-btn"
                  disabled={!form.codigo_barras.trim()}
                  title="Anteponer SKU al texto del campo"
                  onClick={() => {
                    const raw = form.codigo_barras.trim();
                    if (!raw) return;
                    const body = raw.replace(/^SKU/i, "");
                    setForm({ ...form, codigo_barras: `SKU${body}` });
                  }}
                >
                  SKU+
                </button>
                <button
                  type="button"
                  className={`prod-cam-btn${formCam ? " is-active" : ""}`}
                  aria-label="Escanear código de barras"
                  onClick={() => {
                    setFormCam((v) => !v);
                    setScanError(null);
                  }}
                >
                  <CameraIcon />
                </button>
              </div>
              {formCam && (
                <div className="prod-scanner">
                  <BarcodeScanner
                    hideLaunchButton
                    active={formCam}
                    onActiveChange={setFormCam}
                    onDetected={(code) => {
                      setForm((prev) => ({ ...prev, codigo_barras: code }));
                      setFormCam(false);
                    }}
                    onError={(msg) => {
                      if (msg) setScanError(msg);
                    }}
                  />
                </div>
              )}
            </div>

            <label>
              Precio venta (CLP)
              <input
                type="number"
                min={0}
                value={form.precio_venta}
                onChange={(e) =>
                  setForm({ ...form, precio_venta: e.target.value })
                }
                required
              />
            </label>
            <label>
              Unidad
              <select
                value={form.unidad_medida_id}
                onChange={(e) => {
                  const unidadId = Number(e.target.value);
                  const sigla =
                    unidades.find((u) => u.id === unidadId)?.sigla ?? "";
                  setForm({
                    ...form,
                    unidad_medida_id: unidadId,
                    tipo: esUnidadCaja(sigla) ? "KIT" : form.tipo === "KIT" ? "KIT" : "SIMPLE",
                    controla_caducidad: esUnidadCaja(sigla)
                      ? false
                      : form.controla_caducidad,
                    producto_base_id: esUnidadCaja(sigla)
                      ? form.producto_base_id
                      : "",
                  });
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
            {(() => {
              const sigla =
                unidades.find((u) => u.id === form.unidad_medida_id)?.sigla ??
                "";
              if (!esUnidadCaja(sigla)) return null;
              const bases = productos.filter(
                (p) =>
                  p.tipo !== "KIT" &&
                  p.id !== editingId &&
                  !esUnidadCaja(
                    unidades.find((u) => u.id === p.unidad_medida_id)?.sigla ??
                      "",
                  ),
              );
              return (
                <>
                <p className="prod-hint">
                  La caja se crea como combo (BOM): al venderla descuenta
                  unidades del producto base.
                  {editingId != null
                    ? " Si dejas el base vacío, no se cambia la receta."
                    : ""}
                </p>
                  <label>
                    Producto base
                    <select
                      value={form.producto_base_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          producto_base_id:
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value),
                        })
                      }
                      required={editingId == null}
                    >
                      <option value="">Selecciona producto…</option>
                      {bases.map((p) => (
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
                      value={form.cantidad_base}
                      onChange={(e) =>
                        setForm({ ...form, cantidad_base: e.target.value })
                      }
                      required
                    />
                  </label>
                </>
              );
            })()}
            <label>
              Categoría
              <select
                value={form.categoria_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    categoria_id:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
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
            {!(
              form.unidad_medida_id !== "" &&
              esUnidadCaja(
                unidades.find((u) => u.id === form.unidad_medida_id)?.sigla ??
                  "",
              )
            ) && (
              <label className="prod-check">
                <input
                  type="checkbox"
                  checked={form.controla_caducidad}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      controla_caducidad: e.target.checked,
                    })
                  }
                />
                Controla caducidad
              </label>
            )}

            <div className="prod-modal-actions">
              <button
                type="button"
                className="prod-modal-cancel"
                onClick={() => {
                  setFormOpen(false);
                  setFormCam(false);
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="prod-modal-save" disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
