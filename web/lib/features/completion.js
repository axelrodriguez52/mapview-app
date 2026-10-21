// features/completion.js — Modo finalización y guardado de registros.

import { gsap } from 'gsap';
import { GOOGLE_SHEETS_URL, SAVE_BTN_DEFAULT_HTML, SAVE_BTN_FINAL_HTML } from '../core/constants.js';
import { $dBtnSave, $dDateEnd, $dDateStart, $dForm, $dPubEndLabel, $dPublisher, $dPublisherEnd, $dSaveStatus } from '../core/dom.js';
import { state } from '../core/state.js';
import { toISODate } from '../core/utils.js';
import { queueRecord, sheetFetch, updatePendingBadge } from '../services/sheets.js';
import { showWorkflowToast } from '../ui/toast.js';
import { findBlockByKey, renderDetailRecords } from './detail.js';
import { buildRecordsMap, composeFinishPublisher, exitEditMode, fetchRecords, getOpenRecordForBlock, saveRecordsToStorage } from './records.js';
import { refreshBlockVisual } from './render.js';

export function saveToSheet() {
  if (!state.selectedBlockKey) return;

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
  btn.textContent = 'Guardando...';
  statusEl.className = 'save-status';
  statusEl.textContent = '';

  const territorio = block.name.replace(/\s*\(\d+\)\s*$/, '');
  const payload = {
    action: 'addRecord',
    publicador: publisher,
    territorio: territorio,
    mapName: mapData.name,
    fechaInicio: dateStart || '',
    fechaFin: dateEnd || ''
  };

  // Aplicación local inmediata: la interfaz responde sin esperar a Google Sheets
  state.sheetRecords.push({
    publicador: publisher,
    territorio: territorio,
    mapName: mapData.name,
    fecha_inicio: dateStart || '',
    fecha_fin: dateEnd || ''
  });
  buildRecordsMap();
  saveRecordsToStorage();
  refreshBlockVisual(mapData.id, block.localId);
  statusEl.textContent = 'Guardando en Google Sheets...';

  if (!navigator.onLine) {
    queueRecord(payload);
    statusEl.className = 'save-status success';
    statusEl.textContent = 'Guardado offline. Se sincronizará al conectar.';
    btn.disabled = false;
    btn.innerHTML = SAVE_BTN_DEFAULT_HTML;
    updatePendingBadge();
    return;
  }

  sheetFetch(`${GOOGLE_SHEETS_URL}?action=addRecord&d=${encodeURIComponent(JSON.stringify(payload))}`)
    .then(r => r.json())
    .then(data => {
      if (data.status !== 'ok') throw new Error('Server error');
      statusEl.className = 'save-status success';
      statusEl.textContent = 'Guardado correctamente en Google Sheets.';
      fetchRecords(true);
    })
    .catch(() => {
      queueRecord(payload);
      statusEl.className = 'save-status success';
      statusEl.textContent = 'Guardado offline. Se sincronizará al conectar.';
      updatePendingBadge();
    })
    .finally(() => {
      btn.disabled = false;
      btn.innerHTML = SAVE_BTN_DEFAULT_HTML;
    });
}

export function enterCompletionMode(rec) {
  if (!rec) return;
  state.completionRecord = rec;

  $dPublisher.value = rec.publicador || '';
  $dDateStart.value = toISODate(rec.fecha_inicio) || '';
  $dDateEnd.value = '';
  $dPublisher.disabled = true;
  $dDateStart.disabled = true;
  $dDateEnd.disabled = false;
  $dPublisherEnd.value = '';
  $dPublisherEnd.disabled = false;
  $dPubEndLabel.style.display = '';
  const startSpan = $dPublisher.closest('label').querySelector('span');
  if (startSpan) startSpan.textContent = 'Publicador que inició';
  if ($dDateStart.value) $dDateEnd.min = $dDateStart.value;
  $dSaveStatus.className = 'save-status';
  $dSaveStatus.textContent = '';

  $dBtnSave.innerHTML = SAVE_BTN_FINAL_HTML;
  $dBtnSave.onclick = completeRecord;

  const existing = $dForm.querySelector('.completion-mode-label');
  if (existing) existing.remove();
  const lbl = document.createElement('div');
  lbl.className = 'completion-mode-label';
  const span = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = rec.publicador || 'sin publicador';
  span.append('Registro en curso: ', strong, ' — falta la fecha final');
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'edit-mode-cancel';
  cancelBtn.textContent = 'Nuevo registro';
  lbl.append(span, cancelBtn);
  $dForm.querySelector('.registration-section').prepend(lbl);
  cancelBtn.addEventListener('click', clearCompletionState);

  gsap.fromTo($dForm, { scale: 0.98 }, { scale: 1, duration: 0.3, ease: 'back.out(1.5)' });
}

export function exitCompletionMode() {
  state.completionRecord = null;
  $dPublisher.disabled = false;
  $dDateStart.disabled = false;
  $dDateEnd.disabled = false;
  $dDateEnd.removeAttribute('min');
  $dPublisherEnd.value = '';
  $dPubEndLabel.style.display = 'none';
  const startSpan = $dPublisher.closest('label').querySelector('span');
  if (startSpan) startSpan.textContent = 'Nombre del Publicador';
  const lbl = $dForm.querySelector('.completion-mode-label');
  if (lbl) lbl.remove();
}

export function clearCompletionState() {
  exitCompletionMode();
  exitEditMode();
  const lbl = $dForm.querySelector('.completion-mode-label');
  if (lbl) lbl.remove();
}

export function reevaluateCompletionMode() {
  if (!state.selectedBlockKey || state.completionRecord || state.editingRecord) return;
  if ($dForm.style.display === 'none') return;
  if ($dPublisher.value || $dPublisherEnd.value || $dDateStart.value || $dDateEnd.value) return;
  const found = findBlockByKey(state.selectedBlockKey);
  if (!found) return;
  const openRec = getOpenRecordForBlock(found.block.name);
  if (openRec) enterCompletionMode(openRec);
}

export function completeRecord() {
  if (!state.selectedBlockKey || !state.completionRecord) return;

  const found = findBlockByKey(state.selectedBlockKey);
  if (!found) return;
  const { mapData } = found;

  const rec = state.completionRecord;
  const statusEl = $dSaveStatus;
  const btn = $dBtnSave;
  const dateEnd = $dDateEnd.value;

  if (!dateEnd) {
    statusEl.className = 'save-status error';
    statusEl.textContent = 'Selecciona la fecha de finalización.';
    return;
  }
  const fiISO = toISODate(rec.fecha_inicio);
  if (fiISO && dateEnd && dateEnd < fiISO) {
    statusEl.className = 'save-status error';
    statusEl.textContent = 'La fecha final no puede ser anterior a la de inicio.';
    return;
  }
  if (!navigator.onLine) {
    statusEl.className = 'save-status error';
    statusEl.textContent = 'No hay conexión. Se requiere internet para cerrar el registro.';
    return;
  }

  const addPayload = {
    action: 'addRecord',
    publicador: composeFinishPublisher(rec.publicador, $dPublisherEnd.value),
    territorio: rec.territorio,
    mapName: rec.mapName || mapData.name,
    fechaInicio: toISODate(rec.fecha_inicio) || rec.fecha_inicio || '',
    fechaFin: dateEnd
  };
  const delPayload = {
    action: 'deleteRecord',
    publicador: rec.publicador || '',
    fechaInicio: rec.fecha_inicio || '',
    fechaFin: rec.fecha_fin || '',
    territorio: rec.territorio
  };

  btn.disabled = true;
  btn.textContent = 'Guardando...';
  statusEl.className = 'save-status';
  statusEl.textContent = '';

  function attemptDelete(retries) {
    return sheetFetch(`${GOOGLE_SHEETS_URL}?action=deleteRecord&d=${encodeURIComponent(JSON.stringify(delPayload))}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.status === 'ok' && d.count > 0) return true;
        if (retries > 0) return new Promise(res => setTimeout(res, 800)).then(() => attemptDelete(retries - 1));
        return false;
      })
      .catch(() => retries > 0
        ? new Promise(res => setTimeout(res, 800)).then(() => attemptDelete(retries - 1))
        : false);
  }

  function applyLocalCompletion() {
    state.sheetRecords = state.sheetRecords.filter(r2 => !(
      (r2.territorio || '') === delPayload.territorio &&
      (r2.publicador || '') === delPayload.publicador &&
      (r2.fecha_inicio || '') === delPayload.fechaInicio &&
      (r2.fecha_fin || '') === delPayload.fechaFin
    ));
    state.sheetRecords.push({
      publicador: addPayload.publicador,
      territorio: addPayload.territorio,
      mapName: addPayload.mapName,
      fecha_inicio: addPayload.fechaInicio,
      fecha_fin: dateEnd
    });
    buildRecordsMap();
    saveRecordsToStorage();
    refreshBlockVisual(found.mapData.id, found.block.localId);
    if (state.selectedBlockKey) renderDetailRecords();
  }

  // Aplicación local inmediata: el cierre se refleja al instante en la
  // interfaz (polígono, stats y %) sin esperar los 2 round-trips a Sheets.
  const prevRecords = state.sheetRecords.slice();
  applyLocalCompletion();
  statusEl.textContent = 'Guardando en Google Sheets...';

  function rollbackLocalCompletion() {
    state.sheetRecords = prevRecords.slice();
    buildRecordsMap();
    saveRecordsToStorage();
    refreshBlockVisual(found.mapData.id, found.block.localId);
    if (state.selectedBlockKey) renderDetailRecords();
  }

  attemptDelete(2)
    .then(deleted => {
      if (!deleted) {
        rollbackLocalCompletion();
        if (state.completionRecord === rec) {
          statusEl.className = 'save-status error';
          statusEl.textContent = 'No se pudo completar el registro. Verifica tu conexión.';
        }
        return;
      }
      return sheetFetch(`${GOOGLE_SHEETS_URL}?action=addRecord&d=${encodeURIComponent(JSON.stringify(addPayload))}`)
        .then(r => r.json())
        .then(d => {
          if (!d || d.status !== 'ok') throw new Error('add failed');
          return 'saved';
        })
        .catch(() => {
          queueRecord(addPayload);
          return 'queued';
        });
    })
    .then(result => {
      if (!result) return;
      const stillActive = state.completionRecord === rec;
      if (result === 'queued') {
        if (stillActive) {
          clearCompletionState();
          statusEl.className = 'save-status success';
          statusEl.textContent = 'Guardado offline. Se sincronizará al conectar.';
        }
        showWorkflowToast('Guardado offline — se completará al conectar', '📴', 3500);
        updatePendingBadge();
      } else {
        if (stillActive) {
          clearCompletionState();
          statusEl.className = 'save-status success';
          statusEl.textContent = 'Fecha de finalización guardada. Registro completado ✓';
        }
        showWorkflowToast('Territorio completado ✓', '✅', 3000);
      }
      fetchRecords(true);
    })
    .catch(() => {
      if (state.completionRecord === rec) {
        statusEl.className = 'save-status error';
        statusEl.textContent = 'Error al guardar. Intenta de nuevo.';
      }
    })
    .finally(() => {
      btn.disabled = false;
      if (state.completionRecord) {
        btn.innerHTML = SAVE_BTN_FINAL_HTML;
      } else if (!state.editingRecord) {
        btn.innerHTML = SAVE_BTN_DEFAULT_HTML;
      }
    });
}
