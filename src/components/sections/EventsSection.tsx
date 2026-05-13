import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, ExternalLink } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';

export interface PastEvent {
  id: string;
  logo: string;
  title: string;
  subtitle: string;
  date: string;
  description: string;
  fullDetails: string[];
  images: string[];
  linkedinUrl?: string;
  tags: string[];
}

const pastEvents: PastEvent[] = [
  {
    id: 'ice-breaker-2025',
    title: 'Ice Breaker Session',
    subtitle: 'IEEE Solid-State Circuits Society (SSCS)',
    date: 'AUG 2025',
    description: "An introductory session for newly selected members to connect, form cross-functional teams, and brainstorm innovative event concepts to execute during the tenure.",
    fullDetails: [
      "Welcomed newly recruited members and introduced the chapter's core mission.",
      "Facilitated structured networking to help members form effective working teams.",
      "Conducted a collaborative brainstorming session where teams developed and pitched technical event ideas."
    ],
    images: ['/event1.jpg'],
    linkedinUrl: 'https://linkedin.com',
    tags: ['Networking', 'Team Building', 'Brainstorming']
  },
  {
    id: 'capture-the-signal-2026',
    title: 'Capture the Signal',
    subtitle: 'IEEE Solid-State Circuits Society (SSCS)',
    date: 'APRIL 2026',
    description: "A high-stakes, multi-round electronics competition that challenged participants across circuit design, signal analysis, and engineering strategy.",
    fullDetails: [
      "Designed complex resistor networks and solved intricate Boolean logic puzzles under time pressure.",
      "Deciphered cryptic electronics clues and conducted deep black-box circuit analysis.",
      "Constructed physical analog circuits using real lab equipment to validate theoretical designs.",
      "Progressed through a tiered competition structure focused on hands-on hardware mastery."
    ],
    images: ['/event2-1.jpg', '/event2-2.jpg'],
    linkedinUrl: 'https://linkedin.com',
    tags: ['Competition', 'Circuit Design', 'Analog Electronics']
  }
];

const EventsSection = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <section id="events" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16 max-w-6xl mx-auto px-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs text-primary tracking-[0.3em] uppercase mb-3 block font-medium">
            Archive
          </span>
          <h2 className="font-heading text-4xl font-bold text-foreground">
            <RevealText text="Past Events" />
          </h2>
        </motion.div>

        {/* Events List */}
        <div className="max-w-6xl mx-auto space-y-6 px-6">
          {pastEvents.map((event) => (
            <div key={event.id} className="relative">
              <motion.div
                layoutId={`card-${event.id}`}
                onClick={() => setSelectedId(event.id)}
                className="cursor-pointer"
              >
                <HolographicCard className="p-8 hover:border-primary/30 transition-all duration-300">
                  <div className="flex flex-col gap-2">
                    {/* Header Info */}
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-xs text-muted-foreground tracking-[0.2em] uppercase font-medium mb-1">
                          {event.date}
                        </p>
                        <h3 className="text-xl md:text-2xl font-semibold text-foreground mb-1">
                          {event.title}
                        </h3>
                        <p className="text-sm md:text-base text-muted-foreground mb-4">
                          {event.subtitle}
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-muted-foreground/50 mt-1 flex-shrink-0" />
                    </div>

                    <p className="text-sm md:text-base text-muted-foreground/80 leading-relaxed mb-6">
                      {event.description}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {event.tags.map(tag => (
                        <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[10px] text-muted-foreground hover:border-primary/30 transition-colors">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </HolographicCard>
              </motion.div>

              {/* Enlarged Overlay */}
              <AnimatePresence>
                {selectedId === event.id && (
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
                        layoutId={`card-${event.id}`}
                        className="w-full max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-y-auto pointer-events-auto custom-scrollbar shadow-2xl"
                      >
                        <div className="p-8 md:p-12">
                          {/* Expanded Header */}
                          <div className="flex justify-between items-start mb-8">
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] md:text-xs text-muted-foreground tracking-[0.2em] uppercase font-medium mb-1">
                                {event.date}
                              </p>
                              <h3 className="text-2xl md:text-3xl font-semibold text-foreground mb-1">
                                {event.title}
                              </h3>
                              <p className="text-sm md:text-base text-muted-foreground">
                                {event.subtitle}
                              </p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setSelectedId(null); }}
                              className="p-2 hover:bg-white/5 rounded-full transition-colors"
                            >
                              <Minus className="w-6 h-6 text-muted-foreground/50" />
                            </button>
                          </div>

                          <p className="text-sm md:text-lg text-muted-foreground/90 leading-relaxed mb-10">
                            {event.description}
                          </p>

                          {/* Optional Images Grid */}
                          {event.images && event.images.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                              {event.images.map((img, idx) => (
                                <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-white/10">
                                  <img 
                                    src={img} 
                                    alt={`Event ${idx}`} 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Full Details List */}
                          <div className="space-y-4 mb-10">
                            {event.fullDetails.map((detail, idx) => (
                              <div key={idx} className="flex items-start gap-4 text-muted-foreground">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                <p className="text-sm md:text-base">{detail}</p>
                              </div>
                            ))}
                          </div>

                          {/* Action Bar */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-8 border-t border-white/5">
                            {event.linkedinUrl && (
                              <a 
                                href={event.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-[10px] md:text-xs text-primary font-bold tracking-widest uppercase hover:text-primary/80 transition-colors group"
                              >
                                View Linkedin Post <ExternalLink className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                              </a>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {event.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/5 text-[10px] text-muted-foreground">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventsSection;
