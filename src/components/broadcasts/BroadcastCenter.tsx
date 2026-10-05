import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Megaphone, Radio, X } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import ScrambleText from '@/components/fx/ScrambleText';
import { PRIORITY_LABELS, useBroadcasts, type Broadcast } from '@/lib/broadcasts';
import BroadcastBody from './BroadcastBody';
import './broadcasts.css';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

type CardProps = {
  b: Pick<Broadcast, 'id' | 'title' | 'body' | 'priority' | 'starts_at'>;
  /** takeover: must be acknowledged. reader: opened from the inbox. preview: static, in the admin composer. */
  mode: 'takeover' | 'reader' | 'preview';
  position?: { index: number; total: number };
  onAck?: () => void;
  onClose?: () => void;
};

/** The message card, shared by the sign-in takeover, the reader and the admin preview. */
export function BroadcastCard({ b, mode, position, onAck, onClose }: CardProps) {
  const ack = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (mode !== 'preview') ack.current?.focus(); }, [mode, b.id]);

  return (
    <div className={`bc-card bc-${b.priority}`} role={mode === 'preview' ? undefined : 'document'}>
      <div className="bc-card-head">
        <span className="bc-signal"><Radio size={13} /> {mode === 'takeover' ? 'Incoming transmission' : 'Message from the board'}</span>
        <span className={`bc-tag bc-tag-${b.priority}`}>{PRIORITY_LABELS[b.priority]}</span>
        {mode === 'reader' && (
          <button className="bc-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        )}
      </div>
      <h2 className="bc-title" id={mode === 'preview' ? undefined : 'bc-title'}>
        {mode === 'preview' ? (b.title || 'Your title') : <ScrambleText key={b.id} text={b.title} duration={700} delay={150} />}
      </h2>
      {mode === 'preview' && !b.body.trim()
        ? <div className="bc-body bc-dim">Your message appears here.</div>
        : <BroadcastBody text={b.body} />}
      <div className="bc-card-foot">
        <span className="bc-meta">IEEE SSCS · {when(b.starts_at)}{position && position.total > 1 ? ` · ${position.total - 1} more after this` : ''}</span>
        {mode === 'reader'
          ? <button ref={ack} className="bc-btn" onClick={onClose}>Close</button>
          : <button ref={ack} className="bc-btn" onClick={onAck} disabled={mode === 'preview'}>Got it</button>}
      </div>
    </div>
  );
}

function Overlay({ children, onEscape }: { children: React.ReactNode; onEscape?: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape?.(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onEscape]);
  return (
    <motion.div className="bc-overlay" role="dialog" aria-modal="true" aria-labelledby="bc-title"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      onClick={e => { if (e.target === e.currentTarget) onEscape?.(); }}>
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="bc-overlay-inner">
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * Shows broadcasts to whoever is signed in:
 *   critical  -> a full-screen card they must acknowledge
 *   important -> a banner at the bottom until dismissed
 *   info      -> a toast, once
 * Mounted once for the whole app, public site and admin panel alike.
 */
export default function BroadcastCenter() {
  const { items, arrived, markSeen, acknowledge, reading, open, close } = useBroadcasts();
  const toasted = useRef(new Set<string>());

  const critical = items.filter(b => b.priority === 'critical' && !b.acked_at).reverse(); // oldest first
  const banner = items.find(b => b.priority === 'important' && !b.acked_at) ?? null;
  const takeover = critical[0] ?? null;

  useEffect(() => { if (takeover) markSeen(takeover.id); }, [takeover?.id, markSeen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (banner) markSeen(banner.id); }, [banner?.id, markSeen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Info messages: a toast each, the first time they're seen.
  useEffect(() => {
    for (const b of items) {
      if (b.priority !== 'info' || b.seen_at || toasted.current.has(b.id)) continue;
      toasted.current.add(b.id);
      toast(b.title, {
        icon: <Megaphone size={16} />,
        description: b.body.length > 140 ? `${b.body.slice(0, 140).trimEnd()}…` : b.body || undefined,
        duration: 9000,
        action: { label: 'Read', onClick: () => open(b.id) },
      });
      markSeen(b.id);
    }
  }, [items, markSeen, open]);

  // Something important just landed while the tab was open: ping, even under a takeover.
  const pinged = useRef(new Set<string>());
  useEffect(() => {
    for (const id of arrived) {
      if (pinged.current.has(id)) continue;
      pinged.current.add(id);
      const b = items.find(x => x.id === id);
      if (b && b.priority === 'important') toast('New message from the board', { description: b.title, icon: <Radio size={16} /> });
    }
  }, [arrived, items]);

  return (
    <>
      <AnimatePresence>
        {banner && !takeover && (
          <motion.aside key={banner.id} className="bc-banner" role="status" aria-live="polite"
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <span className="bc-banner-ic"><Megaphone size={16} /></span>
            <button className="bc-banner-tx" onClick={() => open(banner.id)}>
              <b>{banner.title}</b>
              {banner.body && <span>{banner.body}</span>}
            </button>
            <button className="bc-x" onClick={() => acknowledge(banner.id)} aria-label="Dismiss"><X size={16} /></button>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {takeover ? (
          <Overlay key={`t:${takeover.id}`}>
            <BroadcastCard b={takeover} mode="takeover" position={{ index: 0, total: critical.length }} onAck={() => acknowledge(takeover.id)} />
          </Overlay>
        ) : reading ? (
          <Overlay key={`r:${reading.id}`} onEscape={close}>
            <BroadcastCard b={reading} mode="reader" onClose={() => { if (reading.priority !== 'info') acknowledge(reading.id); close(); }} />
          </Overlay>
        ) : null}
      </AnimatePresence>
    </>
  );
}
