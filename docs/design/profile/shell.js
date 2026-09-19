import logo from '../../../apps/ui/public/branding/pwa-logo.png';

import { icon, languages } from './icons.js';
import { profileForm, publicCard } from './profile.js';
import { account, activity, preferences } from './sections.js';

export const shell = (copy, state, locale, page) => {
  const titles = {
    profile: copy.title,
    activity: copy.activityTitle,
    preferences: copy.preferencesTitle,
    account: copy.security,
  };
  const notes = {
    profile: copy.subtitle,
    activity: copy.activityNote,
    preferences: copy.preferencesNote,
    account: copy.securityNote,
  };
  const body =
    page === 'profile'
      ? profileForm(copy, state)
      : page === 'account'
        ? account(copy)
        : page === 'preferences'
          ? preferences(copy, state, locale)
          : activity(copy, logo);
  return `
    <a class="skip" href="#profile-main">${copy.skip}</a>
    <div class="study">${copy.study}</div>
    <header class="masthead"><div class="masthead-inner">
      <div class="brand"><img src="${logo}" alt="" /><span>Founders Coffee</span></div>
      <p class="masthead-note">${copy.community}</p>
      <select class="select locale" id="locale" aria-label="${copy.locale}">${Object.entries(
        languages,
      )
        .map(
          ([id, name]) =>
            `<option value="${id}" ${locale === id ? 'selected' : ''}>${name}</option>`,
        )
        .join('')}</select>
    </div></header>
    <div class="layout">
      <aside class="sidebar"><p class="kicker">Founders Coffee</p>
        <nav aria-label="${copy.navLabel}">${['profile', 'activity', 'preferences', 'account'].map((id) => `<button type="button" class="nav-item" data-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(id)}${copy[id]}</button>`).join('')}</nav>
        <div class="sidebar-note">${icon('account')}<strong>${copy.privateSpace}</strong><p>${copy.privateNote}</p></div>
      </aside>
      <main id="profile-main" tabindex="-1">
        <div class="heading"><p class="kicker">${copy.eyebrow}</p><h1>${titles[page]}</h1><p>${notes[page]}</p>
          ${page === 'profile' ? `<button type="button" class="btn btn-outline mobile-preview" data-preview>${icon('eye')}${copy.previewButton}</button>` : ''}
        </div>
        <div class="${page === 'profile' ? 'content-grid' : ''}">
          <form id="profile-form" class="editor" novalidate>${body}</form>
          ${page === 'profile' ? `<aside class="preview-column"><div class="preview-header"><h2>${copy.preview}</h2><p>${copy.previewHint}</p><p>${copy.draftPreview}</p></div><div id="public-preview">${publicCard(copy, state)}</div><p class="hint mt-3">${copy.previewHelp}</p><div class="privacy-note">${icon('account')}<h3>${copy.privacyTitle}</h3><p>${copy.privacyText}</p></div></aside>` : ''}
        </div>
        ${page === 'profile' || page === 'preferences' ? `<div class="foot"><p class="save-feedback" id="save-status" role="status">${copy.saved}</p><div class="save-actions"><button type="button" class="btn btn-ghost" id="discard" disabled>${copy.discard}</button><button type="submit" form="profile-form" class="btn btn-primary" id="save" disabled>${copy.save}</button></div></div>` : '<div class="h-12"></div>'}
      </main>
    </div>
    <dialog class="modal" id="dialog" aria-labelledby="dialog-title"><div class="modal-box"><h2 id="dialog-title"></h2><div id="dialog-content"></div><div class="modal-action"><form method="dialog"><button class="btn btn-primary">${copy.close}</button></form></div></div></dialog>
    <div id="toast" role="status" class="toast-message" hidden></div>`;
};
