// core/state.js — Estado mutable compartido por todos los módulos.

import { ADMIN_PASSWORD_DEFAULT } from './constants.js';

/**
 * Estado mutable compartido por todos los módulos de la app.
 * Se usa un único objeto para que las asignaciones sean visibles
 * en todos los módulos (los bindings importados son de solo lectura).
 */
export const state = {
  // Mapas y territorios
  loadedMaps: [],
  allKmlData: [],
  nextMapId: 0,
  activeMapFilter: null,
  generalView: false,

  // Selección y detalle
  selectedBlockKey: null,
  mobileZoomOnly: false,
  editingRecord: null,
  completionRecord: null,

  // Leaflet
  map: null,
  polygonLayerGroup: null,
  allBlockItems: [],
  polygonRefs: {},
  labelRefs: {},
  firstBlockSelected: false,

  // Administración
  adminPassword: ADMIN_PASSWORD_DEFAULT,
  isAdmin: false,
  passwordFetched: false,

  // Registros de visitas
  sheetRecords: [],
  recordsMap: {},
  recordsLoaded: false,
  recordsReady: Promise.resolve(),
};
