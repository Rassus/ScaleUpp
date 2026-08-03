# ScaleUpp Frontend

React + Vite + TypeScript + Capacitor (Android APK).

## Estructura

```
src/
├── api/            # Cliente HTTP / config API
├── components/     # UI (BarcodeScanner, etc.)
├── pages/
├── App.tsx
└── main.tsx
android/            # Proyecto nativo Capacitor
```

## Web (desarrollo)

```bash
npm install
npm run dev
```

Proxy a `http://localhost:8000`.

## Escáner

En el POS: botón **Escanear con cámara** (EAN/UPC/Code128/QR) + ingreso manual de respaldo.

## APK Android

### Requisitos

- [Android Studio](https://developer.android.com/studio) (SDK + JDK)
- Backend accesible desde el teléfono/emulador

### 1. Configurar API

Crea `frontend/.env`:

```env
# Emulador Android
VITE_API_BASE_URL=http://10.0.2.2:8000

# Celular en la misma WiFi (cambia la IP)
# VITE_API_BASE_URL=http://192.168.1.20:8000
```

Backend debe escuchar en todas las interfaces:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Build + sync

```powershell
cd frontend
npm run cap:sync
```

### 3. Abrir en Android Studio y generar APK

```powershell
npm run cap:open
```

En Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

APK de debug típico:

`android/app/build/outputs/apk/debug/app-debug.apk`

### Notas

- Cámara requiere permiso (ya declarado en `AndroidManifest.xml`).
- `usesCleartextTraffic=true` permite HTTP en desarrollo; en producción usa HTTPS.
- Tras cambiar el front, siempre corre `npm run cap:sync`.
