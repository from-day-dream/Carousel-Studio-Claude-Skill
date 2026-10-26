# Slide HTML contract

`scripts/render.mjs` depends on this contract. Break it and the render report will flag the slide.

## File
- One standalone HTML file per slide: `slides/01.html` … `slides/05.html`. Rendered at exactly **1080×1350**, deviceScaleFactor 1.
- `<head>` has one `<style>` block that starts with the two placeholders, then your slide CSS:
  ```html
  <style>
  {{FONT_FACES}}
  {{TOKENS}}
  /* your CSS */
  </style>
  ```
  The script replaces them with `@font-face` rules for the brand's local fonts and a `:root` block of tokens, plus a reset (`box-sizing:border-box`, zero body margin, 1080×1350 body with `overflow:hidden`).
- Each slide is its own page, so normal CSS (classes, flex, grid, pseudo-elements) is fine.

## Tokens (never hard-code brand values)
| Token | From `tokens.json` |
|---|---|
| `var(--brand-<colour>)` | `colors.<name>` (camelCase → kebab: `accentOnInk` → `--brand-accent-on-ink`) |
| `var(--brand-font-<role>)` | `fonts.<role>.family` (`heading`, `body`, …) |
| `var(--brand-size-<level>)` | `typeScale.<level>` (`hook`, `headline`, `key`, `support`, `item`, `clarifier`, `meta`) |
| `var(--brand-space-<key>)` | `spacing.<key>` (`margin`, `gutter`, …) |
| `var(--brand-safe)` | `spacing.safeArea` |

- Only brand font families, and only weights/styles that exist as font files (`em` on a heading font needs the italic file). The report warns when the browser would synthesise one. Note `<strong>`/`<b>` default to `bolder`: set an explicit `font-weight`.
- No raw hex outside the token set (the report warns). `transparent`, `currentColor` and `color-mix()` of tokens are fine.

## Assets
- **No external URLs** (no CDNs, no web fonts, no remote images). Error in the report.
- Images by relative path from the slide file: `<img src="../images/02.png">`.
- Logo: `<img data-logo src="{{LOGO}}">` (light backgrounds) or `{{LOGO_ALT}}` (dark). The `data-logo` attribute keeps it out of the visual count.
- A purely decorative visual (oversized numeral, shape, illustration) gets `data-visual` and `aria-hidden="true"`. Max one image/visual per slide.

## Required attributes
- Root element: `<div class="slide" data-slide="N">`.
- **Every** text element gets `data-text` with its level: `headline` | `key` | `support` | `item` | `clarifier` | `meta` (handle, counter, kicker, teaser, swipe label). Untagged text is invisible to the checks, so tag it all.
- Exactly one `headline` per slide, and it must have the largest computed font-size on the slide.
- Slide 1 has a swipe-cue element with `data-cue="swipe"`.
- Emphasis inside a level: one `<em>` or `<strong>` span per element, styled via tokens.
- A `clarifier` sits inside or right after its `item`.

## Space and legibility
- Minimum font-size **28px** (`meta` may go down to 20px).
- All non-meta text inside the safe area (`spacing.safeArea`, default 72px from every edge). Lay out with the brand margin (usually larger), not the safe area.
- No fixed heights on text boxes unless needed; if you set one, the text must fit (overflow is an error).
- Line-height ≥ 1.0 for headlines, so descenders don't collide with the next line's ascenders. Check this visually.
- `text-wrap:balance` on headlines and `text-wrap:pretty` on key/support lines, so a lone last word never dangles. If a headline still breaks badly, rewrite it or adjust `max-width`. Don't insert manual `<br>`s unless necessary.
- Over images: a scrim (gradient from a token colour), a solid panel, or text placed in the image's reserved empty area. Contrast is measured against the actual rendered pixels behind each text element.
- Repeating elements (counter, handle, mark, teaser line) sit at **identical** coordinates on every slide. Copy the CSS for them verbatim between slides.

## Slide 5 (CTA)
Logo, handle and the closing CTA text from `brand.md`. Calm and minimal: one headline, one support line at most, lots of space. It still has one `headline`.

## Minimal example
```html
<!doctype html>
<html><head><meta charset="utf-8">
<style>
{{FONT_FACES}}
{{TOKENS}}
.slide{position:relative;width:1080px;height:1350px;overflow:hidden;background:var(--brand-paper);color:var(--brand-ink)}
.top{position:absolute;top:96px;left:96px;right:96px;display:flex;justify-content:space-between;font-family:var(--brand-font-body);font-size:var(--brand-size-meta)}
.main{position:absolute;left:96px;right:96px;top:360px}
h1{margin:0;text-wrap:balance;font-family:var(--brand-font-heading);font-weight:600;font-size:var(--brand-size-hook);line-height:1.05}
h1 em{font-style:italic;color:var(--brand-accent)}
.key{margin:48px 0 0;max-width:800px;font-family:var(--brand-font-body);font-size:var(--brand-size-key);line-height:1.3}
.cue{position:absolute;left:96px;right:0;bottom:160px;height:2px;background:var(--brand-ink)}
</style></head>
<body>
<div class="slide" data-slide="1">
  <div class="top"><span data-text="meta">@handle</span><span data-text="meta">01 / 05</span></div>
  <div class="main">
    <h1 data-text="headline">Your mornings are <em>leaking</em> focus</h1>
    <p class="key" data-text="key">Three habits drain your best two hours. Here's the fix for each.</p>
  </div>
  <div class="cue" data-cue="swipe"></div>
</div>
</body></html>
```
Full worked examples: `examples/brand-demo/sample-carousel/slides/`.
