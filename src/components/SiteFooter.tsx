import { Link } from 'react-router-dom';
import { ArrowUpRight, Instagram, Linkedin, Mail, MapPin } from 'lucide-react';
import { BUILT_BY, CLUB_LINKS } from '@/config/club';
import BrandLogo from '@/components/site/BrandLogo';

const ICONS: Record<string, typeof Mail> = { Instagram, LinkedIn: Linkedin, Email: Mail };

const EXPLORE = [
  { label: 'About', to: '/#about' },
  { label: 'Events', to: '/#events' },
  { label: 'Team', to: '/team' },
  { label: 'Leaderboard', to: '/leaderboard' },
  { label: 'Propose an event', to: '/proposals' },
];

const SiteFooter = () => (
  <footer className="relative overflow-hidden bg-[#0B1726] text-white">
    {/* Atmosphere: blue glows and a giant outlined wordmark */}
    <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-[100px]" />
    <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-10 h-72 w-72 rounded-full bg-primary/15 blur-[100px]" />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 select-none text-center font-display text-[clamp(120px,22vw,340px)] font-extrabold uppercase leading-[0.8] tracking-tight text-transparent"
      style={{ WebkitTextStroke: '1px rgba(255,255,255,0.07)' }}
    >
      AI Club
    </div>

    <div className="relative mx-auto max-w-[1246px] px-6 pb-40 pt-16 md:pb-56 xl:px-0">
      <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1.2fr]">
        <div>
          <BrandLogo size={56} tone="dark" />
          <p className="mt-6 max-w-sm text-[14px] leading-6 text-white/60">
            Where human curiosity meets artificial intelligence. A student-led community exploring AI through learning, building and collaboration.
          </p>
          <p className="mt-5 flex items-center gap-2 text-[13px] text-white/60"><MapPin className="h-4 w-4 text-primary" />VIT Chennai, India</p>
        </div>

        <nav aria-label="Explore">
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">EXPLORE</p>
          <ul className="mt-5 space-y-3 text-[14px] text-white/70">
            {EXPLORE.map(l => (
              <li key={l.label}>
                <Link to={l.to} className="transition-colors hover:text-white">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-primary">FOLLOW &amp; CONTACT</p>
          <ul className="mt-5 space-y-3">
            {CLUB_LINKS.map(l => {
              const Icon = ICONS[l.label];
              return (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target={l.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-primary/60 hover:bg-primary/10"
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{l.label}</span>
                      <span className="block truncate text-[12px] text-white/55">{l.handle}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/40 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>

    <div className="relative border-t border-white/10 bg-[#0B1726]/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1246px] flex-col gap-2 px-6 py-5 text-[13px] text-white/50 sm:flex-row sm:items-center sm:justify-between xl:px-0">
        <p>Copyright © 2026 AI Club VIT Chennai</p>
        <p>
          Built by{' '}
          <a href={BUILT_BY.href} target="_blank" rel="noopener noreferrer" className="text-white/80 underline decoration-primary decoration-2 underline-offset-4 transition-colors hover:text-white">
            {BUILT_BY.name}
          </a>
        </p>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
