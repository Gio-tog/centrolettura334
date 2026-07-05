# Catalogo — Centro Lettura "Insieme per Brozzi"

Sito statico che mostra il catalogo libri della biblioteca, con ricerca e filtri.
I dati vengono letti **in tempo reale** dal Google Sheet pubblicato come CSV:
quando aggiorni il foglio, il sito mostra automaticamente le nuove righe al
successivo caricamento della pagina — non serve rifare nessun deploy.

## Struttura del progetto

```
biblioteca-brozzi/
├── index.html      → struttura della pagina (banner + catalogo)
├── css/style.css   → stile grafico
├── js/app.js       → lettura del Google Sheet, ricerca e filtri
└── README.md
```

## Come funziona il collegamento al Google Sheet

In `js/app.js`, in cima al file, trovi questa riga:

```js
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?...output=csv";
```

Questo è il link di pubblicazione CSV del tuo foglio (**File → Condividi →
Pubblica sul web**). Il sito lo scarica ogni volta che qualcuno apre la
pagina, quindi le modifiche che fai nel foglio (nuovi libri, correzioni,
libri rimossi) compaiono automaticamente, senza bisogno di intervenire
sul sito.

**Importante:** finché quella pubblicazione resta attiva su Google Sheets,
il sito continuerà a leggere i dati aggiornati. Se in futuro cambi foglio
o lo ripubblichi, dovrai aggiornare questo link.

## Come pubblicare il sito su Vercel

**Opzione consigliata — tramite GitHub:**
1. Crea un repository su GitHub e carica il contenuto di questa cartella.
2. Vai su [vercel.com](https://vercel.com) → "Add New Project" → collega
   il repository GitHub.
3. Vercel riconosce che è un sito statico: lascia le impostazioni di
   default (Framework Preset: "Other") e clicca "Deploy".
4. In circa un minuto il sito è online con un indirizzo tipo
   `nome-progetto.vercel.app`.

**Opzione rapida — Vercel CLI (senza GitHub):**
```bash
npm install -g vercel
cd biblioteca-brozzi
vercel
```
Segui le istruzioni a schermo (basta rispondere alle domande di default).

## Aggiornare il catalogo

Non serve fare nulla sul sito: basta modificare righe nel Google Sheet
originale. La pubblicazione CSV di Google si aggiorna da sola nel giro
di qualche minuto, e il sito rilegge sempre l'ultima versione a ogni
visita.

## Personalizzare grafica e testi

- Titolo, tagline e testo del banner: `index.html`, sezione `<header class="hero">`.
- Colori: variabili all'inizio di `css/style.css` (sotto `:root`).
- Numero di libri mostrati per pagina: costante `PAGE_SIZE` in `js/app.js`.
