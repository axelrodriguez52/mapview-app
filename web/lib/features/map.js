// features/map.js — Inicialización y gestión del mapa Leaflet.

import L from 'leaflet';
import { MAP_COLORS } from '../core/constants.js';
import { state } from '../core/state.js';
import { isPointInPolygon, parseCoordsToLeaflet } from '../core/utils.js';
import { autoCloseSidebar } from '../ui/sidebar.js';
import { showWorkflowToast } from '../ui/toast.js';
import { deselectBlock, selectBlock } from './detail.js';
import { renderAll, renderBlockList, renderMapList } from './render.js';
import { getPreferredTheme } from './theme.js';

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

const baseMaps = { "Estándar": vistaEstandarDark, "Satelital": vistaSatelital };

export function syncMapLayer() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'light') {
    state.map.addLayer(vistaEstandarLight);
    state.map.removeLayer(vistaSatelital);
    state.map.removeLayer(vistaEstandarDark);
  } else {
    state.map.addLayer(vistaSatelital);
    state.map.removeLayer(vistaEstandarLight);
    state.map.removeLayer(vistaEstandarDark);
  }
}

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

export function toggleLocation() {
  if (locationActive) {
    stopLocation();
  } else {
    startLocation();
  }
}

export function startLocation() {
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
        userPositionMarker = L.marker(latlng, { icon: icon, zIndexOffset: 1000 }).addTo(state.map);
        userPositionCircle = L.circle(latlng, {
          radius: accuracy,
          color: 'rgba(59,130,246,0.25)',
          fillColor: 'rgba(59,130,246,0.08)',
          fillOpacity: 0.3,
          weight: 1
        }).addTo(state.map);
        state.map.setView(latlng, Math.max(state.map.getZoom(), 16));
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

export function stopLocation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  locationActive = false;
  lastAutoSelectedKey = null;

  if (userPositionMarker) {
    state.map.removeLayer(userPositionMarker);
    userPositionMarker = null;
  }
  if (userPositionCircle) {
    state.map.removeLayer(userPositionCircle);
    userPositionCircle = null;
  }

  const btn = document.querySelector('.leaflet-control-location a');
  if (btn) {
    btn.classList.remove('loc-active');
    btn.title = 'Mostrar mi ubicación';
  }
}

let lastAutoSelectedKey = null;

export function checkPolygonAtPosition(latlng) {
  const point = L.latLng(latlng);

  for (const mapData of state.loadedMaps) {
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

export function addMap(fileName, kmlBlocks) {
  const color = MAP_COLORS[state.loadedMaps.length % MAP_COLORS.length];
  const mapData = {
    id: state.nextMapId++,
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
  state.loadedMaps.push(mapData);
  if (!state.generalView) state.activeMapFilter = mapData.id;
  state.recordsReady.then(() => {
    renderAll();
  });
  return mapData;
}

export function removeMap(mapId) {
  state.loadedMaps = state.loadedMaps.filter(m => m.id !== mapId);
  if (state.activeMapFilter === mapId) state.activeMapFilter = state.loadedMaps.length > 0 ? state.loadedMaps[0].id : null;
  if (state.selectedBlockKey && state.selectedBlockKey.mapId === mapId) deselectBlock();
  state.recordsReady.then(() => renderAll());
}

export function toggleMapVisibility(mapId) {
  const m = state.loadedMaps.find(m => m.id === mapId);
  if (m) {
    m.visible = !m.visible;
    state.recordsReady.then(() => renderAll());
  }
}

export function selectMapFilter(mapId) {
  state.activeMapFilter = (state.activeMapFilter === mapId && state.loadedMaps.length > 1) ? null : mapId;
  renderMapList();
  renderBlockList();
}

/** Crea el mapa Leaflet, las capas base, el control de ubicación y la capa de polígonos. */
export function initMap() {
  state.map = L.map('map', {
    center: [19.211, -70.348],
    zoom: 15,
    layers: [initialLayer],
    zoomControl: true
  });

  L.control.layers(baseMaps, null, { position: 'bottomleft', collapsed: false }).addTo(state.map);

  state.map.on('baselayerchange', (e) => {
    const container = document.getElementById('map-container');
    if (e.name === 'Satelital') container.classList.add('satellite-active');
    else container.classList.remove('satellite-active');
  });

  new LocationControl().addTo(state.map);
  state.polygonLayerGroup = L.layerGroup().addTo(state.map);
}
