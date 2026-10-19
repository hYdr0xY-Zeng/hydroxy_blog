const navigation = document.querySelector<HTMLElement>('[data-admin-tabs]');
const workspace = document.querySelector<HTMLElement>('[data-admin-workspace]');

if (navigation && workspace) {
  const tabs = [...navigation.querySelectorAll<HTMLAnchorElement>('[data-admin-tab]')];
  const panels = [...workspace.querySelectorAll<HTMLElement>('[data-admin-panel]')];
  const activate = () => {
    const selected = tabs.find((tab) => tab.hash === window.location.hash) ?? tabs[0];
    tabs.forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab === selected));
      tab.tabIndex = tab === selected ? 0 : -1;
    });
    const focusWasInHiddenPanel = panels.some((panel) => `#${panel.id}` !== selected.hash && panel.contains(document.activeElement));
    panels.forEach((panel) => { panel.hidden = `#${panel.id}` !== selected.hash; });
    if (focusWasInHiddenPanel) selected.focus({ preventScroll: true });
  };
  navigation.setAttribute('role', 'tablist');
  tabs.forEach((tab) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', tab.hash.slice(1));
    tab.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      if (window.location.hash !== tab.hash) window.history.pushState(null, '', tab.hash);
      activate();
    });
    tab.addEventListener('keydown', (event) => {
      let index = tabs.indexOf(tab);
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else if (event.key === ' ') { event.preventDefault(); tab.click(); return; }
      else return;
      event.preventDefault();
      tabs[index].focus();
      tabs[index].click();
    });
  });
  panels.forEach((panel) => {
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${panel.id}`);
    panel.tabIndex = 0;
  });
  window.addEventListener('hashchange', activate);
  window.addEventListener('popstate', activate);
  activate();
}
