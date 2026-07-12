import { createFileRoute, useSearch } from '@tanstack/react-router'

import { getPublicAuthConfig } from '@founders-coffee/server-fns'

import { LoginPage } from '../components/auth/LoginPage'

export const Route = createFileRoute('/login')({
  component: () => {
    const { locale } = Route.useRouteContext()
    const { turnstileSiteKey, hasSocial } = Route.useLoaderData()
    const redirect = useSearch({
      strict: false,
      select: (s) => (s as { redirect?: string } | undefined)?.redirect ?? '/',
    })
    return (
      <LoginPage
        locale={locale}
        turnstileSiteKey={turnstileSiteKey}
        hasSocial={hasSocial}
        redirect={redirect}
      />
    )
  },
  loader: () => getPublicAuthConfig(),
})
