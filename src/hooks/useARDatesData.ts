import { useEffect, useState } from 'react';
import { fetchSheetTab, type SheetRecord } from '../lib/sheets';
import { useProgramConfig } from './useProgramConfig';

const BACKGROUND_REFRESH_MS = 60 * 1000;

export function useARDatesData() {
    const { config } = useProgramConfig();

    const [rows, setRows] = useState<SheetRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let suspended = false;
        let inFlight = false;
        let hadData = false;

        async function load(options?: { background?: boolean }) {
            const background = options?.background ?? false;
            if (inFlight) return;
            inFlight = true;

            if (!hadData && !background) setLoading(true);
            if (!background && !hadData) setError(null);

            try {
                const data = await fetchSheetTab({
                    spreadsheetId: config.sheetId,
                    sheetName: 'AR dates',
                });

                if (suspended) return;

                setRows(data);
                hadData = true;
                if (!background) setError(null);
            } catch (err: any) {
                if (suspended) return;
                console.error('[useARDatesData] Error loading info:', err);
                if (!hadData) {
                    setError(err.message || 'Failed to load AR dates data');
                }
            } finally {
                if (!suspended) {
                    setLoading(false);
                }
                inFlight = false;
            }
        }

        load();

        const handleFocus = () => load({ background: true });
        window.addEventListener('focus', handleFocus);

        const timer = setInterval(() => load({ background: true }), BACKGROUND_REFRESH_MS);

        return () => {
            suspended = true;
            window.removeEventListener('focus', handleFocus);
            clearInterval(timer);
        };
    }, [config.sheetId]);

    return {
        rows: rows || [],
        loading,
        error
    };
}
