/**
 * Four Old Legends — обратная связь без перехода на FormSubmit.
 *
 * RU: всегда отменяем стандартный HTML POST. Получателю отправляем
 * JSON только через официальный FormSubmit AJAX. При ошибке никакого
 * автоматического перенаправления на CAPTCHA или повторного POST:
 * введённый игроком текст остаётся на сайте для копирования/почты.
 */
(() => {
  'use strict';

  const FORM_PREFIX = 'https://formsubmit.co/';
  const TIMEOUT_MS = 15000;
  const busyForms = new WeakSet();

  const translations = {
    ru: {
      sending: 'Отправляем сообщение…',
      success: 'Сообщение принято FormSubmit! Спасибо за обращение. Доставка письма на почту автора зависит от почтового сервиса.',
      error: 'Не удалось подтвердить отправку. Сообщение НЕ считается отправленным. Мы сохранили введённый текст: можно попробовать позже или связаться с автором напрямую.',
      copy: 'СКОПИРОВАТЬ СООБЩЕНИЕ',
      copied: 'Текст скопирован. Отправь его автору по почте, если форма недоступна.',
      select: 'Скопируй текст из поля ниже вручную.',
      direct: 'НАПИСАТЬ НАПРЯМУЮ ПО ПОЧТЕ',
      draft: 'Копия сообщения для отправки другим способом',
      name: 'Имя',
      email: 'Email для ответа',
      topic: 'Тема',
      message: 'Сообщение',
    },
    en: {
      sending: 'Sending your message…',
      success: 'FormSubmit accepted your message. Thank you! Delivery to the author’s inbox depends on the mail provider.',
      error: 'Submission could not be confirmed. Your message was NOT confirmed as sent. The text is preserved so you can try again later or contact the author directly.',
      copy: 'COPY MESSAGE',
      copied: 'Text copied. Email it to the author if the form is unavailable.',
      select: 'Select and copy the text below manually.',
      direct: 'CONTACT THE AUTHOR BY EMAIL',
      draft: 'Copy of your message for alternative delivery',
      name: 'Name',
      email: 'Reply email',
      topic: 'Subject',
      message: 'Message',
    },
  };

  function labels() {
    return document.documentElement.lang.toLowerCase().startsWith('en')
      ? translations.en : translations.ru;
  }

  function statusNode(form, kind, message) {
    let node = form.querySelector('[data-fol-feedback-status]');
    if (!node) {
      node = document.createElement('div');
      node.setAttribute('data-fol-feedback-status', '');
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-atomic', 'true');
      form.appendChild(node);
    }

    node.className = 'fol-feedback-status fol-feedback-status--' + kind;
    node.replaceChildren();
    const line = document.createElement('p');
    line.textContent = message;
    node.appendChild(line);
    return node;
  }

  function draftText(form, t) {
    const values = new FormData(form);
    return [
      t.name + ': ' + (values.get('name') || ''),
      t.email + ': ' + (values.get('email') || ''),
      t.topic + ': ' + (values.get('topic') || ''),
      '',
      t.message + ':',
      values.get('message') || '',
    ].join('\n');
  }

  function showAlternatives(form, region, t) {
    const draft = draftText(form, t);
    const field = document.createElement('textarea');
    field.className = 'fol-feedback-draft';
    field.setAttribute('aria-label', t.draft);
    field.setAttribute('readonly', '');
    field.rows = 7;
    field.value = draft;
    region.appendChild(field);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'fol-feedback-fallback';
    copy.textContent = t.copy;
    copy.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          throw new Error('Clipboard API unavailable');
        }
        await navigator.clipboard.writeText(draft);
        copy.textContent = t.copied;
      } catch (_error) {
        field.focus();
        field.select();
        copy.textContent = t.select;
      }
    });
    region.appendChild(copy);

    // RU: прямая ссылка в почтовое приложение не вызывает FormSubmit
    // и никогда не отправляет сообщение автоматически.
    const destination = new URL(form.action).pathname.slice(1);
    if (destination && destination.includes('@')) {
      const direct = document.createElement('a');
      direct.className = 'fol-feedback-fallback fol-feedback-direct';
      const subject = new FormData(form).get('_subject') || 'Four Old Legends — feedback';
      direct.href = 'mailto:' + destination +
        '?subject=' + encodeURIComponent(String(subject)) +
        '&body=' + encodeURIComponent(draft);
      direct.textContent = t.direct;
      region.appendChild(direct);
    }
  }

  // RU: перехватываем событие раньше делегированного React onSubmit,
  // чтобы не срабатывал исходный HTML target и не открывалась CAPTCHA.
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const action = form.getAttribute('action') || '';
    if (!action.startsWith(FORM_PREFIX) ||
        action.startsWith(FORM_PREFIX + 'ajax/') ||
        !form.querySelector('[name="topic"]') ||
        !form.querySelector('[name="message"]')) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // RU: защита от случайного возврата к target="_blank", если
    // браузер ещё держит в кэше старый React-бандл.
    form.removeAttribute('target');
    if (busyForms.has(form) || !form.reportValidity()) return;

    busyForms.add(form);
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    const t = labels();
    statusNode(form, 'sending', t.sending);

    const fields = Object.fromEntries(new FormData(form).entries());
    const aborter = new AbortController();
    const timeout = window.setTimeout(() => aborter.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(FORM_PREFIX + 'ajax/' +
          action.slice(FORM_PREFIX.length), {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(fields),
        signal: aborter.signal,
      });

      const body = await response.json();
      const accepted = body &&
        (body.success === true || body.success === 'true');
      if (!response.ok || !accepted) throw new Error('FormSubmit rejected request');

      form.reset();
      statusNode(form, 'success', t.success);
    } catch (_error) {
      const region = statusNode(form, 'error', t.error);
      showAlternatives(form, region, t);
    } finally {
      window.clearTimeout(timeout);
      if (submit) submit.disabled = false;
      busyForms.delete(form);
    }
  }, true);

  // RU: индикатор версии для проверки в DevTools без личных данных.
  document.documentElement.dataset.folFeedback = 'ajax-v2';
})();
