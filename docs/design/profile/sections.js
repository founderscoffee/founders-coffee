import { languages } from './icons.js';

const sectionHead = (title, note) =>
  `<div class="section-head"><h2 class="section-title">${title}</h2>${note ? `<p class="section-note">${note}</p>` : ''}</div>`;
const row = (title, note, action) =>
  `<div class="settings-row"><div><h3>${title}</h3><p>${note}</p></div>${action}</div>`;
const action = (label, kind = 'account') =>
  `<button type="button" class="btn btn-outline" data-demo="${kind}">${label}</button>`;
const toggle = (label, key, state) =>
  `<input class="toggle toggle-primary" type="checkbox" aria-label="${label}" data-preference="${key}" ${state[key] ? 'checked' : ''}/>`;

export const preferences = (copy, state, locale) => `
  <section class="panel">
    ${sectionHead(copy.languageTitle, copy.languageNote)}
    <div class="chips">${Object.entries(languages)
      .map(
        ([id, name]) =>
          `<button class="chip" type="button" data-locale="${id}" aria-pressed="${id === locale}">${name}</button>`,
      )
      .join('')}</div>
  </section>
  <section class="panel">
    ${sectionHead(copy.notifications)}
    ${row(copy.push, copy.pushNote, `<span class="tag whitespace-normal! max-w-36">${copy.pushState}</span>`)}
    ${row(copy.reminders, copy.remindersNote, toggle(copy.reminders, 'reminders', state))}
    ${row(copy.hostUpdates, copy.hostUpdatesNote, toggle(copy.hostUpdates, 'hostUpdates', state))}
    ${row(copy.sms, copy.smsNote, action(copy.add))}
  </section>`;

export const account = (copy) => `
  <section class="panel">
    ${sectionHead(copy.privateSpace)}
    ${row(copy.email, `l•••@example.com · ${copy.verified}`, action(copy.change))}
    ${row(copy.phone, copy.phoneEmpty, action(copy.add))}
    ${row(copy.signIn, copy.signInNote, action(copy.manage))}
  </section>
  <section class="panel">
    ${sectionHead(copy.devices)}
    ${row(copy.device, copy.deviceNote, action(copy.manage))}
  </section>
  <section class="panel">
    ${sectionHead(copy.data)}
    ${row(copy.export, copy.exportNote, action(copy.export))}
    <div class="danger-row">${row(copy.delete, copy.deleteNote, action(copy.delete, 'delete'))}</div>
  </section>`;

export const activity = (copy, logo) => `
  <section class="panel empty-panel">
    <img class="empty-mark" src="${logo}" alt="" />
    <h2>${copy.emptyTitle}</h2><p>${copy.emptyNote}</p>
    <button class="btn btn-primary" type="button" data-demo="activity">${copy.emptyAction}</button>
  </section>`;
