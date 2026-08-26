import { useEffect, useState } from 'react';
import { GGU_STUDENT_LIST_SHEET_ID, SHEET_TABS } from '../lib/config';
import { fetchSheetTab, type SheetRecord } from '../lib/sheets';
import { useProgramConfig } from './useProgramConfig';

export type DissertationRow = SheetRecord;

const BACKGROUND_REFRESH_MS = 60 * 1000;

export function useDissertationData() {
    const { programId, config } = useProgramConfig();

    const [rows, setRows] = useState<DissertationRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        let inFlight = false;
        let hadData = false;

        async function load(options?: { background?: boolean }) {
            const background = options?.background ?? false;

            // MBA doesn't have a dissertation tab
            if (programId === 'mba') {
                if (!background) setLoading(false);
                setRows([]);
                return;
            }

            if (inFlight) return;
            inFlight = true;

            if (!hadData && !background) setLoading(true);
            if (!background && !hadData) setError(null);

            try {
                let data: DissertationRow[] = [];
                try {
                    const res = await fetchSheetTab({
                        spreadsheetId: GGU_STUDENT_LIST_SHEET_ID,
                        sheetName: SHEET_TABS.dissertationSummary,
                    });
                    data = Array.isArray(res) ? res : [];
                } catch {
                    // Fallback to program sheet or dissertation tab if Dissertation Summary not found
                    const res = await fetchSheetTab({
                        spreadsheetId: config.sheetId,
                        sheetName: SHEET_TABS.dissertation,
                    });
                    data = Array.isArray(res) ? res : [];
                }

                if (cancelled) return;
                setRows(data);
                hadData = true;
            } catch (e) {
                if (cancelled) return;
                if (!hadData && !background) {
                    setError(e instanceof Error ? e.message : 'Unknown error');
                }
            } finally {
                if (cancelled) return;
                if (!background) setLoading(false);
                inFlight = false;
            }
        }

        load();

        const interval = window.setInterval(() => {
            void load({ background: true });
        }, BACKGROUND_REFRESH_MS);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [programId, config.sheetId]);

    return { loading, error, rows: rows ?? [] };
}
