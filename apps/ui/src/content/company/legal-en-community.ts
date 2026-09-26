import { list, page, section, subheading, text } from './legal-translated';
import type { CompanyPageContent } from './types';

export const communityEnglish: CompanyPageContent = page(
  'Community guidelines',
  'What we expect in the Founders Coffee community, what is prohibited, and how we handle violations.',
  [
    section(
      'Why this document exists',
      text(
        'Founders Coffee is built around a simple idea: people with projects sit around a table and speak honestly about what they are working on. These guidelines prohibit what spoils that conversation.',
        'They address the specific risks of this community: selling instead of sharing, publishing a gathering you do not intend to hold, exaggerating a company description into a lie, or collecting attendee numbers for a list.',
        'They form part of the [Terms of use](/terms) and apply to profiles, gathering pages, feedback, and messages sent to us.',
      ),
    ),
    section(
      'What we expect',
      text(
        '**Be who you say you are.** Use a real name and describe your work honestly. A project may be at an early stage; that is fine.',
        '**Attend if you RSVP, cancel if you cannot.** Hosts book a table based on the number they see, and an unexplained no-show has a real cost.',
        '**Ask before you pitch.** The difference between a useful conversation and harassment is whether the other person asked for it.',
      ),
    ),
    section('What is prohibited', [
      subheading('Unsolicited promotion'),
      ...text(
        'Do not send commercial offers to members who did not request them, turn a gathering description into an advertisement, or repeatedly repost the same gathering to keep it at the top. Talking about your project at a gathering is welcome; using the platform for bulk outreach is not.',
      ),
      subheading('Fake or unserious gatherings'),
      ...text(
        'Do not publish a gathering you do not intend to hold, with a knowingly false venue or time, or with an undisclosed purpose. Repeatedly publishing gatherings that never happen can remove your ability to publish.',
      ),
      subheading('Fake profiles and impersonation'),
      ...text(
        'Do not create an account in another person’s name, claim a role or partnership without a basis, or create multiple accounts to evade moderation.',
      ),
      subheading('Misleading financial or investment claims'),
      ...text(
        'Do not claim funding, support, or representation you do not have. Do not promise guaranteed returns, solicit money at a gathering, or promote investment schemes, currencies, or quick-profit offers.',
      ),
      subheading('Recruitment fraud'),
      ...text(
        'Do not publish fake jobs, charge applicants for training or a guaranteed job, or collect identity documents under a false recruitment pretext.',
      ),
      subheading('Collecting or publishing member data'),
      ...text(
        'An attendee list is supplied to a host only to organise that gathering. Do not copy, export, sell, share, or add it to a mailing list, and do not scrape member data with automated tools. Do not publish another member’s phone number, address, workplace, or image without permission.',
      ),
      subheading('Harassment, discrimination, and threats'),
      ...text(
        'Do not harass, threaten, or insult. Discrimination based on gender, origin, language, religion, disability, or any other ground is not accepted. Conduct at a gathering matters as much as conduct on the platform; report it to us.',
      ),
      subheading('Illegal content and services'),
      ...text(
        'Do not publish content that breaches Algerian law, promote prohibited goods or services, or share malicious links or phishing pages.',
      ),
      subheading('Other people’s rights'),
      ...text(
        'Do not upload a logo, image, or text you have no right to use. Copyright belongs to the person who created the work and is protected by law.',
      ),
    ]),
    section(
      'Organizers',
      text(
        'People who publish gatherings have extra duties about accurate information, permissions, attendee communication, changes, and cancellation. They are detailed in the [Organizer terms](/organizers).',
      ),
    ),
    section('How we enforce these guidelines', [
      ...text(
        'When we receive a report or detect a violation, we may choose among:',
      ),
      list([
        '**Warning** explaining what happened and what we expect;',
        '**Removing or hiding the content**;',
        '**Unpublishing a gathering**;',
        '**Restricting a feature** for a period;',
        '**Suspending the account**;',
        '**Permanently terminating the account**.',
      ]),
      ...text(
        'We do not promise a fixed sequence. For minor or accidental breaches, a warning may be enough; fraud, impersonation, threats, and conduct affecting safety may require immediate action. We consider context, repetition, harm, and whether the issue was corrected.',
      ),
    ]),
    section(
      'How to report',
      text(
        'Email **contact@founders.coffee** with the link and a precise description. Reports are confidential and we do not reveal the reporter’s identity to the reported person. If someone faces immediate danger, contact the competent authorities first; we are a digital platform without field intervention.',
      ),
    ),
    section(
      'If you think a decision is wrong',
      text(
        'Contact us and explain. We review decisions and correct those that were made in error. Moderation is human work and can be mistaken.',
      ),
    ),
  ],
);
