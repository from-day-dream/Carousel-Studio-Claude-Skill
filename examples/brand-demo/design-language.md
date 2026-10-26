# Design language: Quiet Desk

## The look in one paragraph
An editorial notebook. Warm paper with a faint 54px grid, a large serif headline doing almost all the work, and plain sans-serif for everything else. One terracotta accent, used on the emphasised word and on markers only. Lots of empty paper. One inverse (ink) slide per carousel for rhythm.

## Layout system
- Outer margin 96px on all sides. Safe area 72px (hard limit).
- Handle top-left and counter `NN / 05` top-right, both 96px from the top, Inter 22px, uppercase, 0.12em tracking, `muted` colour (`grid` colour on ink slides).
- Text block is left-aligned, starting at 324–380px from the top (hook sits a little lower, ~378px). Exception: slide 5 is centred.
- A bottom line at 96px from the bottom holds the teaser/swipe text (meta style).
- Composition variants: (A) type stack on grid paper; (B) inverse ink slide with a ruled list; (C) type stack anchored to the bottom with an oversized outlined numeral or glyph above it; (D) centred CTA with the logo.

## Type
- Headline: Fraunces 600, sentence case, −0.02em tracking, line-height 1.0–1.06. Hook 132px, other slides 96px. Emphasis word: Fraunces 600 italic in `accent` (`accentOnInk` on ink).
- Key line: Inter 400, 44px, line-height 1.3, max 800px wide. Key phrase in Inter 600 with a 4px `accent` underline, offset 8px.
- Support: Inter 400, 32px, line-height 1.4, `muted`. Or as a "fix" panel: ink panel, 32/36px padding, paper text, key phrase in `accentOnInk`.
- List: Inter 600, 38px, each item on a 1px rule, `→` marker in the accent colour.
- Kicker above headlines ("Mistake 1"): Inter 600, 22px, uppercase, 0.14em, accent colour.

## Colour use
- Default background: `paper` with the `grid` lines. Text in `ink`.
- Inverse slides: `ink` background, no grid, text in `paper`, accent becomes `accentOnInk`.
- Accent: only the emphasised headline word, list markers, kicker, key-phrase underline. Never body text, never backgrounds.
- `muted` is for support text on paper only. Never on ink (2.5:1).

## Texture, rules and details
- Grid: 1px `grid` lines every 54px, applied with two linear-gradients.
- Rules: 1px lines only. The hook's swipe cue is a 2px ink line from the left margin running off the right edge, with a chevron.
- One oversized decorative glyph per carousel at most (outlined with `-webkit-text-stroke`, accent colour, cropped by the edge).

## Images
- Type-led brand. When images are used: framed (not full-bleed), inside the margins, warm natural light, desks/paper/hands, no faces looking at camera.

## Do
- Leave at least a third of each slide empty.
- Let the headline be the only big thing.
- Keep the counter and handle in exactly the same spot on every slide.

## Don't
- No gradients, drop shadows, rounded cards or emoji.
- No centred text except slide 5.
- No more than one accent element competing with the emphasised headline word.
