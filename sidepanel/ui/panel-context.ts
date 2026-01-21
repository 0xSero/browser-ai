import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).updateContextUsage = function updateContextUsage(actualTokens: number | null = null) {
  let approxTokens;

  if (actualTokens !== null && actualTokens > 0) {
    this.sessionTokensUsed = Math.max(this.sessionTokensUsed || 0, actualTokens);
    approxTokens = this.sessionTokensUsed;
  } else {
    const joined = this.contextHistory
      .map((msg: any) => {
        if (!msg) return '';
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
          return msg.content
            .map((p: any) => {
              if (typeof p === 'string') return p;
              if (p?.text) return p.text;
              if (p?.content) return JSON.stringify(p.content);
              if (p?.output) {
                const output = p.output?.value ?? p.output;
                if (typeof output === 'string') return output;
                try {
                  return JSON.stringify(output);
                } catch {
                  return String(output);
                }
              }
              return '';
            })
            .join('');
        }
        return '';
      })
      .join('\n');
    const chars = joined.length;
    const baseTokens = this.estimateBaseContextTokens();
    const estimated = baseTokens + Math.ceil(chars / 4);
    approxTokens = Math.max(estimated, this.sessionTokensUsed || 0);
  }

  const maxContextTokens = this.getConfiguredContextLimit();
  const percent = Math.min(100, Math.round((approxTokens / maxContextTokens) * 100));
  this.contextUsage = { approxTokens, maxContextTokens, percent };
  this.updateActivityState();
};

(SidePanelUI.prototype as any).getConfiguredContextLimit = function getConfiguredContextLimit() {
  const active = this.configs[this.currentConfig] || {};
  const configured = active.contextLimit || Number.parseInt(this.elements.contextLimit?.value) || 200000;
  return configured;
};

(SidePanelUI.prototype as any).estimateBaseContextTokens = function estimateBaseContextTokens() {
  const active = this.configs[this.currentConfig] || {};
  const prompt = active.systemPrompt || this.getDefaultSystemPrompt();
  const promptTokens = Math.ceil((prompt?.length || 0) / 4);
  const toolBudget = 1200;
  return promptTokens + toolBudget;
};
