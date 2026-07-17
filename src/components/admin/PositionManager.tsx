import { Application } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crown, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';

const BOARD_POSITIONS = [
    'Chairperson',
    'Vice-Chair Person',
    'Secretary',
    'Treasurer/Co-Sec',
    'Chairperson (WiS)',
    'Vice-Chairperson (WiS)'
];

const DEPARTMENTS = [
    'Technical',
    'Management',
    'Event Operations',
    'Creative',
    'Outreach & Partnerships',
    'Human Resources'
];

interface PositionManagerProps {
    applications: Application[];
    onUpdate: (id: string, updates: Partial<Application>) => Promise<void>;
}

const PositionManager = ({ applications, onUpdate }: PositionManagerProps) => {
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

    // Filter to candidates who have completed their interview (or already assigned)
    const eligibleCandidates = applications.filter(app => 
        ['interviewed', 'selected', 'active_member'].includes(app.status)
    ).sort((a, b) => a.fullName.localeCompare(b.fullName));

    const handleAssignPosition = async (candidateId: string, positionName: string) => {
        if (candidateId === "none") {
            // Find who currently has this position and clear it
            const currentHolder = applications.find(a => a.assignedPosition === positionName);
            if (currentHolder) {
                setUpdatingIds(prev => new Set(prev).add(currentHolder.id));
                await onUpdate(currentHolder.id, { assignedPosition: null as any });
                setUpdatingIds(prev => {
                    const next = new Set(prev);
                    next.delete(currentHolder.id);
                    return next;
                });
            }
            return;
        }

        setUpdatingIds(prev => new Set(prev).add(candidateId));

        // If someone else already has this position, clear it first
        const currentHolder = applications.find(a => a.assignedPosition === positionName);
        if (currentHolder && currentHolder.id !== candidateId) {
            await onUpdate(currentHolder.id, { assignedPosition: null as any });
        }

        // Assign to new candidate
        await onUpdate(candidateId, { assignedPosition: positionName, status: 'selected' });

        setUpdatingIds(prev => {
            const next = new Set(prev);
            next.delete(candidateId);
            return next;
        });
    };

    const getCandidateForPosition = (positionName: string) => {
        return applications.find(a => a.assignedPosition === positionName)?.id || "none";
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            {/* BOARD POSITIONS */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-6">
                    <Crown className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-heading font-bold text-white tracking-widest uppercase">Board Positions</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {BOARD_POSITIONS.map(position => (
                        <Card key={position} className="bg-white/5 border-white/10 backdrop-blur-xl">
                            <CardContent className="p-5 flex flex-col gap-3">
                                <div className="text-sm font-bold tracking-widest uppercase text-yellow-400/80">
                                    {position}
                                </div>
                                <Select 
                                    value={getCandidateForPosition(position)} 
                                    onValueChange={(val) => handleAssignPosition(val, position)}
                                >
                                    <SelectTrigger className="w-full bg-black/50 border-white/10 h-10 text-xs">
                                        <SelectValue placeholder="Select candidate..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-900 border-zinc-800">
                                        <SelectItem value="none" className="text-muted-foreground italic">None (Clear)</SelectItem>
                                        {eligibleCandidates.map(c => (
                                            <SelectItem key={c.id} value={c.id} className="text-xs">
                                                {c.fullName} ({c.primaryDept})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* DEPARTMENT POSITIONS */}
            <div className="space-y-4 pt-8 border-t border-white/10">
                <div className="flex items-center gap-2 mb-6">
                    <Users className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-heading font-bold text-white tracking-widest uppercase">Department Leads</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {DEPARTMENTS.map(dept => (
                        <Card key={dept} className="bg-white/5 border-white/10 backdrop-blur-xl overflow-hidden">
                            <div className="bg-white/5 px-5 py-3 border-b border-white/10">
                                <h3 className="text-sm font-bold tracking-widest uppercase text-blue-400">{dept}</h3>
                            </div>
                            <CardContent className="p-5 space-y-4">
                                {['Lead', 'Associate'].map(role => {
                                    const fullPositionName = `${role} - ${dept}`;
                                    return (
                                        <div key={role} className="space-y-2">
                                            <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                                                {role}
                                            </label>
                                            <Select 
                                                value={getCandidateForPosition(fullPositionName)} 
                                                onValueChange={(val) => handleAssignPosition(val, fullPositionName)}
                                            >
                                                <SelectTrigger className="w-full bg-black/50 border-white/10 h-10 text-xs">
                                                    <SelectValue placeholder="Select candidate..." />
                                                </SelectTrigger>
                                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                                    <SelectItem value="none" className="text-muted-foreground italic">None (Clear)</SelectItem>
                                                    {eligibleCandidates.map(c => (
                                                        <SelectItem key={c.id} value={c.id} className="text-xs">
                                                            {c.fullName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PositionManager;
