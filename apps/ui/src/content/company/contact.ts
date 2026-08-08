import type { Locale } from '@founders-coffee/i18n'

import type { CompanyPageContent } from './types'

/** Public inbox for support, partnerships, and privacy requests. */
export const CONTACT_EMAIL = 'contact@founders.coffee'
export const PRIVACY_EMAIL = CONTACT_EMAIL

export const contactContent: Record<Locale, CompanyPageContent> = {
  en: {
    title: 'Contact',
    description: 'Reach the founders.coffee team for support, privacy requests, or partnerships.',
    updated: '8 August 2026',
    sections: [
      {
        heading: 'General support',
        paragraphs: [
          `Email us at ${CONTACT_EMAIL} for help with accounts, hosting a meetup, or using the product.`,
          'We read every message. Please include your city and a short description of what you need.',
        ],
      },
      {
        heading: 'Privacy requests',
        paragraphs: [
          `For access, correction, or deletion requests, write to ${PRIVACY_EMAIL}. See also our Privacy page.`,
        ],
      },
      {
        heading: 'Partnerships & sponsorships',
        paragraphs: [
          `Interested in disclosed sponsorships? Contact ${CONTACT_EMAIL} with “Partnership” in the subject line. We do not run covert promotions.`,
        ],
      },
    ],
  },
  ar: {
    title: 'تواصل معنا',
    description: 'تواصل مع فريق founders.coffee للدعم أو طلبات الخصوصية أو الشراكات.',
    updated: '8 أغسطس 2026',
    sections: [
      {
        heading: 'الدعم العام',
        paragraphs: [
          `راسلنا على ${CONTACT_EMAIL} للمساعدة في الحسابات أو استضافة لقاء أو استخدام المنصة.`,
          'نقرأ كل الرسائل. يُرجى ذكر مدينتك ووصف مختصر لما تحتاجه.',
        ],
      },
      {
        heading: 'طلبات الخصوصية',
        paragraphs: [
          `لطلبات الوصول أو التصحيح أو الحذف، راسل ${PRIVACY_EMAIL}. راجع أيضاً صفحة الخصوصية.`,
        ],
      },
      {
        heading: 'الشراكات والرعاية',
        paragraphs: [
          `للاهتمام برعاية معلَنة، راسل ${CONTACT_EMAIL} مع وضع «شراكة» في عنوان الرسالة. لا نقدّم ترويجاً مخفياً.`,
        ],
      },
    ],
  },
  fr: {
    title: 'Contact',
    description:
      'Contactez l’équipe founders.coffee pour le support, les demandes de confidentialité ou les partenariats.',
    updated: '8 août 2026',
    sections: [
      {
        heading: 'Support général',
        paragraphs: [
          `Écrivez-nous à ${CONTACT_EMAIL} pour l’aide sur les comptes, l’organisation d’un meetup ou l’utilisation du produit.`,
          'Nous lisons chaque message. Indiquez votre ville et une courte description de votre besoin.',
        ],
      },
      {
        heading: 'Demandes de confidentialité',
        paragraphs: [
          `Pour un accès, une correction ou une suppression, contactez ${PRIVACY_EMAIL}. Consultez aussi notre page Confidentialité.`,
        ],
      },
      {
        heading: 'Partenariats & sponsoring',
        paragraphs: [
          `Intéressé par un sponsoring divulgué ? Contactez ${CONTACT_EMAIL} avec « Partenariat » en objet. Nous ne faisons pas de promotion dissimulée.`,
        ],
      },
    ],
  },
}
