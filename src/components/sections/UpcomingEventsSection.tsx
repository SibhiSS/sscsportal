import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, MapPin, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchWebsiteEvents, siteMediaUrl, todayIst } from '@/lib/club';
import type { WebsiteEvent } from '@/types/club';

const monthShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleString('en-US', { month: 'short' }).toUpperCase();
const dayNum = (d: string) => String(new Date(`${d}T00:00:00`).getDate());
const longDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The home page's Upcoming events strip. It lists only the events a super admin has switched on
 * under Admin > Website > "Upcoming strip", and is hidden entirely when there are none.
 */
const UpcomingEventsSection = () => {
  const [events, setEvents] = useState<WebsiteEvent[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchWebsiteEvents()
      .then(rows => { if (active) setEvents(rows); })
      .catch(() => { if (active) setEvents([]); });
    return () => { active = false; };
  }, []);

  const list = useMemo(() => {
    const today = todayIst();
    return (events ?? [])
      .filter(e => e.upcoming && e.end_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [events]);

  if (!list.length) return null;
  const open = list.find(e => e.id === openId) ?? null;

  return (
    <section id="upcoming-events" className="relative scroll-mt-24 pb-12 pt-8">
      <div className="mx-auto max-w-[1246px] px-6 xl:px-0">
        <div className="flex items-center justify-between">
          <p className="flex items-center font-mono text-[12px] tracking-[0.35em] text-[#0B1726]">
            UPCOMING EVENTS <span className="ml-4 inline-block h-px w-[60px] bg-primary" />
          </p>
          <a href="#events" className="inline-flex items-center gap-2 text-[14px] font-medium text-primary hover:underline">
            View All Events <ArrowRight className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {list.map(e => {
            const poster = siteMediaUrl(e.poster);
            const place = e.is_online ? 'Online' : e.venue;
            return (
              <article
                key={e.id}
                className="group flex flex-col overflow-hidden rounded-md border border-border bg-white/85 shadow-[0_8px_24px_-16px_rgba(15,58,107,0.25)] transition-shadow hover:shadow-[0_14px_30px_-14px_rgba(15,58,107,0.35)]"
              >
                {poster && (
                  <button type="button" onClick={() => setOpenId(e.id)} className="block aspect-[4/5] w-full overflow-hidden bg-primary/5" aria-label={`View the poster for ${e.title}`}>
                    <img src={poster} alt={`${e.title} poster`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  </button>
                )}
                <div className="flex flex-1 items-start gap-4 p-5">
                  <div className="flex h-[60px] w-[60px] shrink-0 flex-col items-center justify-center rounded-md bg-[#F1F5FB] font-heading">
                    <span className="text-[24px] font-bold leading-6 text-[#0B1726]">{dayNum(e.start_date)}</span>
                    <span className="mt-1 text-[13px] leading-none tracking-[0.15em] text-muted-foreground">{monthShort(e.start_date)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {e.tags[0] && <span className="inline-block rounded-[3px] bg-primary/10 px-2.5 py-0.5 text-[12px] font-medium text-primary">{e.tags[0]}</span>}
                    <h3 className="mt-2 font-heading text-[16px] font-bold leading-5 text-[#0B1726]">{e.title}</h3>
                    {e.blurb && <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{e.blurb}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" />{e.time || 'All Day'}</span>
                      {place && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />{place}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 border-t border-border px-5 py-3">
                  {e.register_url ? (
                    <a
                      href={e.register_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center gap-2 rounded-[3px] bg-primary px-5 text-[13px] font-medium text-white shadow-[0_8px_18px_-10px_hsl(var(--primary)/0.8)] transition-colors hover:bg-primary/90"
                    >
                      Register <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <button type="button" onClick={() => setOpenId(e.id)} className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
                    Details <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={o => { if (!o) setOpenId(null); }}>
        {open && (
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-[#0B1726]">{open.title}</DialogTitle>
              <DialogDescription>
                {longDate(open.start_date)}{open.time ? ` · ${open.time}` : ''}{open.is_online ? ' · Online' : open.venue ? ` · ${open.venue}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,260px)_1fr]">
              {siteMediaUrl(open.poster) && (
                <a href={siteMediaUrl(open.poster) ?? undefined} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-border">
                  <img src={siteMediaUrl(open.poster) ?? ''} alt={`${open.title} poster`} className="h-full w-full object-cover" />
                </a>
              )}
              <div className={siteMediaUrl(open.poster) ? '' : 'sm:col-span-2'}>
                {open.blurb && <p className="text-[15px] leading-6 text-muted-foreground">{open.blurb}</p>}
                {open.details.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {open.details.map(d => (
                      <li key={d} className="flex gap-3 text-[14px] leading-6 text-muted-foreground"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{d}</li>
                    ))}
                  </ul>
                )}
                {open.register_url && (
                  <a href={open.register_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex h-10 items-center gap-2 rounded-[3px] bg-primary px-6 text-[14px] font-medium text-white hover:bg-primary/90">
                    Register now <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
};

export default UpcomingEventsSection;
