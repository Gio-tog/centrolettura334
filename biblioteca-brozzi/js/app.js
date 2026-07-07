/* ==================*=========================
   Centr* Lettura "Insieme per Brozzi" — Ca*alogo
   Legge il catalogo diretta*ente dal Google Sheet
   pubblicat* come CSV: si aggiorna da solo.
  *==================================*========= */

// URL del Google Sh*et pubblicato come CSV
const CSV_U*L = "https://docs.google.com/sprea*sheets/d/e/2PACX-1vTaPJfoXysoBeqtu*T4frjSF1MpZYff2NAgaCmsyTUwItatKDGf*dBxjkDYx17_Xyqq1cTpnnkHpXqB/pub?gi*=689097874&single=true&output=csv"*

const PAGE_SIZE = 30;

const SHO*CASE_CATEGORIES = ["Narrativa", "S*oria", "Scienza"];

const state = *
  books: [],
  filtered: [],
  di*playCount: PAGE_SIZE,
  query: "",*  showcase: [],
};

const els = {
* searchInput: document.getElementB*Id("searchInput"),
  clearSearch: *ocument.getElementById("clearSearc*"),
  filterCategoria: document.ge*ElementById("filterCategoria"),
  *ilterGenere: document.getElementBy*d("filterGenere"),
  sortBy: docum*nt.getElementById("sortBy"),
  gri*: document.getElementById("grid"),*  resultsCount: document.getElemen*ById("resultsCount"),
  emptyState* document.getElementById("emptySta*e"),
  loadMoreWrap: document.getE*ementById("loadMoreWrap"),
  loadM*re: document.getElementById("loadM*re"),
  statBooks: document.getEle*entById("statBooks"),
  statAuthor*: document.getElementById("statAut*ors"),
  statGenres: document.getE*ementById("statGenres"),
  lastUpd*ted: document.getElementById("last*pdated"),
  showcase: document.get*lementById("showcase"),
};

init()*

function init() {
  Papa.parse(C*V_URL, {
    download: true,
    h*ader: true,
    skipEmptyLines: tr*e,
    complete: (results) => {
  *   state.books = normalizeRows(res*lts.data);
      buildFilters(stat*.books);
      updateStats(state.b*oks);
      state.showcase = build*howcase(state.books);
      applyF*lters();
      els.lastUpdated.tex*Content =
        "Ultimo aggiorna*ento: " +
        new Date().toLoc*leDateString("it-IT", { day: "nume*ic", month: "long", year: "numeric* });
    },
    error: () => {
   *  els.resultsCount.textContent = "*mpossibile caricare il catalogo al*momento. Riprova più tardi.";
    *,
  });

  els.searchInput.addEven*Listener("input", debounce(onSearc*Input, 180));
  els.clearSearch.ad*EventListener("click", () => {
   *els.searchInput.value = "";
    on*earchInput();
    els.searchInput.*ocus();
  });

  els.filterCategor*a.addEventListener("change", apply*ilters);
  els.filterGenere.addEve*tListener("change", applyFilters);*  els.sortBy.addEventListener("cha*ge", applyFilters);

  els.loadMor*.addEventListener("click", () => {*    state.displayCount += PAGE_SIZ*;
    render();
  });
}

/* ------*--- Normalizzazione dati ---------* */

function normalizeRows(rows) *
  return rows
    .map((r) => ({
*     dewey: (r["C. Dewey"] || "").*rim(),
      inventario: (r["Inven*ario"] || "").trim(),
      catego*ia: normalizeCategoria((r["Macro c*llocazione"] || "").trim()),
     *collocazione: (r["Collocazione"] || "").trim(),
      autore: (r["Autore (nome e cognome)"] || "").trim(),
      titolo: (r["Titolo"] || "").trim(),
      genere: (r["Genere"] || "").trim(),
      editore: (r["Editore"] || "").trim(),
      anno: parseAnno(r["Anno"]),
    }))
    .filter((b) => b.titolo);
}

function normalizeCategoria(categoria) {
  if (categoria.toLowerCase() === "scienze") return "Scienza";
  if (categoria.toLowerCase() === "dizionario") return "Dizionari";
  return categoria;
}

function parseAnno(raw) {
  if (!raw) return null;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 1400 && n < 2100 ? n : null;
}

/* ---------- Filtri dropdown dinamici ---------- */

function buildFilters(books) {
  fillSelect(els.filterCategoria, uniqueSorted(books.map((b) => b.categoria)), "Tutte le categorie");
  fillSelect(els.filterGenere, uniqueSorted(books.map((b) => b.genere)), "Tutti i generi");
}

function updateAvailableFilters() {
  const categoriaAttiva = els.filterCategoria.value;
  const genereAttivo = els.filterGenere.value;

  const libriPerCategoria = state.books.filter((b) => !genereAttivo || b.genere === genereAttivo);
  const libriPerGenere = state.books.filter((b) => !categoriaAttiva || b.categoria === categoriaAttiva);

  const categorieDisponibili = uniqueSorted(libriPerCategoria.map((b) => b.categoria));
  const generiDisponibili = uniqueSorted(libriPerGenere.map((b) => b.genere));

  fillSelect(els.filterCategoria, categorieDisponibili, "Tutte le categorie", categoriaAttiva);
  fillSelect(els.filterGenere, generiDisponibili, "Tutti i generi", genereAttivo);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
}

function fillSelect(selectEl, values, defaultLabel, selectedValue = "") {
  selectEl.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = defaultLabel;
  selectEl.appendChild(first);

  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });

  selectEl.value = values.includes(selectedValue) ? selectedValue : "";
}

/* ---------- Ricerca a corrispondenza esatta ---------- */

function normalize(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const FIELD_RANK = { titolo: 0, autore: 1, genere: 2, editore: 3 };

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
  els.clearSearch.hidden = els.searchInput.value.trim() === "";
  applyFilters();
}

/* ---------- Applicazione filtri + ordinamento ---------- */

function applyFilters() {
  updateAvailableFilters();

  const query = els.searchInput.value.trim();
  const categoria = els.filterCategoria.value;
  const genere = els.filterGenere.value;
  const sortMode = els.sortBy.value;

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
      copy.sort((a, b) => (a.book.autore || "").localeCompare(b.book.autore || "", "it"));
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

/* ---------- Vetrina per categoria ---------- */

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
  if (!show || state.showcase.length === 0) {
    els.showcase.hidden = true;
    els.showcase.innerHTML = "";
    return;
  }

  els.showcase.hidden = false;

  els.showcase.innerHTML = state.showcase
    .map(
      (group) => `
      <div class="showcase__group">
        <div class="showcase__head">
          <h2 class="showcase__title">${escapeHtml(group.categoria)}</h2>
          <button class="showcase__link" data-categoria="${escapeHtml(group.categoria)}">
            Vedi tutti →
          </button>
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
      els.filterCategoria.value = btn.dataset.categoria;
      applyFilters();
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ---------- Render ---------- */

function render() {
  const total = state.filtered.length;
  const visible = state.filtered.slice(0, state.displayCount);

  const noFiltersActive =
    els.searchInput.value.trim() === "" &&
    els.filterCategoria.value === "" &&
    els.filterGenere.value === "";

  els.grid.innerHTML = visible.map(renderCard).join("");
  els.emptyState.hidden = total !== 0;
  els.grid.hidden = total === 0;

  els.resultsCount.innerHTML =
    total === 0
      ? ""
      : `<strong>${total.toLocaleString("it-IT")}</strong> ${total === 1 ? "libro trovato" : "libri trovati"}`;

  els.loadMoreWrap.hidden = state.displayCount >= total;

  renderShowcase(noFiltersActive);
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
      result += "<mark>" + escapeHtml(text.slice(start, end + 1)) + "</mark>";
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
    .replace(/"/g, "&quot;");
}

/* ---------- Statistiche header ---------- */

function updateStats(books) {
  const authors = new Set(books.map((b) => b.autore).filter(Boolean));
  const genres = new Set(books.map((b) => b.genere).filter(Boolean));

  animateCount(els.statBooks, books.length);
  animateCount(els.statAuthors, authors.size);
  animateCount(els.statGenres, genres.size);
}

function animateCount(el, target) {
  el.textContent = target.toLocaleString("it-IT");
}

/* ---------- Utility ---------- */

function debounce(fn, delay) {
  let t;

  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}
