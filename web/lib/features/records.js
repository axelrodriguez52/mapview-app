// features/records.js — Registros: carga, listado, edición y borrado.

import { gsap } from 'gsap';
import { GOOGLE_SHEETS_URL, RECORDS_STORAGE_KEY, SAVE_BTN_UPDATE_HTML } from '../core/constants.js';
import { $dBtnSave, $dDateEnd, $dDateStart, $dForm, $dPublisher, $dSaveStatus, $recordsAdminBtn, $recordsClose, $recordsCount, $recordsList, $recordsModal, $recordsSearch } from '../core/dom.js';
import { state } from '../core/state.js';
import { formatRecordDate, isMobile, isTablet, normalizeTerritoryName, parseDateValue, toISODate } from '../core/utils.js';
import { sheetFetch } from '../services/sheets.js';
import { showWorkflowToast } from '../ui/toast.js';
import { clearCompletionState, exitCompletionMode, reevaluateCompletionMode, saveToSheet } from './completion.js';
import { findBlockByKey, renderDetailRecords } from './detail.js';
import { refreshBlockVisual, refreshVisualsForTerritory, renderAllPolygons, renderBlockList, renderMapList, updateSelectorGeneralCard, updateStats } from './render.js';
import { renderReportModal } from './report.js';

export function openRecordsModal() {
  $recordsModal.classList.add('active');
  gsap.fromTo($recordsModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.fromTo('.records-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
  fetchRecords().then(() => renderRecordsList($recordsSearch.value.trim().toLowerCase()));
}

export function closeRecordsModal() {
  gsap.to('.records-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($recordsModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => { $recordsModal.classList.remove('active'); }
  });
}

export function renderRecordsList(filter) {
  filter = filter || '';
  const all = state.sheetRecords.filter(r => r.territorio);

  const visible = all.filter(r => {
    if (!filter) return true;
    return (r.territorio || '').toLowerCase().includes(filter) ||
           (r.mapName || '').toLowerCase().includes(filter) ||
           (r.publicador || '').toLowerCase().includes(filter);
  });

  if (visible.length === 0) {
    $recordsList.innerHTML = `<div class="records-empty">No se encontraron registros${filter ? ' para "' + filter + '"' : ''}</div>`;
    $recordsCount.textContent = `0 / ${all.length}`;
    return;
  }

  const groups = {};
  visible.forEach(r => {
    const groupName = r.mapName || 'Sin mapa';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(r);
  });

  let html = '';
  Object.keys(groups).sort().forEach(mapName => {
    const mapData = state.loadedMaps.find(m => m.name === mapName);
    const color = mapData ? mapData.color.solid : '#94a3b8';
    html += `<div class="records-group-title"><span class="map-color-dot" style="background:${color};"></span> ${mapName} (${groups[mapName].length})</div>`;
    groups[mapName].forEach(r => {
      const f1 = formatRecordDate(r.fecha_inicio);
      const f2 = formatRecordDate(r.fecha_fin);
      const fechas = f2 ? `${f1} → ${f2}` : (f1 || 'Sin fecha');
      html += `
        <div class="records-item" data-terr="${(r.territorio || '').replace(/"/g, '&quot;')}" data-pub="${(r.publicador || '').replace(/"/g, '&quot;')}" data-fi="${(r.fecha_inicio || '').replace(/"/g, '&quot;')}" data-ff="${(r.fecha_fin || '').replace(/"/g, '&quot;')}">
          <div class="records-item-info">
            <span class="records-item-terr">${r.territorio}</span>
            <span class="records-item-meta">${r.publicador || 'Sin publicador'} · ${fechas}</span>
          </div>
          <button class="records-item-del">Borrar</button>
        </div>`;
    });
  });

  $recordsList.innerHTML = html;
  $recordsCount.textContent = `${visible.length} / ${all.length} registros`;

  $recordsList.querySelectorAll('.records-item-del').forEach(btn => {
    btn.addEventListener('click', () => deleteRecordFromList(btn));
  });
}

export function deleteRecordFromList(btn) {
  const item = btn.closest('.records-item');
  const terr = item.dataset.terr;
  const pub = item.dataset.pub;
  const fi = item.dataset.fi;
  const ff = item.dataset.ff;

  if (!confirm(`¿Borrar este registro de "${terr}"?\n\nPublicador: ${pub}\nSe eliminará de Google Sheets.`)) return;

  btn.disabled = true;
  btn.textContent = '...';

  const matches = r =>
    (r.territorio || '') === terr &&
    (r.publicador || '') === pub &&
    (r.fecha_inicio || '') === fi &&
    (r.fecha_fin || '') === ff;

  // Borrado local inmediato (se revierte si el servidor no lo confirma)
  const removed = state.sheetRecords.filter(matches);
  state.sheetRecords = state.sheetRecords.filter(r => !matches(r));
  saveRecordsToStorage();
  buildRecordsMap();
  refreshVisualsForTerritory(terr);
  renderRecordsList($recordsSearch.value.trim().toLowerCase());

  const payload = JSON.stringify({
    action: 'deleteRecord',
    publicador: pub,
    fechaInicio: fi,
    fechaFin: ff,
    territorio: terr
  });

  sheetFetch(`${GOOGLE_SHEETS_URL}?action=deleteRecord&d=${encodeURIComponent(payload)}`)
    .then(r => r.json())
    .then(data => {
      if (data.status !== 'ok' || data.count === 0) throw new Error('not deleted');
      showWorkflowToast('Registro borrado ✓', '🗑️', 3000);
      fetchRecords(true);
    })
    .catch(() => {
      state.sheetRecords = state.sheetRecords.concat(removed);
      saveRecordsToStorage();
      buildRecordsMap();
      refreshVisualsForTerritory(terr);
      renderRecordsList($recordsSearch.value.trim().toLowerCase());
      showWorkflowToast('No se pudo borrar. Intenta de nuevo.', '⚠️', 3500);
    });
}

export function saveRecordsToStorage() {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(state.sheetRecords));
  } catch (e) {
    console.warn('[MapView] No se pudieron guardar registros en localStorage:', e);
  }
}

export function loadRecordsFromStorage() {
  try {
    const data = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (data) {
      state.sheetRecords = JSON.parse(data);
      buildRecordsMap();
      state.recordsLoaded = true;

      return true;
    }
  } catch (e) {
    console.warn('[MapView] Error leyendo registros de localStorage:', e);
  }
  return false;
}

export function fetchRecords(silent) {
  return sheetFetch(`${GOOGLE_SHEETS_URL}?action=getRecords`, 12000)
    .then(r => r.json())
    .then(data => {
      state.sheetRecords = Array.isArray(data) ? data : (data.records || []);
      buildRecordsMap();
      state.recordsLoaded = true;
      saveRecordsToStorage();

      // Siempre que llegan registros se recalculan los % que dependen de
      // ellos (badge, tarjeta "Vista general", reporte y lista de registros),
      // aunque la carga inicial ocurra en segundo plano.
      refreshRecordsDependentUI();

      if (silent) return;

      if (state.loadedMaps.length > 0) {
        renderAllPolygons();
        renderMapList();
        renderBlockList();
      }
      if (state.selectedBlockKey) {
        renderDetailRecords();
        reevaluateCompletionMode();
      }
    })
    .catch((err) => {
      console.warn('[MapView] Error al cargar registros de Google Sheets:', err);
      if (!state.recordsLoaded) {
        loadRecordsFromStorage();
        refreshRecordsDependentUI();
      }
      state.recordsLoaded = true;
    });
}

export function refreshRecordsDependentUI() {
  updateStats();
  updateSelectorGeneralCard();
  const rm = document.getElementById('report-modal');
  if (rm && rm.classList.contains('active')) renderReportModal();
  if ($recordsModal && $recordsModal.classList.contains('active')) {
    renderRecordsList($recordsSearch.value.trim().toLowerCase());
  }
}

export function buildRecordsMap() {
  state.recordsMap = {};
  state.sheetRecords.forEach(r => {
    const key = r.territorio ? normalizeTerritoryName(r.territorio) : '';
    if (!key) return;
    if (!state.recordsMap[key]) {
      state.recordsMap[key] = r;
    } else {
      const existing = state.recordsMap[key];
      const d1 = parseDateValue(existing.fecha_fin || existing.fecha_inicio);
      const d2 = parseDateValue(r.fecha_fin || r.fecha_inicio);
      if (d2 > d1) state.recordsMap[key] = r;
    }
  });
}

export function getRecordForBlock(blockName) {
  return state.recordsMap[normalizeTerritoryName(blockName)] || null;
}

export function getOpenRecordForBlock(blockName) {
  const rec = getRecordForBlock(blockName);
  if (!rec) return null;
  if (!(rec.fecha_inicio || '').trim()) return null;
  if ((rec.fecha_fin || '').trim()) return null;
  if (!toISODate(rec.fecha_inicio)) return null;
  return rec;
}

export function composeFinishPublisher(startPub, endPub) {
  const s = (startPub || '').trim();
  const e = (endPub || '').trim();
  if (!s) return e;
  if (!e || e.toLowerCase() === s.toLowerCase()) return s;
  return s + ' / ' + e;
}

export function getEditableRecords(blockName) {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const target = normalizeTerritoryName(blockName);
  return state.sheetRecords.filter(r => {
    if (!r.territorio || normalizeTerritoryName(r.territorio) !== target) return false;
    const ts = parseDateValue(r.fecha_fin || r.fecha_inicio || '');
    if (!ts) return false;
    const d = new Date(ts);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });
}

export function getAllRecordsForBlock(blockName) {
  const target = normalizeTerritoryName(blockName);
  return state.sheetRecords
    .filter(r => r.territorio && normalizeTerritoryName(r.territorio) === target)
    .sort((a, b) => parseDateValue(b.fecha_fin || b.fecha_inicio || '') - parseDateValue(a.fecha_fin || a.fecha_inicio || ''));
}

export function updateRecord() {
  if (!state.selectedBlockKey || !state.editingRecord) return;

  const found = findBlockByKey(state.selectedBlockKey);
  if (!found) return;
  const { mapData, block } = found;

  const publisher = $dPublisher.value.trim();
  const dateStart = $dDateStart.value;
  const dateEnd = $dDateEnd.value;
  const statusEl = $dSaveStatus;
  const btn = $dBtnSave;

  if (!publisher) {
    statusEl.className = 'save-status error';
    statusEl.textContent = 'Ingresa el nombre del publicador.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Actualizando...';
  statusEl.className = 'save-status';
  statusEl.textContent = '';

  if (!navigator.onLine) {
    statusEl.className = 'save-status error';
    statusEl.textContent = 'No hay conexión. Intenta más tarde.';
    btn.disabled = false;
    btn.innerHTML = SAVE_BTN_UPDATE_HTML;
    return;
  }

  const territorio = block.name.replace(/\s*\(\d+\)\s*$/, '');
  const payload = {
    action: 'updateRecord',
    publicador: publisher,
    territorio: territorio,
    mapName: mapData.name,
    fechaInicio: dateStart || '',
    fechaFin: dateEnd || ''
  };

  // Aplicación local inmediata (el script actualiza todas las filas del territorio)
  const affected = state.sheetRecords.filter(r => (r.territorio || '') === territorio);
  const previous = affected.map(r => ({
    ref: r,
    publicador: r.publicador,
    fecha_inicio: r.fecha_inicio,
    fecha_fin: r.fecha_fin,
    mapName: r.mapName
  }));
  affected.forEach(r => {
    r.publicador = publisher;
    r.fecha_inicio = dateStart || '';
    r.fecha_fin = dateEnd || '';
    r.mapName = mapData.name;
  });
  buildRecordsMap();
  saveRecordsToStorage();
  refreshBlockVisual(mapData.id, block.localId);
  statusEl.textContent = 'Actualizando en Google Sheets...';

  function rollback() {
    previous.forEach(v => {
      v.ref.publicador = v.publicador;
      v.ref.fecha_inicio = v.fecha_inicio;
      v.ref.fecha_fin = v.fecha_fin;
      v.ref.mapName = v.mapName;
    });
    buildRecordsMap();
    saveRecordsToStorage();
    refreshBlockVisual(mapData.id, block.localId);
  }

  sheetFetch(`${GOOGLE_SHEETS_URL}?action=updateRecord&d=${encodeURIComponent(JSON.stringify(payload))}`)
    .then(r => r.json())
    .then(data => {
      if (data.status !== 'ok') throw new Error('Server error');
      statusEl.className = 'save-status success';
      statusEl.textContent = 'Registro actualizado correctamente.';
      fetchRecords(true);
    })
    .catch(() => {
      rollback();
      statusEl.className = 'save-status error';
      statusEl.textContent = 'Error al actualizar. Verifica tu conexión.';
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = SAVE_BTN_UPDATE_HTML;
    });
}

export function startEditRecord(publisher, fechaInicio, fechaFin) {
  exitCompletionMode();
  state.editingRecord = { publicador: publisher, fecha_inicio: fechaInicio, fecha_fin: fechaFin };
  $dPublisher.value = publisher || '';
  $dDateStart.value = fechaInicio || '';
  $dDateEnd.value = fechaFin || '';
  $dBtnSave.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Actualizar registro`;
  $dBtnSave.onclick = updateRecord;

  const existingLabel = $dForm.querySelector('.edit-mode-label');
  if (!existingLabel) {
    const lbl = document.createElement('div');
    lbl.className = 'edit-mode-label';
    lbl.innerHTML = '<span>Editando registro del mes</span><button type="button" class="edit-mode-cancel">Cancelar</button>';
    $dForm.querySelector('.registration-section').prepend(lbl);
    lbl.querySelector('.edit-mode-cancel').addEventListener('click', exitEditMode);
  }

  if (isMobile() || isTablet()) {
    setTimeout(() => {
      $dForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }

  gsap.fromTo($dForm, { scale: 0.98 }, { scale: 1, duration: 0.3, ease: 'back.out(1.5)' });
}

export function exitEditMode() {
  state.editingRecord = null;
  $dPublisher.value = '';
  $dDateStart.value = '';
  $dDateEnd.value = '';
  $dBtnSave.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Grabar en Google Sheets`;
  $dBtnSave.onclick = saveToSheet;
  const lbl = $dForm.querySelector('.edit-mode-label');
  if (lbl) lbl.remove();
  $dSaveStatus.className = 'save-status';
  $dSaveStatus.textContent = '';
}

export function deleteSingleRecord(publicador, fechaInicio, fechaFin, territorio) {
  if (!confirm(`¿Borrar este registro de "${territorio}"?\n\nPublicador: ${publicador}\nEste registro se eliminará de Google Sheets.`)) return;

  const statusEl = $dSaveStatus;
  statusEl.className = 'save-status';
  statusEl.textContent = 'Borrando...';

  const matches = r =>
    (r.territorio || '') === territorio &&
    (r.publicador || '') === publicador &&
    (r.fecha_inicio || '') === fechaInicio &&
    (r.fecha_fin || '') === fechaFin;

  // Borrado local inmediato (se revierte si el servidor no lo confirma)
  const removed = state.sheetRecords.filter(matches);
  state.sheetRecords = state.sheetRecords.filter(r => !matches(r));
  saveRecordsToStorage();
  buildRecordsMap();
  if (state.selectedBlockKey) refreshBlockVisual(state.selectedBlockKey.mapId, state.selectedBlockKey.localId);

  const payload = JSON.stringify({
    action: 'deleteRecord',
    publicador: publicador,
    fechaInicio: fechaInicio,
    fechaFin: fechaFin,
    territorio: territorio
  });

  sheetFetch(`${GOOGLE_SHEETS_URL}?action=deleteRecord&d=${encodeURIComponent(payload)}`)
    .then(r => r.json())
    .then(data => {
      if (data.status === 'ok' && data.count > 0) {
        if (state.completionRecord &&
            (state.completionRecord.territorio || '') === territorio &&
            (state.completionRecord.publicador || '') === publicador &&
            (state.completionRecord.fecha_inicio || '') === fechaInicio &&
            (state.completionRecord.fecha_fin || '') === fechaFin) {
          clearCompletionState();
        }
        statusEl.className = 'save-status success';
        statusEl.textContent = 'Registro borrado. Ya puedes registrar uno nuevo.';
        showWorkflowToast('Registro borrado ✓', '🗑️', 3000);
        fetchRecords(true);
      } else {
        throw new Error('Server error');
      }
    })
    .catch(() => {
      state.sheetRecords = state.sheetRecords.concat(removed);
      saveRecordsToStorage();
      buildRecordsMap();
      if (state.selectedBlockKey) refreshBlockVisual(state.selectedBlockKey.mapId, state.selectedBlockKey.localId);
      statusEl.className = 'save-status error';
      statusEl.textContent = 'No se pudo borrar. Intenta de nuevo.';
    });
}

/** Conecta el modal de registros y el buscador. */
export function initRecordsUI() {
  $recordsAdminBtn.addEventListener('click', () => {
    $recordsSearch.value = '';
    openRecordsModal();
  });

  $recordsClose.addEventListener('click', closeRecordsModal);

  $recordsModal.addEventListener('click', (e) => {
    if (e.target === $recordsModal) closeRecordsModal();
  });

  $recordsSearch.addEventListener('input', () => renderRecordsList($recordsSearch.value.trim().toLowerCase()));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $recordsModal.classList.contains('active')) closeRecordsModal();
  });
}
