const GVIZ_PREFIX_REGEX = /^[\s\S]*?google\.visualization\.Query\.setResponse\(/;
const GVIZ_SUFFIX_REGEX = /\);\s*$/;

export type SheetRecord = Record<string, string>;

function coerceCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function parseGvizResponse(text: string): unknown {
  const withoutPrefix = text.replace(GVIZ_PREFIX_REGEX, '');
  const withoutSuffix = withoutPrefix.replace(GVIZ_SUFFIX_REGEX, '');
  return JSON.parse(withoutSuffix);
}

function gvizTableToRecords(table: any): SheetRecord[] {
  const seen = new Map<string, number>();
  const colDefs: Array<{ label: string; type: string }> = (table?.cols ?? []).map((c: any, idx: number) => {
    let label = String(c?.label ?? '').trim();
    if (!label) label = `col_${idx}`;

    const count = seen.get(label) || 0;
    seen.set(label, count + 1);

    return {
      label: count > 0 ? `${label}_${count}` : label,
      type: String(c?.type ?? ''),
    };
  });

  const rows: any[] = table?.rows ?? [];
  return rows.map((r: any) => {
    const cells: any[] = r?.c ?? [];
    const record: SheetRecord = {};

    for (let i = 0; i < colDefs.length; i += 1) {
      const { label, type } = colDefs[i];
      const cell = cells[i];
      // For date/datetime columns the raw value (v) is a JS Date constructor
      // string like "Date(2026,3,1)" which cannot be parsed downstream.
      // Use the human-readable formatted value (f) instead, e.g. "Apr-2026".
      if (type === 'date' || type === 'datetime') {
        record[label] = String(cell?.f ?? cell?.v ?? '').trim();
      } else {
        record[label] = coerceCellValue(cell?.v ?? '').trim();
      }
    }

    return record;
  });
}

export async function fetchSheetTab(options: {
  spreadsheetId: string;
  sheetName: string;
}): Promise<SheetRecord[]> {
  const { spreadsheetId, sheetName } = options;

  const apiKey = (import.meta as any)?.env?.VITE_GOOGLE_SHEETS_API_KEY as string | undefined;
  if (apiKey && apiKey.trim()) {
    try {
      return await fetchSheetTabViaSheetsApi({ spreadsheetId, sheetName, apiKey: apiKey.trim() });
    } catch {
    }
  }

  return fetchSheetTabViaGviz({ spreadsheetId, sheetName });
}

function valuesToRecords(values: unknown): SheetRecord[] {
  const rows = Array.isArray(values) ? values : [];
  if (rows.length === 0) return [];

  const headerRow = Array.isArray(rows[0]) ? (rows[0] as unknown[]) : [];
  const seen = new Map<string, number>();
  const headers = headerRow.map((h, idx) => {
    let label = String(h ?? '').trim();
    if (!label) label = `col_${idx}`;
    
    const count = seen.get(label) || 0;
    seen.set(label, count + 1);
    
    if (count > 0) {
      return `${label}_${count}`;
    }
    return label;
  });

  const out: SheetRecord[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = Array.isArray(rows[r]) ? (rows[r] as unknown[]) : [];
    const record: SheetRecord = {};

    for (let c = 0; c < headers.length; c += 1) {
      record[headers[c]] = coerceCellValue(row[c]).trim();
    }

    out.push(record);
  }

  return out;
}

async function fetchSheetTabViaSheetsApi(options: {
  spreadsheetId: string;
  sheetName: string;
  apiKey: string;
}): Promise<SheetRecord[]> {
  const { spreadsheetId, sheetName, apiKey } = options;

  const range = `${sheetName}`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('majorDimension', 'ROWS');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet tab via Sheets API: ${sheetName} (${res.status})`);
  }

  const json: any = await res.json();
  return valuesToRecords(json?.values);
}

/**
 * Fetch a tab as a raw grid of strings (no header row assumed) — for summary/report
 * tabs whose layout is several labelled blocks rather than one table.
 *
 * Google's public gviz endpoint types each column by its majority value, so text
 * cells inside mostly-numeric columns (term names, "Fresh Enrolment" …) come back
 * blank when a whole tab is fetched at once. Fetching each row on its own keeps
 * every cell, so we read the grid size first and then request rows in parallel.
 */
export async function fetchSheetGrid(options: { spreadsheetId: string; sheetName: string }): Promise<string[][]> {
  const { spreadsheetId, sheetName } = options;

  const apiKey = (import.meta as any)?.env?.VITE_GOOGLE_SHEETS_API_KEY as string | undefined;
  if (apiKey && apiKey.trim()) {
    try {
      const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`);
      url.searchParams.set('key', apiKey.trim());
      url.searchParams.set('majorDimension', 'ROWS');
      const res = await fetch(url.toString());
      if (res.ok) {
        const json: any = await res.json();
        const values: unknown[][] = Array.isArray(json?.values) ? json.values : [];
        return values.map(r => (Array.isArray(r) ? r.map(c => coerceCellValue(c).trim()) : []));
      }
    } catch {
      // fall through to gviz
    }
  }

  const gvizCsv = async (range: string) => {
    const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
    url.searchParams.set('tqx', 'out:csv');
    url.searchParams.set('headers', '0');
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('range', range);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Failed to fetch sheet range: ${sheetName}!${range} (${res.status})`);
    return parseCsv(await res.text());
  };

  const whole = await gvizCsv('A1:ZZ500');
  const rowCount = whole.length;
  const rows: string[][] = new Array(rowCount);
  const BATCH = 12;
  for (let start = 0; start < rowCount; start += BATCH) {
    await Promise.all(
      Array.from({ length: Math.min(BATCH, rowCount - start) }, (_, k) => start + k).map(async i => {
        try {
          const one = await gvizCsv(`A${i + 1}:ZZ${i + 1}`);
          rows[i] = one[0] ?? [];
        } catch {
          rows[i] = whole[i] ?? []; // keep the numeric view if a single row fails
        }
      }),
    );
  }
  return rows.map(r => (r ?? []).map(c => (c ?? '').trim()));
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); out.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); out.push(row); }
  return out;
}

async function fetchSheetTabViaGviz(options: {
  spreadsheetId: string;
  sheetName: string;
}): Promise<SheetRecord[]> {
  const { spreadsheetId, sheetName } = options;

  const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json');
  url.searchParams.set('sheet', sheetName);
  url.searchParams.set('headers', '1');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet tab: ${sheetName} (${res.status})`);
  }

  const text = await res.text();
  const json: any = parseGvizResponse(text);

  const table = json?.table;
  if (!table) {
    throw new Error(`No table data returned for sheet tab: ${sheetName}`);
  }

  return gvizTableToRecords(table);
}
