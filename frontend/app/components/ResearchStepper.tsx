"use client";
/**
 * ResearchStepper.tsx
 *
 * Interactive visual research plan timeline for the Autonomous Research Agent.
 * Renders a live progress stepper card above AI message content when the agent
 * emits a <research_plan> manifest.
 *
 * Step States:
 *   "pending"   → muted circle  [○]  — not yet started
 *   "running"   → cyan spinner  [⟳]  — actively executing
 *   "completed" → emerald check [✓]  — finished
 */
import { CheckCircle2, ChevronDown, ChevronRight, Compass, Loader2 } from "lucide-react";
import React, { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ResearchStep {
  id: string;
  label: string;
  tool?: string;          // associated tool name, if known
  status: "pending" | "running" | "completed";
  details?: string;       // tool output snippet shown on expand
}

export interface ResearchPlan {
  title: string;
  steps: ResearchStep[];
}

interface ResearchStepperProps {
  plan: ResearchPlan;
}

// ── Step Icon ──────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: ResearchStep["status"] }) {
  if (status === "completed") {
    return (
      <span className="research-step-icon research-step-icon--done">
        <CheckCircle2 size={14} />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="research-step-icon research-step-icon--running">
        <Loader2 size={14} className="research-spin" />
      </span>
    );
  }
  return (
    <span className="research-step-icon research-step-icon--pending">
      <span className="research-step-circle" />
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ResearchStepper({ plan }: ResearchStepperProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleStep = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const completedCount = plan.steps.filter((s) => s.status === "completed").length;
  const runningStep   = plan.steps.find((s) => s.status === "running");
  const totalSteps    = plan.steps.length;
  const progressPct   = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isAllDone     = completedCount === totalSteps && totalSteps > 0;

  return (
    <div className={`research-stepper-root${isAllDone ? " research-stepper--done" : ""}`}>

      {/* ── Header ── */}
      <button
        type="button"
        className="research-stepper-header"
        onClick={() => setIsCollapsed((c) => !c)}
        aria-expanded={!isCollapsed}
      >
        <span className="research-stepper-icon">
          <Compass size={13} />
        </span>
        <span className="research-stepper-title">{plan.title}</span>
        <span className="research-stepper-counter">
          {completedCount} / {totalSteps} steps
        </span>
        {isAllDone && <span className="research-complete-badge">✓ Complete</span>}
        <span className="research-stepper-chevron">
          {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {/* ── Progress Bar ── */}
      {!isCollapsed && (
        <div className="research-progress-track">
          <div
            className="research-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* ── Step List ── */}
      {!isCollapsed && (
        <div className="research-step-list">
          {plan.steps.map((step, idx) => {
            const isExpanded = expandedIds.has(step.id);
            const isActive   = step.status === "running";
            const isDone     = step.status === "completed";

            return (
              <div
                key={step.id}
                className={`research-step-item${isActive ? " research-step-item--active" : ""}${isDone ? " research-step-item--done" : ""}`}
              >
                {/* Step Row */}
                <div className="research-step-row">
                  {/* Connector line (not on last item) */}
                  {idx < plan.steps.length - 1 && (
                    <span className={`research-step-connector${isDone ? " research-step-connector--done" : ""}`} />
                  )}

                  <StepIcon status={step.status} />

                  <span className="research-step-label">
                    {step.label}
                  </span>

                  {isActive && (
                    <span className="research-step-status-text">Running…</span>
                  )}

                  {/* Expand toggle for completed steps with details */}
                  {isDone && step.details && (
                    <button
                      type="button"
                      className="research-step-expand-btn"
                      onClick={(e) => { e.stopPropagation(); toggleStep(step.id); }}
                      title="View tool output"
                    >
                      {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                  )}
                </div>

                {/* Expanded detail view */}
                {isExpanded && step.details && (
                  <div className="research-step-detail">
                    <pre className="research-step-detail-text">{step.details.slice(0, 400)}{step.details.length > 400 ? "…" : ""}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
