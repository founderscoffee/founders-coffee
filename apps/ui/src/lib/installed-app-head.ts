const THEME_COLOR = '#270F00';
const APP_SHORT_NAME = 'Founders';

/**
 * What the shell tells a phone about itself, for the window it gets once installed.
 *
 * A current iPhone reads all of this off the manifest, which is why installing already worked.
 * The apple-prefixed tags are what an older one reads instead, and the status bar style is the
 * one thing the manifest cannot say: without it iOS infers the bar from `theme_color`, so it is
 * pinned to `black` here to match the near-black brown the manifests already ask for.
 */
export const installedAppMeta = (): readonly {
  readonly name: string;
  readonly content: string;
}[] => [
  { name: 'theme-color', content: THEME_COLOR },
  { name: 'mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-capable', content: 'yes' },
  { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
  { name: 'apple-mobile-web-app-title', content: APP_SHORT_NAME },
];
