import { useEffect, useState } from 'react';

import {
  baseLocale,
  account_contacts_note,
  account_contacts_title,
  account_data_request,
  account_data_title,
  account_delete,
  account_delete_note,
  account_delete_subject,
  account_devices_title,
  account_email,
  account_export,
  account_export_note,
  account_export_subject,
  account_heading,
  account_loading,
  account_note,
  account_phone,
  account_phone_empty,
  account_providers,
  account_providers_empty,
  account_sessions,
  account_sessions_count,
  account_title,
  account_unavailable,
  account_unverified,
  account_verified,
  contact_add_phone,
  contact_change_email,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { storeLocale } from '../../preferences/locale-cookie';
import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { useMyAccount, useUpdateAccountLocale } from '../hooks';
import { CONTACT_EMAIL } from '../../../content/company/contact';
import type { AccountSummary } from '../api';
import type { ContactKind } from '../contact-flow';
import { AccountRow } from './AccountRow';
import { ContactDialog } from './ContactDialog';
import { DevicePanel } from './DevicePanel';
import { LanguageGroup } from './LanguageGroup';
import { ProfileSectionNav } from './ProfileSectionNav';
import { ProviderIdentityList } from './ProviderIdentity';

const Group = ({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-box border border-base-300 bg-base-100 p-5 md:p-6">
    <h2 className="font-display text-h4">{title}</h2>
    {note && <p className="mt-1 text-body-sm text-neutral">{note}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const RequestLink = ({ subject }: { subject: string }) => (
  <a
    href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`}
    className="link link-hover font-medium text-secondary"
  >
    {CONTACT_EMAIL}
  </a>
);

const VerifiedChip = ({
  locale,
  isVerified,
}: {
  locale: Locale;
  isVerified: boolean;
}) => (
  <span
    className={`badge btn-sm w-16 shrink-0 justify-center ${isVerified ? 'badge-success badge-soft' : 'badge-ghost'}`}
  >
    {isVerified
      ? account_verified({}, { locale })
      : account_unverified({}, { locale })}
  </span>
);

const AccountSections = ({
  locale,
  account,
  onChange,
}: {
  locale: Locale;
  account: AccountSummary;
  onChange: (kind: ContactKind) => void;
}) => (
  <div className="space-y-6">
    <Group
      title={account_contacts_title({}, { locale })}
      note={account_contacts_note({}, { locale })}
    >
      <AccountRow
        label={account_email({}, { locale })}
        value={account.email.masked}
        status={
          <>
            <VerifiedChip locale={locale} isVerified={account.email.verified} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-16"
              onClick={() => onChange('email')}
            >
              {contact_change_email({}, { locale })}
            </Button>
          </>
        }
      />
      <AccountRow
        label={account_phone({}, { locale })}
        value={account.phone.masked ?? account_phone_empty({}, { locale })}
        status={
          <>
            {account.phone.masked && (
              <VerifiedChip
                locale={locale}
                isVerified={account.phone.verified}
              />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-16"
              onClick={() => onChange('phone')}
            >
              {account.phone.masked
                ? contact_change_email({}, { locale })
                : contact_add_phone({}, { locale })}
            </Button>
          </>
        }
      />
    </Group>

    <Group title={account_devices_title({}, { locale })}>
      <AccountRow
        label={account_providers({}, { locale })}
        value={
          <ProviderIdentityList
            locale={locale}
            providers={account.providers}
            empty={account_providers_empty({}, { locale })}
          />
        }
      />
      <AccountRow
        label={account_sessions({}, { locale })}
        value={account_sessions_count(
          { count: account.sessionCount },
          { locale },
        )}
      />
      <DevicePanel locale={locale} />
    </Group>

    <Group
      title={account_data_title({}, { locale })}
      note={account_data_request({}, { locale })}
    >
      <AccountRow
        label={account_export({}, { locale })}
        note={account_export_note({}, { locale })}
        value={<RequestLink subject={account_export_subject({}, { locale })} />}
      />
      <AccountRow
        label={account_delete({}, { locale })}
        note={account_delete_note({}, { locale })}
        value={<RequestLink subject={account_delete_subject({}, { locale })} />}
      />
    </Group>
  </div>
);

export const AccountPage = ({ locale }: { locale: Locale }) => {
  const query = useMyAccount();
  const updateLocale = useUpdateAccountLocale();
  const [changing, setChanging] = useState<ContactKind | null>(null);
  const [language, setLanguage] = useState<Locale>(baseLocale);
  const isLoading =
    query.isAuthLoading ||
    (!!query.userId && query.isPending && !query.isError);

  useEffect(() => {
    if (query.data) setLanguage(query.data.locale ?? baseLocale);
  }, [query.data]);

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-12">
      <ProfileSectionNav locale={locale} />
      <div className="min-w-0">
        <h1 className="mb-1 font-display text-h3">
          {account_title({}, { locale })}
        </h1>
        <p className="mb-6 text-body-sm text-neutral">
          {account_heading({}, { locale })} {account_note({}, { locale })}
        </p>

        {query.data ? (
          <>
            <LanguageGroup
              locale={locale}
              value={language}
              isDirty={language !== (query.data.locale ?? baseLocale)}
              isPending={updateLocale.isPending}
              isError={updateLocale.isError}
              isSuccess={updateLocale.isSuccess}
              onChange={setLanguage}
              onReset={() => setLanguage(query.data.locale ?? baseLocale)}
              onSave={() =>
                updateLocale.mutate(language, {
                  onSuccess: () => {
                    storeLocale(language);
                    window.location.reload();
                  },
                })
              }
            />
            <div className="mt-6">
              <AccountSections
                locale={locale}
                account={query.data}
                onChange={setChanging}
              />
            </div>
          </>
        ) : query.isError && query.userId ? (
          <p role="alert" className="text-body-sm text-error">
            {account_unavailable({}, { locale })}
          </p>
        ) : isLoading ? (
          <p role="status" className="text-body-sm text-neutral">
            {account_loading({}, { locale })}
          </p>
        ) : (
          <ProfileAccess
            locale={locale}
            isLoading={false}
            isAnonymous
            returnPath="/profile/account"
            onRetry={() => void query.refetch()}
          />
        )}
        {changing && (
          <ContactDialog
            locale={locale}
            kind={changing}
            onClose={() => setChanging(null)}
          />
        )}
      </div>
    </section>
  );
};
