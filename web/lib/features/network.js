// features/network.js — Conexión, sincronización offline y revalidación.

import { fetchRecords } from './records.js';
import { syncPendingRecords, updatePendingBadge, getPendingRecords, fetchKmlsFromSheet, pingSheetsBackend } from '../services/sheets.js';
import { saveKmlToStorage } from '../services/storage.js';
import { showWorkflowToast } from '../ui/toast.js';

let lastRecordsRefresh = 0;

/** Conecta los eventos de conexión, la cola offline y el refresco al volver a la pestaña. */
export function initNetwork() {
  window.addEventListener('online', () => {
    document.getElementById('offline-badge').style.display = 'none';
    document.getElementById('status-dot').style.display = '';
    showWorkflowToast('Conectado. Sincronizando registros offline...', '🔄', 3000);
    syncPendingRecords();
    fetchRecords();
    fetchKmlsFromSheet().then(ok => { if (ok) saveKmlToStorage(); });
  });

  window.addEventListener('offline', () => {
    document.getElementById('offline-badge').style.display = 'inline-flex';
    document.getElementById('status-dot').style.display = 'none';
    showWorkflowToast('Sin conexion. Los datos se guardan localmente.', '📡', 4000);
  });

  if (!navigator.onLine) {
    document.getElementById('offline-badge').style.display = 'inline-flex';
    document.getElementById('status-dot').style.display = 'none';
  }

  updatePendingBadge();
  if (navigator.onLine && getPendingRecords().length > 0) syncPendingRecords();

  // Mantener tibio Apps Script (evita arrancar frío de 2-6 s en cada guardado)
  pingSheetsBackend();
  setInterval(pingSheetsBackend, 4 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    pingSheetsBackend();
    // Al volver a la pestaña se refrescan registros y % (máx. 1 vez / 15 s)
    const now = Date.now();
    if (now - lastRecordsRefresh > 15000) {
      lastRecordsRefresh = now;
      fetchRecords();
    }
  });
}
