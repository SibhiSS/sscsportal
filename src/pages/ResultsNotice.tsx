import { motion } from 'framer-motion';
import { Instagram, Lock } from 'lucide-react';

const INSTAGRAM_URL = 'https://www.instagram.com/ieee_sscs_vitcc/';

/**
 * Holding page shown while the portal is closed.
 *
 * Results are announced on Instagram, not here. Every candidate-facing route
 * redirects to this page — see SITE_LOCKED in App.tsx.
 */
export default function ResultsNotice() {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#08080c] px-5 py-16">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="w-full max-w-lg text-center space-y-8"
            >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                    <Lock className="w-3 h-3" />
                    Portal Closed
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                        The results are out on Instagram
                    </h1>
                    <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                        Recruitment results have been announced on our official IEEE SSCS
                        VIT Chennai Instagram page. Head there to see the announcement.
                    </p>
                </div>

                <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 h-12 px-7 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all hover:scale-[1.02] shadow-[0_0_28px_rgba(147,51,234,0.28)]"
                >
                    <Instagram className="w-4 h-4" />
                    View results on Instagram
                </a>

                <p className="text-xs text-zinc-600 pt-2">
                    @ieee_sscs_vitcc · The application portal is no longer accepting activity.
                </p>
            </motion.div>
        </div>
    );
}
