import React, { useState, useEffect, useRef } from 'react';
import { CandidateNote } from '@/types';
import { fetchNotes, addNote, deleteNote, fetchCommitteeMembers, CommitteeMember } from '@/services/noteService';
import { useAuth } from '@/contexts/AuthContext';
import { MessageSquare, Send, Trash2, AtSign, User, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface TeamNotesFeedProps {
    applicationId: string;
}

export default function TeamNotesFeed({ applicationId }: TeamNotesFeedProps) {
    const { user } = useAuth();
    const [notes, setNotes] = useState<CandidateNote[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [newContent, setNewContent] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    // Mention Autocomplete state
    const [members, setMembers] = useState<CommitteeMember[]>([]);
    const [showMentionMenu, setShowMentionMenu] = useState<boolean>(false);
    const [mentionFilter, setMentionFilter] = useState<string>('');
    const [cursorPos, setCursorPos] = useState<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        Promise.all([
            fetchNotes(applicationId),
            fetchCommitteeMembers()
        ]).then(([notesData, membersData]) => {
            if (isMounted) {
                setNotes(notesData);
                setMembers(membersData);
                setLoading(false);
            }
        }).catch(err => {
            console.error("Failed to load notes or members:", err);
            if (isMounted) setLoading(false);
        });
        return () => { isMounted = false; };
    }, [applicationId]);

    // Handle typing and detecting '@' for mention autocomplete
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewContent(val);

        const pos = e.target.selectionStart;
        setCursorPos(pos);

        // Check if there is an '@' before the cursor without a space after it
        const textUpToCursor = val.slice(0, pos);
        const lastAtIdx = textUpToCursor.lastIndexOf('@');

        if (lastAtIdx !== -1) {
            const query = textUpToCursor.slice(lastAtIdx + 1);
            // Don't trigger if there is a space or newline after @
            if (!query.includes(' ') && !query.includes('\n') && query.length <= 20) {
                setMentionFilter(query.toLowerCase());
                setShowMentionMenu(true);
                return;
            }
        }
        setShowMentionMenu(false);
    };

    const insertMention = (member: CommitteeMember) => {
        const textUpToCursor = newContent.slice(0, cursorPos);
        const textAfterCursor = newContent.slice(cursorPos);
        const lastAtIdx = textUpToCursor.lastIndexOf('@');

        if (lastAtIdx !== -1) {
            const mentionTag = `@${member.name.replace(/\s+/g, '')} `;
            const updated = textUpToCursor.slice(0, lastAtIdx) + mentionTag + textAfterCursor;
            setNewContent(updated);
            setShowMentionMenu(false);
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        }
    };

    const handleSend = async () => {
        if (!newContent.trim() || submitting || !user) return;
        setSubmitting(true);
        try {
            // Extract mentioned usernames/emails
            const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
            const matches = newContent.match(mentionRegex) || [];
            const mentions = matches.map(m => m.slice(1).toLowerCase());

            const authorName = user.email ? user.email.split('@')[0].toUpperCase() : 'Admin';

            const savedNote = await addNote({
                application_id: applicationId,
                author_email: user.email || 'admin@sscs.org',
                author_name: authorName,
                content: newContent.trim(),
                mentions
            });

            setNotes(prev => [...prev, savedNote]);
            setNewContent('');
            setShowMentionMenu(false);
            toast.success("Note posted to committee feed!");
        } catch (err: any) {
            toast.error("Failed to post note: " + (err.message || "Unknown error"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (noteId: string) => {
        if (!confirm("Remove this comment from the committee feed?")) return;
        try {
            await deleteNote(noteId, applicationId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            toast.success("Note removed");
        } catch (err: any) {
            toast.error("Could not delete note: " + err.message);
        }
    };

    const filteredMembers = members.filter(m => 
        m.name.toLowerCase().includes(mentionFilter) || m.email.toLowerCase().includes(mentionFilter)
    );

    // Format content with highlighted badges for @mentions
    const renderHighlightedContent = (content: string) => {
        const parts = content.split(/(@[a-zA-Z0-9._-]+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                const isMe = user?.email && part.toLowerCase().includes(user.email.split('@')[0].toLowerCase());
                return (
                    <span
                        key={index}
                        className={`inline-block px-1.5 py-0.2 mx-0.5 rounded-md font-semibold text-xs border ${
                            isMe 
                                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 shadow-sm shadow-pink-500/20 animate-pulse'
                                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                        }`}
                    >
                        {part}
                    </span>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div className="space-y-4 bg-black/40 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30">
                        <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white tracking-wide">Committee Discussion Feed</h4>
                        <p className="text-[11px] text-muted-foreground">
                            Internal notes & evaluation remarks ({notes.length})
                        </p>
                    </div>
                </div>
                <span className="text-[10px] text-white/40 font-mono bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                    Type @ to tag members
                </span>
            </div>

            {/* Note List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {loading ? (
                    <div className="py-8 text-center text-xs text-muted-foreground animate-pulse flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4 animate-spin text-primary" />
                        Loading committee discussion...
                    </div>
                ) : notes.length === 0 ? (
                    <div className="py-8 text-center bg-white/[0.02] border border-white/5 rounded-xl">
                        <MessageSquare className="w-6 h-6 text-white/20 mx-auto mb-2" />
                        <p className="text-xs text-white/60 font-medium">No committee notes yet</p>
                        <p className="text-[11px] text-white/30 mt-0.5">Start the discussion or tag a panelist below.</p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {notes.map((note) => {
                            const isMyNote = user?.email === note.author_email || user?.role === 'super_admin';
                            const amIMentioned = user?.email && note.content.toLowerCase().includes(user.email.split('@')[0].toLowerCase());

                            return (
                                <motion.div
                                    key={note.id}
                                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`p-3.5 rounded-xl border transition-all ${
                                        amIMentioned 
                                            ? 'bg-gradient-to-r from-pink-950/30 via-purple-950/20 to-black/80 border-pink-500/40 shadow-lg shadow-pink-500/10'
                                            : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                                {note.author_name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-white">{note.author_name}</span>
                                                <span className="text-[10px] text-muted-foreground ml-2 font-mono">
                                                    {new Date(note.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            {amIMentioned && (
                                                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30">
                                                    Mentioned You
                                                </span>
                                            )}
                                            {isMyNote && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(note.id)}
                                                    className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                                                    title="Delete Note"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap pl-8">
                                        {renderHighlightedContent(note.content)}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Input & Autocomplete Area */}
            <div className="relative pt-2 border-t border-white/10">
                {/* Autocomplete Popover */}
                <AnimatePresence>
                    {showMentionMenu && filteredMembers.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto bg-black/95 border border-purple-500/40 rounded-xl shadow-2xl p-1.5 z-50 custom-scrollbar backdrop-blur-2xl"
                        >
                            <div className="text-[10px] font-bold uppercase tracking-widest text-purple-300 px-2 py-1 border-b border-white/10 mb-1 flex items-center gap-1">
                                <AtSign className="w-3 h-3" /> Select member to tag
                            </div>
                            {filteredMembers.map((m, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => insertMention(m)}
                                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-purple-500/20 text-xs text-white transition-colors group"
                                >
                                    <div className="truncate">
                                        <div className="font-semibold text-purple-200 group-hover:text-white">{m.name}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">{m.email}</div>
                                    </div>
                                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/60">
                                        {m.role.replace('_', ' ')}
                                    </span>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex gap-2">
                    <Textarea
                        ref={textareaRef}
                        value={newContent}
                        onChange={handleTextChange}
                        placeholder="Add a committee note... (Type @ to tag a member)"
                        rows={2}
                        className="bg-white/[0.03] border-white/15 text-white placeholder:text-white/30 text-xs rounded-xl resize-none focus:border-primary/50 focus:ring-0 transition-all flex-1"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <Button
                        type="button"
                        onClick={handleSend}
                        disabled={submitting || !newContent.trim()}
                        className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl h-auto px-4 flex flex-col items-center justify-center gap-1 shadow-lg shrink-0"
                    >
                        {submitting ? (
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                                className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                            />
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                <span className="text-[10px] font-bold">Post</span>
                            </>
                        )}
                    </Button>
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1.5 px-1">
                    <span>Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-white font-mono">Ctrl+Enter</kbd> to post</span>
                    <span>No emails sent for tags (UI notifications only)</span>
                </div>
            </div>
        </div>
    );
}
