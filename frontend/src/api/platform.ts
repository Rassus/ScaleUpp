/** Detecta Capacitor (APK). El panel admin es solo web. */
export function isNativeApp(): boolean {
  try {
    const cap = (
      window as unknown as {
        Capacitor?: { isNativePlatform?: () => boolean };
      }
    ).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function isWebAdminAllowed(): boolean {
  return !isNativeApp();
}
