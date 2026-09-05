import {
  host_page_sub,
  host_page_title,
  type Locale,
} from '@founders-coffee/i18n';

export const HostWizardHeader = ({ locale }: { locale: Locale }) => (
  <header className="host-fade-up mb-6">
    <div className="min-w-0 max-w-2xl">
      <p className="font-display text-h3 font-semibold text-base-content">
        {host_page_title({}, { locale })}
      </p>
      <p className="mt-1 text-body-sm text-neutral">
        {host_page_sub({}, { locale })}
      </p>
    </div>
  </header>
);
