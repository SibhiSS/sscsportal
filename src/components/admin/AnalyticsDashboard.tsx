import { useMemo, useState } from 'react';
import { Application } from '@/types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { computeSkillFrequencies, SkillFreq } from '@/utils/resumeParser';
import { normalizeStatus } from '@/lib/fsm';
import { Users, TrendingUp, Award, Zap } from 'lucide-react';
import HolographicCard from '@/components/ui/HolographicCard';

interface AnalyticsDashboardProps {
  applications: Application[];
}

// ── Tooltip customization ────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 border border-white/10 rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-white/60 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill || p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  delay?: number;
}

const KpiCard = ({ icon, label, value, sub, delay = 0 }: KpiCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <HolographicCard className="p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-white/40">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/40">{sub}</p>}
    </HolographicCard>
  </motion.div>
);

// ── Funnel Stage Row ─────────────────────────────────────────────────────────

interface FunnelRowProps {
  label: string;
  count: number;
  total: number;
  color: string;
  delay: number;
}

const FunnelRow = ({ label, count, total, color, delay }: FunnelRowProps) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <span className="w-36 text-xs text-white/60 text-right shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-white/5 rounded-md overflow-hidden">
        <motion.div
          className="h-full rounded-md"
          style={{ backgroundColor: color, width: `${pct}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
        />
      </div>
      <span className="w-16 text-xs text-white/70 font-semibold">{count}</span>
      <span className="w-12 text-xs text-white/40">{pct}%</span>
    </motion.div>
  );
};

// ── Category pill tabs ───────────────────────────────────────────────────────

type SkillCategory = 'all' | SkillFreq['category'];
const CATEGORY_LABELS: Record<SkillCategory, string> = {
  all: 'All',
  language: 'Languages',
  web: 'Web',
  design: 'Design',
  embedded: 'Embedded',
  ml: 'ML',
  tools: 'Tools',
  soft: 'Soft Skills',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ applications }: AnalyticsDashboardProps) {
  const [skillCategory, setSkillCategory] = useState<SkillCategory>('all');

  // ── Overview KPIs ───────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = applications.length;
    const interviewed = applications.filter(a =>
      ['interviewed', 'selected', 'waitlisted', 'rejected'].includes(normalizeStatus(a.status))
    );
    const selected = applications.filter(a => normalizeStatus(a.status) === 'selected');
    const acceptanceRate = total > 0 ? Math.round((selected.length / total) * 100) : 0;

    // Average interview score from taskScore (proxy) + rating
    const withScore = applications.filter(a => a.finalScore != null && a.finalScore > 0);
    const avgScore = withScore.length > 0
      ? (withScore.reduce((s, a) => s + (a.finalScore ?? 0), 0) / withScore.length).toFixed(1)
      : '—';

    // Most competitive dept (highest applied count)
    const deptCounts: Record<string, number> = {};
    for (const app of applications) {
      const d = app.primaryDept || app.department || 'Unknown';
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    }
    const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return { total, avgScore, acceptanceRate, topDept, interviewed: interviewed.length, selected: selected.length };
  }, [applications]);

  // ── Funnel data ─────────────────────────────────────────────────────────
  const funnelData = useMemo(() => {
    const stages: Array<{ key: string; label: string; color: string }> = [
      { key: 'applied',              label: 'Applied',             color: '#3b82f6' },
      { key: 'under_review',         label: 'Under Review',        color: '#eab308' },
      { key: 'shortlisted',          label: 'Shortlisted',         color: '#06b6d4' },
      { key: 'interviewed',          label: 'Interviewed',         color: '#f97316' },
      { key: 'selected',             label: 'Selected',            color: '#22c55e' },
    ];

    const stageSets: Record<string, string[]> = {
      applied:             ['applied', 'under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'waitlisted', 'rejected', 'pending', 'neutral', 'rejected_pending', 'active_member', 'alumni', 'inactive'],
      under_review:        ['under_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'waitlisted', 'rejected', 'neutral', 'rejected_pending', 'active_member', 'alumni'],
      shortlisted:         ['shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'waitlisted', 'rejected', 'active_member', 'alumni'],
      interviewed:         ['interviewed', 'selected', 'waitlisted', 'rejected', 'active_member', 'alumni'],
      selected:            ['selected', 'active_member', 'alumni'],
    };

    return stages.map(s => ({
      ...s,
      count: applications.filter(a => stageSets[s.key].includes(a.status)).length,
    }));
  }, [applications]);

  // ── Admission Year distribution ─────────────────────────────────────────
  const yearData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of applications) {
      const yr = app.admissionYear?.toString() ?? 'Unknown';
      counts[yr] = (counts[yr] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({ year, count }));
  }, [applications]);

  // ── Skill frequencies ───────────────────────────────────────────────────
  const allSkills = useMemo(() => computeSkillFrequencies(applications), [applications]);
  const filteredSkills = useMemo(() =>
    skillCategory === 'all' ? allSkills : allSkills.filter(s => s.category === skillCategory),
    [allSkills, skillCategory]
  );
  const top15Skills = useMemo(() => filteredSkills.slice(0, 15), [filteredSkills]);
  const maxCount = useMemo(() => allSkills[0]?.count ?? 1, [allSkills]);

  const skillFontSize = (count: number) =>
    10 + Math.round(((count / maxCount) * 12));
  const skillClasses = (count: number) => {
    const ratio = count / maxCount;
    if (ratio >= 0.75) return 'bg-primary text-white shadow-[0_0_12px_rgba(220,20,60,0.4)]';
    if (ratio >= 0.5) return 'bg-primary/60 text-white/90';
    if (ratio >= 0.25) return 'bg-primary/30 text-primary/80';
    return 'bg-primary/10 text-primary/40';
  };

  // ── Department breakdown ────────────────────────────────────────────────
  const deptStats = useMemo(() => {
    const map: Record<string, { applied: number; shortlisted: number; selected: number }> = {};
    for (const app of applications) {
      const dept = app.primaryDept || app.department || 'Unknown';
      if (!map[dept]) map[dept] = { applied: 0, shortlisted: 0, selected: 0 };
      map[dept].applied++;
      const s = normalizeStatus(app.status);
      if (['shortlisted', 'interview_scheduled', 'interviewed', 'selected', 'active_member', 'alumni'].includes(s)) {
        map[dept].shortlisted++;
      }
      if (['selected', 'active_member', 'alumni'].includes(s)) {
        map[dept].selected++;
      }
    }
    return Object.entries(map)
      .map(([dept, d]) => ({
        dept,
        applied: d.applied,
        shortlisted: d.shortlisted,
        selected: d.selected,
        acceptance: d.applied > 0 ? Math.round((d.selected / d.applied) * 100) : 0,
      }))
      .sort((a, b) => b.applied - a.applied);
  }, [applications]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl mb-6">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-5 py-2 text-sm text-white/60 transition-all">
            Overview
          </TabsTrigger>
          <TabsTrigger value="skills" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-5 py-2 text-sm text-white/60 transition-all">
            Skills Heatmap
          </TabsTrigger>
          <TabsTrigger value="departments" className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-lg px-5 py-2 text-sm text-white/60 transition-all">
            Departments
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Overview ────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={<Users size={16} />} label="Total Applicants" value={kpis.total} sub="All submissions" delay={0} />
            <KpiCard icon={<TrendingUp size={16} />} label="Avg Final Score" value={kpis.avgScore} sub="Weighted composite" delay={0.05} />
            <KpiCard icon={<Award size={16} />} label="Acceptance Rate" value={`${kpis.acceptanceRate}%`} sub={`${kpis.selected} selected`} delay={0.1} />
            <KpiCard icon={<Zap size={16} />} label="Top Dept" value={kpis.topDept} sub="Most applications" delay={0.15} />
          </div>

          {/* Funnel + Year side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Funnel */}
            <motion.div
              className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                Recruitment Funnel
              </h3>
              <div className="space-y-2">
                {funnelData.map((stage, i) => (
                  <FunnelRow
                    key={stage.key}
                    label={stage.label}
                    count={stage.count}
                    total={funnelData[0].count}
                    color={stage.color}
                    delay={0.25 + i * 0.06}
                  />
                ))}
              </div>
            </motion.div>

            {/* Year Distribution */}
            <motion.div
              className="bg-white/5 border border-white/10 rounded-xl p-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
                Applicants by Admission Year
              </h3>
              {yearData.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-10">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={yearData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="year" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="count" name="Applicants" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {yearData.map((_, i) => (
                        <Cell key={i} fill={`hsl(348, 83%, ${35 + (i % 3) * 8}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>
          </div>
        </TabsContent>

        {/* ── TAB 2: Skills Heatmap ───────────────────────────────────── */}
        <TabsContent value="skills" className="space-y-6">
          {/* Category filter tabs */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as SkillCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setSkillCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  skillCategory === cat
                    ? 'bg-primary text-white shadow-[0_0_12px_rgba(220,20,60,0.4)]'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Tag cloud */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-xl p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-5">Skill Frequency Cloud</h3>
            {filteredSkills.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-10">No skills found for this category</p>
            ) : (
              <div className="flex flex-wrap gap-2 items-center justify-start">
                {filteredSkills.map((s, i) => (
                  <motion.span
                    key={s.skill}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: i * 0.015 }}
                    className={`px-3 py-1 rounded-full font-medium cursor-default select-none transition-all ${skillClasses(s.count)}`}
                    style={{ fontSize: skillFontSize(s.count) }}
                    title={`${s.skill}: ${s.count} applicant(s) (${s.percentage}%)`}
                  >
                    {s.skill}
                    <span className="ml-1 opacity-60 text-[10px]">{s.count}</span>
                  </motion.span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Top 15 bar chart */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">Top 15 Skills</h3>
            {top15Skills.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={top15Skills} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="skill" width={110} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" name="Applicants" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {top15Skills.map((_, i) => (
                      <Cell key={i} fill={`hsl(348, 83%, ${30 + (i / top15Skills.length) * 25}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </TabsContent>

        {/* ── TAB 3: Departments ──────────────────────────────────────── */}
        <TabsContent value="departments" className="space-y-6">
          {/* Grouped bar chart */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-4">
              Applied vs Selected by Department
            </h3>
            {deptStats.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-10">No department data</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, deptStats.length * 40)}>
                <BarChart data={deptStats} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="dept" width={130} tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="applied" name="Applied" fill="hsl(348,83%,30%)" radius={[0, 2, 2, 0]} maxBarSize={14} />
                  <Bar dataKey="selected" name="Selected" fill="hsl(142,70%,45%)" radius={[0, 2, 2, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Department stats table */}
          <motion.div
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03]">
                  <th className="text-left px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Department</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Applied</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Shortlisted</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Selected</th>
                  <th className="text-right px-4 py-3 text-white/40 font-medium text-xs uppercase tracking-wider">Acceptance</th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((d, i) => (
                  <motion.tr
                    key={d.dept}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + i * 0.04 }}
                  >
                    <td className="px-4 py-3 text-white font-medium">{d.dept}</td>
                    <td className="px-4 py-3 text-right text-white/70">{d.applied}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{d.shortlisted}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{d.selected}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${
                        d.acceptance >= 30 ? 'text-emerald-400' :
                        d.acceptance >= 15 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {d.acceptance}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
