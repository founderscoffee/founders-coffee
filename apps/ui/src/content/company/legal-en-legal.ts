import { section, table, text, list, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const legalEnglish: CompanyPageContent = translatedPage(
  'en',
  'Legal information',
  'Who operates Founders Coffee, how to contact us, where data is processed, and the platform’s current legal status.',
  [
    section('Who operates the platform', [
      ...text(
        'Founders Coffee is currently a **free pilot** testing the market. No company has been incorporated and nothing is sold. It is operated by an individual in a personal capacity:',
      ),
      table(
        ['Field', 'Value'],
        [
          ['Operator', '**Amine Yagoub**'],
          [
            'Status',
            'Individual; no legal entity incorporated as of this page’s last update',
          ],
          ['Postal address', 'Provided on request at the email address below'],
          [
            'Commercial register',
            'Not applicable: no commercial registration and no paid transaction on the platform',
          ],
          [
            'Tax identification number (NIF)',
            'Not applicable for the same reason',
          ],
          [
            'Statistical identification number (NIS)',
            'Not applicable for the same reason',
          ],
          ['Publisher', 'The operator'],
        ],
      ),
      ...text(
        'You have the right to know who you contract with when creating an account. The obligations in the [Terms of use](/terms) and [Privacy policy](/privacy) remain personal obligations of the operator.',
      ),
    ]),
    section('If a company is incorporated later', [
      ...text(
        'If the pilot succeeds, we will incorporate the legal entity operating the platform and its Founders Coffee spaces. Then:',
      ),
      list([
        'this page will be updated with the company’s full details;',
        'the existing contractual relationship will transfer to the company under section 16 of the [Terms of use](/terms);',
        'the data-controller information in the [Privacy policy](/privacy) will change.',
      ]),
      ...text(
        'We will notify you before the change takes effect because it changes who holds your data.',
      ),
    ]),
    section('Contact', [
      table(
        ['Purpose', 'Channel'],
        [
          ['General questions and support', '**contact@founders.coffee**'],
          ['Privacy requests and rights', '**contact@founders.coffee**'],
          ['Content and moderation reports', '**contact@founders.coffee**'],
        ],
      ),
    ]),
    section(
      'Personal-data protection',
      text(
        'The controller is the individual operator above, not a company. Law 18-07 covers an individual controller as well as a legal entity. For access, correction, objection, or deletion requests, email **contact@founders.coffee**. Data is processed on infrastructure outside Algeria; the [Privacy policy](/privacy) explains the basis and details.',
      ),
    ),
    section(
      'Technical hosting',
      text(
        'The platform and its data are hosted on distributed cloud infrastructure operated by providers outside Algeria. The [Privacy policy](/privacy) describes each provider category, the data it receives, and the safeguards used.',
      ),
    ),
    section(
      'Intellectual property',
      text(
        'The “Founders Coffee” name, logo, platform design, and software are protected by Order 03-05 on copyright and related rights and may not be used without prior written permission. Member text and images remain theirs under the [Terms of use](/terms).',
      ),
    ),
  ],
);
