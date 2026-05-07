import { useEffect, useState } from 'react';
import { SHEET_TABS } from '../lib/config';
import { fetchSheetTab, type SheetRecord } from '../lib/sheets';
import { useProgramConfig } from './useProgramConfig';

export type AcademicReviewRow = SheetRecord;

const BACKGROUND_REFRESH_MS = 60 * 1000;

export const ACADEMIC_REVIEW_SHEET_TAB = 'Academic Review';

export function useAcademicReviewData() {
    const { programId, config } = useProgramConfig();

    const [rows, setRows] = useState<AcademicReviewRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        let inFlight = false;
        let hadData = false;

        async function load(options?: { background?: boolean }) {
            const background = options?.background ?? false;
            if (inFlight) return;
            inFlight = true;

            if (!hadData && !background) setLoading(true);
            if (!background && !hadData) setError(null);

            try {
                const sheetName = (programId === 'dba' || programId === 'dba-dl') ? SHEET_TABS.gradesheet : ACADEMIC_REVIEW_SHEET_TAB;
                const data = await fetchSheetTab({
                    spreadsheetId: config.sheetId,
                    sheetName,
                });

                if (cancelled) return;

                const validRows = data.filter(r =>
                    Object.values(r).some(v => v && v.trim())
                );

                setRows(validRows);
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
