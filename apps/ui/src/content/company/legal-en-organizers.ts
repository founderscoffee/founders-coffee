import { list, section, text, translatedPage } from './legal-translated';
import type { CompanyPageContent } from './types';

export const organizersEnglish: CompanyPageContent = translatedPage(
  'en',
  'Organizer terms',
  'Responsibilities for publishing a gathering: accurate information, venue, safety, attendee lists, and cancellation.',
  [
    section(
      'When these terms apply',
      text(
        'They apply to you from the moment you publish a gathering on Founders Coffee, and they add to the [Terms of use](/terms) and the [Community guidelines](/community) without replacing them.',
        'These terms are not a franchise agreement or a heavy set of obligations. Hosting a gathering here is simple: you choose a café, set a time, and write what you will talk about. What follows is the responsibility that comes with that, nothing more.',
      ),
    ),
    section(
      'You are the host',
      text(
        'When you publish a gathering, you become its **host**, you or the organisation in whose name you publish. We provide the platform where the gathering is published and discovered and where attendance is registered; we take no part in organising it, we do not represent you to attendees, and we are not responsible for what you promise.',
        'So the relationship between you and the people who RSVP to your gathering is yours.',
      ),
    ),
    section(
      'Accurate gathering information',
      text(
        'What you publish must be accurate at the time you publish it: the gathering’s title, its topic, the venue with its name and address, the date and time, and the discussion language.',
        'If any of this changes, update it on the gathering page as quickly as you can. The people who RSVP’d plan their travel on what they read.',
        'If the gathering is aimed at a particular group (founders in a specific field, a certain project stage, a single language), say so clearly in the description. Defining the audience openly is acceptable; hiding the gathering’s real purpose is not.',
      ),
    ),
    section(
      'Venue and permits',
      text(
        'Choosing the venue is your responsibility, and so is the arrangement with its owner. Make sure you have the right to use it for this purpose at this time, and that the expected number of attendees is acceptable to them.',
        'Follow the venue’s rules and the instructions of the people who run it, and tell attendees what they need to know about them.',
        'If your gathering is of a kind that requires a permit or prior notice under the rules where it takes place (because of the nature of the activity, its size, or its location), obtaining it is your responsibility alone. The usual gatherings on the platform are small sessions in public places and generally do not require this; but in the end the judgement is yours, and you know your gathering best.',
      ),
    ),
    section(
      'Attendee safety',
      text(
        'You are the one running the session. If abusive or dangerous behaviour happens at your gathering, act: warn the person, ask them to leave, or end the gathering if necessary. If the matter is serious, contact the competent authorities.',
        'Then report it to us, so we can take the necessary action on the account.',
      ),
    ),
    section(
      'Attendee list',
      text(
        'We show you the names of the people who RSVP’d to your gathering, because you need to know who to expect.',
        '**This list is for organising this gathering, and nothing else.** Do not copy it, export it, add the people on it to a mailing list or database, or share it with anyone, and do not use it to contact them after the gathering about anything unrelated to it.',
        'If you want to collect any additional information from attendees at the gathering itself (an email, a phone number, an identity card), tell them explicitly that **you** are the one collecting it, for what purpose, and that this is not part of the platform. When you do, you become responsible for that data under the law, and the rules on personal data protection apply to you.',
        'Breaching this clause is one of the most serious things that can happen on the platform, and we treat it accordingly.',
      ),
    ),
    section(
      'Recording attendance',
      text(
        'After the gathering ends, we ask you to tell us whether it actually took place, to record which of the people who RSVP’d attended and which did not, and to give the number of people who came without an RSVP.',
        'Record what actually happened. This is data about real people, who have the right to have it corrected if it is wrong, and it is the basis on which we tell a gathering that took place from one that did not.',
        'The note you write about how the gathering went is private to you; it is not shown to members.',
      ),
    ),
    section(
      'Contact with attendees',
      text(
        'We send the people who RSVP’d the notifications about the gathering: confirmation, reminder, change, and cancellation. These are standard messages sent by the platform; the platform does not let you write your own text in them.',
        'If you want to tell the people who RSVP’d something, write it in the gathering’s chat if it has one, or in its description, because the description is what they read and what the reminder is based on.',
        'The gathering’s channels, whether its description, its chat, or contact outside the platform based on the attendee list, may never be used to offer services or products. That is direct marketing, which the law prohibits without the recipient’s prior consent.',
      ),
    ),
    section(
      'Changes, postponement, and cancellation',
      text(
        '**Changes:** update the gathering page as soon as any information changes, and we will notify the people who RSVP’d.',
        '**Postponement:** if you postpone the gathering to a new date, announce the new date on the gathering page. If you have no replacement date, it is better to cancel and publish a new gathering later than to leave the people who RSVP’d waiting indefinitely.',
        '**Cancellation:** cancel the gathering on the platform as soon as you know it will not take place, and give the reason briefly. Cancelling early is the right thing to do; silence is not.',
        'Because gatherings are free, cancelling creates no financial obligations. But people will have arranged their time and travel, and repeated last-minute cancellations strip gatherings of their value and cost you the ability to publish.',
      ),
    ),
    section(
      'Content you upload',
      text(
        'The text, images, and logos you put on the gathering page must be yours, or you must have the right to use them.',
        'By using the platform, you grant us a limited licence to display this content on the gathering page and on the discovery pages linked to it, to the extent needed to run the service.',
      ),
    ),
    section(
      'Photography at a gathering',
      text(
        'If you intend to take photos or record during the gathering, say so in the description, tell attendees at the start, and respect anyone who asks not to appear.',
        'Publishing a person’s image without their consent is a matter of rights, not of taste.',
      ),
    ),
    section('Gatherings we do not accept', [
      ...text(
        'No gathering that breaches the law of the country where it takes place may be published on Founders Coffee, nor any gathering whose purpose is:',
      ),
      list([
        'collecting money from attendees, or promoting investment schemes, currencies, or guaranteed returns;',
        'selling goods or services whose marketing is prohibited by regulation;',
        'recruitment in exchange for fees paid by the applicant;',
        'a commercial offer dressed up as a community gathering;',
        'anything that harms public order or public morals.',
      ]),
    ]),
    section(
      'Paid gatherings',
      text(
        'All gatherings on the platform are currently free, and there is no way to collect payment through it. Do not ask the people who RSVP’d to pay anything outside the platform in exchange for attending.',
        'If paid gatherings become available later, the ticketing, cancellation, and refund policy will apply to them once it has been announced as in force.',
      ),
    ),
    section(
      'When you have a problem',
      text(
        'Write to us at **contact@founders.coffee**: an abusive member, doubts about a published gathering, a dispute with a venue, or anything else where you need us to step in. We answer hosts’ messages and take them seriously.',
      ),
    ),
    section(
      'What we may do',
      text(
        'We may unpublish a gathering, restrict the ability to publish new gatherings, or suspend the account if these terms, the Community guidelines, or the law are breached.',
        'We take these decisions at the level of the market where the breach occurred: a restriction in one city or country does not mean a restriction elsewhere.',
        'If you think a decision was wrong, write to us and we will reconsider it.',
      ),
    ),
  ],
  '30 September 2026',
);
