import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Application, ApplicationStatus } from '@/types';
import { PIPELINE_STAGES, STAGE_LABELS, normalizeStatus } from '@/lib/fsm';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, FileText, Star, GripVertical, InboxIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  applications: Application[];
  onUpdate: (id: string, updates: Partial<Application>) => Promise<void>;
  onCardClick: (app: Application) => void;
}

// ─── Column style config ──────────────────────────────────────────────────────

const COLUMN_STYLES: Record<string, { border: string; text: string; badge: string; glow: string }> = {
  applied: {
    border: 'border-t-blue-500/60',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    glow: 'shadow-blue-500/10',
  },
  under_review: {
    border: 'border-t-yellow-500/60',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    glow: 'shadow-yellow-500/10',
  },
  shortlisted: {
    border: 'border-t-cyan-500/60',
    text: 'text-cyan-400',
    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    glow: 'shadow-cyan-500/10',
  },
  interview_scheduled: {
    border: 'border-t-purple-500/60',
    text: 'text-purple-400',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    glow: 'shadow-purple-500/10',
  },
  interviewed: {
    border: 'border-t-orange-500/60',
    text: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    glow: 'shadow-orange-500/10',
  },
  selected: {
    border: 'border-t-green-500/60',
    text: 'text-green-400',
    badge: 'bg-green-500/20 text-green-300 border-green-500/30',
    glow: 'shadow-green-500/10',
  },
  waitlisted: {
    border: 'border-t-amber-500/60',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    glow: 'shadow-amber-500/10',
  },
  rejected: {
    border: 'border-t-red-500/60',
    text: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    glow: 'shadow-red-500/10',
  },
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

function deriveSkills(app: Application): string[] {
  if (app.parsedSkills && app.parsedSkills.length > 0) {
    return app.parsedSkills.slice(0, 3);
  }
  if (app.skills) {
    return app.skills
      .split(/[,;/\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
  }
  return [];
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < filled ? 'text-amber-400 fill-amber-400' : 'text-white/20'}`}
        />
      ))}
    </div>
  );
}

// ─── KanbanCard ───────────────────────────────────────────────────────────────

interface KanbanCardProps {
  app: Application;
  onClick: (app: Application) => void;
  isOverlay?: boolean;
}

function KanbanCard({ app, onClick, isOverlay = false }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const skills = useMemo(() => deriveSkills(app), [app]);
  const normalizedStatus = normalizeStatus(app.status);
  const colStyle = COLUMN_STYLES[normalizedStatus] ?? COLUMN_STYLES.applied;

  const cardClasses = [
    'bg-white/5 border border-white/10 rounded-lg p-3',
    'cursor-grab active:cursor-grabbing transition-all duration-200',
    'hover:border-white/20 hover:shadow-lg hover:shadow-primary/10',
    isOverlay
      ? 'shadow-2xl shadow-black/50 rotate-1 scale-105 border-white/20 opacity-95'
      : isDragging
      ? 'opacity-40 scale-95'
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cardContent = (
    <div className={cardClasses} onClick={() => !isDragging && onClick(app)}>
      {/* Grip + Name row */}
      <div className="flex items-start gap-2 mb-2">
        <GripVertical className="w-3.5 h-3.5 text-white/20 mt-0.5 flex-shrink-0 cursor-grab" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white text-sm leading-tight truncate">
            {app.fullName}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground truncate mt-0.5">
            {app.rollNumber}
          </p>
        </div>
        {app.resumeUrl && (
          <FileText className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" />
        )}
      </div>

      {/* Primary dept badge */}
      {app.primaryDept && (
        <div className="mb-2">
          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 truncate max-w-full">
            {app.primaryDept}
          </span>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 truncate max-w-[90px]"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Footer row: stars + score */}
      <div className="flex items-center justify-between mt-1">
        <StarRating rating={app.rating ?? 0} />
        {app.finalScore != null && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colStyle.badge}`}>
            {app.finalScore.toFixed(1)}/10
          </span>
        )}
      </div>
    </div>
  );

  if (isOverlay) {
    return cardContent;
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {cardContent}
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: ApplicationStatus;
  apps: Application[];
  onCardClick: (app: Application) => void;
  isOver?: boolean;
}

function KanbanColumn({ stage, apps, onCardClick, isOver = false }: KanbanColumnProps) {
  const colStyle = COLUMN_STYLES[stage] ?? COLUMN_STYLES.applied;
  const label = STAGE_LABELS[stage] ?? stage;
  const ids = apps.map((a) => a.id);

  return (
    <div
      className={[
        'flex flex-col min-w-[260px] max-w-[260px]',
        'bg-white/[0.02] border border-t-2 border-white/10 rounded-xl',
        colStyle.border,
        'transition-all duration-200',
        isOver ? `shadow-lg ${colStyle.glow} bg-white/[0.04]` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <Users className={`w-3.5 h-3.5 flex-shrink-0 ${colStyle.text}`} />
          <span className={`text-xs font-semibold truncate ${colStyle.text}`}>{label}</span>
        </div>
        <span
          className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border ${colStyle.badge}`}
        >
          {apps.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-280px)] p-2 space-y-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {apps.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-2 py-8 px-3 rounded-lg border border-dashed border-white/10 text-center"
              >
                <InboxIcon className="w-6 h-6 text-white/20" />
                <p className="text-[11px] text-white/30 font-medium">No applicants</p>
              </motion.div>
            ) : (
              apps.map((app, idx) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.18, delay: idx * 0.03 }}
                >
                  <KanbanCard app={app} onClick={onCardClick} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </SortableContext>
      </div>
    </div>
  );
}

// ─── KanbanBoard (main) ───────────────────────────────────────────────────────

export default function KanbanBoard({ applications, onUpdate, onCardClick }: KanbanBoardProps) {
  const [activeApp, setActiveApp] = useState<Application | null>(null);
  const [overColumn, setOverColumn] = useState<ApplicationStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  // Group applications by their normalized pipeline stage
  const columnApps = useMemo<Record<ApplicationStatus, Application[]>>(() => {
    const groups = {} as Record<ApplicationStatus, Application[]>;
    for (const stage of PIPELINE_STAGES) {
      groups[stage] = [];
    }
    for (const app of applications) {
      const normalized = normalizeStatus(app.status);
      // Only render in pipeline stages; skip post-selection/legacy
      if (PIPELINE_STAGES.includes(normalized)) {
        groups[normalized].push(app);
      } else {
        // Fallback: show in 'applied' if unknown
        groups['applied'].push(app);
      }
    }
    return groups;
  }, [applications]);

  // Build a lookup: card id → current column
  const cardColumnMap = useMemo<Record<string, ApplicationStatus>>(() => {
    const map: Record<string, ApplicationStatus> = {};
    for (const stage of PIPELINE_STAGES) {
      for (const app of columnApps[stage]) {
        map[app.id] = stage;
      }
    }
    return map;
  }, [columnApps]);

  const findColumnForCard = (cardId: string): ApplicationStatus | null =>
    cardColumnMap[cardId] ?? null;

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string;
    const found = applications.find((a) => a.id === id);
    setActiveApp(found ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    if (!over) {
      setOverColumn(null);
      return;
    }
    // over.id is either a column stage or a card id
    const overId = over.id as string;
    if ((PIPELINE_STAGES as string[]).includes(overId)) {
      setOverColumn(overId as ApplicationStatus);
    } else {
      const col = findColumnForCard(overId);
      setOverColumn(col);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveApp(null);
    setOverColumn(null);

    const { active, over } = event;
    if (!active || !over) return;

    const cardId = active.id as string;
    const overId = over.id as string;

    let targetColumn: ApplicationStatus | null = null;

    if ((PIPELINE_STAGES as string[]).includes(overId)) {
      targetColumn = overId as ApplicationStatus;
    } else {
      targetColumn = findColumnForCard(overId);
    }

    if (!targetColumn) return;

    const sourceColumn = findColumnForCard(cardId);
    if (!sourceColumn || sourceColumn === targetColumn) return;

    try {
      await onUpdate(cardId, { status: targetColumn });
    } catch (err) {
      console.error('[KanbanBoard] Failed to update status:', err);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 min-h-[400px]">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            apps={columnApps[stage]}
            onCardClick={onCardClick}
            isOver={overColumn === stage}
          />
        ))}
      </div>

      {/* Drag overlay — renders a floating ghost of the dragged card */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeApp ? (
          <div className="w-[260px]">
            <KanbanCard app={activeApp} onClick={() => {}} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
