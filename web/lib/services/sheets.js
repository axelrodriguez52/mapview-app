// services/sheets.js — API de Google Sheets, KML remoto, cola offline y keep-warm.

import { GOOGLE_SHEETS_URL, PENDING_RECORDS_KEY } from '../core/constants.js';
import { state } from '../core/state.js';
import { fetchRecords } from '../features/records.js';
import { showWorkflowToast } from '../ui/toast.js';
import { saveKmlToStorage } from './storage.js';

export function fetchKmlsFromSheet() {

  return sheetFetch(`${GOOGLE_SHEETS_URL}?action=getKmls`, 12000)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      const rows = Array.isArray(data) ? data : (data.kmls || []);
      if (rows.length > 0) {
        const grouped = {};
        rows.forEach(k => {
          if (!k.fileName || k.fileName === 'fileName' || k.fileName === 'fileName') return;
          if (!k.blockName || k.blockName === 'blockName' || !k.coords) return;
          if (!grouped[k.fileName]) {
            grouped[k.fileName] = { fileName: k.fileName, blocks: [] };
          }
          const nameCount = {};
          grouped[k.fileName].blocks.forEach(b => {
            nameCount[b.name] = (nameCount[b.name] || 0) + 1;
          });
          let name = k.blockName;
          if (nameCount[name]) {
            name = name + ' (' + (nameCount[name] + 1) + ')';
          }
          grouped[k.fileName].blocks.push({ name: name, coords: k.coords });
          nameCount[k.blockName] = (nameCount[k.blockName] || 0) + 1;
        });
        const sheetsKmls = Object.values(grouped).filter(k => k.blocks.length > 0);
        if (sheetsKmls.length > 0) {
          state.allKmlData = sheetsKmls;
          saveKmlToStorage();
          const total = state.allKmlData.reduce((s, k) => s + k.blocks.length, 0);

          return true;
        }
      }

      return false;
    })
    .catch(err => {
      console.warn('[MapView] Error cargando KMLs de Sheets:', err);
      return false;
    });
}

export function saveKmlToSheet(fileName, blocks) {
  const chunks = [];
  for (let i = 0; i < blocks.length; i += 5) {
    chunks.push(blocks.slice(i, i + 5));
  }
  let chain = Promise.resolve();
  chunks.forEach(chunk => {
    chain = chain.then(() => {
      const payload = JSON.stringify({ action: 'saveKml', fileName: fileName, blocks: chunk });
      return fetch(`${GOOGLE_SHEETS_URL}?action=saveKml&d=${encodeURIComponent(payload)}`)
        .then(r => r.json())
        .catch(err => console.warn(`[MapView] Error guardando: ${fileName}`, err));
    }).then(() => new Promise(r => setTimeout(r, 400)));
  });
  return chain;
}

export function saveAllKmlsToSheet() {
  if (!state.isAdmin || state.allKmlData.length === 0) return;
  showWorkflowToast('Sincronizando mapas con la nube...', '☁️', 10000);

  let chain = Promise.resolve();
  let saved = 0;
  let failed = 0;

  state.allKmlData.forEach(k => {
    chain = chain.then(() => {
      return saveKmlToSheet(k.fileName, k.blocks)
        .then(() => { saved++; })
        .catch(() => { failed++; })
        .then(() => new Promise(r => setTimeout(r, 500)));
    });
  });

  chain.then(() => {
    if (failed === 0) {
      showWorkflowToast(`${saved} mapa(s) sincronizados en la nube ✓`, '☁️', 3000);
    } else {
      showWorkflowToast(`${saved} OK, ${failed} fallaron. Reintenta subir.`, '⚠️', 5000);
    }
  });
}

export function deleteKmlFromSheet(fileName) {
  const d = JSON.stringify({ fileName: fileName });
  return fetch(`${GOOGLE_SHEETS_URL}?action=deleteKml&fileName=${encodeURIComponent(fileName)}&d=${encodeURIComponent(d)}`)
    .then(r => r.json())
    .catch(err => console.warn('[MapView] Error eliminando KML de Sheets:', err));
}

export function getPendingRecords() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_RECORDS_KEY)) || [];
  } catch (e) { return []; }
}

export function savePendingRecords(records) {
  try { localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

export function queueRecord(payload) {
  const pending = getPendingRecords();
  pending.push(payload);
  savePendingRecords(pending);
}

export function sheetFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 15000);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function syncPendingRecords() {
  const pending = getPendingRecords();
  if (pending.length === 0) return;

  let synced = 0;
  let failed = 0;
  const remaining = [];

  function trySync(i) {
    if (i >= pending.length) {
      savePendingRecords(remaining);
      if (synced > 0) {
        showWorkflowToast(`${synced} registro(s) offline sincronizados ✓`, '🔄', 4000);
        fetchRecords();
      }
      if (failed > 0) {
        showWorkflowToast(`${failed} registro(s) pendientes (sin conexión)`, '⚠️', 4000);
      }
      updatePendingBadge();
      return;
    }
    const rec = pending[i];
    const p = JSON.stringify(rec);
    sheetFetch(`${GOOGLE_SHEETS_URL}?action=addRecord&d=${encodeURIComponent(p)}`)
      .then(r => r.json())
      .then(d => { if (d.status === 'ok') synced++; else { remaining.push(rec); failed++; } })
      .catch(() => { remaining.push(rec); failed++; })
      .finally(() => setTimeout(() => trySync(i + 1), 300));
  }
  trySync(0);
}

export function updatePendingBadge() {
  const count = getPendingRecords().length;
  const badge = document.getElementById('pending-badge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

export function pingSheetsBackend() {
  if (!navigator.onLine) return;
  fetch(`${GOOGLE_SHEETS_URL}?action=getPassword`).then(r => r.text()).catch(() => {});
}
