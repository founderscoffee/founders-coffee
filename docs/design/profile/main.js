import './styles.css';
import ar from './ar.json';
import en from './en.json';
import fr from './fr.json';
import { avatar, publicCard } from './profile.js';
import { shell } from './shell.js';

const dictionaries = { ar, en, fr };
let locale = 'ar';
let page = 'profile';
let state = {
  name: ar.nameExample,
  bio: ar.bioExample,
  bioLocale: 'ar',
  role: 1,
  topics: [0, 1],
  languages: ['ar', 'fr'],
  link: '',
  photo: '',
  visible: {
    photo: false,
    bio: false,
    role: false,
    interests: false,
    languages: false,
    link: false,
  },
  reminders: true,
  hostUpdates: true,
};
let saved = structuredClone(state);
let toastTimeout;
const copy = () => dictionaries[locale];
const dirty = () => JSON.stringify(state) !== JSON.stringify(saved);
const notify = (message) => {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
};
const refresh = () => {
  const preview = document.querySelector('#public-preview');
  if (preview) preview.innerHTML = publicCard(copy(), state);
  const status = document.querySelector('#save-status');
  if (status) {
    status.textContent = dirty() ? copy().changes : copy().saved;
    status.classList.toggle('is-dirty', dirty());
    document.querySelector('#save').disabled = !dirty();
    document.querySelector('#discard').disabled = !dirty();
  }
  document.querySelectorAll('[data-visibility]').forEach((node) => {
    node.textContent = state.visible[node.dataset.visibility]
      ? copy().public
      : copy().private;
  });
};
const showDialog = (title, content) => {
  document.querySelector('#dialog-title').textContent = title;
  document.querySelector('#dialog-content').replaceChildren();
  if (typeof content === 'string') {
    const paragraph = document.createElement('p');
    paragraph.className = 'text-sm leading-7 text-neutral';
    paragraph.textContent = content;
    document.querySelector('#dialog-content').append(paragraph);
  } else document.querySelector('#dialog-content').append(content);
  document.querySelector('#dialog').showModal();
};
const switchLocale = (next) => {
  locale = next;
  render();
};
const bindProfile = () => {
  for (const key of ['name', 'bio', 'link']) {
    document.getElementById(key)?.addEventListener('input', (event) => {
      state[key] = event.target.value;
      if (!state[key] && key in state.visible) {
        state.visible[key] = false;
        document.querySelector(`[data-publish="${key}"]`).checked = false;
      }
      if (key === 'bio')
        document.querySelector('#bio-count').textContent =
          `${state.bio.length}/300`;
      if (key === 'name')
        document.querySelector('#owner-avatar').innerHTML = avatar(state);
      refresh();
    });
  }
  document.querySelectorAll('[data-publish]').forEach((input) =>
    input.addEventListener('change', () => {
      state.visible[input.dataset.publish] = input.checked;
      refresh();
    }),
  );
  document.querySelectorAll('[data-field]').forEach((input) =>
    input.addEventListener('change', () => {
      state[input.dataset.field] =
        input.dataset.field === 'role' ? Number(input.value) : input.value;
      refresh();
    }),
  );
  document.querySelectorAll('[data-topic], [data-language]').forEach((button) =>
    button.addEventListener('click', () => {
      const isTopic = 'topic' in button.dataset;
      const key = isTopic ? 'topics' : 'languages';
      const value = isTopic
        ? Number(button.dataset.topic)
        : button.dataset.language;
      if (state[key].includes(value))
        state[key] = state[key].filter((item) => item !== value);
      else if (state[key].length < (isTopic ? 5 : 3)) state[key].push(value);
      button.setAttribute('aria-pressed', String(state[key].includes(value)));
      refresh();
    }),
  );
  document
    .querySelector('#upload')
    ?.addEventListener('click', () =>
      document.querySelector('#photo-file').click(),
    );
  document.querySelector('#remove-photo')?.addEventListener('click', () => {
    state.photo = '';
    state.visible.photo = false;
    render();
  });
  document.querySelector('#photo-file')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      notify(copy().photoError);
      return;
    }
    state.photo = URL.createObjectURL(file);
    render();
    notify(copy().photoDemo);
  });
};
const save = (event) => {
  event.preventDefault();
  const validName = !!state.name.trim();
  let validLink = !state.link;
  try {
    const parsed = new URL(state.link);
    validLink =
      parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    validLink = !state.link;
  }
  for (const [key, valid] of [
    ['name', validName],
    ['link', validLink],
  ]) {
    const input = document.getElementById(key);
    if (input) {
      input.setAttribute('aria-invalid', String(!valid));
      document.getElementById(`${key}-error`).hidden = valid;
    }
  }
  if (!validName || !validLink) {
    if (page !== 'profile') {
      page = 'profile';
      render();
      save(event);
      return;
    }
    document.getElementById(!validName ? 'name' : 'link').focus();
    return;
  }
  saved = structuredClone(state);
  refresh();
  notify(copy().savedNotice);
};
const render = () => {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  document.querySelector('#app').innerHTML = shell(copy(), state, locale, page);
  document
    .querySelector('#locale')
    .addEventListener('change', (event) => switchLocale(event.target.value));
  document
    .querySelectorAll('[data-locale]')
    .forEach((button) =>
      button.addEventListener('click', () =>
        switchLocale(button.dataset.locale),
      ),
    );
  document.querySelectorAll('[data-page]').forEach((button) =>
    button.addEventListener('click', () => {
      page = button.dataset.page;
      render();
      document.querySelector('#profile-main').focus({ preventScroll: true });
    }),
  );
  document.querySelectorAll('[data-preference]').forEach((input) =>
    input.addEventListener('change', () => {
      state[input.dataset.preference] = input.checked;
      refresh();
    }),
  );
  document.querySelectorAll('[data-demo]').forEach((button) =>
    button.addEventListener('click', () => {
      const kind = button.dataset.demo;
      showDialog(
        kind === 'delete' ? copy().deleteTitle : copy().demoTitle,
        kind === 'delete'
          ? copy().deleteBody
          : kind === 'activity'
            ? copy().emptyDemo
            : copy().demoBody,
      );
    }),
  );
  document.querySelector('[data-preview]')?.addEventListener('click', () => {
    const fragment = document.createElement('div');
    fragment.innerHTML = publicCard(copy(), state);
    showDialog(copy().publicProfile, fragment);
  });
  document.querySelector('#discard')?.addEventListener('click', () => {
    state = structuredClone(saved);
    render();
  });
  document.querySelector('#profile-form').addEventListener('submit', save);
  bindProfile();
  refresh();
};

window.addEventListener('beforeunload', (event) => {
  if (dirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
render();
