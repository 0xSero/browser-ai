import type { SidePanelElements } from './panel-elements.js';

export type RightPanelName = 'history' | 'settings' | 'account' | null;
export type NavName = 'chat' | 'history' | 'settings' | 'account';

const PANEL_SELECTOR = '.right-panel-content';

export const setSidebarOpen = (elements: SidePanelElements, open: boolean) => {
  elements.sidebar?.classList.toggle('closed', !open);
};

export const showRightPanel = (elements: SidePanelElements, panelName: RightPanelName) => {
  const container = elements.rightPanelPanels ?? elements.rightPanel;
  if (!container) return;
  const panels = container.querySelectorAll(PANEL_SELECTOR);
  panels.forEach((panel) => (panel as HTMLElement).classList.add('hidden'));

  if (!panelName) return;
  const targetPanel = container.querySelector(`${PANEL_SELECTOR}[data-panel="${panelName}"]`) as HTMLElement | null;
  targetPanel?.classList.remove('hidden');
};

export const updateNavActive = (elements: SidePanelElements, navName: NavName) => {
  elements.navChatBtn?.classList.remove('active');
  elements.navHistoryBtn?.classList.remove('active');
  elements.navSettingsBtn?.classList.remove('active');
  elements.navAccountBtn?.classList.remove('active');

  switch (navName) {
    case 'chat':
      elements.navChatBtn?.classList.add('active');
      break;
    case 'history':
      elements.navHistoryBtn?.classList.add('active');
      break;
    case 'settings':
      elements.navSettingsBtn?.classList.add('active');
      break;
    case 'account':
      elements.navAccountBtn?.classList.add('active');
      break;
  }
};

type NavigationHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onChat: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onAccount: () => void;
};

export const bindSidebarNavigation = (elements: SidePanelElements, handlers: NavigationHandlers) => {
  elements.openSidebarBtn?.addEventListener('click', () => {
    const sidebar = elements.sidebar;
    if (!sidebar) {
      handlers.onOpen();
      return;
    }
    if (sidebar.classList.contains('closed')) {
      handlers.onOpen();
    } else {
      handlers.onClose();
    }
  });
  elements.closeSidebarBtn?.addEventListener('click', handlers.onClose);
  elements.navChatBtn?.addEventListener('click', handlers.onChat);
  elements.navHistoryBtn?.addEventListener('click', handlers.onHistory);
  elements.navSettingsBtn?.addEventListener('click', handlers.onSettings);
  elements.navAccountBtn?.addEventListener('click', handlers.onAccount);
};
