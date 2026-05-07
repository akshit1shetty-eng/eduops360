import { useParams } from 'react-router-dom';
import { PROGRAMS, type ProgramId } from '../lib/config';

export function useProgramConfig() {
    const { programId } = useParams<{ programId: string }>();

    // Default to dba-et if invalid programId
    const id = (programId && programId in PROGRAMS) ? (programId as ProgramId) : 'dba-et';

    return {
        programId: id,
        config: PROGRAMS[id]
    };
}
