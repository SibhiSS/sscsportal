import { supabase } from '@/lib/supabase';
import { AuditLog } from '@/types';

export const logAction = async (actorEmail: string, action: string, targetId?: string, details?: any) => {
    try {
        await supabase.from('audit_logs').insert({
            actor_email: actorEmail,
            action,
            target_id: targetId,
            details,
        });
    } catch (error) {
        console.error("Failed to log action:", error);
    }
};

export const fetchAuditLogs = async (): Promise<AuditLog[]> => {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

    if (error) throw error;

    return data.map((log: any) => ({
        id: log.id,
        actorEmail: log.actor_email,
        action: log.action,
        targetId: log.target_id,
        details: log.details,
        timestamp: log.timestamp
    }));
};
