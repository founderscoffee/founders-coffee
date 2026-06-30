import { Link, createFileRoute, useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import {
  brand,
  login_code_label,
  login_code_sent,
  login_email_label,
  login_email_placeholder,
  login_or,
  login_resend,
  login_send_code,
  login_title,
  login_verify,
  login_wrong_code,
  oauth_continue,
} from '@founders-coffee/i18n'
import { getPublicAuthConfig } from '@founders-coffee/server-fns'
import { Button, Input } from '@founders-coffee/ui'

import { Turnstile } from '../components/turnstile'
import { authClient } from '../lib/auth'

const OAUTH_PROVIDERS = ['google', 'github', 'linkedin'] as const

const LoginPage = () => {
  const { locale } = Route.useRouteContext()
  const { turnstileSiteKey, hasSocial } = Route.useLoaderData()
  const redirect = useSearch({
    strict: false,
    select: (s) => (s as { redirect?: string } | undefined)?.redirect ?? '/',
  })

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const emailValid = /.+@.+\..+/.test(email)

  const sendCode = async () => {
    if (!emailValid || !token) return
    setBusy(true)
    setError(null)
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp(
      { email, type: 'sign-in' },
      { headers: { 'cf-turnstile-response': token } },
    )
    setBusy(false)
    if (sendError) {
      setError(sendError.message ?? 'error')
      return
    }
    setStep('otp')
  }

  const verify = async () => {
    setBusy(true)
    setError(null)
    const { data, error: verifyError } = await authClient.signIn.emailOtp({ email, otp })
    setBusy(false)
    if (verifyError) {
      setError(login_wrong_code({}, { locale }))
      return
    }
    const needsOnboarding = !(data?.user as { homeMarketCode?: string } | null | undefined)?.homeMarketCode
    window.location.href = needsOnboarding ? '/onboarding' : redirect
  }

  const social = (provider: (typeof OAUTH_PROVIDERS)[number]) =>
    authClient.signIn.social({ provider, callbackURL: redirect })

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card border border-base-300 bg-base-200">
        <div className="card-body gap-4">
          {/* Brand header */}
          <div className="text-center">
            <Link to="/" className="text-xl font-extrabold text-primary">
              {brand({}, { locale })}
            </Link>
            <h1 className="mt-2 text-2xl font-bold">{login_title({}, { locale })}</h1>
          </div>

          {step === 'email' ? (
            <>
              <label className="form-control">
                <span className="mb-1 block text-sm text-base-content/70">
                  {login_email_label({}, { locale })}
                </span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={login_email_placeholder({}, { locale })}
                />
              </label>
              {turnstileSiteKey && <Turnstile sitekey={turnstileSiteKey} onToken={setToken} />}
              {error && <p className="text-sm text-error">{error}</p>}
              <Button onClick={sendCode} disabled={!emailValid || !token || busy} fullWidth>
                {login_send_code({}, { locale })}
              </Button>
              {hasSocial && (
                <>
                  <div className="divider text-xs text-base-content/40">
                    {login_or({}, { locale })}
                  </div>
                  <div className="space-y-2">
                    {OAUTH_PROVIDERS.map((p) => (
                      <Button
                        key={p}
                        variant="outline"
                        onClick={() => social(p)}
                        disabled={busy}
                        fullWidth
                      >
                        {oauth_continue({ provider: p }, { locale })}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-center text-sm text-base-content/70">
                {login_code_sent({ email }, { locale })}
              </p>
              <label className="form-control items-center">
                <span className="mb-2 block text-sm text-base-content/70">
                  {login_code_label({}, { locale })}
                </span>
                <input
                  className={`otp ${error ? 'otp-error' : 'otp-primary'}`}
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </label>
              {error && <p className="text-center text-sm text-error">{error}</p>}
              <Button onClick={verify} disabled={otp.length !== 6 || busy} fullWidth>
                {login_verify({}, { locale })}
              </Button>
              <Button variant="ghost" onClick={() => setStep('email')} disabled={busy} fullWidth>
                {login_resend({}, { locale })}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
  loader: () => getPublicAuthConfig(),
})
