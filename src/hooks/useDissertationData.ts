import { useEffect, useState } from 'react';
import { SHEET_TABS } from '../lib/config';
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

            // MBA and DBA DL don't have a dissertation tab
            if (programId === 'mba' || programId === 'dba-dl') {
                if (!background) setLoading(false);
                setRows([]);
                return;
            }

            if (inFlight) return;
            inFlight = true;

            if (!hadData && !background) setLoading(true);
            if (!background && !hadData) setError(null);

            try {
                const data = await fetchSheetTab({
                    spreadsheetId: config.sheetId,
                    sheetName: SHEET_TABS.dissertation,
                });

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
