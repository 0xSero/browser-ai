const loadTemplate = async (path: string) => {
  const url = chrome.runtime.getURL(`sidepanel/templates/${path}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load template: ${path}`);
  }
  return response.text();
};

const replaceWithHtml = (root: HTMLElement, selector: string, html: string) => {
  const target = root.querySelector(selector);
  if (!target) return;
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const element = template.content.firstElementChild;
  if (element) {
    target.replaceWith(element);
  }
};

export const loadPanelLayout = async () => {
  const appRoot = document.getElementById('appRoot');
  if (!appRoot) return;

  const [
    sidebarShell,
    mainContent,
    historyPanel,
    settingsPanel,
    settingsGeneral,
    settingsProfiles,
    accountPanel,
    accountAuth,
    accountBilling,
    accountMain,
    tabSelector,
  ] = await Promise.all([
    loadTemplate('sidebar-shell.html'),
    loadTemplate('main.html'),
    loadTemplate('panels/history.html'),
    loadTemplate('panels/settings.html'),
    loadTemplate('panels/settings-general.html'),
    loadTemplate('panels/settings-profiles.html'),
    loadTemplate('panels/account.html'),
    loadTemplate('panels/account-auth.html'),
    loadTemplate('panels/account-billing.html'),
    loadTemplate('panels/account-main.html'),
    loadTemplate('tab-selector.html'),
  ]);

  appRoot.className = 'app-container';
  appRoot.innerHTML = '';
  const appContainer = appRoot as HTMLElement;

  appContainer.insertAdjacentHTML('beforeend', sidebarShell.trim());
  appContainer.insertAdjacentHTML('beforeend', mainContent.trim());

  const rightPanels = appContainer.querySelector('#rightPanelPanels') as HTMLElement | null;
  rightPanels?.insertAdjacentHTML('beforeend', (historyPanel + settingsPanel + accountPanel).trim());

  replaceWithHtml(appContainer, '#settingsTabGeneral', settingsGeneral);
  replaceWithHtml(appContainer, '#settingsTabProfiles', settingsProfiles);
  replaceWithHtml(appContainer, '#authPanel', accountAuth);
  replaceWithHtml(appContainer, '#billingPanel', accountBilling);
  replaceWithHtml(appContainer, '#accountPanel', accountMain);

  const modalRoot = document.getElementById('modalRoot');
  if (modalRoot) {
    modalRoot.innerHTML = tabSelector;
  }
};
