import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).addSubagent = function addSubagent(id: string, name: string, tasks: any) {
  this.subagents.set(id, {
    name: name || `Sub-${this.subagents.size + 1}`,
    tasks,
    status: 'running',
    messages: [],
  });
  this.renderAgentNav();
};

(SidePanelUI.prototype as any).updateSubagentStatus = function updateSubagentStatus(id: string, status: string) {
  const agent = this.subagents.get(id);
  if (agent) {
    agent.status = status;
    this.renderAgentNav();
  }
};

(SidePanelUI.prototype as any).renderAgentNav = function renderAgentNav() {
  if (!this.elements.agentNav) return;

  if (this.subagents.size === 0) {
    this.hideAgentNav();
    return;
  }

  this.elements.agentNav.classList.remove('hidden');

  let html = `
      <div class="agent-nav-item main-agent ${this.activeAgent === 'main' ? 'active' : ''}" data-agent="main">
        <span class="agent-status"></span>
        <span>Main</span>
      </div>
    `;

  this.subagents.forEach((agent: any, id: string) => {
    const statusClass = agent.status === 'running' ? 'running' : agent.status === 'completed' ? 'completed' : 'error';
    html += `
        <div class="agent-nav-item sub-agent ${statusClass} ${this.activeAgent === id ? 'active' : ''}" data-agent="${id}">
          <span class="agent-status"></span>
          <span>${agent.name}</span>
        </div>
      `;
  });

  this.elements.agentNav.innerHTML = html;

  this.elements.agentNav.querySelectorAll('.agent-nav-item').forEach((item: Element) => {
    item.addEventListener('click', () => {
      const agentId = (item as HTMLElement).dataset.agent;
      this.switchAgent(agentId);
    });
  });
};

(SidePanelUI.prototype as any).switchAgent = function switchAgent(agentId: string) {
  this.activeAgent = agentId;
  this.renderAgentNav();
};

(SidePanelUI.prototype as any).hideAgentNav = function hideAgentNav() {
  if (this.elements.agentNav) {
    this.elements.agentNav.classList.add('hidden');
  }
};
