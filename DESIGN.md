# Go In For — design tokens

> Derived from a Strava-style reference (big bold numbers, tiny uppercase labels, white cards on a cool off-white ground, one round primary action, orange as the brand accent) and adapted for a phone read in direct sun: every text pair meets 7:1, fills meet 4.5:1 with their label. Companion rules live in the Help screen and `tests/contrast.mjs` enforces the pairs below.

## Colors

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | #F7F7FA | #101014 | page ground (Icicle-like cool off-white) |
| `--surface` | #FFFFFF | #1B1B21 | cards, tiles |
| `--surface-2` | #EEEEF3 | #26262E | secondary buttons, tracks |
| `--ink` | #242428 | #F5F5F8 | primary text (Coal) |
| `--muted` | #4E4E5A | #B8B8C4 | labels, secondary text (deep Gravel, 8:1) |
| `--line` | #C9C9D2 | #3A3A44 | dashed outlines, grips |
| `--hair` | rgba(36,36,40,.12) | rgba(245,245,248,.14) | hairline borders |
| `--accent` / `--accent-ink` | #D64000 / #FFFFFF | #FF8A50 / #2A0F00 | primary action fill (deepened Strava orange, 4.6:1 with white) |
| `--amber` / `-ink` / `-soft` / `-text` | #D64000 / #FFFFFF / #FFE3D6 / #8A2900 | #FF8A50 / #2A0F00 / #3D1F12 / #FFC1A3 | "coming off", attention |
| `--pitch` / `-ink` / `-soft` / `-text` | #0B5FE0 / #FFFFFF / #DCE8FF / #0A3E9C | #6FA3FF / #061B3D / #17294A / #B9D2FF | "going in", goalie, positive |
| `--red` / `-ink` / `-soft` / `-text` | #B3261E / #FFFFFF / #FADFDB / #7E1D13 | #F48E80 / #2E0B07 / #3F1D19 / #F7B0A6 | left the field, danger |
| `--focus` | #0B5FE0 | #8DBBFF | focus ring |
| `--pocket-*` | bg #0B0B10, ink #F5F5F8, on #8FB8FF, off #FFB088, line #5A5A66 | same | pocket screen, always dark |

## Typography (Barlow, self-hosted)

| Level | Size / weight / tracking | Used for |
|---|---|---|
| Display | 40px / 700 / -.01em | clock and next-swap stats, pocket clock 64px |
| Headline | 30px / 700 / -.01em | screen titles |
| Title | 24px / 700 | call pairs ("Chase in for Craig"), summary names |
| Name | 20px / 700 | tile and pill names |
| Body | 17px / 500 / 1.45 | help and setup copy |
| Label | 12px / 700 / +.08em uppercase | stat labels, tile meta, section eyebrows |
| Button | 17px / 700 | pills; big buttons 20px |

## Shape

| Radius | Where |
|---|---|
| 18px | cards, call card |
| 14px | tiles, pills, sheets top |
| 999px | small pills (Say it, Swap now), toggles |
| 50% | round controls (54px side, 76px main) |

## Elevation

| Level | CSS | Where |
|---|---|---|
| 0 | hairline only | rule rows, list separators |
| 1 | `0 2px 12px rgba(36,36,40,.08)` | cards, tiles, side controls |
| 2 (accent) | `0 10px 28px rgba(214,64,0,.32)` | the one main round button |
| Bottom block | `0 -6px 18px rgba(36,36,40,.06)` | pinned call card + controls |

## Interaction states

Enabled: as specified. Pressed: `transform: scale(.97)` over 120ms (round main: .94). Selected: 3px focus ring. Disabled: 45% opacity. Focus-visible: 3px `--focus` ring, 2px offset.

## Motion

Durations 120ms (press) and 180ms (color, border). Reduced motion turns both off. No looping animation while a call is live; the state change itself is the signal.
