import satori from 'satori';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface OgInput {
  eyebrow: string; // collection type, e.g. "COMPANY"
  heading: string; // entry name
  subhead: string; // 2-3 key facts joined by ' · '
}

// Editorial Light palette — matches CLAUDE.md design tokens
const COLORS = {
  bg: '#F8F6F1',
  border: '#DDD8CF',
  primary: '#1C1917',
  secondary: '#57534E',
  muted: '#78716C',
  accent: '#B45309',
};

let fontCache: Array<{ name: string; data: Buffer; weight: number; style: 'normal' }> | null =
  null;

async function loadFonts() {
  if (fontCache) return fontCache;

  // Use @fontsource vendored WOFF files (not CDN) so satori can render at build time.
  // Filenames confirmed: inter-latin-600-normal.woff, ibm-plex-mono-latin-400-normal.woff
  // Use process.cwd() (project root) instead of __dirname: Astro prerenders from
  // dist/.prerender/ so import.meta.url-based __dirname points into dist, not node_modules.
  const root = process.cwd();
  const interPath = join(
    root,
    'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff',
  );
  const monoPath = join(
    root,
    'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
  );

  fontCache = [
    {
      name: 'Inter',
      data: readFileSync(interPath),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'IBM Plex Mono',
      data: readFileSync(monoPath),
      weight: 400,
      style: 'normal',
    },
  ];
  return fontCache;
}

export async function renderOgSvg(input: OgInput): Promise<string> {
  const fonts = await loadFonts();

  return satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          backgroundColor: COLORS.bg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          fontFamily: 'Inter',
          color: COLORS.primary,
        },
        children: [
          // Top: eyebrow
          {
            type: 'div',
            props: {
              style: {
                fontFamily: 'IBM Plex Mono',
                fontSize: '20px',
                color: COLORS.primary,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              },
              children: input.eyebrow,
            },
          },
          // Middle: heading
          {
            type: 'div',
            props: {
              style: {
                fontSize: '88px',
                fontWeight: 600,
                lineHeight: 1.05,
                color: COLORS.primary,
                marginTop: '24px',
                marginBottom: '16px',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
              },
              children: input.heading,
            },
          },
          // Bottom row: subhead + watermark
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                fontFamily: 'IBM Plex Mono',
                fontSize: '22px',
                color: COLORS.primary,
                borderTop: `1px solid ${COLORS.border}`,
                paddingTop: '20px',
              },
              children: [
                { type: 'div', props: { children: input.subhead } },
                {
                  type: 'div',
                  props: { style: { color: COLORS.accent }, children: 'directory.kvantiq.studio' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts,
    },
  );
}
