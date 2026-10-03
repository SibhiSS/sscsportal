import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import { useLeaderboard } from '@/hooks/use-leaderboard';

const TOP_N = 10;

const LeaderboardSection = () => {
  const { rows, loading, error } = useLeaderboard(TOP_N);

  return (
    <section id="leaderboard" className="py-24 relative overflow-hidden">
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
          <h2 className="font-heading text-4xl font-bold text-foreground">
            <RevealText text="Top Contributors" />
          </h2>
        </motion.div>

        <div className="max-w-3xl mx-auto px-0 sm:px-6">
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
                className="flex items-center gap-2 text-[10px] md:text-xs text-primary font-bold tracking-widest uppercase hover:text-primary/80 transition-colors group"
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
