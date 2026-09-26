import {
  list,
  page,
  section,
  subheading,
  table,
  text,
} from './legal-translated';
import type { CompanyPageContent } from './types';

export const privacyEnglish: CompanyPageContent = page(
  'Privacy policy',
  'What personal data Founders Coffee collects, why we use it, who can access it, how long we keep it, and your rights.',
  [
    section(
      'Scope of this policy',
      text(
        'This policy explains what personal data Founders Coffee collects, why, who can access it, how long we retain it, and what you can do about it.',
        '**The data controller** is **Amine Yagoub**, an individual. No company has yet been incorporated to operate this free pilot. The law’s definition of a controller covers individuals as well as companies. Contact: **contact@founders.coffee**.',
        'If a company is incorporated later, the controller identity will change. We will notify you before that change takes effect, as described in the amendments section.',
        'We process data under Algerian Law 18-07 of 10 June 2018 on the protection of natural persons in personal-data processing, as amended by Law 25-11 of 24 July 2025.',
      ),
    ),
    section('What we collect and why', [
      ...text(
        'We do not collect data vaguely “to improve your experience”. Each category below has a specific purpose tied to a feature.',
      ),
      subheading('Account data'),
      ...text(
        'Your name, email address and verification status, optional profile photo, interface language, and account creation date. We use these to create your account, send login codes, show your name to people you meet, and contact you about gatherings you joined. We do not use or store passwords.',
        'If you use Google or GitHub, we receive your provider identifier and email, not your password.',
        '**Required and optional.** Name and email are required to create an account. Everything else is optional; declining it only disables the related feature. Phone number is optional and is collected only if you enable SMS alerts.',
      ),
      subheading('Profile'),
      ...text(
        'A short introduction, interests, languages, professional link, and photo. These fields are optional and hidden until you publish them. Your name and photo are shown to people sharing a gathering with you; other fields are shown only when you choose to publish them. Public profile content may be found by search engines.',
      ),
      subheading('Gatherings and RSVPs'),
      ...text(
        'For a gathering you publish, we store its title, description, venue, address, coordinates, time, and language; these are public so the gathering can be discovered. For an RSVP, we store the RSVP, its status, and date. The host sees your name only in the attendee list, not your email or phone number, and has no direct messaging feature. If you voluntarily join a Telegram group linked to the gathering, Telegram members can see and message you there.',
      ),
      subheading('Telegram gathering groups'),
      ...text(
        'A host may link their own Telegram group to a gathering, and people who RSVP may join it. Linking and joining are optional; choosing not to use this option does not affect your RSVP or reminders.',
        'When a group is linked, we store **its Telegram identifier and name**. If you request to join, we create **a unique invitation link** for you. When Telegram sends your request through that link, we store **your Telegram account identifier** so we can verify your RSVP, approve the request, and remove you if you cancel. Telegram sends other account data with the request, but we do not store it or ask for your phone number.',
        'Because the bot is a group administrator, Telegram sends it the group’s messages. We do not store or record them; we only check the host’s linking command and ignore everything else. The bot posts only public gathering details and changes, a reminder one day before, a cancellation notice when applicable, the city’s next gatherings when the gathering ends, and a notice to the host if linking fails.',
        '**Inside the group, your account appears to members and the host as Telegram displays it, and they can message you there.** Whether your phone number is visible is controlled by your Telegram privacy settings, not by the platform; we remind you before you request an invitation link. Telegram is an independent service, and your account and chats are handled under its own terms and privacy policy.',
        'The group link ends one day after the gathering, or when the host unlinks or cancels it. The bot then revokes the invitation links it created and leaves the group, unless the host links it to another gathering. If the host removes the bot earlier, the link ends immediately. In all cases, the group remains with the host and its members, and no messages reach us after the bot leaves.',
      ),
      subheading('Attendance and post-gathering feedback'),
      ...text(
        'After a gathering, the host records actual attendance, no-shows, walk-ins, and a private note. If you attended, you may leave a rating about value, whether you would return, and an optional written comment. We store the comment language and display the comment as written; we do not translate it.',
        'We use these records to understand whether gatherings happen and help protect the community from fake gatherings or hosts who never appear. Your feedback is private: hosts see aggregate results without names or comments, and no rating appears on the public gathering page.',
      ),
      subheading('Preferences and notifications'),
      ...text(
        'Your choices about reminders, gathering changes, host RSVP notifications, and delivery channels. If you enable push notifications, we store a device token and platform type. The token is a technical device identifier and does not reveal content or location.',
      ),
      subheading('Technical data and security logs'),
      ...text(
        'For each login session we store your IP address, browser description, and session expiry, plus technical request logs. This is limited to keeping you signed in, detecting unauthorised access or abuse, and diagnosing faults. A human-verification service receives your IP when you sign in or join a city waitlist for that purpose only.',
        'We measure platform use with aggregate server counters and do not attribute them to a person. **We do not use browser analytics, advertising trackers, or sell data.**',
      ),
      subheading('Messages and reports'),
      ...text(
        'We retain support messages, complaints, content reports, and our replies to follow up and document moderation decisions.',
      ),
      subheading('City waitlists'),
      ...text(
        'If a city has no gatherings, you may leave your email so we can notify you when its first gathering launches. We store the email, city, language, and request date for one notification only; it is not a marketing list.',
      ),
    ]),
    section('Legal basis for processing', [
      ...text(
        'Each processing activity relies on a basis recognised by Article 7 of Law 18-07:',
      ),
      list([
        '**Performance of our contract:** accounts, publishing, RSVPs, and reminders or alerts about a gathering you joined.',
        '**Your explicit consent:** public profile fields, push or SMS notifications, city waitlists, and Telegram links or membership. You can withdraw consent at any time; withdrawal does not affect earlier lawful processing.',
        '**Legitimate interest:** platform security, abuse prevention, and attendance records used to protect the community from fake gatherings. We balance this against your rights, keep records private, and let you correct them.',
        '**Legal obligation:** when a law requires us to retain or provide data.',
      ]),
      ...text(
        '**We do not currently do direct marketing.** Any future newsletter or promotional message would require prior consent, a free unsubscribe method, and cancellation handling within 24 hours as required by Article 32 of Law 18-05.',
      ),
    ]),
    section(
      'Who can access your data',
      text(
        '**Other members** see your name, photo, and anything you publish, and see you in the attendee list for a gathering you share.',
        '**The host** sees your name and records attendance. The [Organizer terms](/organizers) prohibit using the list for offers or a separate database.',
        '**Telegram group members**, if you join, see and can message you as Telegram displays you. Telegram is independent and receives bot messages about the gathering, join approval, and removal after cancellation.',
        '**Technical providers** process only what their task requires: hosting, email, push, maps, bot protection, or SMS. They process data for us under instructions and may not use it for their own purposes.',
        '**Authorities** may receive data when legally required; we verify the request and provide only what is required. **We do not sell, rent, or exchange your data with advertisers.**',
      ),
    ),
    section(
      'Transfers outside Algeria',
      text(
        'Our distributed cloud infrastructure and the providers above are outside Algeria, so your data is processed and stored outside the country. Telegram processes group-related data outside Algeria under its own terms.',
        'We rely on Article 45 of Law 18-07: your explicit consent and the necessity of the transfer to perform our contract, because the account and notifications cannot operate without this infrastructure. We use providers with recognised safeguards, encrypted connections, and limited access. If the competent authority later issues a specific authorisation, we will update this section. You may withdraw consent and request account closure if the transfer is unacceptable to you.',
      ),
    ),
    section('Retention', [
      ...text(
        'We keep data only as long as needed for its purpose, then delete or anonymise it.',
      ),
      table(
        ['Category', 'Retention'],
        [
          [
            'Account and profile data',
            'While the account exists, then deleted within **30 days** of closure',
          ],
          [
            'Session logs (IP, browser)',
            'Deleted within **90 days** after the session ends',
          ],
          [
            'Published gatherings',
            'Part of the public city history; separated from the host’s name when their account closes',
          ],
          ['RSVPs and attendance', '**24 months** after the gathering'],
          [
            'Post-gathering feedback',
            'Comment attributed to its author for **12 months**, then retained without identity',
          ],
          [
            'Telegram invitation link and account identifier',
            'Until cancellation or the group link ends, usually about one day after the gathering; longer only when needed to remove you',
          ],
          ['Telegram group identifier and name', 'With the gathering record'],
          [
            'Push tokens',
            'Until push is disabled or the token becomes invalid',
          ],
          [
            'City waitlist email',
            'Until the launch notice, then **12 months**, or immediately on request',
          ],
          [
            'Messages and moderation reports',
            '**24 months** after the request closes',
          ],
          ['Data required by law', 'The period required by that law'],
        ],
      ),
    ]),
    section('Your rights and how to use them', [
      ...text('Law 18-07 gives you these rights:'),
      list([
        '**Information** (Article 32): know who processes your data, why, who receives it, and whether it is transferred abroad.',
        '**Access** (Article 34): receive confirmation, purposes, categories, recipients, an understandable copy, and available source information. Excessively abusive repeated requests may be refused as the law allows.',
        '**Correction** (Article 35): update, correct, delete, or lock incomplete, inaccurate, or unlawful data. We do this free of charge within **10 days** and notify recipients when required.',
        '**Objection** (Article 36): object for legitimate reasons, and object to prospecting without giving a reason.',
        '**Withdrawal of consent** (Article 7): at any time for processing based on consent.',
      ]),
      ...text(
        'Some rights are available in the platform: edit your profile and visibility settings, or notification preferences. For access copies, attendance corrections, or account closure, email **contact@founders.coffee** from your account email and state the request clearly. Attendance records are personal data and can be corrected within the same deadline.',
      ),
    ]),
    section(
      'Data security',
      text(
        'Connections are encrypted. Login uses a short-lived code, so there is no password to leak. Production access is limited to a small group behind independent authentication, and moderation actions are logged. Anyone who accesses data through their role is bound by professional confidentiality under Article 40 of Law 18-07.',
        'No system is risk-free. Report vulnerabilities or suspicious behaviour to us and we will investigate seriously.',
      ),
    ),
    section(
      'What we do after a breach',
      text(
        'If a breach affects personal data, we notify the National Authority for the Protection of Personal Data without delay and within five days of learning about it, as required by Article 43 of Law 18-07. We notify you directly when the breach may affect your private life, explain what happened and what we did, and keep an internal breach record.',
      ),
    ),
    section(
      'Cookies',
      text(
        'We use a limited number of cookies and none for advertising or tracking. Details are in the [Cookie policy](/cookies).',
      ),
    ),
    section(
      'Minors',
      text(
        'The platform is for people aged **nineteen (19)**, the age of civil majority in Algeria. We do not knowingly collect minors’ data. If we discover a minor’s account, we suspend it and delete related data. A guardian may contact us about an account created by a minor.',
      ),
    ),
    section(
      'Changes to this policy',
      text(
        'We may update this policy when the platform or law changes, and update the “last updated” date. We notify you in advance of a material change to what we collect, why, or who receives it. A change of controller when a company is incorporated is material; we will email the company identity and let you close your account before it takes effect.',
      ),
    ),
    section(
      'Contact and complaints',
      text(
        'For questions and rights requests: **contact@founders.coffee**. If our response does not satisfy you, you may complain to the **National Authority for the Protection of Personal Data (ANPDP)**, the competent supervisory authority in Algeria.',
      ),
    ),
  ],
);
