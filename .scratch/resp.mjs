import { chromium } from 'playwright';
const B = 'https://staging.founders.coffee';
const WIDTHS = [320, 360, 390, 414, 480, 600, 768, 834, 1024, 1280, 1440, 1920];
const PAGES = ['/algeria', '/algeria/algiers', '/algeria/e/coffee-code-hydra', '/login', '/algeria/host/create'];
const b = await chromium.launch();
const rows = [];
for (const loc of ['en', 'ar']) {
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ locale: loc, viewport: { width: w, height: 800 } });
    await ctx.addCookies([{ name: 'PARAGLIDE_LOCALE', value: loc, url: B }]);
    const page = await ctx.newPage();
    for (const p of PAGES) {
      await page.goto(B + p, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3500);
      const r = await page.evaluate((vw) => {
        const de = document.documentElement;
        const over = de.scrollWidth - de.clientWidth;
        const wide = [];
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
          const past = rtl ? Math.round(-b.left) : Math.round(b.right - de.clientWidth);
          if (past > 1 && b.width > 20) {
            const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
            wide.push(`${tag} w=${Math.round(b.width)} past=${past}`);
          }
        }
        return { over, wide: [...new Set(wide)].slice(0, 3) };
      }, w);
      if (r.over > 1 || r.wide.length) rows.push({ loc, w, p, ...r });
    }
    await ctx.close();
  }
}
console.log(rows.length ? JSON.stringify(rows, null, 1) : 'NO OVERFLOW at any width/locale');
await b.close();
