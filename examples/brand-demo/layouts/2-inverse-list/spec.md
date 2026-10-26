# Layout 2: Inverse list

**Best for:** list (steps, fixes, checks)     **Image:** none (solid ink)

## Grid & margins
- Outer margin: 96px (brand safe area 72px)
- Columns: 6; everything spans 888px.
- Vertical anchor: kicker at 324px, list follows the key line.

## Zones (x, y, w, h in px)
| Zone | Box | Notes |
|---|---|---|
| meta (handle / counter) | 96, 96, 888, 28 | `grid` colour on ink |
| kicker | 96, 324, 888, 28 | accentOnInk |
| headline | 96, 384, 888, ~200 | 1–2 lines at 96px |
| key line | 96, +48, 800, ~120 | |
| list | 96, +72, 888, ≤ 4 × 84 | each item on a 1px `muted` top rule, 22px vertical padding |
| teaser line | 96, 1226, 888, 28 | meta style |

## Type scale
- Headline : list item ≈ 2.5 : 1 (96/38). Items Inter 600 so they read as a set.
- Emphasis: one headline word in Fraunces italic, `accentOnInk`.

## Image treatment
- None. Solid `ink` background; this is the carousel's rhythm break. Use once per carousel.

## Recurring details
- `→` marker in `accentOnInk`, 28px gap to the item text.
- Max 4 items, ≤ 5 words each.

## Deliberately not taken
- This spec is the demo brand's own; nothing external.
