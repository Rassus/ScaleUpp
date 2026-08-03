import { formatClp } from "../money";
import "./TicketModal.css";

export type TicketVenta = {
  id: number;
  numero?: number;
  total_venta: number;
  total_neto?: number;
  total_iva?: number;
  monto_recargo?: number;
  porcentaje_recargo?: number | string;
  monto_descuento_promo?: number;
  metodo_pago: string;
  fecha_hora: string;
  items?: Array<{
    id: number;
    producto_nombre: string;
    cantidad: string | number;
    precio_unitario?: number;
    subtotal: number;
  }>;
};

type TicketModalProps = {
  venta: TicketVenta;
  negocioNombre: string | null;
  vendedorNombre?: string | null;
  onClose: () => void;
  onPrint?: () => void;
};

export default function TicketModal({
  venta,
  negocioNombre,
  vendedorNombre,
  onClose,
  onPrint,
}: TicketModalProps) {
  const montoRecargo = Math.round(Number(venta.monto_recargo) || 0);
  const pctRecargo = Number(venta.porcentaje_recargo) || 0;
  const montoDescuentoPromo = Math.round(Number(venta.monto_descuento_promo) || 0);
  const subtotalProductos = Math.max(0, venta.total_venta - montoRecargo);

  function handlePrint() {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  }

  return (
    <div className="ticket-backdrop" role="presentation">
      <div
        className="ticket-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-title"
      >
        <div className="ticket-sheet" id="ticket-print-area">
          <header className="ticket-head">
            <strong id="ticket-title">{negocioNombre ?? "ScaleUpp"}</strong>
            <span>Comprobante de venta #{venta.numero ?? venta.id}</span>
            <span>
              {new Date(venta.fecha_hora).toLocaleString("es-CL", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            {vendedorNombre && <span>Vendedor: {vendedorNombre}</span>}
          </header>

          <ul className="ticket-items">
            {(venta.items ?? []).map((it) => (
              <li key={it.id}>
                <div>
                  <strong>{it.producto_nombre}</strong>
                  <span>
                    {Number(it.cantidad).toLocaleString("es-CL")} ×{" "}
                    {formatClp(it.precio_unitario ?? 0)}
                  </span>
                </div>
                <span>{formatClp(it.subtotal)}</span>
              </li>
            ))}
            {montoRecargo > 0 && (
              <li className="ticket-recargo">
                <div>
                  <strong>Recargo fiado ({pctRecargo}%)</strong>
                  <span>Cargo aparte · no incluido en productos</span>
                </div>
                <span>{formatClp(montoRecargo)}</span>
              </li>
            )}
            {montoDescuentoPromo > 0 && (
              <li className="ticket-promo">
                <div>
                  <strong>Programa de promociones</strong>
                  <span>Descuento aplicado en productos</span>
                </div>
                <span>−{formatClp(montoDescuentoPromo)}</span>
              </li>
            )}
            {(venta.items ?? []).length === 0 && montoRecargo <= 0 && (
              <li className="ticket-empty">Sin detalle de ítems</li>
            )}
          </ul>

          <dl className="ticket-totals">
            {montoRecargo > 0 && (
              <div>
                <dt>Subtotal productos</dt>
                <dd>{formatClp(subtotalProductos)}</dd>
              </div>
            )}
            {montoDescuentoPromo > 0 && (
              <div className="ticket-ahorro">
                <dt>Total ahorrado</dt>
                <dd>{formatClp(montoDescuentoPromo)}</dd>
              </div>
            )}
            {venta.total_neto != null && (
              <>
                <div>
                  <dt>Neto</dt>
                  <dd>{formatClp(venta.total_neto)}</dd>
                </div>
                <div>
                  <dt>IVA</dt>
                  <dd>{formatClp(venta.total_iva ?? 0)}</dd>
                </div>
              </>
            )}
            <div className="ticket-total-row">
              <dt>Total</dt>
              <dd>{formatClp(venta.total_venta)}</dd>
            </div>
            <div>
              <dt>Pago</dt>
              <dd>{venta.metodo_pago}</dd>
            </div>
          </dl>

          <p className="ticket-thanks">¡Gracias por su compra!</p>
        </div>

        <div className="ticket-actions">
          <button type="button" className="ticket-btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="ticket-btn-primary" onClick={handlePrint}>
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
