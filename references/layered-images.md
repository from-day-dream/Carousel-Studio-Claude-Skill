# Layered images

Some slide concepts are a photo plus graphic elements that live *in* the scene: icons floating around a subject, a camera focus bracket on a face, an annotation pointing at an object. One prompt can't place these reliably. Build the image in **passes** instead: a base image, then up to two edits, each adding one group of elements to the previous result.

- **Max 3 passes:** base + 2 edits. The script refuses more.
- **Text is never generated.** Headlines, labels and captions are HTML on top, positioned against the finished image.
- Needs a model with an edit endpoint (`gpt-image-2.5` on fal, atlas or openai). FLUX models can't layer.
- Every pass is a billed call. Layer at most 1–2 slides per carousel, and only where the composite carries the slide's idea.

## 1. Decide if the slide needs layers
Layer when an element must sit **relative to the photo**: it's positioned against the subject, or it must share the photo's grain, light and depth. Don't layer when HTML does it better:

| Element | Where it goes |
|---|---|
| Subject, setting, light, backdrop | **Pass 1** (base) |
| Scene-relative graphics: icons or UI chrome floating in the space, stickers, props | **Edit pass** |
| Subject-relative graphics: focus brackets, highlights, scribbles or arrows on the subject | **Edit pass**, after the subject exists |
| Text of any kind: headline, labels, captions, counters | **HTML** |
| Shapes that need the exact brand colour, crisp vector edges or pixel alignment with text (selection boxes, rules, cursors around a headline) | **HTML/CSS/SVG** |

If every overlay ends up in the HTML column, it isn't a layered image: generate one base image and build the rest in HTML.

## 2. Plan the layer stack (in the slide plan, before any prompt)
Write it down per layered slide:

```
Slide 2, layered (3 passes)
  Pass 1 base: <subject + setting>. Negative space: <which zones stay empty, and why>
  Pass 2 edit: <one group of elements> at <positions>
  Pass 3 edit: <one group of elements> at <positions>
  HTML: <text and precise shapes>, positioned from the final image
```

Rules:
- **Pass 1 carries a negative-space map.** Say where the subject sits and which zones stay empty, both for later overlays and for HTML text. Later passes can only add into space the base left free.
- **One group per edit pass.** Group elements of the same kind or job ("three folder icons + a chat bubble": all floating UI icons). Don't mix unrelated additions in one edit.
- **Order from scene-level to subject-precise.** Large or ambient elements first, tight elements that hug the subject last. They're the most likely to need a redo, and redoing the last pass is cheapest.
- **More than 3 passes' worth of ideas?** Merge groups, move elements to HTML, or cut them. The slide still needs to read in 2 seconds (retention-framework §2).

## 3. Write the prompts
**Pass 1** is a normal image prompt (references/image-prompting.md) with the negative-space map made explicit. The brand style anchor is appended automatically.

**Edit passes.** The script prepends "Edit the first image. Keep everything already in it unchanged: subject, face, pose, clothing, lighting, background, framing and colours. Only make the change described." Your prompt describes only the addition, in this order:

1. **What and how many:** "Add three folder icons".
2. **Style:** "flat macOS-style light-blue folder icons with a soft top tab and subtle shading".
3. **Size:** as a share of frame width: "each about 12% of the image width".
4. **Position:** as frame percentages, or relative to the subject: "in a loose column, centred about 12% from the left edge, at roughly 28%, 48% and 72% from the top". "A thin yellow viewfinder bracket tightly framing her face, corners only."
5. **Exclusions:** "not overlapping the person; keep the top 22% of the frame empty".
6. **Integration:** "match the photo's soft light and film grain; icons sit flat on the image plane, no drop shadows" (or the opposite, if they should feel physical).
7. **No text:** "no labels, no text under the icons" (the script also appends a no-text sentence).

Keep every element inside the central safe area, at least 5% from each edge. The final crop is tiny (1088×1360 → 1080×1350), but HTML margins sit there too.

**References for an edit pass** (optional, `refs` on that pass): an icon or sticker image to copy the look of. The previous pass is always the first input; your refs come after it.

## 4. Run
Put the layered job in the carousel's `images/jobs.json` next to the normal jobs. They all run in parallel; the passes inside one job run in order.

```json
{
  "out": "<carousel>/images/02.png",
  "refs": ["<ws>/brands/<slug>/style-refs/mood.jpg"],
  "passes": [
    { "prompt": "Editorial fashion photograph of a woman with long dark hair in an oversized black pinstripe blazer and shorts, seated on the floor with legs folded to one side, against a plain light-grey seamless studio backdrop. She sits in the lower-right two thirds of the frame, looking off to the left. The top 22% of the frame and the left 35% are empty grey backdrop. Soft even studio light, subtle film grain, muted colour." },
    { "prompt": "Add three flat macOS-style light-blue folder icons with a soft top tab and subtle shading, each about 12% of the image width, in a loose column centred about 12% from the left edge at roughly 28%, 48% and 72% from the top. Also add one small white rounded chat bubble with three grey dots, about 9% of the image width, near the right edge at about 27% from the top. Nothing overlaps the woman; the top 22% stays empty. No labels under the icons." },
    { "prompt": "Add a thin yellow camera-viewfinder focus bracket tightly framing the woman's face (corner marks only, with small centre ticks), a small yellow exposure sun icon just to the right of the bracket, and one thin vertical yellow guide line passing behind the sun from just below the chat bubble down to her shoulder. Lines about 2-3 px thick at this size. Do not alter her face or hair." }
  ]
}
```

Single job from the command line: `image.mjs --pass1 "…" --pass2 "…" --pass3 "…" --out <carousel>/images/02.png --brand <slug>`.

Files: `images/02.pass1.png`, `02.pass2.png`, `02.pass3.png` (raw, uncropped) and `images/02.png` (final, 1080×1350), plus `02.json` with every pass's prompt, endpoint and inputs.

## 5. Review each pass
View the pass files in order. For each pass, check:
- **Preserved:** same face and identity, same pose, colours and framing as the previous pass. Identity drift is the most common failure.
- **Added correctly:** the right elements, count, size and position.
- **Text zones still clear:** nothing sits where the HTML headline or labels go.
- **No stray text** or letter-like marks.

If a pass is wrong, redo **only that pass and later ones**: fix its prompt in jobs.json, then run that job alone with `"fromPass": K` (or `--from-pass K`). The earlier pass files are reused. Redo each pass at most once. If identity drifted, add "Do not alter her face, hair or expression in any way" and name exactly what to add.

## 6. Put the text on in HTML
The final image is full-bleed at 1080×1350, so **image pixel coordinates are slide CSS pixels**. View `02.png`, read off each element's box (e.g. "folder 1 spans x 80–210, y 360–470"), and position labels absolutely against it (`left`/`top` in px).
- Labels are `data-text="item"`: ≤ 5 words each. Shorten long questions ("Am I doing what I want?").
- **Contrast:** labels must hit 4.5:1 against the pixels behind them, and the render report measures it. White on light grey fails. Use the brand's ink colour, or a small token-coloured panel behind the label.
- Headlines and precise shapes (like a text-selection box around part of the headline) are HTML/CSS in the brand's tokens.
- The whole layered image counts as **one visual** for the "≤ 1 visual per slide" rule. Don't add another image or a decorative glyph on top.
- Re-render and check the report: safe area, contrast and budgets apply to these labels like any other text.

## 7. When a pass fails (exit 4)
If an edit pass fails after its retry, the job is **partial**. `02.png` is built from the last good pass, and the sidecar has `partial: true, completedPasses: k`. Then either:
- **rebuild the missing elements in HTML/SVG** if they're simple (a folder icon as inline SVG, a focus bracket as four CSS corner borders, a chat bubble as a rounded div), or
- **drop them** if the slide still carries its idea without them, or
- **retry later** with `fromPass: k+1` (the user can ask "retry pass 3 on slide 2").

Record it on the slide in `meta.json`: `"image": { "file": "images/02.png", "passes": 3, "completed": 2, "partial": true, "fallback": "focus bracket rebuilt in CSS" }`. If pass 1 fails, it's an ordinary image failure: make the slide type-led (exit 1).
