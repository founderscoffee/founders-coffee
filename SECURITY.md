# Security policy

founders.coffee is a live service that holds its members' email addresses and phone numbers. We
handle every report privately and take each one seriously.

## Reporting a vulnerability

**Do not open a public issue, discussion or pull request about it.**

Report it privately through GitHub: open the repository's **Security** tab and choose **Report a
vulnerability**, or go straight to
[the private report form](https://github.com/founderscoffee/founders-coffee/security/advisories/new).
Only you and the maintainers can see the report. We discuss it there and, if needed, fix it in a
private fork.

If you cannot use GitHub, email **contact@founders.coffee** with "Security" in the subject. Give a
short description, and we will invite you to a private report for the details.

A useful report says:

- what is affected: the address, endpoint, file or workflow;
- how to reproduce it, step by step, or a proof of concept;
- what an attacker could achieve;
- how you would like to be credited, if at all.

## What to expect

- We aim to acknowledge a report within three working days. Within ten, we aim to tell you whether
  we accept it and how we plan to fix it.
- We fix accepted vulnerabilities as fast as their severity requires, and keep you informed.
- Once the fix is in production, we publish a GitHub security advisory, with a CVE where one is
  warranted. We credit you there unless you prefer otherwise.
- There is no bug bounty.

## Scope

In scope:

- the code in this repository, including its GitHub Actions workflows;
- the live service at `https://founders.coffee`, and staging at `https://staging.founders.coffee`.

Out of scope:

- denial of service and load testing, including tests of the rate limits themselves;
- social engineering, phishing and physical attacks;
- vulnerabilities in the services we use, such as Cloudflare, Twilio, Mapbox, Google and GitHub:
  report them to that service, and tell us if our configuration makes them worse;
- reports from automated scanners or AI tools that nobody has verified and that come without a
  working reproduction.

## Rules for testing

Good-faith research that follows these rules is welcome. We will not take legal action against you
for it, and we will work with you on disclosure.

- Test only with accounts you own. Never read, change or delete another member's data. If you reach
  someone else's data, stop, keep none of it, and report straight away.
- Keep automated requests slow and few. The service blocks bursts, and its members must not notice
  your testing.
- Do not disclose the issue publicly until the fix is in production and we have agreed on a date. We
  aim for no more than 90 days after your report.

## Supported versions

Only what production runs, the latest release on `main`, receives security fixes. There are no older
versions to patch.
