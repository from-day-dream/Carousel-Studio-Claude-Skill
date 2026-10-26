# Image prompting

Images are optional and support the slide's idea. They never carry text: the script appends a "no text, no letters, no logos" sentence to every prompt, and headlines, copy and logo are always HTML on top.

## Script
```
node <skill>/scripts/image.mjs --check [--want on|off] [--provider fal|atlas|openai] [--model <key>] --brand <slug>
node <skill>/scripts/image.mjs --batch <carousel>/images/jobs.json --brand <slug> [--provider …] [--model …]
node <skill>/scripts/image.mjs --prompt "<text>" --out <carousel>/images/02.png [--refs a.png,b.png] [--seed 7] --brand <slug>
```
- `jobs.json`: `[{ "prompt": "...", "out": "<carousel>/images/02.png", "refs": ["<brand>/style-refs/mood.jpg"], "seed": 7 }]`. Jobs run in parallel. Prefer one batch over many single calls.
- Output: `images/0N.png` at exactly 1080×1350 (generated at 1088×1360, centre-cropped) plus `images/0N.json` (provider, model, endpoint, full prompt, references, seed).
- The brand's `styleAnchor` (images.json) is appended automatically; `--no-anchor` skips it.
- The script retries once by itself. Exit 1 = that image failed: redesign the slide type-led. Exit 3 = fatal (key, quota, model config): stop calling the provider for the rest of the run. Exit 2 = usage/config error. Exit 4 = a layered image is partial (see below).

## Layered images
For a photo plus in-scene graphics (floating icons, a focus bracket on a face), build the image in up to 3 passes: a base, then edits of the previous result. A job gets `"passes": [{ "prompt": … }, …]` instead of `"prompt"`. Planning, edit-prompt wording, per-pass review, redoing a pass and placing HTML labels on the result are all in `references/layered-images.md`.

## Models
Models are defined in `<skill>/config/providers.json`; the user can override or add any in `<ws>/providers.json`. A brand picks one in `images.json` (`provider` + `model`).

| Key | Kind | Consistency lever |
|---|---|---|
| `gpt-image-2.5` (default, fal + atlas + openai) | GPT Image 2.5 Sunburst | Reference images (`--refs`) switch to the edit endpoint, plus the style anchor |
| `gpt-image-2` | GPT Image 2 | Same |
| `flux-dev` (fal) | FLUX dev | Style anchor + a fixed `seed` per carousel |
| `flux-lora` (fal) | FLUX + LoRA | The brand LoRA (`images.json` → `lora.url`, `lora.scale`) + style anchor + seed |

## Writing a prompt
Order: **subject → composition/negative space → light → palette → texture/medium → camera**. Concrete nouns, no adjectives that don't change pixels ("beautiful", "stunning").

1. **Subject:** one subject that carries the slide's idea. "A single open paper notebook on an oak desk", not "productivity".
2. **Reserve the text zone.** Read the slide plan: where do the headline and key line sit? Say it explicitly: "subject in the lower right third; the upper 55% of the frame is plain, softly lit wall with nothing in it". Put the subject *away* from the text block.
3. **Keep it inside the crop.** Output is cropped to 4:5 from the centre. Keep important content away from the outer ~5% of every edge.
4. **Light and palette:** name colours from the brand ("warm off-white paper tones, deep ink-brown shadows, one terracotta accent object"). This keeps images on-brand without text in them.
5. **Medium:** photo / film / illustration / 3D, in line with `design-language.md` → Images.
6. **Never** ask for text, letters, numbers, signage, UI, logos or brand names.

Example (for a slide whose text sits top-left):
> A ceramic mug and a closed notebook on a pale oak desk, placed in the lower-right third of the frame. The upper half and left side are an empty warm off-white wall with soft morning window light from the right. Muted palette of paper beige, ink brown and one terracotta mug. Natural photograph, 50mm, shallow depth of field, fine film grain.

## Consistency across slides
- Write one **style anchor** per brand (images.json `styleAnchor`): medium, light, palette, grain. It's appended to every prompt.
- GPT Image: pass `<brand>/style-refs/*` as `refs` for the first image. For later slides, pass the first generated image (`images/02.png`) as a ref so the set matches.
- FLUX: same `seed` for all slides in a carousel, plus the LoRA if the brand has one.

## After generating
View every image before writing HTML. Regenerate (once) if the subject sits where the text goes, the image contains any text or letters, or it clashes with the palette. If it still fails, move the text zone, use a scrim/panel, or make the slide type-led.
