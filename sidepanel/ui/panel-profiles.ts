import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).createNewConfig = async function createNewConfig(name?: string) {
  const trimmedName = (name || '').trim() || prompt('Enter profile name:') || '';
  if (!trimmedName) return;
  if (this.configs[trimmedName]) {
    alert('Profile already exists!');
    return;
  }

  this.configs[trimmedName] = {
    provider: this.elements.provider.value,
    apiKey: this.elements.apiKey.value,
    model: this.elements.model.value,
    customEndpoint: this.elements.customEndpoint.value,
    systemPrompt: this.elements.systemPrompt.value,
    temperature: Number.parseFloat(this.elements.temperature.value),
    maxTokens: Number.parseInt(this.elements.maxTokens.value),
    timeout: Number.parseInt(this.elements.timeout.value),
    sendScreenshotsAsImages: this.elements.sendScreenshotsAsImages.value === 'true',
    screenshotQuality: this.elements.screenshotQuality.value,
    streamResponses: this.elements.streamResponses.value === 'true',
    enableScreenshots: this.elements.enableScreenshots.value === 'true',
  };

  this.refreshConfigDropdown();
  this.setActiveConfig(trimmedName, true);
  this.updateStatus(`Profile "${trimmedName}" created`, 'success');
};

(SidePanelUI.prototype as any).deleteConfig = async function deleteConfig() {
  if (this.currentConfig === 'default') {
    alert('Cannot delete default profile');
    return;
  }

  if (confirm(`Delete profile "${this.currentConfig}"?`)) {
    delete this.configs[this.currentConfig];
    this.currentConfig = 'default';
    this.refreshConfigDropdown();
    this.setActiveConfig(this.currentConfig, true);
    this.updateStatus('Profile deleted', 'success');
  }
};

(SidePanelUI.prototype as any).switchConfig = async function switchConfig() {
  const newConfig = this.elements.activeConfig.value;
  if (!this.configs[newConfig]) {
    alert('Profile not found');
    return;
  }
  this.configs[this.currentConfig] = this.collectCurrentFormProfile();
  this.setActiveConfig(newConfig);
  await this.persistAllSettings({ silent: true });
};

(SidePanelUI.prototype as any).refreshConfigDropdown = function refreshConfigDropdown() {
  this.elements.activeConfig.innerHTML = '';
  if (this.elements.generalProfileSelect) {
    this.elements.generalProfileSelect.innerHTML = '';
  }
  Object.keys(this.configs).forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === this.currentConfig) {
      option.selected = true;
    }
    this.elements.activeConfig.appendChild(option);

    if (this.elements.generalProfileSelect) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === this.currentConfig) {
        opt.selected = true;
      }
      this.elements.generalProfileSelect.appendChild(opt);
    }
  });
  this.refreshProfileSelectors();
  this.renderProfileGrid();
  this.updateContextUsage();
};

(SidePanelUI.prototype as any).refreshProfileSelectors = function refreshProfileSelectors() {
  const names = Object.keys(this.configs);
  const selects = [this.elements.orchestratorProfile, this.elements.visionProfile];
  selects.forEach((select) => {
    if (!select) return;
    select.innerHTML = '<option value="">Use active config</option>';
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

    const currentValue = select.value;
    if (!currentValue) return;
    if (!names.includes(currentValue)) {
      select.value = '';
    }
  });
};

(SidePanelUI.prototype as any).renderProfileGrid = function renderProfileGrid() {
  if (!this.elements.agentGrid) return;
  this.elements.agentGrid.innerHTML = '';
  const currentVision = this.elements.visionProfile?.value;
  const currentOrchestrator = this.elements.orchestratorProfile?.value;
  const configs = Object.keys(this.configs);
  if (!configs.length) {
    this.elements.agentGrid.innerHTML = '<div class="history-empty">No profiles yet.</div>';
    return;
  }
  configs.forEach((name) => {
    const card = document.createElement('div');
    card.className = 'agent-card';
    if (name === this.profileEditorTarget) {
      card.classList.add('editing');
    }
    card.dataset.profile = name;
    const rolePills = ['main', 'vision', 'orchestrator', 'aux']
      .map((role) => {
        const isActive = this.isProfileActiveForRole(name, role, currentVision, currentOrchestrator);
        const label = this.getRoleLabel(role);
        return `<span class="role-pill ${isActive ? 'active' : ''} ${role}-pill" data-role="${role}" data-profile="${name}">${label}</span>`;
      })
      .join('');
    const config = this.configs[name] || {};
    card.innerHTML = `
        <div>
          <h4>${this.escapeHtml(name)}</h4>
          <span>${this.escapeHtml(config.provider || 'Provider')} · ${this.escapeHtml(config.model || 'Model')}</span>
        </div>
        <div class="role-pills">${rolePills}</div>
      `;
    this.elements.agentGrid.appendChild(card);
  });
};

(SidePanelUI.prototype as any).getRoleLabel = function getRoleLabel(role: string) {
  switch (role) {
    case 'main':
      return 'Main';
    case 'vision':
      return 'Vision';
    case 'orchestrator':
      return 'Orchestrator';
    default:
      return 'Team';
  }
};

(SidePanelUI.prototype as any).isProfileActiveForRole = function isProfileActiveForRole(
  name: string,
  role: string,
  visionName?: string,
  orchestratorName?: string,
) {
  if (role === 'main') return name === this.currentConfig;
  if (role === 'vision') return name && visionName === name;
  if (role === 'orchestrator') return name && orchestratorName === name;
  if (role === 'aux') return this.auxAgentProfiles.includes(name);
  return false;
};

(SidePanelUI.prototype as any).assignProfileRole = function assignProfileRole(profileName: string, role: string) {
  if (!profileName) return;
  if (role === 'main') {
    this.setActiveConfig(profileName);
    return;
  }
  if (role === 'vision') {
    this.toggleProfileRole('visionProfile', profileName);
  } else if (role === 'orchestrator') {
    this.toggleProfileRole('orchestratorProfile', profileName);
  } else if (role === 'aux') {
    this.toggleAuxProfile(profileName);
  }
};

(SidePanelUI.prototype as any).toggleProfileRole = function toggleProfileRole(elementId: string, profileName: string) {
  const element = this.elements[elementId];
  if (!element) return;
  element.value = element.value === profileName ? '' : profileName;
  this.renderProfileGrid();
};

(SidePanelUI.prototype as any).toggleAuxProfile = function toggleAuxProfile(profileName: string) {
  const idx = this.auxAgentProfiles.indexOf(profileName);
  if (idx === -1) {
    this.auxAgentProfiles.push(profileName);
  } else {
    this.auxAgentProfiles.splice(idx, 1);
  }
  this.auxAgentProfiles = Array.from(new Set(this.auxAgentProfiles));
  this.renderProfileGrid();
};

(SidePanelUI.prototype as any).editProfile = function editProfile(name: string, silent = false) {
  if (!name || !this.configs[name]) return;
  this.profileEditorTarget = name;
  const config = this.configs[name];
  this.elements.profileEditorTitle && (this.elements.profileEditorTitle.textContent = `Editing: ${name}`);
  this.elements.profileEditorName && (this.elements.profileEditorName.value = name);
  this.elements.profileEditorProvider.value = config.provider || 'openai';
  this.elements.profileEditorApiKey.value = config.apiKey || '';
  this.elements.profileEditorModel.value = config.model || '';
  this.elements.profileEditorEndpoint.value = config.customEndpoint || '';
  this.elements.profileEditorTemperature.value = config.temperature ?? 0.7;
  if (this.elements.profileEditorTemperatureValue) {
    this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
  }
  this.elements.profileEditorMaxTokens.value = config.maxTokens || 2048;
  this.elements.profileEditorTimeout.value = config.timeout || 30000;
  this.elements.profileEditorEnableScreenshots.value = config.enableScreenshots ? 'true' : 'false';
  this.elements.profileEditorSendScreenshots.value = config.sendScreenshotsAsImages ? 'true' : 'false';
  this.elements.profileEditorScreenshotQuality.value = config.screenshotQuality || 'high';
  this.elements.profileEditorPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
  this.toggleProfileEditorEndpoint();
  this.renderProfileGrid();
  if (!silent) {
    this.switchSettingsTab('profiles');
  }
};

(SidePanelUI.prototype as any).collectProfileEditorData = function collectProfileEditorData() {
  return {
    provider: this.elements.profileEditorProvider.value,
    apiKey: this.elements.profileEditorApiKey.value,
    model: this.elements.profileEditorModel.value,
    customEndpoint: this.elements.profileEditorEndpoint.value,
    temperature: Number.parseFloat(this.elements.profileEditorTemperature.value) || 0.7,
    maxTokens: Number.parseInt(this.elements.profileEditorMaxTokens.value) || 2048,
    timeout: Number.parseInt(this.elements.profileEditorTimeout.value) || 30000,
    enableScreenshots: this.elements.profileEditorEnableScreenshots.value === 'true',
    sendScreenshotsAsImages: this.elements.profileEditorSendScreenshots.value === 'true',
    screenshotQuality: this.elements.profileEditorScreenshotQuality.value || 'high',
    systemPrompt: this.elements.profileEditorPrompt.value || this.getDefaultSystemPrompt(),
  };
};

(SidePanelUI.prototype as any).saveProfileEdits = async function saveProfileEdits() {
  const target = this.profileEditorTarget;
  if (!target || !this.configs[target]) {
    this.updateStatus('Select a profile to edit', 'warning');
    return;
  }
  const existing = this.configs[target] || {};
  this.configs[target] = { ...existing, ...this.collectProfileEditorData() };
  await this.persistAllSettings({ silent: true });
  if (target === this.currentConfig) {
    this.populateFormFromConfig(this.configs[target]);
    this.toggleCustomEndpoint();
  }
  this.renderProfileGrid();
  this.updateStatus(`Profile "${target}" saved`, 'success');
};

(SidePanelUI.prototype as any).populateFormFromConfig = function populateFormFromConfig(
  config: Record<string, any> = {},
) {
  this.elements.provider.value = config.provider || 'openai';
  this.elements.apiKey.value = config.apiKey || '';
  this.elements.model.value = config.model || 'gpt-4o';
  this.elements.customEndpoint.value = config.customEndpoint || '';
  this.elements.systemPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
  this.elements.temperature.value = config.temperature !== undefined ? config.temperature : 0.7;
  this.elements.temperatureValue.textContent = this.elements.temperature.value;
  this.elements.maxTokens.value = config.maxTokens || 4096;
  this.elements.contextLimit.value = config.contextLimit || 200000;
  this.elements.timeout.value = config.timeout || 30000;
  this.elements.enableScreenshots.value = config.enableScreenshots ? 'true' : 'false';
  this.elements.sendScreenshotsAsImages.value = config.sendScreenshotsAsImages ? 'true' : 'false';
  this.elements.screenshotQuality.value = config.screenshotQuality || 'high';
  this.elements.streamResponses.value = config.streamResponses !== false ? 'true' : 'true';
  this.elements.showThinking.value = config.showThinking !== false ? 'true' : 'false';
  this.elements.autoScroll.value = config.autoScroll !== false ? 'true' : 'false';
  this.elements.confirmActions.value = config.confirmActions !== false ? 'true' : 'false';
  this.elements.saveHistory.value = config.saveHistory !== false ? 'true' : 'false';
};

(SidePanelUI.prototype as any).setActiveConfig = function setActiveConfig(name: string, quiet = false) {
  if (!this.configs[name]) return;
  this.currentConfig = name;
  this.elements.activeConfig.value = name;
  this.populateFormFromConfig(this.configs[name]);
  this.toggleCustomEndpoint();
  this.renderProfileGrid();
  this.updateScreenshotToggleState();
  this.editProfile(name, true);
  this.updateModelDisplay();
  this.fetchAvailableModels();
  if (!quiet) {
    this.updateStatus(`Switched to configuration "${name}"`, 'success');
  }
};
