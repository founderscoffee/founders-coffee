import { describe, expect, it } from 'vitest';

import {
  ntf_closeout_prompt_title,
  ntf_did_not_happen_title,
  ntf_email_closeout_prompt_html,
  ntf_email_closeout_prompt_text,
  ntf_email_event_cancelled_html,
  ntf_email_event_cancelled_text,
  ntf_event_cancelled_title,
  ntf_push_feedback_invitation_title,
  ntf_sms_event_cancelled,
} from './paraglide/messages.js';

type Sentence = {
  readonly key: string;
  readonly render: () => string;
  readonly expected: string;
};

const AR = { locale: 'ar' } as const;

const FR = { locale: 'fr' } as const;

const LINK = 'https://founders.coffee/e/1';

const ARABIC_MEETUP = {
  title: 'قهوة تعارف',
  venue: 'مقهى الروضة',
  date: 'السبت 3 أكتوبر',
  url: LINK,
} as const;

const FRENCH_MEETUP = {
  title: 'Les Matinales',
  venue: 'Ifri Hub',
  date: 'samedi 3 octobre',
  url: LINK,
} as const;

const ARABIC_AGREEMENT: readonly Sentence[] = [
  {
    key: 'ntf_push_feedback_invitation_title',
    render: () => ntf_push_feedback_invitation_title(ARABIC_MEETUP, AR),
    expected: 'كيف كان لقاء «قهوة تعارف»؟',
  },
  {
    key: 'ntf_did_not_happen_title',
    render: () => ntf_did_not_happen_title(ARABIC_MEETUP, AR),
    expected: 'لم ينعقد لقاء «قهوة تعارف»',
  },
  {
    key: 'ntf_closeout_prompt_title',
    render: () => ntf_closeout_prompt_title(ARABIC_MEETUP, AR),
    expected: 'كيف سار لقاء «قهوة تعارف»؟',
  },
  {
    key: 'ntf_email_closeout_prompt_html',
    render: () => ntf_email_closeout_prompt_html(ARABIC_MEETUP, AR),
    expected:
      '<p>انتهى لقاء <strong>قهوة تعارف</strong> في مقهى الروضة.</p><p>أخبرنا إن كان قد انعقد ومن حضر.',
  },
  {
    key: 'ntf_email_closeout_prompt_text',
    render: () => ntf_email_closeout_prompt_text(ARABIC_MEETUP, AR),
    expected:
      'انتهى لقاء «قهوة تعارف» في مقهى الروضة. أخبرنا إن كان قد انعقد ومن حضر:',
  },
  {
    key: 'ntf_sms_event_cancelled',
    render: () => ntf_sms_event_cancelled(ARABIC_MEETUP, AR),
    expected: 'ألغى المضيف لقاء «قهوة تعارف» المقرر يوم السبت 3 أكتوبر.',
  },
  {
    key: 'ntf_event_cancelled_title',
    render: () => ntf_event_cancelled_title(ARABIC_MEETUP, AR),
    expected: 'أُلغي لقاء «قهوة تعارف»',
  },
  {
    key: 'ntf_email_event_cancelled_html',
    render: () => ntf_email_event_cancelled_html(ARABIC_MEETUP, AR),
    expected:
      '<p>ألغى المضيف لقاء <strong>قهوة تعارف</strong> المقرر يوم السبت 3 أكتوبر في مقهى الروضة.</p>',
  },
  {
    key: 'ntf_email_event_cancelled_text',
    render: () => ntf_email_event_cancelled_text(ARABIC_MEETUP, AR),
    expected:
      'ألغى المضيف لقاء «قهوة تعارف» المقرر يوم السبت 3 أكتوبر في مقهى الروضة.',
  },
];

const FRENCH_AGREEMENT: readonly Sentence[] = [
  {
    key: 'ntf_push_feedback_invitation_title',
    render: () => ntf_push_feedback_invitation_title(FRENCH_MEETUP, FR),
    expected: 'Comment était la rencontre « Les Matinales » ?',
  },
  {
    key: 'ntf_did_not_happen_title',
    render: () => ntf_did_not_happen_title(FRENCH_MEETUP, FR),
    expected: 'La rencontre « Les Matinales » n’a pas eu lieu',
  },
  {
    key: 'ntf_closeout_prompt_title',
    render: () => ntf_closeout_prompt_title(FRENCH_MEETUP, FR),
    expected: 'Comment s’est passée la rencontre « Les Matinales » ?',
  },
  {
    key: 'ntf_email_closeout_prompt_html',
    render: () => ntf_email_closeout_prompt_html(FRENCH_MEETUP, FR),
    expected:
      '<p>La rencontre <strong>Les Matinales</strong> à Ifri Hub est terminée.</p><p>Dites-nous si elle a eu lieu et qui est venu.',
  },
  {
    key: 'ntf_email_closeout_prompt_text',
    render: () => ntf_email_closeout_prompt_text(FRENCH_MEETUP, FR),
    expected:
      'La rencontre « Les Matinales » à Ifri Hub est terminée. Dites-nous si elle a eu lieu et qui est venu :',
  },
  {
    key: 'ntf_sms_event_cancelled',
    render: () => ntf_sms_event_cancelled(FRENCH_MEETUP, FR),
    expected:
      'L’hôte a annulé la rencontre « Les Matinales » prévue le samedi 3 octobre.',
  },
  {
    key: 'ntf_event_cancelled_title',
    render: () => ntf_event_cancelled_title(FRENCH_MEETUP, FR),
    expected: 'Rencontre annulée : Les Matinales',
  },
  {
    key: 'ntf_email_event_cancelled_html',
    render: () => ntf_email_event_cancelled_html(FRENCH_MEETUP, FR),
    expected:
      '<p>L’hôte a annulé la rencontre <strong>Les Matinales</strong>, prévue le samedi 3 octobre à Ifri Hub.</p>',
  },
  {
    key: 'ntf_email_event_cancelled_text',
    render: () => ntf_email_event_cancelled_text(FRENCH_MEETUP, FR),
    expected:
      'L’hôte a annulé la rencontre « Les Matinales », prévue le samedi 3 octobre à Ifri Hub.',
  },
];

describe('the verb or participle around the host’s title', () => {
  it.each(ARABIC_AGREEMENT)(
    '$key names the لقاء, so the verb agrees with it and not with a feminine title',
    ({ render, expected }) => {
      expect(render()).toContain(expected);
    },
  );

  it.each(FRENCH_AGREEMENT)(
    '$key names the rencontre, so the participle agrees with it and not with a plural title',
    ({ render, expected }) => {
      expect(render()).toContain(expected);
    },
  );
});
