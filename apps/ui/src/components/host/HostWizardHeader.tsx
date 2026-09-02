import {
  host_page_sub,
  host_page_title,
  type Locale,
} from '@founders-coffee/i18n';

export const HostWizardHeader = ({ locale }: { locale: Locale }) => (
  <header className="host-fade-up mb-8">
    <div className="min-w-0 max-w-2xl">
      <h1 className="text-4xl font-bold tracking-tight text-base-content md:text-5xl">
        {host_page_title({}, { locale })}
      </h1>
      <p className="mt-3 text-lg text-base-content/60">
        {host_page_sub({}, { locale })}
      </p>
    </div>
  </header>
);
