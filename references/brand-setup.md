# Brand setup

Goal: a brand kit specific enough that every carousel looks like the brand without the user re-explaining it. Ask in **small batches** (2–4 questions per message), never one long form. Accept pasted text, links (fetch the user's site or Instagram and summarise what it shows), and uploaded files. Draft answers yourself wherever you can and ask the user to confirm, rather than making them write from scratch.

`<skill>` below is the folder this skill lives in; `<ws>` is the workspace (`./carousel-studio` or `$CAROUSEL_STUDIO_HOME`).

## 0. Create the kit
```
node <skill>/scripts/setup.mjs --init --brand <slug>
```
Creates `<ws>/brands/<slug>/` from `templates/brand/` and sets it active in `<ws>/config.json` if none is. Slug: lowercase-dashes from the brand name. To try the skill first, `setup.mjs --demo` installs the Quiet Desk demo brand as `demo`.

## 1. Identity (batch 1) → `brand.md`
Name, handle, website. Then: what the brand does and for whom (positioning), who reads the posts (audience). If they give a site/Instagram link, read it and propose positioning + audience for them to correct.

## 2. Voice (batch 2) → `brand.md`
3–5 voice traits, each with a do/don't example line. Words to use and to avoid. The exact closing CTA text for the last slide (default: "Follow @handle for more <topic>").

## 3. Fonts → `tokens.json` + `fonts/`
For each role (`heading`, `body`, optional `accent`):
- **Google Font:** `node <skill>/scripts/fonts.mjs --family "<Family>" --weights 400,600 [--italic] --role heading --brand <slug>`. Download every weight and style the design will use (e.g. italic for an emphasis word). Missing weights get faux-synthesised by the browser and the render report warns about it.
- **User's own files:** copy them into `fonts/` and add `{ "family", "files": [{ "path": "fonts/…", "weight": 600, "style": "normal" }] }` to `tokens.json` by hand. `family` must be the name the slides will use. ttf, otf, woff and woff2 are all supported.
- If they don't know: propose 2 pairings that fit the voice, render specimens for both, and let them pick.

Then render the specimen and **show it**:
```
node <skill>/scripts/render.mjs --specimen --brand <slug>
```
It must say all font files loaded. Exit code 2 means a font failed: fix it before going on.

## 4. Logo → `logo/`
Copy the files in (SVG preferred, PNG with transparency accepted). Set `logo.primary` (for light backgrounds) and `logo.alt` (for dark). If there's only one version, ask whether it works on both dark and light backgrounds; if not, note in `design-language.md` which backgrounds slide 5 may use.

## 5. Colours → `tokens.json`
At least `background`, `text` and `accent` roles; usually also a muted/secondary text colour and an inverse/panel colour. Name colours by what they are (`paper`, `ink`, `clay`), set a `role` for each, and mark decorative colours `"never text"`. Re-render the specimen: its contrast grid flags text pairings under 4.5:1. Tell the user which pairings are off-limits for text and record them in `design-language.md`.

## 6. Design language → `design-language.md`
Draft it yourself from everything gathered (their words, the logo, example posts or site) using the template headings. It must be **specific**: margins in px, type case and tracking, which colour goes where, rules and textures, image treatment, plus explicit Do/Don't lists. Adjectives alone ("clean, modern") are not acceptable. Show it back for approval and revise.

Also set `typeScale` and `spacing` in `tokens.json` to match it.

## 7. Images → `images.json`
Ask whether they want AI images in carousels by default. A fresh kit has `enabled: false`, so nothing costs money until they opt in. Never turn images on just because a key exists.

If yes:
1. **Provider:** `fal`, `atlas` (Atlas Cloud) or `openai` (the OpenAI API directly). The default model on all three is `gpt-image-2.5` (GPT Image 2.5 Sunburst). OpenAI may require the user's API organization to be verified before GPT Image models work; a 403 on the test image usually means that. On fal, `flux-dev` and `flux-lora` are also available (FLUX-LoRA if the brand has a trained style LoRA). All models are listed in `<skill>/config/providers.json`. To change an endpoint or add a model, copy the entry into `<ws>/providers.json` and edit it there.
2. **Key:** ask them to add `FAL_KEY=…`, `ATLAS_CLOUD_API_KEY=…` or `OPENAI_API_KEY=…` to `<ws>/.env` themselves (there's a `.env.example`). Don't ask them to paste the key into chat.
3. **Style anchor:** write one sentence that fixes medium, light, palette and texture from `design-language.md` (e.g. "Natural film photograph, soft morning window light, warm paper beige and ink brown palette, fine grain."). Put it in `styleAnchor`.
4. **Style refs (GPT Image):** optionally copy 1–3 mood images into `style-refs/`.
5. **LoRA (FLUX-LoRA):** set `lora.url` and `lora.scale` (0.6–1.0).
6. **Test once** before saving `enabled: true`: `node <skill>/scripts/image.mjs --prompt "<a typical subject for this brand, with the text zone reserved>" --out <ws>/brands/<slug>/test/images/test.png --brand <slug>`. Show the result. If it fails, fix the key or model, or leave images off.

Set `provider`, `model` and `enabled` in `images.json`.

## 8. Reference layouts (optional)
Offer to add up to 5 reference layouts now or later (references/layout-extraction.md).

## 9. Brand test slide
Write a cover and a closing slide that follow `design-language.md` and `references/html-rules.md`:
```
<ws>/brands/<slug>/test/slides/01.html   (hook: a sample promise for this brand's audience)
<ws>/brands/<slug>/test/slides/05.html   (CTA: logo, handle, the closing CTA text)
```
Render with `node <skill>/scripts/render.mjs <ws>/brands/<slug>/test --brand <slug>`, fix every report error, then show the user both PNGs. Ask for approval of the *system* (type, colour, margins, logo use), not the copy. Iterate on `design-language.md` / `tokens.json` until approved. Setup is done when the test slides pass with zero errors and the user approves.

## Editing a brand later
Change only the file concerned, then re-render the specimen (for fonts or colours) or the test slides (for anything visual) and show the result.
