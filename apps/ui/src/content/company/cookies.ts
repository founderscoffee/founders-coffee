import type { Locale } from '@founders-coffee/i18n';

import { CONTACT_EMAIL } from './contact';
import type { CompanyPageContent } from './types';

export const cookiesContent: Record<Locale, CompanyPageContent> = {
  en: {
    title: 'Cookies',
    description: 'How founders.coffee uses cookies and similar technologies.',
    updated: '8 August 2026',
    sections: [
      {
        heading: 'Essential only',
        paragraphs: [
          'We use cookies and similar storage only as needed to run the product securely. We do not use advertising cookies, and we do not run third-party analytics unless we add them later and update this page.',
        ],
      },
      {
        heading: 'What we store',
        paragraphs: [
          'Locale preference - remembers Arabic, English, or French.',
          'Session cookies - keep you signed in after email verification (Better Auth).',
          'Geo preference cookie (fc_geo) - remembers your market redirect so the home logo returns you to the right community.',
          'Cloudflare Turnstile - security checks on sign-in to block bots (may set short-lived cookies).',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can clear cookies in your browser at any time. Doing so may sign you out or reset language and market preferences.',
          `Questions: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  ar: {
    title: 'ملفات تعريف الارتباط',
    description:
      'كيف يستخدم founders.coffee ملفات تعريف الارتباط والتقنيات المشابهة.',
    updated: '8 أغسطس 2026',
    sections: [
      {
        heading: 'الأساسية فقط',
        paragraphs: [
          'نستخدم ملفات تعريف الارتباط والتخزين المشابه فقط بقدر ما يلزم لتشغيل المنتج بأمان. لا نستخدم ملفات إعلانية، ولا نستخدم تحليلات طرف ثالث إلا إذا أضفناها لاحقاً وحدّثنا هذه الصفحة.',
        ],
      },
      {
        heading: 'ما نخزّنه',
        paragraphs: [
          'تفضيل اللغة - يتذكر العربية أو الإنجليزية أو الفرنسية.',
          'ملفات الجلسة - تبقيك مسجّل الدخول بعد التحقق بالبريد (Better Auth).',
          'ملف geo (fc_geo) - يتذكر سوقك حتى يعيدك شعار الصفحة الرئيسية إلى المجتمع المناسب.',
          'Cloudflare Turnstile - فحوصات أمان عند تسجيل الدخول لمنع البوتات (قد تضع ملفات قصيرة الأمد).',
        ],
      },
      {
        heading: 'خياراتك',
        paragraphs: [
          'يمكنك مسح ملفات تعريف الارتباط من المتصفح في أي وقت. قد يؤدي ذلك إلى تسجيل الخروج أو إعادة تعيين اللغة والسوق.',
          `للاستفسارات: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  fr: {
    title: 'Cookies',
    description:
      'Comment founders.coffee utilise les cookies et technologies similaires.',
    updated: '8 août 2026',
    sections: [
      {
        heading: 'Essentiels uniquement',
        paragraphs: [
          'Nous utilisons des cookies et un stockage similaire uniquement pour faire fonctionner le produit en toute sécurité. Pas de cookies publicitaires, et pas d’analytique tierce sauf ajout ultérieur avec mise à jour de cette page.',
        ],
      },
      {
        heading: 'Ce que nous stockons',
        paragraphs: [
          'Préférence de langue - arabe, anglais ou français.',
          'Cookies de session - vous garder connecté après vérification e-mail (Better Auth).',
          'Cookie geo (fc_geo) - mémorise votre marché pour le retour via le logo.',
          'Cloudflare Turnstile - contrôle anti-bots à la connexion (cookies éventuels de courte durée).',
        ],
      },
      {
        heading: 'Vos choix',
        paragraphs: [
          'Vous pouvez effacer les cookies dans votre navigateur à tout moment. Cela peut vous déconnecter ou réinitialiser langue et marché.',
          `Questions : ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
};
