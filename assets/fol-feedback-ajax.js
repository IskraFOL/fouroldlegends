/**
 * Four Old Legends — отправка обратной связи без перехода с сайта.
 * RU: перехватываем только форму FormSubmit и используем
 * документированный AJAX-метод сервиса. При ошибке показываем
 * резервную ручную отправку без ложного сообщения об успехе.
 */
(() => {
  'use strict';

  const FORM_PREFIX = 'https://formsubmit.co/';
  const messages = {
    ru: {
      sending: 'Отправляем сообщение…',
      success: 'FormSubmit подтвердил приём сообщения. Спасибо! Доставка письма в почтовый ящик зависит от почтового сервиса.',
      error: 'Сервис не подтвердил отправку. Текст сохранён. Проверьте соединение или воспользуйтесь резервной отправкой.',
      fallback: 'Открыть резервную отправку в новой вкладке',
      hint: 'Если письмо всё-таки дошло, повторная отправка может создать дубликат.',
    },
    en: {
      sending: 'Sending your message…',
      success: 'FormSubmit accepted your message. Thank you! Delivery to the recipient inbox depends on the mail service.',
      error: 'Submission could not be confirmed. Your text is preserved. Check your connection or use the fallback option.',
      fallback: 'Open fallback submission in a new tab',
      hint: 'If the message did arrive, resending could create a duplicate.',
    },
  };

  const pending = new WeakSet();

  function labels() {
    return (document.documentElement.lang || 'ru').toLowerCase().startsWith('en')
      ? messages.en : messages.ru;
  }

  function showStatus(form, kind, message, fallbackAllowed) {
    let region = form.querySelector('[data-fol-feedback-status]');
    if (!region) {
      region = document.createElement('div');
      region.setAttribute('data-fol-feedback-status', '');
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      form.appendChild(region);
    }

    region.className = 'fol-feedback-status fol-feedback-status--' + kind;
    region.replaceChildren();

    const line = document.createElement('p');
    line.textContent = message;
    region.appendChild(line);

    if (fallbackAllowed) {
      const hint = document.createElement('p');
      hint.className = 'fol-feedback-status__hint';
      hint.textContent = labels().hint;
      region.appendChild(hint);

      const fallback = document.createElement('button');
      fallback.type = 'button';
      fallback.className = 'fol-feedback-fallback';
      fallback.textContent = labels().fallback;
      fallback.addEventListener('click', () => {
        // RU: переход только по явному клику, никакого автоповтора.
        form.setAttribute('target', '_blank');
        HTMLFormElement.prototype.submit.call(form);
      }, { once: true });
      region.appendChild(fallback);
    }
  }

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const action = form.getAttribute('action') || '';
    // RU: не трогаем другие формы, перехватываем лишь нашу обратную связь.
    if (!action.startsWith(FORM_PREFIX) ||
        action.startsWith(FORM_PREFIX + 'ajax/') ||
        !form.querySelector('[name="topic"]') ||
        !form.querySelector('[name="message"]')) return;

    event.preventDefault();
    event.stopPropagation();
    if (pending.has(form) || !form.reportValidity()) return;

    pending.add(form);
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    const lang = labels();
    showStatus(form, 'sending', lang.sending, false);

    // RU: сохраняем служебные поля FormSubmit и не отправляем
    // данные формы в сервис статистики посещений.
    const fields = Object.fromEntries(new FormData(form).entries());
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        FORM_PREFIX + 'ajax/' + action.slice(FORM_PREFIX.length),
        {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(fields),
          signal: controller.signal,
        }
      );
      const payload = await response.json();
      // RU: HTTP 200 без подтверждения FormSubmit НЕ считаем успехом.
      const accepted = payload &&
        (payload.success === true || payload.success === 'true');
      if (!response.ok || !accepted) throw new Error('not-accepted');

      form.reset();
      showStatus(form, 'success', lang.success, false);
    } catch (_error) {
      // RU: сообщение не удаляем; автоповтор вызвал бы дубликаты.
      showStatus(form, 'error', lang.error, true);
    } finally {
      window.clearTimeout(timeoutId);
      if (button) button.disabled = false;
      pending.delete(form);
    }
  }, true);
})();
