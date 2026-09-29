import {
  list,
  section,
  subheading,
  table,
  text,
  translatedPage,
} from './legal-translated';
import type { CompanyPageContent } from './types';

export const privacyEnglish: CompanyPageContent = translatedPage(
  'en',
  'Privacy policy',
  'What personal data Founders Coffee collects, why we use it, who can access it, how long we keep it, and your rights.',
  [
    section(
      'Scope of this policy',
      text(
        'This policy explains what personal data Founders Coffee collects, why, who can access it, how long we retain it, and what you can do about it.',
        '**The data controller** is **Amine Yagoub**, an individual. No company has yet been incorporated to operate this free pilot. The law’s definition of a controller covers individuals as well as companies, and a controller’s obligations toward your data are the same in both cases. Contact for anything about your data: **contact@founders.coffee**.',
        'If a company is incorporated later, the role of controller will pass to it. That is a change in who holds your data, not an administrative detail, so we will notify you before it takes effect, as described in section 12.',
        'We process data under the Algerian law on the protection of natural persons in personal-data processing, because we operate the platform from Algeria.',
        'If the law of the country where you live gives you more protection than this policy, we honour it for you.',
      ),
    ),
    section('What we collect and why', [
      ...text(
        'We do not collect data vaguely “to improve your experience”. Each category of data below has a specific reason that can be traced to a feature that exists on the platform.',
      ),
      subheading('Account data'),
      ...text(
        'Your name, email address and its verification status, interface language, and account creation date. We use these to create your account, send you a login code each time you sign in, show your name on your public profile and to people you meet, and contact you about gatherings you joined. We do not use or keep passwords; you sign in with a temporary code sent to your email.',
        'If you use Google or GitHub, the account you choose sends us your identifier with it, your email, your name and the address of your picture, never your password. We keep the identifier, so we recognise you next time, along with your email and name. We do not keep the picture’s address, or the access keys the provider issues to us, which we need only while you sign in. You can withdraw this permission at any time in your Google or GitHub account settings.',
        '**Required and optional.** Your email is required to create an account, since we cannot send you a login code without it; if you do not provide it, the account cannot be created. Everything else in this policy is optional, and not providing it only disables the feature it relates to.',
        '**Your name.** We do not ask for a name when you sign up. If you sign in with Google or GitHub, we use the name that account gives us, which on GitHub is your username if you have not set a name. Otherwise we make your name from the part of your email address before the @, so sara.benali@example.com becomes “Sara Benali”; if that part has no letters, for example if it is only digits, your name stays empty until you choose one. The name is public, like every name on the platform, **so anyone who sees it may be able to guess your address**. You can change it at any time in your profile.',
        '**Phone number** is optional. We do not ask for it at sign-up. If you add one on your account page, we send it to **Twilio**, which texts you a code that confirms the number is yours. After that we use it only if you enable SMS alerts yourself, in which case we record the date you agreed to them.',
      ),
      subheading('Profile'),
      ...text(
        'Your profile can include an introduction about you, what you are building and its stage, your interests, your languages, your professional link, and your photo.',
        'Your name, photo, introduction, the month you joined, and the number of gatherings you hosted appear on your public profile. What you are building and its stage, your interests, languages, professional link, and the number of gatherings you attended appear only if you publish them.',
        'Each optional field has its own visibility switch and starts hidden. You can delete your photo and introduction at any time. Your public profile is open to anyone with its link, and profile pages ask search engines not to index them.',
      ),
      subheading('Gatherings and RSVPs'),
      ...text(
        'For a gathering you publish, we store its title, description, venue, address, coordinates, time, and language; these are public so the gathering can be discovered.',
        'For an RSVP, we store the RSVP, its status, and date. The host sees **only your name** in the attendee list, because they need to know who to expect and book the venue accordingly. **The host does not see your email or phone number**, and the platform gives them no way to message you directly. However, if the host links a Telegram group to the gathering and you choose to join it, they see you there and can message you there like any other member, as explained below.',
      ),
      subheading('Telegram gathering groups'),
      ...text(
        'A host may link their own Telegram group to a gathering, and people who RSVP may join it. Linking and joining are optional; choosing not to use this option does not affect your RSVP or reminders.',
        'When a group is linked, we store **its Telegram identifier and name**. If you request to join, we create **a unique invitation link** for you. When Telegram sends your request through that link, we store **your Telegram account identifier** so we can verify your RSVP, approve the request, and remove you if you cancel your RSVP. Telegram sends other account data with the request, but we do not store it or ask for your phone number.',
        'Because the bot is a group administrator, Telegram sends it the group’s messages. We do not store or record them; we only check the host’s linking command and ignore everything else. The bot posts only public gathering details and changes, a reminder one day before, a cancellation notice when applicable, the city’s next gatherings when the gathering ends, and a notice to the host if linking fails.',
        '**Inside the group, your account appears to members and the host as Telegram displays it, and they can message you there.** Whether your phone number is visible is controlled by your Telegram privacy settings, not by the platform; we remind you before you request an invitation link. Telegram is an independent service, and your account and chats are handled under its own terms and privacy policy.',
        'The group link ends one day after the gathering, or when the host removes the link or cancels the gathering. The bot then revokes the invitation links it created and leaves the group, unless the host links it to another gathering. If the host removes the bot earlier, the link ends immediately. In all cases, the group remains with the host and its members, and no messages reach us after the bot leaves.',
      ),
      subheading('Attendance and post-gathering feedback'),
      ...text(
        'After a gathering, the host records who actually attended and who did not, the number of people who came without an RSVP, and a private note about how it went.',
        'If you attended, you may leave a rating: how valuable it was, whether you would return, and an optional written comment. We store the comment’s language with it, because we display the comment as written and do not translate it.',
        'We use these records to know whether gatherings really take place and benefit those who attend, and to detect fake gatherings and hosts who do not show up to their own gatherings.',
        'Your feedback is private. The host sees aggregate results for their gathering, without names or comments. **Comments are deliberately left out of those results**: at a gathering of four people, showing three comments would reveal who wrote them even without names. No rating appears on the public gathering page.',
      ),
      subheading('Preferences and notifications'),
      ...text(
        'Your choices about reminders, gathering changes, host RSVP notifications, and delivery channels. If you enable push notifications, we store a device token and platform type. The token is a technical device identifier and does not reveal content or location.',
      ),
      subheading('Technical data and security logs'),
      ...text(
        'For each login session we store your **IP address**, browser description, and session expiry. We also keep technical logs of requests to our server.',
        'The purpose is limited to three things: keeping you signed in, detecting unauthorised sign-in attempts and abuse, and diagnosing faults.',
        'We also use a human-verification service when you sign in and when you join a city waitlist; it receives your IP address for that purpose only.',
        'Every page also runs a Cloudflare script that detects automated programs: it examines technical characteristics of your browser and sets a security cookie, as detailed in the [Cookie policy](/cookies).',
        'We measure platform use with aggregate server counters (number of requests, gatherings published, failure rates), which are not attributed to anyone.',
        'We also use **Cloudflare Web Analytics** to measure visits: every page loads a script that sends Cloudflare the page address, the address of the page you came from, and load-speed measurements, along with your IP address and a description of your browser and device, as with any connection. We only see aggregate figures from it; it sets no cookie and does not recognise you from one visit to the next. **We do not use advertising trackers, and we do not sell data to anyone.**',
      ),
      subheading('Maps and place search'),
      ...text(
        'The platform shows maps through **Mapbox** when you create a gathering or edit its venue, and on the page of a gathering with a venue. Your browser loads the map directly from Mapbox, which therefore receives your IP address, a description of your browser, and the area the map shows. The map library also stores a random identifier in your browser and sends it to Mapbox with technical usage data that Mapbox uses to count use of its service; Mapbox processes that data under its own privacy policy.',
        'When you search for a venue or pick a point on the map, our server sends your search text or the point’s position, with the area being shown, to Mapbox to find matching places. We do not send your name or email with it.',
        'If you press “Locate me” on the map where you choose a gathering’s venue, your browser gives the page your location, if you allow it to, and the map moves there. Your browser then loads the map of that area from Mapbox and sends the map’s centre to our server so we can show you the places near it, as happens when you move the map yourself. We ask for your location only when you press the button, and we do not save it to your account.',
      ),
      subheading('Messages and reports'),
      ...text(
        'We retain support messages, complaints, content reports, and our replies to follow up and document moderation decisions.',
      ),
      subheading('City waitlists'),
      ...text(
        'If you search for a city that has no upcoming gatherings, you can leave your email so we can tell you when its next gathering is published. We store the email, city, language, and request date, and do not require an account.',
        'This email is used for that purpose only: one notice when the city’s next gathering is published. It is not added to a marketing list or used for anything you did not ask for.',
      ),
    ]),
    section('Legal basis for processing', [
      ...text('Each processing activity relies on a basis the law recognises:'),
      list([
        '**Performance of our contract:** your account, your public profile (your name, your photo and introduction if you add them, the month you joined, and the number of gatherings you hosted), publishing gatherings, RSVPs, and reminders and alerts about a gathering you joined. These are not extra services but the core of what you signed up for.',
        '**Your explicit consent:** publishing the optional profile fields that each have a visibility switch, enabling push or SMS notifications, joining a city waitlist, and linking or joining a Telegram group for a gathering. You can withdraw consent at any time; withdrawal does not affect the lawfulness of what was done before.',
        '**Legitimate interest:** platform security, abuse prevention, measuring platform use with aggregate figures not attributed to anyone, and attendance records as a way to protect the community from fake gatherings. We have balanced this interest against your rights, which is why we do not show attendance records publicly and let you correct them.',
        '**Legal obligation:** when a law requires us to retain or provide data.',
      ]),
      ...text(
        '**We do not do direct marketing.** Every message you receive today relates to a gathering or to your account. If we ever decide to send a newsletter or promotional messages, it will only be with your prior consent and a free way to unsubscribe in every message, and we will act on an unsubscribe request **within twenty-four (24) hours**.',
      ),
    ]),
    section(
      'Who can access your data',
      text(
        '**Any visitor to the platform**, even without an account, sees your public profile: your name, photo, introduction, the month you joined, the number of gatherings you hosted, and any optional fields you published.',
        '**Other members** also see you in the attendee list for a gathering you share.',
        '**The host** sees your name in the attendee list and records whether you attended. Under the [Organizer terms](/organizers), the host must use this list only to organise their gathering; using it to send offers or build a database is a violation that leads to account suspension.',
        '**Telegram group members**, if you join the gathering’s group, see you as Telegram displays you and can message you there. **Telegram** itself is an independent party that does not act on our behalf; it receives from us what the bot posts about the gathering, the approval of your join request, and your removal if you cancel your RSVP.',
        '**Google or GitHub**, if you sign in with one of them: each is an independent party that does not act on our behalf. It learns that you signed in to our platform, sends us what is described under “Account data” above, and processes this under its own privacy policy.',
        '**Technical service providers** we rely on, each within the limits of its task: **Cloudflare** for hosting the application, the database and photos, sending email, measuring visits, and bot protection; **Mapbox** for showing maps and searching for places; **Firebase**, from Google, for delivering push notifications if you enable them; and **Twilio** for texting you a verification code if you add a phone number, and for sending SMS alerts if you enable them. They process data on our instructions and on our behalf and may not use it for their own purposes, except for the usage data Mapbox maps send, which Mapbox also processes under its own privacy policy.',
        '**Competent authorities**, when the law requires us to provide data. We verify who is asking and that the request stays within what the law allows them, and provide only what is required.',
        '**We do not sell, rent, or exchange your data with advertisers.**',
      ),
    ),
    section(
      'Transfers outside your country',
      text(
        'We state this explicitly because the law requires it, and because it concerns you.',
        'The platform runs on distributed cloud infrastructure, and the providers named in the previous section are based outside the countries where we operate, and **the main copy of our database is in Western Europe**. **Your data is therefore processed and stored outside your country.** When a Telegram group is linked to a gathering, what reaches Telegram from us about it and about those who join is also processed outside your country, on Telegram’s servers and under its terms.',
        'We rely on **the transfer being necessary to perform our contract with you**: your account cannot run, nothing you ask of the platform can be provided, and no notification can reach you without the data passing through this infrastructure. In return, we contract with providers committed to recognised protection standards, encrypt connections, and limit what reaches each provider to what its task requires.',
        'This is the basis we rely on today, not a prior authorisation from a data protection authority, although some laws also provide for one. If we later obtain an authorisation for this transfer, we will update this section and refer to it.',
        'If this transfer is not acceptable to you, you can ask us to close your account, and we will do so.',
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
            'Until you cancel your RSVP or the group link ends, about one day after the gathering, then deleted. If the identifier is needed to remove you from the group, it is kept until the removal is done or becomes permanently impossible',
          ],
          ['Telegram group identifier and name', 'With the gathering record'],
          [
            'Push tokens',
            'Until push is disabled or the token becomes invalid',
          ],
          [
            'City waitlist email',
            'Until the notice is sent, then **12 months**, or immediately on request',
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
      ...text(
        'Wherever you live, you have the following rights, and we honour them for everyone alike:',
      ),
      list([
        '**Information**: to know who processes your data, for what purpose, who receives it, and whether it is transferred abroad. This document is how we meet this right.',
        '**Access**: to get confirmation that your data is processed, its purposes, the categories of data and the recipients, a copy in an understandable form, and what is available about its source. We refuse only clearly abusive requests (by their number or repetition), and the burden of proving that falls on us, not on you.',
        '**Correction**: to have your data updated, completed, corrected, erased, or locked if it is incomplete, inaccurate, or processed unlawfully. **We do this within ten (10) days** of your request. If we have disclosed your data to others, we inform them of the correction.',
        '**Erasure**: to have your data deleted once it is no longer needed for the purpose it was collected for, or once you withdraw the consent it was based on, unless a law requires us to keep it.',
        '**Restriction**: to have the processing of your data limited to a specific purpose.',
        '**Objection**: to object on legitimate grounds to processing that concerns you, and to object to the use of your data for prospecting without having to give a reason.',
        '**Breach notice**: to be told of every breach that affects your data, as described in “What we do after a breach”.',
        '**Withdrawal of consent**: at any time, for everything based on your consent.',
      ]),
      ...text(
        '**Free and prompt.** Using any of these rights costs you nothing. **We answer every request within six (6) working days** of receiving it, and if we refuse one, we give you our reasons in writing.',
        '**How to use them.** Some of these rights are available directly in the platform: edit your profile and visibility switches on the profile page, and your notification preferences on the preferences page. For everything else (including a copy of your data, correcting an attendance record, and closing your account), email **contact@founders.coffee** from the address registered on your account and state your request clearly.',
        '**Correcting an attendance record** deserves a special mention: if a host recorded that you did not attend a gathering you attended, or the reverse, that is personal data about you, and you have the right to have it corrected within the same correction deadline. Write to us and we will review the record.',
      ),
    ]),
    section(
      'Data security',
      text(
        'Connections to the platform are fully encrypted. Sign-in uses a temporary code that expires quickly, so there is no password to leak. Administrative access to production data is limited to a small number of people behind an independent verification layer, and moderation actions are logged.',
        'Everyone who accesses data through their role is bound by professional secrecy, even after their relationship with us ends.',
        'Still, no system is risk-free. If you notice a vulnerability or suspicious behaviour, write to us and we will handle the report seriously and gratefully.',
      ),
    ),
    section(
      'What we do after a breach',
      text(
        'If a breach affects your personal data, we notify the competent data protection authorities without delay, and within seventy-two (72) hours of learning of it at most.',
        'We also tell you directly, by email, within three (3) working days of notifying those authorities, in plain language: what happened, what may result from it, and what we have done.',
        'We keep an internal record of every breach and what was done about it.',
      ),
    ),
    section(
      'Cookies',
      text(
        'We use a limited number of cookies and none for advertising or cross-site tracking. Outside services for measuring visits, detecting automated programs, and showing maps also run in your browser. Details are in the [Cookie policy](/cookies).',
      ),
    ),
    section(
      'Minors',
      text(
        'The platform is for adults: people who have reached the age of civil majority under both the law of their nationality and the law of the country where they live, and are at least **nineteen (19)**. We do not knowingly collect minors’ data. If we find that an account belongs to a minor, we suspend it and delete the related data.',
        'If you are a guardian and believe a minor in your care has created an account, write to us and we will act.',
      ),
    ),
    section(
      'Changes to this policy',
      text(
        'We may amend this policy if the platform or the law changes. We update the “last updated” date each time, and notify you in advance of any material change to what we collect, why we collect it, or who receives it.',
        'A change of controller, meaning the platform passing from the current operator to the company once it is incorporated, is a material change in this sense. We will notify you of it by email before it takes effect, with the company’s identity, and you remain free to close your account before then if the transfer does not suit you.',
      ),
    ),
    section(
      'Contact and complaints',
      text(
        'For questions and requests to exercise your rights: **contact@founders.coffee**',
        'If our reply does not satisfy you, you have the right to complain to **the personal data protection authority in your country**.',
      ),
    ),
  ],
  '29 September 2026',
);
