import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, MapPin } from 'lucide-react';
import SectionHeader from '@/components/site/SectionHeader';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchWebsiteEvents, siteMediaUrl, todayIst } from '@/lib/club';
import type { WebsiteEvent } from '@/types/club';

type Tab = 'upcoming' | 'past';

const fullDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const EventsSection = () => {
  const [events, setEvents] = useState<WebsiteEvent[] | null>(null);
  const [tab, setTab] = useState<Tab>('past');
  const [pickedTab, setPickedTab] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchWebsiteEvents()
      .then(rows => { if (active) setEvents(rows); })
      .catch(err => { console.warn('[events] Could not load:', err); if (active) setEvents([]); });
    return () => { active = false; };
  }, []);

  const today = todayIst();
  const { upcoming, past } = useMemo(() => {
    const all = events ?? [];
    return {
      upcoming: all.filter(e => e.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date)),
      past: all.filter(e => e.end_date < today).sort((a, b) => b.start_date.localeCompare(a.start_date)),
    };
  }, [events, today]);

  // Open on Upcoming when there is something coming, unless the visitor has chosen a tab.
  const active: Tab = pickedTab ? tab : upcoming.length ? 'upcoming' : 'past';
  const list = active === 'upcoming' ? upcoming : past;
  const open = (events ?? []).find(e => e.id === openId) ?? null;

  return (
    <section id="events" className="bg-[#EBF1FA] py-16 md:py-20">
      <div className="mx-auto max-w-[1246px] px-6 xl:px-0">
        <SectionHeader
          eyebrow="Events"
          title={<>Workshops, talks &amp; <span className="text-primary">hackathons.</span></>}
          action={
            <div role="tablist" className="inline-flex rounded-[3px] border border-border bg-white p-1">
              {(['upcoming', 'past'] as Tab[]).map(t => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={active === t}
                  onClick={() => { setTab(t); setPickedTab(true); }}
                  className={`rounded-[3px] px-4 py-1.5 text-[13px] font-medium capitalize transition-colors ${active === t ? 'bg-primary text-white' : 'text-muted-foreground hover:text-primary'}`}
                >
                  {t} ({t === 'upcoming' ? upcoming.length : past.length})
                </button>
              ))}
            </div>
          }
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events === null && Array.from({ length: 3 }, (_, i) => <div key={i} className="h-72 animate-pulse rounded-md bg-white/60" />)}
          {events !== null && list.length === 0 && (
            <p className="col-span-full rounded-md border border-border bg-white/80 py-12 text-center text-sm text-muted-foreground">
              {active === 'upcoming' ? 'No upcoming events yet. Follow us on Instagram to hear first.' : 'Past events will appear here.'}
            </p>
          )}
          {list.map(e => {
            const cover = siteMediaUrl(e.cover);
            return (
              <button
                key={e.id}
                onClick={() => setOpenId(e.id)}
                className="group flex flex-col overflow-hidden rounded-md border border-border bg-white text-left shadow-[0_8px_24px_-18px_rgba(15,58,107,0.3)] transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_16px_32px_-16px_rgba(49,135,232,0.35)]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-primary/10">
                  {cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  {e.tags[0] && <span className="absolute left-3 top-3 rounded-[3px] bg-white/90 px-2 py-0.5 text-[12px] font-medium text-primary">{e.tags[0]}</span>}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 text-primary" />{fullDate(e.start_date)}</p>
                  <h3 className="mt-2 font-heading text-[17px] font-bold leading-6 text-[#0B1726]">{e.title}</h3>
                  {e.blurb && <p className="mt-2 line-clamp-3 text-[14px] leading-[22px] text-muted-foreground">{e.blurb}</p>}
                  {(e.venue || e.is_online) && (
                    <p className="mt-auto flex items-center gap-1.5 pt-4 text-[12px] text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" />{e.is_online ? 'Online' : e.venue}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={o => { if (!o) setOpenId(null); }}>
        {open && (
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-[#0B1726]">{open.title}</DialogTitle>
              <DialogDescription>{fullDate(open.start_date)}{open.venue ? ` · ${open.venue}` : ''}</DialogDescription>
            </DialogHeader>
            {open.blurb && <p className="text-[15px] leading-6 text-muted-foreground">{open.blurb}</p>}
            {(open.gallery.length ? open.gallery : open.cover ? [open.cover] : []).length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(open.gallery.length ? open.gallery : [open.cover as string]).map(g => siteMediaUrl(g)).filter((u): u is string => !!u).map(u => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="aspect-[4/3] overflow-hidden rounded-md border border-border">
                    <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
            {open.details.length > 0 && (
              <ul className="space-y-2">
                {open.details.map(d => (
                  <li key={d} className="flex gap-3 text-[14px] leading-6 text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{d}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {open.tags.map(t => <span key={t} className="rounded-[3px] bg-primary/10 px-2 py-0.5 text-[12px] font-medium text-primary">{t}</span>)}
              </div>
              {open.link && (
                <a href={open.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
                  View post <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
};

export default EventsSection;
