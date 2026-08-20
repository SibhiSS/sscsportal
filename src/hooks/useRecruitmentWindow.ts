import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Shape returned by the `recruitment_window()` RPC
 * (src/database/migration_recruitment_window.sql).
 */
export interface RecruitmentWindow {
    /** The authoritative verdict — the same expression the RLS policy evaluates. */
    isOpen: boolean;
    /** The manual master switch alone, ignoring the schedule. Admin UI only. */
    manualOpen: boolean;
    opensAt: string | null;
    closesAt: string | null;
    message: string;
    phase: string;
}

export interface UseRecruitmentWindow extends RecruitmentWindow {
    loading: boolean;
    /** True when the RPC failed and we fell back to closed. */
    unavailable: boolean;
    /** now() as the DATABASE sees it — never trust the device clock for a deadline. */
    serverNow: () => number;
    refresh: () => Promise<void>;
}

const CLOSED: RecruitmentWindow = {
    isOpen: false,
    manualOpen: false,
    opensAt: null,
    closesAt: null,
    message: '',
    phase: 'APPLICATIONS_OPEN',
};

// setTimeout silently fires immediately past this, so long-dated schedules get
// re-armed in chunks instead of collapsing to zero.
const MAX_TIMEOUT = 2_147_483_000;

/**
 * Single source of truth for "can someone apply right now?" on the client.
 *
 * Asks the database rather than computing the answer here: the deadline is
 * enforced by RLS and a trigger, and a UI that disagreed with them would either
 * show an open form that rejects on submit, or hide a form that still works.
 *
 * Fails closed. If the RPC errors, callers see isOpen=false and `unavailable`.
 */
export const useRecruitmentWindow = (): UseRecruitmentWindow => {
    const [window_, setWindow] = useState<RecruitmentWindow>(CLOSED);
    const [loading, setLoading] = useState(true);
    const [unavailable, setUnavailable] = useState(false);
    // Bumped by every refresh. The re-arm effect depends on it so a chunked timer
    // (see MAX_TIMEOUT) reschedules even when the fetched window is unchanged.
    const [cycle, setCycle] = useState(0);

    // serverTime - Date.now() at the moment of the fetch. Applied to every later
    // read of the clock so a skewed device still counts down to the real instant.
    const offsetRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

    const refresh = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('recruitment_window');
            if (error) throw error;
            if (!data) throw new Error('recruitment_window() returned no payload');

            const serverTime = data.serverTime ? new Date(data.serverTime).getTime() : NaN;
            offsetRef.current = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;

            setWindow({
                isOpen: data.isOpen === true,
                manualOpen: data.manualOpen === true,
                opensAt: data.opensAt ?? null,
                closesAt: data.closesAt ?? null,
                message: data.message ?? '',
                phase: data.phase ?? 'APPLICATIONS_OPEN',
            });
            setUnavailable(false);
        } catch (err) {
            // Fail closed: an unreachable check is not permission to apply.
            console.error('[recruitment] window check failed', err);
            setWindow(CLOSED);
            setUnavailable(true);
        } finally {
            setLoading(false);
            setCycle((c) => c + 1);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Re-check exactly when the window is due to flip, so a form left open across
    // the deadline closes on its own instead of failing at submit time.
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (loading) return;

        const boundaries = [window_.opensAt, window_.closesAt]
            .map((iso) => (iso ? new Date(iso).getTime() : NaN))
            .filter((ms) => Number.isFinite(ms) && ms > serverNow())
            .sort((a, b) => a - b);

        if (!boundaries.length) return;

        // +1s so the server has definitively crossed the boundary before we ask.
        const delay = Math.min(boundaries[0] - serverNow() + 1000, MAX_TIMEOUT);
        timerRef.current = setTimeout(() => {
            // A chunked re-arm lands here early; refresh() reschedules from the new state.
            refresh();
        }, Math.max(delay, 0));

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [loading, cycle, window_.opensAt, window_.closesAt, refresh, serverNow]);

    return { ...window_, loading, unavailable, serverNow, refresh };
};

/** Formats a millisecond span as `2d 04h 17m 09s`, trimming empty leading units. */
export const formatCountdown = (ms: number): string => {
    if (!Number.isFinite(ms) || ms <= 0) return '0s';

    const total = Math.floor(ms / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
    return `${seconds}s`;
};
