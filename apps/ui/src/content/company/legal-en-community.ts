import {
  list,
  section,
  subheading,
  text,
  translatedPage,
} from './legal-translated';
import type { CompanyPageContent } from './types';

export const communityEnglish: CompanyPageContent = translatedPage(
  'en',
  'Community guidelines',
  'What we expect in the Founders Coffee community, what is prohibited, and how we handle violations.',
  [
    section(
      'Why this document exists',
      text(
        'Founders Coffee is built on a simple idea: that people with projects in the same city sit around a table and talk honestly about what they are working on. These guidelines prohibit whatever spoils that conversation.',
        'They are not a generic list of prohibitions copied from a social network. The problems that affect a community like this one are known and specific: someone who comes to sell instead of to share, someone who publishes a gathering they do not intend to hold, someone who talks up their company until the description becomes a lie, someone who collects attendees’ numbers to add them to a list. These are exactly what we are talking about.',
        'These guidelines are part of the [Terms of use](/terms), and they apply to everything that appears on the platform: profiles, gathering pages, gathering chats, feedback, and the messages we receive.',
      ),
    ),
    section(
      'What we expect',
      text(
        '**Be who you say you are.** A real name, and an honest description of what you are working on. A project at an early stage is described as being at an early stage; there is nothing wrong with that, and the whole community has been there.',
        '**Attend if you RSVP, and cancel if you cannot.** The host books a table based on the number they see. Not showing up without notice costs them something real.',
        '**Ask before you pitch.** The difference between a useful conversation and a nuisance is whether the other person asked for it.',
      ),
    ),
    section('What is prohibited', [
      subheading('Unsolicited promotion'),
      ...text(
        'Do not send commercial offers or services to members who did not ask for them. Do not turn your gathering’s description into an advertisement for your company. Do not publish the same gathering over and over to keep it at the top of the list.',
        'Talking about your project during a gathering is the reason the platform exists in the first place. What is prohibited is using the platform as a channel for bulk messaging.',
      ),
      subheading('Fake or unserious gatherings'),
      ...text(
        'Do not publish a gathering you do not intend to hold, a gathering with a venue or time you know to be wrong, or a gathering whose real purpose is not the one stated in its description.',
        'A gathering that is published and never held weakens people’s trust in every gathering after it. And we keep track of it: after every gathering, the host is asked whether it actually took place, and anyone who repeatedly publishes gatherings that do not take place loses the ability to publish.',
      ),
      subheading('Fake profiles and impersonation'),
      ...text(
        'Do not create an account in another person’s name, or in the name of a company you do not represent. Do not claim a position, a partnership, or a connection to a known organisation without a basis. Do not create multiple accounts to get around a moderation decision.',
      ),
      subheading('Misleading financial or investment claims'),
      ...text(
        'Do not claim to have raised funding you did not raise, to be backed by a fund or an accelerator when that is not true, or to represent an investor when you do not.',
        'Do not promise a guaranteed return, do not call for money to be collected from attendees at a gathering, and do not use the platform to promote investment schemes, currencies, or quick-profit opportunities. This kind of claim does more than damage reputations; it can cost someone their savings.',
      ),
      subheading('Recruitment fraud'),
      ...text(
        'Do not post job opportunities that are not real, do not ask an applicant for money in exchange for training, processing an application, or guaranteeing a job, and do not collect personal documents on the pretext of recruitment.',
      ),
      subheading('Collecting or publishing member data'),
      ...text(
        'The list of people who RSVP’d to a gathering is given to the host for one purpose only: to organise their gathering. Copying it, exporting it, adding it to a mailing list, or selling it is a clear violation.',
        'Using automated programs to extract member data from the platform is not allowed.',
        'Do not publish personal information about another member (their phone number, address, workplace, or photo) without their permission, whether on the platform or off it.',
      ),
      subheading('Harassment, discrimination, and threats'),
      ...text(
        'Do not harass, threaten, or insult. Discrimination or abuse based on gender, origin, language, religion, disability, or any other ground is not accepted.',
        'What happens at the gathering itself matters to us as much as what is written on the platform. If you experienced behaviour like this at a gathering published with us, report it to us.',
      ),
      subheading('Illegal content and services'),
      ...text(
        'Nothing unlawful may be published on the platform, nor anything related to selling prohibited goods or services, nor malicious links or phishing pages.',
      ),
      subheading('Other people’s rights'),
      ...text(
        'Do not upload a logo, image, or text you do not have the right to use. Whoever wrote or photographed something has a right over what they produced, and the law protects that right.',
      ),
    ]),
    section(
      'Organizers',
      text(
        'Anyone who publishes a gathering has additional responsibilities (accurate information, permits where needed, and keeping the people who RSVP’d informed of changes or cancellation), set out in the [Organizer terms](/organizers).',
      ),
    ),
    section('How we enforce these guidelines', [
      ...text(
        'When we receive a report or spot a violation, we look at the case and choose what fits it from:',
      ),
      list([
        '**A warning** explaining what happened and what we expect;',
        '**Removing or hiding the violating content**;',
        '**Unpublishing a gathering**;',
        '**Restricting a feature** for a set period, such as blocking new gatherings from being published;',
        '**Suspending the account**;',
        '**Permanently terminating the account**.',
      ]),
      ...text(
        '**We are not bound to a fixed order.** For minor violations, or ones that seem to have happened by oversight, we start with a warning, because it is usually enough. Fraud, impersonation, threats, and anything that affects people’s safety, however, we act on immediately and without prior warning. Promising a fixed escalation in cases like these is a promise that should not be made.',
        'We also look at the context: was the behaviour repeated? Did it actually harm anyone? Was it corrected after the warning?',
      ),
    ]),
    section(
      'How to report',
      text(
        'To report a message in a gathering’s chat, open its options (⋯) and choose “Report message”.',
        'For anything else, write to us at **contact@founders.coffee** with a link to the gathering, profile, or content, and what you saw in it. A precise description shortens the review.',
        'Reports are handled confidentially. We do not reveal the reporter’s identity to the person reported.',
        'If there is an immediate danger to someone, contact the competent authorities first; we are a digital platform and have no means of intervening on the ground.',
      ),
    ),
    section(
      'If you think a decision is wrong',
      text(
        'Write to us and explain. We review decisions and correct any we find were wrong. Moderation is human work, and it sometimes makes mistakes.',
      ),
    ),
  ],
  '30 September 2026',
);
