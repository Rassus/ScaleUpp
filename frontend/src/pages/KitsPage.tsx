import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Code39Barcode from "../components/Code39Barcode";
import DashTopbar from "../components/DashTopbar";
import { formatClpLabel as formatClp } from "../money";
import "./DashboardPage.css";
import "./KitsPage.css";

export type KitProducto = {
  id: number;
  nombre: string;
  codigo_barras: string | null;
  precio_venta: number;
  tipo: string;
  unidad_medida_id: number;
  categoria_id: number | null;
  imagen_base64?: string | null;
};

export type KitComponente = {
  producto_componente_id: number;
  cantidad: number;
  nombre: string;
};

export type KitUnidad = { id: number; nombre: string; sigla: string };
export type KitCategoria = { id: number; nombre: string };

type KitsPageProps = {
  kits: KitProducto[];
  simples: KitProducto[];
  unidades: KitUnidad[];
  categorias: KitCategoria[];
  selectedKitId: number | null;
  componentes: KitComponente[];
  canWrite: boolean;
  saving: boolean;
  error: string | null;
  onOpenMenu: () => void;
  onSelectKit: (id: number) => void;
  onCreateKit: (data: {
    nombre: string;
    precio_venta: string;
    unidad_medida_id: number;
    categoria_id: number | "";
    imagen_base64?: string | null;
  }) => Promise<void> | void;
  onAddComponente: (productoId: number, cantidad: number) => void;
  onRemoveComponente: (productoId: number) => void;
  onSaveReceta: () => Promise<void> | void;
};

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

export default function KitsPage({
  kits,
  simples,
  unidades,
  categorias,
  selectedKitId,
  componentes,
  canWrite,
  saving,
  error,
  onOpenMenu,
  onSelectKit,
  onCreateKit,
  onAddComponente,
  onRemoveComponente,
  onSaveReceta,
}: KitsPageProps) {
  const [crearOpen, setCrearOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("2990");
  const [unidadId, setUnidadId] = useState<number | "">(unidades[0]?.id ?? "");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [imagenData, setImagenData] = useState<string | null>(null);
  const [compId, setCompId] = useState<number | "">("");
  const [compCantidad, setCompCantidad] = useState("1");
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (unidadId === "" && unidades[0]) setUnidadId(unidades[0].id);
  }, [unidades, unidadId]);

  const selected = useMemo(
    () => kits.find((k) => k.id === selectedKitId) ?? null,
    [kits, selectedKitId],
  );

  async function onPickImage(file: File | null) {
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setImagenData(dataUrl);
    } catch {
      /* ignore */
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (unidadId === "") return;
    await onCreateKit({
      nombre,
      precio_venta: precio,
      unidad_medida_id: unidadId,
      categoria_id: categoriaId,
      imagen_base64: imagenData,
    });
    setNombre("");
    setPrecio("2990");
    setCategoriaId("");
    setImagenData(null);
    setCrearOpen(false);
  }

  return (
    <div className="kits-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="kits-mark" />

      <main className="kits-main">
        <div className="kits-head">
          <h1 className="kits-title">Kits / packs</h1>
          {canWrite && (
            <button
              type="button"
              className="kits-new-btn"
              onClick={() => setCrearOpen(true)}
            >
              + Nuevo kit
            </button>
          )}
        </div>
        <p className="kits-lead">
          Cada kit recibe un código de barras único al crearse. Al venderlo se
          descuenta el stock de sus componentes (FIFO).
        </p>

        {error && (
          <p className="kits-error" role="alert">
            {error}
          </p>
        )}

        <section className="kits-list-card" aria-label="Kits">
          {kits.length === 0 ? (
            <p className="kits-empty">Aún no hay kits. Crea el primero.</p>
          ) : (
            <ul className="kits-list">
              {kits.map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    className={`kits-item${selectedKitId === k.id ? " is-active" : ""}`}
                    onClick={() => onSelectKit(k.id)}
                  >
                    <span className="kits-item-thumb" aria-hidden="true">
                      {k.imagen_base64 ? (
                        <img src={k.imagen_base64} alt="" />
                      ) : (
                        <span className="kits-item-thumb-empty">Kit</span>
                      )}
                    </span>
                    <span className="kits-item-copy">
                      <strong>{k.nombre}</strong>
                      <span>
                        {formatClp(k.precio_venta)}
                        {k.codigo_barras ? ` · ${k.codigo_barras}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected && (
          <section className="kits-detail" aria-label="Detalle del kit">
            {selected.imagen_base64 && (
              <img
                src={selected.imagen_base64}
                alt={selected.nombre}
                className="kits-detail-image"
              />
            )}
            <h2>{selected.nombre}</h2>
            <p className="kits-price">{formatClp(selected.precio_venta)}</p>

            {selected.codigo_barras ? (
              <div className="kits-barcode-card">
                <p className="kits-barcode-label">Código de barras del kit</p>
                <Code39Barcode value={selected.codigo_barras} height={72} />
                <p className="kits-barcode-hint">
                  Escaneable en el POS (CODE_39 / cámara).
                </p>
              </div>
            ) : (
              <p className="kits-empty">Este kit no tiene código asignado.</p>
            )}

            <h3>Receta (componentes)</h3>
            <ul className="kits-comp-list">
              {componentes.map((c) => (
                <li key={c.producto_componente_id}>
                  <div>
                    <strong>{c.nombre}</strong>
                    <span>× {c.cantidad}</span>
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      className="kits-link"
                      onClick={() =>
                        onRemoveComponente(c.producto_componente_id)
                      }
                    >
                      Quitar
                    </button>
                  )}
                </li>
              ))}
              {componentes.length === 0 && (
                <li className="kits-empty">Sin componentes aún.</li>
              )}
            </ul>

            {canWrite && (
              <div className="kits-add-row">
                <label>
                  Producto
                  <select
                    value={compId}
                    onChange={(e) =>
                      setCompId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  >
                    <option value="">Selecciona…</option>
                    {simples.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cant.
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={compCantidad}
                    onChange={(e) => setCompCantidad(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="kits-add-btn"
                  onClick={() => {
                    if (compId === "") return;
                    onAddComponente(compId, Number(compCantidad) || 1);
                    setCompCantidad("1");
                  }}
                >
                  Agregar
                </button>
              </div>
            )}

            {canWrite && (
              <button
                type="button"
                className="kits-save"
                disabled={saving || componentes.length === 0}
                onClick={() => void onSaveReceta()}
              >
                {saving ? "Guardando…" : "Guardar receta"}
              </button>
            )}
          </section>
        )}
      </main>

      {crearOpen && (
        <div className="kits-modal-backdrop" role="presentation">
          <form
            className="kits-modal"
            onSubmit={(e) => void handleCreate(e)}
            aria-labelledby="kits-create-title"
          >
            <h2 id="kits-create-title">Nuevo kit</h2>
            <p className="kits-modal-lead">
              El código de barras se genera solo y es único en tu negocio.
            </p>

            <div className="kits-image-block">
              {imagenData ? (
                <img
                  src={imagenData}
                  alt="Vista previa"
                  className="kits-image-preview"
                />
              ) : (
                <div className="kits-image-placeholder">Sin imagen</div>
              )}
              <div className="kits-image-actions">
                <button
                  type="button"
                  className="kits-image-btn"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  Galería
                </button>
                <button
                  type="button"
                  className="kits-image-btn"
                  onClick={() => imageInputRef.current?.click()}
                >
                  Cámara
                </button>
                {imagenData && (
                  <button
                    type="button"
                    className="kits-image-btn is-muted"
                    onClick={() => setImagenData(null)}
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
              Nombre del pack
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Ej. Promo bebida + nachos"
              />
            </label>
            <label>
              Precio venta (CLP)
              <input
                type="number"
                min={0}
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
              />
            </label>
            <label>
              Unidad
              <select
                value={unidadId}
                onChange={(e) => setUnidadId(Number(e.target.value))}
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
                value={categoriaId}
                onChange={(e) =>
                  setCategoriaId(
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

            <div className="kits-modal-actions">
              <button
                type="button"
                className="kits-modal-cancel"
                onClick={() => {
                  setCrearOpen(false);
                  setImagenData(null);
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="kits-modal-save" disabled={saving}>
                {saving ? "Creando…" : "Crear kit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
