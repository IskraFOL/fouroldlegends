/**
 * Four Old Legends — Cloudflare Web Analytics.
 *
 * RU: после добавления сайта в Cloudflare Web Analytics впишите
 * публичный Site Token ниже. Пока он пуст, отправки аналитики нет.
 * Сайт, DNS, GitHub Pages и собранный React не меняются.
 *
 * Hostname сайта в Cloudflare: iskrafol.github.io
 * Вставлять нужно именно Site Token, НЕ API token или пароль!
 */
(() => {
  'use strict';

  const siteToken = ''; // RU: 32-символьный Site Token Cloudflare Web Analytics.

  if (!/^[a-f0-9]{32}$/i.test(siteToken)) return;

  const beacon = document.createElement('script');
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.defer = true;
  beacon.setAttribute('data-cf-beacon', JSON.stringify({
    token: siteToken,
    spa: false, // RU: разделы сайта переключаются через #hash.
  }));
  document.head.appendChild(beacon);
})();
