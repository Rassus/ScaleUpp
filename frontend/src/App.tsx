import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "./api/config";
import { syncAvisosPush } from "./api/notifications";
import { isWebAdminAllowed } from "./api/platform";
import BarcodeScanner from "./components/BarcodeScanner";
import TicketModal from "./components/TicketModal";
import DashboardPage from "./pages/DashboardPage";
import DiaCajaPage from "./pages/DiaCajaPage";
import EquipoPage from "./pages/EquipoPage";
import ConfigPage from "./pages/ConfigPage";
import CompraPage from "./pages/CompraPage";
import ClientesPage, {
  type ClienteDeuda,
  type ClienteFormValues,
  type ClienteItem,
} from "./pages/ClientesPage";
import {
  cantidadAGramos,
  esPesoSolido,
  esPesoVariable,
  formatPeso,
  gramosACantidad,
  minPeso,
} from "./peso";
import {
  aplicarComboEnCarrito,
  detectarCombos,
  type ComboSugerencia,
  type KitBom,
} from "./kitCombo";
import FinanzasPage from "./pages/FinanzasPage";
import LoginPage from "./pages/LoginPage";
import OrdenPage from "./pages/OrdenPage";
import ProductoDetallePage from "./pages/ProductoDetallePage";
import ProductosPage, { type ProductoFormValues } from "./pages/ProductosPage";
import KitsPage from "./pages/KitsPage";
import PromocionesPage from "./pages/PromocionesPage";
import StockPage from "./pages/StockPage";
import AdminApp from "./pages/AdminApp";
import "./index.css";
import "./pages/AdminApp.css";
import "./pages/ClientesPage.css";
import "./pages/CompraPage.css";
import "./pages/ConfigPage.css";
import "./pages/DashboardPage.css";
import "./pages/DiaCajaPage.css";
import "./pages/EquipoPage.css";
import "./pages/FinanzasPage.css";
import "./pages/KitsPage.css";
import "./pages/OrdenPage.css";
import "./pages/ProductoDetallePage.css";
import "./pages/ProductosPage.css";
import "./pages/PromocionesPage.css";
import "./pages/StockPage.css";
import "./components/TicketModal.css";

type AppScreen =
  | "home"
  | "dia-caja"
  | "finanzas"
  | "orden"
  | "productos"
  | "stock"
  | "producto-detalle"
  | "kits"
  | "promociones"
  | "compra"
  | "clientes"
  | "equipo"
  | "configuracion";

type LoteResumen = {
  id: number;
  cantidad_inicial?: string | number;
  cantidad_actual: string | number;
  cantidad_vendida?: string | number;
  cantidad_merma?: string | number;
  fecha_caducidad: string | null;
  fecha_ingreso: string;
  activo: boolean;
  precio_costo_neto?: number;
  costo_operacion_prorrateado?: number;
  costo_unitario_real?: number;
  iva_porcentaje?: number | string;
};

const API = apiUrl("/api/v1");
const TOKEN_KEY = "scaleupp_token";
const REFRESH_KEY = "scaleupp_refresh_token";
const NEGOCIO_KEY = "scaleupp_negocio_id";
const ADMIN_POS_KEY = "scaleupp_admin_pos";

type Health = { status: string; app?: string };

type LoginResponse = {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  usuario_id: number;
  email: string;
  nombre: string;
  es_platform_admin: boolean;
  negocio_id: number | null;
  rol: string | null;
};

type Membresia = {
  id: number;
  negocio_id: number;
  negocio_nombre: string;
  rol: string;
  activo: boolean;
};

type Me = {
  id: number;
  email: string;
  nombre: string;
  es_platform_admin: boolean;
  activo: boolean;
  negocio_activo_id: number | null;
  rol_activo: string | null;
  membresias: Membresia[];
};

type Negocio = { id: number; nombre: string; slug: string };
type Unidad = { id: number; nombre: string; sigla: string };
type Categoria = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  acceso_rapido?: boolean;
  activo?: boolean;
};
type Producto = {
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

type RecetaItem = {
  id: number;
  producto_componente_id: number;
  componente_nombre: string;
  cantidad: string | number;
};

type Receta = {
  producto_kit_id: number;
  kit_nombre: string;
  componentes: RecetaItem[];
};

type Expansion = {
  kit_nombre: string;
  cantidad_kits: string | number;
  componentes: { producto_id: number; nombre: string; cantidad: string | number }[];
};

type StockItem = {
  producto_id: number;
  producto_nombre: string;
  stock_actual: string | number;
  stock_ideal: string | number | null;
  lotes_abiertos: number;
  alerta_bajo_stock: boolean;
  alerta_sobrestock: boolean;
};

type CartLine = {
  producto_id: number;
  nombre: string;
  tipo: string;
  precio_unitario: number;
  precio_lista?: number;
  cantidad: number;
  unidad_sigla?: string;
};

type PrecioPromoInfo = {
  precio_efectivo: number;
  precio_lista: number;
  promocion_nombre?: string | null;
};

type VentaItemResumen = {
  id: number;
  producto_id?: number;
  producto_nombre: string;
  cantidad: string | number;
  precio_unitario?: number;
  subtotal: number;
};

type VentaResumen = {
  id: number;
  numero?: number;
  total_venta: number;
  total_neto?: number;
  total_iva?: number;
  monto_recargo?: number;
  porcentaje_recargo?: number | string;
  monto_descuento_promo?: number;
  ganancia: number;
  costo_total?: number;
  metodo_pago: string;
  fecha_hora: string;
  anulada?: boolean;
  items?: VentaItemResumen[];
};

type StockMovimiento = {
  id: number;
  producto_id: number;
  lote_id: number;
  tipo_movimiento: string;
  cantidad: string | number;
  costo_unitario_aplicado: number;
  motivo: string | null;
  fecha_hora: string;
};

type StockLote = {
  id: number;
  producto_id: number;
  cantidad_actual: string | number;
  costo_unitario_real: number;
  fecha_caducidad: string | null;
};

type Kpis = {
  fecha_referencia: string;
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
  productos_por_vencer: {
    producto_id?: number;
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
  productos_impopulares: {
    nombre: string;
    cantidad_vendida: string | number;
    total_venta: number;
  }[];
  productos_bajo_stock: {
    nombre: string;
    stock_actual: string | number;
  }[];
  productos_sobre_stock: {
    nombre: string;
    stock_actual: string | number;
  }[];
};

function authHeaders(token: string, negocioId: number | null): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (negocioId != null) headers["X-Negocio-Id"] = String(negocioId);
  return headers;
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  const [negocioId, setNegocioId] = useState<number | null>(() => {
    const raw = localStorage.getItem(NEGOCIO_KEY);
    return raw ? Number(raw) : null;
  });
  const negocioIdRef = useRef<number | null>(negocioId);
  useEffect(() => {
    negocioIdRef.current = negocioId;
  }, [negocioId]);
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("1000");
  const [unidadId, setUnidadId] = useState<number | "">("");
  const [categoriaId, setCategoriaId] = useState<number | "">("");
  const [caduca, setCaduca] = useState(false);
  const [tipoProducto, setTipoProducto] = useState<"SIMPLE" | "KIT">("SIMPLE");

  const [kitSeleccionado, setKitSeleccionado] = useState<number | "">("");
  const [receta, setReceta] = useState<Receta | null>(null);
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [compId, setCompId] = useState<number | "">("");
  const [compCantidad, setCompCantidad] = useState("1");
  const [draftComponentes, setDraftComponentes] = useState<
    { producto_componente_id: number; cantidad: number; nombre: string }[]
  >([]);

  const [stockResumen, setStockResumen] = useState<StockItem[]>([]);
  const [entradaProductoId, setEntradaProductoId] = useState<number | "">("");
  const [entradaCantidad, setEntradaCantidad] = useState("10");
  const [entradaCosto, setEntradaCosto] = useState("500");
  const [entradaOp, setEntradaOp] = useState("0");
  const [entradaCaducidad, setEntradaCaducidad] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [precioPromoByProducto, setPrecioPromoByProducto] = useState<
    Record<number, PrecioPromoInfo>
  >({});
  const [scanCode, setScanCode] = useState("");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [clienteCreditoId, setClienteCreditoId] = useState<number | null>(null);
  const [ultimaVenta, setUltimaVenta] = useState<VentaResumen | null>(null);
  const [ventasRecientes, setVentasRecientes] = useState<VentaResumen[]>([]);
  const [stockMovimientos, setStockMovimientos] = useState<StockMovimiento[]>(
    [],
  );
  const [stockLotes, setStockLotes] = useState<StockLote[]>([]);
  const [selling, setSelling] = useState(false);

  const [caja, setCaja] = useState<{
    id: number;
    numero?: number;
    fecha: string;
    nombre_vendedor?: string;
    monto_apertura: number;
    estado: string;
    abierta_por_nombre?: string | null;
    siguiente_orden?: number;
    cuadre?: {
      efectivo_teorico: number;
      ingresos_efectivo: number;
      egresos_efectivo: number;
      ventas_efectivo: number;
      ventas_tarjeta: number;
      ventas_transferencia: number;
      ventas_credito?: number;
      cobros_credito?: number;
      total_ventas?: number;
      diferencia?: number | null;
      monto_cierre?: number | null;
    };
  } | null>(null);
  const [montoApertura, setMontoApertura] = useState("50000");
  const [nombreVendedor, setNombreVendedor] = useState("");
  const [gastoTipo, setGastoTipo] = useState("GASTO_OPERATIVO");
  const [gastoMonto, setGastoMonto] = useState("1000");
  const [gastoDesc, setGastoDesc] = useState("Bencina");
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [savingProducto, setSavingProducto] = useState(false);
  const [detalleProductoId, setDetalleProductoId] = useState<number | null>(null);
  const [detalleOrigen, setDetalleOrigen] = useState<AppScreen>("productos");
  const [lotesDetalle, setLotesDetalle] = useState<LoteResumen[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [savingEntrada, setSavingEntrada] = useState(false);
  const [savingKit, setSavingKit] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [movimientosCaja, setMovimientosCaja] = useState<
    Array<{
      id: number;
      tipo_transaccion: string;
      monto: number;
      descripcion: string;
      medio_pago: string;
      venta_id?: number | null;
      fecha_hora: string;
    }>
  >([]);
  const [ventasCajaTurno, setVentasCajaTurno] = useState<
    Array<{
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
    }>
  >([]);
  const [loadingMovimientosCaja, setLoadingMovimientosCaja] = useState(false);
  const [equipo, setEquipo] = useState<
    Array<{
      id: number;
      email: string;
      nombre: string;
      activo: boolean;
      rol: string;
      membresia_activa: boolean;
    }>
  >([]);
  const [loadingEquipo, setLoadingEquipo] = useState(false);
  const [savingEquipo, setSavingEquipo] = useState(false);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [clienteDeuda, setClienteDeuda] = useState<ClienteDeuda | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);
  const [weightPrompt, setWeightPrompt] = useState<{
    producto: Producto;
    disponible: number;
    sigla: string;
  } | null>(null);
  const [weightInput, setWeightInput] = useState("0.5");
  const [negocioConfig, setNegocioConfig] = useState<{
    negocio_id: number;
    alerta_stock_cantidad: number | string;
    alerta_stock_porcentaje: number;
    dias_caducidad_alerta: number;
    ingresos_visibles?: number;
  } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingCategoria, setSavingCategoria] = useState(false);
  const [comprasRecientes, setComprasRecientes] = useState<
    {
      id: number;
      numero?: number;
      fecha: string;
      nota: string | null;
      costo_operacion_total: number;
      monto_total: number;
      num_items: number;
      creado_en: string;
    }[]
  >([]);
  const [inversiones, setInversiones] = useState<{
    total_periodo: number;
    por_mes: { mes: string; total: number }[];
    movimientos: {
      id: number;
      tipo: string;
      monto: number;
      descripcion: string;
      compra_id: number | null;
      fecha_hora: string;
    }[];
  } | null>(null);
  const [savingCompra, setSavingCompra] = useState(false);
  const [compraOkMsg, setCompraOkMsg] = useState<string | null>(null);

  const canWrite = useMemo(() => {
    if (!me) return false;
    if (me.es_platform_admin) return true;
    return me.rol_activo === "owner" || me.membresias.some((m) => m.rol === "owner");
  }, [me]);

  useEffect(() => {
    fetch(apiUrl("/health"))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Health) => setHealth(data))
      .catch((err: Error) => setHealth({ status: `error: ${err.message}` }));
  }, []);

  const persistSession = useCallback(
    (data: {
      access_token: string;
      refresh_token?: string;
      negocio_id?: number | null;
    }) => {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      if (data.refresh_token) {
        localStorage.setItem(REFRESH_KEY, data.refresh_token);
      }
      tokenRef.current = data.access_token;
      setToken(data.access_token);
      if (data.negocio_id != null) {
        localStorage.setItem(NEGOCIO_KEY, String(data.negocio_id));
        negocioIdRef.current = data.negocio_id;
        setNegocioId(data.negocio_id);
      } else {
        // Platform admin / sin negocio: no arrastrar un X-Negocio-Id viejo
        localStorage.removeItem(NEGOCIO_KEY);
        negocioIdRef.current = null;
        setNegocioId(null);
      }
    },
    [],
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(NEGOCIO_KEY);
    localStorage.removeItem(ADMIN_POS_KEY);
    tokenRef.current = null;
    negocioIdRef.current = null;
    setToken(null);
    setNegocioId(null);
    setMe(null);
    setAdminMode(false);
  }, []);

  const tryRefreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const run = (async () => {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (!refresh) return null;
      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as LoginResponse;
        persistSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          negocio_id: data.negocio_id,
        });
        return data.access_token;
      } catch {
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    refreshInFlight.current = run;
    return run;
  }, [persistSession]);

  const loadMe = useCallback(
    async (tok: string, negId: number | null) => {
      const res = await fetch(`${API}/auth/me`, {
        headers: authHeaders(tok, negId),
      });
      if (res.status === 401) {
        const next = await tryRefreshToken();
        if (!next) throw new Error("Sesión inválida");
        const retry = await fetch(`${API}/auth/me`, {
          headers: authHeaders(next, negocioIdRef.current ?? negId),
        });
        if (!retry.ok) throw new Error("Sesión inválida");
        return (await retry.json()) as Me;
      }
      if (!res.ok) throw new Error("Sesión inválida");
      return (await res.json()) as Me;
    },
    [tryRefreshToken],
  );

  useEffect(() => {
    if (!token) {
      setMe(null);
      return;
    }
    loadMe(token, negocioId)
      .then(async (data) => {
        setMe(data);
        const preferAdmin =
          data.es_platform_admin &&
          isWebAdminAllowed() &&
          localStorage.getItem(ADMIN_POS_KEY) !== "1";
        setAdminMode(preferAdmin);

        // Admin de plataforma no requiere negocio ligado
        if (preferAdmin) {
          localStorage.removeItem(NEGOCIO_KEY);
          negocioIdRef.current = null;
          if (negocioId != null) setNegocioId(null);
          const negRes = await fetch(`${API}/negocios`, {
            headers: authHeaders(tokenRef.current ?? token, null),
          });
          if (negRes.ok) {
            setNegocios((await negRes.json()) as Negocio[]);
          }
          return;
        }

        let resolved = negocioId ?? data.negocio_activo_id;
        if (resolved == null && data.membresias.length === 1) {
          resolved = data.membresias[0].negocio_id;
        }
        if (data.es_platform_admin) {
          const negRes = await fetch(`${API}/negocios`, {
            headers: authHeaders(tokenRef.current ?? token, null),
          });
          if (negRes.ok) {
            const list = (await negRes.json()) as Negocio[];
            setNegocios(list);
            if (resolved == null && list.length > 0) {
              resolved = list[0].id;
            }
          }
        } else {
          setNegocios(
            data.membresias.map((m) => ({
              id: m.negocio_id,
              nombre: m.negocio_nombre,
              slug: "",
            })),
          );
        }
        if (resolved != null && resolved !== negocioId) {
          localStorage.setItem(NEGOCIO_KEY, String(resolved));
          negocioIdRef.current = resolved;
          setNegocioId(resolved);
        }
      })
      .catch(() => {
        clearSession();
      });
  }, [token, negocioId, loadMe, clearSession]);

  const loadCatalog = useCallback(async () => {
    if (!token || negocioId == null) return;
    setCatalogError(null);
    try {
      let headers = authHeaders(token, negocioId);
      let [uRes, cRes, pRes, sRes, vRes, cajaRes, kRes, mRes, lRes, cliRes, promoRes] =
        await Promise.all([
          fetch(`${API}/unidades-medida`, { headers }),
          fetch(`${API}/categorias`, { headers }),
          fetch(`${API}/productos`, { headers }),
          fetch(`${API}/stock/resumen`, { headers }),
          fetch(`${API}/ventas?limit=200`, { headers }),
          fetch(`${API}/caja/actual`, { headers }),
          fetch(`${API}/kpis`, { headers }),
          fetch(`${API}/stock/movimientos?limit=500`, { headers }),
          fetch(`${API}/stock/lotes`, { headers }),
          fetch(`${API}/clientes`, { headers }),
          fetch(`${API}/promociones?solo_activas=true`, { headers }),
        ]);
      if (
        [uRes, cRes, pRes, sRes].some((r) => r.status === 401) ||
        [vRes, cajaRes, kRes, mRes, lRes, cliRes, promoRes].some((r) => r.status === 401)
      ) {
        const next = await tryRefreshToken();
        if (!next) throw new Error("Sesión expirada");
        headers = authHeaders(next, negocioIdRef.current ?? negocioId);
        [uRes, cRes, pRes, sRes, vRes, cajaRes, kRes, mRes, lRes, cliRes, promoRes] =
          await Promise.all([
            fetch(`${API}/unidades-medida`, { headers }),
            fetch(`${API}/categorias`, { headers }),
            fetch(`${API}/productos`, { headers }),
            fetch(`${API}/stock/resumen`, { headers }),
            fetch(`${API}/ventas?limit=200`, { headers }),
            fetch(`${API}/caja/actual`, { headers }),
            fetch(`${API}/kpis`, { headers }),
            fetch(`${API}/stock/movimientos?limit=500`, { headers }),
            fetch(`${API}/stock/lotes`, { headers }),
            fetch(`${API}/clientes`, { headers }),
            fetch(`${API}/promociones?solo_activas=true`, { headers }),
          ]);
      }
      if (!uRes.ok || !cRes.ok || !pRes.ok || !sRes.ok) {
        const detail = await (uRes.ok
          ? cRes.ok
            ? pRes.ok
              ? sRes
              : pRes
            : cRes
          : uRes
        )
          .json()
          .catch(() => ({}));
        throw new Error(detail.detail ?? "No se pudo cargar el catálogo");
      }
      const u = (await uRes.json()) as Unidad[];
      const c = (await cRes.json()) as Categoria[];
      const p = (await pRes.json()) as Producto[];
      const s = (await sRes.json()) as StockItem[];
      setUnidades(u);
      setCategorias(c);
      setProductos(p);
      setStockResumen(s);
      if (vRes.ok) {
        const ventas = (await vRes.json()) as VentaResumen[];
        setVentasRecientes(ventas);
      }
      if (cajaRes.ok) {
        const cajaData = await cajaRes.json();
        setCaja(cajaData);
      } else {
        setCaja(null);
      }
      if (kRes.ok) {
        setKpis((await kRes.json()) as Kpis);
      }
      if (mRes.ok) {
        setStockMovimientos((await mRes.json()) as StockMovimiento[]);
      }
      if (lRes.ok) {
        setStockLotes((await lRes.json()) as StockLote[]);
      }
      if (cliRes.ok) {
        setClientes((await cliRes.json()) as ClienteItem[]);
      }
      if (promoRes.ok) {
        const promos = (await promoRes.json()) as Array<{
          id: number;
          vigente: boolean;
          nombre: string;
          items: Array<{
            producto_id: number;
            precio_lista: number;
            precio_efectivo: number;
          }>;
        }>;
        const map: Record<number, PrecioPromoInfo> = {};
        const ordered = [...promos]
          .filter((pr) => pr.vigente)
          .sort((a, b) => b.id - a.id);
        for (const pr of ordered) {
          for (const it of pr.items) {
            if (it.precio_efectivo >= it.precio_lista) continue;
            if (map[it.producto_id]) continue;
            map[it.producto_id] = {
              precio_efectivo: it.precio_efectivo,
              precio_lista: it.precio_lista,
              promocion_nombre: pr.nombre,
            };
          }
        }
        setPrecioPromoByProducto(map);
      } else {
        setPrecioPromoByProducto({});
      }
      if (u.length && unidadId === "") setUnidadId(u[0].id);
      if (c.length && categoriaId === "") setCategoriaId(c[0].id);
      if (p.filter((x) => x.tipo === "SIMPLE").length && entradaProductoId === "") {
        const first = p.find((x) => x.tipo === "SIMPLE");
        if (first) setEntradaProductoId(first.id);
      }
      // Avisos push/local (1/mes por producto o pago en gracia)
      void syncAvisosPush({ token, negocioId });
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error de catálogo");
    }
  }, [token, negocioId, unidadId, categoriaId, entradaProductoId, tryRefreshToken]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Renueva el access token en segundo plano mientras haya sesión
  useEffect(() => {
    if (!token) return;
    const tick = () => {
      void tryRefreshToken();
    };
    const id = window.setInterval(tick, 20 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [token, tryRefreshToken]);

  async function onLogin(email: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      const data: LoginResponse = await res.json();
      persistSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        negocio_id: data.negocio_id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de login");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearSession();
    setProductos([]);
    setPrecioPromoByProducto({});
    setKpis(null);
    setScreen("home");
    setMenuOpen(false);
  }

  function enterAdminPanel() {
    localStorage.removeItem(ADMIN_POS_KEY);
    setAdminMode(true);
    setMenuOpen(false);
  }

  function enterNegocioFromAdmin(id: number) {
    localStorage.setItem(ADMIN_POS_KEY, "1");
    localStorage.setItem(NEGOCIO_KEY, String(id));
    setNegocioId(id);
    setAdminMode(false);
    setScreen("home");
    setMenuOpen(false);
  }

  function onSelectNegocio(id: number) {
    localStorage.setItem(NEGOCIO_KEY, String(id));
    setNegocioId(id);
  }

  async function onCreateProducto(e: FormEvent) {
    e.preventDefault();
    if (!token || negocioId == null || unidadId === "") return;
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/productos`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nombre,
          codigo_barras: codigo || null,
          precio_venta: Number(precio),
          unidad_medida_id: unidadId,
          categoria_id: categoriaId === "" ? null : categoriaId,
          controla_caducidad: caduca,
          tipo: tipoProducto,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      setNombre("");
      setCodigo("");
      setPrecio("1000");
      setCaduca(false);
      setTipoProducto("SIMPLE");
      await loadCatalog();
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al crear");
    }
  }

  async function createProductoFromMaestra(
    values: ProductoFormValues,
  ): Promise<{ id: number }> {
    if (!token || negocioId == null || values.unidad_medida_id === "") {
      throw new Error("Datos incompletos");
    }
    setSavingProducto(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/productos`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nombre: values.nombre,
          codigo_barras: values.codigo_barras || null,
          precio_venta: Number(values.precio_venta),
          unidad_medida_id: values.unidad_medida_id,
          categoria_id: values.categoria_id === "" ? null : values.categoria_id,
          controla_caducidad: values.controla_caducidad,
          tipo: "SIMPLE",
          imagen_base64: values.imagen_data,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      const created = (await res.json()) as { id: number };
      await loadCatalog();
      return { id: created.id };
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al crear");
      throw err;
    } finally {
      setSavingProducto(false);
    }
  }

  async function updateProductoFromMaestra(
    id: number,
    values: ProductoFormValues,
  ) {
    if (!token || negocioId == null || values.unidad_medida_id === "") return;
    setSavingProducto(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/productos/${id}`, {
        method: "PATCH",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nombre: values.nombre,
          codigo_barras: values.codigo_barras || null,
          precio_venta: Number(values.precio_venta),
          unidad_medida_id: values.unidad_medida_id,
          categoria_id: values.categoria_id === "" ? null : values.categoria_id,
          controla_caducidad: values.controla_caducidad,
          tipo: values.tipo === "KIT" ? "KIT" : "SIMPLE",
          imagen_base64: values.imagen_data,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await loadCatalog();
      void loadHistorialPrecios(id);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al actualizar");
      throw err;
    } finally {
      setSavingProducto(false);
    }
  }

  const simples = useMemo(
    () => productos.filter((p) => p.tipo === "SIMPLE"),
    [productos],
  );
  const kits = useMemo(
    () => productos.filter((p) => p.tipo === "KIT"),
    [productos],
  );
  const kitsKey = useMemo(
    () =>
      kits
        .map((k) => `${k.id}:${k.precio_venta}`)
        .sort()
        .join("|"),
    [kits],
  );

  const [kitBoms, setKitBoms] = useState<KitBom[]>([]);
  const [comboCheckout, setComboCheckout] = useState<{
    sugerencias: ComboSugerencia[];
    selected: number[];
  } | null>(null);
  const [historialPrecios, setHistorialPrecios] = useState<
    Array<{
      id: number;
      producto_id: number;
      producto_nombre: string;
      precio_anterior: number;
      precio_nuevo: number;
      usuario_nombre?: string | null;
      fecha_hora: string;
    }>
  >([]);
  const [loadingHistorialPrecios, setLoadingHistorialPrecios] = useState(false);

  const loadHistorialPrecios = useCallback(
    async (productoId?: number) => {
      if (!token || negocioId == null) {
        setHistorialPrecios([]);
        return;
      }
      setLoadingHistorialPrecios(true);
      try {
        const qs = new URLSearchParams({ limit: "80" });
        if (productoId != null) qs.set("producto_id", String(productoId));
        const res = await fetch(`${API}/productos/historial-precios?${qs}`, {
          headers: authHeaders(token, negocioId),
        });
        if (!res.ok) {
          setHistorialPrecios([]);
          return;
        }
        setHistorialPrecios(
          (await res.json()) as Array<{
            id: number;
            producto_id: number;
            producto_nombre: string;
            precio_anterior: number;
            precio_nuevo: number;
            usuario_nombre?: string | null;
            fecha_hora: string;
          }>,
        );
      } catch {
        setHistorialPrecios([]);
      } finally {
        setLoadingHistorialPrecios(false);
      }
    },
    [token, negocioId],
  );

  useEffect(() => {
    if (screen === "productos") {
      void loadHistorialPrecios();
    } else if (screen === "producto-detalle" && detalleProductoId != null) {
      void loadHistorialPrecios(detalleProductoId);
    }
  }, [screen, detalleProductoId, loadHistorialPrecios]);


  useEffect(() => {
    if (!token || negocioId == null || !kitsKey) {
      setKitBoms([]);
      return;
    }
    let cancelled = false;
    const headers = authHeaders(token, negocioId);
    const kitsSnapshot = kits;
    void (async () => {
      const results = await Promise.all(
        kitsSnapshot.map(async (k) => {
          try {
            const res = await fetch(`${API}/productos/${k.id}/receta`, {
              headers,
            });
            if (!res.ok) return null;
            const r = (await res.json()) as Receta;
            if (!r.componentes?.length) return null;
            return {
              kitId: k.id,
              nombre: k.nombre,
              precioVenta: k.precio_venta,
              componentes: r.componentes.map((c) => ({
                productoId: c.producto_componente_id,
                cantidad: Number(c.cantidad),
              })),
            } satisfies KitBom;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setKitBoms(results.filter((x): x is KitBom => x != null));
      }
    })();
    return () => {
      cancelled = true;
    };
    // kitsKey evita refetch al cambiar solo identidad del array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, negocioId, kitsKey]);

  function aplicarCombosACarrito(
    lineas: CartLine[],
    seleccion: ComboSugerencia[],
  ): CartLine[] {
    let next = lineas;
    // Aplicar en orden de mayor ahorro; revalidar tras cada uno
    const ordenados = [...seleccion].sort(
      (a, b) => b.ahorro - a.ahorro || b.nKits - a.nKits,
    );
    for (const want of ordenados) {
      const kit = productos.find((p) => p.id === want.kitId);
      if (!kit) continue;
      const live = detectarCombos(
        next,
        kitBoms.filter((b) => b.kitId === want.kitId),
      )[0];
      if (!live) continue;
      const stockKit =
        Number(
          stockResumen.find((s) => s.producto_id === live.kitId)?.stock_actual ??
            0,
        ) || 0;
      const ya = next.find((l) => l.producto_id === live.kitId)?.cantidad ?? 0;
      if (ya + live.nKits > stockKit) continue;
      next = aplicarComboEnCarrito(next, live, {
        producto_id: kit.id,
        nombre: kit.nombre,
        tipo: kit.tipo,
        ...precioLineaProducto(kit),
        cantidad: live.nKits,
        unidad_sigla: unidadSigla(kit),
      });
    }
    return next;
  }

  async function cargarReceta(kitId: number) {
    if (!token || negocioId == null) return;
    setCatalogError(null);
    try {
      const headers = authHeaders(token, negocioId);
      const [rRes, eRes] = await Promise.all([
        fetch(`${API}/productos/${kitId}/receta`, { headers }),
        fetch(`${API}/productos/${kitId}/expandir?cantidad=1`, { headers }),
      ]);
      if (!rRes.ok) {
        const body = await rRes.json().catch(() => ({}));
        throw new Error(body.detail ?? "No se pudo cargar la receta");
      }
      const r = (await rRes.json()) as Receta;
      setReceta(r);
      setDraftComponentes(
        r.componentes.map((c) => ({
          producto_componente_id: c.producto_componente_id,
          cantidad: Number(c.cantidad),
          nombre: c.componente_nombre,
        })),
      );
      if (eRes.ok) {
        setExpansion((await eRes.json()) as Expansion);
      } else {
        setExpansion(null);
      }
    } catch (err) {
      setReceta(null);
      setExpansion(null);
      setDraftComponentes([]);
      setCatalogError(err instanceof Error ? err.message : "Error de receta");
    }
  }

  function onSelectKit(id: number) {
    setKitSeleccionado(id);
    void cargarReceta(id);
  }

  function addComponenteDraft() {
    if (compId === "") return;
    const prod = simples.find((p) => p.id === compId);
    if (!prod) return;
    if (draftComponentes.some((d) => d.producto_componente_id === compId)) {
      setCatalogError("Ese componente ya está en la receta");
      return;
    }
    setDraftComponentes((prev) => [
      ...prev,
      {
        producto_componente_id: prod.id,
        cantidad: Number(compCantidad) || 1,
        nombre: prod.nombre,
      },
    ]);
    setCompCantidad("1");
  }

  async function guardarReceta(e: FormEvent) {
    e.preventDefault();
    if (!token || negocioId == null || kitSeleccionado === "") return;
    if (draftComponentes.length === 0) {
      setCatalogError("La receta necesita al menos un componente");
      return;
    }
    setCatalogError(null);
    try {
      const res = await fetch(
        `${API}/productos/${kitSeleccionado}/receta`,
        {
          method: "PUT",
          headers: authHeaders(token, negocioId),
          body: JSON.stringify({
            componentes: draftComponentes.map((d) => ({
              producto_componente_id: d.producto_componente_id,
              cantidad: d.cantidad,
            })),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await cargarReceta(kitSeleccionado);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al guardar receta");
    }
  }

  async function guardarRecetaKit() {
    if (!token || negocioId == null || kitSeleccionado === "") return;
    if (draftComponentes.length === 0) {
      setCatalogError("La receta necesita al menos un componente");
      return;
    }
    setSavingKit(true);
    setCatalogError(null);
    try {
      const res = await fetch(
        `${API}/productos/${kitSeleccionado}/receta`,
        {
          method: "PUT",
          headers: authHeaders(token, negocioId),
          body: JSON.stringify({
            componentes: draftComponentes.map((d) => ({
              producto_componente_id: d.producto_componente_id,
              cantidad: d.cantidad,
            })),
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await cargarReceta(kitSeleccionado);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al guardar receta");
      throw err;
    } finally {
      setSavingKit(false);
    }
  }

  async function createKit(data: {
    nombre: string;
    precio_venta: string;
    unidad_medida_id: number;
    categoria_id: number | "";
    imagen_base64?: string | null;
  }) {
    if (!token || negocioId == null) return;
    setSavingKit(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/productos`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nombre: data.nombre,
          codigo_barras: null,
          precio_venta: Number(data.precio_venta),
          unidad_medida_id: data.unidad_medida_id,
          categoria_id: data.categoria_id === "" ? null : data.categoria_id,
          controla_caducidad: false,
          tipo: "KIT",
          imagen_base64: data.imagen_base64 || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      const created = (await res.json()) as Producto;
      await loadCatalog();
      setKitSeleccionado(created.id);
      setDraftComponentes([]);
      setReceta(null);
      setExpansion(null);
      void cargarReceta(created.id);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al crear kit");
      throw err;
    } finally {
      setSavingKit(false);
    }
  }

  async function onEntradaStock(e: FormEvent) {
    e.preventDefault();
    if (!token || negocioId == null || entradaProductoId === "") return;
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/stock/entradas`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          producto_id: entradaProductoId,
          cantidad: Number(entradaCantidad),
          precio_costo_neto: Number(entradaCosto),
          costo_operacion_total: Number(entradaOp) || 0,
          fecha_caducidad: entradaCaducidad || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      setEntradaCantidad("10");
      setEntradaOp("0");
      setEntradaCaducidad("");
      await loadCatalog();
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error de entrada");
    }
  }

  function removeCartLine(productoId: number) {
    setCart((prev) => prev.filter((l) => l.producto_id !== productoId));
  }

  async function fetchStockMap(): Promise<Map<number, number>> {
    if (!token || negocioId == null) return new Map();
    const res = await fetch(`${API}/stock/resumen`, {
      headers: authHeaders(token, negocioId),
    });
    if (!res.ok) throw new Error("No se pudo consultar stock");
    const data = (await res.json()) as StockItem[];
    setStockResumen(data);
    return new Map(data.map((s) => [s.producto_id, Number(s.stock_actual)]));
  }

  function unidadSigla(producto: Producto): string {
    return unidades.find((u) => u.id === producto.unidad_medida_id)?.sigla ?? "UND";
  }

  function precioLineaProducto(producto: Producto): {
    precio_unitario: number;
    precio_lista: number;
  } {
    const promo = precioPromoByProducto[producto.id];
    if (promo && promo.precio_efectivo < promo.precio_lista) {
      return {
        precio_unitario: promo.precio_efectivo,
        precio_lista: promo.precio_lista,
      };
    }
    return {
      precio_unitario: producto.precio_venta,
      precio_lista: producto.precio_venta,
    };
  }

  async function addToCart(producto: Producto, cantidadForzada?: number) {
    setCatalogError(null);
    try {
      // Usar stock en memoria; solo refrescar si no hay dato
      let disponible =
        Number(
          stockResumen.find((s) => s.producto_id === producto.id)?.stock_actual ??
            NaN,
        );
      if (!Number.isFinite(disponible)) {
        const stockMap = await fetchStockMap();
        disponible = stockMap.get(producto.id) ?? 0;
      }
      if (disponible <= 0) {
        setCatalogError(`Sin stock para ${producto.nombre}`);
        return;
      }
      const sigla = unidadSigla(producto);
      if (cantidadForzada == null && esPesoVariable(sigla)) {
        if (esPesoSolido(sigla)) {
          setWeightPrompt({ producto, disponible, sigla });
          setWeightInput("250");
        } else {
          setWeightPrompt({ producto, disponible, sigla });
          setWeightInput("0.5");
        }
        return;
      }
      const addQty = cantidadForzada ?? 1;
      if (addQty <= 0) {
        setCatalogError("La cantidad debe ser mayor a 0");
        return;
      }
      setCart((prev) => {
        const existing = prev.find((l) => l.producto_id === producto.id);
        const nextQty = existing ? existing.cantidad + addQty : addQty;
        const rounded = esPesoSolido(sigla)
          ? gramosACantidad(cantidadAGramos(nextQty, sigla), sigla)
          : Math.round(nextQty * 1000) / 1000;
        if (rounded > disponible) {
          setCatalogError(
            `Stock insuficiente de ${producto.nombre}. Disponible: ${
              esPesoSolido(sigla)
                ? formatPeso(disponible, sigla)
                : `${disponible} ${sigla}`
            }`,
          );
          return prev;
        }
        if (existing) {
          return prev.map((l) =>
            l.producto_id === producto.id
              ? { ...l, cantidad: rounded, unidad_sigla: sigla }
              : l,
          );
        }
        const precios = precioLineaProducto(producto);
        return [
          ...prev,
          {
            producto_id: producto.id,
            nombre: producto.nombre,
            tipo: producto.tipo,
            precio_unitario: precios.precio_unitario,
            precio_lista: precios.precio_lista,
            cantidad: rounded,
            unidad_sigla: sigla,
          },
        ];
      });
      setWeightPrompt(null);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al consultar stock",
      );
    }
  }

  async function confirmWeightAdd() {
    if (!weightPrompt) return;
    const raw = Number(String(weightInput).replace(",", "."));
    if (!Number.isFinite(raw) || raw <= 0) {
      setCatalogError("Ingresa un peso/cantidad válido");
      return;
    }
    const { sigla, disponible, producto } = weightPrompt;
    const qty = esPesoSolido(sigla)
      ? gramosACantidad(raw, sigla)
      : Math.round(raw * 1000) / 1000;
    if (qty > disponible) {
      setCatalogError(
        `Stock insuficiente. Disponible: ${
          esPesoSolido(sigla)
            ? formatPeso(disponible, sigla)
            : `${disponible} ${sigla}`
        }`,
      );
      return;
    }
    await addToCart(producto, qty);
  }

  function changeCartQty(productoId: number, cantidad: number) {
    setCatalogError(null);
    const line = cart.find((l) => l.producto_id === productoId);
    const sigla = line?.unidad_sigla ?? "UND";
    const peso = line && esPesoVariable(sigla);
    const solido = line && esPesoSolido(sigla);
    const minQty = solido ? minPeso(sigla) : peso ? 0.001 : 1;
    const qty = solido
      ? gramosACantidad(cantidadAGramos(Math.max(minQty, cantidad), sigla), sigla)
      : peso
        ? Math.round(Math.max(minQty, cantidad) * 1000) / 1000
        : Math.max(minQty, Math.round(cantidad));

    const disponible =
      Number(
        stockResumen.find((s) => s.producto_id === productoId)?.stock_actual ?? 0,
      ) || 0;

    if (qty > disponible) {
      const nombre = line?.nombre ?? "producto";
      setCatalogError(
        `Stock insuficiente de ${nombre}. Disponible: ${
          solido ? formatPeso(disponible, sigla) : disponible
        }`,
      );
      setCart((prev) =>
        prev.map((l) =>
          l.producto_id === productoId
            ? {
                ...l,
                cantidad: Math.max(minQty, Math.min(l.cantidad, disponible)),
              }
            : l,
        ),
      );
      return;
    }
    setCart((prev) =>
      prev.map((l) =>
        l.producto_id === productoId ? { ...l, cantidad: qty } : l,
      ),
    );
  }

  function openProductoDetalle(
    productoId: number,
    origen: AppScreen = "productos",
  ) {
    setDetalleProductoId(productoId);
    setDetalleOrigen(origen);
    setCatalogError(null);
    setScreen("producto-detalle");
    void loadLotesProducto(productoId);
  }

  async function loadLotesProducto(productoId: number) {
    if (!token || negocioId == null) return;
    setLoadingLotes(true);
    try {
      const res = await fetch(
        `${API}/stock/lotes?producto_id=${productoId}&solo_con_stock=false`,
        { headers: authHeaders(token, negocioId) },
      );
      if (!res.ok) throw new Error("No se pudieron cargar los lotes");
      setLotesDetalle((await res.json()) as LoteResumen[]);
    } catch (err) {
      setLotesDetalle([]);
      setCatalogError(
        err instanceof Error ? err.message : "Error al cargar lotes",
      );
    } finally {
      setLoadingLotes(false);
    }
  }

  async function registrarEntradaDetalle(data: {
    cantidad: string;
    costo: string;
    costoOp: string;
    fechaCaducidad: string;
  }) {
    if (!token || negocioId == null || detalleProductoId == null) return;
    setSavingEntrada(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/stock/entradas`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          producto_id: detalleProductoId,
          cantidad: Number(data.cantidad),
          precio_costo_neto: Number(data.costo),
          costo_operacion_total: Number(data.costoOp) || 0,
          fecha_caducidad: data.fechaCaducidad || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await loadCatalog();
      await loadLotesProducto(detalleProductoId);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al registrar entrada",
      );
      throw err;
    } finally {
      setSavingEntrada(false);
    }
  }

  async function registrarMermaDetalle(data: {
    cantidad: string;
    motivo: string;
  }) {
    if (!token || negocioId == null || detalleProductoId == null) return;
    setSavingEntrada(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/stock/salidas/merma`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          producto_id: detalleProductoId,
          cantidad: Number(data.cantidad),
          motivo: data.motivo,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await loadCatalog();
      await loadLotesProducto(detalleProductoId);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al registrar merma",
      );
      throw err;
    } finally {
      setSavingEntrada(false);
    }
  }

  function productImagesMap(): Record<string, string> {
    const map: Record<string, string> = {};
    try {
      const raw = localStorage.getItem("scaleupp_product_images");
      if (raw) {
        Object.assign(map, JSON.parse(raw) as Record<string, string>);
      }
    } catch {
      /* ignore legacy */
    }
    for (const p of productos) {
      if (p.imagen_base64) map[String(p.id)] = p.imagen_base64;
    }
    return map;
  }

  // Sube a BD imágenes que solo estaban en localStorage (una vez)
  useEffect(() => {
    if (!token || negocioId == null || !canWrite || productos.length === 0) {
      return;
    }
    let cancelled = false;
    async function migrateLegacyImages() {
      let legacy: Record<string, string> = {};
      try {
        const raw = localStorage.getItem("scaleupp_product_images");
        if (!raw) return;
        legacy = JSON.parse(raw) as Record<string, string>;
      } catch {
        return;
      }
      const pending = productos.filter(
        (p) => !p.imagen_base64 && legacy[String(p.id)],
      );
      if (pending.length === 0) return;
      for (const p of pending) {
        if (cancelled) return;
        const img = legacy[String(p.id)];
        try {
          const res = await fetch(`${API}/productos/${p.id}`, {
            method: "PATCH",
            headers: authHeaders(token!, negocioId),
            body: JSON.stringify({ imagen_base64: img }),
          });
          if (!res.ok) continue;
        } catch {
          /* skip */
        }
      }
      if (!cancelled) {
        try {
          localStorage.removeItem("scaleupp_product_images");
        } catch {
          /* ignore */
        }
        await loadCatalog();
      }
    }
    void migrateLegacyImages();
    return () => {
      cancelled = true;
    };
  }, [token, negocioId, canWrite, productos, loadCatalog]);

  function openNuevaOrden() {
    setCart([]);
    setScanCode("");
    setCatalogError(null);
    setUltimaVenta(null);
    setScreen("orden");
    void fetchStockMap().catch(() => undefined);
  }

  async function addProductByCode(codeRaw: string) {
    if (!token || negocioId == null || !codeRaw.trim()) return;
    setCatalogError(null);
    const code = codeRaw.trim();
    const local = productos.find((p) => p.codigo_barras === code);
    if (local) {
      await addToCart(local);
      setScanCode("");
      return;
    }
    try {
      const res = await fetch(
        `${API}/productos/codigo/${encodeURIComponent(code)}`,
        { headers: authHeaders(token, negocioId) },
      );
      if (!res.ok) throw new Error("Producto no encontrado");
      const p = (await res.json()) as Producto;
      await addToCart(p);
      setScanCode("");
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Código no encontrado");
    }
  }

  async function onScan(e: FormEvent) {
    e.preventDefault();
    await addProductByCode(scanCode);
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.precio_unitario * l.cantidad, 0),
    [cart],
  );

  async function cobrar(lineasOverride?: CartLine[]) {
    const lineasVenta = lineasOverride ?? cart;
    if (!token || negocioId == null || lineasVenta.length === 0) return;
    if (!caja) {
      setCatalogError("Debes abrir la caja chica antes de vender");
      return;
    }
    if (metodoPago === "CREDITO" && clienteCreditoId == null) {
      setCatalogError("Selecciona un cliente para fiar");
      return;
    }
    setSelling(true);
    setCatalogError(null);
    setComboCheckout(null);
    try {
      const res = await fetch(`${API}/ventas`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          metodo_pago: metodoPago,
          cliente_id:
            metodoPago === "CREDITO" ? clienteCreditoId : undefined,
          items: lineasVenta.map((l) => ({
            producto_id: l.producto_id,
            cantidad: l.cantidad,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      const venta = (await res.json()) as VentaResumen;
      setUltimaVenta({
        id: venta.id,
        numero: venta.numero,
        total_venta: venta.total_venta,
        total_neto: venta.total_neto,
        total_iva: venta.total_iva,
        monto_recargo: venta.monto_recargo ?? 0,
        porcentaje_recargo: venta.porcentaje_recargo ?? 0,
        monto_descuento_promo: venta.monto_descuento_promo ?? 0,
        ganancia: venta.ganancia,
        metodo_pago: venta.metodo_pago,
        fecha_hora: venta.fecha_hora,
        items: venta.items ?? [],
      });
      setCart([]);
      setClienteCreditoId(null);
      await loadCatalog();
      await loadMovimientosCajaActual();
      setShowTicket(true);
      setScreen("orden");
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al cobrar");
    } finally {
      setSelling(false);
    }
  }

  function iniciarCobro() {
    if (!token || negocioId == null || cart.length === 0) return;
    if (!caja) {
      setCatalogError("Debes abrir la caja chica antes de vender");
      return;
    }
    if (metodoPago === "CREDITO" && clienteCreditoId == null) {
      setCatalogError("Selecciona un cliente para fiar");
      return;
    }
    setCatalogError(null);
    const sugerencias = detectarCombos(cart, kitBoms);
    if (sugerencias.length > 0) {
      setComboCheckout({
        sugerencias,
        selected: sugerencias.map((s) => s.kitId),
      });
      return;
    }
    void cobrar();
  }

  async function confirmarCobroConCombos(aplicar: boolean) {
    if (!comboCheckout) {
      void cobrar();
      return;
    }
    if (!aplicar || comboCheckout.selected.length === 0) {
      setComboCheckout(null);
      void cobrar();
      return;
    }
    const seleccion = comboCheckout.sugerencias.filter((s) =>
      comboCheckout.selected.includes(s.kitId),
    );
    const next = aplicarCombosACarrito(cart, seleccion);
    setCart(next);
    setComboCheckout(null);
    await cobrar(next);
  }

  async function abrirCaja(e: FormEvent) {
    e.preventDefault();
    if (!token || negocioId == null) return;
    const vendedor = nombreVendedor.trim();
    if (!vendedor) {
      setCatalogError("Selecciona un vendedor del equipo");
      return;
    }
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/caja/abrir`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          monto_apertura: Number(montoApertura),
          nombre_vendedor: vendedor,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      setNombreVendedor("");
      await loadCatalog();
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al abrir caja");
    }
  }

  const fetchCajasPorFecha = useCallback(
    async (fecha: string) => {
      if (!token || negocioId == null) return [];
      const res = await fetch(
        `${API}/caja?fecha=${encodeURIComponent(fecha)}&limit=100`,
        { headers: authHeaders(token, negocioId) },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      return (await res.json()) as Array<{
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
          efectivo_teorico: number;
          egresos_efectivo?: number;
        } | null;
      }>;
    },
    [token, negocioId],
  );

  const fetchVentasCaja = useCallback(
    async (cajaId: number) => {
      if (!token || negocioId == null) return [];
      const res = await fetch(`${API}/caja/${cajaId}/ventas`, {
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      return (await res.json()) as Array<{
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
      }>;
    },
    [token, negocioId],
  );

  const fetchTransaccionesCaja = useCallback(
    async (cajaId: number) => {
      if (!token || negocioId == null) return [];
      const res = await fetch(`${API}/caja/${cajaId}/transacciones`, {
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      return (await res.json()) as Array<{
        id: number;
        tipo_transaccion: string;
        monto: number;
        descripcion: string;
        medio_pago: string;
        venta_id?: number | null;
        fecha_hora: string;
      }>;
    },
    [token, negocioId],
  );

  const fetchVentasPeriodo = useCallback(
    async (desde: string, hasta: string) => {
      if (!token || negocioId == null) return [];
      const qs = new URLSearchParams({
        limit: "2000",
        desde,
        hasta,
      });
      const res = await fetch(`${API}/ventas?${qs}`, {
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      return (await res.json()) as Array<{
        id: number;
        numero?: number;
        total_venta: number;
        ganancia: number;
        costo_total?: number;
        metodo_pago: string;
        fecha_hora: string;
        items?: Array<{
          id: number;
          producto_id?: number;
          producto_nombre: string;
          cantidad: string | number;
          subtotal: number;
        }>;
      }>;
    },
    [token, negocioId],
  );

  const loadMovimientosCajaActual = useCallback(async () => {
    if (!token || negocioId == null || !caja?.id) {
      setMovimientosCaja([]);
      setVentasCajaTurno([]);
      return;
    }
    setLoadingMovimientosCaja(true);
    try {
      const [rows, ventas] = await Promise.all([
        fetchTransaccionesCaja(caja.id),
        fetchVentasCaja(caja.id),
      ]);
      setMovimientosCaja(rows);
      setVentasCajaTurno(ventas);
    } catch {
      setMovimientosCaja([]);
      setVentasCajaTurno([]);
    } finally {
      setLoadingMovimientosCaja(false);
    }
  }, [token, negocioId, caja?.id, fetchTransaccionesCaja, fetchVentasCaja]);

  useEffect(() => {
    void loadMovimientosCajaActual();
  }, [loadMovimientosCajaActual]);

  const loadEquipo = useCallback(async () => {
    if (!token || negocioId == null || !canWrite) return;
    setLoadingEquipo(true);
    try {
      const res = await fetch(`${API}/equipo`, {
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setEquipo(await res.json());
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al cargar equipo",
      );
    } finally {
      setLoadingEquipo(false);
    }
  }, [token, negocioId, canWrite]);

  const loadClientes = useCallback(async () => {
    if (!token || negocioId == null) return;
    setLoadingClientes(true);
    try {
      const res = await fetch(`${API}/clientes`, {
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setClientes((await res.json()) as ClienteItem[]);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al cargar clientes",
      );
    } finally {
      setLoadingClientes(false);
    }
  }, [token, negocioId]);

  const loadClienteDeuda = useCallback(
    async (clienteId: number | null) => {
      if (!token || negocioId == null || clienteId == null) {
        setClienteDeuda(null);
        return;
      }
      try {
        const res = await fetch(`${API}/clientes/${clienteId}/deuda`, {
          headers: authHeaders(token, negocioId),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body.detail === "string"
              ? body.detail
              : `Error ${res.status}`,
          );
        }
        setClienteDeuda((await res.json()) as ClienteDeuda);
      } catch (err) {
        setCatalogError(
          err instanceof Error ? err.message : "Error al cargar deuda",
        );
      }
    },
    [token, negocioId],
  );

  async function createCliente(values: ClienteFormValues) {
    if (!token || negocioId == null) return;
    setSavingCliente(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/clientes`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nombre: values.nombre.trim(),
          telefono: values.telefono.trim() || null,
          rut: values.rut.trim() || null,
          limite_credito: Math.round(Number(values.limite_credito) || 0),
          porcentaje_recargo: Number(values.porcentaje_recargo) || 0,
          plazo_dias: Math.round(Number(values.plazo_dias) || 0),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadClientes();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al crear cliente",
      );
      throw err;
    } finally {
      setSavingCliente(false);
    }
  }

  async function updateCliente(
    id: number,
    values: ClienteFormValues & { activo?: boolean },
  ) {
    if (!token || negocioId == null) return;
    setSavingCliente(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/clientes/${id}`, {
        method: "PATCH",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nombre: values.nombre.trim(),
          telefono: values.telefono.trim() || null,
          rut: values.rut.trim() || null,
          limite_credito: Math.round(Number(values.limite_credito) || 0),
          porcentaje_recargo: Number(values.porcentaje_recargo) || 0,
          plazo_dias: Math.round(Number(values.plazo_dias) || 0),
          ...(values.activo != null ? { activo: values.activo } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadClientes();
      if (clienteDeuda?.cliente_id === id) await loadClienteDeuda(id);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al actualizar cliente",
      );
      throw err;
    } finally {
      setSavingCliente(false);
    }
  }

  async function deleteCliente(id: number) {
    if (!token || negocioId == null) return;
    setSavingCliente(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/clientes/${id}`, {
        method: "DELETE",
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      if (clienteDeuda?.cliente_id === id) setClienteDeuda(null);
      await loadClientes();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al eliminar cliente",
      );
      throw err;
    } finally {
      setSavingCliente(false);
    }
  }

  async function cobrarCreditoCliente(data: {
    cliente_id: number;
    monto: number;
    medio_pago: string;
  }) {
    if (!token || negocioId == null) return;
    setSavingCliente(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/creditos/cobros`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadClientes();
      await loadClienteDeuda(data.cliente_id);
      await loadCatalog();
      await loadMovimientosCajaActual();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al registrar cobro",
      );
      throw err;
    } finally {
      setSavingCliente(false);
    }
  }

  const loadNegocioConfig = useCallback(async () => {
    if (!token || negocioId == null) return;
    setLoadingConfig(true);
    try {
      const res = await fetch(`${API}/config`, {
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setNegocioConfig(await res.json());
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al cargar configuración",
      );
    } finally {
      setLoadingConfig(false);
    }
  }, [token, negocioId]);

  const loadCompras = useCallback(async () => {
    if (!token || negocioId == null) return;
    try {
      const [cRes, iRes] = await Promise.all([
        fetch(`${API}/compras?limit=20`, {
          headers: authHeaders(token, negocioId),
        }),
        fetch(`${API}/compras/inversiones?limit=100`, {
          headers: authHeaders(token, negocioId),
        }),
      ]);
      if (cRes.ok) setComprasRecientes(await cRes.json());
      if (iRes.ok) setInversiones(await iRes.json());
    } catch {
      /* silencioso: no bloquear UI */
    }
  }, [token, negocioId]);

  useEffect(() => {
    void loadCompras();
  }, [loadCompras]);

  async function loadCompraDetalle(compraId: number) {
    if (!token || negocioId == null) {
      throw new Error("Sesión no disponible");
    }
    const res = await fetch(`${API}/compras/${compraId}`, {
      headers: authHeaders(token, negocioId),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
      );
    }
    return (await res.json()) as {
      id: number;
      numero?: number;
      fecha: string;
      nota: string | null;
      costo_operacion_total: number;
      monto_total: number;
      items: Array<{
        id: number;
        producto_id: number;
        producto_nombre: string;
        cantidad: string | number;
        precio_costo_neto: number;
        fecha_caducidad: string | null;
        monto_linea: number;
      }>;
    };
  }

  async function createCompra(data: {
    nota: string;
    costo_operacion_total: number;
    fecha: string | null;
    items: {
      producto_id: number;
      cantidad: number;
      precio_costo_neto: number;
      fecha_caducidad: string | null;
    }[];
  }) {
    if (!token || negocioId == null) return;
    setSavingCompra(true);
    setCatalogError(null);
    setCompraOkMsg(null);
    try {
      const res = await fetch(`${API}/compras`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nota: data.nota || null,
          costo_operacion_total: data.costo_operacion_total,
          fecha: data.fecha || null,
          items: data.items,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = body.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).join("; ")
              : `Error ${res.status}`,
        );
      }
      const created = await res.json();
      setCompraOkMsg(
        `Compra #${created.numero ?? created.id} registrada · inversión $${Number(created.monto_total).toLocaleString("es-CL")}`,
      );
      await Promise.all([loadCatalog(), loadCompras()]);
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al registrar compra",
      );
      throw err;
    } finally {
      setSavingCompra(false);
    }
  }

  async function createCategoria(data: {
    nombre: string;
    descripcion: string;
    acceso_rapido: boolean;
  }) {
    if (!token || negocioId == null) return;
    setSavingCategoria(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/categorias`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          acceso_rapido: data.acceso_rapido,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadCatalog();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al crear categoría",
      );
      throw err;
    } finally {
      setSavingCategoria(false);
    }
  }

  async function updateCategoria(
    id: number,
    data: {
      nombre?: string;
      descripcion?: string | null;
      acceso_rapido?: boolean;
    },
  ) {
    if (!token || negocioId == null) return;
    setSavingCategoria(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/categorias/${id}`, {
        method: "PATCH",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadCatalog();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al actualizar categoría",
      );
      throw err;
    } finally {
      setSavingCategoria(false);
    }
  }

  async function deleteCategoria(id: number) {
    if (!token || negocioId == null) return;
    setSavingCategoria(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/categorias/${id}`, {
        method: "DELETE",
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      await loadCatalog();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al eliminar categoría",
      );
      throw err;
    } finally {
      setSavingCategoria(false);
    }
  }

  async function setAccesoRapidoMasivo(acceso_rapido: boolean) {
    if (!token || negocioId == null) return;
    const targets = categorias.filter(
      (c) => c.activo !== false && !!c.acceso_rapido !== acceso_rapido,
    );
    if (targets.length === 0) return;
    setSavingCategoria(true);
    setCatalogError(null);
    try {
      const headers = authHeaders(token, negocioId);
      const results = await Promise.all(
        targets.map((c) =>
          fetch(`${API}/categorias/${c.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ acceso_rapido }),
          }),
        ),
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const body = await failed.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${failed.status}`,
        );
      }
      await loadCatalog();
    } catch (err) {
      setCatalogError(
        err instanceof Error
          ? err.message
          : "Error al actualizar favoritos",
      );
      throw err;
    } finally {
      setSavingCategoria(false);
    }
  }

  async function saveNegocioConfig(data: {
    alerta_stock_cantidad: number;
    alerta_stock_porcentaje: number;
    dias_caducidad_alerta: number;
    ingresos_visibles: number;
  }) {
    if (!token || negocioId == null) return;
    setSavingConfig(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/config`, {
        method: "PUT",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string" ? body.detail : `Error ${res.status}`,
        );
      }
      setNegocioConfig(await res.json());
      await loadCatalog();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al guardar configuración",
      );
      throw err;
    } finally {
      setSavingConfig(false);
    }
  }
  async function crearCajero(data: {
    email: string;
    nombre: string;
    password: string;
  }) {
    if (!token || negocioId == null) return;
    setSavingEquipo(true);
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/equipo`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await loadEquipo();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al crear cajero",
      );
    } finally {
      setSavingEquipo(false);
    }
  }

  async function anularVenta(ventaId: number) {
    if (!token || negocioId == null) return;
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/ventas/${ventaId}/anular`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await loadCatalog();
      await loadMovimientosCajaActual();
    } catch (err) {
      setCatalogError(
        err instanceof Error ? err.message : "Error al anular venta",
      );
      throw err;
    }
  }

  async function registrarGasto(e: FormEvent) {
    e.preventDefault();
    if (!token || negocioId == null) return;
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/caja/gastos`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({
          tipo_transaccion: gastoTipo,
          monto: Number(gastoMonto),
          descripcion: gastoDesc,
          medio_pago: "EFECTIVO",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      setGastoDesc("");
      setGastoMonto("1000");
      await loadCatalog();
      await loadMovimientosCajaActual();
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al registrar gasto");
    }
  }

  async function cerrarCaja() {
    if (!token || negocioId == null) return;
    setCatalogError(null);
    try {
      const res = await fetch(`${API}/caja/cerrar`, {
        method: "POST",
        headers: authHeaders(token, negocioId),
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Error ${res.status}`,
        );
      }
      await loadCatalog();
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "Error al cerrar caja");
    }
  }

  const unidadById = useMemo(() => {
    const map = new Map(unidades.map((u) => [u.id, u.sigla]));
    return map;
  }, [unidades]);

  if (!me) {
    if (token) {
      return (
        <main className="login-screen">
          <p className="login-info">Cargando sesión…</p>
        </main>
      );
    }
    return (
      <LoginPage onSubmit={onLogin} loading={loading} error={error} />
    );
  }

  if (
    adminMode &&
    me.es_platform_admin &&
    isWebAdminAllowed() &&
    token
  ) {
    return (
      <AdminApp
        token={token}
        adminNombre={me.nombre}
        adminEmail={me.email}
        onLogout={logout}
        onEnterNegocio={enterNegocioFromAdmin}
      />
    );
  }

  const negocioNombre =
    negocios.find((n) => n.id === negocioId)?.nombre ?? null;

  const menu = menuOpen ? (
    <>
      <button
        type="button"
        className="app-drawer-backdrop"
        aria-label="Cerrar menú"
        onClick={() => setMenuOpen(false)}
      />
      <aside className="app-drawer" aria-label="Menú">
        <h2>Menú</h2>
        {me.es_platform_admin && isWebAdminAllowed() && (
          <button type="button" className="drawer-item" onClick={enterAdminPanel}>
            <span className="drawer-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path
                  d="M4 5h16v4H4V5zm0 7h7v7H4v-7zm10 0h6v7h-6v-7z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
              </svg>
            </span>
            Panel Admin (web)
          </button>
        )}

        <button
          type="button"
          className={`drawer-item${screen === "home" ? " active" : ""}`}
          onClick={() => {
            setScreen("home");
            setMenuOpen(false);
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Resumen
        </button>
        <button
          type="button"
          className={`drawer-item${screen === "dia-caja" ? " active" : ""}`}
          onClick={() => {
            setScreen("dia-caja");
            setMenuOpen(false);
            void loadMovimientosCajaActual();
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <rect
                x="3"
                y="5"
                width="18"
                height="16"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M8 3v4M16 3v4M3 10h18"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Día de caja
        </button>
        <button
          type="button"
          className={`drawer-item${
            screen === "productos" || screen === "producto-detalle" ? " active" : ""
          }`}
          onClick={() => {
            setScreen("productos");
            setMenuOpen(false);
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M4 7l8-3 8 3v10l-8 3-8-3V7z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M12 4v16M4 7l8 3 8-3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Productos
        </button>

        <hr className="drawer-sep" />

        <button
          type="button"
          className={`drawer-item${screen === "kits" ? " active" : ""}`}
          onClick={() => {
            setScreen("kits");
            setMenuOpen(false);
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M4 8h6v6H4V8zm10 0h6v6h-6V8zM9 16h6v4H9v-4z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Kits
        </button>
        <button
          type="button"
          className={`drawer-item${screen === "promociones" ? " active" : ""}`}
          onClick={() => {
            setScreen("promociones");
            setMenuOpen(false);
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M5 7h9l5 5-5 5H5V7z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="12" r="1.2" fill="currentColor" />
            </svg>
          </span>
          Promociones
        </button>
        <button
          type="button"
          className={`drawer-item${screen === "compra" ? " active" : ""}`}
          onClick={() => {
            setScreen("compra");
            setMenuOpen(false);
            setCatalogError(null);
            setCompraOkMsg(null);
            void loadCompras();
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M6 7h15l-1.5 9H8L6 7zm0 0L5 4H2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="9" cy="20" r="1.3" fill="currentColor" />
              <circle cx="17" cy="20" r="1.3" fill="currentColor" />
            </svg>
          </span>
          Compras
        </button>
        <button
          type="button"
          className={`drawer-item${screen === "clientes" ? " active" : ""}`}
          onClick={() => {
            setScreen("clientes");
            setMenuOpen(false);
            setCatalogError(null);
            void loadClientes();
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <circle
                cx="12"
                cy="8"
                r="3.2"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path
                d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Clientes
        </button>
        <button
          type="button"
          className={`drawer-item${screen === "finanzas" ? " active" : ""}`}
          onClick={() => {
            setScreen("finanzas");
            setMenuOpen(false);
            void loadCompras();
          }}
        >
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M4 19V5m0 14h16"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M8 15V10m5 5V7m5 8v-4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Finanzas
        </button>

        {(canWrite) && <hr className="drawer-sep" />}

        {canWrite && (
          <button
            type="button"
            className={`drawer-item${screen === "equipo" ? " active" : ""}`}
            onClick={() => {
              setScreen("equipo");
              setMenuOpen(false);
            }}
          >
            <span className="drawer-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <circle
                  cx="9"
                  cy="8"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M3 19c0-3 2.5-5 6-5s6 2 6 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <circle
                  cx="17"
                  cy="9"
                  r="2.2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M21 19c0-2.2-1.5-3.8-4-4.2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Equipo
          </button>
        )}
        {canWrite && (
          <button
            type="button"
            className={`drawer-item${
              screen === "configuracion" ? " active" : ""
            }`}
            onClick={() => {
              setScreen("configuracion");
              setMenuOpen(false);
            }}
          >
            <span className="drawer-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M12 3v2.2M12 18.8V21M4.9 6.3l1.6 1.6M17.5 16.1l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.7l1.6-1.6M17.5 7.9l1.6-1.6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            Configuración
          </button>
        )}

        {negocios.length > 0 && (
          <label className="inline-label drawer-negocio">
            Negocio
            <select
              value={negocioId ?? ""}
              onChange={(e) => onSelectNegocio(Number(e.target.value))}
            >
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="drawer-user">
          {me.nombre} · {me.email}
        </p>
        <button type="button" className="drawer-item drawer-logout" onClick={logout}>
          <span className="drawer-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M14 16l4-4-4-4M10 12h8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Cerrar sesión
        </button>
      </aside>
    </>
  ) : null;

  if (screen === "home") {
    return (
      <>
        <DashboardPage
          kpis={kpis}
          ventas={ventasRecientes}
          negocioNombre={negocioNombre}
          onOpenMenu={() => setMenuOpen(true)}
          onViewReports={() => setScreen("finanzas")}
        />
        {menu}
      </>
    );
  }

  if (screen === "dia-caja") {
    return (
      <>
        <DiaCajaPage
          caja={caja}
          movimientos={movimientosCaja}
          ventas={ventasCajaTurno}
          loadingMovimientos={loadingMovimientosCaja}
          canWrite={canWrite}
          stockAlertNombre={kpis?.productos_bajo_stock[0]?.nombre ?? null}
          montoApertura={montoApertura}
          nombreVendedor={nombreVendedor}
          equipo={equipo}
          gastoTipo={gastoTipo}
          gastoMonto={gastoMonto}
          gastoDesc={gastoDesc}
          onMontoAperturaChange={setMontoApertura}
          onNombreVendedorChange={setNombreVendedor}
          onGastoTipoChange={setGastoTipo}
          onGastoMontoChange={setGastoMonto}
          onGastoDescChange={setGastoDesc}
          onAbrirCaja={abrirCaja}
          onCerrarCaja={cerrarCaja}
          onRegistrarGasto={registrarGasto}
          onAnularVenta={anularVenta}
          onRefreshMovimientos={() => void loadMovimientosCajaActual()}
          onOpenMenu={() => setMenuOpen(true)}
          onNuevaOrden={openNuevaOrden}
          onLoadEquipo={loadEquipo}
          error={catalogError}
        />
        {menu}
      </>
    );
  }

  if (screen === "orden") {
    const stockByProducto = Object.fromEntries(
      stockResumen.map((s) => [s.producto_id, Number(s.stock_actual)]),
    );
    const bajoStockByProducto = Object.fromEntries(
      stockResumen.map((s) => [s.producto_id, !!s.alerta_bajo_stock]),
    );
    const caducidadByProducto: Record<number, number> = {};
    for (const a of kpis?.productos_por_vencer ?? []) {
      if (a.producto_id == null) continue;
      const dias = Number(a.dias_restantes);
      if (!Number.isFinite(dias)) continue;
      const prev = caducidadByProducto[a.producto_id];
      if (prev == null || dias < prev) caducidadByProducto[a.producto_id] = dias;
    }
    const productosConStock = productos.filter(
      (p) => (stockByProducto[p.id] ?? 0) > 0,
    );
    const ordenNumero = caja?.siguiente_orden ?? 1;

    return (
      <>
        <OrdenPage
          caja={caja}
          ordenNumero={ordenNumero}
          lineas={cart}
          productos={productosConStock}
          stockByProducto={stockByProducto}
          bajoStockByProducto={bajoStockByProducto}
          caducidadByProducto={caducidadByProducto}
          categorias={categorias}
          clientes={clientes}
          clienteCreditoId={clienteCreditoId}
          metodoPago={metodoPago}
          scanCode={scanCode}
          selling={selling}
          error={catalogError}
          onMetodoPagoChange={(v) => {
            setMetodoPago(v);
            if (v !== "CREDITO") setClienteCreditoId(null);
          }}
          onClienteCreditoChange={setClienteCreditoId}
          onScanCodeChange={setScanCode}
          onScanSubmit={onScan}
          onAddProducto={async (p) => {
            const full = productos.find((x) => x.id === p.id);
            if (full) await addToCart(full);
          }}
          onAddByCode={addProductByCode}
          onChangeCantidad={changeCartQty}
          onRemoveLinea={removeCartLine}
          onCobrar={() => iniciarCobro()}
          onOpenMenu={() => setMenuOpen(true)}
          onError={setCatalogError}
        />
        {comboCheckout && (
          <div
            className="ticket-backdrop"
            role="presentation"
            onClick={() => !selling && setComboCheckout(null)}
          >
            <div
              className="ticket-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="combo-checkout-title"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "22rem", width: "min(22rem, 100%)" }}
            >
              <h2 id="combo-checkout-title" style={{ margin: "0 0 0.35rem", fontSize: "1.1rem" }}>
                Combos en el carrito
              </h2>
              <p style={{ margin: "0 0 0.85rem", color: "#6b7280", fontSize: "0.88rem" }}>
                Hay productos sueltos que forman un combo. Elige cuáles aplicar
                antes de cobrar.
              </p>
              <ul
                style={{
                  listStyle: "none",
                  margin: "0 0 1rem",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                }}
              >
                {comboCheckout.sugerencias.map((s) => {
                  const checked = comboCheckout.selected.includes(s.kitId);
                  return (
                    <li key={s.kitId}>
                      <label
                        style={{
                          display: "flex",
                          gap: "0.65rem",
                          alignItems: "flex-start",
                          background: "#f9fafb",
                          borderRadius: "0.65rem",
                          padding: "0.65rem 0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setComboCheckout((prev) => {
                              if (!prev) return prev;
                              const selected = checked
                                ? prev.selected.filter((id) => id !== s.kitId)
                                : [...prev.selected, s.kitId];
                              return { ...prev, selected };
                            });
                          }}
                          style={{ marginTop: "0.2rem" }}
                        />
                        <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}>
                          <strong style={{ fontSize: "0.92rem" }}>
                            {s.nKits}× {s.nombre}
                          </strong>
                          <em style={{ fontStyle: "normal", fontSize: "0.78rem", color: "#6b7280" }}>
                            Combo ${s.totalCombo.toLocaleString("es-CL")}
                            {s.ahorro > 0
                              ? ` · ahorras $${s.ahorro.toLocaleString("es-CL")}`
                              : ""}
                          </em>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="ticket-btn-primary"
                  disabled={selling}
                  onClick={() => void confirmarCobroConCombos(true)}
                >
                  {selling
                    ? "Cobrando…"
                    : comboCheckout.selected.length > 0
                      ? "Aplicar seleccionados y cobrar"
                      : "Cobrar sin combos"}
                </button>
                <button
                  type="button"
                  className="ticket-btn-secondary"
                  disabled={selling}
                  onClick={() => void confirmarCobroConCombos(false)}
                >
                  Cobrar sin combos
                </button>
                <button
                  type="button"
                  className="ticket-btn-secondary"
                  disabled={selling}
                  onClick={() => setComboCheckout(null)}
                >
                  Volver al carrito
                </button>
              </div>
            </div>
          </div>
        )}
        {showTicket && ultimaVenta && (
          <TicketModal
            venta={ultimaVenta}
            negocioNombre={negocioNombre}
            vendedorNombre={caja?.nombre_vendedor ?? null}
            onClose={() => {
              setShowTicket(false);
              setScreen("dia-caja");
              void loadMovimientosCajaActual();
            }}
          />
        )}
        {weightPrompt && (
          <div className="ticket-backdrop" role="presentation">
            <div className="ticket-modal" role="dialog" aria-modal="true">
              <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>
                {esPesoSolido(weightPrompt.sigla)
                  ? "¿Cuántos gramos?"
                  : `¿Cuánto ${weightPrompt.sigla.toLowerCase()}?`}
              </h2>
              <p style={{ margin: "0 0 0.75rem", color: "#6b7280", fontSize: "0.88rem" }}>
                {weightPrompt.producto.nombre} · disp.{" "}
                {esPesoSolido(weightPrompt.sigla)
                  ? formatPeso(weightPrompt.disponible, weightPrompt.sigla)
                  : `${weightPrompt.disponible} ${weightPrompt.sigla}`}
              </p>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                  {esPesoSolido(weightPrompt.sigla)
                    ? "Gramos (g)"
                    : `Cantidad (${weightPrompt.sigla})`}
                </span>
                <input
                  type="number"
                  min={esPesoSolido(weightPrompt.sigla) ? 1 : 0.001}
                  step={esPesoSolido(weightPrompt.sigla) ? 1 : 0.001}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  autoFocus
                  style={{
                    border: "1.5px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.6rem 0.75rem",
                    font: "inherit",
                    fontSize: "1.05rem",
                  }}
                />
              </label>
              {esPesoSolido(weightPrompt.sigla) && Number(weightInput) > 0 && (
                <p style={{ margin: "0.5rem 0 0", color: "#6b7280", fontSize: "0.82rem" }}>
                  = {formatPeso(gramosACantidad(Number(weightInput), weightPrompt.sigla), weightPrompt.sigla)}
                </p>
              )}
              <div className="ticket-actions">
                <button
                  type="button"
                  className="ticket-btn-secondary"
                  onClick={() => setWeightPrompt(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ticket-btn-primary"
                  onClick={() => void confirmWeightAdd()}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}
        {menu}
      </>
    );
  }

  if (screen === "finanzas") {
    return (
      <>
        <FinanzasPage
          kpis={kpis}
          ventas={ventasRecientes}
          productos={productos}
          categorias={categorias}
          caja={caja}
          movimientos={stockMovimientos}
          lotes={stockLotes}
          stockResumen={stockResumen}
          inversiones={inversiones}
          kitBoms={kitBoms}
          onOpenMenu={() => setMenuOpen(true)}
          onGoCompra={() => {
            setScreen("compra");
            void loadCompras();
          }}
          onFetchCajasPorFecha={fetchCajasPorFecha}
          onFetchVentasCaja={fetchVentasCaja}
          onFetchTransaccionesCaja={fetchTransaccionesCaja}
          onFetchVentasPeriodo={fetchVentasPeriodo}
          onAnularVenta={anularVenta}
        />
        {menu}
      </>
    );
  }

  if (screen === "compra") {
    return (
      <>
        <CompraPage
          productos={productos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            codigo_barras: p.codigo_barras,
            tipo: p.tipo,
            controla_caducidad: p.controla_caducidad,
            unidad_sigla:
              unidades.find((u) => u.id === p.unidad_medida_id)?.sigla ?? "UND",
          }))}
          unidades={unidades}
          categorias={categorias}
          comprasRecientes={comprasRecientes}
          canWrite={canWrite}
          saving={savingCompra}
          savingProducto={savingProducto}
          error={catalogError}
          okMsg={compraOkMsg}
          onOpenMenu={() => setMenuOpen(true)}
          onLoadCompras={loadCompras}
          onLoadDetalleCompra={loadCompraDetalle}
          onCreateProducto={async (data) => {
            const created = await createProductoFromMaestra({
              nombre: data.nombre,
              codigo_barras: data.codigo_barras,
              precio_venta: String(data.precio_venta),
              unidad_medida_id: data.unidad_medida_id,
              categoria_id: data.categoria_id ?? "",
              controla_caducidad: data.controla_caducidad,
              tipo: "SIMPLE",
              imagen_data: null,
            });
            if (!created?.id) throw new Error("No se pudo crear el producto");
            return {
              id: created.id,
              unidad_sigla:
                unidades.find((u) => u.id === data.unidad_medida_id)?.sigla ??
                "UND",
            };
          }}
          onConfirmar={async (data) => {
            await createCompra(data);
          }}
        />
        {menu}
      </>
    );
  }

  if (screen === "productos") {
    const stockByProducto = Object.fromEntries(
      stockResumen.map((s) => [s.producto_id, Number(s.stock_actual)]),
    );
    const bajoStockByProducto = Object.fromEntries(
      stockResumen.map((s) => [s.producto_id, !!s.alerta_bajo_stock]),
    );
    return (
      <>
        <ProductosPage
          productos={productos}
          stockByProducto={stockByProducto}
          bajoStockByProducto={bajoStockByProducto}
          unidades={unidades}
          categorias={categorias}
          alertasStock={kpis?.productos_bajo_stock ?? []}
          alertasVencer={kpis?.productos_por_vencer ?? []}
          canWrite={canWrite}
          error={catalogError}
          saving={savingProducto}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenDetalle={(id) => openProductoDetalle(id, "productos")}
          onCreate={createProductoFromMaestra}
          onUpdate={updateProductoFromMaestra}
          historialPrecios={historialPrecios}
          loadingHistorialPrecios={loadingHistorialPrecios}
        />
        {menu}
      </>
    );
  }

  if (screen === "stock") {
    const caducidadByProducto: Record<number, number> = {};
    for (const a of kpis?.productos_por_vencer ?? []) {
      if (a.producto_id == null) continue;
      const dias = Number(a.dias_restantes);
      if (!Number.isFinite(dias)) continue;
      const prev = caducidadByProducto[a.producto_id];
      if (prev == null || dias < prev) caducidadByProducto[a.producto_id] = dias;
    }
    return (
      <>
        <StockPage
          items={stockResumen.map((s) => {
            const prod = productos.find((p) => p.id === s.producto_id);
            return {
              producto_id: s.producto_id,
              producto_nombre: s.producto_nombre,
              stock_actual: s.stock_actual,
              alerta_bajo_stock: s.alerta_bajo_stock,
              tipo: prod?.tipo,
              dias_caducidad: caducidadByProducto[s.producto_id],
              codigo_barras: prod?.codigo_barras ?? null,
            };
          })}
          images={productImagesMap()}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenProducto={(id) => openProductoDetalle(id, "stock")}
        />
        {menu}
      </>
    );
  }

  if (screen === "producto-detalle") {
    const producto =
      detalleProductoId != null
        ? productos.find((p) => p.id === detalleProductoId)
        : undefined;
    if (!producto) {
      return (
        <>
          <StockPage
            items={stockResumen.map((s) => {
              const prod = productos.find((p) => p.id === s.producto_id);
              return {
                producto_id: s.producto_id,
                producto_nombre: s.producto_nombre,
                stock_actual: s.stock_actual,
                alerta_bajo_stock: s.alerta_bajo_stock,
                tipo: prod?.tipo,
                codigo_barras: prod?.codigo_barras ?? null,
              };
            })}
            images={productImagesMap()}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenProducto={(id) => openProductoDetalle(id, "stock")}
          />
          {menu}
        </>
      );
    }
    const stock =
      Number(
        stockResumen.find((s) => s.producto_id === producto.id)?.stock_actual ??
          0,
      ) || 0;
    const alertaBajoStock = !!stockResumen.find(
      (s) => s.producto_id === producto.id,
    )?.alerta_bajo_stock;
    return (
      <>
        <ProductoDetallePage
          producto={producto}
          stock={stock}
          alertaBajoStock={alertaBajoStock}
          diasCaducidadAlerta={negocioConfig?.dias_caducidad_alerta ?? 30}
          ingresosVisibles={negocioConfig?.ingresos_visibles ?? 3}
          imagen={producto.imagen_base64 ?? productImagesMap()[String(producto.id)] ?? null}
          lotes={lotesDetalle}
          ventas={ventasRecientes}
          unidades={unidades}
          categorias={categorias}
          loading={loadingLotes}
          error={catalogError}
          canWrite={canWrite}
          saving={savingEntrada}
          savingProducto={savingProducto}
          onOpenMenu={() => setMenuOpen(true)}
          onBack={() => setScreen(detalleOrigen)}
          onUpdateProducto={async (values) => {
            try {
              await updateProductoFromMaestra(producto.id, values);
            } catch {
              /* catalogError */
            }
          }}
          onRegistrarEntrada={async (data) => {
            try {
              await registrarEntradaDetalle(data);
            } catch {
              /* error en catalogError */
            }
          }}
          onRegistrarMerma={async (data) => {
            try {
              await registrarMermaDetalle(data);
            } catch {
              /* error en catalogError */
            }
          }}
          historialPrecios={historialPrecios}
          loadingHistorialPrecios={loadingHistorialPrecios}
        />
        {menu}
      </>
    );
  }

  if (screen === "clientes") {
    return (
      <>
        <ClientesPage
          clientes={clientes}
          deuda={clienteDeuda}
          canWrite={canWrite}
          loading={loadingClientes}
          saving={savingCliente}
          error={catalogError}
          onOpenMenu={() => setMenuOpen(true)}
          onRefresh={loadClientes}
          onSelectCliente={(id) => void loadClienteDeuda(id)}
          onCreate={createCliente}
          onUpdate={updateCliente}
          onDelete={deleteCliente}
          onCobrar={cobrarCreditoCliente}
        />
        {menu}
      </>
    );
  }

  if (screen === "promociones") {
    if (!token || negocioId == null) return null;
    return (
      <>
        <PromocionesPage
          token={token}
          negocioId={negocioId}
          apiBase={API}
          authHeaders={authHeaders}
          productos={productos}
          canWrite={canWrite}
          onOpenMenu={() => setMenuOpen(true)}
        />
        {menu}
      </>
    );
  }

  if (screen === "kits") {
    return (
      <>
        <KitsPage
          kits={kits}
          simples={simples}
          unidades={unidades}
          categorias={categorias}
          selectedKitId={kitSeleccionado === "" ? null : kitSeleccionado}
          componentes={draftComponentes}
          canWrite={canWrite}
          saving={savingKit}
          error={catalogError}
          onOpenMenu={() => setMenuOpen(true)}
          onSelectKit={(id) => onSelectKit(id)}
          onCreateKit={async (data) => {
            await createKit(data);
          }}
          onAddComponente={(productoId, cantidad) => {
            const prod = simples.find((p) => p.id === productoId);
            if (!prod) return;
            if (
              draftComponentes.some(
                (d) => d.producto_componente_id === productoId,
              )
            ) {
              setCatalogError("Ese componente ya está en la receta");
              return;
            }
            setCatalogError(null);
            setDraftComponentes((prev) => [
              ...prev,
              {
                producto_componente_id: prod.id,
                cantidad,
                nombre: prod.nombre,
              },
            ]);
          }}
          onRemoveComponente={(productoId) => {
            setDraftComponentes((prev) =>
              prev.filter((x) => x.producto_componente_id !== productoId),
            );
          }}
          onSaveReceta={async () => {
            try {
              await guardarRecetaKit();
            } catch {
              /* catalogError */
            }
          }}
        />
        {menu}
      </>
    );
  }

  if (screen === "equipo" && canWrite) {
    return (
      <>
        <EquipoPage
          miembros={equipo}
          loading={loadingEquipo}
          saving={savingEquipo}
          error={catalogError}
          onOpenMenu={() => setMenuOpen(true)}
          onRefresh={loadEquipo}
          onCrearCajero={crearCajero}
        />
        {menu}
      </>
    );
  }

  if (screen === "configuracion" && canWrite) {
    return (
      <>
        <ConfigPage
          config={negocioConfig}
          categorias={categorias.map((c) => ({
            id: c.id,
            nombre: c.nombre,
            descripcion: c.descripcion ?? null,
            acceso_rapido: !!c.acceso_rapido,
            activo: c.activo !== false,
          }))}
          loading={loadingConfig}
          saving={savingConfig}
          savingCategoria={savingCategoria}
          error={catalogError}
          onOpenMenu={() => setMenuOpen(true)}
          onLoad={loadNegocioConfig}
          onSave={async (data) => {
            await saveNegocioConfig(data);
          }}
          onCreateCategoria={createCategoria}
          onUpdateCategoria={updateCategoria}
          onDeleteCategoria={deleteCategoria}
          onToggleAccesoRapido={async (id, acceso_rapido) => {
            await updateCategoria(id, { acceso_rapido });
          }}
          onSetAccesoRapidoMasivo={setAccesoRapidoMasivo}
        />
        {menu}
      </>
    );
  }

  return (
    <>
    <main className="shell shell-wide">
      <p className="brand">ScaleUpp</p>
      <h1>Administración de negocio</h1>
      <p className="lead">Ventas, inventario FIFO, stock y finanzas básicas.</p>

      <section className="status" aria-live="polite">
        <h2>Estado API</h2>
        {health ? (
          <p className={health.status === "ok" ? "ok" : "err"}>
            {health.app ?? "API"} — {health.status}
          </p>
        ) : (
          <p>Comprobando…</p>
        )}
      </section>

      <>
          <section className="session">
            <h2>Sesión</h2>
            <p>
              <strong>{me.nombre}</strong> ({me.email})
            </p>
            <button type="button" onClick={() => setScreen("home")}>
              Volver al resumen
            </button>
            <button type="button" onClick={() => setScreen("dia-caja")}>
              Día de caja
            </button>
            <button type="button" onClick={logout}>
              Cerrar sesión
            </button>
          </section>

          <section className="catalog">
            <h2>Caja chica</h2>
            {!caja ? (
              <form className="product-form" onSubmit={abrirCaja}>
                <p className="hint">Debes abrir caja para vender y registrar gastos.</p>
                <label>
                  Vendedor (equipo)
                  <select
                    value={nombreVendedor}
                    onChange={(e) => setNombreVendedor(e.target.value)}
                    required
                  >
                    <option value="">Selecciona del equipo…</option>
                    {equipo
                      .filter((m) => m.activo && m.membresia_activa)
                      .map((m) => (
                        <option key={m.id} value={m.nombre}>
                          {m.nombre}
                          {m.rol === "owner" ? " (dueño)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Monto apertura (CLP)
                  <input
                    type="number"
                    min={0}
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    required
                  />
                </label>
                <button type="submit">Abrir caja</button>
              </form>
            ) : (
              <>
                <p className="ok">
                  Caja #{caja.numero ?? caja.id} ABIERTA · {caja.nombre_vendedor ?? "—"} ·{" "}
                  {caja.fecha} · apertura $
                  {caja.monto_apertura.toLocaleString("es-CL")}
                </p>
                {caja.cuadre && (
                  <ul className="product-list">
                    <li>
                      <strong>Efectivo teórico</strong>
                      <span>
                        ${caja.cuadre.efectivo_teorico.toLocaleString("es-CL")}
                      </span>
                    </li>
                    <li>
                      <strong>Ventas ef / tar / trf / crédito</strong>
                      <span>
                        ${caja.cuadre.ventas_efectivo.toLocaleString("es-CL")} / $
                        {caja.cuadre.ventas_tarjeta.toLocaleString("es-CL")} / $
                        {caja.cuadre.ventas_transferencia.toLocaleString("es-CL")} / $
                        {(caja.cuadre.ventas_credito ?? 0).toLocaleString("es-CL")}
                      </span>
                    </li>
                    <li>
                      <strong>Egresos efectivo</strong>
                      <span>
                        ${caja.cuadre.egresos_efectivo.toLocaleString("es-CL")}
                      </span>
                    </li>
                  </ul>
                )}

                {canWrite && (
                  <form className="product-form" onSubmit={registrarGasto}>
                    <h3>Gasto / inyección</h3>
                    <label>
                      Tipo
                      <select
                        value={gastoTipo}
                        onChange={(e) => setGastoTipo(e.target.value)}
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
                        onChange={(e) => setGastoMonto(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Descripción
                      <input
                        value={gastoDesc}
                        onChange={(e) => setGastoDesc(e.target.value)}
                        required
                      />
                    </label>
                    <button type="submit">Registrar</button>
                  </form>
                )}

                <div className="product-form">
                  <h3>Cierre de caja</h3>
                  <p className="hint">
                    El cierre usa el efectivo teórico. Confirma desde Día de caja
                    o aquí.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "¿Cerrar la caja del día? No podrás seguir vendiendo hasta abrir una nueva.",
                        )
                      ) {
                        void cerrarCaja();
                      }
                    }}
                  >
                    Cerrar caja
                  </button>
                </div>
              </>
            )}
          </section>

          <section className="catalog pos">
            <h2>Punto de venta</h2>
            {catalogError && <p className="err">{catalogError}</p>}
            <form className="product-form" onSubmit={onScan}>
              <label>
                Código / barcode / QR
                <input
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  placeholder="Escanea o escribe el código"
                  autoFocus
                />
              </label>
              <button type="submit">Agregar</button>
            </form>

            <BarcodeScanner
              onDetected={(code) => void addProductByCode(code)}
              onError={(msg) => {
                if (msg) setCatalogError(msg);
              }}
            />

            <div className="quick-add">
              {productos.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="chip"
                  onClick={() => addToCart(p)}
                >
                  {p.nombre}
                  {p.tipo === "KIT" ? " (KIT)" : ""}
                </button>
              ))}
            </div>

            <ul className="product-list">
              {cart.map((l) => (
                <li key={l.producto_id}>
                  <strong>
                    {l.nombre} {l.tipo === "KIT" ? "· KIT" : ""}
                  </strong>
                  <span>
                    {l.cantidad} × ${l.precio_unitario.toLocaleString("es-CL")} = $
                    {(l.cantidad * l.precio_unitario).toLocaleString("es-CL")}
                  </span>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      setCart((prev) =>
                        prev.filter((x) => x.producto_id !== l.producto_id),
                      )
                    }
                  >
                    Quitar
                  </button>
                </li>
              ))}
              {cart.length === 0 && (
                <li className="muted">Carrito vacío. Escanea un producto.</li>
              )}
            </ul>

            <div className="pos-footer">
              <p className="total">
                Total: ${cartTotal.toLocaleString("es-CL")}
              </p>
              <label className="inline-label">
                Medio de pago
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => iniciarCobro()}
                disabled={cart.length === 0 || selling}
              >
                {selling ? "Cobrado…" : "Cobrar"}
              </button>
            </div>

            {ultimaVenta && (
              <p className="ok">
                Venta #{ultimaVenta.numero ?? ultimaVenta.id}: $
                {ultimaVenta.total_venta.toLocaleString("es-CL")} · ganancia $
                {ultimaVenta.ganancia.toLocaleString("es-CL")} (
                {ultimaVenta.metodo_pago})
              </p>
            )}

            {ventasRecientes.length > 0 && (
              <div className="recipe-preview">
                <h3>Últimas ventas</h3>
                <ul>
                  {ventasRecientes.map((v) => (
                    <li key={v.id}>
                      #{v.numero ?? v.id} · ${v.total_venta.toLocaleString("es-CL")} ·{" "}
                      {v.metodo_pago}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="catalog">
            <h2>Productos</h2>
            {catalogError && <p className="err">{catalogError}</p>}

            {canWrite && (
              <form className="product-form" onSubmit={onCreateProducto}>
                <h3>Nuevo producto</h3>
                <label>
                  Nombre
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Código de barras
                  <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
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
                <label className="check">
                  <input
                    type="checkbox"
                    checked={caduca}
                    onChange={(e) => setCaduca(e.target.checked)}
                  />
                  Controla caducidad
                </label>
                <label>
                  Tipo
                  <select
                    value={tipoProducto}
                    onChange={(e) =>
                      setTipoProducto(e.target.value as "SIMPLE" | "KIT")
                    }
                  >
                    <option value="SIMPLE">SIMPLE</option>
                    <option value="KIT">KIT (pack/promo)</option>
                  </select>
                </label>
                <button type="submit">Guardar producto</button>
              </form>
            )}

            <ul className="product-list">
              {productos.map((p) => (
                <li key={p.id}>
                  <strong>
                    {p.nombre}
                    {p.tipo === "KIT" ? " · KIT" : ""}
                  </strong>
                  <span>
                    ${p.precio_venta.toLocaleString("es-CL")} ·{" "}
                    {unidadById.get(p.unidad_medida_id) ?? "—"}
                    {p.codigo_barras ? ` · ${p.codigo_barras}` : ""}
                    {p.controla_caducidad ? " · caduca" : ""}
                  </span>
                </li>
              ))}
              {productos.length === 0 && (
                <li className="muted">Sin productos aún.</li>
              )}
            </ul>
          </section>

          <section className="catalog">
            <h2>Recetas (BOM virtual)</h2>
            <p className="hint">
              Al vender un KIT se descuenta stock de cada componente (Opción A).
            </p>
            {kits.length === 0 ? (
              <p className="muted">Crea un producto tipo KIT para configurar su receta.</p>
            ) : (
              <>
                <label className="inline-label">
                  Kit
                  <select
                    value={kitSeleccionado}
                    onChange={(e) => onSelectKit(Number(e.target.value))}
                  >
                    <option value="">Selecciona…</option>
                    {kits.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                {kitSeleccionado !== "" && canWrite && (
                  <form className="product-form" onSubmit={guardarReceta}>
                    <h3>Componentes del kit</h3>
                    <label>
                      Producto SIMPLE
                      <select
                        value={compId}
                        onChange={(e) => setCompId(Number(e.target.value))}
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
                      Cantidad
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={compCantidad}
                        onChange={(e) => setCompCantidad(e.target.value)}
                      />
                    </label>
                    <button type="button" onClick={addComponenteDraft}>
                      Agregar a la lista
                    </button>
                    <ul className="product-list">
                      {draftComponentes.map((d) => (
                        <li key={d.producto_componente_id}>
                          <strong>{d.nombre}</strong>
                          <span>× {d.cantidad}</span>
                          <button
                            type="button"
                            className="linkish"
                            onClick={() =>
                              setDraftComponentes((prev) =>
                                prev.filter(
                                  (x) =>
                                    x.producto_componente_id !==
                                    d.producto_componente_id,
                                ),
                              )
                            }
                          >
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button type="submit">Guardar receta</button>
                  </form>
                )}

                {receta && (
                  <div className="recipe-preview">
                    <h3>Receta actual: {receta.kit_nombre}</h3>
                    <ul>
                      {receta.componentes.map((c) => (
                        <li key={c.id}>
                          {c.componente_nombre} × {c.cantidad}
                        </li>
                      ))}
                    </ul>
                    {expansion && (
                      <p className="hint">
                        Expandir 1 kit →{" "}
                        {expansion.componentes
                          .map((c) => `${c.nombre}×${c.cantidad}`)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="catalog">
            <h2>Stock (FIFO)</h2>
            {canWrite && (
              <form className="product-form" onSubmit={onEntradaStock}>
                <h3>Entrada de compra</h3>
                <label>
                  Producto SIMPLE
                  <select
                    value={entradaProductoId}
                    onChange={(e) =>
                      setEntradaProductoId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    required
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
                  Cantidad
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={entradaCantidad}
                    onChange={(e) => setEntradaCantidad(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Costo neto unitario (CLP)
                  <input
                    type="number"
                    min={0}
                    value={entradaCosto}
                    onChange={(e) => setEntradaCosto(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Costo operación total (prorrateo)
                  <input
                    type="number"
                    min={0}
                    value={entradaOp}
                    onChange={(e) => setEntradaOp(e.target.value)}
                  />
                </label>
                <label>
                  Caducidad (si aplica)
                  <input
                    type="date"
                    value={entradaCaducidad}
                    onChange={(e) => setEntradaCaducidad(e.target.value)}
                  />
                </label>
                <button type="submit">Registrar entrada</button>
              </form>
            )}

            <ul className="product-list">
              {stockResumen.map((s) => (
                <li key={s.producto_id}>
                  <strong>
                    {s.producto_nombre}
                    {s.alerta_bajo_stock ? " · BAJO" : ""}
                    {s.alerta_sobrestock ? " · SOBRE" : ""}
                  </strong>
                  <span>
                    Stock: {s.stock_actual} · Lotes: {s.lotes_abiertos}
                    {s.stock_ideal != null ? ` · Ideal: ${s.stock_ideal}` : ""}
                  </span>
                </li>
              ))}
              {stockResumen.length === 0 && (
                <li className="muted">Sin stock registrado.</li>
              )}
            </ul>
          </section>
        </>
    </main>
    {menu}
    </>
  );
}
