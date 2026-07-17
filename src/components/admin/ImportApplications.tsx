import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UploadCloud, CheckCircle, Trash2, Save, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface ParsedApplication {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  roll_number: string;
  primary_dept: string;
  reason: string;
  secondary_dept?: string;
  secondary_reason?: string;
  skills?: string;
  status: string;
}

const COLUMN_ALIASES: Record<keyof Omit<ParsedApplication, 'user_id' | 'status'>, string[]> = {
  full_name: ['name', 'full name', 'applicant name', 'first name', 'student name'],
  email: ['email', 'email address', 'mail'],
  phone: ['phone', 'mobile', 'contact', 'phone number'],
  roll_number: ['roll number', 'roll no', 'registration number', 'reg no', 'reg number'],
  primary_dept: ['primary department', 'choice 1', 'domain 1', 'department 1', 'primary', 'domain'],
  reason: ['reason', 'why this department?', 'primary reason', 'why this domain?', 'why?'],
  secondary_dept: ['secondary department', 'choice 2', 'domain 2', 'department 2', 'secondary'],
  secondary_reason: ['secondary reason', 'why this secondary department?'],
  skills: ['skills', 'technical skills', 'your skills', 'tools'],
};

export default function ImportApplications() {
  const [data, setData] = useState<ParsedApplication[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeKey = (key: string) => key.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');

  const mapRowToApplication = (row: any): ParsedApplication | null => {
    const mapped: any = {};
    const keys = Object.keys(row);

    // Map each expected field to the matching column in the row
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      const match = keys.find(k => aliases.includes(normalizeKey(k)));
      if (match) {
        mapped[field] = String(row[match]).trim();
      }
    }

    // Check mandatory fields
    if (!mapped.full_name || !mapped.email || !mapped.roll_number || !mapped.primary_dept) {
      return null;
    }

    return {
      user_id: `imported-${crypto.randomUUID()}`,
      full_name: mapped.full_name,
      email: mapped.email.toLowerCase(),
      phone: mapped.phone || 'N/A',
      roll_number: mapped.roll_number.toUpperCase(),
      primary_dept: mapped.primary_dept,
      reason: mapped.reason || '',
      secondary_dept: mapped.secondary_dept || null,
      secondary_reason: mapped.secondary_reason || null,
      skills: mapped.skills || '',
      status: 'pending'
    };
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON array of objects
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        const parsedData: ParsedApplication[] = [];
        let skipped = 0;

        json.forEach((row: any) => {
          const app = mapRowToApplication(row);
          if (app) {
            parsedData.push(app);
          } else {
            skipped++;
          }
        });

        setData(parsedData);
        if (parsedData.length > 0) {
          toast.success(`Successfully parsed ${parsedData.length} applicants.`);
          if (skipped > 0) {
            toast.warning(`Skipped ${skipped} rows due to missing required fields (Name, Email, Roll No, or Primary Dept).`);
          }
        } else {
          toast.error("No valid data found. Please check your column headers.");
        }
      } catch (err) {
        toast.error("Failed to parse the file. Please ensure it's a valid Excel or CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const commitImport = async () => {
    if (data.length === 0) return;
    setIsUploading(true);

    try {
      const { data: existing } = await supabase.from('applications').select('email');
      const existingEmails = new Set(existing?.map(e => e.email.toLowerCase()));

      const newApplications = data.filter(app => !existingEmails.has(app.email));
      const skipped = data.length - newApplications.length;

      if (newApplications.length === 0) {
        toast.info("All applicants in this file already exist in the database.");
        setIsUploading(false);
        setData([]);
        return;
      }

      const { error } = await supabase.from('applications').insert(newApplications);

      if (error) throw error;

      toast.success(`Successfully imported ${newApplications.length} applicants!`);
      if (skipped > 0) {
        toast.info(`Skipped ${skipped} duplicates based on email.`);
      }
      
      setData([]); // Reset on success
    } catch (err: any) {
      console.error(err);
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
          <FileSpreadsheet className="text-primary w-5 h-5" />
          Bulk Import Applications
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Upload an Excel (.xlsx) or CSV file containing applicant data. We will automatically map the columns and import them into the system. Required columns: Name, Email, Roll Number, and Primary Department.
        </p>
      </div>

      {data.length === 0 ? (
        <div 
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02] bg-white/5'}`}
        >
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            accept=".xlsx, .xls, .csv" 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
                e.target.value = ''; // Reset input so same file can be selected again
              }
            }}
          />
          <UploadCloud className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDragging ? 'text-primary' : 'text-white/20'}`} />
          <h3 className="text-lg font-bold text-white mb-2">Drag & Drop your file here</h3>
          <p className="text-sm text-muted-foreground">or click to browse from your computer</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="text-green-400 w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{data.length} applicants ready to import</p>
                <p className="text-xs text-muted-foreground">Please review the data below before confirming.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setData([])} disabled={isUploading} className="flex-1 sm:flex-none text-red-400 hover:text-red-300 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button onClick={commitImport} disabled={isUploading} className="flex-1 sm:flex-none bg-primary text-white hover:bg-primary/90 font-bold tracking-wider">
                {isUploading ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" /> Importing...</span>
                ) : (
                  <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Confirm Import</span>
                )}
              </Button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <div className="max-h-[60vh] overflow-auto scrollbar-thin scrollbar-thumb-primary/20">
              <Table>
                <TableHeader className="bg-black/40 sticky top-0 backdrop-blur-xl z-10">
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-white py-4">Name</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-white">Email</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-white">Roll No</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-white">Primary Dept</TableHead>
                    <TableHead className="text-[10px] font-bold tracking-wider uppercase text-white text-right">Secondary Dept</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((app, idx) => (
                    <TableRow key={idx} className="border-white/5 hover:bg-white/5">
                      <TableCell className="font-medium text-sm text-white py-3">{app.full_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{app.email}</TableCell>
                      <TableCell className="text-xs font-mono">{app.roll_number}</TableCell>
                      <TableCell className="text-xs">
                        <span className="px-2 py-1 rounded bg-primary/10 text-primary font-semibold">{app.primary_dept}</span>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {app.secondary_dept ? (
                          <span className="px-2 py-1 rounded bg-white/5 text-white/70">{app.secondary_dept}</span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
