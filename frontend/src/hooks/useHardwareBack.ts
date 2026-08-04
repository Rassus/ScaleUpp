import { useEffect } from "react";

/** Evento cancelable: si un listener llama preventDefault, App no navega atrás. */
export const HARDWARE_BACK_EVENT = "scaleupp-hardware-back";

/**
 * Escucha el botón atrás del teléfono (vía App.tsx).
 * `handler` debe devolver `true` si consumió el evento (cerró un modal, etc.).
 */
export function useHardwareBack(handler: () => boolean): void {
  useEffect(() => {
    const onBack = (e: Event) => {
      if (handler()) {
        e.preventDefault();
      }
    };
    window.addEventListener(HARDWARE_BACK_EVENT, onBack);
    return () => window.removeEventListener(HARDWARE_BACK_EVENT, onBack);
  }, [handler]);
}
