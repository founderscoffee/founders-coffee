import { useState } from 'react';

import {
  account_contacts_note,
  account_contacts_title,
  account_data_title,
  account_delete,
  account_delete_note,
  account_devices_title,
  account_email,
  account_export,
  account_export_note,
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

import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { useMyAccount } from '../hooks';
import { providerLabel } from '../account-labels';
import type { AccountSummary } from '../api';
import type { ContactKind } from '../contact-flow';
import { AccountRow } from './AccountRow';
import { ContactDialog } from './ContactDialog';
import { ProfileSectionNav } from './ProfileSectionNav';

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

const VerifiedChip = ({
  locale,
  isVerified,
}: {
  locale: Locale;
  isVerified: boolean;
}) => (
  <span
    className={`badge badge-sm shrink-0 ${isVerified ? 'badge-success badge-soft' : 'badge-ghost'}`}
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
        locale={locale}
        label={account_email({}, { locale })}
        value={account.email.masked}
        status={
          <>
            <VerifiedChip locale={locale} isVerified={account.email.verified} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange('email')}
            >
              {contact_change_email({}, { locale })}
            </Button>
          </>
        }
      />
      <AccountRow
        locale={locale}
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
        locale={locale}
        label={account_providers({}, { locale })}
        value={
          account.providers.length > 0
            ? account.providers
                .map((provider) => providerLabel(provider, locale))
                .join(' · ')
            : account_providers_empty({}, { locale })
        }
        isPending
      />
      <AccountRow
        locale={locale}
        label={account_sessions({}, { locale })}
        value={account_sessions_count(
          { count: account.sessionCount },
          { locale },
        )}
        isPending
      />
    </Group>

    <Group title={account_data_title({}, { locale })}>
      <AccountRow
        locale={locale}
        label={account_export({}, { locale })}
        note={account_export_note({}, { locale })}
        isPending
      />
      <AccountRow
        locale={locale}
        label={account_delete({}, { locale })}
        note={account_delete_note({}, { locale })}
        isPending
      />
    </Group>
  </div>
);

export const AccountPage = ({ locale }: { locale: Locale }) => {
  const query = useMyAccount();
  const [changing, setChanging] = useState<ContactKind | null>(null);
  const isLoading =
    query.isAuthLoading ||
    (!!query.userId && query.isPending && !query.isError);

  return (
    <section className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="mb-1 font-display text-h3">
        {account_title({}, { locale })}
      </h1>
      <p className="mb-6 text-body-sm text-neutral">
        {account_heading({}, { locale })} {account_note({}, { locale })}
      </p>
      <ProfileSectionNav locale={locale} />

      {query.data ? (
        <AccountSections
          locale={locale}
          account={query.data}
          onChange={setChanging}
        />
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
          returnPath="/account"
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
    </section>
  );
};
