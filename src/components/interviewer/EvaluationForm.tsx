import { useState, useMemo } from 'react';
import { Application, InterviewFeedback, EvaluationRecommendation } from '@/types';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Cpu, Zap, Crown, Users, Star, Check, HelpCircle, X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EvaluationFormProps {
  application: Application;
  existingFeedback?: InterviewFeedback | null;
  onSubmit: (payload: {
    score_communication: number;
    score_technical: number;
    score_enthusiasm: number;
    score_leadership: number;
    score_team_fit: number;
    recommendation: EvaluationRecommendation;
    interviewer_remarks: string;
  }) => Promise<void>;
  onClose: () => void;
  readOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function scoreColor(value: number): string {
  if (value < 5) return '#f87171';   // red-400
  if (value < 7) return '#facc15';   // yellow-400
  return '#4ade80';                   // green-400
}

function scoreGradient(value: number): string {
  if (value < 5) return 'linear-gradient(90deg, #ef4444, #f87171)';
  if (value < 7) return 'linear-gradient(90deg, #eab308, #facc15)';
  return 'linear-gradient(90deg, #16a34a, #4ade80)';
}

// SVG animated score ring
function ScoreRing({ score }: { score: number }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / 10, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const color = scoreColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        {/* Track */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <motion.circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={score.toFixed(1)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="text-2xl font-bold tabular-nums"
          style={{ color }}
        >
          {score.toFixed(1)}
        </motion.span>
        <span className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">/ 10</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric slider row
// ─────────────────────────────────────────────────────────────────────────────

interface MetricRowProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function MetricRow({ label, icon, value, onChange, disabled }: MetricRowProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Icon + Label */}
      <div className="flex items-center gap-2 w-44 shrink-0">
        <span className="text-white/40">{icon}</span>
        <span className="text-sm font-medium text-white/80">{label}</span>
      </div>

      {/* Slider */}
      <div className="flex-1 relative">
        {/* Custom gradient fill overlay */}
        <div className="relative">
          <Slider
            min={0}
            max={10}
            step={0.5}
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            disabled={disabled}
            className="w-full [&_[data-radix-slider-track]]:bg-white/10 [&_[data-radix-slider-range]]:opacity-0 [&_[data-radix-slider-thumb]]:border-white/30 [&_[data-radix-slider-thumb]]:bg-white [&_[data-radix-slider-thumb]]:shadow-lg"
          />
          {/* Gradient fill behind the slider */}
          <div
            className="absolute top-1/2 left-0 h-1.5 rounded-full pointer-events-none -translate-y-1/2"
            style={{
              width: `${(value / 10) * 100}%`,
              background: scoreGradient(value),
              boxShadow: `0 0 8px ${scoreColor(value)}60`,
            }}
          />
        </div>
      </div>

      {/* Score badge */}
      <div
        className="w-14 text-right shrink-0 font-mono text-sm font-semibold tabular-nums"
        style={{ color: scoreColor(value) }}
      >
        {value.toFixed(1)}<span className="text-white/30 text-xs">/10</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation option
// ─────────────────────────────────────────────────────────────────────────────

interface RecOptionProps {
  value: EvaluationRecommendation;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function RecOption({ value, label, description, icon, color, borderColor, selected, onSelect, disabled }: RecOptionProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={`
        relative flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border transition-all duration-200
        ${disabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:bg-white/5'}
        ${selected
          ? `border-current bg-white/5 shadow-lg`
          : 'border-white/10 bg-transparent'
        }
      `}
      style={selected ? { color, borderColor, boxShadow: `0 0 16px ${color}30` } : { color: 'rgba(255,255,255,0.4)' }}
    >
      <span className={`transition-colors ${selected ? '' : 'text-white/30'}`}>{icon}</span>
      <span className={`text-xs font-semibold transition-colors ${selected ? '' : 'text-white/50'}`}>{label}</span>
      <span className={`text-[10px] transition-colors ${selected ? 'opacity-70' : 'text-white/25'}`}>{description}</span>
      {selected && (
        <motion.div
          layoutId="rec-indicator"
          className="absolute inset-0 rounded-xl border-2 pointer-events-none"
          style={{ borderColor }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function EvaluationForm({
  application,
  existingFeedback,
  onSubmit,
  onClose,
  readOnly = false,
}: EvaluationFormProps) {
  const ef = existingFeedback;

  const [communication, setCommunication]   = useState<number>(ef?.score_communication ?? 5);
  const [technical, setTechnical]           = useState<number>(ef?.score_technical     ?? 5);
  const [enthusiasm, setEnthusiasm]         = useState<number>(ef?.score_enthusiasm    ?? 5);
  const [leadership, setLeadership]         = useState<number>(ef?.score_leadership    ?? 5);
  const [teamFit, setTeamFit]               = useState<number>(ef?.score_team_fit      ?? 5);
  const [remarks, setRemarks]               = useState<string>(ef?.interviewer_remarks ?? '');
  const [recommendation, setRecommendation] = useState<EvaluationRecommendation>(
    (ef?.recommendation as EvaluationRecommendation) ?? 'select'
  );
  const [submitting, setSubmitting] = useState(false);

  const totalScore = useMemo(
    () => Math.round(((communication + technical + enthusiasm + leadership + teamFit) / 5) * 10) / 10,
    [communication, technical, enthusiasm, leadership, teamFit]
  );

  const handleSubmit = async () => {
    if (readOnly || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        score_communication: communication,
        score_technical:     technical,
        score_enthusiasm:    enthusiasm,
        score_leadership:    leadership,
        score_team_fit:      teamFit,
        recommendation,
        interviewer_remarks: remarks,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const metrics = [
    { label: 'Communication',       icon: <MessageSquare size={16} />, value: communication, onChange: setCommunication },
    { label: 'Technical Knowledge', icon: <Cpu size={16} />,           value: technical,     onChange: setTechnical     },
    { label: 'Enthusiasm',          icon: <Zap size={16} />,           value: enthusiasm,    onChange: setEnthusiasm    },
    { label: 'Leadership Potential',icon: <Crown size={16} />,         value: leadership,    onChange: setLeadership    },
    { label: 'Team Fit',            icon: <Users size={16} />,         value: teamFit,       onChange: setTeamFit       },
  ];

  const recommendations: Array<{
    value: EvaluationRecommendation;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    borderColor: string;
  }> = [
    { value: 'strong_select', label: 'Strong Select', description: 'Exceptional',  icon: <Star size={18} />,        color: '#4ade80', borderColor: '#4ade80' },
    { value: 'select',        label: 'Select',        description: 'Good fit',      icon: <Check size={18} />,       color: '#22d3ee', borderColor: '#22d3ee' },
    { value: 'maybe',         label: 'Maybe',         description: 'Borderline',    icon: <HelpCircle size={18} />,  color: '#facc15', borderColor: '#facc15' },
    { value: 'reject',        label: 'Reject',        description: 'Not suitable',  icon: <X size={18} />,           color: '#f87171', borderColor: '#f87171' },
  ];

  // Derive a display label for dept
  const deptLabel = application.primaryDept || application.department || '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl w-full max-w-2xl"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/8">
        <div className="flex-1 min-w-0">
          {/* Name + readOnly badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-white truncate">{application.fullName}</h2>
            <AnimatePresence>
              {readOnly && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                >
                  <Check size={10} /> Submitted
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs text-white/40 font-mono">{application.rollNumber}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-xs text-white/50">{application.department}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(220,38,38,0.15)', color: '#f87171', border: '1px solid rgba(220,38,38,0.3)' }}
            >
              {deptLabel}
            </span>
            {application.year && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-xs text-white/40">Year {application.year}</span>
              </>
            )}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="ml-4 p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-6 py-5 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
        {/* ── Candidate Profile ──────────────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {application.resumeUrl && (
              <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/10 h-8 text-xs" onClick={() => window.open(application.resumeUrl, '_blank')}>
                <FileText className="w-3 h-3 mr-1.5" />
                View Resume
              </Button>
            )}
            {application.linkedinUrl && (
              <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/10 h-8 text-xs" onClick={() => window.open(application.linkedinUrl, '_blank')}>
                <svg className="w-3 h-3 mr-1.5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                LinkedIn
              </Button>
            )}
            {application.githubUrl && (
              <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/10 h-8 text-xs" onClick={() => window.open(application.githubUrl, '_blank')}>
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                GitHub
              </Button>
            )}
            {!application.resumeUrl && !application.linkedinUrl && !application.githubUrl && (
              <span className="text-xs text-white/30 italic">No external links provided.</span>
            )}
          </div>
          
          {application.parsedSkills && application.parsedSkills.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Parsed Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {application.parsedSkills.map(skill => (
                  <span key={skill} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-[10px] font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Score ring + metrics ──────────────────────────────────────────── */}
        <div className="flex gap-6 items-start">
          {/* Score Ring */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ScoreRing score={totalScore} />
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Total Score</span>
          </div>

          {/* Metrics */}
          <div className="flex-1 space-y-1">
            {metrics.map((m) => (
              <MetricRow
                key={m.label}
                label={m.label}
                icon={m.icon}
                value={m.value}
                onChange={m.onChange}
                disabled={readOnly}
              />
            ))}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="h-px bg-white/[0.06]" />

        {/* ── Recommendation ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Recommendation</p>
          <div className="flex gap-2">
            {recommendations.map((r) => (
              <RecOption
                key={r.value}
                {...r}
                selected={recommendation === r.value}
                onSelect={() => setRecommendation(r.value)}
                disabled={readOnly}
              />
            ))}
          </div>
        </div>

        {/* ── Remarks ───────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Interviewer Remarks
          </label>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={readOnly}
            placeholder="Share your observations about the candidate — strengths, concerns, notable moments..."
            rows={4}
            className="bg-white/[0.03] border-white/10 text-white/80 placeholder:text-white/20 resize-none focus:border-white/20 focus:ring-0 rounded-xl text-sm"
          />
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between gap-3">
          <div className="text-xs text-white/30">
            All scores are on a <span className="text-white/50">0–10</span> scale
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white/40 hover:text-white/70 hover:bg-white/5"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white font-semibold min-w-[120px]"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Submitting…
                </span>
              ) : (
                'Submit Evaluation'
              )}
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
