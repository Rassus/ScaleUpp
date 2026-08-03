import { useMemo, useState } from "react";
import DashTopbar from "../components/DashTopbar";
import ProductTags from "../components/ProductTags";
import "./DashboardPage.css";
import "./StockPage.css";

export type StockListItem = {
  producto_id: number;
  producto_nombre: string;
  codigo_barras?: string | null;
  stock_actual: string | number;
  alerta_bajo_stock?: boolean;
  tipo?: string | null;
  dias_caducidad?: number | null;
};

type StockPageProps = {
  items: StockListItem[];
  images: Record<string, string>;
  onOpenMenu: () => void;
  onOpenProducto: (productoId: number) => void;
};

export default function StockPage({
  items,
  images,
  onOpenMenu,
  onOpenProducto,
}: StockPageProps) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        i.producto_nombre.toLowerCase().includes(term) ||
        (i.codigo_barras ?? "").toLowerCase().includes(term),
    );
  }, [items, q]);

  return (
    <div className="stock-screen dash-screen">
      <DashTopbar onOpenMenu={onOpenMenu} gradientId="stock-mark" />

      <main className="stock-main">
        <h1 className="stock-title">Stock</h1>
        <p className="stock-lead">Elige un producto para ver lotes FIFO.</p>

        <label className="stock-search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
          />
        </label>

        <ul className="stock-list">
          {filtrados.map((item) => {
            const img = images[String(item.producto_id)];
            const stock = Number(item.stock_actual);
            return (
              <li key={item.producto_id}>
                <button
                  type="button"
                  className="stock-item"
                  onClick={() => onOpenProducto(item.producto_id)}
                >
                  {img ? (
                    <img src={img} alt="" className="stock-thumb-img" />
                  ) : (
                    <span className="stock-thumb">
                      {(item.producto_nombre.trim()[0] ?? "?").toUpperCase()}
                    </span>
                  )}
                  <span className="stock-info">
                    <strong className="prod-tags-row">
                      <span>{item.producto_nombre}</span>
                      <ProductTags
                        tipo={item.tipo}
                        stock={stock}
                        alertaBajoStock={!!item.alerta_bajo_stock}
                        diasCaducidad={item.dias_caducidad}
                      />
                    </strong>
                    <em>{stock.toLocaleString("es-CL")} unids.</em>
                  </span>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                    <path
                      d="M9 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
          {filtrados.length === 0 && (
            <li className="stock-empty">Sin productos en stock.</li>
          )}
        </ul>
      </main>
    </div>
  );
}
