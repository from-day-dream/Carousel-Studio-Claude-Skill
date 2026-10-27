---
name: carousel-studio
description: Create branded Instagram or LinkedIn carousels (social slide posts) (5 slides by default, up to 20 on request) from a topic in a saved brand style, rendered locally to 1080×1350 PNGs with a caption and hashtags. Use when the user wants to make a carousel or slide post, set up or edit their brand kit (fonts, colours, logo, voice, design language), add a reference layout from an example post, revise a slide of an existing carousel ("make slide 3 punchier", "regenerate with layout 2"), or browse past carousels.
argument-hint: "<topic> [N slides] [framework] [layouts] | setup | add layout | revise <carousel> slide <n>"
---

# Carousel Studio

Turns a topic into a branded 1080×1350 carousel of **N slides: 5 by default, 3–20 if the user asks for a number** ("10 slides", "a 7-slide carousel"). You do the strategy and design every slide as HTML; local scripts render the PNGs with the brand's exact fonts and check layout and retention rules. Everything runs locally on the user's machine.

**Paths.** `<skill>` = the base directory of this skill (where this file lives). `<ws>` = the workspace: `$CAROUSEL_STUDIO_HOME` if set, else `./carousel-studio` in the current project. Run scripts with `node <skill>/scripts/<name>.mjs` and always pass `--workspace <ws>` when `<ws>` isn't `./carousel-studio` relative to the current directory.

## Preflight (every run)
1. `node <skill>/scripts/setup.mjs --check`: JSON with `deps`, `chromium`, `workspaceExists`, `activeBrand`, `brands`.
2. If `deps` or `chromium` is false, run `node <skill>/scripts/setup.mjs` once (installs npm packages and Playwright Chromium; takes a minute).
3. If there's no workspace or no brand, offer brand setup, or `setup.mjs --demo` to try the bundled demo brand ("Quiet Desk") first.

## Route the request
| User wants | Do |
|---|---|
| Set up / edit the brand | **Setup** below |
| Add or replace a reference layout | **Add layout** below |
| A carousel on a topic | **Generate** below |
| Change part of an existing carousel | **Revise** below |
| See past carousels | **Gallery** below |

Multiple brands: `<ws>/config.json` → `activeBrand`. If the user names another brand, pass `--brand <slug>`; switch the active brand only if they ask.

## Setup
Follow `references/brand-setup.md`. It ends with an approved brand test slide.

## Add layout
Follow `references/layout-extraction.md` (max 5 per brand, saved only after the user approves a sample slide).

## Generate
Show a task list (TaskCreate or a checklist) with these steps and keep it current.

1. **Load context.** Read `<ws>/brands/<slug>/brand.md`, `tokens.json`, `design-language.md`, and `references/retention-framework.md`, `references/design-principles.md`, `references/html-rules.md`. Layouts: if the user named them, use those (max 3); otherwise list the saved ones in one line and pick the best fit yourself, saying which. Read **only** the chosen `layouts/*/spec.md`.
2. **Images on or off?** Before any planning run `node <skill>/scripts/image.mjs --check --brand <slug>`, adding `--want on|off`, `--provider fal|atlas|openai` and/or `--model <key>` if the user's request said so ("with images", "no images", "use FLUX", "use Atlas", "use OpenAI"). Act on `decision`:
   - `type-led`: no images. If `message` mentions a missing key, say it in one line ("No fal key found, so this carousel is type-led") and carry on.
   - `images`: images are on. Load `references/image-prompting.md`.
   - `ask`: images were requested but the key or model is missing. Stop and ask: continue type-led, or add the key to `<ws>/.env` and resume. If no reply is possible (unattended), continue type-led and say so.
   A key alone never turns images on: they cost money. Record the outcome in `meta.json` → `images`.
3. **Strategy** → start `meta.json`: `slideCount` (N: the number the user gave, else 5; clamp to 3–20 and say so if you clamped; a request under 3 can't fit hook + point + CTA), `title`, `framework` (retention-framework §6: the user's choice, or yours, stated), `positioning` (how this post expresses the brand), `context` (`audience`, `promise` = the hook's explicit gain, `arc`), `ideas` (4–6 follow-up post ideas), `caption` (brand voice, line breaks, ends with the CTA), `hashtags` (8–15, mixed reach).
4. **Slide plan.**
   - Narrative spine first: exactly N lines, one per slide, each answering "why swipe next?" Slide 1 is the hook, slide N the CTA, slides 2…N−1 the body (stretch the framework per retention-framework §6).
   - Then per slide: `role`, the one `idea`, copy per level (`headline` with its single emphasised word, `key`, `support`, `items`), `transition` device, `layout` spec adapted, `composition` (type stack / inverse / visual-led / CTA).
   - Count words against the budgets (retention-framework §7) **now** and cut until they pass.
   - Rhythm: no two adjacent slides with the same composition.
   - If images are on, decide per slide: alternate image-led and type-led, typically 40–80% of slides get an image, never all N. The hook gets one only if it makes the promise clearer. The CTA slide (N) stays type-led with the logo. Follow the layout spec (a full-bleed layout favours an image). Use an image only where it carries the idea. Note for each image where the text zone is.
   - If a slide's visual is a photo plus graphic elements that sit in or on the scene (floating icons, a focus bracket on a face, annotations on an object), plan it as a **layered image**: write its layer stack (base + up to 2 edit passes + what stays HTML) per `references/layered-images.md`. At most 1–2 layered slides per carousel (up to 3 when N > 10).
   - Show the plan compactly (spine + headlines) and continue unless the user objects. If they said "just do it", don't pause.
4b. **Images (only if on).** Write one prompt per image slide per `references/image-prompting.md` (reserve the text zone, keep content inside the 4:5 crop, no text). Put all jobs in `<carousel>/images/jobs.json` and run them in parallel in one call: `node <skill>/scripts/image.mjs --batch <carousel>/images/jobs.json --brand <slug>`. View every image. Regenerate once any that clash with the plan (subject under the headline, stray text, off-palette). Layered slides: load `references/layered-images.md`, put the job (with `passes`) in the same jobs.json, review every `0N.passK.png`, and redo a bad pass with `fromPass`.
   - **Exit 4 (layered image partial):** the PNG is built from the last good pass. Rebuild the missing elements in HTML/SVG or drop them, and record `partial` on the slide's `image` in `meta.json`.
   - **Exit 1 (some failed after the script's own retry):** redesign those slides type-led so the carousel still completes. Record `"fallback": "<reason>"` on the slide in `meta.json`.
   - **Exit 3 (fatal: bad key, quota, model config):** stop calling the provider for the rest of the run. Finish type-led and report the error once.
   - Never stop the whole run over an image. At the end, list which slides fell back and why.
5. **Write slides.** Create `<ws>/output/<YYYY-MM-DD>-<topic-slug>/slides/01.html … NN.html` (two-digit, zero-padded; no gaps, no extra files: the renderer treats the highest number as the CTA) per `references/html-rules.md` (append `-2`, `-3` if the folder exists). Copy the repeating elements' CSS verbatim across slides. `examples/brand-demo/sample-carousel/slides/` shows the expected markup.
6. **Render.** `node <skill>/scripts/render.mjs <carousel-dir> --brand <slug>`. Exit 2 = fatal (usually a font). Fix it, don't work around it. Exit 1 = the report has errors.
7. **Critique.** Follow `references/critique-rubric.md`: contact sheet, each PNG, the report. Fix and re-render failing slides with `--slide NN`. Max 2 rounds; then stop and say what's still imperfect.
8. **Save.** Finish `meta.json` (schema below), write `caption.txt` (caption, blank line, hashtags on one line), then run `node <skill>/scripts/gallery.mjs` to update the gallery index.
9. **Report back.** Show `contact-sheet.png`, the caption, the framework used and the folder path. List any image fallbacks. Offer the single most relevant next step (e.g. "want slide 3 punchier?", "try it with layout 2?", "retry the image on slide 2?").

### meta.json
```json
{
  "topic": "", "direction": "", "brand": "<slug>", "createdAt": "<ISO>",
  "slideCount": 5, "title": "", "framework": "", "layouts": ["1-hook-stack"],
  "images": { "enabled": false, "provider": null, "model": null, "reason": "", "fallbacks": [] },
  "positioning": "", "context": { "audience": "", "promise": "", "arc": "" },
  "ideas": [], "caption": "", "hashtags": [],
  "spine": ["01: …", "02: …", "…", "NN: …"],
  "slides": [
    { "n": 1, "role": "hook", "idea": "", "headline": "", "key": "", "support": "", "items": [],
      "transition": "", "layout": "", "composition": "", "notes": "",
      "image": null }
  ],
  "//": "image on a slide with an image: { \"file\": \"images/02.png\", \"prompt\": \"...\", \"fallback\": \"\" }; layered adds \"passes\": 3, \"completed\": 3, \"partial\": false. fallbacks: [{ \"slide\": 2, \"reason\": \"...\" }]",
  "critique": { "rounds": 0, "fixed": [], "remaining": [] }
}
```

## Revise
- Find the carousel: the most recent folder in `<ws>/output/` unless the user names one. Read its `meta.json` and the affected `slides/0N.html`. Reload `retention-framework.md` and `html-rules.md`.
- Edit **only** the affected slide(s). Re-render with `--slide NN` (this rebuilds the contact sheet and merges into the report). Run the critique checklist on the changed slide and its neighbours (progression).
- Update that slide's entry in `meta.json` (and `caption.txt` if the copy change affects it). Never regenerate the whole carousel unless asked.
- "Make it N slides" / "add a slide": a structural change. Re-plan the spine for the new count, then renumber files so they stay contiguous (`01…NN`), delete stale `slides/`/`png/` files beyond NN, update every counter (`03 / 07`), and re-render the whole carousel. Keep existing copy where it still fits.
- "Regenerate with layout N": treat it as a revision of every slide whose `layout` changes; keep the strategy and copy unless asked.
- "Swap / retry the image on slide N": run `image.mjs --check` first, then regenerate just that image (`--prompt … --out <carousel>/images/0N.png`, reusing or improving the prompt from `images/0N.json`), view it, adjust the slide HTML if the text zone moved, and re-render that slide. Clear the slide's `fallback` on success.
- "Redo the focus box on slide 2" / "retry pass 3": for a layered image, fix that pass's prompt and rerun the job with `--from-pass K` (earlier passes are reused), then re-check the HTML label positions against the new image.
- Show the changed slide PNG plus the updated contact sheet, then run `gallery.mjs` again.

## Gallery
`node <skill>/scripts/gallery.mjs` rebuilds `<ws>/index.json` and `<ws>/gallery.html`. To browse, the user runs `node <skill>/scripts/gallery.mjs --serve` (built-in local server, default http://localhost:4173) and opens the address. Browsers block the index over `file://`, so a server is required. Give the user that one-line command with the real path filled in; offer to start it in the background. The gallery shows cards with thumbnails, Context/Positioning/Ideas/Caption chips with copy buttons, a lightbox (arrow keys, Esc) with slide details and image prompts, single-PNG download and a "Download all" zip.

## Rules that always apply
- Text and logo are always HTML. Never put text in images, even with GPT Image.
- Slide HTML references images only by local relative path (`../images/02.png`), never a remote URL.
- Only brand fonts, token colours and the brand's logo files.
- Never loosen the retention budgets without warning the user and getting a yes.
- Keep context lean: read only the references and layout specs the current step needs.
- "Quick mode" (user's words): skip showing the plan and do one critique round at most, but still fix every report error.
