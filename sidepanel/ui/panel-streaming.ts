import { dedupeThinking } from '../../ai/message-utils.js';
import type { RunPlan } from '../../types/plan.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).handleAssistantStream = function handleAssistantStream(event: any) {
  if (event.status === 'start') {
    this.isStreaming = true;
    this.clearErrorBanner();
    this.startStreamingMessage();
    this.updateStatus('Model is thinking...', 'active');
  } else if (event.status === 'delta') {
    this.isStreaming = true;
    this.updateStreamingMessage(event.content || '');
  } else if (event.status === 'stop') {
    this.isStreaming = false;
    this.completeStreamingMessage();
  }
  this.updateActivityState();
};

(SidePanelUI.prototype as any).startStreamingMessage = function startStreamingMessage() {
  if (this.streamingState) return;
  const container = document.createElement('div');
  container.className = 'message assistant streaming';
  container.innerHTML = `
      <div class="message-content streaming-content markdown-body">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
        <div class="stream-events"></div>
      </div>
    `;

  this.elements.chatMessages.appendChild(container);
  this.streamingState = {
    container,
    eventsEl: container.querySelector('.stream-events') as HTMLElement | null,
    lastEventType: undefined,
    textEventEl: null,
    reasoningEventEl: null,
    textBuffer: '',
    reasoningBuffer: '',
    planEl: null,
    planListEl: null,
    planMetaEl: null,
  };
  this.updateThinkingPanel(null, true);
  this.scrollToBottom();
};

(SidePanelUI.prototype as any).updateStreamingMessage = function updateStreamingMessage(content: string) {
  if (!this.streamingState) {
    this.startStreamingMessage();
  }
  if (!this.streamingState?.eventsEl) return;

  if (this.streamingState.lastEventType !== 'text') {
    const textEvent = document.createElement('div');
    textEvent.className = 'stream-event stream-event-text';
    this.streamingState.eventsEl.appendChild(textEvent);
    this.streamingState.textEventEl = textEvent;
    this.streamingState.textBuffer = '';
    this.streamingState.lastEventType = 'text';
  }

  this.streamingState.textBuffer = `${this.streamingState.textBuffer || ''}${content || ''}`;
  if (this.streamingState.textEventEl) {
    this.streamingState.textEventEl.innerHTML = this.renderMarkdown(this.streamingState.textBuffer || '');
  }

  this.scrollToBottom();
};

(SidePanelUI.prototype as any).completeStreamingMessage = function completeStreamingMessage() {
  if (!this.streamingState?.container) return;
  const indicator = this.streamingState.container.querySelector('.typing-indicator');
  if (indicator) indicator.remove();
  this.streamingState.container.classList.remove('streaming');
  if (this.streamingReasoning) {
    this.updateThinkingPanel(this.streamingReasoning, false);
  } else {
    this.updateThinkingPanel(null, false);
  }
};

(SidePanelUI.prototype as any).updateStreamReasoning = function updateStreamReasoning(delta: string | null) {
  if (!this.streamingState?.eventsEl) return;
  if (delta === null || delta === undefined) return;
  if (!delta.trim() && !this.streamingState.reasoningBuffer) return;

  if (this.streamingState.lastEventType !== 'reasoning') {
    const reasoningEvent = document.createElement('div');
    reasoningEvent.className = 'stream-event stream-event-reasoning';
    reasoningEvent.innerHTML = `
        <div class="stream-reasoning-label">Reasoning</div>
        <div class="stream-reasoning-content"></div>
      `;
    this.streamingState.eventsEl.appendChild(reasoningEvent);
    this.streamingState.reasoningEventEl = reasoningEvent.querySelector(
      '.stream-reasoning-content',
    ) as HTMLElement | null;
    this.streamingState.reasoningBuffer = '';
    this.streamingState.lastEventType = 'reasoning';
  }

  const nextBuffer = `${this.streamingState.reasoningBuffer || ''}${delta}`;
  this.streamingState.reasoningBuffer = nextBuffer;
  const cleaned = dedupeThinking(nextBuffer);
  if (this.streamingState.reasoningEventEl) {
    this.streamingState.reasoningEventEl.textContent = cleaned;
  }
  this.scrollToBottom();
};

(SidePanelUI.prototype as any).applyPlanUpdate = function applyPlanUpdate(plan: RunPlan) {
  if (!plan) return;
  this.currentPlan = plan;
  this.renderPlanDrawer(plan);
};

(SidePanelUI.prototype as any).applyManualPlanUpdate = function applyManualPlanUpdate(
  steps: Array<{ title: string; status?: string; notes?: string }> = [],
) {
  if (!steps || steps.length === 0) return;
  const now = Date.now();
  const normalizedSteps = steps
    .map((step, index) => {
      const status =
        step.status === 'running' || step.status === 'done' || step.status === 'blocked' ? step.status : 'pending';
      return {
        id: `step-${index + 1}`,
        title: step.title,
        status: status as RunPlan['steps'][number]['status'],
        notes: step.notes,
      };
    })
    .filter((step) => step.title);
  if (!normalizedSteps.length) return;
  this.currentPlan = {
    steps: normalizedSteps,
    createdAt: this.currentPlan?.createdAt || now,
    updatedAt: now,
  };
  if (this.currentPlan) {
    this.renderPlanDrawer(this.currentPlan);
  }
};

(SidePanelUI.prototype as any).renderPlanBlock = function renderPlanBlock(plan: RunPlan) {
  if (!this.streamingState) {
    this.startStreamingMessage();
  }
  const planEl = this.ensurePlanBlock();
  if (!planEl || !this.streamingState) return;

  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  if (this.streamingState.planMetaEl) {
    this.streamingState.planMetaEl.textContent = steps.length === 1 ? '1 step' : `${steps.length} steps`;
  }
  if (this.streamingState.planListEl) {
    this.streamingState.planListEl.innerHTML = steps
      .map((step) => {
        const status = step.status || 'pending';
        const statusClass = `plan-step-${status}`;
        const notes = step.notes ? `<div class="plan-step-notes">${this.escapeHtml(step.notes)}</div>` : '';
        return `
            <li class="plan-step ${statusClass}">
              <span class="plan-step-dot"></span>
              <div class="plan-step-content">
                <span class="plan-step-title">${this.escapeHtml(step.title)}</span>
                ${notes}
              </div>
            </li>
          `;
      })
      .join('');
  }
  this.scrollToBottom();
};

(SidePanelUI.prototype as any).ensurePlanBlock = function ensurePlanBlock() {
  if (!this.streamingState?.eventsEl) return null;
  if (this.streamingState.planEl) return this.streamingState.planEl;

  const container = document.createElement('div');
  container.className = 'plan-block';
  container.innerHTML = `
      <div class="plan-header">
        <span class="plan-title">Plan</span>
        <span class="plan-meta"></span>
      </div>
      <ol class="plan-steps"></ol>
    `;

  const firstChild = this.streamingState.eventsEl.firstChild;
  if (firstChild) {
    this.streamingState.eventsEl.insertBefore(container, firstChild);
  } else {
    this.streamingState.eventsEl.appendChild(container);
  }

  this.streamingState.planEl = container;
  this.streamingState.planListEl = container.querySelector('.plan-steps') as HTMLOListElement | null;
  this.streamingState.planMetaEl = container.querySelector('.plan-meta') as HTMLElement | null;
  return container;
};

(SidePanelUI.prototype as any).finishStreamingMessage = function finishStreamingMessage() {
  if (!this.streamingState) return null;
  const streamingThinking = this.streamingReasoning;
  const container = this.streamingState.container;

  this.completeStreamingMessage();
  this.streamingState = null;
  this.isStreaming = false;
  this.updateActivityState();

  return { thinking: streamingThinking, container };
};
