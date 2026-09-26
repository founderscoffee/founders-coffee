import { page, section, table, text } from './legal-translated';
import type { CompanyPageContent } from './types';

export const cookiesEnglish: CompanyPageContent = page(
  'Cookie policy',
  'The three cookies we place on your device, why we use them, and what we do not use: no analytics, advertising, or tracking.',
  [
    section(
      'Short version',
      text(
        'We use three cookies: one keeps you signed in, one remembers your interface language, and one remembers the country selected for your first visit.',
        '**We do not use analytics, advertising cookies, or cross-site tracking.** There is no third-party script watching your browsing, advertising pixel, or marketing interest profile.',
        'That is why there is no tracking-consent banner: there is no tracking to consent to.',
      ),
    ),
    section(
      'What is a cookie?',
      text(
        'A cookie is a small text file saved by your browser at a website’s request and sent back on each visit. It remembers something between pages, such as your sign-in or language preference.',
      ),
    ),
    section('Cookies we place', [
      table(
        ['Cookie', 'Type', 'Purpose', 'Duration'],
        [
          [
            '`__Secure-better-auth.session_token`',
            'Required',
            'Keeps your session active between pages and visits. It is protected from page scripts and sent only over an encrypted connection.',
            'Session lifetime',
          ],
          [
            '`PARAGLIDE_LOCALE`',
            'Preference',
            'Stores the interface language you chose: Arabic, French, or English.',
            'One year',
          ],
          [
            '`fc_geo`',
            'Preference',
            'Stores the country selected on your first visit so we do not redirect you every time.',
            'One year',
          ],
        ],
      ),
      ...text(
        'The bot-protection service may set a short-lived technical cookie during sign-in or a city waitlist request to distinguish a visitor from an automated program. It is not used for tracking and we do not read personal information from it.',
      ),
    ]),
    section(
      'Types we do not use',
      text(
        '**Analytics.** We use aggregate server counters instead of browser measurement tools; they are not linked to a person and do not need a cookie.',
        '**Marketing and advertising.** We show no ads and sell no ad space, so we do not place these cookies.',
        '**Cross-site tracking.** We do not participate in tracking networks or place anything that lets another party know you visited us.',
      ),
    ),
    section(
      'Storage on your device outside cookies',
      text(
        'The platform is an installable web app. If you install it, your browser caches interface files for speed and may store display preferences locally. This technical storage does not reach us and disappears when you delete site data or remove the installed app.',
        'If you enable push notifications, the browser creates a device token that we store to send notifications. It is not a cookie; see the [Privacy policy](/privacy).',
      ),
    ),
    section(
      'How to control cookies',
      text(
        'You can delete or block cookies in your browser settings at any time. Deleting the session cookie signs you out; blocking cookies prevents sign-in because the session cannot be saved. Deleting the language or country cookies only means you will be asked again.',
      ),
    ),
    section(
      'If this changes',
      text(
        'If we add analytics or any cookie beyond those listed here, we will update this page first and ask for consent where the law requires it. Questions: **contact@founders.coffee**',
      ),
    ),
  ],
);
