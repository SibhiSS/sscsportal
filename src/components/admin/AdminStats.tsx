import React, { useMemo } from 'react';
import { Application } from '@/types';
import HolographicCard from '@/components/ui/HolographicCard';
import { Users, Clock, CheckCircle2, Video, TrendingUp, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminStatsProps {
    applications: Application[];
}

const AdminStats: React.FC<AdminStatsProps> = ({ applications }) => {
    const stats = useMemo(() => {
        const total = applications.length;
        const pending = applications.filter(a => a.status === 'pending' || a.status === 'neutral' || a.status === 'under_review').length;
        const shortlisted = applications.filter(a => a.status === 'shortlisted' || a.status === 'interview_scheduled').length;
        const interviewed = applications.filter(a => ['interviewed', 'selected', 'waitlisted', 'rejected', 'active_member', 'alumni'].includes(a.status)).length;
        const selected = applications.filter(a => ['selected', 'active_member', 'alumni'].includes(a.status)).length;
        const selectRatio = total > 0 ? ((selected / total) * 100).toFixed(0) : '0';

        return { total, pending, shortlisted, interviewed, selected, selectRatio };
    }, [applications]);

    const cards = [
        {
            title: "TOTAL APPLICATIONS",
            value: stats.total,
            subtitle: "All applicant submissions",
            icon: Users,
            color: "text-primary",
            bg: "bg-primary/10",
            border: "border-primary/20 hover:border-primary/40",
            glow: "shadow-[0_0_20px_rgba(220,20,60,0.15)]",
            badge: null
        },
        {
            title: "IN REVIEW",
            value: stats.pending,
            subtitle: "Awaiting initial screening",
            icon: Clock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20 hover:border-amber-500/40",
            glow: "shadow-[0_0_20px_rgba(251,191,36,0.1)]",
            badge: null
        },
        {
            title: "SHORTLISTED",
            value: stats.shortlisted,
            subtitle: "Qualified for interview",
            icon: CheckCircle2,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20 hover:border-emerald-500/40",
            glow: "shadow-[0_0_20px_rgba(52,211,153,0.1)]",
            badge: null
        },
        {
            title: "INTERVIEWS CONDUCTED",
            value: stats.interviewed,
            subtitle: "Completed evaluations",
            icon: Video,
            color: "text-cyan-400",
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/20 hover:border-cyan-500/40",
            glow: "shadow-[0_0_20px_rgba(6,182,212,0.1)]",
            badge: `${stats.selectRatio}% Select Ratio`
        }
    ];

    return (
        <div className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {cards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                            <HolographicCard className={`p-6 transition-all duration-300 bg-black/40 backdrop-blur-xl border ${card.border} ${card.glow} group`}>
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                                {card.title}
                                            </span>
                                        </div>
                                        <h3 className={`text-4xl md:text-5xl font-heading font-black tracking-tight ${card.color}`}>
                                            {card.value}
                                        </h3>
                                    </div>
                                    <div className={`w-12 h-12 rounded-2xl ${card.bg} flex items-center justify-center border ${card.border} shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                                        <Icon className={`w-6 h-6 ${card.color}`} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                    <p className="text-xs text-muted-foreground font-medium truncate">
                                        {card.subtitle}
                                    </p>
                                    {card.badge && (
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
                                            {card.badge}
                                        </span>
                                    )}
                                </div>
                            </HolographicCard>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminStats;
