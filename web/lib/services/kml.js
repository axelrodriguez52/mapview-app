// services/kml.js — Lectura de archivos KML y conversión a bloques.

export function parseKMLBlocks(text) {
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
