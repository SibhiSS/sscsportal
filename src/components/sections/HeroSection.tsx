import { motion } from 'framer-motion';
import { ArrowRight, Infinity as InfinityIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRecruitmentCta } from '@/hooks/useRecruitmentCta';

const STATS = [
  { value: '50+', label: 'Active Members' },
  { value: '10+', label: 'Events Every Year' },
  { value: '20+', label: 'Projects Built' },
  { value: null, label: 'Ideas Ahead' },
];

const SIDE_DOTS = ['01', '02', '03', '04'];

const HeroSection = () => {
  const cta = useRecruitmentCta();

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const ctaClass =
    'inline-flex h-[42px] items-center justify-center rounded-[3px] border border-primary px-7 font-body text-[15px] font-medium text-primary transition-colors hover:bg-primary/10 aria-disabled:pointer-events-none aria-disabled:opacity-50';

  return (
    <section id="top" className="relative overflow-hidden bg-transparent pb-14 pt-32 lg:min-h-[557px] lg:pb-0 lg:pt-[118px]">
      {/* Corner circuit traces */}
      <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-[62px] hidden h-[160px] w-[110px] text-primary/50 xl:block" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M0 4 H52 L100 56" />
        <circle cx="98" cy="56" r="4" fill="currentColor" stroke="none" />
        <path d="M0 94 H40 L92 146" />
        <circle cx="92" cy="146" r="3.5" fill="currentColor" stroke="none" />
      </svg>
      <svg aria-hidden="true" className="pointer-events-none absolute right-0 top-[278px] hidden h-[100px] w-[130px] text-primary/50 xl:block" fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M130 2 L92 40 L60 88 H34" />
        <circle cx="35" cy="88" r="5" fill="none" strokeWidth="2" />
        <circle cx="35" cy="88" r="2" fill="currentColor" stroke="none" />
      </svg>

      {/* Section index */}
      <ol aria-hidden="true" className="absolute left-[34px] top-[270px] hidden flex-col items-center font-mono text-[11px] tracking-widest text-muted-foreground/70 xl:flex">
        {SIDE_DOTS.map((n, i) => (
          <li key={n} className="flex flex-col items-center">
            <span className={i === 0 ? 'text-primary' : ''}>{n}</span>
            {i === 0 ? (
              <>
                <span className="my-2 h-[7px] w-[7px] rounded-full bg-primary" />
                <span className="h-5 w-px bg-primary/40" />
                <span className="mt-2 h-4 w-px bg-primary/30" />
              </>
            ) : (
              <span className="h-[22px]" />
            )}
          </li>
        ))}
      </ol>

      {/* Right-hand taglines */}
      <p aria-hidden="true" className="absolute right-[100px] top-[137px] hidden w-[110px] font-mono text-[11px] uppercase leading-[18px] tracking-[0.25em] text-muted-foreground xl:block">
        Same minds brighter tomorrows
        <span className="mt-3 block h-px w-8 bg-primary" />
      </p>
      <p aria-hidden="true" className="absolute bottom-[32px] right-[80px] hidden w-[100px] font-mono text-[11px] uppercase leading-[18px] tracking-[0.25em] text-muted-foreground xl:block">
        AI for a better tomorrow
        <span className="mt-3 block h-px w-8 bg-primary" />
      </p>

      <div className="mx-auto grid max-w-[1246px] items-start gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_563px] lg:px-0">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10"
        >
          <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
            LEARN <span className="mx-1 text-primary">•</span> BUILD <span className="mx-1 text-primary">•</span> COLLABORATE <span className="mx-1 text-primary">•</span> CREATE
          </p>

          <h1 className="mt-7 font-display text-[40px] font-extrabold uppercase leading-[0.98] tracking-tight text-[#0B1726] sm:text-[48px] lg:text-[52px]">
            Where human
            <br />
            curiosity meets
            <br />
            <span className="text-primary">artificial intelligence.</span>
          </h1>

          <p className="mt-4 max-w-[540px] font-body text-[17px] leading-[26px] text-muted-foreground">
            A student-led community at VIT Chennai, exploring AI through learning, building and collaboration.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => scrollToSection('#events')}
              className="inline-flex h-[42px] items-center gap-3 rounded-[3px] bg-primary px-8 font-body text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.7)] transition-colors hover:bg-primary/90"
            >
              Explore Events
              <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
            </button>
            {cta.kind === 'link' && (
              <a href={cta.href} target="_blank" rel="noopener noreferrer" className={ctaClass}>{cta.label}</a>
            )}
            {cta.kind === 'router' && (
              <Link to={cta.to} className={ctaClass}>{cta.label}</Link>
            )}
            {cta.kind === 'disabled' && (
              <span aria-disabled="true" className={ctaClass}>{cta.label}</span>
            )}
          </div>

          <div className="mt-10 grid max-w-[640px] grid-cols-2 gap-y-6 sm:grid-cols-4 lg:mt-8">
            {STATS.map((s, i) => (
              <div key={s.label} className={`h-11 sm:pr-4 ${i > 0 ? 'sm:border-l sm:border-border sm:pl-6' : ''}`}>
                <div className="font-heading text-xl font-bold leading-6 text-[#0B1726]">
                  {s.value ?? <InfinityIcon className="h-6 w-7 text-primary" strokeWidth={2.75} aria-label="Infinite" />}
                </div>
                <div className="mt-1 whitespace-nowrap text-[14px] leading-5 text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Visual: half-brain with circuit traces, blended into the page */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.2 }}
          className="relative mx-auto -mt-2 w-full max-w-[480px] lg:-mt-[53px] lg:mx-0 lg:w-[474px] lg:max-w-none"
        >
          <img
            src="/brand/hero-brain-light.png"
            alt=""
            aria-hidden="true"
            className="h-auto w-full select-none"
            style={{
              WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)',
              maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)',
            }}
            draggable={false}
          />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
