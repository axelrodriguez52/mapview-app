// services/storage.js — Persistencia local de los KML.

import { KML_STORAGE_KEY, KML_STORAGE_MAP_KEY } from '../core/constants.js';
import { state } from '../core/state.js';
import { loadSelectedMap } from '../features/selector.js';

export function saveKmlToStorage() {
  try {
    localStorage.setItem(KML_STORAGE_KEY, JSON.stringify(state.allKmlData));
    if (state.activeMapFilter !== null) {
      const activeMap = state.loadedMaps.find(m => m.id === state.activeMapFilter);
      if (activeMap) localStorage.setItem(KML_STORAGE_MAP_KEY, activeMap.name);
    }
  } catch (e) {
    console.warn('No se pudieron guardar los KMLs en localStorage:', e);
  }
}

export function loadKmlFromStorage() {
  try {
    const data = localStorage.getItem(KML_STORAGE_KEY);
    if (data) {
      state.allKmlData = JSON.parse(data);
      return state.allKmlData.length > 0;
    }
  } catch (e) {
    console.warn('Error leyendo KMLs de localStorage:', e);
  }
  return false;
}

export function clearKmlStorage() {
  localStorage.removeItem(KML_STORAGE_KEY);
  localStorage.removeItem(KML_STORAGE_MAP_KEY);
}

export function autoLoadSavedKmls() {
  if (loadKmlFromStorage()) {
    const savedMapName = localStorage.getItem(KML_STORAGE_MAP_KEY);
    let selectedIndex = 0;
    if (savedMapName) {
      const idx = state.allKmlData.findIndex(k => k.fileName.replace(/\.(kml|xml)$/i, '') === savedMapName);
      if (idx !== -1) selectedIndex = idx;
    }
    loadSelectedMap(selectedIndex);
    return true;
  }
  return false;
}

export function deleteKmlData(fileName) {
  const base = fileName.replace(/\.(kml|xml)$/i, '').toLowerCase();
  state.allKmlData = state.allKmlData.filter(k => {
    const kBase = k.fileName.replace(/\.(kml|xml)$/i, '').toLowerCase();
    return k.fileName !== fileName && kBase !== base;
  });
  saveKmlToStorage();
}
