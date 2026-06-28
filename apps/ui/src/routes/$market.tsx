import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * Market layout — the parent of `/$market/index` (country landing) and `/$market/$city` (city
 * landing). Path hierarchy makes `/$market/$city` a child of `/$market`, so this route must render
 * an `<Outlet/>` for the children to show (a leaf component here would mask them). Each child
 * resolves + canonicalizes its own data.
 */
export const Route = createFileRoute('/$market')({
  component: () => <Outlet />,
})
