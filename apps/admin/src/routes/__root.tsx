import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';

import {
  not_found,
  title,
  detectLocale,
  direction,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import { readCookieHeader } from '../lib/cookies';
import appCss from '../styles.css?url';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: false } },
});

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir } = Route.useRouteContext();
  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-base-100 text-base-content">
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
};

const NotFound = () => {
  const { locale } = Route.useRouteContext();
  return (
    <main className="mx-auto max-w-xl p-8">
      <StatusMessage variant="error">{not_found({}, { locale })}</StatusMessage>
      <a className="mt-4 inline-block underline" href="/">
        {title({}, { locale })}
      </a>
    </main>
  );
};

export const Route = createRootRoute({
  beforeLoad: () => {
    const locale = detectLocale(readCookieHeader());
    return { locale, dir: direction(locale) };
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Founders Coffee · Admin' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});
