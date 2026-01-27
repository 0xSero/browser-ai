import type { SidePanelElements } from './panel-elements.js';

export type RightPanelName = 'history' | 'settings' | 'account' | null;
export type NavName = 'chat' | 'history' | 'settings' | 'account';

const PANEL_SELECTOR = '.right-panel-content';

export const setSidebarOpen = (elements: SidePanelElements, open: boolean) => {
  elements.sidebar?.classList.toggle('closed', !open);
};

export const showRightPanel = (elements: SidePanelElements, panelName: RightPanelName) => {
  const container = elements.rightPanelPanels ?? elements.rightPanel;
  if (!container) {
    console.log('[Navigation] showRightPanel: no container found', {
      rightPanelPanels: elements.rightPanelPanels,
      rightPanel: elements.rightPanel
    });
    return;
  }

  // Hide all panels
  const panels = container.querySelectorAll(PANEL_SELECTOR);
  console.log('[Navigation] showRightPanel: found', panels.length, 'panels');
  panels.forEach((panel) => (panel as HTMLElement).classList.add('hidden'));

  if (!panelName) return;

  // Show the target panel
  const targetPanel = container.querySelector(`${PANEL_SELECTOR}[data-panel="${panelName}"]`) as HTMLElement | null;
  if (targetPanel) {
    targetPanel?.classList.remove('hidden');
    console.log('[Navigation] showRightPanel: showed', panelName);
  } else {
    console.log('[Navigation] showRightPanel: target panel not found for', panelName);
    // Try searching in rightPanel directly as fallback
    if (elements.rightPanel) {
      const fallbackPanel = elements.rightPanel.querySelector(`${PANEL_SELECTOR}[data-panel="${panelName}"]`) as HTMLElement | null;
      if (fallbackPanel) {
        fallbackPanel.classList.remove('hidden');
        console.log('[Navigation] showRightPanel: showed', panelName, '(via fallback)');
      }
    }
  }
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
  console.log('[Navigation] Binding sidebar navigation elements checks:', {
    openSidebarBtn: !!elements.openSidebarBtn,
    closeSidebarBtn: !!elements.closeSidebarBtn,
    navChatBtn: !!elements.navChatBtn,
    navHistoryBtn: !!elements.navHistoryBtn,
    navSettingsBtn: !!elements.navSettingsBtn,
    navAccountBtn: !!elements.navAccountBtn,
    rightPanelPanels: !!elements.rightPanelPanels,
    rightPanel: !!elements.rightPanel
  });

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
  
  // Bind nav buttons
  elements.navChatBtn?.addEventListener('click', handlers.onChat);
  elements.navHistoryBtn?.addEventListener('click', () => {
    console.log('[Navigation] navHistoryBtn clicked!');
    handlers.onHistory();
  });
  elements.navSettingsBtn?.addEventListener('click', handlers.onSettings);
  elements.navAccountBtn?.addEventListener('click', handlers.onAccount);
};