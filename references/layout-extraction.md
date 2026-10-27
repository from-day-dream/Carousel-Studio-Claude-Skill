# Layout extraction

Turn a reference post into a reusable, **brand-adapted** layout spec once, at setup time. Never imitate a raw reference image during a carousel run: that drifts. Runs only ever read the approved `spec.md`.

## Rules
- Max **5** layouts per brand. If there are already 5, list them (number, name, one-line summary) and ask which one to replace before doing anything.
- Folder: `brands/<slug>/layouts/<n>-<kebab-name>/` holding `reference.png|jpg` (the user's image, copied as-is) and `spec.md`. `<n>` is the next free number 1–5.
- Take **structure** from the reference: grid, zones, scale contrast, rhythm, image treatment, recurring details. Do **not** take its colours, fonts, copy, logos or photos. Those always come from the brand kit.
- Measure in px at 1080×1350. If the reference has another aspect ratio, scale its width to 1080 and describe how the zones map onto 4:5.
- A spec is saved only after the user approves its sample slide.

## Steps
1. View the reference image. If it's a carousel screenshot with several slides, ask which slide to use, or extract one spec per distinct composition (still counting toward the 5).
2. Draft `spec.md` using the template below. Be numeric: px, ratios, counts.
3. Write a sample slide (`layouts/<n>-<name>/sample.html`) that follows the spec **in the brand's tokens**, with placeholder copy that respects the text budgets (references/html-rules.md).
4. Render it: `node <skill>/scripts/render.mjs --file <brand>/layouts/<n>-<name>/sample.html --brand <slug> --role body` (use `--role hook` if the layout is meant for slide 1). Fix any report errors, then show the user `reference.png` and `sample.png` side by side and explain in 2–3 lines what was kept and what was deliberately left out.
5. On approval, keep `spec.md`, `sample.html` and `sample.png`. On rejection, adjust and re-render (max 3 rounds, then ask the user what's off).

## spec.md template

```markdown
# Layout <n>: <name>

**Best for:** hook | single idea | list | quote/stat | CTA     **Image:** none | framed | full-bleed

## Grid & margins
- Outer margin: __px (never inside the brand safe area of __px)
- Columns: __ (text block spans columns __–__, ≈ __px wide)
- Vertical anchor: text block starts at __px from top | sits __px above bottom

## Zones (x, y, w, h in px)
| Zone | Box | Notes |
|---|---|---|
| meta (handle / counter) | | identical on every slide |
| headline | | |
| key line | | |
| support / list | | |
| image / visual | | |
| logo | | CTA (last) slide only unless the reference shows otherwise |

## Type scale
- Headline : key line ratio ≈ __ : 1. Headline lines: __–__. Key line max width __px.
- Emphasis: how the reference emphasises one word, translated to the brand's emphasis token.

## Image treatment
- full-bleed | framed (__px inset) | none. Scrim: none | gradient from __ (opacity __) | solid panel behind text.
- Where the subject must sit so text stays clear (reserve this area in the image prompt).

## Recurring details
- Rules, markers, counters, crop-off-edge elements, texture.

## Deliberately not taken
- Colours: …  Fonts: …  Copy/imagery: …  Anything off-brand per design-language.md.
```

## Picking layouts during a run
- Read only the specs chosen for this carousel (max 3), never all five.
- Note in the slide plan which spec each slide adapts. One spec can serve several slides; vary composition within the spec's system for rhythm.
