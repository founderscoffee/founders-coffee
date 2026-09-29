import { describe, expect, it } from 'vitest';

import fr from '../messages/fr.json';
import {
  host_repeat_notice,
  ntf_email_feedback_invitation_subject,
  ntf_email_rsvp_cancelled_html,
  ntf_email_rsvp_cancelled_text,
  ntf_email_rsvp_received_html,
  ntf_email_rsvp_received_text,
  ntf_push_rsvp_received_title,
  ntf_telegram_connect_needs_rights,
  ntf_telegram_connect_not_admin,
  ntf_telegram_wrap_up,
  share_event_text,
} from './paraglide/messages.js';

type Variant = { readonly match: Readonly<Record<string, string>> };

type Message = string | readonly Variant[];

const FR = { locale: 'fr' } as const;

const MEETUP = {
  title: 'Le Grand Café',
  venue: 'Ifri Hub',
  date: 'samedi 3 octobre',
  url: 'https://founders.coffee/e/1',
  bot: '@FoundersCoffeeBot',
} as const;

const SENTENCES: readonly {
  readonly key: string;
  readonly render: () => string;
  readonly expected: string;
}[] = [
  {
    key: 'ntf_email_feedback_invitation_subject',
    render: () => ntf_email_feedback_invitation_subject(MEETUP, FR),
    expected: 'Qu’avez-vous pensé de la rencontre « Le Grand Café » ?',
  },
  {
    key: 'host_repeat_notice',
    render: () => host_repeat_notice(MEETUP, FR),
    expected: 'Nous partirons de la rencontre « Le Grand Café ».',
  },
  {
    key: 'ntf_telegram_wrap_up',
    render: () => ntf_telegram_wrap_up(MEETUP, FR),
    expected: 'Merci d’être venus à la rencontre « Le Grand Café » !',
  },
  {
    key: 'ntf_telegram_connect_not_admin',
    render: () => ntf_telegram_connect_not_admin(MEETUP, FR),
    expected:
      'Seul un administrateur du groupe peut le relier à la rencontre « Le Grand Café ».',
  },
  {
    key: 'ntf_telegram_connect_needs_rights',
    render: () => ntf_telegram_connect_needs_rights(MEETUP, FR),
    expected:
      'Pour relier le groupe à la rencontre « Le Grand Café », faites du bot @FoundersCoffeeBot un administrateur',
  },
  {
    key: 'ntf_push_rsvp_received_title',
    render: () => ntf_push_rsvp_received_title(MEETUP, FR),
    expected: 'Quelqu’un vient à la rencontre « Le Grand Café »',
  },
  {
    key: 'ntf_email_rsvp_received_html',
    render: () => ntf_email_rsvp_received_html(MEETUP, FR),
    expected:
      '<p>Quelqu’un vient de confirmer sa venue à la rencontre <strong>Le Grand Café</strong> le samedi 3 octobre à Ifri Hub.</p>',
  },
  {
    key: 'ntf_email_rsvp_received_text',
    render: () => ntf_email_rsvp_received_text(MEETUP, FR),
    expected:
      'Quelqu’un vient de confirmer sa venue à la rencontre « Le Grand Café » le samedi 3 octobre à Ifri Hub.',
  },
  {
    key: 'ntf_email_rsvp_cancelled_html',
    render: () => ntf_email_rsvp_cancelled_html(MEETUP, FR),
    expected:
      '<p>Quelqu’un a annulé sa venue à la rencontre <strong>Le Grand Café</strong> le samedi 3 octobre à Ifri Hub.</p>',
  },
  {
    key: 'ntf_email_rsvp_cancelled_text',
    render: () => ntf_email_rsvp_cancelled_text(MEETUP, FR),
    expected:
      'Un participant a annulé sa présence à la rencontre « Le Grand Café » le samedi 3 octobre à Ifri Hub.',
  },
  {
    key: 'share_event_text',
    render: () => share_event_text(MEETUP, FR),
    expected: 'Rejoignez-moi à la rencontre « Le Grand Café »',
  },
];

const PREPOSITION_BEFORE_TITLE =
  /(?:^|[\s«(>])(?:à|de) (?:« )?(?:<strong>)?\{title\}/u;

const FRENCH = fr as Readonly<Record<string, Message | undefined>>;

/** Every French text that interpolates the host's title, with the message it belongs to. */
const titledTexts = (): (readonly [string, string])[] =>
  Object.entries(FRENCH).flatMap(([message, value]) =>
    (value === undefined
      ? []
      : typeof value === 'string'
        ? [value]
        : value.flatMap((variant) => Object.values(variant.match))
    )
      .filter((text) => text.includes('{title}'))
      .map((text) => [message, text] as const),
  );

describe('French prepositions in front of the host’s title', () => {
  it.each(SENTENCES)(
    '$key puts la rencontre after à or de, so a title starting with Le is never contracted',
    ({ render, expected }) => {
      expect(render()).toContain(expected);
    },
  );

  it('writes à or de straight in front of the title in no French text', () => {
    const texts = titledTexts();
    expect(
      texts.length,
      'the catalogue check read no title, so it would pass on anything',
    ).toBeGreaterThan(0);

    for (const [message, text] of texts) {
      expect(
        text,
        `fr:${message} writes à or de straight before {title}, so Le Grand Café reads "à Le Grand Café". Name la rencontre between them`,
      ).not.toMatch(PREPOSITION_BEFORE_TITLE);
    }
  });
});
