import { list, page, section, text } from './legal-translated';
import type { CompanyPageContent } from './types';

export const termsEnglish: CompanyPageContent = page(
  'Terms of use',
  'The rules for using Founders Coffee, our role in member-hosted gatherings, and the limits of our responsibility.',
  [
    section(
      'Who we are',
      text(
        'Founders Coffee is a digital platform for local gatherings between startup founders, business owners, and people interested in entrepreneurship. You can discover gatherings in your city, RSVP, or publish your own gathering.',
        'The platform is currently a **free pilot** in the Algerian market. No company has been incorporated to operate it yet; **Amine Yagoub** operates it personally. His details are available on the [Legal information](/legal) page. References to “we” in this document mean the current operator.',
        'These terms are an agreement between you and the operator. By using the platform or creating an account, you accept them. If you do not accept them, do not use the platform. All gatherings are currently free; any future paid gatherings will be governed by a separate ticketing and refund policy announced in advance.',
      ),
    ),
    section(
      'Our role in gatherings',
      text(
        'The member or organisation that publishes a gathering is its **host**. We provide the digital space where it is published, discovered, and joined; we do not organise the gathering, operate the venue, or take responsibility for what the host says or promises.',
        'This remains true whether the gathering is in a café, coworking space, or another venue. The venue belongs to its owner and the arrangements belong to the host.',
        'The exception is a gathering expressly labelled as an **official Founders Coffee gathering**. In that case we are the host and the responsibilities in the [Organizer terms](/organizers) apply to us.',
        'We review reports, but we do not pre-screen every gathering and cannot guarantee that a gathering will happen as described or on time.',
      ),
    ),
    section(
      'Accounts',
      text(
        '**Who can create an account.** You must be at least **nineteen (19) full years old**, the age of civil majority in Algeria. If we learn that an account belongs to a minor, we suspend it.',
        '**Sign-up.** You create an account with a code sent to your email, or with Google or GitHub. We do not ask for or store a password.',
        '**Accurate information.** Use your real name and accurate information. Aliases, false roles, and impersonation are prohibited by the [Community guidelines](/community).',
        '**Your account.** Your account is personal and may not be shared. Tell us promptly if you notice unauthorised use. You may ask us to close it at any time; the [Privacy policy](/privacy) explains what happens to your data afterwards.',
      ),
    ),
    section(
      'What you publish',
      text(
        'This includes your profile, gathering descriptions, uploaded images, and notes written after a gathering.',
        '**You keep ownership.** We do not claim ownership of your text or images.',
        '**The licence you grant us.** Publishing content gives us a free, non-exclusive licence to display it on the platform and related public pages and search results, and to perform the technical processing needed to run the service, such as resizing and storing images. The licence is limited to operating the platform; we do not use your content in advertising and it ends when you delete the content, except for temporary technical copies and copies the law requires us to keep.',
        '**Your promise.** You own what you publish or have the right to publish it, and it does not infringe another person’s rights. We may hide or delete content that breaches these terms, the Community guidelines, or the law, and will tell you unless legally prevented.',
      ),
    ),
    section(
      'Publishing and joining a gathering',
      text(
        '**If you publish a gathering**, you are its host and the [Organizer terms](/organizers) apply in addition to these terms.',
        '**If you RSVP**, you express an intention to attend. RSVP is free and can be cancelled. These are small, informal gatherings organised by people arranging a venue and time at their own expense, so cancel rather than fail to attend without notice.',
        '**Before attending**, check the host’s venue and time details and decide whether the gathering suits you. You decide to attend and bear the consequences of that decision as you would for any professional appointment.',
        '**Cancellations.** A host may cancel or postpone. We notify people who RSVP through the channels they enabled, but the decision is the host’s and we do not reimburse travel or time.',
      ),
    ),
    section(
      'Attendance records',
      text(
        'After a gathering, the host may record who attended and who did not among the people who RSVP’d. We use this to understand whether gatherings happen and to protect the community from fake gatherings; it is not displayed publicly on your profile.',
        'If your attendance is recorded incorrectly, contact us and we will correct it. The [Privacy policy](/privacy) explains the right and its deadline.',
      ),
    ),
    section(
      'Community conduct',
      text(
        'The detailed rules are in the [Community guidelines](/community), which form part of this agreement. In short: no unsolicited promotion, fake gatherings, impersonated profiles, misleading investment claims, collection of member data, harassment, or discrimination.',
      ),
    ),
    section(
      'Reporting a violation',
      text(
        'If you see a gathering, profile, or other content that breaches the rules or law, or infringes your rights, email **contact@founders.coffee** with the content link and an explanation. We review reports and act appropriately; for copyright or trademark reports, include evidence of your standing and a description of the protected work.',
      ),
    ),
    section(
      'Restrictions and account termination',
      text(
        'We may hide content, unpublish a gathering, restrict a feature, suspend an account, or terminate it if these terms, the Community guidelines, or the law are breached.',
        'We prefer a warning for simple cases and try to correct issues through dialogue, but serious cases such as fraud, impersonation, or threats to safety may require immediate action without prior warning. If your account is terminated by mistake, contact us for review. You may also end this agreement by closing your account.',
      ),
    ),
    section(
      'Intellectual property',
      text(
        'The Founders Coffee name and logo, and the platform design and software, belong to us and may not be used without written permission.',
        'We respect copyright and related rights under Algerian Order 03-05 of 19 July 2003. Do not upload images, text, or logos you have no right to use.',
      ),
    ),
    section(
      'Availability and changes',
      text(
        'The platform is a pilot. Features may be added, changed, or withdrawn; the service is provided as it currently exists without a guaranteed outcome and may stop for maintenance or events outside our control. We may need to reinitialise data during this pilot.',
        'We do not promise that published content or attendance records will remain forever. We will notify you before a reinitialisation affects your account or content, with enough time to retrieve what belongs to you. If the service ends, we will give reasonable notice and delete data as described in the [Privacy policy](/privacy).',
      ),
    ),
    section('Limits of our responsibility', [
      ...text(
        'We are responsible for our own errors: operating the platform, protecting your data, and meeting these documents.',
        'We are not responsible for:',
      ),
      list([
        'what happens at a gathering or what attendees say or do;',
        'the accuracy of information members publish about themselves, their projects, or gatherings;',
        'deals, partnerships, or investments members make after meeting;',
        'a gathering being cancelled, postponed, or moved.',
      ]),
      ...text(
        'We do not exclude liability that the law does not allow us to exclude, including liability for physical injury, fraud, or gross negligence.',
        'This platform is a professional introduction tool. Verify the people you deal with before entering a work, investment, or partnership relationship.',
      ),
    ]),
    section(
      'Changes to these terms',
      text(
        'We may update these terms when the platform or law changes. We update the “last updated” date each time. For a material change affecting your rights or duties, we will notify you by email or in the platform before it takes effect. Continuing to use the platform after that date means you accept the new text.',
      ),
    ),
    section(
      'Applicable law and disputes',
      text(
        'These terms are governed by Algerian law. If a dispute arises, contact us first and we will respond to a serious complaint. If an amicable solution fails, the dispute belongs to the territorially competent court under Algerian jurisdiction rules.',
        'This does not affect your right to contact the competent regulators, including the National Authority for the Protection of Personal Data for matters concerning your data.',
      ),
    ),
    section(
      'If a company is incorporated',
      text(
        'The pilot may lead to incorporation of the legal entity that operates the platform. When that happens, these terms and their rights and duties will transfer to the company, which will replace the current operator in the agreement. We will notify you before the transfer, update the [Legal information](/legal) page, and explain the corresponding change of data controller in the [Privacy policy](/privacy). You may close your account before the transfer if you do not accept it.',
      ),
    ),
    section(
      'Contact',
      text(
        'For questions, complaints, and reports: **contact@founders.coffee**. The operator’s legal details are on the [Legal information](/legal) page.',
      ),
    ),
  ],
);
