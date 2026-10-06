import { privacyDataSections } from './privacy-data';
import { privacyProcessingSections } from './privacy-processing';
import { privacyRightsSections } from './privacy-rights';
import type { CompanyPageContent } from './types';

export const privacyContent: CompanyPageContent = {
  title: 'سياسة الخصوصية',
  description:
    'ما تجمعه المنصة من معطيات شخصية، ولأيّ غرض، ومن يطّلع عليها، وكم تبقى، وما تملكه أنت حيالها.',
  updated: '6 أكتوبر 2026',
  sections: [
    ...privacyDataSections,
    ...privacyProcessingSections,
    ...privacyRightsSections,
  ],
};
