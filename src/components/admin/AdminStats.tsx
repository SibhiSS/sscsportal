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
        <div className="space-y-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <HolographicCard className="p-4 flex items-center justify-between border-blue-500/20 bg-blue-500/5">
                    <div>
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Total Applications</p>
                        <h3 className="text-3xl font-bold text-blue-400 mt-1">{stats.total}</h3>
                    </div>
                    <Users className="w-8 h-8 text-blue-500/50" />
                </HolographicCard>

                <HolographicCard className="p-4 flex items-center justify-between border-yellow-500/20 bg-yellow-500/5">
                    <div>
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Pending Review</p>
                        <h3 className="text-3xl font-bold text-yellow-400 mt-1">{stats.pending}</h3>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-500/50" />
                </HolographicCard>

                <HolographicCard className="p-4 flex items-center justify-between border-green-500/20 bg-green-500/5">
                    <div>
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Shortlisted</p>
                        <h3 className="text-3xl font-bold text-green-400 mt-1">{stats.shortlisted}</h3>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500/50" />
                </HolographicCard>

                <HolographicCard className="p-4 flex items-start justify-between border-purple-500/20 bg-purple-500/5">
                    <div className="w-full">
                        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-2">Top Departments</p>
                        <div className="space-y-1">
                            {stats.topDepts.map(([dept, count]) => (
                                <div key={dept} className="flex justify-between text-xs">
                                    <span className="text-purple-300/80 truncate max-w-[120px]">{dept}</span>
                                    <span className="font-mono text-purple-400">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <BarChart3 className="w-8 h-8 text-purple-500/50 ml-2" />
                </HolographicCard>
            </div>

            {/* Analytics Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <HolographicCard className="p-6 border-white/10 bg-white/5">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        Recruitment Funnel
                    </h4>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Applications Received</span>
                                <span className="text-white">{stats.total}</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: '100%' }}></div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Shortlisted for Interview</span>
                                <span className="text-white">{stats.shortlisted} ({stats.total > 0 ? Math.round((stats.shortlisted / stats.total) * 100) : 0}%)</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-500" style={{ width: `${stats.total > 0 ? (stats.shortlisted / stats.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Interviews Conducted</span>
                                <span className="text-white">{stats.interviewed} ({stats.total > 0 ? Math.round((stats.interviewed / stats.total) * 100) : 0}%)</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-500" style={{ width: `${stats.total > 0 ? (stats.interviewed / stats.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Selected</span>
                                <span className="text-white">{stats.selected} ({stats.total > 0 ? Math.round((stats.selected / stats.total) * 100) : 0}%)</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500" style={{ width: `${stats.total > 0 ? (stats.selected / stats.total) * 100 : 0}%` }}></div>
                            </div>
                        </div>
                    </div>
                </HolographicCard>

                <HolographicCard className="p-6 border-white/10 bg-white/5 flex flex-col justify-center items-center text-center">
                    <div className="w-32 h-32 rounded-full border-4 border-purple-500/20 flex items-center justify-center mb-4 relative">
                        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-purple-500/50 border-b-transparent border-l-transparent rotate-45"></div>
                        <div>
                            <div className="text-3xl font-bold text-white">{stats.selectionRatio}%</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-widest">Select Ratio</div>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        Current selection rate across all departments. Lower ratio implies higher competition.
                    </p>
                </HolographicCard>
            </div>
        </div>
    );
};

export default AdminStats;
