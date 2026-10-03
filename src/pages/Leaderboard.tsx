import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Trophy } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';
import RevealText from '@/components/ui/RevealText';
import TechGridBackground from '@/components/ui/TechGridBackground';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaderboard } from '@/hooks/use-leaderboard';
import { fetchMyMember } from '@/lib/club';
import type { LeaderboardRow } from '@/types/club';

const ALL = 'All';

const PodiumCard = ({ row, isMe, index }: { row: LeaderboardRow; isMe: boolean; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
  >
    <HolographicCard className={`p-6 text-center h-full ${isMe ? 'border-primary/60' : ''}`}>
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center">
          <Trophy className={`w-5 h-5 ${row.rank === 1 ? 'text-primary' : 'text-primary/60'}`} />
        </div>
        <span className="text-[10px] text-primary font-bold tracking-[0.3em] uppercase">Rank {row.rank}</span>
        <h2 className="font-heading text-xl font-bold text-white break-words">{row.full_name}</h2>
        {row.department && <p className="text-xs text-muted-foreground">{row.department}</p>}
        <p className="font-heading text-3xl font-bold tabular-nums text-foreground mt-2">
          {row.total_points}
          <span className="ml-1 text-xs font-medium text-muted-foreground uppercase tracking-widest">pts</span>
        </p>
      </div>
    </HolographicCard>
  </motion.div>
);

const Leaderboard = () => {
  const { user } = useAuth();
  const { rows, loading, error, updatedAt } = useLeaderboard();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState(ALL);
  const [myId, setMyId] = useState<string | null>(null);

  // Arriving from the home page's top-10 would otherwise keep its scroll position.
  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!user) { setMyId(null); return; }
    let active = true;
    fetchMyMember()
      .then(me => { if (active) setMyId(me?.id ?? null); })
      .catch(() => { if (active) setMyId(null); });
    return () => { active = false; };
  }, [user]);

  const departments = useMemo(
    () => [ALL, ...Array.from(new Set(rows.map(r => r.department).filter((d): d is string => !!d))).sort()],
    [rows],
  );

  const filtering = query.trim() !== '' || department !== ALL;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r =>
      (department === ALL || r.department === department) &&
      (!q || r.full_name.toLowerCase().includes(q)),
    );
  }, [rows, query, department]);

  // The podium is the overall top three; while filtering, everything goes in the table.
  const podium = filtering ? [] : rows.filter(r => r.rank <= 3).slice(0, 3);
  const table = filtering ? filtered : rows.slice(podium.length);
  const me = myId ? rows.find(r => r.member_id === myId) : undefined;

  return (
    <div className="min-h-screen relative text-foreground bg-[#050505] overflow-hidden">
      <TechGridBackground />

      <div className="container mx-auto px-4 sm:px-6 py-12 relative z-10">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-primary transition-all mb-12 px-6 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl group text-sm">
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Link>

          <div className="text-center mb-12">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <span className="text-[10px] text-primary tracking-[0.4em] uppercase font-bold px-4 py-1 rounded-full border border-primary/20 bg-primary/5">
                Recognition
              </span>
            </motion.div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">
              <RevealText text="Leaderboard" />
            </h1>
            <p className="text-sm text-muted-foreground mt-4">
              Points come from event roles and approved contributions. Leads aren't ranked.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {me && (
                <span className="px-4 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold tracking-widest uppercase">
                  You're #{me.rank}
                </span>
              )}
              {updatedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-14 rounded-2xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <HolographicCard className="p-10 text-center text-sm text-muted-foreground">{error}</HolographicCard>
          ) : rows.length === 0 ? (
            <HolographicCard className="p-10 text-center text-sm text-muted-foreground">
              No points on the board yet. Check back soon.
            </HolographicCard>
          ) : (
            <>
              {podium.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  {podium.map((row, i) => (
                    <PodiumCard key={row.member_id} row={row} isMe={row.member_id === myId} index={i} />
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-4 mb-6">
                <label className="relative block">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by name"
                    aria-label="Search by name"
                    className="w-full rounded-full bg-white/5 border border-white/10 pl-11 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                </label>
                {departments.length > 2 && (
                  <div className="flex flex-wrap gap-2">
                    {departments.map(d => (
                      <button
                        key={d}
                        onClick={() => setDepartment(d)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all ${
                          department === d
                            ? 'bg-primary text-white'
                            : 'bg-white/5 border border-white/10 text-muted-foreground hover:text-white hover:border-white/30'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {table.length > 0 ? (
                <HolographicCard className="p-2 sm:p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                        <th className="text-left font-medium px-3 py-3 w-14">Rank</th>
                        <th className="text-left font-medium px-3 py-3">Name</th>
                        <th className="text-left font-medium px-3 py-3 hidden md:table-cell">Department</th>
                        <th className="text-right font-medium px-3 py-3">Points</th>
                        <th className="text-right font-medium px-3 py-3 hidden md:table-cell">Contributions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {table.map(row => {
                        const isMe = row.member_id === myId;
                        return (
                          <tr key={row.member_id} className={isMe ? 'bg-primary/10' : ''}>
                            <td className={`px-3 py-3 font-heading font-bold tabular-nums ${row.rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                              {row.rank}
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-semibold text-foreground break-words">{row.full_name}</span>
                              {isMe && <span className="ml-2 text-[10px] text-primary font-bold uppercase tracking-widest">You</span>}
                              {row.department && (
                                <span className="block text-xs text-muted-foreground md:hidden">{row.department}</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground hidden md:table-cell">{row.department ?? '—'}</td>
                            <td className="px-3 py-3 text-right font-heading font-bold tabular-nums">{row.total_points}</td>
                            <td className="px-3 py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">{row.contribution_count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </HolographicCard>
              ) : filtering ? (
                <p className="text-center text-sm text-muted-foreground py-10">Nobody matches that search.</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
