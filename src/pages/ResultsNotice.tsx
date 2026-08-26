import { useEffect } from 'react';

const INSTAGRAM_URL = 'https://www.instagram.com/ieee_sscs_vitcc/';

/**
 * Portal closed — every candidate-facing route lands here and is sent straight
 * to the Instagram page, where the results were announced.
 *
 * `replace` rather than `href` so the back button doesn't bounce the visitor
 * into a redirect loop. The markup below is only a fallback for the moment
 * before the redirect fires, or if a browser blocks it outright.
 */
export default function ResultsNotice() {
    useEffect(() => {
        window.location.replace(INSTAGRAM_URL);
    }, []);

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#08080c] px-5 text-center">
            <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                    Results are out on Instagram. Taking you there&hellip;
                </p>
                <a
                    href={INSTAGRAM_URL}
                    className="inline-block text-sm font-bold text-purple-400 hover:text-purple-300 underline underline-offset-4"
                >
                    Tap here if you aren&apos;t redirected
                </a>
            </div>
        </div>
    );
}
