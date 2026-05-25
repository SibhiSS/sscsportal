import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, Download, CheckCircle, X } from 'lucide-react';
import LogoSpinner from '@/components/ui/LogoSpinner';
import { Application } from '@/types';

interface AdminToolbarProps {
    applications: Application[];
    searchTerm: string;
    onSearchChange: (value: string) => void;
    deptFilter: string;
    onDeptFilterChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    programFilter: string;
    onProgramFilterChange: (value: string) => void;
    yearFilter: string;
    onYearFilterChange: (value: string) => void;
    isPublishing: boolean;
    onPublish: () => void;
    onExport: () => void;
    canPublish?: boolean;
}

const AdminToolbar: React.FC<AdminToolbarProps> = ({
    applications,
    searchTerm,
    onSearchChange,
    deptFilter,
    onDeptFilterChange,
    statusFilter,
    onStatusFilterChange,
    programFilter,
    onProgramFilterChange,
    yearFilter,
    onYearFilterChange,
    isPublishing,
    onPublish,
    onExport,
    canPublish = false
}) => {
    // Extract unique values
    const uniqueDepts = Array.from(new Set(applications.map(app => app.primaryDept))).sort();
    const uniquePrograms = Array.from(new Set(applications.map(app => app.programName).filter(Boolean))) as string[];
    const uniqueYears = Array.from(new Set(applications.map(app => app.admissionYear).filter(Boolean))).sort().reverse() as number[];

    return (
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 p-6 rounded-[2rem] bg-white/[0.03] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            {/* Subtle glow background */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-primary/20 transition-all duration-700"></div>
            
            {/* Filters Section */}
            <div className="flex flex-wrap gap-4 w-full xl:w-auto flex-1 relative z-10">
                <div className="relative w-full md:w-72 group/input">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                    <Input
                        placeholder="Search Intelligence Database..."
                        className="pl-11 h-12 bg-white/5 border-white/5 focus:border-primary/40 focus:ring-primary/20 rounded-xl transition-all placeholder:text-muted-foreground/50 text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-3">
                    <Select value={programFilter} onValueChange={onProgramFilterChange}>
                        <SelectTrigger className="h-12 w-[180px] bg-white/5 border-white/5 hover:bg-white/10 rounded-xl transition-all text-xs font-bold tracking-wider uppercase">
                            <SelectValue placeholder="PROGRAM" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900/95 border-white/10 backdrop-blur-xl">
                            <SelectItem value="ALL">All Programs</SelectItem>
                            {uniquePrograms.map(prog => (
                                <SelectItem key={prog} value={prog}>{prog}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={yearFilter} onValueChange={onYearFilterChange}>
                        <SelectTrigger className="h-12 w-[120px] bg-white/5 border-white/5 hover:bg-white/10 rounded-xl transition-all text-xs font-bold tracking-wider uppercase">
                            <SelectValue placeholder="BATCH" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900/95 border-white/10 backdrop-blur-xl">
                            <SelectItem value="ALL">All Batches</SelectItem>
                            {uniqueYears.map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={deptFilter} onValueChange={onDeptFilterChange}>
                        <SelectTrigger className="h-12 w-[180px] bg-white/5 border-white/5 hover:bg-white/10 rounded-xl transition-all text-xs font-bold tracking-wider uppercase">
                            <SelectValue placeholder="DEPARTMENT" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900/95 border-white/10 backdrop-blur-xl">
                            <SelectItem value="ALL">All Departments</SelectItem>
                            {uniqueDepts.map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                        <SelectTrigger className="h-12 w-[150px] bg-white/5 border-white/5 hover:bg-white/10 rounded-xl transition-all text-xs font-bold tracking-wider uppercase">
                            <SelectValue placeholder="STATUS" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900/95 border-white/10 backdrop-blur-xl">
                            <SelectItem value="ALL">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="shortlisted">Shortlisted (To Interview)</SelectItem>
                            <SelectItem value="interview_scheduled">Interview Scheduled</SelectItem>
                            <SelectItem value="interviewed">Needs Decision (Interviewed)</SelectItem>
                            <SelectItem value="waitlisted">Waitlisted</SelectItem>
                            <SelectItem value="selected">Selected</SelectItem>
                            <SelectItem value="rejected_pending">To Reject</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="active_member">Active Member</SelectItem>
                            <SelectItem value="alumni">Alumni</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-4 w-full xl:w-auto pt-6 xl:pt-0 border-t xl:border-t-0 border-white/5 relative z-10">
                {canPublish && (
                    <Button
                        onClick={onPublish}
                        disabled={isPublishing}
                        className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold tracking-[0.15em] uppercase text-[10px] shadow-[0_0_20px_rgba(220,20,60,0.4)] hover:shadow-[0_0_30px_rgba(220,20,60,0.6)] transition-all duration-300 active:scale-95"
                    >
                        {isPublishing ? <LogoSpinner size="sm" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Publish Results
                    </Button>
                )}

                <Button 
                    onClick={onExport} 
                    variant="outline" 
                    className="h-12 px-6 rounded-xl bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20 transition-all text-[10px] font-bold tracking-[0.15em] uppercase"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                </Button>
            </div>
        </div>
    );
};

export default AdminToolbar;
