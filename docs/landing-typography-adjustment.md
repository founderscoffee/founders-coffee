# P1-002 — Landing typography readability follow-up

Approved 2026-09-11 after inspecting staging at a 1280px desktop viewport.
Requirements: FR-G6 event discovery, NFR-8 accessibility, NFR-9 RTL/LTR support.

- Keep hero/section headings, city-name sizes, event titles/details and footer links unchanged.
- Hero description: 16px on mobile, 18px from the desktop breakpoint (formerly 14px/16px).
- Hero search input, search CTA and header action links: 16px.
- City subtitles and event attendance: 14px rather than 12px.
- City names/counts: retain 18px with 1.375 line-height rather than 1.
- Date badge weekday/month: shared 12px caption scale with 1.4 line-height rather than 11px/1.
- Preserve current mobile CTA visibility, event date formatting, colors and interaction behavior.

Changes use existing shared design tokens rather than altering the global type scale.
Regression checks cover ar/fr/en, shared date styling and desktop/mobile layout.
No deployment or push is authorized as part of this follow-up.
