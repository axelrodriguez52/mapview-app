// app.js — Orquestador del motor: importa los módulos y arranca la app con initApp().

import { state } from './core/state.js';
import { $btnCambiarMapa, $dBtnSave, $intro } from './core/dom.js';
import { initTheme } from './features/theme.js';
import { initAdmin, fetchAdminPassword } from './features/admin.js';
import { initRecordsUI, fetchRecords, startEditRecord, deleteSingleRecord } from './features/records.js';
import { initRenameUI } from './features/rename.js';
import { initMap } from './features/map.js';
import { initRender, renderAllPolygons, renderBlockList, updateStats } from './features/render.js';
import { initUpload } from './features/upload.js';
import { initSearch } from './features/search.js';
import { initSidebar } from './ui/sidebar.js';
import { initSelector, openMapSelector } from './features/selector.js';
import { initSplash } from './features/splash.js';
import { initPdf, exportPDF } from './features/pdf.js';
import { initReport, openReportModal } from './features/report.js';
import { initNetwork } from './features/network.js';
import { initAnimations } from './ui/animations.js';
import { loadKmlFromStorage } from './services/storage.js';
import { saveToSheet } from './features/completion.js';

let started = false;
let appShown = false;

/** Revela la app cuando termina el splash (idempotente). */
function showApp() {
  if (appShown) return;
  appShown = true;
  $intro.style.display = 'none';
  document.getElementById('app').style.opacity = '1';
  state.map.invalidateSize();

  fetchAdminPassword();

  if (state.allKmlData.length > 0) {
    openMapSelector();
  } else {
    updateStats();
  }
  state.recordsReady.then(() => updateStats());
}

/**
 * Punto de entrada del motor de la app.
 * Se importa dinámicamente desde el componente cliente cuando el DOM ya existe.
 */
export function initApp() {
  if (started) return;
  started = true;

  // Interfaz y mapa
  initTheme();
  initAdmin();
  initRecordsUI();
  initRenameUI();
  initMap();
  initRender();
  initUpload();
  initSearch();
  initSidebar();
  initSelector();

  // Datos: registros en segundo plano + KML guardados
  state.recordsReady = fetchRecords();
  loadKmlFromStorage();

  // Splash de bienvenida
  initSplash(showApp);

  // Modales y red
  initPdf();
  initReport();
  initNetwork();
  initAnimations();

  state.recordsReady.then(() => {
    if (state.loadedMaps.length > 0) {
      renderAllPolygons();
      renderBlockList();
    }
  });

  // Handlers globales (HTML dinámico con onclick)
  window.startEditRecord = startEditRecord;
  window.deleteSingleRecord = deleteSingleRecord;

  // Botones estáticos (antes con onclick inline en el HTML)
  $btnCambiarMapa.onclick = openMapSelector;
  document.getElementById('btn-export-pdf').onclick = exportPDF;
  document.getElementById('btn-reporte').onclick = openReportModal;
  $dBtnSave.onclick = saveToSheet;

  // PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=13').then(reg => {
      reg.update().catch(() => {});
    }).catch(() => {});
  }
}
