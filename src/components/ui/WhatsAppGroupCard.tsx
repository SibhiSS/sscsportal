import { MessageCircle } from 'lucide-react';
import { WHATSAPP_GROUP_URL, WHATSAPP_GROUP_NOTICE } from '@/lib/community';

/**
 * Join-the-group call to action.
 *
 * Render it only where the applicant is known to hold an interview slot — the
 * invite link lets anyone who sees it into the group, so it must not leak onto a
 * screen a not-yet-booked applicant can reach.
 */
export default function WhatsAppGroupCard({ className = '' }: { className?: string }) {
    return (
        <div className={`p-4 rounded-xl bg-green-500/[0.07] border border-green-500/25 text-left ${className}`}>
            <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-green-400 shrink-0" />
                <span className="text-[10px] text-green-400 uppercase tracking-widest font-bold">
                    Official WhatsApp Group
                </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed mb-3">
                {WHATSAPP_GROUP_NOTICE}
            </p>
            <a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors"
            >
                <MessageCircle className="w-4 h-4" />
                Join WhatsApp Group
            </a>
        </div>
    );
}
