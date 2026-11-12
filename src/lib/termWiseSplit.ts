/**
 * Parser for the "Term Wise Split" summary tab.
 *
 * The tab is a report, not a table: it holds several labelled blocks
 * (e.g. "Term on Term Active", "Term on Term Fresh Enrolment", one
 * "Learner Type" block per segment). Columns move around as terms are added,
 * so nothing here relies on positions — every block is found by its labels:
 *
 *   <title>            [<segment>]          ← e.g. "Learner Type" | "India"
 *   ...                                     ← optional extra label rows
 *   Program Name  <col header> <col header> ← anchor row (merged cells forward-filled)
 *                 <metric>     <metric>     ← optional rows, e.g. "Active", "Fresh Enrolment"
 *   GGU DBA       79           0
 *   ...
 *   Total         …                         ← ignored (we total ourselves)
 */

export interface TermCode {
  code: string;      // "26/SA"
  year: number;      // 2026
  season: string;    // "Spring"
  session: string;   // "A"
  label: string;     // "Spring A"
  sortKey: number;
}

export interface TermSeries {
  /** Term codes in chronological order. */
  terms: string[];
  /** Program names in sheet order. */
  programs: string[];
  /** values[program][term] */
  values: Record<string, Record<string, number>>;
}

export interface LearnerTypePeriod {
  label: string;          // "Spring Total" / "Spring A 2026"
  season: string;         // "Spring"
  year: number;           // 2026 (season totals inherit it from their sessions)
  session: string;        // "A" for "Spring A 2026"; "" for a season total
  /** "Spring 2026" — the term this column belongs to. */
  term: string;
  isTotal: boolean;       // a season roll-up column
  fresh: Record<string, number>;       // by program
  continuing: Record<string, number>;  // by program
}

export interface LearnerTypeBlock {
  segment: string;        // "International" | "India" | "SA" …
  programs: string[];
  periods: LearnerTypePeriod[];
}

export interface TermWiseSplit {
  active: TermSeries;
  fresh: TermSeries;
  learnerTypes: LearnerTypeBlock[];
}

const SEASONS: Record<string, { name: string; order: number }> = {
  W: { name: 'Winter', order: 0 },
  S: { name: 'Spring', order: 1 },
  U: { name: 'Summer', order: 2 },
  F: { name: 'Fall', order: 3 },
};
const SEASON_ORDER: Record<string, number> = { winter: 0, spring: 1, summer: 2, fall: 3, autumn: 3 };

/** "26/SA" → Spring A 2026. Unknown shapes keep their raw text. */
export function parseTermCode(code: string): TermCode {
  const m = code.trim().match(/^(\d{2})\s*\/\s*([A-Za-z])([A-Za-z0-9]?)$/);
  if (m) {
    const year = 2000 + Number(m[1]);
    const s = SEASONS[m[2].toUpperCase()];
    const session = (m[3] || '').toUpperCase();
    if (s) {
      return {
        code, year, season: s.name, session,
        label: `${s.name}${session ? ` ${session}` : ''}`,
        sortKey: year * 1000 + s.order * 100 + (session ? session.charCodeAt(0) - 64 : 0),
      };
    }
  }
  return { code, year: 0, season: '', session: '', label: code, sortKey: Number.MAX_SAFE_INTEGER };
}

export const termLabel = (code: string) => parseTermCode(code).label;

function seasonOf(label: string): string {
  const m = label.toLowerCase().match(/\b(winter|spring|summer|fall|autumn)\b/);
  return m ? m[1][0].toUpperCase() + m[1].slice(1) : '';
}

const norm = (s: string) => (s || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const toNum = (s: string) => {
  const n = Number(norm(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const isProgramNameCell = (s: string) => norm(s).toLowerCase() === 'program name';
const isTotalLabel = (s: string) => /^(grand\s+)?total$/i.test(norm(s));

interface RawBlock {
  title: string;
  segment: string;
  /** one entry per data column: forward-filled anchor header + metric rows below it */
  columns: Array<{ header: string; metric: string }>;
  rows: Array<{ program: string; cells: string[] }>;
}

function extractBlocks(grid: string[][]): RawBlock[] {
  const cell = (r: number, c: number) => norm(grid[r]?.[c] ?? '');
  const blocks: RawBlock[] = [];

  for (let r = 0; r < grid.length; r += 1) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c += 1) {
      if (!isProgramNameCell(grid[r][c])) continue;

      // Title: nearest label above the anchor in the same column (stop at a gap of 3 blank rows).
      let title = '';
      let segment = '';
      for (let up = r - 1, blanks = 0; up >= 0 && blanks < 3; up -= 1) {
        const t = cell(up, c);
        if (!t) { blanks += 1; continue; }
        title = t;
        segment = cell(up, c + 1);
        break;
      }

      // Data rows: first non-empty label below the anchor, until the first empty one.
      let first = r + 1;
      while (first < grid.length && !cell(first, c)) first += 1;
      // The rows between the anchor and the first program row are metric header rows.
      const metricRows: number[] = [];
      for (let m = r + 1; m < first; m += 1) metricRows.push(m);

      const dataRows: number[] = [];
      for (let d = first; d < grid.length && cell(d, c); d += 1) {
        if (isProgramNameCell(grid[d][c])) break;
        dataRows.push(d);
      }
      if (dataRows.length === 0) continue;

      // Columns: to the right of the anchor until a column that is empty in every
      // header and data row (the separator between side-by-side blocks).
      const columns: RawBlock['columns'] = [];
      let lastHeader = '';
      for (let col = c + 1; col < 1000; col += 1) {
        const header = cell(r, col);
        const metric = metricRows.map(m => cell(m, col)).filter(Boolean).join(' · ');
        const anyData = dataRows.some(d => cell(d, col) !== '');
        if (!header && !metric && !anyData) break;
        if (isProgramNameCell(header)) break;
        if (header) lastHeader = header;
        columns.push({ header: header || lastHeader, metric });
      }

      blocks.push({
        title,
        segment,
        columns,
        rows: dataRows.map(d => ({ program: cell(d, c), cells: columns.map((_, i) => cell(d, c + 1 + i)) })),
      });
    }
  }
  return blocks;
}

function seriesFromBlock(block: RawBlock | undefined): TermSeries {
  if (!block) return { terms: [], programs: [], values: {} };
  const termCols = block.columns
    .map((col, i) => ({ code: col.header, i }))
    .filter(t => t.code && !isTotalLabel(t.code));
  const terms = Array.from(new Set(termCols.map(t => t.code)))
    .sort((a, b) => parseTermCode(a).sortKey - parseTermCode(b).sortKey);

  const values: Record<string, Record<string, number>> = {};
  const programs: string[] = [];
  for (const row of block.rows) {
    if (isTotalLabel(row.program)) continue;
    programs.push(row.program);
    values[row.program] = {};
    for (const t of termCols) values[row.program][t.code] = (values[row.program][t.code] || 0) + toNum(row.cells[t.i]);
  }
  return { terms, programs, values };
}

function learnerTypeFromBlock(block: RawBlock): LearnerTypeBlock {
  const periodsByLabel = new Map<string, LearnerTypePeriod & { col: number }>();
  const order: string[] = [];
  const programs = block.rows.map(r => r.program).filter(p => !isTotalLabel(p));

  block.columns.forEach((col, i) => {
    if (!col.header) return;
    const metric = col.metric.toLowerCase();
    const kind = metric.includes('fresh') || metric.includes('new') ? 'fresh'
      : metric.includes('contin') ? 'continuing' : null;
    if (!kind) return;
    let p = periodsByLabel.get(col.header);
    if (!p) {
      const isTotal = /total/i.test(col.header);
      const yearMatch = col.header.match(/\b(20\d{2})\b/);
      const season = seasonOf(col.header);
      const sessionMatch = isTotal || !season ? null : col.header.match(new RegExp(String.raw`${season}\s+([A-Za-z])\b`, 'i'));
      p = {
        label: col.header, season, isTotal, col: i,
        year: yearMatch ? Number(yearMatch[1]) : 0,
        session: sessionMatch ? sessionMatch[1].toUpperCase() : '',
        term: '', fresh: {}, continuing: {},
      };
      periodsByLabel.set(col.header, p);
      order.push(col.header);
    }
    for (const row of block.rows) {
      if (isTotalLabel(row.program)) continue;
      p[kind][row.program] = (p[kind][row.program] || 0) + toNum(row.cells[i]);
    }
  });

  const all = order.map(l => periodsByLabel.get(l)!);
  // "Spring Total" carries no year: take it from the nearest session column of the same season.
  const dated = all.filter(p => p.year > 0);
  const fallbackYear = dated.length ? Math.max(...dated.map(p => p.year)) : new Date().getFullYear();
  for (const p of all) {
    if (!p.year) {
      const near = dated
        .filter(d => d.season === p.season)
        .sort((a, b) => Math.abs(a.col - p.col) - Math.abs(b.col - p.col))[0];
      p.year = near?.year ?? fallbackYear;
    }
    p.term = `${p.season || p.label} ${p.year}`.trim();
  }
  const seasonRank = (p: LearnerTypePeriod) => SEASON_ORDER[p.season.toLowerCase()] ?? 9;
  all.sort((a, b) => a.year - b.year || seasonRank(a) - seasonRank(b)
    || Number(b.isTotal) - Number(a.isTotal) || a.session.localeCompare(b.session));
  const periods: LearnerTypePeriod[] = all.map(({ col: _col, ...rest }) => rest);
  return { segment: block.segment || block.title, programs, periods };
}

export function parseTermWiseSplit(grid: string[][]): TermWiseSplit {
  const blocks = extractBlocks(grid);
  const lower = (s: string) => s.toLowerCase();
  const activeBlock = blocks.find(b => lower(b.title).includes('active') || b.columns.some(c => lower(c.metric) === 'active'));
  const freshBlock = blocks.find(b => b !== activeBlock && !lower(b.title).includes('learner type')
    && (lower(b.title).includes('fresh') || b.columns.every(c => !c.metric || lower(c.metric).includes('fresh'))));
  const learnerTypes = blocks
    .filter(b => lower(b.title).includes('learner type') || b.columns.some(c => lower(c.metric).includes('contin')))
    .map(learnerTypeFromBlock)
    .filter(b => b.periods.length > 0);

  return {
    active: seriesFromBlock(activeBlock),
    fresh: seriesFromBlock(freshBlock),
    learnerTypes,
  };
}

/** Sum a series across the given programs (all when omitted). */
export function totalsByTerm(series: TermSeries, programs?: string[]): Array<{ term: string; value: number }> {
  const progs = programs ?? series.programs;
  return series.terms.map(term => ({
    term,
    value: progs.reduce((s, p) => s + (series.values[p]?.[term] ?? 0), 0),
  }));
}

export interface FreshContinuing { fresh: number; continuing: number }
export interface SessionMix extends FreshContinuing { session: string; label: string }
export interface TermMix extends FreshContinuing {
  term: string;     // "Fall 2026"
  year: number;
  season: string;
  /** One entry per learner type (International, India, SA …). */
  segments: Array<FreshContinuing & { segment: string; sessions: SessionMix[] }>;
  /** One entry per program, with its split by learner type. */
  programs: Array<FreshContinuing & { program: string; bySegment: Record<string, FreshContinuing> }>;
  /** Sessions within the term, summed across learner types. */
  sessions: SessionMix[];
}

/**
 * Fresh vs continuing learners per term (e.g. "Fall 2026"), oldest first.
 * Season totals come from the sheet's "<Season> Total" column when present,
 * otherwise from the sum of that season's session columns. New terms added to
 * the tab show up here automatically.
 */
export function freshContinuingByTerm(split: TermWiseSplit, programs?: string[]): TermMix[] {
  const keep = (p: string) => !programs || programs.includes(p);
  const sum = (rec: Record<string, number>) => Object.entries(rec).reduce((a, [p, n]) => a + (keep(p) ? n : 0), 0);
  const add = (a: FreshContinuing, b: FreshContinuing) => { a.fresh += b.fresh; a.continuing += b.continuing; };
  const terms = new Map<string, TermMix>();

  for (const block of split.learnerTypes) {
    const byTerm = new Map<string, LearnerTypePeriod[]>();
    for (const p of block.periods) byTerm.set(p.term, [...(byTerm.get(p.term) ?? []), p]);

    for (const [term, ps] of byTerm) {
      const total = ps.find(p => p.isTotal);
      const sessions: SessionMix[] = ps.filter(p => !p.isTotal).map(p => ({
        session: p.session,
        label: p.session ? `${p.season} ${p.session}` : p.label,
        fresh: sum(p.fresh),
        continuing: sum(p.continuing),
      }));
      const seg = { segment: block.segment, fresh: 0, continuing: 0, sessions };
      if (total) add(seg, { fresh: sum(total.fresh), continuing: sum(total.continuing) });
      else sessions.forEach(s => add(seg, s));

      let t = terms.get(term);
      if (!t) {
        t = { term, year: ps[0].year, season: ps[0].season, fresh: 0, continuing: 0, segments: [], sessions: [], programs: [] };
        terms.set(term, t);
      }
      t.segments.push(seg);

      // Per program: the season total column if present, else the sum of its sessions.
      for (const src of total ? [total] : ps.filter(p => !p.isTotal)) {
        for (const prog of new Set([...Object.keys(src.fresh), ...Object.keys(src.continuing)])) {
          if (!keep(prog)) continue;
          const v = { fresh: src.fresh[prog] || 0, continuing: src.continuing[prog] || 0 };
          let row = t.programs.find(x => x.program === prog);
          if (!row) { row = { program: prog, fresh: 0, continuing: 0, bySegment: {} }; t.programs.push(row); }
          add(row, v);
          row.bySegment[block.segment] ??= { fresh: 0, continuing: 0 };
          add(row.bySegment[block.segment], v);
        }
      }
      add(t, seg);
      for (const s of sessions) {
        const cur = t.sessions.find(x => x.label === s.label);
        if (cur) add(cur, s); else t.sessions.push({ ...s });
      }
    }
  }

  const rank = (s: string) => SEASON_ORDER[s.toLowerCase()] ?? 9;
  return Array.from(terms.values()).sort((a, b) => a.year - b.year || rank(a.season) - rank(b.season));
}

/** Every calendar year that appears anywhere in the tab, newest first. */
export function splitYears(split: TermWiseSplit): number[] {
  const set = new Set<number>();
  [...split.active.terms, ...split.fresh.terms].forEach(t => { const y = parseTermCode(t).year; if (y) set.add(y); });
  split.learnerTypes.forEach(b => b.periods.forEach(p => { if (p.year) set.add(p.year); }));
  return Array.from(set).sort((a, b) => b - a);
}

const SEASON_LETTER: Record<string, string> = { winter: 'W', spring: 'S', summer: 'U', fall: 'F', autumn: 'F' };

/**
 * Session-level series from the Learner Type blocks (summed across learner
 * types), keyed by term code ("26/SA") so charts can label them like the sheet.
 * active = fresh + continuing learners in that session.
 */
export function sessionSeries(split: TermWiseSplit, programs?: string[]): Array<{ term: string; fresh: number; continuing: number; active: number }> {
  const out: Array<{ term: string; fresh: number; continuing: number; active: number }> = [];
  for (const t of freshContinuingByTerm(split, programs)) {
    const letter = SEASON_LETTER[t.season.toLowerCase()];
    if (!letter || !t.year) continue;
    for (const s of t.sessions) {
      if (!s.session) continue;
      out.push({
        term: `${String(t.year).slice(-2)}/${letter}${s.session}`,
        fresh: s.fresh,
        continuing: s.continuing,
        active: s.fresh + s.continuing,
      });
    }
  }
  return out.sort((a, b) => parseTermCode(a.term).sortKey - parseTermCode(b.term).sortKey);
}

/** Programs that appear in any Learner Type block. */
export function learnerTypePrograms(split: TermWiseSplit): string[] {
  return Array.from(new Set(split.learnerTypes.flatMap(b => b.programs)));
}

/**
 * Active (fresh + continuing) and new-enrolment (fresh) series per program and
 * session, built only from the Learner Type blocks.
 */
export function learnerTypeSeries(split: TermWiseSplit): { active: TermSeries; fresh: TermSeries } {
  const programs = learnerTypePrograms(split);
  const active: TermSeries = { terms: [], programs, values: {} };
  const fresh: TermSeries = { terms: [], programs, values: {} };
  const terms = new Set<string>();
  for (const p of programs) {
    active.values[p] = {};
    fresh.values[p] = {};
    for (const s of sessionSeries(split, [p])) {
      terms.add(s.term);
      active.values[p][s.term] = s.active;
      fresh.values[p][s.term] = s.fresh;
    }
  }
  const sorted = Array.from(terms).sort((a, b) => parseTermCode(a).sortKey - parseTermCode(b).sortKey);
  active.terms = sorted;
  fresh.terms = [...sorted];
  return { active, fresh };
}
