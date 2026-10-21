import L from 'leaflet';
import { gsap } from 'gsap';
import { jsPDF } from 'jspdf';

let started = false;

export function initApp() {
  if (started) return;
  started = true;

// ── COLOR PALETTE ──
const MAP_COLORS = [
  { fill: 'rgba(59,130,246,0.22)',  stroke: '#3b82f6', solid: '#3b82f6', label: '#93bbfd' },
  { fill: 'rgba(16,185,129,0.22)',  stroke: '#10b981', solid: '#10b981', label: '#6ee7b7' },
  { fill: 'rgba(245,158,11,0.22)',  stroke: '#f59e0b', solid: '#f59e0b', label: '#fcd34d' },
  { fill: 'rgba(239,68,68,0.22)',   stroke: '#ef4444', solid: '#ef4444', label: '#fca5a5' },
  { fill: 'rgba(168,85,247,0.22)',  stroke: '#a855f7', solid: '#a855f7', label: '#c4b5fd' },
  { fill: 'rgba(20,184,166,0.22)',  stroke: '#14b8a6', solid: '#14b8a6', label: '#5eead4' },
  { fill: 'rgba(236,72,153,0.22)',  stroke: '#ec4899', solid: '#ec4899', label: '#f9a8d4' },
  { fill: 'rgba(34,211,238,0.22)',  stroke: '#22d3ee', solid: '#22d3ee', label: '#a5f3fc' },
];

// ── STATE ──
let loadedMaps = [];
let allKmlData = [];
let nextMapId = 0;
let activeMapFilter = null;
let generalView = false;
let selectedBlockKey = null;
let mobileZoomOnly = false;
let editingRecord = null;
let completionRecord = null;

let map, polygonLayerGroup;
let allBlockItems = [];
let polygonRefs = {};
let labelRefs = {};
let firstBlockSelected = false;

// ── CACHED DOM REFS ──
const $mapCount = document.getElementById('map-count');
const $totalCount = document.getElementById('total-count');
const $mapList = document.getElementById('map-list');
const $blockList = document.getElementById('block-list');
const $hudSelection = document.getElementById('hud-selection');
const $hudName = document.getElementById('hud-name');
const $dName = document.getElementById('d-name');
const $dRows = document.getElementById('d-rows');
const $dForm = document.getElementById('d-form');
const $dPublisher = document.getElementById('d-publisher');
const $dPublisherEnd = document.getElementById('d-publisher-end');
const $dPubEndLabel = document.getElementById('d-publisher-end-label');
const $dDateStart = document.getElementById('d-date-start');
const $dDateEnd = document.getElementById('d-date-end');
const $dSaveStatus = document.getElementById('d-save-status');
const $dBtnSave = document.getElementById('d-btn-save');
const $searchInput = document.getElementById('search-input');
const $fileUpload = document.getElementById('file-upload');
const $mapSelector = document.getElementById('map-selector');
const $selectorGrid = document.getElementById('selector-grid');
const $btnCambiarMapa = document.getElementById('btn-cambiar-mapa');
const $intro = document.getElementById('intro');
document.getElementById('selector-general').addEventListener('click', loadGeneralView);
const $mapEmptyState = document.getElementById('map-empty-state');
const $fileUploadEmpty = document.getElementById('file-upload-empty');
const $workflowToast = document.getElementById('workflow-toast');
const $workflowToastText = document.getElementById('workflow-toast-text');
const $themeToggle = document.getElementById('theme-toggle');

// ── THEME ──
function getPreferredTheme() {
  const saved = localStorage.getItem('mapview-theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mapview-theme', theme);
}
applyTheme(getPreferredTheme());
$themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
  syncMapLayer();
});

// ── ADMIN SYSTEM ──
const ADMIN_PASSWORD_DEFAULT = 'admin123';
let adminPassword = ADMIN_PASSWORD_DEFAULT;
let isAdmin = false;
let passwordFetched = false;

const $loginModal = document.getElementById('login-modal');
const $loginPassword = document.getElementById('login-password');
const $loginError = document.getElementById('login-error');
const $loginSubmit = document.getElementById('login-submit');
const $loginCancel = document.getElementById('login-cancel');
const $adminLoginBtn = document.getElementById('admin-login-btn');
const $adminLogoutBtn = document.getElementById('admin-logout-btn');

// Fetch password from Google Sheets
function fetchAdminPassword() {
  return sheetFetch(`${GOOGLE_SHEETS_URL}?action=getPassword`, 12000)
    .then(r => r.json())
    .then(data => {
      const clave = data.clave || data.password;
      if (clave) {
        adminPassword = clave.toString().trim();
      }
      passwordFetched = true;
    })
    .catch(() => {
      adminPassword = ADMIN_PASSWORD_DEFAULT;
      passwordFetched = true;
    });
}

function setAdminMode(active) {
  isAdmin = active;
  document.body.classList.toggle('is-admin', active);
  localStorage.setItem('mapview-admin', active ? '1' : '0');
  updateAdminUI();
  if (selectedBlockKey) renderDetailRecords();
}

function updateAdminUI() {
  const emptyBtn = document.querySelector('.map-empty-btn');
  if (emptyBtn) {
    emptyBtn.style.display = isAdmin ? '' : 'none';
  }
}

$adminLoginBtn.addEventListener('click', () => {
  $loginPassword.value = '';
  $loginError.classList.remove('show');
  $loginModal.classList.add('active');
  gsap.fromTo($loginModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.fromTo('.login-box', {
    opacity: 0,
    scale: 0.9,
    y: 12
  }, {
    opacity: 1,
    scale: 1,
    y: 0,
    duration: 0.45,
    ease: 'back.out(1.5)',
    delay: 0.05
  });
  setTimeout(() => $loginPassword.focus(), 200);
});

$adminLogoutBtn.addEventListener('click', () => {
  setAdminMode(false);
});

$loginCancel.addEventListener('click', () => {
  gsap.to('.login-box', {
    opacity: 0,
    scale: 0.92,
    y: 8,
    duration: 0.25,
    ease: 'power2.in'
  });
  gsap.to($loginModal, {
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => { $loginModal.classList.remove('active'); }
  });
});

$loginModal.addEventListener('click', (e) => {
  if (e.target === $loginModal) $loginModal.classList.remove('active');
});

$loginSubmit.addEventListener('click', () => {
  if (!passwordFetched) {
    $loginError.textContent = 'Verificando...';
    $loginError.classList.add('show');
    fetchAdminPassword().then(() => {
      checkLogin();
    });
    return;
  }
  checkLogin();
});

function checkLogin() {
  const entered = $loginPassword.value.trim();
  if (entered && entered === adminPassword) {
    setAdminMode(true);
    $loginModal.classList.remove('active');
    $loginError.classList.remove('show');
  } else {
    $loginError.textContent = 'Contraseña incorrecta. Intenta de nuevo.';
    $loginError.classList.add('show');
    $loginPassword.value = '';
    $loginPassword.focus();
  }
}

$loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $loginSubmit.click();
  if (e.key === 'Escape') $loginModal.classList.remove('active');
});

// Restore admin session
if (localStorage.getItem('mapview-admin') === '1') {
  setAdminMode(true);
}

// ── RECORDS MANAGER (admin) ──
const $recordsModal = document.getElementById('records-modal');
const $recordsList = document.getElementById('records-list');
const $recordsSearch = document.getElementById('records-search');
const $recordsCount = document.getElementById('records-count');
const $recordsAdminBtn = document.getElementById('records-admin-btn');
const $recordsClose = document.getElementById('records-close');

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

function openRecordsModal() {
  $recordsModal.classList.add('active');
  gsap.fromTo($recordsModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.fromTo('.records-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
  fetchRecords().then(() => renderRecordsList($recordsSearch.value.trim().toLowerCase()));
}

function closeRecordsModal() {
  gsap.to('.records-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($recordsModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => { $recordsModal.classList.remove('active'); }
  });
}

function renderRecordsList(filter) {
  filter = filter || '';
  const all = sheetRecords.filter(r => r.territorio);

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
    const map = r.mapName || 'Sin mapa';
    if (!groups[map]) groups[map] = [];
    groups[map].push(r);
  });

  let html = '';
  Object.keys(groups).sort().forEach(mapName => {
    const mapData = loadedMaps.find(m => m.name === mapName);
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

function deleteRecordFromList(btn) {
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
  const removed = sheetRecords.filter(matches);
  sheetRecords = sheetRecords.filter(r => !matches(r));
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
      sheetRecords = sheetRecords.concat(removed);
      saveRecordsToStorage();
      buildRecordsMap();
      refreshVisualsForTerritory(terr);
      renderRecordsList($recordsSearch.value.trim().toLowerCase());
      showWorkflowToast('No se pudo borrar. Intenta de nuevo.', '⚠️', 3500);
    });
}

// ── RENAME KML (admin) ──
const $renameModal = document.getElementById('rename-modal');
const $renameInput = document.getElementById('rename-input');
const $renameError = document.getElementById('rename-error');
const $renameCancel = document.getElementById('rename-cancel');
const $renameSubmit = document.getElementById('rename-submit');
let renameTargetIndex = -1;

function openRenameModal(kmlIndex) {
  const kml = allKmlData[kmlIndex];
  if (!kml) return;
  renameTargetIndex = kmlIndex;
  $renameInput.value = kml.fileName.replace(/\.(kml|xml)$/i, '');
  $renameError.classList.remove('show');
  $renameModal.classList.add('active');
  gsap.fromTo($renameModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.fromTo('.rename-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
  setTimeout(() => { $renameInput.focus(); $renameInput.select(); }, 200);
}

function closeRenameModal() {
  gsap.to('.rename-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($renameModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $renameModal.classList.remove('active');
      $renameModal.style.opacity = '';
      renameTargetIndex = -1;
    }
  });
}

$renameCancel.addEventListener('click', closeRenameModal);
$renameModal.addEventListener('click', (e) => {
  if (e.target === $renameModal) closeRenameModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $renameModal.classList.contains('active')) closeRenameModal();
});
$renameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $renameSubmit.click();
});
$renameSubmit.addEventListener('click', confirmRenameKml);

function confirmRenameKml() {
  if (renameTargetIndex === -1) return;
  const kml = allKmlData[renameTargetIndex];
  if (!kml) { closeRenameModal(); return; }

  const oldFileName = kml.fileName;
  const oldTitle = oldFileName.replace(/\.(kml|xml)$/i, '');
  const newTitle = $renameInput.value.trim();

  if (!newTitle) {
    $renameError.textContent = 'El título no puede estar vacío.';
    $renameError.classList.add('show');
    return;
  }
  const isDuplicate = allKmlData.some((k, i) =>
    i !== renameTargetIndex && k.fileName.replace(/\.(kml|xml)$/i, '').toLowerCase() === newTitle.toLowerCase()
  );
  if (isDuplicate) {
    $renameError.textContent = 'Ya existe un KML con ese título.';
    $renameError.classList.add('show');
    return;
  }

  const extMatch = oldFileName.match(/\.(kml|xml)$/i);
  const newFileName = newTitle + (extMatch ? extMatch[0] : '.kml');
  if (newFileName === oldFileName) { closeRenameModal(); return; }

  kml.fileName = newFileName;
  loadedMaps.forEach(m => {
    if ((m.fileName || m.name) === oldFileName || m.name === oldTitle) {
      m.name = newTitle;
      m.fileName = newFileName;
    }
  });
  sheetRecords.forEach(r => {
    if (r.mapName === oldTitle || r.mapName === oldFileName) r.mapName = newTitle;
  });
  saveKmlToStorage();
  saveRecordsToStorage();
  closeRenameModal();

  showWorkflowToast('Sincronizando título con la nube...', '☁️', 10000);

  saveKmlToSheet(newFileName, kml.blocks)
    .then(() => deleteKmlFromSheet(oldFileName))
    .then(() => {
      if (oldTitle !== oldFileName) return deleteKmlFromSheet(oldTitle);
    })
    .then(() => {
      const payload = JSON.stringify({ oldName: oldTitle, newName: newTitle });
      return fetch(`${GOOGLE_SHEETS_URL}?action=renameMapColumn&d=${encodeURIComponent(payload)}`)
        .then(r => r.json())
        .catch(() => null);
    })
    .then(() => showWorkflowToast(`Título actualizado a "${newTitle}" ✓`, '✏️', 3000))
    .catch(() => showWorkflowToast('Título actualizado localmente. Reintenta sincronizar.', '⚠️', 4000));

  renderMapList();
  renderBlockList();
  renderAllPolygons();
  updateStats();
  if (selectedBlockKey) {
    const poly = getPolygonRef(selectedBlockKey);
    const found = findBlockByKey(selectedBlockKey);
    if (poly && found) {
      const polyEl = poly.getElement();
      if (polyEl) {
        const visitStatus = getVisitStatusInfo(found.block.name);
        polyEl.style.fill = visitStatus.colors.fill;
        polyEl.style.stroke = '#ffffff';
        polyEl.classList.add('active-poly');
      }
    }
    const blockItem = document.querySelector(`.block-item[data-map-id="${selectedBlockKey.mapId}"][data-local-id="${selectedBlockKey.localId}"]`);
    if (blockItem) blockItem.classList.add('active');
    if (found) $hudName.textContent = `${found.mapData.name} — ${found.block.name}`;
  }
  if ($mapSelector.classList.contains('active')) openMapSelector();
  if ($recordsModal.classList.contains('active')) renderRecordsList($recordsSearch.value.trim().toLowerCase());
}

// ── KML PERSISTENCE (localStorage) ──
const KML_STORAGE_KEY = 'mapview-kml-data';
const KML_STORAGE_MAP_KEY = 'mapview-selected-map';
const PENDING_RECORDS_KEY = 'mapview-pending-records';
const RECORDS_STORAGE_KEY = 'mapview-records';

let sheetRecords = [];
let recordsMap = {};
let recordsLoaded = false;

function saveRecordsToStorage() {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(sheetRecords));
  } catch (e) {
    console.warn('[MapView] No se pudieron guardar registros en localStorage:', e);
  }
}

function loadRecordsFromStorage() {
  try {
    const data = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (data) {
      sheetRecords = JSON.parse(data);
      buildRecordsMap();
      recordsLoaded = true;

      return true;
    }
  } catch (e) {
    console.warn('[MapView] Error leyendo registros de localStorage:', e);
  }
  return false;
}

function fetchRecords(silent) {
  return sheetFetch(`${GOOGLE_SHEETS_URL}?action=getRecords`, 12000)
    .then(r => r.json())
    .then(data => {
      sheetRecords = Array.isArray(data) ? data : (data.records || []);
      buildRecordsMap();
      recordsLoaded = true;
      saveRecordsToStorage();

      // Siempre que llegan registros se recalculan los % que dependen de
      // ellos (badge, tarjeta "Vista general", reporte y lista de registros),
      // aunque la carga inicial ocurra en segundo plano.
      refreshRecordsDependentUI();

      if (silent) return;

      if (loadedMaps.length > 0) {
        renderAllPolygons();
        renderMapList();
        renderBlockList();
      }
      if (selectedBlockKey) {
        renderDetailRecords();
        reevaluateCompletionMode();
      }
    })
    .catch((err) => {
      console.warn('[MapView] Error al cargar registros de Google Sheets:', err);
      if (!recordsLoaded) {
        loadRecordsFromStorage();
        refreshRecordsDependentUI();
      }
      recordsLoaded = true;
    });
}

function refreshRecordsDependentUI() {
  updateStats();
  updateSelectorGeneralCard();
  const rm = document.getElementById('report-modal');
  if (rm && rm.classList.contains('active')) renderReportModal();
  if ($recordsModal && $recordsModal.classList.contains('active')) {
    renderRecordsList($recordsSearch.value.trim().toLowerCase());
  }
}

function buildRecordsMap() {
  recordsMap = {};
  sheetRecords.forEach(r => {
    const key = r.territorio ? normalizeTerritoryName(r.territorio) : '';
    if (!key) return;
    if (!recordsMap[key]) {
      recordsMap[key] = r;
    } else {
      const existing = recordsMap[key];
      const d1 = parseDateValue(existing.fecha_fin || existing.fecha_inicio);
      const d2 = parseDateValue(r.fecha_fin || r.fecha_inicio);
      if (d2 > d1) recordsMap[key] = r;
    }
  });
}

function parseDateValue(str) {
  if (!str) return 0;
  if (str instanceof Date) return str.getTime();
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d.getTime();
  const m = String(str).match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, a, b, c] = m;
    if (c.length === 2) c = '20' + c;
    d = new Date(Number(c), Number(b) - 1, Number(a));
    if (!isNaN(d.getTime())) return d.getTime();
    d = new Date(Number(c), Number(a) - 1, Number(b));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

function normalizeTerritoryName(name) {
  return name.replace(/(\s*\(\d+\))+\s*$/, '').toLowerCase().trim();
}

function formatRecordDate(str) {
  const ts = parseDateValue(str);
  if (!ts) return str ? String(str) : '';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toISODate(str) {
  if (!str) return '';
  const s = String(str).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (m) {
    const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const mo = months[m[1]];
    if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
  }
  const ts = parseDateValue(s);
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRecordForBlock(blockName) {
  return recordsMap[normalizeTerritoryName(blockName)] || null;
}

function getOpenRecordForBlock(blockName) {
  const rec = getRecordForBlock(blockName);
  if (!rec) return null;
  if (!(rec.fecha_inicio || '').trim()) return null;
  if ((rec.fecha_fin || '').trim()) return null;
  if (!toISODate(rec.fecha_inicio)) return null;
  return rec;
}

function composeFinishPublisher(startPub, endPub) {
  const s = (startPub || '').trim();
  const e = (endPub || '').trim();
  if (!s) return e;
  if (!e || e.toLowerCase() === s.toLowerCase()) return s;
  return s + ' / ' + e;
}

function getEditableRecords(blockName) {
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const target = normalizeTerritoryName(blockName);
  return sheetRecords.filter(r => {
    if (!r.territorio || normalizeTerritoryName(r.territorio) !== target) return false;
    const ts = parseDateValue(r.fecha_fin || r.fecha_inicio || '');
    if (!ts) return false;
    const d = new Date(ts);
    return d.getFullYear() === curYear && d.getMonth() === curMonth;
  });
}

function getAllRecordsForBlock(blockName) {
  const target = normalizeTerritoryName(blockName);
  return sheetRecords
    .filter(r => r.territorio && normalizeTerritoryName(r.territorio) === target)
    .sort((a, b) => parseDateValue(b.fecha_fin || b.fecha_inicio || '') - parseDateValue(a.fecha_fin || a.fecha_inicio || ''));
}

// ── VISIT STATUS COLORS ──
const STATUS_COLORS = {
  fresh:  { fill: 'rgba(16,185,129,0.28)', stroke: '#10b981', label: 'Reciente', css: '#10b981' },
  warning:{ fill: 'rgba(245,158,11,0.28)', stroke: '#f59e0b', label: '3 meses',  css: '#f59e0b' },
  alert:  { fill: 'rgba(239,68,68,0.28)',  stroke: '#ef4444', label: 'Sin visita', css: '#ef4444' }
};

function getVisitStatus(blockName) {
  const record = getRecordForBlock(blockName);
  if (!record) return 'alert';

  const dateStr = record.fecha_fin || record.fecha_inicio || '';
  if (!dateStr) return 'alert';

  const ts = parseDateValue(dateStr);
  if (!ts) return 'alert';

  const now = Date.now();
  const diffMs = now - ts;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'fresh';
  if (diffDays < 90) return 'fresh';
  if (diffDays < 120) return 'warning';
  return 'alert';
}

function getVisitStatusInfo(blockName) {
  const status = getVisitStatus(blockName);
  const record = getRecordForBlock(blockName);
  let lastDate = null;
  let visitIcon = null;
  if (record) {
    const dateStr = record.fecha_fin || record.fecha_inicio || '';
    if (dateStr) {
      const ts = parseDateValue(dateStr);
      if (ts) {
        lastDate = new Date(ts);
        const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
        if (diffDays < 90) {
          visitIcon = record.fecha_fin ? 'check' : 'question';
        }
      }
    }
  } else {
    visitIcon = 'alert';
  }
  return { status, colors: STATUS_COLORS[status], lastDate, visitIcon };
}

// ── REPORTE GENERAL DE TERRITORIOS ──
function getTerritoryProgress(record) {
  if (record && record.fecha_fin && String(record.fecha_fin).trim()) return 100;
  if (record && record.fecha_inicio && String(record.fecha_inicio).trim()) return 50;
  return 0;
}

function getProgressLabel(pct) {
  if (pct >= 100) return 'Completado';
  if (pct > 0) return 'En curso';
  return 'Sin trabajar';
}

function buildGeneralReport() {
  const source = allKmlData.length > 0 ? allKmlData : loadedMaps;
  const maps = source.map(m => {
    const groups = new Map();
    m.blocks.forEach(b => {
      const k = normalizeTerritoryName(b.name);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(b);
    });
    const territories = [...groups.values()].map(list => {
      const rep = list.find(b => b.name.trim().toLowerCase() === normalizeTerritoryName(b.name)) || list[0];
      const record = getRecordForBlock(rep.name);
      const pct = getTerritoryProgress(record);
      return { name: rep.name, pct, record };
    });
    territories.sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
    const worked = territories.filter(t => t.pct > 0);
    const pending = territories.filter(t => t.pct === 0);
    const avg = territories.length ? Math.round(territories.reduce((s, t) => s + t.pct, 0) / territories.length) : 0;
    return { name: m.name || (m.fileName || '').replace(/\.(kml|xml)$/i, ''), territories, worked, pending, avg };
  });
  const all = maps.flatMap(x => x.territories);
  const worked = all.filter(t => t.pct > 0);
  const pending = all.filter(t => t.pct === 0);
  const avg = all.length ? Math.round(all.reduce((s, t) => s + t.pct, 0) / all.length) : 0;
  const pctWorked = all.length ? Math.round(worked.length / all.length * 100) : 0;
  return { maps, total: all.length, worked, pending, avg, pctWorked };
}

function saveKmlToStorage() {
  try {
    localStorage.setItem(KML_STORAGE_KEY, JSON.stringify(allKmlData));
    if (activeMapFilter !== null) {
      const activeMap = loadedMaps.find(m => m.id === activeMapFilter);
      if (activeMap) localStorage.setItem(KML_STORAGE_MAP_KEY, activeMap.name);
    }
  } catch (e) {
    console.warn('No se pudieron guardar los KMLs en localStorage:', e);
  }
}

function loadKmlFromStorage() {
  try {
    const data = localStorage.getItem(KML_STORAGE_KEY);
    if (data) {
      allKmlData = JSON.parse(data);
      return allKmlData.length > 0;
    }
  } catch (e) {
    console.warn('Error leyendo KMLs de localStorage:', e);
  }
  return false;
}

function clearKmlStorage() {
  localStorage.removeItem(KML_STORAGE_KEY);
  localStorage.removeItem(KML_STORAGE_MAP_KEY);
}

function autoLoadSavedKmls() {
  if (loadKmlFromStorage()) {
    const savedMapName = localStorage.getItem(KML_STORAGE_MAP_KEY);
    let selectedIndex = 0;
    if (savedMapName) {
      const idx = allKmlData.findIndex(k => k.fileName.replace(/\.(kml|xml)$/i, '') === savedMapName);
      if (idx !== -1) selectedIndex = idx;
    }
    loadSelectedMap(selectedIndex);
    return true;
  }
  return false;
}

function deleteKmlData(fileName) {
  const base = fileName.replace(/\.(kml|xml)$/i, '').toLowerCase();
  allKmlData = allKmlData.filter(k => {
    const kBase = k.fileName.replace(/\.(kml|xml)$/i, '').toLowerCase();
    return k.fileName !== fileName && kBase !== base;
  });
  saveKmlToStorage();
}

// ── KML SHARED STORAGE (Google Sheets) ──
function fetchKmlsFromSheet() {

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
          allKmlData = sheetsKmls;
          saveKmlToStorage();
          const total = allKmlData.reduce((s, k) => s + k.blocks.length, 0);

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

function saveKmlToSheet(fileName, blocks) {
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

function saveAllKmlsToSheet() {
  if (!isAdmin || allKmlData.length === 0) return;
  showWorkflowToast('Sincronizando mapas con la nube...', '☁️', 10000);

  let chain = Promise.resolve();
  let saved = 0;
  let failed = 0;

  allKmlData.forEach(k => {
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

function deleteKmlFromSheet(fileName) {
  const d = JSON.stringify({ fileName: fileName });
  return fetch(`${GOOGLE_SHEETS_URL}?action=deleteKml&fileName=${encodeURIComponent(fileName)}&d=${encodeURIComponent(d)}`)
    .then(r => r.json())
    .catch(err => console.warn('[MapView] Error eliminando KML de Sheets:', err));
}

// ── DEBOUNCE UTILITY ──
function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── MAP INIT ──
const vistaEstandarDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19
});
const vistaEstandarLight = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19
});
const vistaSatelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri'
});

const initialTheme = getPreferredTheme();
const initialLayer = initialTheme === 'light' ? vistaEstandarLight : vistaSatelital;

map = L.map('map', {
  center: [19.211, -70.348],
  zoom: 15,
  layers: [initialLayer],
  zoomControl: true
});

const baseMaps = { "Estándar": vistaEstandarDark, "Satelital": vistaSatelital };
L.control.layers(baseMaps, null, { position: 'bottomleft', collapsed: false }).addTo(map);

function syncMapLayer() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'light') {
    map.addLayer(vistaEstandarLight);
    map.removeLayer(vistaSatelital);
    map.removeLayer(vistaEstandarDark);
  } else {
    map.addLayer(vistaSatelital);
    map.removeLayer(vistaEstandarLight);
    map.removeLayer(vistaEstandarDark);
  }
}

map.on('baselayerchange', (e) => {
  const container = document.getElementById('map-container');
  if (e.name === 'Satelital') container.classList.add('satellite-active');
  else container.classList.remove('satellite-active');
});

// ── LOCATION CONTROL ──
let userPositionMarker = null;
let userPositionCircle = null;
let watchId = null;
let locationActive = false;

const LocationControl = L.Control.extend({
  options: { position: 'bottomleft' },
  onAdd: function() {
    const container = L.DomUtil.create('div', 'leaflet-control-location');
    const btn = L.DomUtil.create('a', '', container);
    btn.href = '#';
    btn.title = 'Mostrar mi ubicación';
    btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3.5"/><line x1="8" y1="12.5" x2="8" y2="15"/><line x1="1" y1="8" x2="3.5" y2="8"/><line x1="12.5" y1="8" x2="15" y2="8"/></svg>';
    L.DomEvent.disableClickPropagation(btn);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLocation();
    });
    return container;
  }
});

new LocationControl().addTo(map);

function toggleLocation() {
  if (locationActive) {
    stopLocation();
  } else {
    startLocation();
  }
}

function startLocation() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización.');
    return;
  }

  const btn = document.querySelector('.leaflet-control-location a');
  btn.classList.add('loc-active');
  btn.title = 'Desactivar ubicación';

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      const accuracy = pos.coords.accuracy;

      if (!userPositionMarker) {
        const icon = L.divIcon({
          className: 'user-position-marker',
          html: '<div class="user-dot"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });
        userPositionMarker = L.marker(latlng, { icon: icon, zIndexOffset: 1000 }).addTo(map);
        userPositionCircle = L.circle(latlng, {
          radius: accuracy,
          color: 'rgba(59,130,246,0.25)',
          fillColor: 'rgba(59,130,246,0.08)',
          fillOpacity: 0.3,
          weight: 1
        }).addTo(map);
        map.setView(latlng, Math.max(map.getZoom(), 16));
      } else {
        userPositionMarker.setLatLng(latlng);
        userPositionCircle.setLatLng(latlng);
        userPositionCircle.setRadius(accuracy);
      }

      locationActive = true;
      checkPolygonAtPosition(latlng);
    },
    (err) => {
      const btn = document.querySelector('.leaflet-control-location a');
      btn.classList.remove('loc-active');
      btn.classList.add('loc-error');
      setTimeout(() => btn.classList.remove('loc-error'), 2000);
      stopLocation();

      if (err.code === 1) {
        alert('Permiso de ubicación denegado. Activa la ubicación en la configuración de tu navegador.');
      } else if (err.code === 2) {
        alert('Ubicación no disponible. Verifica tu conexión GPS.');
      } else {
        alert('Tiempo de espera agotado para obtener la ubicación.');
      }
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function stopLocation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  locationActive = false;
  lastAutoSelectedKey = null;

  if (userPositionMarker) {
    map.removeLayer(userPositionMarker);
    userPositionMarker = null;
  }
  if (userPositionCircle) {
    map.removeLayer(userPositionCircle);
    userPositionCircle = null;
  }

  const btn = document.querySelector('.leaflet-control-location a');
  if (btn) {
    btn.classList.remove('loc-active');
    btn.title = 'Mostrar mi ubicación';
  }
}

let lastAutoSelectedKey = null;

function checkPolygonAtPosition(latlng) {
  const point = L.latLng(latlng);

  for (const mapData of loadedMaps) {
    if (!mapData.visible) continue;
    for (const block of mapData.blocks) {
      const polygon = L.polygon(block.latlngs);
      const bounds = polygon.getBounds();

      if (bounds.contains(point)) {
        const key = { mapId: mapData.id, localId: block.localId };
        const keyStr = `${key.mapId}-${key.localId}`;

        if (lastAutoSelectedKey === keyStr) return;

        const edges = block.latlngs;
        if (isPointInPolygon(point, edges)) {
          lastAutoSelectedKey = keyStr;
          selectBlock(key);
          autoCloseSidebar();
          showWorkflowToast(`Estás dentro de "${block.name}". Completa el registro.`, '📍', 5000);
          return;
        }
      }
    }
  }
}

function isPointInPolygon(point, polygon) {
  let inside = false;
  const x = point.lat, y = point.lng;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

polygonLayerGroup = L.layerGroup().addTo(map);

// ── PARSING ──
function parseCoordsToLeaflet(str) {
  return str.trim().split(/\s+/).map(t => {
    const [lng, lat] = t.split(',').map(Number);
    return [lat, lng];
  });
}

function parseKMLBlocks(text) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  const placemarks = xmlDoc.getElementsByTagName("Placemark");
  let blocks = [];
  for (let i = 0; i < placemarks.length; i++) {
    const p = placemarks[i];
    const nameEl = p.getElementsByTagName("name")[0];
    const coordEl = p.getElementsByTagName("coordinates")[0];
    if (coordEl) {
      let name = nameEl ? nameEl.textContent.trim() : `Bloque ${i+1}`;
      let coordsText = coordEl.textContent.trim();
      let formattedCoords = coordsText
        .replace(/,0\s+/g, ' ').replace(/,0$/g, '')
        .split(/\s+/).map(c => { let p = c.split(','); return `${p[0]},${p[1]}`; }).join(' ');
      blocks.push({ name, coords: formattedCoords });
    }
  }
  return blocks;
}

// ── MAP MANAGEMENT ──
function addMap(fileName, kmlBlocks) {
  const color = MAP_COLORS[loadedMaps.length % MAP_COLORS.length];
  const mapData = {
    id: nextMapId++,
    name: fileName.replace(/\.(kml|xml)$/i, ''),
    fileName: fileName,
    color: color,
    visible: true,
    blocks: kmlBlocks.map((b, i) => ({
      localId: i,
      name: b.name,
      latlngs: parseCoordsToLeaflet(b.coords)
    }))
  };
  loadedMaps.push(mapData);
  if (!generalView) activeMapFilter = mapData.id;
  recordsReady.then(() => {
    renderAll();
  });
  return mapData;
}

function removeMap(mapId) {
  loadedMaps = loadedMaps.filter(m => m.id !== mapId);
  if (activeMapFilter === mapId) activeMapFilter = loadedMaps.length > 0 ? loadedMaps[0].id : null;
  if (selectedBlockKey && selectedBlockKey.mapId === mapId) deselectBlock();
  recordsReady.then(() => renderAll());
}

function toggleMapVisibility(mapId) {
  const m = loadedMaps.find(m => m.id === mapId);
  if (m) {
    m.visible = !m.visible;
    recordsReady.then(() => renderAll());
  }
}

function selectMapFilter(mapId) {
  activeMapFilter = (activeMapFilter === mapId && loadedMaps.length > 1) ? null : mapId;
  renderMapList();
  renderBlockList();
}

// ── RENDERING ──
function renderAll() {
  renderAllPolygons();
  renderMapList();
  renderBlockList();
  updateStats();
  fitAllBounds();
  resetDetail();
}

function polygonCentroid(pts) {
  let a = 0, cx = 0, cy = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const cross = p1[0] * p2[1] - p2[0] * p1[1];
    a += cross;
    cx += (p1[0] + p2[0]) * cross;
    cy += (p1[1] + p2[1]) * cross;
  }
  if (Math.abs(a) < 1e-12) return null;
  return [cx / (3 * a), cy / (3 * a)];
}

function pointInPolygon(pt, poly) {
  const x = pt[1], y = pt[0];
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][1], yi = poly[i][0];
    const xj = poly[j][1], yj = poly[j][0];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function distToSegment2(p, a, b) {
  const dx = b[1] - a[1], dy = b[0] - a[0];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[1] - a[1]) * dx + (p[0] - a[0]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const ex = a[1] + t * dx - p[1], ey = a[0] + t * dy - p[0];
  return Math.sqrt(ex * ex + ey * ey);
}

function minEdgeDistance(p, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distToSegment2(p, poly[i], poly[j]);
    if (d < m) m = d;
  }
  return m;
}

function getPolygonInteriorPoint(latlngs) {
  if (!latlngs || latlngs.length === 0) return [0, 0];
  if (latlngs.length < 3) return latlngs[0];
  const c = polygonCentroid(latlngs);
  if (c && pointInPolygon(c, latlngs)) return c;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  latlngs.forEach(p => {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  });
  let best = null, bestD = -1;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const p = [minLat + (maxLat - minLat) * i / N, minLng + (maxLng - minLng) * j / N];
      if (!pointInPolygon(p, latlngs)) continue;
      const d = minEdgeDistance(p, latlngs);
      if (d > bestD) { bestD = d; best = p; }
    }
  }
  if (best) return best;
  if (c) return c;
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}

function buildCenterLabelHtml(visitIcon, vc, name, iconPx) {
  const fs = Math.max(8, Math.round(iconPx * 0.56));
  const base = `width:${iconPx}px;height:${iconPx}px;font-size:${fs}px;`;
  let badge;
  if (visitIcon === 'check') {
    badge = `<span class="plc-icon" style="${base}background:#10b981;color:#fff;" title="Con fecha de finalización">✓</span>`;
  } else if (visitIcon === 'question') {
    badge = `<span class="plc-icon" style="${base}background:#f59e0b;color:#000;" title="Sin fecha de finalización">?</span>`;
  } else if (visitIcon === 'alert') {
    badge = `<span class="plc-icon" style="${base}background:#ef4444;color:#fff;" title="Sin trabajar">!</span>`;
  } else {
    badge = `<span class="plc-icon" style="${base}visibility:hidden;"></span>`;
  }
  return `<div class="plc-stack">${badge}<span class="plc-name" style="color:${vc.stroke}">${name}</span></div>`;
}

function buildCenterLabelIcon(visitIcon, vc, name, iconPx) {
  return L.divIcon({
    className: 'map-label',
    html: buildCenterLabelHtml(visitIcon, vc, name, iconPx),
    iconSize: [140, iconPx + 24],
    iconAnchor: [70, Math.round(iconPx / 2)]
  });
}

function calcCenterIconPx(poly) {
  try {
    const b = poly.getBounds();
    const p1 = map.latLngToContainerPoint(b.getNorthEast());
    const p2 = map.latLngToContainerPoint(b.getSouthWest());
    const minDim = Math.min(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y));
    return Math.max(9, Math.min(18, Math.round(minDim * 0.4)));
  } catch (e) {
    return 14;
  }
}

function updateCenterLabelSizes() {
  for (const refKey in labelRefs) {
    const info = labelRefs[refKey];
    if (!info.poly) continue;
    const iconPx = calcCenterIconPx(info.poly);
    if (iconPx === info.size) continue;
    info.size = iconPx;
    info.marker.setIcon(buildCenterLabelIcon(info.visitIcon, info.vc, info.name, iconPx));
  }
}

function restoreSelectionStyles() {
  if (!selectedBlockKey) return;
  const found = findBlockByKey(selectedBlockKey);
  if (found) {
    const poly = getPolygonRef(selectedBlockKey);
    const el = poly && poly.getElement();
    if (el) {
      const v = getVisitStatusInfo(found.block.name);
      el.style.fill = v.colors.fill;
      el.style.stroke = '#ffffff';
      el.classList.add('active-poly');
    }
  }
  document.querySelectorAll('.block-item.active').forEach(el => el.classList.remove('active'));
  const item = document.querySelector(`.block-item[data-map-id="${selectedBlockKey.mapId}"][data-local-id="${selectedBlockKey.localId}"]`);
  if (item) item.classList.add('active');
}

function polygonTooltipHtml(blockName, mapName, vc, visitInfo) {
  let content = `<div style="font-weight:600;margin-bottom:2px;">${blockName}</div>`;
  content += `<div style="font-size:0.6rem;opacity:0.7;">${mapName}</div>`;
  const statusDot = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${vc.css};margin-right:4px;vertical-align:middle;"></span>`;
  content += `<div style="margin-top:3px;padding-top:3px;border-top:1px solid rgba(255,255,255,0.15);font-size:0.58rem;color:${vc.css};">${statusDot}${vc.label}</div>`;
  if (visitInfo.lastDate) {
    const displayDate = visitInfo.lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    content += `<div style="font-size:0.55rem;opacity:0.6;margin-top:1px;">Ultima visita: ${displayDate}</div>`;
  } else {
    content += `<div style="font-size:0.55rem;opacity:0.6;margin-top:1px;">Sin registro de visita</div>`;
  }
  return content;
}

function renderAllPolygons() {
  polygonLayerGroup.clearLayers();
  polygonRefs = {};
  labelRefs = {};
  const layers = [];

  loadedMaps.forEach(mapData => {
    if (!mapData.visible) return;
    const c = mapData.color;

    mapData.blocks.forEach(block => {
      const visitInfo = getVisitStatusInfo(block.name);
      const vc = visitInfo.colors;

      const polygon = L.polygon(block.latlngs, {
        className: 'custom-poly',
        fillColor: vc.fill,
        fillOpacity: 0.28,
        color: vc.stroke,
        weight: 1.5
      });
      polygon._visitStatus = visitInfo.status;
      polygon._visitIcon = visitInfo.visitIcon;
      polygon.setStyle({ fillColor: vc.fill, fillOpacity: 0.28, color: vc.stroke, weight: 1.5 });
      requestAnimationFrame(() => {
        const el = polygon.getElement();
        if (el) {
          el.style.fill = vc.fill;
          el.style.stroke = vc.stroke;
          el.style.strokeWidth = '1.5';
          el.style.fillOpacity = '0.28';
        }
      });
      const blockName = block.name;
      const mapName = mapData.name;
      polygon.bindTooltip(function() {
        return polygonTooltipHtml(blockName, mapName, vc, visitInfo);
      }, { sticky: true, className: 'custom-tooltip', direction: 'top', opacity: 1 });
      polygon.on('click', () => {
        const key = { mapId: mapData.id, localId: block.localId };
        const isSame = selectedBlockKey && selectedBlockKey.mapId === key.mapId && selectedBlockKey.localId === key.localId;

        if (isMobile() || isTablet()) {
          if (isSame && mobileZoomOnly) {
            mobileZoomOnly = false;
            selectBlock(key);
            return;
          }
          if (isSame) {
            selectBlock(null);
            mobileZoomOnly = false;
            return;
          }

          if (selectedBlockKey) {
            const prevPoly = getPolygonRef(selectedBlockKey);
            if (prevPoly) {
              const prevFound = findBlockByKey(selectedBlockKey);
              const polyEl = prevPoly.getElement();
              if (polyEl && prevFound) {
                const prevVisit = getVisitStatusInfo(prevFound.block.name);
                polyEl.style.fill = prevVisit.colors.fill;
                polyEl.style.stroke = prevVisit.colors.stroke;
                polyEl.classList.remove('active-poly');
              }
            }
          }

          selectedBlockKey = key;
          mobileZoomOnly = true;
          const polyEl = polygon.getElement();
          if (polyEl) {
            const visitStatus = getVisitStatusInfo(block.name);
            polyEl.style.fill = visitStatus.colors.fill;
            polyEl.style.stroke = '#ffffff';
            polyEl.classList.add('active-poly');
          }
          map.fitBounds(polygon.getBounds(), { padding: [80, 80], maxZoom: 19, animate: true, duration: 0.9, easeLinearity: 0.25 });
          const blockItem = document.querySelector(`.block-item[data-map-id="${key.mapId}"][data-local-id="${key.localId}"]`);
          if (blockItem) blockItem.classList.add('active');
          return;
        }

        selectBlock(isSame ? null : key);
      });
      layers.push(polygon);

      const refKey = `${mapData.id}-${block.localId}`;
      polygonRefs[refKey] = polygon;

      const center = getPolygonInteriorPoint(block.latlngs);
      const iconPx = calcCenterIconPx(polygon);
      const labelMarker = L.marker(center, {
        interactive: false,
        keyboard: false,
        icon: buildCenterLabelIcon(visitInfo.visitIcon, vc, block.name, iconPx)
      });
      layers.push(labelMarker);
      labelRefs[refKey] = {
        marker: labelMarker,
        name: block.name,
        mapName: mapData.name,
        color: vc.stroke,
        poly: polygon,
        visitIcon: visitInfo.visitIcon,
        vc: vc,
        size: iconPx
      };
    });
  });

  layers.forEach(l => l.addTo(polygonLayerGroup));
  requestAnimationFrame(restoreSelectionStyles);
}

function updatePolygonColors() {
  let changed = false;
  for (const refKey in polygonRefs) {
    const polygon = polygonRefs[refKey];
    if (!polygon) continue;
    const dashIdx = refKey.indexOf('-');
    const mapId = Number(refKey.substring(0, dashIdx));
    const localId = Number(refKey.substring(dashIdx + 1));
    const mapData = loadedMaps.find(m => m.id === mapId);
    if (!mapData) continue;
    const block = mapData.blocks.find(b => b.localId === localId);
    if (!block) continue;

    const visitInfo = getVisitStatusInfo(block.name);
    const vc = visitInfo.colors;
    const prev = polygon._visitStatus;
    const prevIcon = polygon._visitIcon;
    const iconChanged = prevIcon !== visitInfo.visitIcon;
    if (prev === visitInfo.status && !iconChanged) continue;
    changed = true;

    polygon._visitStatus = visitInfo.status;
    polygon._visitIcon = visitInfo.visitIcon;
    polygon.setStyle({ fillColor: vc.fill, fillOpacity: 0.28, color: vc.stroke, weight: 1.5 });
    const el = polygon.getElement();
    if (el) {
      el.style.fill = vc.fill;
      el.style.stroke = vc.stroke;
    }
    const labelInfo = labelRefs[refKey];
    if (labelInfo) {
      labelInfo.visitIcon = visitInfo.visitIcon;
      labelInfo.vc = vc;
      labelInfo.marker.setIcon(buildCenterLabelIcon(visitInfo.visitIcon, vc, block.name, labelInfo.size || 14));
    }
    const blockName = block.name;
    const mapName = mapData.name;
    polygon.setTooltipContent(polygonTooltipHtml(blockName, mapName, vc, visitInfo));
  }
  if (changed) {
    renderBlockList();
    renderMapList();
    updateStats();
    requestAnimationFrame(restoreSelectionStyles);
  }
}

function refreshBlockVisual(mapId, localId) {
  const refKey = `${mapId}-${localId}`;
  const polygon = polygonRefs[refKey];
  const mapData = loadedMaps.find(m => m.id === mapId);
  const block = mapData && mapData.blocks.find(b => b.localId === localId);

  if (block && polygon) {
    const visitInfo = getVisitStatusInfo(block.name);
    const vc = visitInfo.colors;
    polygon._visitStatus = visitInfo.status;
    polygon._visitIcon = visitInfo.visitIcon;
    polygon.setStyle({ fillColor: vc.fill, fillOpacity: 0.28, color: vc.stroke, weight: 1.5 });
    const el = polygon.getElement();
    if (el) {
      el.style.fill = vc.fill;
      el.style.stroke = vc.stroke;
    }
    polygon.setTooltipContent(polygonTooltipHtml(block.name, mapData.name, vc, visitInfo));
    const labelInfo = labelRefs[refKey];
    if (labelInfo) {
      labelInfo.visitIcon = visitInfo.visitIcon;
      labelInfo.vc = vc;
      labelInfo.marker.setIcon(buildCenterLabelIcon(visitInfo.visitIcon, vc, block.name, labelInfo.size || 14));
    }
  }

  const item = document.querySelector(`.block-item[data-map-id="${mapId}"][data-local-id="${localId}"]`);
  if (item && block) {
    const pip = item.querySelector('.block-color-pip');
    if (pip) pip.style.background = getVisitStatusInfo(block.name).colors.css;
  }

  renderMapList(true);
  updateStats();
  if (selectedBlockKey) renderDetailRecords();
  requestAnimationFrame(restoreSelectionStyles);
}

function refreshVisualsForTerritory(territorio) {
  const key = normalizeTerritoryName(territorio || '');
  let matched = false;
  if (key) {
    loadedMaps.forEach(m => {
      m.blocks.forEach(b => {
        if (normalizeTerritoryName(b.name) === key) {
          matched = true;
          refreshBlockVisual(m.id, b.localId);
        }
      });
    });
  }
  if (!matched) {
    renderMapList(true);
    updateStats();
    if (selectedBlockKey) renderDetailRecords();
  }
}

setInterval(updatePolygonColors, 60000);
map.on('zoomend', updateCenterLabelSizes);

function renderMapList(skipAnimation) {
  const list = $mapList;

  if (loadedMaps.length === 0) {
    list.innerHTML = `
      <div class="map-empty">
        No hay mapas cargados
        <br>
        <label for="file-upload-sidebar" class="map-empty-btn-sidebar admin-only" style="display:none;">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.5 10v2.5a1 1 0 001 1h9a1 1 0 001-1V10"/>
            <polyline points="5 6 8 3 11 6"/>
            <line x1="8" y1="3" x2="8" y2="10"/>
          </svg>
          Cargar KML
        </label>
        <input type="file" id="file-upload-sidebar" accept=".kml,.xml" multiple style="display:none">
      </div>`;
    if (isAdmin) {
      const label = list.querySelector('.map-empty-btn-sidebar');
      if (label) label.style.display = '';
    }
    return;
  }

  list.innerHTML = '';
  const fragment = document.createDocumentFragment();
  loadedMaps.forEach(m => {
    let freshCount = 0, warnCount = 0, alertCount = 0;
    m.blocks.forEach(b => {
      const s = getVisitStatus(b.name);
      if (s === 'fresh') freshCount++;
      else if (s === 'warning') warnCount++;
      else alertCount++;
    });
    const item = document.createElement('div');
    item.className = `map-item${m.visible ? ' visible' : ''}${activeMapFilter === m.id ? ' selected' : ''}`;
    item.innerHTML = `
      <div class="map-color-dot" style="background:${m.color.solid}; color:${m.color.solid}"></div>
      <div class="map-item-info">
        <div class="map-item-name">${m.name}</div>
        <div class="map-item-count">
          ${m.blocks.length} bloques
          <span class="map-status-summary">
            ${freshCount > 0 ? `<span style="color:#10b981;">${freshCount}</span>` : ''}
            ${warnCount > 0 ? `<span style="color:#f59e0b;">${warnCount}</span>` : ''}
            ${alertCount > 0 ? `<span style="color:#ef4444;">${alertCount}</span>` : ''}
          </span>
        </div>
      </div>
      <button class="map-rename-btn" data-map-rename="${m.id}" title="Editar título">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
      </button>
      <button class="map-delete-btn" data-map-delete="${m.id}" title="Eliminar mapa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <button class="map-toggle ${m.visible ? 'on' : ''}" data-map-toggle="${m.id}" title="${m.visible ? 'Ocultar' : 'Mostrar'}"></button>
    `;

    item.querySelector('.map-item-info').addEventListener('click', () => selectMapFilter(m.id));

    item.querySelector('.map-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMapVisibility(m.id);
    });

    const deleteBtn = item.querySelector('.map-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`¿Eliminar el mapa "${m.name}" y todos sus bloques?\n\nTambién se borrará de Google Sheets.`)) {
        const fileName = m.fileName || m.name;
        deleteKmlFromSheet(fileName);
        if (m.fileName && m.fileName !== m.name) deleteKmlFromSheet(m.name);
        deleteKmlData(fileName);
        if (m.fileName && m.fileName !== m.name) deleteKmlData(m.name);
        removeMap(m.id);
        saveKmlToStorage();
        showWorkflowToast(`Mapa "${m.name}" eliminado ✓`, '🗑️', 3000);
      }
    });

    const renameBtn = item.querySelector('.map-rename-btn');
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileName = m.fileName || m.name;
      const idx = allKmlData.findIndex(k =>
        k.fileName === fileName ||
        k.fileName.replace(/\.(kml|xml)$/i, '') === m.name
      );
      if (idx === -1) {
        showWorkflowToast('No se encontró el KML para editar', '⚠️', 3000);
        return;
      }
      openRenameModal(idx);
    });

    fragment.appendChild(item);
  });
  list.appendChild(fragment);

  if (!skipAnimation) {
    gsap.fromTo($mapList.querySelectorAll('.map-item'), {
      opacity: 0,
      x: -8
    }, {
      opacity: 1,
      x: 0,
      duration: 0.35,
      stagger: 0.04,
      ease: 'power3.out'
    });
  }
}

function renderBlockList() {
  const list = $blockList;
  list.innerHTML = '';
  allBlockItems = [];

  const sourceMaps = loadedMaps.filter(m => m.visible && (!activeMapFilter || m.id === activeMapFilter));

  if (sourceMaps.length === 0) {
    list.innerHTML = '<div class="map-empty" style="padding:1.5rem 1rem;">Selecciona un polígono en el mapa o usa la lista de arriba</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  let idx = 0;
  const showMapTags = loadedMaps.length > 1 && !activeMapFilter;
  sourceMaps.forEach(mapData => {
    mapData.blocks.forEach(block => {
      const key = { mapId: mapData.id, localId: block.localId };
      const isActive = selectedBlockKey && selectedBlockKey.mapId === key.mapId && selectedBlockKey.localId === key.localId;

      const item = document.createElement('div');
      item.className = `block-item${isActive ? ' active' : ''}`;
      item.dataset.mapId = key.mapId;
      item.dataset.localId = key.localId;
      item.dataset.name = block.name.toLowerCase();
      item.dataset.searchText = `${mapData.name} ${block.name}`.toLowerCase();
      const visitInfo = getVisitStatusInfo(block.name);
      item.innerHTML = `
        <div class="block-color-pip" style="background:${visitInfo.colors.css}"></div>
        <span class="num">${String(idx+1).padStart(2,'0')}</span>
        <span class="name">${block.name}${showMapTags ? `<em class="block-map-tag" style="color:${mapData.color.solid}">${mapData.name}</em>` : ''}</span>
        <span class="arrow">›</span>
      `;
      item.addEventListener('click', () => {
        const isSame = selectedBlockKey && selectedBlockKey.mapId === key.mapId && selectedBlockKey.localId === key.localId;
        selectBlock(isSame ? null : key);
      });
      fragment.appendChild(item);
      allBlockItems.push(item);
      idx++;
    });
  });
  list.appendChild(fragment);

  const blockItems = $blockList.querySelectorAll('.block-item');
  gsap.fromTo(blockItems, {
    opacity: 0,
    x: -12
  }, {
    opacity: 1,
    x: 0,
    duration: 0.4,
    stagger: Math.min(0.03, 0.5 / Math.max(blockItems.length, 1)),
    ease: 'power3.out'
  });
}

// Sidebar upload button delegation
$mapList.addEventListener('click', (e) => {
  const label = e.target.closest('.map-empty-btn-sidebar');
  if (!label) return;
  e.preventDefault();
  $fileUpload.click();
});

function updateStats() {
  const totalBlocks = loadedMaps.reduce((sum, m) => sum + m.blocks.length, 0);
  $mapCount.textContent = loadedMaps.length;
  $totalCount.textContent = totalBlocks;

  if (loadedMaps.length > 0 || allKmlData.length > 0) {
    $mapEmptyState.classList.add('hidden');
  } else {
    $mapEmptyState.classList.remove('hidden');
  }

  updateGeneralBadge();
}

function updateGeneralBadge() {
  const badge = document.getElementById('general-badge');
  if (!badge) return;
  if (!generalView) {
    badge.style.display = 'none';
    return;
  }
  const report = buildGeneralReport();
  const pct = report.pctWorked;
  const pctEl = document.getElementById('gb-pct');
  pctEl.textContent = pct + '%';
  pctEl.style.color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  document.getElementById('gb-bar-fill').style.width = pct + '%';
  document.getElementById('gb-sub').textContent = `${report.worked.length}/${report.total} territorios · Avance ${report.avg}%`;
  badge.style.display = 'flex';
}

function updateSelectorGeneralCard() {
  const $sgGeneral = document.getElementById('selector-general');
  if (!$sgGeneral) return;
  if (allKmlData.length > 1) {
    const r = buildGeneralReport();
    const pct = r.pctWorked;
    const pctEl = document.getElementById('selector-general-pct');
    pctEl.textContent = pct + '%';
    pctEl.style.color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
    document.getElementById('selector-general-bar-fill').style.width = pct + '%';
    document.getElementById('selector-general-desc').textContent =
      `${allKmlData.length} mapas · ${r.total} territorios · ${r.worked.length} trabajados · avance ${r.avg}%`;
    $sgGeneral.style.display = 'flex';
  } else {
    $sgGeneral.style.display = 'none';
  }
}

function fitAllBounds() {
  const bounds = L.latLngBounds();
  loadedMaps.forEach(m => {
    if (!m.visible) return;
    m.blocks.forEach(b => b.latlngs.forEach(pt => bounds.extend(pt)));
  });
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
  }
}

// ── BLOCK SELECTION ──
function getPolygonRef(key) {
  return polygonRefs[`${key.mapId}-${key.localId}`] || null;
}

function findBlockByKey(key) {
  const m = loadedMaps.find(m => m.id === key.mapId);
  if (!m) return null;
  const b = m.blocks.find(b => b.localId === key.localId);
  if (!b) return null;
  return { mapData: m, block: b };
}

function renderDetailRecords() {
  if (!selectedBlockKey) return;
  const found = findBlockByKey(selectedBlockKey);
  if (!found) return;
  const { mapData, block } = found;

  $dName.textContent = block.name;
  const visitDetail = getVisitStatusInfo(block.name);
  let recordHtml = `
    <div class="detail-map-badge" style="color:${mapData.color.solid}; border: 1px solid ${mapData.color.solid}33; background: ${mapData.color.solid}15;">
      <div class="map-color-dot" style="background:${mapData.color.solid}; width:7px; height:7px;"></div>
      ${mapData.name}
    </div>
    <div class="detail-map-badge" style="color:${visitDetail.colors.css}; border: 1px solid ${visitDetail.colors.css}33; background: ${visitDetail.colors.css}15; margin-bottom:0.5rem;">
      <div class="map-color-dot" style="background:${visitDetail.colors.css}; width:7px; height:7px;"></div>
      ${visitDetail.colors.label}
    </div>`;
  if (visitDetail.lastDate) {
    const displayDate = visitDetail.lastDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    recordHtml += `
      <div class="detail-row">
        <span class="detail-key" style="color:${visitDetail.colors.css};">Ultima visita</span>
        <span class="detail-val" style="color:${visitDetail.colors.css};font-weight:600;">${displayDate}</span>
      </div>`;
  } else {
    recordHtml += `<span class="detail-empty" style="color:${visitDetail.colors.css};">Sin visita registrada</span>`;
  }
  if (!visitDetail.lastDate && !recordsLoaded) {
    recordHtml += '<span class="detail-empty" style="font-style:normal;color:var(--gold);">Conectando con Google Sheets...</span>';
  }

  const editableRecords = isAdmin ? getAllRecordsForBlock(block.name) : getEditableRecords(block.name);
  if (editableRecords.length > 0) {
    recordHtml += `<div class="detail-edit-section">`;
    if (editableRecords.length === 1) {
      const rec = editableRecords[0];
      const pub = rec.publicador || 'Sin publicador';
      const f = formatRecordDate(rec.fecha_fin || rec.fecha_inicio || '');
      recordHtml += `
        <div class="detail-edit-single">
          <span class="detail-edit-info">Registro: <strong>${pub}</strong>${f ? ' — ' + f : ''}</span>
          <div style="display:flex;gap:4px;">
            <button class="detail-edit-btn" onclick="startEditRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}')">
              Editar
            </button>
            <button class="detail-record-delete admin-only" onclick="deleteSingleRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}', '${(rec.territorio || '').replace(/'/g, "\\'")}')">
              Borrar
            </button>
          </div>
        </div>`;
    } else {
      const listLabel = isAdmin ? `Todos los registros (${editableRecords.length})` : `Varios registros este mes (${editableRecords.length})`;
      recordHtml += `<div class="detail-edit-multi"><span class="detail-edit-info">${listLabel}:</span><div class="detail-edit-list">`;
      editableRecords.forEach(rec => {
        const pub = rec.publicador || 'Sin publicador';
        const f = formatRecordDate(rec.fecha_fin || rec.fecha_inicio || '');
        recordHtml += `
          <div class="detail-record-row">
            <button class="detail-edit-btn detail-edit-option" onclick="startEditRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}')">
              ${pub}${f ? ' — ' + f : ''}
            </button>
            <button class="detail-record-delete admin-only" title="Borrar registro" onclick="deleteSingleRecord('${(rec.publicador || '').replace(/'/g, "\\'")}', '${(rec.fecha_inicio || '').replace(/'/g, "\\'")}', '${(rec.fecha_fin || '').replace(/'/g, "\\'")}', '${(rec.territorio || '').replace(/'/g, "\\'")}')">
              ✕
            </button>
          </div>`;
      });
      recordHtml += `</div></div>`;
    }
    recordHtml += `</div>`;
  }
  $dRows.innerHTML = recordHtml;
}

function selectBlock(key) {
  mobileZoomOnly = false;
  const hud = $hudSelection;

  if (selectedBlockKey) {
    const prevPoly = getPolygonRef(selectedBlockKey);
    if (prevPoly) {
      const prevFound = findBlockByKey(selectedBlockKey);
      const polyEl = prevPoly.getElement();
      if (polyEl && prevFound) {
        const prevVisit = getVisitStatusInfo(prevFound.block.name);
        polyEl.style.fill = prevVisit.colors.fill;
        polyEl.style.stroke = prevVisit.colors.stroke;
        polyEl.classList.remove('active-poly');
      }
    }
    document.querySelectorAll('.block-item.active').forEach(el => el.classList.remove('active'));
  }

  selectedBlockKey = key;

  if (key === null) {
    gsap.to(hud, {
      opacity: 0,
      y: -10,
      scale: 0.96,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => { hud.style.display = 'none'; }
    });
    resetDetail();
    return;
  }

  const found = findBlockByKey(key);
  if (!found) return;
  const { mapData, block } = found;

  const polygon = getPolygonRef(key);

  if (polygon) {
    const polyEl = polygon.getElement();
    if (polyEl) {
      const visitStatus = getVisitStatusInfo(block.name);
      polyEl.style.fill = visitStatus.colors.fill;
      polyEl.style.stroke = '#ffffff';
      polyEl.classList.add('active-poly');
    }
    map.fitBounds(polygon.getBounds(), { padding: [80, 80], maxZoom: 19, animate: true, duration: 0.9, easeLinearity: 0.25 });
  }

  const blockItem = document.querySelector(`.block-item[data-map-id="${key.mapId}"][data-local-id="${key.localId}"]`);
  if (blockItem) {
    blockItem.classList.add('active');
    blockItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  autoCloseSidebar();

  if (isMobile() || isTablet()) {
    setTimeout(() => {
      const detail = document.getElementById('detail');
      if (detail) detail.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 350);
  }

  if (!firstBlockSelected) {
    firstBlockSelected = true;
    setTimeout(() => {
      if (completionRecord) {
        showWorkflowToast('Este territorio ya tiene inicio: solo falta registrar la fecha de finalización', '📅', 5000);
      } else {
        showWorkflowToast('Completa los campos y presiona "Grabar en Google Sheets" para guardar', '📝', 5000);
      }
    }, 1500);
  }

  const center = block.latlngs.reduce(
    (acc, pt) => [acc[0] + pt[0], acc[1] + pt[1]],
    [0, 0]
  ).map(v => v / block.latlngs.length);
  const centerLatLng = { lat: center[0], lng: center[1] };

  $hudName.textContent = `${mapData.name} — ${block.name}`;
  hud.style.display = "block";
  gsap.fromTo(hud, {
    opacity: 0,
    y: -12,
    scale: 0.96
  }, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.5,
    ease: 'back.out(1.5)'
  });

  $dName.textContent = block.name;
  renderDetailRecords();

  $dForm.style.display = 'flex';
  gsap.fromTo($dForm, {
    opacity: 0,
    y: 12
  }, {
    opacity: 1,
    y: 0,
    duration: 0.45,
    ease: 'back.out(1.3)'
  });
  const existingLabel = $dForm.querySelector('.edit-mode-label');
  if (existingLabel) existingLabel.remove();
  exitCompletionMode();
  editingRecord = null;
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
  $dSaveStatus.className = 'save-status';
  $dSaveStatus.textContent = '';
  const openRec = getOpenRecordForBlock(block.name);
  if (openRec) enterCompletionMode(openRec);
}

function deselectBlock() {
  selectedBlockKey = null;
  $hudSelection.style.display = 'none';
  resetDetail();
}

function resetDetail() {
  if (completionRecord) exitCompletionMode();
  $dName.textContent = '—';
  $dRows.innerHTML = '<span class="detail-empty">Haz clic en un polígono para ver sus datos</span>';
  $dForm.style.display = 'none';
}

// ── GOOGLE SHEETS INTEGRATION ──
// Reemplaza esta URL con la de tu Google Apps Script desplegado como Web App.
// Ver instrucciones más abajo en los comentarios del código.
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw-WOLL5QBgohtvOo9he2ua9nn6Av9i4NFaymAM6_vpGQX50lkk7bRu-N4DiMw1-98/exec';

function getPendingRecords() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_RECORDS_KEY)) || [];
  } catch (e) { return []; }
}

function savePendingRecords(records) {
  try { localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

function queueRecord(payload) {
  const pending = getPendingRecords();
  pending.push(payload);
  savePendingRecords(pending);
}

function sheetFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 15000);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function syncPendingRecords() {
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

function updatePendingBadge() {
  const count = getPendingRecords().length;
  const badge = document.getElementById('pending-badge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function saveToSheet() {
  if (!selectedBlockKey) return;

  const found = findBlockByKey(selectedBlockKey);
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
  sheetRecords.push({
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

function updateRecord() {
  if (!selectedBlockKey || !editingRecord) return;

  const found = findBlockByKey(selectedBlockKey);
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
  const affected = sheetRecords.filter(r => (r.territorio || '') === territorio);
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

function startEditRecord(publisher, fechaInicio, fechaFin) {
  exitCompletionMode();
  editingRecord = { publicador: publisher, fecha_inicio: fechaInicio, fecha_fin: fechaFin };
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

function exitEditMode() {
  editingRecord = null;
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

// ── MODO COMPLETAR REGISTRO (solo falta fecha de finalización) ──
const SAVE_BTN_DEFAULT_HTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Grabar en Google Sheets`;
const SAVE_BTN_FINAL_HTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Guardar fecha finalización`;
const SAVE_BTN_UPDATE_HTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z"/>
      <path d="M5 8l2 2 4-4"/>
    </svg>
    Actualizar registro`;

function enterCompletionMode(rec) {
  if (!rec) return;
  completionRecord = rec;

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

function exitCompletionMode() {
  completionRecord = null;
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

function clearCompletionState() {
  exitCompletionMode();
  exitEditMode();
  const lbl = $dForm.querySelector('.completion-mode-label');
  if (lbl) lbl.remove();
}

function reevaluateCompletionMode() {
  if (!selectedBlockKey || completionRecord || editingRecord) return;
  if ($dForm.style.display === 'none') return;
  if ($dPublisher.value || $dPublisherEnd.value || $dDateStart.value || $dDateEnd.value) return;
  const found = findBlockByKey(selectedBlockKey);
  if (!found) return;
  const openRec = getOpenRecordForBlock(found.block.name);
  if (openRec) enterCompletionMode(openRec);
}

function completeRecord() {
  if (!selectedBlockKey || !completionRecord) return;

  const found = findBlockByKey(selectedBlockKey);
  if (!found) return;
  const { mapData } = found;

  const rec = completionRecord;
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
    sheetRecords = sheetRecords.filter(r2 => !(
      (r2.territorio || '') === delPayload.territorio &&
      (r2.publicador || '') === delPayload.publicador &&
      (r2.fecha_inicio || '') === delPayload.fechaInicio &&
      (r2.fecha_fin || '') === delPayload.fechaFin
    ));
    sheetRecords.push({
      publicador: addPayload.publicador,
      territorio: addPayload.territorio,
      mapName: addPayload.mapName,
      fecha_inicio: addPayload.fechaInicio,
      fecha_fin: dateEnd
    });
    buildRecordsMap();
    saveRecordsToStorage();
    refreshBlockVisual(found.mapData.id, found.block.localId);
    if (selectedBlockKey) renderDetailRecords();
  }

  // Aplicación local inmediata: el cierre se refleja al instante en la
  // interfaz (polígono, stats y %) sin esperar los 2 round-trips a Sheets.
  const prevRecords = sheetRecords.slice();
  applyLocalCompletion();
  statusEl.textContent = 'Guardando en Google Sheets...';

  function rollbackLocalCompletion() {
    sheetRecords = prevRecords.slice();
    buildRecordsMap();
    saveRecordsToStorage();
    refreshBlockVisual(found.mapData.id, found.block.localId);
    if (selectedBlockKey) renderDetailRecords();
  }

  attemptDelete(2)
    .then(deleted => {
      if (!deleted) {
        rollbackLocalCompletion();
        if (completionRecord === rec) {
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
      const stillActive = completionRecord === rec;
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
      if (completionRecord === rec) {
        statusEl.className = 'save-status error';
        statusEl.textContent = 'Error al guardar. Intenta de nuevo.';
      }
    })
    .finally(() => {
      btn.disabled = false;
      if (completionRecord) {
        btn.innerHTML = SAVE_BTN_FINAL_HTML;
      } else if (!editingRecord) {
        btn.innerHTML = SAVE_BTN_DEFAULT_HTML;
      }
    });
}

function deleteSingleRecord(publicador, fechaInicio, fechaFin, territorio) {
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
  const removed = sheetRecords.filter(matches);
  sheetRecords = sheetRecords.filter(r => !matches(r));
  saveRecordsToStorage();
  buildRecordsMap();
  if (selectedBlockKey) refreshBlockVisual(selectedBlockKey.mapId, selectedBlockKey.localId);

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
        if (completionRecord &&
            (completionRecord.territorio || '') === territorio &&
            (completionRecord.publicador || '') === publicador &&
            (completionRecord.fecha_inicio || '') === fechaInicio &&
            (completionRecord.fecha_fin || '') === fechaFin) {
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
      sheetRecords = sheetRecords.concat(removed);
      saveRecordsToStorage();
      buildRecordsMap();
      if (selectedBlockKey) refreshBlockVisual(selectedBlockKey.mapId, selectedBlockKey.localId);
      statusEl.className = 'save-status error';
      statusEl.textContent = 'No se pudo borrar. Intenta de nuevo.';
    });
}

/*
 * ══════════════════════════════════════════════════════════════
 *  INSTRUCCIONES: Google Apps Script para Google Sheets
 * ══════════════════════════════════════════════════════════════
 *
 * 1. Abre Google Sheets y crea una hoja nueva (o usa una existente).
 *
 * 2. Ve a Extensiones > Apps Script.
 *
 * 3. Borra el contenido por defecto y pega este código:
 *
 *    function doPost(e) {
 *      var raw = e.postData ? e.postData.contents : e.parameter.postData;
 *      var data = JSON.parse(raw);
 *
 *      if (data.action === 'saveKml') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var kmlSheet = ss.getSheetByName('KMLs');
 *        if (!kmlSheet) kmlSheet = ss.insertSheet('KMLs');
 *
 *        if (kmlSheet.getLastRow() === 0) {
 *          kmlSheet.appendRow(['fileName', 'blockName', 'coords']);
 *        }
 *
 *        var allData = kmlSheet.getDataRange().getValues();
 *        var keepRows = [];
 *        for (var i = 1; i < allData.length; i++) {
 *          if (allData[i][0] !== data.fileName) {
 *            keepRows.push(allData[i]);
 *          }
 *        }
 *
 *        data.blocks.forEach(function(block) {
 *          keepRows.push([data.fileName, block.name, block.coords]);
 *        });
 *
 *        kmlSheet.deleteRows(2, kmlSheet.getLastRow() - 1);
 *        if (keepRows.length > 0) {
 *          kmlSheet.getRange(2, 1, keepRows.length, 3).setValues(keepRows);
 *        }
 *
 *        var regSheet = ss.getSheetByName('Registros');
 *        if (regSheet && regSheet.getLastColumn() >= 1) {
 *          var headers = regSheet.getRange(1, 1, 1, regSheet.getLastColumn()).getValues()[0];
 *          var found = false;
 *          for (var h = 0; h < headers.length; h++) {
 *            if (headers[h].toString() === data.fileName) { found = true; break; }
 *          }
 *          if (!found) {
 *            regSheet.getRange(1, headers.length + 1).setValue(data.fileName);
 *          }
 *        }
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok', count: data.blocks.length }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (data.action === 'deleteKml') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var kmlSheet = ss.getSheetByName('KMLs');
 *        if (kmlSheet && kmlSheet.getLastRow() > 1) {
 *          var allData = kmlSheet.getDataRange().getValues();
 *          var keepRows = [];
 *          for (var i = 1; i < allData.length; i++) {
 *            if (allData[i][0] !== data.fileName) keepRows.push(allData[i]);
 *          }
 *          kmlSheet.deleteRows(2, kmlSheet.getLastRow() - 1);
 *          if (keepRows.length > 0) {
 *            kmlSheet.getRange(2, 1, keepRows.length, 3).setValues(keepRows);
 *          }
 *        }
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok' }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      var ss = SpreadsheetApp.getActiveSpreadsheet();
 *      var sheet = ss.getSheetByName('Registros');
 *      if (!sheet) {
 *        sheet = ss.insertSheet('Registros');
 *        sheet.appendRow(['Publicador', 'Fecha Inicio', 'Fecha Fin']);
 *      }
 *
 *      if (sheet.getLastColumn() < 3) {
 *        sheet.getRange(1, 1, 1, 3).setValues([['Publicador', 'Fecha Inicio', 'Fecha Fin']]);
 *      }
 *
 *      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 *      var mapColIdx = -1;
 *      for (var i = 0; i < headers.length; i++) {
 *        if (headers[i].toString() === data.mapName) { mapColIdx = i + 1; break; }
 *      }
 *      if (mapColIdx === -1) {
 *        mapColIdx = headers.length + 1;
 *        sheet.getRange(1, mapColIdx).setValue(data.mapName);
 *      }
 *
 *      var newRow = new Array(sheet.getLastColumn()).fill('');
 *      newRow[0] = data.publicador;
 *      newRow[1] = data.fecha_inicio;
 *      newRow[2] = data.fecha_fin;
 *      newRow[mapColIdx - 1] = data.territorio;
 *
 *      var lastRow = sheet.getLastRow();
 *      sheet.getRange(lastRow + 1, 1, 1, newRow.length).setValues([newRow]);
 *
 *      return ContentService
 *        .createTextOutput(JSON.stringify({ status: 'ok' }))
 *        .setMimeType(ContentService.MimeType.JSON);
 *    }
 *
 *    function doGet(e) {
 *      var action = e.parameter.action;
 *
 *      if (action === 'getPassword') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var configSheet = ss.getSheetByName('Config');
 *        var password = 'admin123';
 *
 *        if (configSheet) {
 *          var val = configSheet.getRange('A1').getValue();
 *          if (val) password = val.toString();
 *        }
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ password: password }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'getRecords') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var sheet = ss.getSheetByName('Registros');
 *        var records = [];
 *
 *        if (sheet && sheet.getLastRow() > 1) {
 *          var data = sheet.getDataRange().getValues();
 *          var headers = data[0];
 *
 *          for (var i = 1; i < data.length; i++) {
 *            for (var j = 3; j < headers.length; j++) {
 *              if (data[i][j] && data[i][j].toString().trim() !== '') {
 *                records.push({
 *                  publicador: data[i][0] ? data[i][0].toString() : '',
 *                  territorio: data[i][j].toString(),
 *                  mapName: headers[j].toString(),
 *                  fecha_inicio: data[i][1] ? data[i][1].toString() : '',
 *                  fecha_fin: data[i][2] ? data[i][2].toString() : ''
 *                });
 *              }
 *            }
 *          }
 *        }
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ records: records }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'getKmls') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var kmlSheet = ss.getSheetByName('KMLs');
 *        var kmls = [];
 *
 *        if (kmlSheet && kmlSheet.getLastRow() > 1) {
 *          var data = kmlSheet.getDataRange().getValues();
 *          var kmlMap = {};
 *          var kmlOrder = [];
 *          for (var i = 1; i < data.length; i++) {
 *            var fn = data[i][0] ? data[i][0].toString().trim() : '';
 *            var bn = data[i][1] ? data[i][1].toString().trim() : '';
 *            var co = data[i][2] ? data[i][2].toString().trim() : '';
 *            if (!fn || !bn || !co) continue;
 *            if (!kmlMap[fn]) { kmlMap[fn] = {}; kmlOrder.push(fn); }
 *            kmlMap[fn][bn] = co;
 *          }
 *          kmls = kmlOrder.map(function(fn) {
 *            return {
 *              fileName: fn,
 *              blocks: Object.keys(kmlMap[fn]).map(function(bn) {
 *                return { name: bn, coords: kmlMap[fn][bn] };
 *              })
 *            };
 *          });
 *        }
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ kmls: kmls }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'saveKml') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var kmlSheet = ss.getSheetByName('KMLs');
 *        if (!kmlSheet) kmlSheet = ss.insertSheet('KMLs');
 *
 *        if (kmlSheet.getLastRow() === 0) {
 *          kmlSheet.appendRow(['fileName', 'blockName', 'coords']);
 *        }
 *
 *        var payload = JSON.parse(e.parameter.d);
 *
 *        var existing = kmlSheet.getDataRange().getValues();
 *        var existingNames = [];
 *        var existingCoords = [];
 *        for (var i = 1; i < existing.length; i++) {
 *          if (existing[i][0] === payload.fileName) {
 *            existingNames.push(existing[i][1]);
 *            existingCoords.push(existing[i][2]);
 *          }
 *        }
 *
 *        payload.blocks.forEach(function(block) {
 *          var isDupe = false;
 *          for (var e = 0; e < existingNames.length; e++) {
 *            if (existingNames[e] === block.name && existingCoords[e] === block.coords) { isDupe = true; break; }
 *          }
 *          if (!isDupe) {
 *            kmlSheet.appendRow([payload.fileName, block.name, block.coords]);
 *          }
 *        });
 *
 *        var regSheet = ss.getSheetByName('Registros');
 *        if (regSheet && regSheet.getLastColumn() >= 1) {
 *          var headers = regSheet.getRange(1, 1, 1, regSheet.getLastColumn()).getValues()[0];
 *          var found = false;
 *          for (var h = 0; h < headers.length; h++) {
 *            if (headers[h].toString() === payload.fileName) { found = true; break; }
 *          }
 *          if (!found) {
 *            regSheet.getRange(1, headers.length + 1).setValue(payload.fileName);
 *          }
 *        }
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok', count: payload.blocks.length }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'deleteKml') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var kmlSheet = ss.getSheetByName('KMLs');
 *        if (kmlSheet && kmlSheet.getLastRow() > 1) {
 *          var payload = JSON.parse(e.parameter.d);
 *          var allData = kmlSheet.getDataRange().getValues();
 *          var keepRows = [];
 *          for (var i = 1; i < allData.length; i++) {
 *            if (allData[i][0] !== payload.fileName) keepRows.push(allData[i]);
 *          }
 *          kmlSheet.deleteRows(2, kmlSheet.getLastRow() - 1);
 *          if (keepRows.length > 0) {
 *            kmlSheet.getRange(2, 1, keepRows.length, 3).setValues(keepRows);
 *          }
 *        }
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok' }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'renameMapColumn') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var sheet = ss.getSheetByName('Registros');
 *        var payload = JSON.parse(e.parameter.d);
 *        var count = 0;
 *        if (sheet && sheet.getLastColumn() >= 4) {
 *          var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
 *          for (var h = 3; h < headers.length; h++) {
 *            var hv = headers[h].toString().trim();
 *            if (hv === payload.oldName || hv === payload.oldName + '.kml') {
 *              sheet.getRange(1, h + 1).setValue(payload.newName);
 *              count++;
 *            }
 *          }
 *        }
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok', count: count }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'addRecord') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var sheet = ss.getSheetByName('Registros');
 *        if (!sheet) sheet = ss.insertSheet('Registros');
 *
 *        var payload = JSON.parse(e.parameter.d);
 *
 *        var headers = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
 *        var colIndex = -1;
 *        for (var h = 0; h < headers.length; h++) {
 *          if (headers[h].toString().trim() === payload.mapName.trim()) { colIndex = h + 1; break; }
 *        }
 *        if (colIndex === -1) {
 *          colIndex = sheet.getLastColumn() + 1;
 *          sheet.getRange(1, colIndex).setValue(payload.mapName);
 *        }
 *
 *        var row = [payload.publicador, payload.fechaInicio, payload.fechaFin];
 *        for (var c = 4; c <= sheet.getLastColumn(); c++) { row.push(''); }
 *        row[colIndex - 1] = payload.territorio;
 *        sheet.appendRow(row);
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok' }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'updateRecord') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var sheet = ss.getSheetByName('Registros');
 *        if (!sheet) {
 *          return ContentService
 *            .createTextOutput(JSON.stringify({ status: 'ok', count: 0 }))
 *            .setMimeType(ContentService.MimeType.JSON);
 *        }
 *
 *        var payload = JSON.parse(e.parameter.d);
 *        var allData = sheet.getDataRange().getValues();
 *        var headers = allData[0];
 *        var updated = 0;
 *
 *        for (var i = 1; i < allData.length; i++) {
 *          var rowTerr = '';
 *          for (var j = 3; j < headers.length; j++) {
 *            if (allData[i][j] && allData[i][j].toString().trim() !== '') {
 *              rowTerr = allData[i][j].toString().trim();
 *              break;
 *            }
 *          }
 *          if (rowTerr === payload.territorio) {
 *            allData[i][0] = payload.publicador;
 *            allData[i][1] = payload.fechaInicio;
 *            allData[i][2] = payload.fechaFin;
 *            sheet.getRange(i + 1, 1, 1, 3).setValues([[payload.publicador, payload.fechaInicio, payload.fechaFin]]);
 *            updated++;
 *          }
 *        }
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok', count: updated }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      if (action === 'deleteRecord') {
 *        var ss = SpreadsheetApp.getActiveSpreadsheet();
 *        var sheet = ss.getSheetByName('Registros');
 *        if (!sheet) {
 *          return ContentService
 *            .createTextOutput(JSON.stringify({ status: 'ok', count: 0 }))
 *            .setMimeType(ContentService.MimeType.JSON);
 *        }
 *
 *        var payload = JSON.parse(e.parameter.d);
 *        var allData = sheet.getDataRange().getValues();
 *        var headers = allData[0];
 *        var rowCount = 0;
 *
 *        for (var i = allData.length - 1; i >= 1; i--) {
 *          var rowTerr = '';
 *          for (var j = 3; j < headers.length; j++) {
 *            if (allData[i][j] && allData[i][j].toString().trim() !== '') {
 *              rowTerr = allData[i][j].toString().trim();
 *              break;
 *            }
 *          }
 *          var rowPub = allData[i][0] ? allData[i][0].toString().trim() : '';
 *          var rowFI = allData[i][1] ? allData[i][1].toString().trim() : '';
 *          var rowFF = allData[i][2] ? allData[i][2].toString().trim() : '';
 *
 *          if (rowTerr === payload.territorio &&
 *              rowPub === (payload.publicador || '') &&
 *              rowFI === (payload.fechaInicio || '') &&
 *              rowFF === (payload.fechaFin || '')) {
 *            sheet.deleteRow(i + 1);
 *            rowCount++;
 *            break;
 *          }
 *        }
 *
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ status: 'ok', count: rowCount }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 *      return ContentService
 *        .createTextOutput(JSON.stringify({ error: 'unknown action' }))
 *        .setMimeType(ContentService.MimeType.JSON);
 *    }
 *
 * 4. Crea una hoja llamada "Config" con la contraseña en la celda A1.
 *
 * 5. La hoja "Registros" se crea automáticamente con columnas:
 *    Publicador | Fecha Inicio | Fecha Fin | MapName1 | MapName2 | ...
 *
 * 6. La hoja "KMLs" se crea automáticamente al subir el primer KML.
 *    - Columnas: fileName | blockName | coords
 *
 * 7. Ve a Implementar > Nueva implementación.
 *    - Tipo: Aplicación web
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquier persona
 *    - Haz clic en "Implementar" y copia la URL generada.
 *
 * ══════════════════════════════════════════════════════════════
 */

// ── EMPTY STATE FILE UPLOAD ──
$fileUploadEmpty.addEventListener('change', (e) => {
  if (!isAdmin) { e.target.value = ''; return; }
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  let loadedCount = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const blocks = parseKMLBlocks(evt.target.result);
      if (blocks.length > 0) {
        const existingIndex = allKmlData.findIndex(k => k.fileName === file.name);
        if (existingIndex !== -1) {
          allKmlData[existingIndex] = { fileName: file.name, blocks: blocks };
        } else {
          allKmlData.push({ fileName: file.name, blocks: blocks });
        }
      }
      loadedCount++;
      if (loadedCount === files.length) {
        saveKmlToStorage();
        if (isAdmin) saveAllKmlsToSheet();
        openMapSelector();
      }
    };
    reader.readAsText(file);
  });

  e.target.value = '';
});

// ── SEARCH ──
const debouncedSearch = debounce((q) => {
  let blockVisible = 0;
  let blockTotal = 0;

  allBlockItems.forEach(item => {
    const match = !q || item.dataset.searchText.includes(q);
    item.style.display = match ? '' : 'none';

    const nameEl = item.querySelector('.name');
    if (nameEl) {
      const original = nameEl.dataset.original || nameEl.textContent;
      nameEl.dataset.original = original;
      if (q && match) {
        const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        nameEl.innerHTML = original.replace(regex, '<mark class="search-hl">$1</mark>');
      } else {
        nameEl.textContent = original;
      }
    }

    if (match) blockVisible++;
    blockTotal++;
  });

  let existing = $blockList.querySelector('.search-empty');
  if (existing) existing.remove();

  if (q && blockVisible === 0 && blockTotal > 0) {
    const el = document.createElement('div');
    el.className = 'search-empty';
    el.innerHTML = `<div style="padding:1.5rem 1rem;text-align:center;color:var(--muted);font-size:0.75rem;">No se encontraron resultados para "<strong style="color:var(--accent2)">${q}</strong>"</div>`;
    $blockList.appendChild(el);
  }
}, 80);

$searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value.toLowerCase().trim());
});

$searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $searchInput.value = '';
    debouncedSearch('');
    $searchInput.blur();
  }
});

// ── FILE UPLOAD ──
$fileUpload.addEventListener('change', (e) => {
  if (!isAdmin) { e.target.value = ''; return; }
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  let loadedCount = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const blocks = parseKMLBlocks(evt.target.result);
      if (blocks.length > 0) {
        const existingIndex = allKmlData.findIndex(k => k.fileName === file.name);
        if (existingIndex !== -1) {
          allKmlData[existingIndex] = { fileName: file.name, blocks: blocks };
        } else {
          allKmlData.push({ fileName: file.name, blocks: blocks });
        }
      }
      loadedCount++;
      if (loadedCount === files.length) {
        saveKmlToStorage();
        if (isAdmin) saveAllKmlsToSheet();
        openMapSelector();
      }
    };
    reader.readAsText(file);
  });

  e.target.value = '';
});

// ── MAP SELECTOR ──
function openMapSelector() {
  $selectorGrid.innerHTML = '';
  $mapEmptyState.classList.add('hidden');

  updateSelectorGeneralCard();

  allKmlData.forEach((kml, i) => {
    const color = MAP_COLORS[i % MAP_COLORS.length];
    const card = document.createElement('div');
    card.className = 'selector-card';
    card.style.setProperty('--card-color', color.solid);
    card.style.animationDelay = `${0.1 + i * 0.08}s`;
    card.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${color.solid};border-radius:12px 12px 0 0;"></div>
      <div class="selector-card-top">
        <div class="selector-card-dot" style="background:${color.solid}; color:${color.solid}"></div>
        <div class="selector-card-name">${kml.fileName.replace(/\.(kml|xml)$/i, '')}</div>
        <button class="selector-card-rename admin-only" title="Editar título" aria-label="Editar título">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        <button class="selector-card-delete admin-only" title="Eliminar KML" aria-label="Eliminar KML">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="selector-card-count">${kml.blocks.length} polígonos</div>
      <button class="selector-card-btn">Abrir este mapa</button>
    `;
    card.addEventListener('click', () => loadSelectedMap(i));
    const renBtn = card.querySelector('.selector-card-rename');
    renBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRenameModal(i);
    });
    const delBtn = card.querySelector('.selector-card-delete');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`¿Eliminar el KML "${kml.fileName}" y todos sus polígonos?\n\nTambién se borrará de Google Sheets.`)) {
        deleteKmlFromSheet(kml.fileName);
        deleteKmlData(kml.fileName);
        const idx = loadedMaps.findIndex(m => (m.fileName || m.name) === kml.fileName || m.name === kml.fileName.replace(/\.(kml|xml)$/i, ''));
        if (idx !== -1) removeMap(loadedMaps[idx].id);
        saveKmlToStorage();
        renderMapList();
        openMapSelector();
        showWorkflowToast(`KML "${kml.fileName.replace(/\.(kml|xml)$/i, '')}" eliminado ✓`, '🗑️', 3000);
      }
    });
    $selectorGrid.appendChild(card);
  });

  $mapSelector.classList.add('active');

  gsap.fromTo('.selector-header', {
    opacity: 0,
    y: 16
  }, {
    opacity: 1,
    y: 0,
    duration: 0.5,
    ease: 'power3.out'
  });

  gsap.fromTo('.selector-card', {
    opacity: 0,
    y: 20,
    scale: 0.95
  }, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.5,
    stagger: 0.07,
    ease: 'back.out(1.4)',
    delay: 0.15
  });
}

function loadGeneralView() {
  gsap.to($mapSelector, {
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      $mapSelector.classList.remove('active');
      $mapSelector.style.opacity = '';
    }
  });

  if (allKmlData.length === 0) {
    showWorkflowToast('No hay mapas cargados', '⚠️', 3000);
    return;
  }

  loadedMaps = [];
  nextMapId = 0;
  selectedBlockKey = null;
  activeMapFilter = null;

  allKmlData.forEach((kml, i) => {
    loadedMaps.push({
      id: nextMapId++,
      name: kml.fileName.replace(/\.(kml|xml)$/i, ''),
      fileName: kml.fileName,
      color: MAP_COLORS[i % MAP_COLORS.length],
      visible: true,
      blocks: kml.blocks.map((b, j) => ({
        localId: j,
        name: b.name,
        latlngs: parseCoordsToLeaflet(b.coords)
      }))
    });
  });

  generalView = true;
  document.getElementById('map-container').classList.add('general-active');
  $btnCambiarMapa.style.display = 'flex';
  document.getElementById('btn-export-pdf').style.display = 'flex';
  document.getElementById('btn-reporte').style.display = 'flex';
  updateGeneralBadge();
  recordsReady.then(() => {
    renderAll();
  });
  saveKmlToStorage();
  const totalPolys = loadedMaps.reduce((s, m) => s + m.blocks.length, 0);
  showWorkflowToast(`Vista general: ${loadedMaps.length} mapas y ${totalPolys} polígonos`, '🌐', 4000);
}

function loadSelectedMap(index) {
  gsap.to($mapSelector, {
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
    onComplete: () => {
      $mapSelector.classList.remove('active');
      $mapSelector.style.opacity = '';
    }
  });

  const kml = allKmlData[index];
  loadedMaps = [];
  nextMapId = 0;
  selectedBlockKey = null;
  activeMapFilter = null;
  generalView = false;
  document.getElementById('map-container').classList.remove('general-active');

  const color = MAP_COLORS[0];
  const mapData = {
    id: nextMapId++,
    name: kml.fileName.replace(/\.(kml|xml)$/i, ''),
    fileName: kml.fileName,
    color: color,
    visible: true,
    blocks: kml.blocks.map((b, i) => ({
      localId: i,
      name: b.name,
      latlngs: parseCoordsToLeaflet(b.coords)
    }))
  };
  loadedMaps.push(mapData);
  activeMapFilter = mapData.id;

  $btnCambiarMapa.style.display = 'flex';
  document.getElementById('btn-export-pdf').style.display = 'flex';
  document.getElementById('btn-reporte').style.display = 'flex';
  recordsReady.then(() => {
    renderAll();
  });
  saveKmlToStorage();
  showWorkflowToast('Haz clic en un polígono del mapa o en la lista para ver sus datos', '👆', 4000);
}

function closeMapSelector() {
  $mapSelector.classList.remove('active');
  if (loadedMaps.length === 0 && allKmlData.length === 0) {
    $mapEmptyState.classList.remove('hidden');
  }
}

// ── SIDEBAR TOGGLE (MOBILE) ──
const $sidebar = document.getElementById('sidebar');
const $menuToggle = document.getElementById('menu-toggle');
const $sidebarOverlay = document.getElementById('sidebar-overlay');
const $sidebarClose = document.getElementById('sidebar-close');

function isMobile() {
  return window.innerWidth <= 600;
}

function isTablet() {
  return window.innerWidth > 600 && window.innerWidth <= 1024;
}

function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function openSidebar() {
  $sidebar.classList.add('open');
  $sidebarOverlay.classList.add('active');
  $menuToggle.setAttribute('aria-label', 'Cerrar menú');
  gsap.fromTo($sidebarOverlay, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
}

function closeSidebar() {
  gsap.to($sidebarOverlay, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $sidebar.classList.remove('open');
      $sidebarOverlay.classList.remove('active');
      $menuToggle.setAttribute('aria-label', 'Abrir menú');
    }
  });
}

$menuToggle.addEventListener('click', () => {
  if ($sidebar.classList.contains('open')) closeSidebar();
  else openSidebar();
});

$sidebarOverlay.addEventListener('click', closeSidebar);
$sidebarClose.addEventListener('click', closeSidebar);

function autoCloseSidebar() {
  if (isMobile() || isTablet()) {
    openSidebar();
  }
}

window.addEventListener('resize', debounce(() => {
  if (!isMobile() && !isTablet()) {
    $sidebar.classList.remove('open');
    $sidebarOverlay.classList.remove('active');
  }
  map.invalidateSize();
}, 200));

if (isTouchDevice()) {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, false);
}

// ── WORKFLOW TOAST ──
let toastTimer = null;
function showWorkflowToast(text, icon, duration) {
  clearTimeout(toastTimer);
  $workflowToastText.textContent = text;
  $workflowToast.querySelector('.workflow-toast-icon').textContent = icon || '👆';

  gsap.fromTo($workflowToast, {
    opacity: 0,
    y: 20,
    scale: 0.95
  }, {
    opacity: 1,
    y: 0,
    scale: 1,
    duration: 0.45,
    ease: 'back.out(1.4)'
  });

  toastTimer = setTimeout(() => {
    gsap.to($workflowToast, {
      opacity: 0,
      y: 12,
      scale: 0.97,
      duration: 0.3,
      ease: 'power2.in'
    });
  }, duration || 4000);
}

// ── INTRO ──
// La intro NO espera a Google Sheets: arranca de inmediato y la red se
// consulta en segundo plano (con timeout) para no frenar la carga.
const recordsReady = fetchRecords();
loadKmlFromStorage();

let appShown = false;
function showApp() {
  if (appShown) return;
  appShown = true;
  $intro.style.display = 'none';
  document.getElementById('app').style.opacity = '1';
  map.invalidateSize();

  fetchAdminPassword();

  if (allKmlData.length > 0) {
    openMapSelector();
  } else {
    updateStats();
  }
  recordsReady.then(() => updateStats());
}

// ── SPLASH DE INICIO ──
// Barra de progreso real: avanza con los hitos de carga (registros y KMLs)
// y la salida espera un minimo para que la animacion se aprecie.
const $splashBar = document.getElementById('bar-fill');
const $splashPct = document.getElementById('bar-pct');
const $splashStatus = document.getElementById('splash-status');
const splashState = { pct: 0 };
const SPLASH_MIN_MS = 2200;
const SPLASH_MAX_MS = 5200;
const splashStart = performance.now();
let splashFinished = false;

function splashProgress(target, status) {
  if (splashFinished) return;
  gsap.to(splashState, {
    pct: target,
    duration: Math.max(0.45, Math.abs(target - splashState.pct) / 55),
    ease: 'power2.out',
    overwrite: 'auto',
    onUpdate: () => {
      const v = Math.round(splashState.pct);
      if ($splashBar) $splashBar.style.width = v + '%';
      if ($splashPct) $splashPct.textContent = v + '%';
    },
    onComplete: () => {
      if (status && $splashStatus) $splashStatus.textContent = status;
    }
  });
}

splashProgress(22, 'Cargando mapas…');
const kmlsReady = fetchKmlsFromSheet();
Promise.resolve(recordsReady).then(() => splashProgress(62, 'Sincronizando territorios…'));
kmlsReady.then(ok => splashProgress(ok ? 86 : 78, ok ? 'Preparando el mapa…' : 'Usando mapas guardados…'));

function splashExit() {
  if ($splashStatus) $splashStatus.textContent = 'Listo';
  gsap.to('.splash-content', {
    y: -16,
    opacity: 0,
    duration: 0.42,
    ease: 'power2.in'
  });
  gsap.to('#intro', {
    opacity: 0,
    scale: 1.045,
    duration: 0.55,
    ease: 'power2.inOut',
    onComplete: showApp
  });
}

function finishSplash() {
  if (splashFinished) return;
  splashFinished = true;
  gsap.to(splashState, {
    pct: 100,
    duration: Math.max(0.3, (100 - splashState.pct) / 90),
    ease: 'power2.out',
    overwrite: 'auto',
    onUpdate: () => {
      const v = Math.round(splashState.pct);
      if ($splashBar) $splashBar.style.width = v + '%';
      if ($splashPct) $splashPct.textContent = v + '%';
    },
    onComplete: splashExit
  });
  // Respaldo duro: si GSAP no avanza (p. ej. pestaña en segundo plano),
  // la app aparece igualmente.
  setTimeout(showApp, 1900);
}

function splashReady() {
  const elapsed = performance.now() - splashStart;
  setTimeout(finishSplash, Math.max(0, SPLASH_MIN_MS - elapsed));
}

// Sale cuando registros + KMLs esten listos (o al tope de tiempo), con un
// minimo de 2.2 s para que la animacion de bienvenida se aprecie completa.
Promise.race([
  Promise.allSettled([Promise.resolve(recordsReady), Promise.resolve(kmlsReady)]),
  new Promise(res => setTimeout(res, SPLASH_MAX_MS))
]).then(splashReady);
setTimeout(finishSplash, 9000);

kmlsReady.then(ok => {
  if (!ok) return;
  if ($intro.style.display === 'none' && ($mapSelector.classList.contains('active') || loadedMaps.length === 0)) {
    openMapSelector();
  }
});

function loadOSMTile(z, x, y) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 8000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); resolve(null); };
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
}

function mercatorX(lng) {
  return (lng + 180) / 360;
}
function mercatorY(lat) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = clamped * Math.PI / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
}

function pdfIconRadius(minDim, scale) {
  return Math.max(3, Math.min(8 * scale, minDim * 0.28));
}

async function drawMapCanvas(mapData) {
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  const W = 900 * SCALE, H = 500 * SCALE;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  mapData.blocks.forEach(b => {
    b.latlngs.forEach(([lat, lng]) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
  });

  if (minLat === Infinity) return canvas;

  if (maxLat - minLat < 0.002) { minLat -= 0.001; maxLat += 0.001; }
  if (maxLng - minLng < 0.002) { minLng -= 0.001; maxLng += 0.001; }

  const mx0 = mercatorX(minLng), mx1 = mercatorX(maxLng);
  const my0 = mercatorY(maxLat), my1 = mercatorY(minLat);
  const spanX = mx1 - mx0;
  const spanY = my1 - my0;

  const pad = 12 * SCALE;
  const availW = W - pad * 2;
  const availH = H - pad * 2;

  const fit = Math.min(availW / spanX, availH / spanY);
  let z = Math.floor(Math.log2(fit / 256));
  z = Math.max(0, Math.min(18, z));

  let tiles = [];
  while (tiles.length === 0 || tiles.length > 100) {
    const n = Math.pow(2, z);
    const tx0 = Math.max(0, Math.floor(mx0 * n));
    const tx1 = Math.min(n - 1, Math.floor(mx1 * n));
    const ty0 = Math.max(0, Math.floor(my0 * n));
    const ty1 = Math.min(n - 1, Math.floor(my1 * n));
    tiles = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        tiles.push({ z, x: tx, y: ty });
      }
    }
    if (tiles.length > 100) {
      if (z === 0) break;
      z--;
    }
  }

  const S = Math.min(availW / spanX, availH / spanY);
  const ox = pad + (availW - spanX * S) / 2 - mx0 * S;
  const oy = pad + (availH - spanY * S) / 2 - my0 * S;

  function project(lat, lng) {
    return [ox + mercatorX(lng) * S, oy + mercatorY(lat) * S];
  }

  const tileImgs = await Promise.all(tiles.map(t => loadOSMTile(t.z, t.x, t.y)));
  const n = Math.pow(2, z);
  const tilePx = S / n;

  tiles.forEach((t, i) => {
    const img = tileImgs[i];
    if (!img) return;
    const dx = ox + (t.x / n) * S;
    const dy = oy + (t.y / n) * S;
    try { ctx.drawImage(img, dx, dy, tilePx + 0.5, tilePx + 0.5); } catch (e) {}
  });

  const anyTile = tileImgs.some(Boolean);
  if (!anyTile) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = SCALE;
    for (let g = 0; g <= W; g += 50 * SCALE) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke(); }
    for (let g = 0; g <= H; g += 50 * SCALE) { ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke(); }
  }

  const statusRGB = {
    fresh: 'rgba(16,185,129,0.42)',
    warning: 'rgba(245,158,11,0.42)',
    alert: 'rgba(239,68,68,0.42)'
  };
  const strokeRGB = {
    fresh: '#10b981',
    warning: '#f59e0b',
    alert: '#ef4444'
  };
  const blockVisits = mapData.blocks.map(b => getVisitStatusInfo(b.name));

  function traceBlockPath(block) {
    ctx.beginPath();
    block.latlngs.forEach(([lat, lng], idx) => {
      const [px, py] = project(lat, lng);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  // 1) Rellenos de estado
  mapData.blocks.forEach((block, i) => {
    traceBlockPath(block);
    ctx.fillStyle = statusRGB[blockVisits[i].status] || statusRGB.alert;
    ctx.fill();
  });

  // 2) Halo blanco: separa cada polígono del mapa base
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  mapData.blocks.forEach(block => {
    traceBlockPath(block);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 4.5 * SCALE;
    ctx.stroke();
  });

  // 3) Contorno de color
  mapData.blocks.forEach((block, i) => {
    traceBlockPath(block);
    ctx.strokeStyle = strokeRGB[blockVisits[i].status] || strokeRGB.alert;
    ctx.lineWidth = 2 * SCALE;
    ctx.stroke();
  });

  // 4) Iconos con tamaño proporcional: nunca tapan el polígono
  mapData.blocks.forEach((block, i) => {
    const visitInfo = blockVisits[i];
    let icon = '';
    let iconBg = '';
    if (visitInfo.visitIcon === 'check') { icon = '✓'; iconBg = '#10b981'; }
    else if (visitInfo.visitIcon === 'question') { icon = '?'; iconBg = '#f59e0b'; }
    else if (visitInfo.visitIcon === 'alert') { icon = '!'; iconBg = '#ef4444'; }
    if (!icon) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    block.latlngs.forEach(([lat, lng]) => {
      const [px, py] = project(lat, lng);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    });
    const minDim = Math.min(maxX - minX, maxY - minY);
    const R = pdfIconRadius(minDim, SCALE);
    const cp = getPolygonInteriorPoint(block.latlngs);
    const [cx, cy] = project(cp[0], cp[1]);

    const ringW = Math.max(0.8, R * 0.27);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R - ringW / 2, 0, Math.PI * 2);
    ctx.lineWidth = ringW;
    ctx.strokeStyle = iconBg;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = iconBg;
    ctx.fill();

    if (R >= 9) {
      ctx.fillStyle = iconBg === '#f59e0b' ? '#000' : '#fff';
      ctx.font = `bold ${Math.max(6, Math.round(R * 0.97))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, cx, cy);
    }
  });

  const attSize = 9 * SCALE;
  ctx.font = `${attSize}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const attText = '© OpenStreetMap contributors';
  const attW = ctx.measureText(attText).width;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(W - 8 * SCALE - attW - 5 * SCALE, H - 7 * SCALE - attSize - 4 * SCALE, attW + 10 * SCALE, attSize + 8 * SCALE);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(attText, W - 8 * SCALE, H - 7 * SCALE);

  return canvas;
}

function isTouchPrimary() {
  try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
}

let pdfPopupWin = null;

function openPdfPopupEarly() {
  if (!isTouchPrimary()) return;
  if (pdfPopupWin && !pdfPopupWin.closed) return;
  try {
    pdfPopupWin = window.open('', '_blank');
    if (pdfPopupWin) {
      pdfPopupWin.document.write('<title>MapView - PDF</title><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666">Generando PDF...</body>');
      pdfPopupWin.document.close();
    }
  } catch (e) { pdfPopupWin = null; }
}

function closePdfPopup() {
  if (!pdfPopupWin) return;
  try { pdfPopupWin.close(); } catch (e) {}
  pdfPopupWin = null;
}

async function exportPDF() {
  if (loadedMaps.length === 0) {
    showWorkflowToast('No hay mapas cargados para exportar', '⚠️', 3000);
    return;
  }
  openPdfPopupEarly();
  try {
    await exportPDFCore();
  } catch (err) {
    console.warn('[MapView] Error exportando PDF:', err);
    closePdfPopup();
    showWorkflowToast('No se pudo generar el PDF en este dispositivo', '⚠️', 3500);
  }
}

async function exportPDFCore() {
  showWorkflowToast('Generando PDF con mapa base...', '⏳', 3000);

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  function newPage() {
    doc.addPage();
    y = margin;
  }

  function ensureSpace(needed) {
    if (y + needed > pageH - margin) newPage();
  }

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('MAPVIEW - Reporte de Territorios', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, y);
  y += 5;
  doc.text(`Total de mapas: ${loadedMaps.length}`, margin, y);
  y += 8;

  const mapsUnique = loadedMaps.map(m => {
    const groups = new Map();
    m.blocks.forEach(b => {
      const k = normalizeTerritoryName(b.name);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(b);
    });
    const uniqueBlocks = [...groups.values()].map(list =>
      list.find(b => b.name.trim().toLowerCase() === normalizeTerritoryName(b.name)) || list[0]
    );
    return { mapData: m, uniqueBlocks };
  });

  const totalBlocks = mapsUnique.reduce((s, m) => s + m.uniqueBlocks.length, 0);
  doc.text(`Total de bloques: ${totalBlocks}`, margin, y);
  y += 10;

  const statusColors = {
    fresh: [16, 185, 129],
    warning: [245, 158, 11],
    alert: [239, 68, 68]
  };
  const statusLabels = {
    fresh: 'Reciente',
    warning: '3 meses',
    alert: 'Sin visita'
  };

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('LEYENDA', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');

  const legendItems = [
    { color: statusColors.fresh, label: 'Reciente - Visitado en menos de 3 meses con fecha de finalizacion' },
    { color: statusColors.warning, label: '3 meses - Visitado hace 3-4 meses' },
    { color: statusColors.alert, label: 'Sin visita - Sin registro o mas de 4 meses' }
  ];

  legendItems.forEach(item => {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(margin + 3, y - 1.2, 2, 'F');
    doc.text(item.label, margin + 8, y);
    y += 5;
  });

  y += 2;

  const iconLegend = [
    { bg: [16, 185, 129], fg: [255, 255, 255], char: 'V', label: 'Visitado con fecha de finalizacion' },
    { bg: [245, 158, 11], fg: [0, 0, 0], char: '?', label: 'Visitado sin fecha de finalizacion' },
    { bg: [239, 68, 68], fg: [255, 255, 255], char: '!', label: 'Sin trabajar' }
  ];

  iconLegend.forEach(item => {
    doc.setFillColor(item.bg[0], item.bg[1], item.bg[2]);
    doc.circle(margin + 3, y - 1.2, 2.5, 'F');
    doc.setTextColor(item.fg[0], item.fg[1], item.fg[2]);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(7);
    doc.text(item.char, margin + 3, y + 0.3, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(item.label, margin + 8, y);
    y += 5;
  });

  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  for (let mapIdx = 0; mapIdx < mapsUnique.length; mapIdx++) {
    const { mapData, uniqueBlocks } = mapsUnique[mapIdx];
    ensureSpace(20);

    doc.setFillColor(59, 130, 246);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.text(`${mapIdx + 1}. ${mapData.name} (${uniqueBlocks.length} bloques)`, margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 12;

    const mapCanvas = await drawMapCanvas(mapData);
    const imgData = mapCanvas.toDataURL('image/png');
    const imgW = pageW - margin * 2;
    const imgH = imgW * (mapCanvas.height / mapCanvas.width);
    ensureSpace(imgH + 4);
    doc.addImage(imgData, 'PNG', margin, y, imgW, imgH);
    doc.setDrawColor(200);
    doc.rect(margin, y, imgW, imgH);
    y += imgH + 6;

    const colWidths = { num: 10, name: 55, status: 30, publisher: 40, date1: 23, date2: 22 };
    if (pageW < margin * 2 + colWidths.num + colWidths.name + colWidths.status + colWidths.publisher + colWidths.date1 + colWidths.date2) {
      colWidths.name = 40;
      colWidths.publisher = 30;
      colWidths.date1 = 19;
      colWidths.date2 = 16;
    }
    const startX = margin;
    const datesX = startX + colWidths.num + colWidths.name + colWidths.status + colWidths.publisher;

    ensureSpace(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(startX, y - 3.5, pageW - margin * 2, 7, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('#', startX + 2, y + 1);
    doc.text('Territorio', startX + colWidths.num + 2, y + 1);
    doc.text('Estado', startX + colWidths.num + colWidths.name + 2, y + 1);
    doc.text('Publicador', startX + colWidths.num + colWidths.name + colWidths.status + 2, y + 1);
    doc.text('Inicio', datesX + 2, y + 1);
    doc.text('Fin', datesX + colWidths.date1 + 2, y + 1);
    y += 7;
    doc.setFont(undefined, 'normal');

    uniqueBlocks.forEach((block, i) => {
      ensureSpace(7);
      const visitInfo = getVisitStatusInfo(block.name);
      const record = getRecordForBlock(block.name);
      const sc = statusColors[visitInfo.status] || statusColors.alert;

      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(startX, y - 3.5, pageW - margin * 2, 7, 'F');
      }

      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.circle(startX + 3, y, 1.8, 'F');

      doc.setFontSize(8);
      doc.text(String(i + 1), startX + 7, y + 1);
      doc.text(block.name.substring(0, 32), startX + colWidths.num + 2, y + 1);
      doc.text(statusLabels[visitInfo.status] || '', startX + colWidths.num + colWidths.name + 2, y + 1);

      const pub = record ? (record.publicador || '') : '';
      doc.text(pub.substring(0, 22), startX + colWidths.num + colWidths.name + colWidths.status + 2, y + 1);

      const fmt = d => d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
      const d1 = record && record.fecha_inicio ? new Date(record.fecha_inicio) : null;
      const d2 = record && record.fecha_fin ? new Date(record.fecha_fin) : null;
      doc.text(fmt(d1), datesX + 2, y + 1);
      doc.text(fmt(d2), datesX + colWidths.date1 + 2, y + 1);

      y += 6;
    });

    y += 8;
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`MapView - Pagina ${i} de ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  const activeMap = loadedMaps.find(m => m.id === activeMapFilter);
  const fileName = `MapView_${activeMap ? activeMap.name.replace(/\s+/g, '_') : 'Territorios'}_${new Date().toISOString().slice(0, 10)}.pdf`;
  openPdfPreview(doc, fileName);
}

// ── PDF PREVIEW ──
const $pdfModal = document.getElementById('pdf-modal');
const $pdfFrame = document.getElementById('pdf-frame');
const $pdfName = document.getElementById('pdf-name');
const $pdfClose = document.getElementById('pdf-close');
const $pdfDownload = document.getElementById('pdf-download');
let pdfPreviewDoc = null;
let pdfPreviewFileName = '';

function openPdfPreview(doc, fileName) {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    // Móvil/tablet: los navegadores móviles no muestran PDFs blob dentro de un iframe,
    // pero sí los muestran al navegar de forma superior → usar la pestaña abierta al iniciar.
    if (pdfPopupWin && !pdfPopupWin.closed) {
      try {
        pdfPopupWin.location = url;
        pdfPopupWin = null;
        showWorkflowToast('Vista previa del PDF abierta en otra pestaña', '👁️', 3200);
        return;
      } catch (e) { /* si falla, seguimos con el modal */ }
    }
    closePdfPopup();

    pdfPreviewDoc = doc;
    pdfPreviewFileName = fileName;
    $pdfName.textContent = fileName;
    if ($pdfFrame.src.startsWith('blob:')) URL.revokeObjectURL($pdfFrame.src);
    $pdfFrame.src = url;
    $pdfModal.classList.add('active');
    gsap.fromTo($pdfModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    gsap.fromTo('.pdf-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
    showWorkflowToast(isTouchPrimary() ? 'Si no ves el PDF, toca Descargar' : 'Revisa el PDF antes de descargarlo', isTouchPrimary() ? '⬇️' : '👁️', 3200);
  } catch (err) {
    console.warn('[MapView] Error generando vista previa:', err);
    closePdfPopup();
    doc.save(fileName);
    showWorkflowToast('PDF exportado correctamente ✓', '📄', 3000);
  }
}

function closePdfPreview() {
  const revoke = () => {
    if ($pdfFrame.src.startsWith('blob:')) URL.revokeObjectURL($pdfFrame.src);
    $pdfFrame.src = '';
    pdfPreviewDoc = null;
  };
  gsap.to('.pdf-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($pdfModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $pdfModal.classList.remove('active');
      $pdfModal.style.opacity = '';
      revoke();
    }
  });
}

$pdfClose.addEventListener('click', closePdfPreview);
$pdfModal.addEventListener('click', (e) => {
  if (e.target === $pdfModal) closePdfPreview();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $pdfModal.classList.contains('active')) closePdfPreview();
});
$pdfDownload.addEventListener('click', () => {
  if (!pdfPreviewDoc) return;
  pdfPreviewDoc.save(pdfPreviewFileName);
  showWorkflowToast('PDF descargado ✓', '⬇️', 3000);
  closePdfPreview();
});

// ── REPORTE GENERAL (MODAL) ──
const $reportModal = document.getElementById('report-modal');
const $reportSummary = document.getElementById('report-summary');
const $reportBody = document.getElementById('report-body');
const $reportCount = document.getElementById('report-count');
const $reportClose = document.getElementById('report-close');
const $reportExport = document.getElementById('report-export');

function fmtReportDate(str) {
  return str && String(str).trim() ? formatRecordDate(String(str)) : '-';
}

function renderReportModal() {
  const report = buildGeneralReport();

  $reportSummary.innerHTML = `
    <div class="report-card"><span class="rc-val">${report.total}</span><span class="rc-lab">Territorios</span></div>
    <div class="report-card ok"><span class="rc-val">${report.worked.length}</span><span class="rc-lab">Trabajados</span></div>
    <div class="report-card pending"><span class="rc-val">${report.pending.length}</span><span class="rc-lab">Falta por trabajar</span></div>
    <div class="report-card progress"><span class="rc-val">${report.avg}%</span><span class="rc-lab">Avance promedio</span></div>`;

  $reportCount.textContent = `${report.pctWorked}% trabajado · ${report.total} territorios`;

  if (report.total === 0) {
    $reportBody.innerHTML = '<div class="report-empty">No hay territorios cargados.</div>';
    return;
  }

  $reportBody.innerHTML = report.maps.map(m => {
    if (!m.territories.length) return '';
    const rows = m.territories.map(t => `
      <tr>
        <td class="rp-name">${t.name}</td>
        <td>${getProgressLabel(t.pct)}</td>
        <td><span class="report-pct p${t.pct}">${t.pct}%</span></td>
        <td><span class="report-pct p${t.pct}">${100 - t.pct}%</span></td>
        <td><div class="report-bar"><i class="${t.pct >= 100 ? '' : 'p50'}" style="width:${t.pct}%"></i></div></td>
        <td>${t.record ? fmtReportDate(t.record.fecha_inicio) : '-'}</td>
        <td>${t.record ? fmtReportDate(t.record.fecha_fin) : '-'}</td>
        <td>${t.record && t.record.publicador ? t.record.publicador : '-'}</td>
      </tr>`).join('');
    return `
      <div>
        <div class="report-map-head">
          <b>${m.name}</b>
          <span>${m.worked.length}/${m.territories.length} trabajados · avance ${m.avg}%</span>
        </div>
        <div class="report-scroll">
          <table class="report-table">
            <thead>
              <tr><th>Territorio</th><th>Estado</th><th>Avance</th><th>Falta</th><th></th><th>Inicio</th><th>Fin</th><th>Publicador</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

// ── REPORTE: EXPORTAR PDF ──
function exportReportPDF() {
  if (loadedMaps.length === 0) {
    showWorkflowToast('No hay mapas cargados para exportar', '⚠️', 3000);
    return;
  }
  openPdfPopupEarly();
  try {
    exportReportPDFCore();
  } catch (err) {
    console.warn('[MapView] Error exportando reporte PDF:', err);
    closePdfPopup();
    showWorkflowToast('No se pudo generar el PDF en este dispositivo', '⚠️', 3500);
  }
}

function exportReportPDFCore() {
  showWorkflowToast('Generando PDF del reporte...', '⏳', 3000);

  const report = buildGeneralReport();
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  function newPage() { doc.addPage(); y = margin; }
  function ensureSpace(needed) { if (y + needed > pageH - margin) newPage(); }

  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text('MAPVIEW - Reporte General', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, y);
  y += 5;
  doc.text(`Total de territorios: ${report.total}`, margin, y);
  y += 5;
  doc.text(`Trabajados: ${report.worked.length} (${report.pctWorked}%)   -   Falta por trabajar: ${report.pending.length}`, margin, y);
  y += 5;
  doc.text(`Avance promedio: ${report.avg}%`, margin, y);
  y += 7;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFontSize(9);
  doc.splitTextToSize('Completado = 100% (con fecha de finalizacion) - En curso = 50% (solo fecha de inicio) - Sin trabajar = 0% (sin registro). Trabajado = con fecha de inicio o finalizacion.', pageW - margin * 2).forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  const fmt = d => d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

  report.maps.forEach((m, mapIdx) => {
    if (!m.territories.length) return;
    ensureSpace(22);

    doc.setFillColor(59, 130, 246);
    doc.rect(margin, y - 4, pageW - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text(`${mapIdx + 1}. ${m.name} - ${m.worked.length}/${m.territories.length} trabajados - avance ${m.avg}%`, margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const c = { num: 8, name: 48, status: 26, pct: 16, rest: 16, date1: 20, date2: 20, pub: 28 };
    const xNum = margin;
    const xName = xNum + c.num;
    const xStatus = xName + c.name;
    const xPct = xStatus + c.status;
    const xRest = xPct + c.pct;
    const xD1 = xRest + c.rest;
    const xD2 = xD1 + c.date1;
    const xPub = xD2 + c.date2;

    ensureSpace(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 3.5, pageW - margin * 2, 7, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    doc.text('#', xNum + 2, y + 1);
    doc.text('Territorio', xName + 2, y + 1);
    doc.text('Estado', xStatus + 2, y + 1);
    doc.text('Avance', xPct + 2, y + 1);
    doc.text('Falta', xRest + 2, y + 1);
    doc.text('Inicio', xD1 + 2, y + 1);
    doc.text('Fin', xD2 + 2, y + 1);
    doc.text('Publicador', xPub + 2, y + 1);
    y += 7;
    doc.setFont(undefined, 'normal');

    m.territories.forEach((t, i) => {
      ensureSpace(7);
      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 3.5, pageW - margin * 2, 7, 'F');
      }
      doc.setFontSize(8);
      doc.text(String(i + 1), xNum + 2, y + 1);
      doc.text(t.name.substring(0, 30), xName + 2, y + 1);
      doc.text(getProgressLabel(t.pct), xStatus + 2, y + 1);

      const pc = t.pct >= 100 ? [16, 185, 129] : t.pct > 0 ? [245, 158, 11] : [239, 68, 68];
      doc.setTextColor(pc[0], pc[1], pc[2]);
      doc.text(`${t.pct}%`, xPct + 2, y + 1);
      doc.text(`${100 - t.pct}%`, xRest + 2, y + 1);
      doc.setTextColor(0, 0, 0);

      const d1 = t.record && t.record.fecha_inicio ? new Date(t.record.fecha_inicio) : null;
      const d2 = t.record && t.record.fecha_fin ? new Date(t.record.fecha_fin) : null;
      doc.text(fmt(d1), xD1 + 2, y + 1);
      doc.text(fmt(d2), xD2 + 2, y + 1);
      doc.text(t.record && t.record.publicador ? String(t.record.publicador).substring(0, 15) : '', xPub + 2, y + 1);
      y += 6;
    });

    y += 8;
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`MapView - Reporte - Pagina ${i} de ${pageCount}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  const fileName = `Reporte_territorios_${new Date().toISOString().slice(0, 10)}.pdf`;
  openPdfPreview(doc, fileName);
}

function openReportModal() {
  if (loadedMaps.length === 0) {
    showWorkflowToast('Carga un mapa primero', '🗺', 2600);
    return;
  }
  renderReportModal();
  $reportModal.classList.add('active');
  gsap.fromTo($reportModal, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' });
  gsap.fromTo('.report-box', { opacity: 0, scale: 0.94, y: 12 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' });
}

function closeReportModal() {
  gsap.to('.report-box', { opacity: 0, scale: 0.96, y: 8, duration: 0.2, ease: 'power2.in' });
  gsap.to($reportModal, {
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: () => {
      $reportModal.classList.remove('active');
      $reportModal.style.opacity = '';
    }
  });
}

$reportClose.addEventListener('click', closeReportModal);
$reportExport.addEventListener('click', exportReportPDF);
$reportModal.addEventListener('click', (e) => {
  if (e.target === $reportModal) closeReportModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $reportModal.classList.contains('active') && !$pdfModal.classList.contains('active')) closeReportModal();
});

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

recordsReady.then(() => {
  if (loadedMaps.length > 0) {
    renderAllPolygons();
    renderBlockList();
  }
});

if (!navigator.onLine) {
  document.getElementById('offline-badge').style.display = 'inline-flex';
  document.getElementById('status-dot').style.display = 'none';
}

updatePendingBadge();
if (navigator.onLine && getPendingRecords().length > 0) syncPendingRecords();

// ── MANTENER TIBIO APPS SCRIPT (evita arrancar frío de 2-6 s en cada guardado) ──
function pingSheetsBackend() {
  if (!navigator.onLine) return;
  fetch(`${GOOGLE_SHEETS_URL}?action=getPassword`).then(r => r.text()).catch(() => {});
}
pingSheetsBackend();
setInterval(pingSheetsBackend, 4 * 60 * 1000);
let lastRecordsRefresh = 0;
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

// ── GSAP BUTTON PRESS FEEDBACK ──
document.addEventListener('mousedown', (e) => {
  const btn = e.target.closest('.upload-btn, .btn-cambiar-mapa, .btn-grabar, .map-empty-btn, .admin-login-btn, .admin-logout-btn, .theme-toggle, .menu-toggle, .login-submit, .login-cancel, .selector-card-btn, .btn-export-pdf, #d-btn-delete');
  if (!btn) return;
  gsap.to(btn, { opacity: 0.7, duration: 0.1, ease: 'power2.in' });
});
document.addEventListener('mouseup', () => {
  document.querySelectorAll('.upload-btn, .btn-cambiar-mapa, .btn-grabar, .map-empty-btn, .admin-login-btn, .admin-logout-btn, .theme-toggle, .menu-toggle, .login-submit, .login-cancel, .selector-card-btn').forEach(btn => {
    gsap.to(btn, { opacity: 1, duration: 0.2, ease: 'power2.out' });
  });
});

// ── GSAP AMBIENT ANIMATIONS ──
gsap.to('.map-empty-icon', {
  keyframes: [
    { scale: 1.03, borderColor: 'rgba(59,130,246,0.5)', duration: 1.75 },
    { scale: 1, borderColor: 'rgba(59,130,246,0.25)', duration: 1.75 }
  ],
  repeat: -1,
  ease: 'sine.inOut'
});

gsap.to('.status-dot', {
  keyframes: [
    { opacity: 0.3, duration: 1 },
    { opacity: 1, duration: 1 }
  ],
  repeat: -1,
  ease: 'sine.inOut'
});

  // ── HANDLERS GLOBALES (HTML dinamico con onclick) ──
  window.startEditRecord = startEditRecord;
  window.deleteSingleRecord = deleteSingleRecord;

  // Botones estaticos (antes con onclick inline en el HTML)
  $btnCambiarMapa.onclick = openMapSelector;
  document.getElementById('btn-export-pdf').onclick = exportPDF;
  document.getElementById('btn-reporte').onclick = openReportModal;
  $dBtnSave.onclick = saveToSheet;

  // ── PWA ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=13').then(reg => {
      reg.update().catch(() => {});
    }).catch(() => {});
  }
}
