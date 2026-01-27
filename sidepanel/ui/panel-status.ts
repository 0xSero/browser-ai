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
  // Now the model select shows profiles, so we update it to the current config
  if (this.elements.modelSelect) {
    this.elements.modelSelect.value = this.currentConfig;
  }
};

(SidePanelUI.prototype as any).fetchAvailableModels = async function fetchAvailableModels() {
  const config = this.configs[this.currentConfig] || {};
  const provider = config.provider || 'anthropic';
  const apiKey = config.apiKey || '';
  const customEndpoint = config.customEndpoint || '';
  
  console.log('[Parchi] fetchAvailableModels called');
  console.log('[Parchi] currentConfig:', this.currentConfig);
  console.log('[Parchi] config:', { provider, apiKey: apiKey ? '***' : '(empty)', customEndpoint });

  // Hardcoded model lists for providers that don't support /v1/models
  const ANTHROPIC_MODELS = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ];

  const GOOGLE_MODELS = [
    'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-pro-preview-05-06',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ];

  const OPENAI_MODELS = [
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4.1-nano',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'o1',
    'o1-mini',
    'o1-pro',
    'o3',
    'o3-mini',
    'o4-mini',
  ];

  // Use hardcoded lists for known providers (faster, no API call needed)
  if (provider === 'anthropic') {
    this.populateModelSelect(ANTHROPIC_MODELS, config.model);
    return;
  }

  if (provider === 'google') {
    this.populateModelSelect(GOOGLE_MODELS, config.model);
    return;
  }

  if (provider === 'kimi') {
    this.populateModelSelect([config.model || 'kimi-for-coding'], config.model);
    return;
  }

  if (provider === 'openai' && !customEndpoint) {
    // Use hardcoded list for faster loading, but allow API fetch as fallback
    this.populateModelSelect(OPENAI_MODELS, config.model);
    return;
  }

  // For custom providers, try to fetch from /v1/models
  if (!apiKey && provider === 'custom') {
    this.populateModelSelect([config.model || 'gpt-4o'], config.model);
    return;
  }

  let baseUrl = '';
  if (customEndpoint) {
    // Normalize the endpoint - strip trailing paths to get base URL
    baseUrl = customEndpoint
      .replace(/\/chat\/completions\/?$/i, '')
      .replace(/\/completions\/?$/i, '')
      .replace(/\/v1\/models\/?$/i, '')
      .replace(/\/v1\/?$/i, '')
      .replace(/\/+$/, '');
  } else if (provider === 'openai') {
    baseUrl = 'https://api.openai.com';
  }

  if (!baseUrl) {
    this.populateModelSelect([config.model || 'gpt-4o'], config.model);
    return;
  }

  const modelsUrl = `${baseUrl}/v1/models`;
  console.log('[Parchi] Fetching models from:', modelsUrl);

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('[Parchi] Failed to fetch models:', response.status, response.statusText);
      this.populateModelSelect([config.model || 'gpt-4o'], config.model);
      return;
    }

    const data = await response.json();
    console.log('[Parchi] Models response:', data);
    
    // Extract models, prioritize active ones
    const allModels = (data.data || []) as Array<{ id: string; active?: boolean }>;
    const activeModels = allModels
      .filter((m) => m.id && m.active === true)
      .map((m) => m.id)
      .sort((a, b) => a.localeCompare(b));
    
    const inactiveModels = allModels
      .filter((m) => m.id && m.active !== true)
      .map((m) => m.id)
      .sort((a, b) => a.localeCompare(b));
    
    // Show active models first, then inactive
    const models = [...activeModels, ...inactiveModels].filter(Boolean);
    
    console.log('[Parchi] Found models:', models.length, 'active:', activeModels.length);

    if (models.length > 0) {
      this.populateModelSelect(models, config.model);
    } else {
      this.populateModelSelect([config.model || 'gpt-4o'], config.model);
    }
  } catch (error) {
    console.error('[Parchi] Error fetching models:', error);
    this.populateModelSelect([config.model || 'gpt-4o'], config.model);
  }
};

(SidePanelUI.prototype as any).populateModelSelect = function populateModelSelect(
  models: string[],
  currentModel?: string,
) {
  // Try to get the select element - it might not be in this.elements if loaded dynamically
  let select = this.elements.modelSelect;
  if (!select) {
    select = document.getElementById('modelSelect') as HTMLSelectElement;
    if (select) {
      this.elements.modelSelect = select;
    }
  }
  
  if (!select) {
    console.error('[Parchi] modelSelect element not found!');
    return;
  }

  // Populate with profiles instead of just models
  // Each profile shows as: providerIcon profileName - model
  select.innerHTML = '';

  const configNames = Object.keys(this.configs);
  if (configNames.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No profiles';
    select.appendChild(option);
    return;
  }

  for (const name of configNames) {
    const config = this.configs[name];
    const option = document.createElement('option');
    option.value = name; // Use profile name as value
    
    // Format: icon provider/model (e.g., "🅒 anthropic/claude-sonnet")
    const providerIcon = this.getProviderIcon(config.provider);
    const modelShort = this.shortenModelName(config.model || 'no-model');
    option.textContent = `${providerIcon} ${config.provider}/${modelShort}`;
    
    if (name === this.currentConfig) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  
  console.log('[Parchi] Model select now has', select.options.length, 'profiles');
};

(SidePanelUI.prototype as any).shortenModelName = function shortenModelName(model: string): string {
  if (!model) return 'unknown';
  // Remove common prefixes
  const clean = model
    .replace(/^claude-/, '')
    .replace(/^gpt-/, '')
    .replace(/^gemini-/, '')
    .replace(/^kimi-/, '');
  // Truncate if still long
  if (clean.length <= 20) return clean;
  return clean.slice(0, 19) + '…';
};

(SidePanelUI.prototype as any).handleModelSelectChange = function handleModelSelectChange() {
  const select = this.elements.modelSelect;
  if (!select) return;

  const selectedProfile = select.value;
  if (!selectedProfile || !this.configs[selectedProfile]) return;

  // Switch to the selected profile
  this.setActiveConfig(selectedProfile);
  this.updateStatus(`Switched to ${this.configs[selectedProfile].provider}/${this.configs[selectedProfile].model}`, 'success');
};

(SidePanelUI.prototype as any).getProviderIcon = function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    anthropic: '🅒',
    openai: '🅞',
    google: '🅖',
    kimi: '🅚',
    custom: '⚙️',
  };
  return icons[provider] || '⚙️';
};
