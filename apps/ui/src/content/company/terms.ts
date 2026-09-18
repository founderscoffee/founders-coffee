import { termsPlatformSections } from './terms-platform';
import { termsLegalSections } from './terms-legal';
import type { CompanyPageContent } from './types';

export const termsContent: CompanyPageContent = {
  title: 'شروط الاستخدام',
  description:
    'الشروط التي تحكم استخدام منصة فاوندرز كوفي، ودورنا في اللقاءات التي ينشرها الأعضاء، وحدود مسؤوليتنا.',
  updated: '18 سبتمبر 2026',
  sections: [...termsPlatformSections, ...termsLegalSections],
};
