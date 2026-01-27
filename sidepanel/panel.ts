import './ui/panel-modules.js';
import { loadPanelLayout } from './ui/layout-loader.js';
import { SidePanelUI } from './ui/panel-ui.js';

const init = async () => {
  await loadPanelLayout();
  const ui = new SidePanelUI();
  // Expose for debugging
  (window as any).sidePanelUI = ui;
};

void init();
