// features/upload.js — Carga y reemplazo de archivos KML.

import { state } from '../core/state.js';
import { $fileUpload, $fileUploadEmpty } from '../core/dom.js';
import { parseKMLBlocks } from '../services/kml.js';
import { saveKmlToStorage } from '../services/storage.js';
import { saveAllKmlsToSheet } from '../services/sheets.js';
import { openMapSelector } from './selector.js';

/** Lee los KML seleccionados y actualiza la lista de mapas. */
export function handleKmlFiles(fileList) {
  if (!state.isAdmin) return;

  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  let loadedCount = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const blocks = parseKMLBlocks(evt.target.result);
      if (blocks.length > 0) {
        const existingIndex = state.allKmlData.findIndex(k => k.fileName === file.name);
        if (existingIndex !== -1) {
          state.allKmlData[existingIndex] = { fileName: file.name, blocks: blocks };
        } else {
          state.allKmlData.push({ fileName: file.name, blocks: blocks });
        }
      }
      loadedCount++;
      if (loadedCount === files.length) {
        saveKmlToStorage();
        if (state.isAdmin) saveAllKmlsToSheet();
        openMapSelector();
      }
    };
    reader.readAsText(file);
  });
}

/** Conecta los dos inputs de carga de KML (sidebar y estado vacío). */
export function initUpload() {
  const onChange = (e) => {
    if (!state.isAdmin) {
      e.target.value = '';
      return;
    }
    handleKmlFiles(e.target.files);
    e.target.value = '';
  };

  $fileUpload.addEventListener('change', onChange);
  $fileUploadEmpty.addEventListener('change', onChange);
}
