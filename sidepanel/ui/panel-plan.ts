import type { RunPlan } from '../../types/plan.js';
import { SidePanelUI } from './panel-ui.js';

/**
 * Initialize plan drawer event listeners
 */
(SidePanelUI.prototype as any).setupPlanDrawer = function setupPlanDrawer() {
  this.elements.planDrawerToggle?.addEventListener('click', (e: MouseEvent) => {
    // Don't toggle if clicking on action buttons
    if ((e.target as HTMLElement).closest('.plan-drawer-actions')) return;
    this.togglePlanDrawer();
  });

  this.elements.planClearBtn?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    this.clearPlan();
  });
};

/**
 * Toggle the plan drawer collapsed state
 */
(SidePanelUI.prototype as any).togglePlanDrawer = function togglePlanDrawer() {
  this.elements.planDrawer?.classList.toggle('collapsed');
};

/**
 * Show the plan drawer
 */
(SidePanelUI.prototype as any).showPlanDrawer = function showPlanDrawer() {
  this.elements.planDrawer?.classList.remove('hidden');
  this.elements.planDrawer?.classList.remove('collapsed');
};

/**
 * Hide the plan drawer
 */
(SidePanelUI.prototype as any).hidePlanDrawer = function hidePlanDrawer() {
  this.elements.planDrawer?.classList.add('hidden');
};

/**
 * Clear the current plan
 */
(SidePanelUI.prototype as any).clearPlan = function clearPlan() {
  this.currentPlan = null;
  this.hidePlanDrawer();
  if (this.elements.planChecklist) {
    this.elements.planChecklist.innerHTML = '';
  }
};

/**
 * Render the plan to the drawer
 */
(SidePanelUI.prototype as any).renderPlanDrawer = function renderPlanDrawer(plan: RunPlan) {
  if (!plan || !plan.steps || plan.steps.length === 0) {
    this.hidePlanDrawer();
    return;
  }

  const steps = plan.steps;
  const completedCount = steps.filter((s) => s.status === 'done').length;
  const totalCount = steps.length;

  // Update step count
  if (this.elements.planStepCount) {
    this.elements.planStepCount.textContent =
      completedCount === totalCount
        ? `${totalCount} steps · Done`
        : `${completedCount}/${totalCount} steps`;
  }

  // Render checklist
  if (this.elements.planChecklist) {
    this.elements.planChecklist.innerHTML = steps
      .map((step, index) => {
        const isDone = step.status === 'done';
        const isRunning = step.status === 'running';
        const isBlocked = step.status === 'blocked';

        // Determine if this step can be checked (previous steps must be done)
        const previousStepsDone = steps.slice(0, index).every((s) => s.status === 'done');
        const canCheck = !isDone && previousStepsDone && !isBlocked;
        const isCurrent = !isDone && previousStepsDone && !isBlocked;

        const itemClass = [
          'plan-checklist-item',
          isDone ? 'completed' : '',
          isCurrent ? 'current' : '',
          isBlocked ? 'blocked' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const checkboxClass = ['plan-checklist-checkbox', isDone ? 'checked' : ''].filter(Boolean).join(' ');

        const checkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;

        const notes = step.notes ? `<div class="plan-checklist-notes">${this.escapeHtml(step.notes)}</div>` : '';

        return `
          <li class="${itemClass}" data-step-index="${index}" data-step-id="${step.id}">
            <button 
              class="${checkboxClass}" 
              ${!canCheck && !isDone ? 'disabled' : ''}
              data-action="toggle-step"
              data-step-index="${index}"
              title="${isDone ? 'Completed' : canCheck ? 'Mark as done' : 'Complete previous steps first'}"
            >
              ${checkIcon}
            </button>
            <div class="plan-checklist-content">
              <div class="plan-checklist-title">${this.escapeHtml(step.title)}</div>
              ${notes}
            </div>
          </li>
        `;
      })
      .join('');

    // Add click handlers for checkboxes
    this.elements.planChecklist.querySelectorAll('[data-action="toggle-step"]').forEach((btn: Element) => {
      btn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const index = parseInt((btn as HTMLElement).dataset.stepIndex || '0', 10);
        this.togglePlanStep(index);
      });
    });
  }

  this.showPlanDrawer();
};

/**
 * Toggle a plan step's completion status
 */
(SidePanelUI.prototype as any).togglePlanStep = function togglePlanStep(index: number) {
  if (!this.currentPlan || !this.currentPlan.steps[index]) return;

  const step = this.currentPlan.steps[index];
  const previousStepsDone = this.currentPlan.steps.slice(0, index).every((s: { status: string }) => s.status === 'done');

  // Can only toggle if previous steps are done
  if (!previousStepsDone && step.status !== 'done') {
    this.updateStatus('Complete previous steps first', 'warning');
    return;
  }

  // Toggle the step
  if (step.status === 'done') {
    // Unchecking - also uncheck all subsequent steps
    for (let i = index; i < this.currentPlan.steps.length; i++) {
      if (this.currentPlan.steps[i].status === 'done') {
        this.currentPlan.steps[i].status = 'pending';
      }
    }
  } else {
    step.status = 'done';
  }

  this.currentPlan.updatedAt = Date.now();
  this.renderPlanDrawer(this.currentPlan);
};

/**
 * Check if all plan steps are completed
 */
(SidePanelUI.prototype as any).isPlanComplete = function isPlanComplete(): boolean {
  if (!this.currentPlan || !this.currentPlan.steps) return true;
  return this.currentPlan.steps.every((s: { status: string }) => s.status === 'done');
};

/**
 * Get incomplete plan steps for validation
 */
(SidePanelUI.prototype as any).getIncompletePlanSteps = function getIncompletePlanSteps(): string[] {
  if (!this.currentPlan || !this.currentPlan.steps) return [];
  return this.currentPlan.steps
    .filter((s: { status: string }) => s.status !== 'done')
    .map((s: { title: string }) => s.title);
};
