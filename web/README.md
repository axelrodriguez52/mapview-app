# MapView · Next.js

Visualizador y gestor de territorios KML, migrado a **Next.js 16 (App Router)** con
export estático para GitHub Pages.

## Requisitos

- Node.js 20 o superior (probado con Node 24).

## Desarrollo

```bash
cd web
npm install
npm run dev
```

Abrir <http://localhost:3000/mapview-app/>.

## Build y publicación

```bash
cd web
npm run build        # genera el export estático en web/out
npm run publish:root # copia web/out/* a la raíz del repositorio
```

GitHub Pages sirve la raíz del repositorio en
<https://axelrodriguez52.github.io/mapview-app/>, por eso el resultado del build se
publica en la raíz (no hace falta cambiar la configuración de Pages).

## Estructura

| Ruta | Contenido |
| --- | --- |
| `web/app/` | Layout, página y estilos globales (incluye el splash). |
| `web/components/` | `Splash` (animación de inicio) y `AppUI` (interfaz completa). |
| `web/lib/app.js` | Orquestador: importa los módulos y arranca la app con `initApp()`. |
| `web/lib/core/` | Constantes, estado compartido, referencias al DOM y utilidades. |
| `web/lib/services/` | Acceso a datos: Google Sheets, almacenamiento local de KML. |
| `web/lib/features/` | Funciones de la app: mapa, registros, selector, PDF, reporte, etc. |
| `web/lib/ui/` | Comportamiento de interfaz: toasts, sidebar y animaciones. |
| `web/public/` | Manifest, iconos y service worker. |
| `web/scripts/publish.mjs` | Copia el export a la raíz del repo. |

### Organización de `web/lib/`

- `core/state.js` es el único objeto de estado mutable compartido entre módulos.
- `core/dom.js` centraliza las referencias al DOM que usa el motor.
- Cada módulo expone funciones y, cuando necesita inicialización, un `init*()`.
- `features/` contiene la lógica de negocio; `ui/` solo se ocupa de la interfaz.
- `app.js` no implementa funciones de la app: solo decide el orden de arranque.

## Notas

- El motor (`lib/app.js` y sus módulos) se importa dinámicamente en el cliente para
  que Leaflet nunca se ejecute durante el render en servidor.
- `basePath` está fijado en `/mapview-app` (`web/next.config.mjs`). Si cambia la URL
  del sitio, hay que actualizar también el `manifest` en `web/app/layout.jsx`.
- `CENOVI_mejorado.html` se conserva como versión anterior de un solo archivo.
