import type { Locale } from '@founders-coffee/i18n';

import { textBlocks, type CompanyPageContent } from './types';

export const aboutContent: Record<Locale, CompanyPageContent> = {
  en: {
    title: 'About Founders Coffee',
    description:
      'Local founder communities that meet over coffee - real conversations, no formalities.',
    updated: '8 August 2026',
    sections: [
      {
        heading: 'What we are',
        blocks: textBlocks(
          'Founders Coffee helps entrepreneurs find and host small work meetups at real cafés. The goal is simple: start partnerships and friendships over coffee, not pitch decks.',
          'We currently support communities in Algeria, Egypt, and Saudi Arabia, with Arabic, English, and French.',
        ),
      },
      {
        heading: 'How it works',
        blocks: textBlocks(
          'Browse your city, join an upcoming meetup, or host the first one when the calendar is empty.',
          'Hosting takes a few steps: pick a café, set a time, and share what the session is about. Guests RSVP and show up ready to talk shop - casually.',
        ),
      },
      {
        heading: 'Who it is for',
        blocks: textBlocks(
          'Builders, operators, and early-stage founders who want real relationships in their city. You do not need a deck, a title, or an invitation - only curiosity and respect for the table.',
        ),
      },
      {
        heading: 'Our principles',
        blocks: textBlocks(
          'Meetups stay human-scale and informal. If sponsors appear, they are disclosed - never covert. You own your relationships; we provide the table.',
        ),
      },
    ],
  },
  ar: {
    title: 'من نحن',
    description:
      'مجتمعات رواد أعمال تلتقي حول القهوة - حوارات حقيقية بلا رسميات.',
    updated: '8 أغسطس 2026',
    sections: [
      {
        heading: 'من نحن',
        blocks: textBlocks(
          'Founders Coffee يساعد رواد الأعمال على إيجاد واستضافة لقاءات عمل صغيرة في مقاهٍ حقيقية. الهدف بسيط: تبدأ الشراكات والصداقات حول فنجان قهوة، لا حول عروض تقديمية.',
          'ندعم حالياً مجتمعات في الجزائر ومصر والسعودية، بالعربية والإنجليزية والفرنسية.',
        ),
      },
      {
        heading: 'كيف يعمل',
        blocks: textBlocks(
          'تصفّح مدينتك، انضم إلى لقاء قادم، أو كن أول من يستضيف عندما لا يوجد لقاء بعد.',
          'الاستضافة تتم بخطوات بسيطة: اختر مقهى، حدّد الوقت، وشارك موضوع الجلسة. الضيوف يؤكدون الحضور ويأتون للحوار - بلا رسميات.',
        ),
      },
      {
        heading: 'لمن المنصة',
        blocks: textBlocks(
          'للصنّاع والمشغّلين ورواد المراحل المبكرة الذين يريدون علاقات حقيقية في مدينتهم. لا تحتاج عرضاً تقديمياً أو لقباً أو دعوة - فقط فضولاً واحتراماً للطاولة.',
        ),
      },
      {
        heading: 'مبادئنا',
        blocks: textBlocks(
          'اللقاءات تبقى إنسانية وبلا رسميات. إن وُجد رعاة، يُعلَن عنهم بوضوح - لا إخفاء. علاقاتك ملكك؛ نحن نوفّر الطاولة.',
        ),
      },
    ],
  },
  fr: {
    title: 'À propos de Founders Coffee',
    description:
      'Des communautés de fondateurs qui se retrouvent autour d’un café - de vraies conversations, sans formalités.',
    updated: '8 août 2026',
    sections: [
      {
        heading: 'Qui nous sommes',
        blocks: textBlocks(
          'Founders Coffee aide les entrepreneurs à trouver et organiser de petits meetups de travail dans de vrais cafés. L’objectif est simple : démarrer des partenariats et des amitiés autour d’un café, pas d’un pitch deck.',
          'Nous couvrons aujourd’hui l’Algérie, l’Égypte et l’Arabie saoudite, en arabe, anglais et français.',
        ),
      },
      {
        heading: 'Comment ça marche',
        blocks: textBlocks(
          'Parcourez votre ville, rejoignez un meetup à venir, ou organisez le premier lorsqu’il n’y en a pas encore.',
          'Héberger prend quelques étapes : choisir un café, fixer l’heure, et préciser le sujet. Les invités confirment et viennent discuter - sans formalités.',
        ),
      },
      {
        heading: 'Pour qui',
        blocks: textBlocks(
          'Pour les builders, opérateurs et fondateurs early-stage qui veulent de vraies relations dans leur ville. Pas besoin de deck, de titre ou d’invitation - seulement de la curiosité et du respect pour la table.',
        ),
      },
      {
        heading: 'Nos principes',
        blocks: textBlocks(
          'Les rencontres restent humaines et informelles. Si des sponsors apparaissent, ils sont divulgués - jamais cachés. Vos relations vous appartiennent ; nous fournissons la table.',
        ),
      },
    ],
  },
};
