import { list, section, table, text, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const legalEnglish: CompanyPageContent = translatedPage(
  'en',
  'Legal information',
  'Who operates Founders Coffee, how to contact us, where data is processed, and the platform’s current legal status.',
  [
    section('Who operates the platform', [
      ...text(
        'Founders Coffee is currently a **free pilot** at the market-testing stage. No company has been set up behind it, and nothing is sold on it. It is operated by an individual in a personal capacity, whose details are:',
      ),
      table(
        ['Item', 'Details'],
        [
          ['Operator', '**Amine Yagoub**'],
          [
            'Status',
            'Individual (no legal entity incorporated as of this page’s last update)',
          ],
          ['Postal address', 'Provided on request at the email address below'],
          [
            'Commercial register',
            'Not applicable: there is no commercial registration, and no paid transaction takes place on the platform',
          ],
          [
            'Tax identification number (NIF)',
            'Not applicable for the same reason',
          ],
          [
            'Statistical identification number (NIS)',
            'Not applicable for the same reason',
          ],
          ['Publication director', 'The operator'],
        ],
      ),
      ...text(
        'We state this plainly, not as an afterthought: you have the right to know who you are contracting with when you create an account. Our obligations to you under the [Terms of use](/terms) and the [Privacy policy](/privacy) stand as they are, and the operator bears them personally.',
      ),
    ]),
    section('If a company is incorporated later', [
      ...text(
        'If the pilot succeeds, we will incorporate the legal entity that operates the platform and opens Founders Coffee spaces. At that point:',
      ),
      list([
        'this page will be updated with the company’s full details;',
        'the contractual relationship between you and the operator transfers to the company, under section 15 of the [Terms of use](/terms);',
        'the description of the **data controller** in the [Privacy policy](/privacy) changes with it, and we will notify you before this takes effect, because it is a material change in who holds your data.',
      ]),
    ]),
    section('Contact', [
      table(
        ['Purpose', 'Channel'],
        [
          ['General questions and support', '**contact@founders.coffee**'],
          [
            'Privacy requests and exercising your rights',
            '**contact@founders.coffee**',
          ],
          [
            'Reports about content and violations',
            '**contact@founders.coffee**',
          ],
        ],
      ),
    ]),
    section(
      'Personal-data protection',
      text(
        'The controller of your personal data is the operator named above, in a personal capacity, not a company. The absence of a company takes nothing away from the operator’s obligations under data protection law: the law’s definition of a controller covers an individual as well as a legal entity.',
        'For anything concerning your personal data, and to exercise your rights of access, correction, objection, and deletion: **contact@founders.coffee**.',
        'Your data is processed on technical infrastructure outside your country. The details, and the legal basis we rely on, are in the [Privacy policy](/privacy).',
      ),
    ),
    section(
      'Technical hosting',
      text(
        'The platform is hosted, and its data processed, on distributed cloud infrastructure run by providers based outside the countries where we operate. The Privacy policy describes the role of each category of these providers and the data it receives.',
        'What this means for data protection, and the legal basis we rely on, is set out in the [Privacy policy](/privacy).',
      ),
    ),
    section(
      'Intellectual property',
      text(
        'The “Founders Coffee” name and logo, and the design and software of the platform, are protected by copyright and related rights, and may not be used without prior written permission.',
        'The text and images members publish remain the property of their authors, as set out in the [Terms of use](/terms).',
      ),
    ),
  ],
  '29 September 2026',
);
