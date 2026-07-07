const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTaPJfoXysoBeqtu4T4frjSF1MpZYff2NAgaCmsyTUwItatKDGfgdBxjkDYx17Xyqq1cTpnnkHpXqB/pub?gid=689097874&single=true&output=csv";
const PAGE_SIZE = 30;
const SHOWCASE_CATEGORIES = ["Narrativa", "Storia", "Scienza"];
const FIELD_RANK = { titolo: 0, autore: 1, genere: 2, editore: 3 };

const state = {
  books: [],
  filtered: [],
  displayCount: PAGE_SIZE,
  showcase: [],
};

// Gli elementi verranno mappati solo al caricamento del DOM
let els = {};

document.addEventListener("DOMContentLoaded", () => {
  els = {
    searchInput: document.getElementById("searchInput"),
    clearSearch: document.getElementById("clearSearch"),
    filterCategoria: document.getElementById("filterCategoria"),
    filterGenere: document.getElementById("filterGenere"),
    sortBy: document.getElementById("sortBy"),
    grid: document.getElementById("grid"),
    resultsCount: document.getElementById("resultsCount"),
    emptyState: document.getElementById("emptyState"),
    loadMoreWrap: document.getElementById("loadMoreWrap"),
    loadMore: document.getElementById("loadMore"),
    statBooks: document.getElementById("statBooks"),
    statAuthors: document.getElementById("statAuthors"),
    statGenres: document.getElementById("statGenres"),
    lastUpdated: document.getElementById("lastUpdated"),
    showcase: document.getElementById("showcase"),
  };

  // Avvia l'applicazione in sicurezza
  init();
});

function init() {
  // Controllo di sicurezza: interrompe l'esecuzione se mancano elementi vitali nell'HTML
  if (!els.searchInput) {
    console.error("Errore: Elementi strutturali non trovati nell'HTML. Verifica gli ID.");
    return;
  }

  if (typeof Papa === "undefined") {
    console.error("Errore: La libreria PapaParse non è stata caricata. Controlla i tag in index.html.");
    return;
  }

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      state.books = normalizeRows(results.data);
      buildFilters(state.books);
      updateStats(state.books);
      state.showcase = buildShowcase(state.books);
      applyFilters();
      if (els.lastUpdated) {
        els.lastUpdated.textContent =
          "Ultimo aggiornamento: " +
          new Date().toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
      }
    },
    error: () => {
      if (els.resultsCount) {
        els.resultsCount.textContent =
          "Impossibile caricare il catalogo al momento. Riprova più tardi.";
      }
    },
  });

  els.searchInput.addEventListener("input", debounce(onSearchInput, 180));
  els.clearSearch.addEventListener("click", () => {
    els.searchInput.value = "";
    onSearchInput();
    els.searchInput.focus();
  });
  
  if (els.filterCategoria) els.filterCategoria.addEventListener("change", applyFilters);
  if (els.filterGenere) els.filterGenere.addEventListener("change", applyFilters);
  if (els.sortBy) els.sortBy.addEventListener("change", applyFilters);
  if (els.loadMore) {
    els.loadMore.addEventListener("click", () => {
      state.displayCount += PAGE_SIZE;
      render();
    });
  }
}

function normalizeRows(rows) {
  return rows
    .map((r) => ({
      dewey: (r["C. Dewey"] || "").trim(),
      inventario: (r["Inventario"] || "").trim(),
      categoria: normalizeCategoria((r["Macro collocazione"] || "").trim()),
      collocazione: (r["Collocazione"] || "").trim(),
      autore: (r["Autore (nome e cognome)"] || "").trim(),
      titolo: (r["Titolo"] || "").trim(),
      genere: (r["Genere"] || "").trim(),
      editore: (r["Editore"] || "").trim(),
      anno: parseAnno(r["Anno"]),
    }))
    .filter((b) => b.titolo);
}

function normalizeCategoria(categoria) {
  const c = String(categoria || "").trim().toLowerCase();
  if (c === "scienze") return "Scienza";
  if (c === "dizionario") return "Dizionari";
  return categoria;
}

function parseAnno(raw) {
  if (!raw) return null;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 1400 && n < 2100 ? n : null;
}

function buildFilters(books) {
  if (els.filterCategoria) fillSelect(els.filterCategoria, uniqueSorted(books.map((b) => b.categoria)));
  if (els.filterGenere) fillSelect(els.filterGenere, uniqueSorted(books.map((b) => b.genere)));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "it")
  );
}

function fillSelect(selectEl, values) {
  // Pulisce le vecchie opzioni mantenendo solo la prima (es. "Tutte")
  while (selectEl.options.length > 1) {
    selectEl.remove(1);
  }
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function normalize(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function searchBooks(query) {
  const nq = normalize(query.trim());
  if (!nq) return [];

  const results = [];

  for (const book of state.books) {
    const idxTitolo = normalize(book.titolo).indexOf(nq);
    const idxAutore = normalize(book.autore).indexOf(nq);
    const idxGenere = normalize(book.genere).indexOf(nq);
    const idxEditore = normalize(book.editore).indexOf(nq);

    let field = null;
    let idx = -1;

    if (idxTitolo !== -1) {
      field = "titolo";
      idx = idxTitolo;
    } else if (idxAutore !== -1) {
      field = "autore";
      idx = idxAutore;
    } else if (idxGenere !== -1) {
      field = "genere";
      idx = idxGenere;
    } else if (idxEditore !== -1) {
      field = "editore";
      idx = idxEditore;
    }

    if (field) results.push({ book, field, idx, queryLength: nq.length });
  }

  results.sort(
    (a, b) =>
      FIELD_RANK[a.field] - FIELD_RANK[b.field] ||
      a.idx - b.idx ||
      a.book.titolo.localeCompare(b.book.titolo, "it")
  );

  return results;
}

function onSearchInput() {
  if (els.clearSearch) els.clearSearch.hidden = els.searchInput.value.trim() === "";
  applyFilters();
}

function applyFilters() {
  const query = els.searchInput ? els.searchInput.value.trim() : "";
  const categoria = els.filterCategoria ? els.filterCategoria.value : "";
  const genere = els.filterGenere ? els.filterGenere.value : "";
  const sortMode = els.sortBy ? els.sortBy.value : "titolo-asc";

  let items;

  if (query.length > 0) {
    const results = searchBooks(query);
    items = results
      .filter(
        (r) =>
          (!categoria || r.book.categoria === categoria) &&
          (!genere || r.book.genere === genere)
      )
      .map((r) => ({ book: r.book, match: r }));
  } else {
    items = state.books
      .filter(
        (b) =>
          (!categoria || b.categoria === categoria) &&
          (!genere || b.genere === genere)
      )
      .map((b) => ({ book: b, match: null }));
  }

  if (!(query.length > 0 && sortMode === "rilevanza")) {
    items = sortItems(items, sortMode === "rilevanza" ? "titolo-asc" : sortMode);
  }

  state.filtered = items;
  state.displayCount = PAGE_SIZE;
  render();
}

function sortItems(items, mode) {
  const copy = [...items];
  switch (mode) {
    case "titolo-asc":
      copy.sort((a, b) => a.book.titolo.localeCompare(b.book.titolo, "it"));
      break;
    case "autore-asc":
      copy.sort((a, b) =>
        (a.book.autore || "").localeCompare(b.book.autore || "", "it")
      );
      break;
    case "anno-desc":
      copy.sort((a, b) => (b.book.anno || 0) - (a.book.anno || 0));
      break;
    case "anno-asc":
      copy.sort((a, b) => (a.book.anno || 9999) - (b.book.anno || 9999));
      break;
  }
  return copy;
}

function buildShowcase(books) {
  return SHOWCASE_CATEGORIES.map((categoria) => {
    const inCategoria = books.filter((b) => b.categoria === categoria);
    return { categoria, sample: sampleRandom(inCategoria, 3) };
  }).filter((group) => group.sample.length > 0);
}

function sampleRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function renderShowcase(show) {
  if (!els.showcase) return;
  
  if (!show || show.length === 0) {
    els.showcase.hidden = true;
    els.showcase.innerHTML = "";
    return;
  }

  els.showcase.hidden = false;
  els.showcase.innerHTML = show
    .map(
      (group) => `
        <div class="showcase__group">
          <div class="showcase__head">
            <h2 class="showcase__title">${escapeHtml(group.categoria)}</h2>
            <button class="showcase__link" data-categoria="${escapeHtml(group.categoria)}">Vedi tutti →</button>
          </div>
          <div class="grid grid--showcase">
            ${group.sample.map((book) => renderCard({ book, match: null })).join("")}
          </div>
        </div>
      `
    )
    .join("");

  els.showcase.querySelectorAll(".showcase__link").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (els.filterCategoria) els.filterCategoria.value = btn.dataset.categoria;
      applyFilters();
      const catEl = document.getElementById("catalogo");
      if (catEl) {
        catEl.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });
}

function render() {
  const total = state.filtered.length;
  const visible = state.filtered.slice(0, state.displayCount);
  const noFiltersActive =
    (els.searchInput ? els.searchInput.value.trim() : "") === "" &&
    (els.filterCategoria ? els.filterCategoria.value : "") === "" &&
    (els.filterGenere ? els.filterGenere.value : "") === "";

  if (els.grid) els.grid.innerHTML = visible.map(renderCard).join("");
  if (els.emptyState) els.emptyState.hidden = total !== 0;
  if (els.grid) els.grid.hidden = total === 0;

  if (els.resultsCount) {
    els.resultsCount.innerHTML =
      total === 0
        ? ""
        : `<strong>${total.toLocaleString("it-IT")}</strong> ${
            total === 1 ? "libro trovato" : "libri trouvati"
          }`;
  }

  if (els.loadMoreWrap) els.loadMoreWrap.hidden = state.displayCount >= total;
  renderShowcase(noFiltersActive ? state.showcase : []);
}

function renderCard({ book, match }) {
  const highlights = buildHighlightMap(match);
  const titolo = highlight(book.titolo, highlights.titolo);
  const autore = highlight(book.autore || "Autore non indicato", highlights.autore);

  return `
    <article class="book-card">
      <h3 class="book-card__title">${titolo}</h3>
      <p class="book-card__author">${autore}</p>
      <hr class="book-card__divider">
      <div class="book-card__meta">
        ${book.genere ? `<span class="chip">${escapeHtml(book.genere)}</span>` : ""}
        <span class="book-card__year">${book.anno || "anno non indicato"}</span>
      </div>
    </article>
  `;
}

function buildHighlightMap(match) {
  const map = { titolo: null, autore: null };
  if (!match) return map;
  if (match.field === "titolo") map.titolo = [[match.idx, match.idx + match.queryLength - 1]];
  if (match.field === "autore") map.autore = [[match.idx, match.idx + match.queryLength - 1]];
  return map;
}

function highlight(text, indices) {
  if (!indices || indices.length === 0) return escapeHtml(text);

  let result = "";
  let last = 0;

  indices
    .slice()
    .sort((a, b) => a[0] - b[0])
    .forEach(([start, end]) => {
      if (start < last) return;
      result += escapeHtml(text.slice(last, start));
      result += `<mark>${escapeHtml(text.slice(start, end + 1))}</mark>`;
      last = end + 1;
    });

  result += escapeHtml(text.slice(last));
  return result;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function updateStats(books) {
  const authors = new Set(books.map((b) => b.autore).filter(Boolean));
  const genres = new Set(books.map((b) => b.genere).filter(Boolean));
  if (els.statBooks) animateCount(els.statBooks, books.length);
  if (els.statAuthors) animateCount(els.statAuthors, authors.size);
  if (els.statGenres) animateCount(els.statGenres, genres.size);
}

function animateCount(el, target) {
  el.textContent = target.toLocaleString("it-IT");
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
