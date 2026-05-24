import { useState, useMemo } from 'react';
import { format, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, Calendar, Users, Flame } from 'lucide-react';
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
    /** Receives slotId, slotTime, panelId — triggers confirmation modal upstream */
    onSelectSlot: (slotId: string, slotTime: string, panelId: number) => void;
    isLoading?: boolean;
}

export default function SlotCalendar({ slots, onSelectSlot }: SlotCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Only show available slots in the calendar
    const availableSlots = useMemo(() =>
        slots.filter(s => !s.is_booked),
        [slots]
    );

    // Group by date key for fast lookup
    const slotsByDate = useMemo(() => {
        const map: Record<string, SlotData[]> = {};
        for (const slot of availableSlots) {
            const key = format(parseISO(slot.start_time), 'yyyy-MM-dd');
            if (!map[key]) map[key] = [];
            map[key].push(slot);
        }
        return map;
    }, [availableSlots]);

    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const startDayOfWeek = getDay(startOfMonth(currentMonth));

    const totalBooked = slots.filter(s => s.is_booked).length;
    const bookedPct = slots.length > 0 ? Math.round((totalBooked / slots.length) * 100) : 0;

    const slotsForSelectedDate = selectedDate
        ? slotsByDate[format(selectedDate, 'yyyy-MM-dd')] || []
        : [];

    // Group by time — user never sees panels. Show one entry per time, pick first available panel.
    const slotsByTime = useMemo(() => {
        const map: Record<string, SlotData[]> = {};
        for (const slot of slotsForSelectedDate) {
            const key = format(parseISO(slot.start_time), 'HH:mm');
            if (!map[key]) map[key] = [];
            map[key].push(slot);
        }
        // Sort by time key
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, slots]) => slots); // array of slot groups
    }, [slotsForSelectedDate]);

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="grid md:grid-cols-[1fr_320px] gap-4">
            {/* ── Calendar ─────────────────────────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
                {/* Month navigation */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDate(null); }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-muted-foreground hover:text-white border border-white/5 hover:border-white/10"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h3>
                    <button
                        onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDate(null); }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-muted-foreground hover:text-white border border-white/5 hover:border-white/10"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Day labels */}
                <div className="grid grid-cols-7 mb-3">
                    {DAY_LABELS.map(d => (
                        <div key={d} className="text-center text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest py-1">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}

                    {daysInMonth.map(day => {
                        const key = format(day, 'yyyy-MM-dd');
                        const daySlots = slotsByDate[key] || [];
                        const hasSlots = daySlots.length > 0;
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isToday = isSameDay(day, new Date());
                        const isFilling = hasSlots && daySlots.length <= 2;

                        return (
                            <motion.button
                                key={key}
                                whileHover={hasSlots ? { scale: 1.08 } : {}}
                                whileTap={hasSlots ? { scale: 0.95 } : {}}
                                onClick={() => hasSlots && setSelectedDate(day)}
                                disabled={!hasSlots}
                                className={`
                                    relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all duration-200
                                    ${isSelected
                                        ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30 border border-purple-400/30'
                                        : hasSlots
                                            ? isFilling
                                                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 cursor-pointer'
                                                : 'bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 cursor-pointer'
                                            : 'text-muted-foreground/20 cursor-not-allowed'
                                    }
                                    ${isToday && !isSelected ? 'ring-1 ring-white/20' : ''}
                                `}
                            >
                                <span className="text-xs font-bold">{format(day, 'd')}</span>
                                {hasSlots && !isSelected && (
                                    <span className={`absolute bottom-1 text-[7px] font-bold ${isFilling ? 'text-amber-400' : 'text-purple-400'}`}>
                                        {daySlots.length}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-white/5 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30" />
                        <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-amber-500/15 border border-amber-500/30" />
                        <span>Filling fast</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-gradient-to-br from-purple-600 to-pink-600" />
                        <span>Selected</span>
                    </div>
                    {bookedPct > 50 && (
                        <div className="ml-auto flex items-center gap-1 text-amber-400">
                            <Flame className="w-3 h-3" />
                            <span>{bookedPct}% booked</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Time Slot Panel ─────────────────────────────────────── */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 backdrop-blur-xl flex flex-col">
                {/* Panel header */}
                <div className="flex items-center gap-2 mb-5">
                    <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <Clock className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">
                            {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a Date'}
                        </h3>
                        {selectedDate && slotsByTime.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">{slotsByTime.length} time{slotsByTime.length !== 1 ? 's' : ''} available</p>
                        )}
                    </div>
                </div>

                <div className="flex-1">
                    {!selectedDate ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center">
                            <Calendar className="w-10 h-10 text-muted-foreground/20 mb-3" />
                            <p className="text-sm text-muted-foreground/60 leading-relaxed">
                                Click a highlighted date<br />to view available slots
                            </p>
                        </div>
                    ) : slotsByTime.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center">
                            <Clock className="w-10 h-10 text-muted-foreground/20 mb-3" />
                            <p className="text-sm text-muted-foreground/60">All slots taken for this date</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={format(selectedDate!, 'yyyy-MM-dd')}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2"
                            >
                                {slotsByTime.map(group => {
                                    // Pick first available slot from this time group
                                    const slot = group[0];
                                    const timeStr = format(parseISO(slot.start_time), 'h:mm a');
                                    return (
                                        <motion.button
                                            key={slot.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => onSelectSlot(slot.id, slot.start_time, slot.panel_id)}
                                            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all group cursor-pointer"
                                            id={`slot-${slot.id}`}
                                        >
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors font-mono">
                                                    {timeStr}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    30 min · Available
                                                </div>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="bg-green-500/10 border-green-500/30 text-green-400 text-[10px] group-hover:bg-purple-500/20 group-hover:border-purple-500/40 group-hover:text-purple-300 transition-all"
                                            >
                                                Book
                                            </Badge>
                                        </motion.button>
                                    );
                                })}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>

                {/* Slot count footer */}
                {availableSlots.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground">
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
