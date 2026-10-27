import { Link } from 'react-router-dom';

interface Props {
  /** Height of the icon in px. */
  size?: number;
  /** "dark" is for navy backgrounds: the icon sits on a white plate and the words turn white. */
  tone?: 'light' | 'dark';
  /** Hide the words and show the icon alone. */
  markOnly?: boolean;
  to?: string;
  className?: string;
}

/** The club logo from the design: the brain-and-AIC-chip icon with the "AI CLUB / VIT CHENNAI" wordmark. One place, used everywhere. */
const BrandLogo = ({ size = 44, tone = 'light', markOnly = false, to = '/', className = '' }: Props) => {
  const icon = (
    <img src="/brand/aic-logo-icon.png" alt="" draggable={false} className="w-auto shrink-0 object-contain transition-transform duration-300 group-hover:scale-105" style={{ height: size }} />
  );
  return (
    <Link to={to} aria-label="AI Club VIT Chennai home" className={`group inline-flex items-center gap-3 ${className}`}>
      {tone === 'dark' ? <span className="rounded-md bg-white p-1.5">{icon}</span> : icon}
      {!markOnly && (
        <span className="leading-none">
          <span className={`block font-display font-extrabold uppercase tracking-tight ${tone === 'dark' ? 'text-white' : 'text-[#0B1726]'}`} style={{ fontSize: size * 0.62 }}>
            AI Club
          </span>
          <span className={`mt-1.5 block font-heading font-semibold tracking-[0.3em] ${tone === 'dark' ? 'text-white/70' : 'text-[#0B1726]'}`} style={{ fontSize: Math.max(8, size * 0.2) }}>
            VIT CHENNAI
          </span>
        </span>
      )}
    </Link>
  );
};

export default BrandLogo;
