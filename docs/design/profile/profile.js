import { escapeHtml, languages } from './icons.js';

const publication = (key, copy, state) => `
  <div class="publication">
    <span data-visibility="${key}">${state.visible[key] ? copy.public : copy.private}</span>
    <label><input class="toggle toggle-primary toggle-sm" type="checkbox" data-publish="${key}" ${state.visible[key] ? 'checked' : ''} aria-label="${copy.publish}: ${copy[key] ?? copy.photo}" />${copy.publish}</label>
  </div>`;

const heading = (title, note) => `
  <div class="section-head"><h2 class="section-title">${title}</h2><p class="section-note">${note}</p></div>`;

export const avatar = (state, isPublic = false) =>
  state.photo && (!isPublic || state.visible.photo)
    ? `<img src="${escapeHtml(state.photo)}" alt="" />`
    : escapeHtml(Array.from(state.name.trim())[0] || 'L');

export const profileForm = (copy, state) => `
  <section class="panel">
    ${heading(copy.basics, copy.basicsNote)}
    <div class="photo-row">
      <div class="avatar-disc" id="owner-avatar">${avatar(state)}</div>
      <div class="photo-copy"><h3 class="text-sm font-medium">${copy.photo}</h3><p>${copy.photoNote}</p>
        <button class="btn btn-outline" type="button" id="upload">${copy.upload}</button>
        <button class="btn btn-ghost" type="button" id="remove-photo" ${state.photo ? '' : 'hidden'}>${copy.remove}</button>
        <input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden />
        <small>${copy.photoLimit}</small>${publication('photo', copy, state)}
      </div>
    </div>
    <div class="field">
      <div class="label-line"><label for="name">${copy.name}</label><span class="tag">${copy.public}</span></div>
      <input class="input" id="name" name="name" value="${escapeHtml(state.name)}" maxlength="80" required dir="auto" aria-describedby="name-hint name-error" />
      <p class="hint" id="name-hint">${copy.nameHint}</p><p class="error" id="name-error" hidden>${copy.nameError}</p>
    </div>
    <div class="field">
      <div class="label-line"><label for="bio">${copy.bio}</label><span class="tag">${copy.optional}</span></div>
      <textarea class="textarea" id="bio" name="bio" maxlength="300" dir="auto" aria-describedby="bio-hint">${escapeHtml(state.bio)}</textarea>
      <div class="flex justify-between gap-4"><p class="hint" id="bio-hint">${copy.bioHint}</p><span class="hint" id="bio-count" dir="ltr">${state.bio.length}/300</span></div>
      <label class="hint flex items-center gap-2">${copy.bioLanguage}<select class="select select-sm w-auto! border-0!" data-field="bioLocale">${Object.entries(
        languages,
      )
        .map(
          ([id, label]) =>
            `<option value="${id}" ${state.bioLocale === id ? 'selected' : ''}>${label}</option>`,
        )
        .join('')}</select></label>
      ${publication('bio', copy, state)}
    </div>
  </section>
  <section class="panel">
    ${heading(copy.topicsTitle, copy.topicsNote)}
    <div class="field">
      <div class="label-line"><label for="role">${copy.role}</label><span class="tag">${copy.optional}</span></div>
      <select class="select" id="role" data-field="role">${copy.roles.map((role, index) => `<option value="${index}" ${state.role === index ? 'selected' : ''}>${role}</option>`).join('')}</select>
      ${publication('role', copy, state)}
    </div>
    <fieldset class="field"><legend class="text-xs font-semibold mb-3">${copy.interests}</legend>
      <div class="chips">${copy.topics.map((topic, index) => `<button type="button" class="chip" data-topic="${index}" aria-pressed="${state.topics.includes(index)}">${topic}</button>`).join('')}</div>
      <p class="hint">${copy.topicHint}</p>${publication('interests', copy, state)}
    </fieldset>
    <fieldset class="field"><legend class="text-xs font-semibold mb-3">${copy.languages}</legend>
      <div class="chips">${Object.entries(languages)
        .map(
          ([id, label]) =>
            `<button type="button" class="chip" data-language="${id}" aria-pressed="${state.languages.includes(id)}">${label}</button>`,
        )
        .join('')}</div>
      ${publication('languages', copy, state)}
    </fieldset>
    <div class="field">
      <div class="label-line"><label for="link">${copy.link}</label><span class="tag">${copy.optional}</span></div>
      <input class="input" id="link" name="link" type="url" maxlength="2048" dir="ltr" value="${escapeHtml(state.link)}" aria-describedby="link-hint link-error" />
      <p class="hint" id="link-hint">${copy.linkHint}</p><p class="error" id="link-error" hidden>${copy.linkError}</p>${publication('link', copy, state)}
    </div>
  </section>`;

export const publicCard = (copy, state) => `
  <article class="preview-card">
    <div class="preview-art" aria-hidden="true"><span class="table-art"></span></div>
    <div class="preview-body">
      <div class="avatar-disc">${avatar(state, true)}</div>
      <h2 class="preview-name" dir="auto">${escapeHtml(state.name)}</h2>
      ${state.visible.role && state.role ? `<p class="preview-meta">${copy.roles[state.role]}</p>` : ''}
      <p class="preview-bio" dir="auto" ${state.visible.bio ? `lang="${state.bioLocale}"` : ''}>${escapeHtml(state.visible.bio && state.bio ? state.bio : copy.previewEmpty)}</p>
      ${state.visible.interests && state.topics.length ? `<div class="preview-detail"><h3>${copy.previewTopics}</h3>${state.topics.map((id) => `<span class="tag">${copy.topics[id]}</span>`).join('')}</div>` : ''}
      ${state.visible.languages && state.languages.length ? `<div class="preview-detail"><h3>${copy.previewLanguages}</h3><p class="text-xs">${state.languages.map((id) => languages[id]).join(' · ')}</p></div>` : ''}
      ${state.visible.link && state.link ? `<div class="preview-detail"><p class="text-xs text-accent break-all" dir="ltr">${escapeHtml(state.link)}</p></div>` : ''}
    </div>
  </article>`;
