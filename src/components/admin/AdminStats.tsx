import React, { useMemo } from 'react';
import { Application } from '@/types';
import HolographicCard from '@/components/ui/HolographicCard';
import { Users, Clock, CheckCircle, XCircle, BarChart3 } from 'lucide-react';

interface AdminStatsProps {
    applications: Application[];
}

const AdminStats: React.FC<AdminStatsProps> = ({ applications }) => {
    const stats = useMemo(() => {
        const total = applications.length;
        const pending = applications.filter(a => a.status === 'pending' || a.status === 'neutral').length;
        const shortlisted = applications.filter(a => a.status === 'shortlisted' || a.status === 'selected').length;
        const rejected = applications.filter(a => a.status === 'rejected' || a.status === 'rejected_pending').length;

        const deptCounts = applications.reduce((acc, app) => {
            acc[app.primaryDept] = (acc[app.primaryDept] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topDepts = Object.entries(deptCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        // Conversion logic
        const interviewed = applications.filter(a => ['interview_scheduled', 'interviewed', 'selected'].includes(a.status)).length;
        const selected = applications.filter(a => a.status === 'selected').length;

        const selectionRatio = total > 0 ? ((selected / total) * 100).toFixed(1) : '0';

        return { total, pending, shortlisted, rejected, topDepts, interviewed, selected, selectionRatio };
    }, [applications]);

    return (
        <div className="space-y-10 mb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <HolographicCard className="p-6 border-white/5 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Applications</p>
                            <h3 className="text-4xl font-heading font-bold text-white tracking-tighter">{stats.total}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(220,20,60,0.1)]">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </HolographicCard>

                <HolographicCard className="p-6 border-white/5 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">In Review</p>
                            <h3 className="text-4xl font-heading font-bold text-yellow-500 tracking-tighter">{stats.pending}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                            <Clock className="w-6 h-6 text-yellow-500" />
                        </div>
                    </div>
                </HolographicCard>

                <HolographicCard className="p-6 border-white/5 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Qualified</p>
                            <h3 className="text-4xl font-heading font-bold text-green-500 tracking-tighter">{stats.shortlisted}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                    </div>
                </HolographicCard>

                <HolographicCard className="p-6 border-white/5 bg-white/5">
                    <div className="flex items-start justify-between">
                        <div className="w-full">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-3">Leaderboard</p>
                            <div className="space-y-2">
                                {stats.topDepts.map(([dept, count]) => (
                                    <div key={dept} className="flex justify-between text-[10px]">
                                        <span className="text-zinc-400 font-medium truncate max-w-[120px]">{dept}</span>
                                        <span className="font-mono text-primary font-bold">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <BarChart3 className="w-6 h-6 text-primary/30 ml-2" />
                    </div>
                </HolographicCard>
            </div>

            {/* Analytics Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <HolographicCard className="lg:col-span-2 p-8 border-white/5 bg-white/5">
                    <div className="flex items-center justify-between mb-8">
                        <h4 className="text-sm font-bold text-white tracking-[0.2em] uppercase flex items-center gap-3">
                            <div className="w-1 h-4 bg-primary rounded-full"></div>
                            Conversion Funnel
                        </h4>
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase mb-1">
                                <span className="text-muted-foreground">Applications Received</span>
                                <span className="text-white">{stats.total}</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]" style={{ width: '100%' }}></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase mb-1">
                                <span className="text-muted-foreground">Shortlisted</span>
                                <span className="text-white">{stats.shortlisted} <span className="text-zinc-600 font-normal ml-1">({stats.total > 0 ? Math.round((stats.shortlisted / stats.total) * 100) : 0}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400" style={{ width: `${stats.total > 0 ? (stats.shortlisted / stats.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase mb-1">
                                <span className="text-muted-foreground">Interviews Conducted</span>
                                <span className="text-white">{stats.interviewed} <span className="text-zinc-600 font-normal ml-1">({stats.total > 0 ? Math.round((stats.interviewed / stats.total) * 100) : 0}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${stats.total > 0 ? (stats.interviewed / stats.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold tracking-widest uppercase mb-1">
                                <span className="text-muted-foreground">Final Selection</span>
                                <span className="text-white">{stats.selected} <span className="text-zinc-600 font-normal ml-1">({stats.total > 0 ? Math.round((stats.selected / stats.total) * 100) : 0}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-gradient-to-r from-green-500 to-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)]" style={{ width: `${stats.total > 0 ? (stats.selected / stats.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>
                    </div>
                </HolographicCard>

                <HolographicCard className="p-8 border-white/5 bg-white/5 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-30 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="w-36 h-36 rounded-full border-2 border-white/5 flex items-center justify-center mb-6 relative">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                                cx="72"
                                cy="72"
                                r="68"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="transparent"
                                className="text-white/5"
                            />
                            <circle
                                cx="72"
                                cy="72"
                                r="68"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="transparent"
                                strokeDasharray={Math.PI * 2 * 68}
                                strokeDashoffset={Math.PI * 2 * 68 * (1 - Number(stats.selectionRatio) / 100)}
                                className="text-primary drop-shadow-[0_0_8px_rgba(220,20,60,0.5)] transition-all duration-1000 ease-out"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="relative z-10">
                            <div className="text-4xl font-heading font-bold text-white tracking-tighter">{stats.selectionRatio}%</div>
                            <div className="text-[8px] text-muted-foreground uppercase tracking-[0.3em] font-bold mt-1">Select Ratio</div>
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground max-w-[200px] leading-relaxed uppercase tracking-widest font-medium opacity-60">
                        Performance efficiency across all departments.
                    </p>
                </HolographicCard>
            </div>
        </div>
    );
};

export default AdminStats;
