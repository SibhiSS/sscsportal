import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { fetchAuditLogs } from '@/services/auditService';
import { AuditLog } from '@/types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import HolographicCard from '@/components/ui/HolographicCard';
import { History, User, Activity, Clock } from 'lucide-react';

const AuditLogViewer = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const data = await fetchAuditLogs();
            setLogs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-24 space-y-4">
            <LogoSpinner size="lg" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-bold animate-pulse">Retrieving System Logs...</p>
        </div>
    );

    return (
        <HolographicCard className="p-0 border-white/5 overflow-hidden shadow-2xl">
            <div className="bg-white/5 p-6 border-b border-white/10 flex items-center justify-between backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <History className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-heading font-bold text-white">System Audit Log</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">Real-time Activity Stream</p>
                    </div>
                </div>
                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {logs.length} Total Events
                </div>
            </div>

            <div className="max-h-[60vh] overflow-auto scrollbar-thin scrollbar-thumb-primary/20">
                <Table>
                    <TableHeader className="bg-white/5 sticky top-0 z-10 backdrop-blur-2xl">
                        <TableRow className="hover:bg-transparent border-white/10">
                            <TableHead className="text-[10px] font-bold tracking-widest uppercase py-5 pl-8">Timestamp</TableHead>
                            <TableHead className="text-[10px] font-bold tracking-widest uppercase py-5">Actor</TableHead>
                            <TableHead className="text-[10px] font-bold tracking-widest uppercase py-5 text-primary">Operation</TableHead>
                            <TableHead className="text-[10px] font-bold tracking-widest uppercase py-5">Target ID</TableHead>
                            <TableHead className="text-[10px] font-bold tracking-widest uppercase py-5 text-right pr-8">Metadata</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium opacity-40">Zero logs found in history</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id} className="hover:bg-white/5 border-white/5 transition-colors group">
                                    <TableCell className="py-6 pl-8">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-[11px] font-mono text-zinc-400">
                                                {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                <User className="w-3 h-3 text-blue-400" />
                                            </div>
                                            <span className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors">
                                                {log.actorEmail}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="px-2 py-1 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-tighter">
                                            {log.action}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-[10px] font-mono text-zinc-500">
                                        {log.targetId ? log.targetId.slice(0, 12) + '...' : '-'}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <div className="text-[10px] text-muted-foreground max-w-[200px] ml-auto truncate opacity-60 font-mono" title={log.details ? JSON.stringify(log.details) : '-'}>
                                            {log.details ? JSON.stringify(log.details) : '-'}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </HolographicCard>
    );
};

export default AuditLogViewer;
