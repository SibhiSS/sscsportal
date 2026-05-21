import { Application } from '@/types';
import { PIPELINE_STAGES, STAGE_LABELS, normalizeStatus } from '@/lib/fsm';
import { format, parseISO, isValid } from 'date-fns';
import { motion } from 'framer-motion';

interface CandidateTimelineProps {
  application: Application;
}

// ── Timeline event definitions ────────────────────────────────────────────────

interface TimelineEvent {
  stage: string;
  icon: string;
  label: string;
  description: string;
  timestamp?: string | null;
}

function safeFormat(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = typeof ts === 'string' ? parseISO(ts) : new Date(ts);
    if (isValid(d)) return format(d, 'MMM d, yyyy • h:mm a');
  } catch {
    // ignore
  }
  return null;
}

// Determine pipeline stage index (higher = further along)
function stageIndex(status: string): number {
  const idx = PIPELINE_STAGES.indexOf(status as any);
  return idx === -1 ? -1 : idx;
}

// Determine if a candidate has passed (≥) a given stage
function hasPassed(currentStatus: string, stage: string): boolean {
  const terminal = ['rejected', 'waitlisted'];
  const normalized = normalizeStatus(currentStatus as any);

  // For terminal states the timeline collapses to the decision stage
  if (terminal.includes(normalized)) {
    const terminalIdx = stageIndex(normalized);
    const stageIdx = stageIndex(stage);
    return stageIdx <= terminalIdx;
  }
  return stageIndex(normalized) >= stageIndex(stage);
}

// ── Dot component ─────────────────────────────────────────────────────────────

type DotState = 'past' | 'current' | 'future';

const TimelineDot = ({ state, icon }: { state: DotState; icon: string }) => {
  if (state === 'current') {
    return (
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute w-8 h-8 rounded-full bg-primary/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative w-7 h-7 rounded-full bg-primary border-2 border-primary flex items-center justify-center shadow-[0_0_12px_rgba(220,20,60,0.6)] z-10">
          <span className="text-xs">{icon}</span>
        </div>
      </div>
    );
  }
  if (state === 'past') {
    return (
      <div className="w-7 h-7 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center">
        <span className="text-xs">{icon}</span>
      </div>
    );
  }
  // future
  return (
    <div className="w-7 h-7 rounded-full bg-transparent border-2 border-white/15 flex items-center justify-center">
      <span className="text-xs opacity-40">{icon}</span>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function CandidateTimeline({ application }: CandidateTimelineProps) {
  const normalized = normalizeStatus(application.status);
  const currentIdx = stageIndex(normalized);

  // Determine terminal outcome label
  const isRejected   = normalized === 'rejected';
  const isWaitlisted = normalized === 'waitlisted';
  const isSelected   = ['selected', 'active_member', 'alumni', 'inactive'].includes(normalized);

  const terminalIcon  = isSelected ? '🏆' : isRejected ? '❌' : isWaitlisted ? '⏳' : '🏁';
  const terminalLabel = isSelected ? 'Selected' : isRejected ? 'Rejected' : isWaitlisted ? 'Waitlisted' : 'Decided';
  const terminalDesc  = isSelected
    ? 'Congratulations! This candidate was accepted into the team.'
    : isRejected
    ? 'This application was not carried forward at this time.'
    : isWaitlisted
    ? 'Candidate is on the waitlist pending further decisions.'
    : 'Final outcome pending.';

  // Build event list
  const events: TimelineEvent[] = [
    {
      stage: 'applied',
      icon: '📝',
      label: 'Applied',
      description: 'Application submitted successfully.',
      timestamp: application.submittedAt,
    },
    {
      stage: 'under_review',
      icon: '👁️',
      label: 'Under Review',
      description: 'Application is being reviewed by the recruitment team.',
      timestamp: null,
    },
    {
      stage: 'shortlisted',
      icon: '✅',
      label: 'Shortlisted',
      description: 'Resume and application cleared the review stage.',
      timestamp: application.shortlistedAt,
    },
    {
      stage: 'interview_scheduled',
      icon: '📅',
      label: 'Interview Scheduled',
      description: 'An interview slot has been confirmed.',
      timestamp: null,
    },
    {
      stage: 'interviewed',
      icon: '🎤',
      label: 'Interviewed',
      description: 'Interview completed and evaluation submitted.',
      timestamp: application.interviewedAt,
    },
  ];

  // Only show the terminal event if the candidate has reached a final decision stage
  const showTerminal = isSelected || isRejected || isWaitlisted || application.decidedAt != null;
  if (showTerminal || currentIdx >= stageIndex('interviewed')) {
    events.push({
      stage: normalized === 'selected' ? 'selected' : isRejected ? 'rejected' : 'waitlisted',
      icon: terminalIcon,
      label: terminalLabel,
      description: terminalDesc,
      timestamp: application.decidedAt,
    });
  }

  // Filter: only show stages that are relevant to this candidate's journey
  // (hide future stages beyond rejection/waitlist)
  const visibleEvents = events.filter(ev => {
    const evIdx = stageIndex(ev.stage);
    if (evIdx === -1) return true; // terminal events (selected/rejected/waitlisted)
    if ((isRejected || isWaitlisted) && ev.stage === 'selected') return false;
    return true;
  });

  return (
    <div className="py-2 px-1">
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[13px] top-4 bottom-4 w-px border-l border-dashed border-white/15" />

        <div className="space-y-0">
          {visibleEvents.map((ev, idx) => {
            const evIdx = stageIndex(ev.stage);
            let dotState: DotState;

            if (evIdx === -1) {
              // Terminal event
              dotState = showTerminal ? (currentIdx >= 5 || isRejected || isWaitlisted ? 'current' : 'future') : 'future';
              // More accurate: if this IS the current status, it's current; if past it's past
              if (hasPassed(application.status, 'selected') ||
                  hasPassed(application.status, 'rejected') ||
                  hasPassed(application.status, 'waitlisted')) {
                dotState = 'past';
              }
              if (ev.stage === normalized && (isSelected || isRejected || isWaitlisted)) {
                dotState = 'current';
              }
            } else if (evIdx < currentIdx) {
              dotState = 'past';
            } else if (evIdx === currentIdx) {
              dotState = 'current';
            } else {
              dotState = 'future';
            }

            const timestamp = safeFormat(ev.timestamp);
            const isPast    = dotState === 'past';
            const isCurrent = dotState === 'current';
            const isFuture  = dotState === 'future';

            const isLast = idx === visibleEvents.length - 1;

            return (
              <motion.div
                key={`${ev.stage}-${idx}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.07 }}
                className={`relative flex gap-4 ${isLast ? '' : 'pb-6'} ${isFuture ? 'opacity-30' : ''}`}
              >
                {/* Dot */}
                <div className="relative z-10 flex-shrink-0 mt-0.5">
                  <TimelineDot state={dotState} icon={ev.icon} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${isCurrent ? 'text-primary' : isPast ? 'text-white' : 'text-white/50'}`}>
                      {ev.label}
                    </span>
                    {timestamp && (
                      <span className="text-xs text-white/35">{timestamp}</span>
                    )}
                    {isCurrent && !timestamp && (
                      <span className="text-xs text-primary/60 italic">In progress</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 leading-relaxed ${isCurrent ? 'text-white/60' : isPast ? 'text-white/40' : 'text-white/25'}`}>
                    {ev.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
