import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).updateStatus = function updateStatus(text: string, type = 'default') {
  if (this.elements.statusText) {
    this.elements.statusText.textContent = text;
  }
  const statusDot = document.getElementById('statusDot');
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (type === 'error') statusDot.classList.add('error');
    else if (type === 'warning') statusDot.classList.add('warning');
    else if (type === 'active') statusDot.classList.add('active');
  }
  this.updateActivityState();
};

(SidePanelUI.prototype as any).updateModelDisplay = function updateModelDisplay() {
  const config = this.configs[this.currentConfig] || {};
  const modelName = config.model || '';
  if (this.elements.modelSelect) {
    this.elements.modelSelect.value = modelName;
  }
};

(SidePanelUI.prototype as any).fetchAvailableModels = async function fetchAvailableModels() {
  const config = this.configs[this.currentConfig] || {};
  const provider = config.provider || 'openai';
  const apiKey = config.apiKey || '';
  const customEndpoint = config.customEndpoint || '';

  if (!apiKey) {
    this.populateModelSelect([config.model || 'gpt-4o']);
    return;
  }

  let baseUrl = '';
  if (provider === 'custom' && customEndpoint) {
    baseUrl = customEndpoint
      .replace(/\/chat\/completions\/?$/i, '')
      .replace(/\/v1\/?$/i, '')
      .replace(/\/+$/, '');
  } else if (provider === 'openai') {
    baseUrl = 'https://api.openai.com';
  } else if (provider === 'anthropic') {
    this.populateModelSelect([
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ]);
    return;
  }

  if (!baseUrl) {
    this.populateModelSelect([config.model || 'gpt-4o']);
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch models:', response.status);
      this.populateModelSelect([config.model || 'gpt-4o']);
      return;
    }

    const data = await response.json();
    const models = (data.data || [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id && typeof id === 'string')
      .sort((a: string, b: string) => a.localeCompare(b));

    if (models.length > 0) {
      this.populateModelSelect(models);
    } else {
      this.populateModelSelect([config.model || 'gpt-4o']);
    }
  } catch (error) {
    console.warn('Error fetching models:', error);
    this.populateModelSelect([config.model || 'gpt-4o']);
  }
};

(SidePanelUI.prototype as any).populateModelSelect = function populateModelSelect(models: string[]) {
  const select = this.elements.modelSelect;
  if (!select) return;

  const config = this.configs[this.currentConfig] || {};
  const currentModel = config.model || '';

  select.innerHTML = '';

  for (const model of models) {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    if (model === currentModel) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  if (currentModel && !models.includes(currentModel)) {
    const option = document.createElement('option');
    option.value = currentModel;
    option.textContent = currentModel;
    option.selected = true;
    select.insertBefore(option, select.firstChild);
  }
};

(SidePanelUI.prototype as any).handleModelSelectChange = function handleModelSelectChange() {
  const select = this.elements.modelSelect;
  if (!select) return;

  const selectedModel = select.value;
  if (!selectedModel) return;

  if (this.configs[this.currentConfig]) {
    this.configs[this.currentConfig].model = selectedModel;
  }

  if (this.elements.model) {
    this.elements.model.value = selectedModel;
  }

  this.persistAllSettings({ silent: true });
};
