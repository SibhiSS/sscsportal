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
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
            {/* Filters Section */}
            <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search applicants..."
                        className="pl-9 bg-black/20 border-white/10 focus:border-primary/50"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => onSearchChange('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                <Select value={programFilter} onValueChange={onProgramFilterChange}>
                    <SelectTrigger className="w-full md:w-[200px] bg-black/20 border-white/10">
                        <SelectValue placeholder="Program" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Programs</SelectItem>
                        {uniquePrograms.map(prog => (
                            <SelectItem key={prog} value={prog}>{prog}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={yearFilter} onValueChange={onYearFilterChange}>
                    <SelectTrigger className="w-full md:w-[120px] bg-black/20 border-white/10">
                        <SelectValue placeholder="Adm Year" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Years</SelectItem>
                        {uniqueYears.map(year => (
                            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={deptFilter} onValueChange={onDeptFilterChange}>
                    <SelectTrigger className="w-full md:w-[180px] bg-black/20 border-white/10">
                        <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Departments</SelectItem>
                        {uniqueDepts.map(dept => (
                            <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                    <SelectTrigger className="w-full md:w-[150px] bg-black/20 border-white/10">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="shortlisted">Shortlisted</SelectItem>
                        <SelectItem value="selected">Selected</SelectItem>
                        <SelectItem value="rejected_pending">To Reject</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="active_member">Active Member</SelectItem>
                        <SelectItem value="alumni">Alumni</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-3 w-full xl:w-auto pt-4 xl:pt-0 border-t xl:border-t-0 border-white/10">
                {canPublish && (
                    <Button
                        onClick={onPublish}
                        disabled={isPublishing}
                        className="flex-1 xl:flex-none bg-green-600 hover:bg-green-700 text-white border border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                    >
                        {isPublishing ? <LogoSpinner size="sm" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Publish Results
                    </Button>
                )}

                <Button onClick={onExport} variant="outline" className="flex-1 xl:flex-none bg-black/20 border-white/10 hover:bg-primary/20 hover:border-primary/50">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                </Button>
            </div>
        </div>
    );
};

export default AdminToolbar;
