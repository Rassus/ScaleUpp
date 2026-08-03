import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type Props = {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
  /** Si true, no muestra el botón interno (el padre abre/cierra). */
  hideLaunchButton?: boolean;
  /** Control externo: true = iniciar cámara. */
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
};

const SCANNER_ID = "scaleupp-barcode-reader";

export default function BarcodeScanner({
  onDetected,
  onError,
  hideLaunchButton = false,
  active,
  onActiveChange,
}: Props) {
  const controlled = typeof active === "boolean";
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlled ? active : internalOpen;
  const [starting, setStarting] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastCodeRef = useRef<string>("");
  const lastAtRef = useRef<number>(0);
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onErrorRef.current = onError;
  }, [onDetected, onError]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) {
      void startScanner();
    } else {
      void stopScanner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setOpen(next: boolean) {
    if (controlled) onActiveChange?.(next);
    else setInternalOpen(next);
  }

  async function stopScanner() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // ignore stop errors
    }
  }

  async function startScanner() {
    setStarting(true);
    onErrorRef.current?.("");
    try {
      await stopScanner();
      await new Promise((r) => setTimeout(r, 50));

      const scanner = new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 8,
          qrbox: { width: 260, height: 140 },
          aspectRatio: 1.777,
        },
        (decoded) => {
          const now = Date.now();
          if (
            decoded === lastCodeRef.current &&
            now - lastAtRef.current < 1800
          ) {
            return;
          }
          lastCodeRef.current = decoded;
          lastAtRef.current = now;
          onDetectedRef.current(decoded);
          setOpen(false);
        },
        () => {
          // frame sin lectura
        },
      );
    } catch (err) {
      setOpen(false);
      const msg =
        err instanceof Error
          ? err.message
          : "No se pudo abrir la cámara. Usa el ingreso manual.";
      onErrorRef.current?.(msg);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="scanner">
      {!hideLaunchButton && !open && (
        <button
          type="button"
          className="scanner-btn"
          onClick={() => setOpen(true)}
          disabled={starting}
        >
          {starting ? "Abriendo cámara…" : "Escanear con cámara"}
        </button>
      )}
      {open && (
        <div className="scanner-panel">
          <div id={SCANNER_ID} className="scanner-viewport" />
          <button
            type="button"
            className="linkish"
            onClick={() => setOpen(false)}
          >
            {starting ? "Abriendo cámara…" : "Cerrar cámara"}
          </button>
        </div>
      )}
    </div>
  );
}
