# Accessibility

founders.coffee aims to meet the [Web Content Accessibility Guidelines 2.1](https://www.w3.org/TR/WCAG21/)
at level AA in all three of its languages: Arabic, which reads right to left, French and English.

In practice, that means every screen should:

- be built from semantic HTML first, with ARIA only where HTML has no equivalent;
- work with a keyboard alone, with focus that stays visible;
- label every form field and announce its errors;
- mirror its layout correctly from right to left, using logical properties rather than left and
  right;
- have loading, error and empty states that assistive technology can read.

## Reporting a barrier

Open an issue with the [bug form](https://github.com/founderscoffee/founders-coffee/issues/new/choose).
Say what you tried to do, the page, its language, and the assistive technology and browser you used.
Known barriers carry the [`a11y`](https://github.com/founderscoffee/founders-coffee/labels/a11y)
label. If you cannot use GitHub, email **contact@founders.coffee**.

## Checking your own change

Before you open a pull request that changes the interface:

- use it with the keyboard alone;
- use it with a screen reader (VoiceOver, TalkBack or NVDA) in Arabic and in French or English;
- look at it at phone width (360 px) and on a desktop, in both directions.
