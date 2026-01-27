export type PlanStatus = 'pending' | 'running' | 'done' | 'blocked';

export const PLAN_STATUSES = ['pending', 'running', 'done', 'blocked'] as const;

const PLAN_STATUS_SET = new Set<PlanStatus>(PLAN_STATUSES);

export type PlanStep = {
  id: string;
  title: string;
  status: PlanStatus;
  notes?: string;
};

export type RunPlan = {
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
};

type PlanStepInput = {
  title?: string;
  status?: string;
  notes?: string;
};

export function normalizePlanStatus(value: unknown): PlanStatus {
  if (typeof value !== 'string') return 'pending';
  const lowered = value.trim().toLowerCase();
  return PLAN_STATUS_SET.has(lowered as PlanStatus) ? (lowered as PlanStatus) : 'pending';
}

export function normalizePlanSteps(input: unknown, options: { maxSteps?: number } = {}): PlanStep[] {
  const rawSteps = Array.isArray(input) ? input : [];
  const maxSteps = options.maxSteps ?? 8;
  const normalized: PlanStep[] = [];

  for (const step of rawSteps) {
    let title = '';
    let status: PlanStatus = 'pending';
    let notes: string | undefined;

    if (typeof step === 'string') {
      title = step.trim();
    } else if (step && typeof step === 'object') {
      const candidate = step as PlanStepInput;
      if (typeof candidate.title === 'string') {
        title = candidate.title.trim();
      }
      status = normalizePlanStatus(candidate.status);
      if (typeof candidate.notes === 'string' && candidate.notes.trim()) {
        notes = candidate.notes.trim();
      }
    }

    if (!title) continue;
    normalized.push({
      id: `step-${normalized.length + 1}`,
      title,
      status,
      ...(notes ? { notes } : {}),
    });

    if (normalized.length >= maxSteps) break;
  }

  return normalized;
}

export function buildRunPlan(
  stepsInput: unknown,
  options: { existingPlan?: RunPlan | null; now?: number; maxSteps?: number } = {},
): RunPlan {
  const now = options.now ?? Date.now();
  const steps = normalizePlanSteps(stepsInput, { maxSteps: options.maxSteps });
  const createdAt = options.existingPlan?.createdAt ?? now;
  return {
    steps,
    createdAt,
    updatedAt: now,
  };
}
