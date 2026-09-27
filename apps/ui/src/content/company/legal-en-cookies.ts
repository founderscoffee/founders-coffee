import { section, table, text, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const cookiesEnglish: CompanyPageContent = translatedPage(
  'en',
  'Cookie policy',
  'The cookies placed on your device and why, the outside services that run in your browser, and what we do not use: no advertising and no cross-site tracking.',
  [
    section(
      'Short version',
      text(
        'We place three cookies: one keeps you signed in, one remembers your interface language, and one remembers the country we directed you to. Our provider Cloudflare places a fourth, which remembers that your browser passed its automated-traffic check.',
        '**We use no advertising cookies and no cross-site tracking, and we build no marketing interest profile about you.**',
        'Outside services also run in your browser, as detailed below: visit measurement and automated-traffic detection from Cloudflare, and maps from Mapbox on pages that show a map.',
        'That is why there is no tracking-consent banner: we have no advertising or cross-site tracking to ask your permission for, and everything that runs in your browser is listed on this page.',
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
            'Carries your session identifier so you stay signed in between pages and visits. It is protected from page scripts and sent only over an encrypted connection.',
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
            'Stores the country you were directed to on your first visit, so we do not redirect you every time.',
            'One year',
          ],
          [
            '`cf_clearance`',
            'Required',
            'Set by our provider Cloudflare when your browser passes the automated-traffic check described below, so the check is not repeated on every visit. It is protected from page scripts and is not used for advertising or to track you across sites.',
            'One year',
          ],
        ],
      ),
      ...text(
        'The human-verification service (Cloudflare Turnstile) may set a short-lived technical cookie during sign-in or a city waitlist request to distinguish a visitor from an automated program. It is not used for tracking and we do not read personal information from it.',
      ),
    ]),
    section(
      'Outside services in your browser',
      text(
        '**Visit measurement (Cloudflare Web Analytics).** Every page loads a Cloudflare script that sends Cloudflare the page address, the address of the page you came from, and load-speed measurements; like any connection, the request also carries your IP address and a description of your browser and device. We only see aggregate figures: the number of visits, the most visited pages, page speed, and the countries visits come from. The script sets no cookie, stores nothing on your device, and does not recognise you from one visit to the next.',
        '**Automated-traffic detection (Cloudflare).** Pages also load a Cloudflare script that examines technical characteristics of your browser to tell a human visitor from an automated program, then sets the `cf_clearance` cookie listed above. Its only purpose is to protect the platform from automated use.',
        '**Maps (Mapbox).** Pages that show a map, namely creating a gathering, editing its venue, and the page of a gathering with a venue, load the map directly from Mapbox, so Mapbox receives your IP address, a description of your browser, and the area the map shows. The map library also stores a random identifier and its creation date in your browser’s local storage, and sends it to Mapbox with technical usage data, such as a map load, that Mapbox uses to count use of its service. This does not include your name or email, and Mapbox processes this data under its own privacy policy.',
      ),
    ),
    section(
      'Types we do not use',
      text(
        '**Marketing and advertising.** We show no ads and sell no ad space, so these cookies do not exist here.',
        '**Cross-site tracking.** We do not take part in tracking networks or place anything that links your visit to us with your visits to other sites. What Cloudflare and Mapbox receive from your browser is described in the previous section.',
      ),
    ),
    section(
      'Storage on your device outside cookies',
      text(
        'The platform is an installable web app. If you install it on your phone, the browser keeps a copy of the interface files so it works quickly even on a weak connection. Some of your display choices may also be stored locally.',
        'This technical storage stays on your device, does not reach us, and disappears when you delete site data or remove the installed app.',
        'On pages that show a map, the Mapbox library keeps the random identifier and usage data described above in local storage. It reaches Mapbox, not us, and also disappears when you delete site data.',
        'If you enable push notifications, the browser creates a device token that we store to send you notifications. It is not a cookie; see the [Privacy policy](/privacy).',
      ),
    ),
    section(
      'How to control cookies',
      text(
        'You can delete or block cookies in your browser settings at any time.',
        'Consider the effect: deleting the session cookie signs you out, and blocking cookies entirely makes sign-in impossible, because the session cannot be saved any other way.',
        'Deleting the language or country cookie prevents nothing; you will be asked again. Deleting `cf_clearance` prevents nothing either; the check may run again on your next visit.',
        'You can block the visit-measurement script with a content blocker without affecting the platform; blocking Mapbox prevents maps from showing.',
      ),
    ),
    section(
      'If this changes',
      text(
        'If we add a measurement tool, an outside service, or any cookie beyond those listed here, we will update this page first and ask for your consent where the law requires it.',
        'Questions: **contact@founders.coffee**',
      ),
    ),
  ],
);
