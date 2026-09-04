import {
  host_page_sub,
  host_page_title,
  type Locale,
} from '@founders-coffee/i18n';

export const HostWizardHeader = ({ locale }: { locale: Locale }) => (
  <header className="host-fade-up mb-8">
    <div className="min-w-0 max-w-2xl">
      <h1 className="text-h1 font-bold tracking-tight text-base-content md:text-display">
        {host_page_title({}, { locale })}
      </h1>
      <p className="mt-3 text-body-lg text-neutral">
        {host_page_sub({}, { locale })}
      </p>
    </div>
  </header>
);
