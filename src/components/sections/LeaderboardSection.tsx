import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import ScrambleText from '@/components/fx/ScrambleText';
import { useLeaderboard } from '@/hooks/use-leaderboard';
import type { LeaderboardRow } from '@/types/club';

const TOP_N = 10;

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** The #1 member, given a card of their own. */
const Spotlight = ({ row, tiedWith, runnersUp }: { row: LeaderboardRow; tiedWith: number; runnersUp: LeaderboardRow[] }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className="h-full"
  >
    <HolographicCard className="relative h-full overflow-hidden p-8">
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex h-full flex-col">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          <Trophy className="h-3.5 w-3.5" /> Top contributor
        </span>

        <div className="mt-8 flex items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-primary/30 bg-primary/10 font-heading text-2xl font-bold text-primary">
            {initials(row.full_name)}
          </div>
          <div className="min-w-0">
            <p className="font-heading text-2xl md:text-3xl font-bold text-foreground break-words">{row.full_name}</p>
            {row.department && <p className="mt-1 text-sm text-muted-foreground">{row.department}</p>}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/5 pt-6">
          <div>
            <p className="font-heading text-3xl font-bold tabular-nums text-foreground">{row.total_points}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Points</p>
          </div>
          <div>
            <p className="font-heading text-3xl font-bold tabular-nums text-foreground">{row.contribution_count}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Contributions</p>
          </div>
        </div>

        {tiedWith > 0 && (
          <p className="mt-6 text-xs text-muted-foreground">
            Tied for first with {tiedWith} other{tiedWith > 1 ? 's' : ''}.
          </p>
        )}

        {runnersUp.length > 0 && (
          <div className="mt-auto pt-8">
            <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Also on the podium</p>
            <div className="space-y-2">
              {runnersUp.map(r => (
                <div key={r.member_id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                  <span className="w-5 font-heading font-bold tabular-nums text-primary">{r.rank}</span>
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-foreground">{r.full_name}</span>
                  <span className="font-heading text-sm font-bold tabular-nums text-foreground">
                    {r.total_points}<span className="ml-1 text-[10px] font-medium text-muted-foreground">PTS</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </HolographicCard>
  </motion.div>
);

const LeaderboardSection = () => {
  const { rows, loading, error } = useLeaderboard(TOP_N);
  const top = !loading && !error ? rows[0] ?? null : null;
  const tiedWith = top ? rows.filter(r => r.rank === top.rank).length - 1 : 0;

  return (
    <section id="leaderboard" className="py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-6">
        <motion.div
          className="text-center mb-16 max-w-6xl mx-auto px-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-xs text-primary tracking-[0.3em] uppercase mb-3 block font-medium">
            Recognition
          </span>
          <h2 className="font-heading text-[1.75rem] leading-tight sm:text-4xl font-bold text-foreground">
            <ScrambleText text="Top Contributors" />
          </h2>
        </motion.div>

        <div className={`mx-auto px-0 sm:px-6 grid gap-6 ${top ? 'max-w-6xl lg:grid-cols-[1fr_1.4fr]' : 'max-w-3xl'}`}>
          {top && <Spotlight row={top} tiedWith={tiedWith} runnersUp={rows.slice(1, 3)} />}
          <HolographicCard className="p-4 sm:p-8">
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-sm text-muted-foreground py-8">{error}</p>
            ) : rows.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No points on the board yet. Check back soon.
              </p>
            ) : (
              <ol className="divide-y divide-white/5">
                {rows.map((row, index) => (
                  <motion.li
                    key={row.member_id}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 py-3"
                  >
                    <span
                      className={`w-8 shrink-0 text-center font-heading font-bold tabular-nums ${
                        row.rank <= 3 ? 'text-primary text-lg' : 'text-muted-foreground'
                      }`}
                    >
                      {row.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{row.full_name}</p>
                      {row.department && (
                        <p className="text-xs text-muted-foreground truncate">{row.department}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-heading font-bold tabular-nums text-foreground">
                      {row.total_points}
                      <span className="ml-1 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">pts</span>
                    </span>
                  </motion.li>
                ))}
              </ol>
            )}

            <div className="mt-6 pt-6 border-t border-white/5 flex justify-center">
              <Link
                to="/leaderboard"
                className="flex items-center gap-2 py-2 text-[11px] md:text-xs text-primary font-bold tracking-widest uppercase hover:text-primary/80 transition-colors group"
              >
                View full leaderboard
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </HolographicCard>
        </div>
      </div>
    </section>
  );
};

export default LeaderboardSection;
