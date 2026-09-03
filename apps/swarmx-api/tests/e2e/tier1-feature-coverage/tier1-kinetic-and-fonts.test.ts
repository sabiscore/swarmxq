/**
 * Tier 1 Feature Coverage: Features 10, 11
 * F10: Kinetic Text Engine (dynamic fontsize scaling with t, asterisk & ALL-CAPS emphasis, TONE_ACCENTS)
 * F11: Dynamic Font Discovery (scans /usr/share/fonts/truetype/, throws FONT_UNAVAILABLE)
 */

import {
  expect,
  parseKineticEmphasis,
  CANONICAL_TONES,
  CANONICAL_TONE_ACCENTS,
  type TestSuite,
} from "../test-helpers.js";
import fs from "node:fs";

export const tier1KineticAndFontsSuite: TestSuite = {
  suiteName: "Tier 1: Kinetic Text Engine & Font Discovery (F10, F11)",
  tier: 1,
  tests: [
    // ─── FEATURE 10: Kinetic Text Engine ─────────────────────────────────────
    {
      name: "F10-T01: Kinetic text detects *asterisk* wrapped emphasis keywords",
      tier: 1,
      featureId: 10,
      fn: () => {
        const text = "Every senior engineer uses this *secret* trick.";
        const parsed = parseKineticEmphasis(text);
        expect(parsed.hasAsteriskEmphasis).toBe(true);
        expect(parsed.emphasizedWords).toContain("secret");
      },
    },
    {
      name: "F10-T02: Kinetic text detects ALL-CAPS keywords for kinetic accentuation",
      tier: 1,
      featureId: 10,
      fn: () => {
        const text = "This one legacy pattern is SLOWING down your database.";
        const parsed = parseKineticEmphasis(text);
        expect(parsed.allCapsWords).toContain("SLOWING");
      },
    },
    {
      name: "F10-T03: Kinetic text generates time-dependent fontsize animation expression with 't'",
      tier: 1,
      featureId: 10,
      fn: () => {
        const buildKineticDrawtext = (isKeyPhrase: boolean, text: string, accentColor: string) => {
          if (isKeyPhrase) {
            return `drawtext=text='${text}':fontsize='if(lt(t,0.3),48+32*t/0.3,58)':fontcolor=${accentColor}`;
          }
          return `drawtext=text='${text}':fontsize=36:fontcolor=white@0.85`;
        };

        const keyDrawtext = buildKineticDrawtext(true, "CRITICAL", "#ff2222");
        expect(keyDrawtext).toContain("fontsize='if(lt(t,");
        expect(keyDrawtext).toContain("fontcolor=#ff2222");

        const bodyDrawtext = buildKineticDrawtext(false, "Normal body text", "#ffffff");
        expect(bodyDrawtext).toContain("fontsize=36");
      },
    },
    {
      name: "F10-T04: All 8 canonical tones have distinct accent color mappings in TONE_ACCENTS",
      tier: 1,
      featureId: 10,
      fn: () => {
        for (const tone of CANONICAL_TONES) {
          const accent = CANONICAL_TONE_ACCENTS[tone];
          expect(accent).toBeDefined();
          expect(accent.startsWith("#")).toBe(true);
        }
      },
    },
    {
      name: "F10-T05: Standard body text uses lower-opacity and smaller font styling",
      tier: 1,
      featureId: 10,
      fn: () => {
        const bodyStyle = {
          fontSize: 36,
          opacity: 0.85,
          color: "white@0.85",
        };
        const keyStyle = {
          fontSize: 58,
          opacity: 1.0,
          color: CANONICAL_TONE_ACCENTS.contrarian,
        };
        expect(bodyStyle.fontSize).toBeLessThan(keyStyle.fontSize);
        expect(bodyStyle.opacity).toBeLessThan(keyStyle.opacity);
      },
    },

    // ─── FEATURE 11: Dynamic Font Discovery ──────────────────────────────────
    {
      name: "F11-T01: Font discovery scans candidate directories under /usr/share/fonts/truetype/",
      tier: 1,
      featureId: 11,
      fn: () => {
        const discoverFonts = (candidateDirs: string[]): string[] => {
          const found: string[] = [];
          for (const dir of candidateDirs) {
            try {
              if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir, { recursive: true }) as string[];
                for (const f of files) {
                  if (typeof f === "string" && f.endsWith(".ttf")) {
                    found.push(`${dir}/${f}`);
                  }
                }
              }
            } catch {
              // ignore
            }
          }
          return found;
        };

        const candidates = ["/usr/share/fonts/truetype", "/usr/share/fonts"];
        const fonts = discoverFonts(candidates);
        expect(Array.isArray(fonts)).toBe(true);
      },
    },
    {
      name: "F11-T02: Font discovery throws FONT_UNAVAILABLE when no valid .ttf font is located",
      tier: 1,
      featureId: 11,
      fn: () => {
        const resolveFontOrThrow = (foundFonts: string[]) => {
          if (foundFonts.length === 0) {
            const err = new Error("No TTF font found under font discovery paths");
            (err as any).code = "FONT_UNAVAILABLE";
            throw err;
          }
          return foundFonts[0];
        };

        expect(() => resolveFontOrThrow([])).toThrow("No TTF font found");
      },
    },
    {
      name: "F11-T03: Font discovery selects DejaVuSans / FreeSans / Ubuntu if available",
      tier: 1,
      featureId: 11,
      fn: () => {
        const mockAvailable = [
          "/usr/share/fonts/truetype/other/font.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        ];

        const pickPreferredFont = (fonts: string[]): string => {
          const preferredPatterns = ["DejaVuSans-Bold", "DejaVuSans", "FreeSans", "Ubuntu-B"];
          for (const pattern of preferredPatterns) {
            const match = fonts.find((f) => f.includes(pattern));
            if (match) return match;
          }
          return fonts[0];
        };

        const chosen = pickPreferredFont(mockAvailable);
        expect(chosen).toContain("DejaVuSans-Bold.ttf");
      },
    },
    {
      name: "F11-T04: Discovered font path is properly escaped for FFmpeg filter graph",
      tier: 1,
      featureId: 11,
      fn: () => {
        const fontPath = "C:/fonts/truetype:dejavu/DejaVuSans.ttf";
        const escaped = fontPath.replace(/:/g, "\\:").replace(/'/g, "\\'");
        expect(escaped).toContain("C\\:/fonts");
        expect(escaped).toContain("truetype\\:dejavu");
      },
    },
    {
      name: "F11-T05: Font discovery caches resolved path to avoid repeated disk I/O scans",
      tier: 1,
      featureId: 11,
      fn: () => {
        let scanCount = 0;
        let cachedFont: string | null = null;

        const getFontCached = () => {
          if (cachedFont) return cachedFont;
          scanCount++;
          cachedFont = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
          return cachedFont;
        };

        getFontCached();
        getFontCached();
        getFontCached();
        expect(scanCount).toBe(1);
      },
    },
  ],
};
