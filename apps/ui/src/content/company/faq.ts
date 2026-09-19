import type { Locale } from '@founders-coffee/i18n';

import { faqArabic } from './faq-ar';
import { faqEnglish } from './faq-en';
import { faqFrench } from './faq-fr';
import type { CompanyPageContent } from './types';

export const faqContent: Record<Locale, CompanyPageContent> = {
  ar: faqArabic,
  fr: faqFrench,
  en: faqEnglish,
};
