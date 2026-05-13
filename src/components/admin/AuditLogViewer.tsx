import React, { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { fetchAuditLogs } from '@/services/auditService';
import { AuditLog } from '@/types';
import { formatDistanceToNow } from 'date-fns';

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

    if (loading) return <div className="flex justify-center p-8"><LogoSpinner size="md" /></div>;

    return (
        <div className="rounded-md border border-white/10 overflow-hidden">
            <Table>
                <TableHeader className="bg-white/5">
                    <TableRow className="hover:bg-white/5 border-white/10">
                        <TableHead className="w-[200px]">Time</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-white/5 border-white/10 font-mono text-sm">
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-blue-400">{log.actorEmail}</TableCell>
                            <TableCell className="font-bold text-white">{log.action}</TableCell>
                            <TableCell className="text-muted-foreground">{log.targetId ? log.targetId.slice(0, 8) + '...' : '-'}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground max-w-[300px] truncate">
                                {log.details ? JSON.stringify(log.details) : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default AuditLogViewer;
