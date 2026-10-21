// features/search.js — Búsqueda de bloques en el mapa.

import { $blockList, $searchInput } from '../core/dom.js';
import { state } from '../core/state.js';
import { debounce } from '../core/utils.js';

const debouncedSearch = debounce((q) => {
  let blockVisible = 0;
  let blockTotal = 0;

  state.allBlockItems.forEach(item => {
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

/** Conecta el buscador del panel lateral. */
export function initSearch() {
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
}
