import { CandidateNote } from '@/types';
import { supabase } from '@/lib/supabase';

export interface CommitteeMember {
    email: string;
    name: string;
    role: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Committee Members for @mentions autocomplete
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchCommitteeMembers(): Promise<CommitteeMember[]> {
    try {
        const { data, error } = await supabase
            .from('admins')
            .select('email, role')
            .order('email', { ascending: true });

        if (error || !data) {
            // No hardcoded fallback: the `admins` table is the only source of truth, and
            // committee emails must not be baked into the public bundle. An empty list
            // simply means @mentions are unavailable until the query succeeds.
            console.warn('[Notes] Could not load committee members for @mentions.');
            return [];
        }

        return data.map((admin: any) => {
            const email = admin.email || '';
            const namePart = email.split('@')[0] || 'User';
            const cleanName = namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[._]/g, ' ');
            return {
                email,
                name: cleanName,
                role: admin.role || 'interviewer'
            };
        });
    } catch (err) {
        console.warn("[NoteService] Could not fetch committee members:", err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch Notes (with automatic fallback to applications.notes JSON)
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchNotes(applicationId: string): Promise<CandidateNote[]> {
    try {
        const { data, error } = await supabase
            .from('candidate_notes')
            .select('*')
            .eq('application_id', applicationId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            return data.map((n: any) => ({
                id: n.id,
                application_id: n.application_id,
                author_email: n.author_email,
                author_name: n.author_name,
                content: n.content,
                mentions: n.mentions || [],
                created_at: n.created_at
            }));
        }
    } catch (tableError) {
        // Table doesn't exist yet or network error
    }

    // Fallback: Read from applications.notes column
    try {
        const { data, error } = await supabase
            .from('applications')
            .select('notes')
            .eq('id', applicationId)
            .single();

        if (error || !data?.notes) return [];

        const rawNotes = data.notes.trim();
        if (rawNotes.startsWith('[') && rawNotes.endsWith(']')) {
            const parsed = JSON.parse(rawNotes);
            if (Array.isArray(parsed)) return parsed as CandidateNote[];
        }

        // Convert legacy plain text note to a CandidateNote
        if (rawNotes.length > 0) {
            return [{
                id: 'legacy-note-' + Date.now(),
                application_id: applicationId,
                author_email: 'legacy@sscs.org',
                author_name: 'Existing Note',
                content: rawNotes,
                mentions: [],
                created_at: new Date(0).toISOString()
            }];
        }
    } catch (fallbackErr) {
        console.warn("[NoteService] Fallback read failed:", fallbackErr);
    }

    return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Note (with automatic fallback to applications.notes JSON)
// ─────────────────────────────────────────────────────────────────────────────
export async function addNote(payload: Omit<CandidateNote, 'id' | 'created_at'>): Promise<CandidateNote> {
    const newNote: CandidateNote = {
        ...payload,
        id: 'note-' + Math.random().toString(36).slice(2, 11),
        created_at: new Date().toISOString()
    };

    try {
        const { data, error } = await supabase
            .from('candidate_notes')
            .insert([{
                application_id: payload.application_id,
                author_email: payload.author_email,
                author_name: payload.author_name,
                content: payload.content,
                mentions: payload.mentions || []
            }])
            .select()
            .single();

        if (!error && data) {
            return {
                id: data.id,
                application_id: data.application_id,
                author_email: data.author_email,
                author_name: data.author_name,
                content: data.content,
                mentions: data.mentions || [],
                created_at: data.created_at
            };
        }
    } catch (tableError) {
        // Table doesn't exist yet
    }

    // Fallback: Append to applications.notes JSON array
    try {
        const existing = await fetchNotes(payload.application_id);
        const updated = [...existing, newNote];
        await supabase
            .from('applications')
            .update({ notes: JSON.stringify(updated) })
            .eq('id', payload.application_id);
    } catch (fallbackErr) {
        console.error("[NoteService] Fallback save failed:", fallbackErr);
        throw new Error("Could not save note to database.");
    }

    return newNote;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Note (with automatic fallback to applications.notes JSON)
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteNote(noteId: string, applicationId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('candidate_notes')
            .delete()
            .eq('id', noteId);

        if (!error) return;
    } catch (tableError) {
        // Table doesn't exist yet
    }

    // Fallback: Remove from applications.notes JSON array
    try {
        const existing = await fetchNotes(applicationId);
        const updated = existing.filter(n => n.id !== noteId);
        await supabase
            .from('applications')
            .update({ notes: updated.length > 0 ? JSON.stringify(updated) : '' })
            .eq('id', applicationId);
    } catch (fallbackErr) {
        console.error("[NoteService] Fallback delete failed:", fallbackErr);
        throw new Error("Could not delete note.");
    }
}
