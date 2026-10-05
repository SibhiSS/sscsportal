import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ExternalLink, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X, ZoomIn } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import ScrambleText from '@/components/fx/ScrambleText';
import { fetchWebsiteEvents, siteMediaUrl, splitHomeEvents, todayIst } from '@/lib/club';
import type { WebsiteEvent } from '@/types/club';

const SUBTITLE = 'IEEE Solid-State Circuits Society (SSCS)';

// Shown if the database can't be reached (e.g. before the website_events
// migration has been run), so the section is never empty.
const FALLBACK: WebsiteEvent[] = [
  {
    id: 'ice-breaker-2025', title: 'Ice Breaker Session', start_date: '2025-08-01', end_date: '2025-08-01',
    is_online: false, venue: null, featured: true, link: null, cover: '/event1.jpg', gallery: ['/event1.jpg'],
    blurb: 'An introductory session for newly selected members to connect, form cross-functional teams, and brainstorm innovative event concepts to execute during the tenure.',
    details: [
      "Welcomed newly recruited members and introduced the chapter's core mission.",
      'Facilitated structured networking to help members form effective working teams.',
      'Conducted a collaborative brainstorming session where teams developed and pitched technical event ideas.',
    ],
    tags: ['Networking', 'Team Building', 'Brainstorming'],
  },
  {
    id: 'capture-the-signal-2026', title: 'Capture the Signal', start_date: '2026-04-01', end_date: '2026-04-01',
    is_online: false, venue: null, featured: true, link: null, cover: '/event2-1.jpg', gallery: ['/event2-1.jpg', '/event2-2.jpg'],
    blurb: 'A high-stakes, multi-round electronics competition that challenged participants across circuit design, signal analysis, and engineering strategy.',
    details: [
      'Designed complex resistor networks and solved intricate Boolean logic puzzles under time pressure.',
      'Deciphered cryptic electronics clues and conducted deep black-box circuit analysis.',
      'Constructed physical analog circuits using real lab equipment to validate theoretical designs.',
      'Progressed through a tiered competition structure focused on hands-on hardware mastery.',
    ],
    tags: ['Competition', 'Circuit Design', 'Analog Electronics'],
  },
];

const monthYear = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
const fullDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function countdown(e: WebsiteEvent, today: string) {
  if (e.start_date <= today) return 'Happening now';
  const days = Math.round((Date.parse(e.start_date) - Date.parse(today)) / 86_400_000);
  return days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`;
}

const EventsSection = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<WebsiteEvent[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchWebsiteEvents()
      .then(rows => { if (active) setEvents(rows); })
      .catch(err => { console.warn('[events] Using built-in events:', err); if (active) setEvents(FALLBACK); });
    return () => { active = false; };
  }, []);

  const today = todayIst();
  const { upNext, past } = useMemo(
    () => splitHomeEvents(events ?? [], e => e.featured, today, e => e.feature_order),
    [events, today],
  );
  // Every past event, newest first, for "See all events".
  const allPast = useMemo(() => (events ?? []).filter(e => e.end_date < today), [events, today]);
  const [showAll, setShowAll] = useState(false);
  const hidden = allPast.length - past.length;

  const shown = [...(upNext ? [upNext] : []), ...(showAll ? allPast : past)];
  const selected = shown.find(e => e.id === selectedId) ?? null;
  const images = useMemo(
    () => (selected ? (selected.gallery.length ? selected.gallery : selected.cover ? [selected.cover] : []) : [])
      .map(siteMediaUrl).filter((u): u is string => !!u),
    [selected],
  );

  // Index of the photo open in the lightbox, or null when it's closed.
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  useEffect(() => { setViewerIdx(null); }, [selectedId]);

  const step = (dir: 1 | -1) =>
    setViewerIdx(i => (i === null ? i : (i + dir + images.length) % images.length));

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (viewerIdx !== null) {
        if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === 'Escape') setViewerIdx(null);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <section id="events" className="py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16 max-w-6xl mx-auto px-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs text-primary tracking-[0.3em] uppercase mb-3 block font-medium">
            {upNext ? 'Events' : 'Archive'}
          </span>
          <h2 className="font-heading text-[1.75rem] leading-tight sm:text-4xl font-bold text-foreground">
            <ScrambleText text={upNext ? 'Events' : 'Past Events'} />
          </h2>
        </motion.div>

        <div className="max-w-6xl mx-auto space-y-6 px-6">
          {events === null && Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
          ))}

          {events !== null && shown.length === 0 && (
            <HolographicCard className="p-8 text-center text-sm text-muted-foreground">
              Events will appear here soon.
            </HolographicCard>
          )}

          {shown.map(event => {
            const isNext = event.id === upNext?.id;
            return (
              <motion.div
                key={event.id}
                layoutId={`card-${event.id}`}
                onClick={() => setSelectedId(event.id)}
                className="cursor-pointer"
              >
                <HolographicCard className={`p-8 hover:border-primary/30 transition-all duration-300 ${isNext ? 'border-primary/30' : ''}`}>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        {isNext ? (
                          <p className="inline-flex items-center gap-2 text-[10px] md:text-xs text-primary tracking-[0.2em] uppercase font-bold mb-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
                            <CalendarClock className="w-3.5 h-3.5" /> Up next · {countdown(event, today)}
                          </p>
                        ) : (
                          <p className="text-[10px] md:text-xs text-muted-foreground tracking-[0.2em] uppercase font-medium mb-1">
                            {monthYear(event.start_date)}
                          </p>
                        )}
                        <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-1">{event.title}</h3>
                        <p className="text-sm md:text-base text-muted-foreground mb-4">
                          {isNext
                            ? [fullDate(event.start_date), event.is_online ? 'Online' : event.venue].filter(Boolean).join(' · ')
                            : SUBTITLE}
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-muted-foreground/50 mt-1 flex-shrink-0" />
                    </div>

                    {event.blurb && (
                      <p className="text-sm md:text-base text-muted-foreground/80 leading-relaxed mb-6">{event.blurb}</p>
                    )}

                    {event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {event.tags.map(tag => (
                          <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[10px] text-muted-foreground hover:border-primary/30 transition-colors">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </HolographicCard>
              </motion.div>
            );
          })}

          {hidden > 0 && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={() => {
                  if (showAll) document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
                  setShowAll(v => !v);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/10 bg-white/[0.03] text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
              >
                {showAll ? <>Show less <ChevronUp className="w-4 h-4" /></> : <>See all events ({allPast.length}) <ChevronDown className="w-4 h-4" /></>}
              </button>
            </div>
          )}
        </div>

        {/* Enlarged Overlay */}
        <AnimatePresence>
          {selected && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedId(null)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-zoom-out"
                />
                <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
                  <motion.div
                    layoutId={`card-${selected.id}`}
                    className="w-full max-w-2xl max-h-[80vh] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-y-auto pointer-events-auto custom-scrollbar shadow-2xl"
                  >
                    <div className="p-6 md:p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-muted-foreground tracking-[0.2em] uppercase font-medium mb-1">
                            {selected.id === upNext?.id ? fullDate(selected.start_date) : monthYear(selected.start_date)}
                          </p>
                          <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-1">{selected.title}</h3>
                          <p className="text-sm md:text-base text-muted-foreground">{SUBTITLE}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedId(null); }}
                          className="p-2 hover:bg-white/5 rounded-full transition-colors"
                          aria-label="Close"
                        >
                          <Minus className="w-6 h-6 text-muted-foreground/50" />
                        </button>
                      </div>

                      {selected.blurb && (
                        <p className="text-sm md:text-base text-muted-foreground/90 leading-relaxed mb-6">{selected.blurb}</p>
                      )}

                      {images.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                          {images.map((img, idx) => (
                            <button
                              key={img}
                              type="button"
                              onClick={() => setViewerIdx(idx)}
                              className="group relative aspect-[4/3] rounded-lg overflow-hidden border border-white/10 hover:border-primary/40 transition-colors cursor-zoom-in"
                              aria-label={`View photo ${idx + 1} of ${images.length}`}
                            >
                              <img src={img} alt={`${selected.title} photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="w-5 h-5 text-white" />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {selected.details.length > 0 && (
                        <div className="space-y-3 mb-6">
                          {selected.details.map((detail, idx) => (
                            <div key={idx} className="flex items-start gap-4 text-muted-foreground">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                              <p className="text-sm md:text-base">{detail}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {(selected.link || selected.tags.length > 0) && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6 border-t border-white/5">
                          {selected.link && (
                            <a
                              href={selected.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-[10px] md:text-xs text-primary font-bold tracking-widest uppercase hover:text-primary/80 transition-colors group"
                            >
                              View post <ExternalLink className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </a>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {selected.tags.map(tag => (
                              <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[10px] text-muted-foreground">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </>
          )}
        </AnimatePresence>

        {/* Photo lightbox — full image, actual proportions, prev/next within this event */}
        <AnimatePresence>
          {selected && viewerIdx !== null && images[viewerIdx] && (
            <motion.div
              key="lightbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewerIdx(null)}
              className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-12"
            >
              <motion.img
                key={images[viewerIdx]}
                src={images[viewerIdx]}
                alt={`${selected.title} photo ${viewerIdx + 1}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                onClick={e => e.stopPropagation()}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />

              <button
                onClick={e => { e.stopPropagation(); setViewerIdx(null); }}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Close photo"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              {images.length > 1 && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); step(-1); }}
                    className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); step(1); }}
                    className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                </>
              )}

              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70 tracking-widest">
                {viewerIdx + 1} / {images.length}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default EventsSection;
