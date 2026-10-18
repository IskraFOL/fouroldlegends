/* Four Old Legends — компактная живая статистика Modrinth.
 * Встроена в первый экран без дополнительного сервера/зависимостей.
 * Не изменяет React-разделы и не подменяет историческое достижение 1000.
 */
(() => {
  'use strict';

  const MODRINTH_ID = 'hIgLvUBa';
  const MODRINTH_PAGE = 'https://modrinth.com/mod/four-old-legends';
  const API = 'https://api.modrinth.com/v2/project/' + MODRINTH_ID;
  const REFRESH_MS = 15 * 60 * 1000;
  const TIMEOUT_MS = 10 * 1000;
  const SLOT_ID = 'fol-modrinth-live';

  let currentState = 'loading';
  let downloads = null;
  let lastRequestAt = 0;
  let controller = null;
  let timer = null;
  let alive = true;

  const phrases = {
    ru: { summary: 'Скачивания Four Old Legends на Modrinth',
      label: 'СКАЧИВАНИЙ НА MODRINTH', loading: 'Загрузка…',
      unavailable: 'Статистика недоступна', link: 'Открыть Modrinth' },
    en: { summary: 'Four Old Legends downloads on Modrinth',
      label: 'DOWNLOADS ON MODRINTH', loading: 'Loading…',
      unavailable: 'Statistics unavailable', link: 'Open Modrinth' },
  };

  function language() {
    return document.documentElement.lang === 'en' ? 'en' : 'ru';
  }

  function render() {
    const slot = document.getElementById(SLOT_ID);
    if (!slot) return;
    const lang = language();
    const t = phrases[lang];
    slot.setAttribute('aria-label', t.summary);
    slot.querySelector('[data-fol-label]').textContent = t.label;
    const value = slot.querySelector('[data-fol-value]');
    value.textContent = currentState === 'ready'
      ? downloads.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US')
      : currentState === 'loading' ? t.loading : t.unavailable;
    slot.querySelector('[data-fol-link]').setAttribute('aria-label', t.link);
  }

  function mount() {
    const title = document.getElementById('hero-title');
    if (!title || !title.parentNode) return;
    if (!document.getElementById(SLOT_ID)) {
      const slot = document.createElement('div');
      slot.id = SLOT_ID;
      slot.className = 'fol-modrinth-live';
      slot.setAttribute('role', 'group');

      const dot = document.createElement('span');
      dot.className = 'fol-modrinth-live__dot';
      dot.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'fol-modrinth-live__label';
      label.setAttribute('data-fol-label', '');

      const value = document.createElement('strong');
      value.className = 'fol-modrinth-live__value';
      value.setAttribute('data-fol-value', '');
      value.setAttribute('role', 'status');
      value.setAttribute('aria-live', 'polite');

      const link = document.createElement('a');
      link.className = 'fol-modrinth-live__link';
      link.href = MODRINTH_PAGE;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '↗';
      link.setAttribute('data-fol-link', '');

      slot.append(dot, label, value, link);
      title.parentNode.insertBefore(slot, title);
    }
    render();
  }

  async function refresh() {
    if (!alive) return;
    if (controller) controller.abort();
    const request = new AbortController();
    controller = request;
    lastRequestAt = Date.now();
    const timeout = window.setTimeout(() => request.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(API, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: request.signal,
      });
      if (!response.ok) throw new Error('Modrinth HTTP ' + response.status);
      const data = await response.json();
      if (!data || data.id !== MODRINTH_ID ||
          !Number.isSafeInteger(data.downloads) || data.downloads < 0) {
        throw new Error('Invalid Modrinth project statistics');
      }
      if (!alive || request !== controller) return;
      downloads = data.downloads;
      currentState = 'ready';
    } catch (_) {
      if (!alive || request !== controller) return;
      downloads = null; // Не показывать старые данные как текущие.
      currentState = 'unavailable';
    } finally {
      window.clearTimeout(timeout);
      if (controller === request) controller = null;
      render();
    }
  }

  function setup() {
    mount();
    const root = document.getElementById('root');
    // React размонтирует домашнюю страницу при переходе между hash-разделами.
    // Возвращаем виджет при возврате на главную без второго сетевого запроса.
    const observer = new MutationObserver(() => {
      if (!document.getElementById(SLOT_ID)) mount();
    });
    observer.observe(root || document.body, { childList: true, subtree: true });

    const languageObserver = new MutationObserver(render);
    languageObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ['lang'],
    });

    refresh();
    timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' &&
          Date.now() - lastRequestAt >= REFRESH_MS) refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else setup();
})();
