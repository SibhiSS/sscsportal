import { useState, useMemo } from 'react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SlotData {
    id: string;
    start_time: string;
    end_time?: string;
    panel_id: number;
    is_booked: boolean;
}

interface SlotCalendarProps {
    slots: SlotData[];
    onSelectSlot: (slotId: string, slotTime: string, panelId: number) => void;
    isLoading?: boolean;
}

export default function SlotCalendar({ slots, onSelectSlot, isLoading = false }: SlotCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [bookingLoading, setBookingLoading] = useState<string | null>(null);

    // Available (unbooked) slots
    const availableSlots = useMemo(() =>
        slots.filter(s => !s.is_booked),
        [slots]
    );

    // Group slots by date key
    const slotsByDate = useMemo(() => {
        const map: Record<string, SlotData[]> = {};
        for (const slot of availableSlots) {
            const key = format(parseISO(slot.start_time), 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(slot);
        }
        return map;
    }, [availableSlots]);

    // Days in current month view
    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const startDayOfWeek = getDay(startOfMonth(currentMonth)); // 0=Sun

    // Total booked percentage
    const bookedPct = slots.length > 0 ? Math.round((slots.filter(s => s.is_booked).length / slots.length) * 100) : 0;

    const handleSelectSlot = async (slot: SlotData) => {
        setBookingLoading(slot.id);
        await onSelectSlot(slot.id, slot.start_time, slot.panel_id);
        setBookingLoading(null);
    };

    const slotsForSelectedDate = selectedDate
        ? slotsByDate[format(selectedDate, 'yyyy-MM-dd')] || []
        : [];

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="grid md:grid-cols-[1fr_300px] gap-6 max-w-4xl mx-auto">
            {/* ── Calendar ─────────────────────────────────────────────── */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => setCurrentMonth(m => subMonths(m, 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h3>
                    <button
                        onClick={() => setCurrentMonth(m => addMonths(m, 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 mb-2">
                    {DAY_LABELS.map(d => (
                        <div key={d} className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-wider py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {/* Empty cells before month starts */}
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}

                    {daysInMonth.map(day => {
                        const key = format(day, 'yyyy-MM-dd');
                        const daySlots = slotsByDate[key] || [];
                        const hasSlots = daySlots.length > 0;
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isToday = isSameDay(day, new Date());

                        return (
                            <motion.button
                                key={key}
                                whileHover={hasSlots ? { scale: 1.05 } : {}}
                                whileTap={hasSlots ? { scale: 0.95 } : {}}
                                onClick={() => hasSlots && setSelectedDate(day)}
                                disabled={!hasSlots}
                                className={`
                                    relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all
                                    ${isSelected
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                                        : hasSlots
                                            ? 'bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 cursor-pointer'
                                            : 'text-muted-foreground/30 cursor-not-allowed'}
                                    ${isToday && !isSelected ? 'ring-1 ring-white/20' : ''}
                                `}
                            >
                                <span className="text-xs">{format(day, 'd')}</span>
                                {hasSlots && !isSelected && (
                                    <span className="absolute bottom-1 text-[8px] font-bold text-purple-400">
                                        {daySlots.length}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30" />
                        <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-purple-600" />
                        <span>Selected</span>
                    </div>
                    {bookedPct > 60 && (
                        <div className="ml-auto flex items-center gap-1 text-amber-400">
                            <Clock className="w-3 h-3" />
                            <span>Filling fast ({bookedPct}% booked)</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Time Slot Panel ───────────────────────────────────────── */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-white">
                        {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a Date'}
                    </h3>
                </div>

                {!selectedDate ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Calendar className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            Click a highlighted date on the calendar to view available time slots
                        </p>
                    </div>
                ) : slotsForSelectedDate.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                        <Clock className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No slots left for this date</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={format(selectedDate, 'yyyy-MM-dd')}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-2"
                        >
                            {slotsForSelectedDate
                                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                .map(slot => (
                                    <motion.button
                                        key={slot.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleSelectSlot(slot)}
                                        disabled={!!bookingLoading}
                                        className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all group"
                                    >
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                                                {format(parseISO(slot.start_time), 'h:mm a')}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                Panel {slot.panel_id}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="bg-green-500/10 border-green-500/30 text-green-400 text-[10px]"
                                            >
                                                Open
                                            </Badge>
                                            {bookingLoading === slot.id && (
                                                <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                            )}
                                        </div>
                                    </motion.button>
                                ))}
                        </motion.div>
                    </AnimatePresence>
                )}

                {/* Slot stats */}
                {availableSlots.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{availableSlots.length} slots remaining</span>
                        </div>
                        <span>First come, first served</span>
                    </div>
                )}
            </div>
        </div>
    );
}
