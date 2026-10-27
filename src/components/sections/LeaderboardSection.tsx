import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import SectionHeader from '@/components/site/SectionHeader';
import { useLeaderboard } from '@/hooks/use-leaderboard';

const TOP_N = 10;

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd, so the winner stands in the middle
const PODIUM_HEIGHT = ['h-28', 'h-40', 'h-20'];

const LeaderboardSection = () => {
  const { rows, loading, error } = useLeaderboard(TOP_N);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <section id="leaderboard" className="py-16 md:py-20">
      <div className="mx-auto max-w-[1246px] px-6 xl:px-0">
        <SectionHeader
          eyebrow="Recognition"
          title={<>Top <span className="text-primary">contributors.</span></>}
          intro="Points come from event roles and approved contributions. Updated live."
          action={
            <Link to="/leaderboard" className="inline-flex items-center gap-2 text-[14px] font-medium text-primary hover:underline">
              Full leaderboard <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        <div className="mt-10">
          {loading ? (
            <div className="grid gap-3" aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-md bg-primary/5" />)}
            </div>
          ) : error ? (
            <p className="rounded-md border border-border bg-white/80 py-10 text-center text-sm text-muted-foreground">{error}</p>
          ) : rows.length === 0 ? (
            <p className="rounded-md border border-border bg-white/80 py-10 text-center text-sm text-muted-foreground">
              No points on the board yet. Check back soon.
            </p>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
              <div className="flex items-end justify-center gap-3">
                {PODIUM_ORDER.filter(i => podium[i]).map(i => {
                  const r = podium[i];
                  return (
                    <motion.div
                      key={r.member_id}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1 }}
                      className="flex w-1/3 max-w-[180px] flex-col items-center text-center"
                    >
                      {i === 0 && <Trophy className="mb-2 h-5 w-5 text-primary" />}
                      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-heading text-lg font-bold text-primary">
                        {initials(r.full_name)}
                      </span>
                      <p className="mt-2 w-full truncate text-[14px] font-semibold text-[#0B1726]">{r.full_name}</p>
                      <p className="font-heading text-[13px] font-bold tabular-nums text-primary">{r.total_points} pts</p>
                      <div className={`mt-3 flex w-full items-start justify-center rounded-t-md bg-gradient-to-b from-primary to-primary/60 pt-3 font-heading text-2xl font-bold text-white ${PODIUM_HEIGHT[i]}`}>
                        {r.rank}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <ol className="divide-y divide-border rounded-md border border-border bg-white/80">
                {(rest.length ? rest : podium).map(row => (
                  <li key={row.member_id} className="flex items-center gap-4 px-5 py-3">
                    <span className="w-6 text-center font-heading font-bold tabular-nums text-muted-foreground">{row.rank}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[#0B1726]">{row.full_name}</p>
                      {row.department && <p className="truncate text-xs text-muted-foreground">{row.department}</p>}
                    </div>
                    <span className="font-heading font-bold tabular-nums text-[#0B1726]">
                      {row.total_points}<span className="ml-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">pts</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default LeaderboardSection;
