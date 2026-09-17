import type { Locale } from '@founders-coffee/i18n';

import { CONTACT_EMAIL } from './contact';
import type { CompanyPageContent } from './types';

export const termsContent: Record<Locale, CompanyPageContent> = {
  en: {
    title: 'Terms',
    description:
      'Terms of use for Founders Coffee - accounts, hosting, and community rules.',
    updated: '8 August 2026',
    sections: [
      {
        heading: 'Agreement',
        paragraphs: [
          'By using Founders Coffee you agree to these Terms and our Privacy notice. If you do not agree, do not use the service.',
        ],
      },
      {
        heading: 'The service',
        paragraphs: [
          'Founders Coffee is a platform to discover and host informal founder meetups at cafés. Meetups are organized by users. We do not guarantee attendance, outcomes, or venue availability.',
        ],
      },
      {
        heading: 'Accounts',
        paragraphs: [
          'You must provide a valid email and keep access to it. You are responsible for activity under your account. Do not share one-time codes.',
        ],
      },
      {
        heading: 'Hosting & conduct',
        paragraphs: [
          'Hosts must provide accurate meetup details and treat attendees respectfully. No harassment, hate, illegal activity, or spam. We may remove content or suspend accounts that break these rules.',
          'Cafés are third-party venues. Respect their staff, space, and any purchase expectations.',
        ],
      },
      {
        heading: 'Sponsorships',
        paragraphs: [
          'Any sponsorship on Founders Coffee must be disclosed. Covert promotions are not allowed.',
        ],
      },
      {
        heading: 'Disclaimer & liability',
        paragraphs: [
          'The service is provided “as is.” To the fullest extent permitted by law, we are not liable for indirect damages, lost opportunities, or disputes between users arising from meetups.',
          `Questions: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  ar: {
    title: 'الشروط',
    description:
      'شروط استخدام Founders Coffee - الحسابات والاستضافة وقواعد المجتمع.',
    updated: '8 أغسطس 2026',
    sections: [
      {
        heading: 'الاتفاق',
        paragraphs: [
          'باستخدامك Founders Coffee فإنك توافق على هذه الشروط وإشعار الخصوصية. إن لم توافق، لا تستخدم الخدمة.',
        ],
      },
      {
        heading: 'الخدمة',
        paragraphs: [
          'Founders Coffee منصة لاكتشاف واستضافة لقاءات عمل غير رسمية في المقاهي. اللقاءات ينظّمها المستخدمون. لا نضمن الحضور أو النتائج أو توفّر المكان.',
        ],
      },
      {
        heading: 'الحسابات',
        paragraphs: [
          'يجب توفير بريد صالح والحفاظ على الوصول إليه. أنت مسؤول عن النشاط عبر حسابك. لا تشارك رموز التحقق لمرة واحدة.',
        ],
      },
      {
        heading: 'الاستضافة والسلوك',
        paragraphs: [
          'يجب على المضيف تقديم تفاصيل دقيقة ومعاملة الحضور باحترام. يُمنع التحرش أو خطاب الكراهية أو النشاط غير القانوني أو الرسائل المزعجة. قد نزيل المحتوى أو نعلّق الحسابات المخالِفة.',
          'المقاهي جهات خارجية. احترم طاقمها ومساحتها وأي توقعات شراء.',
        ],
      },
      {
        heading: 'الرعاية',
        paragraphs: [
          'أي رعاية على Founders Coffee يجب أن تكون معلَنة. الترويج المخفي غير مسموح.',
        ],
      },
      {
        heading: 'إخلاء المسؤولية',
        paragraphs: [
          'تُقدَّم الخدمة «كما هي». في أقصى حد يسمح به القانون، لسنا مسؤولين عن أضرار غير مباشرة أو فرص ضائعة أو نزاعات بين المستخدمين بسبب اللقاءات.',
          `للاستفسارات: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  fr: {
    title: 'Conditions',
    description:
      'Conditions d’utilisation de Founders Coffee - comptes, organisation et règles communautaires.',
    updated: '8 août 2026',
    sections: [
      {
        heading: 'Accord',
        paragraphs: [
          'En utilisant Founders Coffee, vous acceptez ces Conditions et notre notice de confidentialité. Sinon, n’utilisez pas le service.',
        ],
      },
      {
        heading: 'Le service',
        paragraphs: [
          'Founders Coffee est une plateforme pour découvrir et organiser des meetups informels de fondateurs dans des cafés. Les meetups sont organisés par les utilisateurs. Nous ne garantissons ni la présence, ni les résultats, ni la disponibilité des lieux.',
        ],
      },
      {
        heading: 'Comptes',
        paragraphs: [
          'Vous devez fournir un e-mail valide et en conserver l’accès. Vous êtes responsable de l’activité sur votre compte. Ne partagez pas les codes à usage unique.',
        ],
      },
      {
        heading: 'Organisation & conduite',
        paragraphs: [
          'Les hôtes doivent fournir des détails exacts et traiter les participants avec respect. Pas de harcèlement, de haine, d’activité illégale ou de spam. Nous pouvons retirer du contenu ou suspendre des comptes.',
          'Les cafés sont des tiers. Respectez leur équipe, leur espace et leurs attentes.',
        ],
      },
      {
        heading: 'Sponsoring',
        paragraphs: [
          'Tout sponsoring sur Founders Coffee doit être divulgué. Les promotions dissimulées sont interdites.',
        ],
      },
      {
        heading: 'Responsabilité',
        paragraphs: [
          'Le service est fourni « en l’état ». Dans la mesure permise par la loi, nous ne sommes pas responsables des dommages indirects, opportunités perdues, ou litiges entre utilisateurs liés aux meetups.',
          `Questions : ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
};
