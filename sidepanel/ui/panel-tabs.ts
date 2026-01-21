import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).handleFileSelection = async function handleFileSelection(event: Event) {
  const input = event.target as HTMLInputElement | null;
  if (!input) return;
  const files = Array.from(input.files || []) as File[];
  if (!files.length) return;

  const maxPerFile = 4000;
  for (const file of files) {
    try {
      const text = await file.text();
      const trimmed = text.length > maxPerFile ? text.slice(0, maxPerFile) + '\n… (truncated)' : text;
      const prefix = `\n\n[File: ${file.name}]\n`;
      this.elements.userInput.value += prefix + trimmed;
    } catch (e) {
      console.warn('Failed to read file', file.name, e);
    }
  }
  input.value = '';
  this.elements.userInput.focus();
};

(SidePanelUI.prototype as any).toggleTabSelector = async function toggleTabSelector() {
  const isHidden = this.elements.tabSelector.classList.contains('hidden');
  if (isHidden) {
    await this.loadTabs();
    this.elements.tabSelector.classList.remove('hidden');
  } else {
    this.closeTabSelector();
  }
};

(SidePanelUI.prototype as any).closeTabSelector = function closeTabSelector() {
  this.elements.tabSelector.classList.add('hidden');
};

(SidePanelUI.prototype as any).loadTabs = async function loadTabs() {
  const [tabs, groups] = await Promise.all([chrome.tabs.query({}), chrome.tabGroups.query({})]);
  this.tabGroupInfo = new Map(groups.map((group) => [group.id, group]));
  this.elements.tabList.innerHTML = '';

  const groupedTabs = new Map<number, chrome.tabs.Tab[]>();
  const ungroupedTabs: chrome.tabs.Tab[] = [];

  tabs
    .filter((tab) => typeof tab.id === 'number')
    .forEach((tab) => {
      if (tab.groupId !== undefined && tab.groupId >= 0) {
        if (!groupedTabs.has(tab.groupId)) groupedTabs.set(tab.groupId, []);
        const bucket = groupedTabs.get(tab.groupId);
        if (bucket) bucket.push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    });

  const renderGroup = (
    label: string,
    color: string,
    groupTabs: chrome.tabs.Tab[],
    groupId: string | number = 'ungrouped',
  ) => {
    if (!groupTabs.length) return;
    const section = document.createElement('div');
    section.className = 'tab-group';
    const allSelected = groupTabs.every((tab) => typeof tab.id === 'number' && this.selectedTabs.has(tab.id));
    section.innerHTML = `
        <div class="tab-group-header" style="--group-color: ${color}">
          <div class="tab-group-label">${this.escapeHtml(label)}</div>
          <button class="tab-group-toggle" type="button">${allSelected ? 'Clear' : 'Add all'}</button>
        </div>
      `;

    const toggleBtn = section.querySelector('.tab-group-toggle');
    toggleBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleGroupSelection(groupTabs, !allSelected);
    });

    groupTabs.forEach((tab) => {
      const tabId = tab.id;
      const isSelected = typeof tabId === 'number' && this.selectedTabs.has(tabId);
      const item = document.createElement('div');
      item.className = `tab-item${isSelected ? ' selected' : ''}`;
      item.innerHTML = `
          <div class="tab-item-checkbox"></div>
          <img class="tab-item-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'">
          <span class="tab-item-title">${this.escapeHtml(tab.title || 'Untitled')}</span>
        `;
      item.addEventListener('click', () => this.toggleTabSelection(tab, item));
      section.appendChild(item);
    });

    this.elements.tabList.appendChild(section);
  };

  groupedTabs.forEach((groupTabs, groupId) => {
    const group = this.tabGroupInfo.get(groupId);
    const label = group?.title || `Group ${groupId}`;
    const color = this.mapGroupColor(group?.color);
    renderGroup(label, color, groupTabs, groupId);
  });

  renderGroup('Ungrouped', 'var(--text-tertiary)', ungroupedTabs);
};

(SidePanelUI.prototype as any).toggleGroupSelection = function toggleGroupSelection(
  groupTabs: chrome.tabs.Tab[],
  shouldSelect: boolean,
) {
  groupTabs.forEach((tab) => {
    if (typeof tab.id !== 'number') return;
    if (shouldSelect) {
      this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
    } else {
      this.selectedTabs.delete(tab.id);
    }
  });
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};

(SidePanelUI.prototype as any).toggleTabSelection = function toggleTabSelection(
  tab: chrome.tabs.Tab,
  itemElement: HTMLElement,
) {
  if (typeof tab.id !== 'number') return;
  if (this.selectedTabs.has(tab.id)) {
    this.selectedTabs.delete(tab.id);
    itemElement.classList.remove('selected');
  } else {
    this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
    itemElement.classList.add('selected');
  }
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};

(SidePanelUI.prototype as any).buildSelectedTab = function buildSelectedTab(tab: chrome.tabs.Tab) {
  const group = this.tabGroupInfo.get(tab.groupId);
  const hasGroup = tab.groupId !== undefined && tab.groupId >= 0;
  return {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    windowId: tab.windowId,
    groupId: tab.groupId,
    groupTitle: hasGroup ? group?.title || `Group ${tab.groupId}` : 'Ungrouped',
    groupColor: hasGroup ? this.mapGroupColor(group?.color) : 'var(--text-tertiary)',
  };
};

(SidePanelUI.prototype as any).updateSelectedTabsBar = function updateSelectedTabsBar() {
  if (this.selectedTabs.size === 0) {
    this.elements.selectedTabsBar.classList.add('hidden');
    return;
  }

  this.elements.selectedTabsBar.classList.remove('hidden');
  this.elements.selectedTabsBar.innerHTML = '';
  const grouped = new Map<string, Array<any>>();
  this.selectedTabs.forEach((tab: any) => {
    const key = tab.groupId && tab.groupId >= 0 ? `group-${tab.groupId}` : 'ungrouped';
    if (!grouped.has(key)) grouped.set(key, []);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(tab);
  });

  grouped.forEach((tabs) => {
    const groupTitle = tabs[0]?.groupTitle || 'Ungrouped';
    const groupLabel = this.truncateText(groupTitle, 18) || 'Ungrouped';
    const groupColor = tabs[0]?.groupColor || 'var(--text-tertiary)';
    const groupWrap = document.createElement('div');
    groupWrap.className = 'selected-tabs-group';
    groupWrap.innerHTML = `
        <div class="selected-group-label" style="--group-color: ${groupColor}">
          <span>${this.escapeHtml(groupLabel)}</span>
          <span class="selected-group-count">${tabs.length}</span>
        </div>
        <div class="selected-tabs-chips"></div>
      `;

    const chipsRow = groupWrap.querySelector('.selected-tabs-chips');
    if (!chipsRow) {
      this.elements.selectedTabsBar.appendChild(groupWrap);
      return;
    }
    tabs.forEach((tab: any) => {
      const chip = document.createElement('div');
      chip.className = 'selected-tab-chip';
      chip.innerHTML = `
          <span>${this.escapeHtml(tab.title?.substring(0, 25) || 'Tab')}${tab.title?.length > 25 ? '...' : ''}</span>
          <button title="Remove">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;
      const removeBtn = chip.querySelector('button');
      removeBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        this.selectedTabs.delete(tab.id);
        this.updateSelectedTabsBar();
        this.updateTabSelectorButton();
        this.loadTabs();
      });
      chipsRow.appendChild(chip);
    });

    this.elements.selectedTabsBar.appendChild(groupWrap);
  });
};

(SidePanelUI.prototype as any).updateTabSelectorButton = function updateTabSelectorButton() {
  if (this.selectedTabs.size > 0) {
    this.elements.tabSelectorBtn.classList.add('has-selection');
  } else {
    this.elements.tabSelectorBtn.classList.remove('has-selection');
  }
};

(SidePanelUI.prototype as any).mapGroupColor = function mapGroupColor(colorName: string) {
  const palette: Record<string, string> = {
    grey: '#9aa0a6',
    blue: '#4c8bf5',
    red: '#ea4335',
    yellow: '#fbbc04',
    green: '#34a853',
    pink: '#f06292',
    purple: '#a142f4',
    cyan: '#24c1e0',
    orange: '#f29900',
  };
  return palette[colorName] || 'var(--text-tertiary)';
};

(SidePanelUI.prototype as any).getSelectedTabsContext = function getSelectedTabsContext() {
  if (this.selectedTabs.size === 0) return '';

  let context = '\n\n[Context from selected tabs:]\n';
  this.selectedTabs.forEach((tab: any) => {
    const tabTitle = tab.title || 'Untitled';
    context += `- Tab [${tab.id}] "${tabTitle}": ${tab.url}\n`;
  });
  return context;
};
