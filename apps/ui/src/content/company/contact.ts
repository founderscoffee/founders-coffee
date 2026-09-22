import type { Locale } from '@founders-coffee/i18n';

import { textBlocks, type CompanyPageContent } from './types';

export const CONTACT_EMAIL = 'contact@founders.coffee';
export const PRIVACY_EMAIL = CONTACT_EMAIL;

export const contactContent: Record<Locale, CompanyPageContent> = {
  en: {
    title: 'Contact',
    description:
      'Reach the Founders Coffee team for support, privacy requests, or partnerships.',
    updated: '22 September 2026',
    sections: [
      {
        heading: 'Report a problem',
        anchor: 'report',
        blocks: textBlocks(
          `Email ${CONTACT_EMAIL} with what you saw: the link to the meetup, the profile or the content if you are reporting conduct, or the page and what you were trying to do if it is a technical fault. A precise description shortens the review.`,
          'Reports are confidential, and we do not reveal who sent one to the person it names. What we do once a report arrives is set out in the [community guidelines](/community).',
          'If someone is in immediate danger, contact the emergency services first. We are a digital platform and cannot intervene in person.',
        ),
      },
      {
        heading: 'General support',
        blocks: textBlocks(
          `Email us at ${CONTACT_EMAIL} for help with accounts, hosting a meetup, or using the product.`,
          'We read every message. Please include your city and a short description of what you need.',
        ),
      },
      {
        heading: 'Privacy requests',
        blocks: textBlocks(
          `For access, correction, or deletion requests, write to ${PRIVACY_EMAIL}. See also our Privacy page.`,
        ),
      },
      {
        heading: 'Partnerships & sponsorships',
        blocks: textBlocks(
          `Interested in disclosed sponsorships? Contact ${CONTACT_EMAIL} with “Partnership” in the subject line. We do not run covert promotions.`,
        ),
      },
    ],
  },
  ar: {
    title: 'تواصل معنا',
    description:
      'تواصل مع فريق Founders Coffee للدعم أو طلبات الخصوصية أو الشراكات.',
    updated: '22 سبتمبر 2026',
    sections: [
      {
        heading: 'الإبلاغ عن مشكلة',
        anchor: 'report',
        blocks: textBlocks(
          `راسلنا على ${CONTACT_EMAIL} واذكر ما رأيتَه: رابط اللقاء أو الملف أو المحتوى إن كان البلاغ عن سلوك، أو الصفحة وما كنت تحاول فعله إن كان خللًا تقنيًا. الوصف الدقيق يختصر وقت المراجعة.`,
          'البلاغات تُعامَل بسرّية، ولا نكشف هوية المبلّغ لمن بُلِّغ عنه. وما نفعله بعد وصول البلاغ مفصّل في [إرشادات المجتمع](/community).',
          'وإن كان الأمر يتعلّق بخطر مباشر على شخص، فاتّصل بالجهات المختصة أولًا؛ نحن منصة رقمية ولا نملك وسيلة تدخّل ميداني.',
        ),
      },
      {
        heading: 'الدعم العام',
        blocks: textBlocks(
          `راسلنا على ${CONTACT_EMAIL} للمساعدة في الحسابات أو استضافة لقاء أو استخدام المنصة.`,
          'نقرأ كل الرسائل. يُرجى ذكر مدينتك ووصف مختصر لما تحتاجه.',
        ),
      },
      {
        heading: 'طلبات الخصوصية',
        blocks: textBlocks(
          `لطلبات الوصول أو التصحيح أو الحذف، راسل ${PRIVACY_EMAIL}. راجع أيضًا صفحة الخصوصية.`,
        ),
      },
      {
        heading: 'الشراكات والرعاية',
        blocks: textBlocks(
          `للاهتمام برعاية معلَنة، راسل ${CONTACT_EMAIL} مع وضع «شراكة» في عنوان الرسالة. لا نقدّم ترويجًا مخفيًا.`,
        ),
      },
    ],
  },
  fr: {
    title: 'Contact',
    description:
      'Contactez l’équipe Founders Coffee pour le support, les demandes de confidentialité ou les partenariats.',
    updated: '22 septembre 2026',
    sections: [
      {
        heading: 'Signaler un problème',
        anchor: 'report',
        blocks: textBlocks(
          `Écrivez à ${CONTACT_EMAIL} en indiquant ce que vous avez vu : le lien de la rencontre, du profil ou du contenu s’il s’agit d’un comportement, ou la page et ce que vous tentiez de faire s’il s’agit d’un défaut technique. Une description précise raccourcit l’examen.`,
          'Les signalements sont confidentiels, et nous ne révélons pas qui les envoie à la personne qu’ils nomment. Ce que nous faisons une fois un signalement reçu est détaillé dans les [règles de la communauté](/community).',
          'En cas de danger immédiat pour une personne, contactez d’abord les services d’urgence. Nous sommes une plateforme numérique et ne pouvons pas intervenir sur le terrain.',
        ),
      },
      {
        heading: 'Support général',
        blocks: textBlocks(
          `Écrivez-nous à ${CONTACT_EMAIL} pour l’aide sur les comptes, l’organisation d’un meetup ou l’utilisation du produit.`,
          'Nous lisons chaque message. Indiquez votre ville et une courte description de votre besoin.',
        ),
      },
      {
        heading: 'Demandes de confidentialité',
        blocks: textBlocks(
          `Pour un accès, une correction ou une suppression, contactez ${PRIVACY_EMAIL}. Consultez aussi notre page Confidentialité.`,
        ),
      },
      {
        heading: 'Partenariats & sponsoring',
        blocks: textBlocks(
          `Intéressé par un sponsoring divulgué ? Contactez ${CONTACT_EMAIL} avec « Partenariat » en objet. Nous ne faisons pas de promotion dissimulée.`,
        ),
      },
    ],
  },
};
