# Critique rubric

Run after every render: view `contact-sheet.png` first, then each `png/0N.png`, then read `render-report.json`. **Retention checks come first**, because they decide whether anyone swipes at all.

Skip this pass only if the user asked for "quick mode". Even then, fix every error in the render report.

## Retention (check first)
1. **Hook clarity.** At contact-sheet size, in 2 seconds: can you tell what the reader will gain? If not, rewrite the hook before anything else.
2. **One idea per slide.** State each slide's idea in one sentence. If you need "and", split or cut.
3. **Reading order.** Headline → key line → support → cues on every slide. Nothing competes with the headline.
4. **Progression.** Read slides 1→5 in order. Does each build on the last? Does each give a reason to swipe (transition device)? Is the swipe cue on slide 1 visible?
5. **Retention killers.** No paragraph blocks, no visual overload (≤ 1 visual), no random order.

## Visual quality
6. **White space.** Generous breathing room on every slide, at least a third empty, not just "inside the margins".
7. **Thumbnail test.** Is the hook readable and compelling at contact-sheet size?
8. **Hierarchy.** One dominant element per slide.
9. **Brand fit.** Only token colours and brand fonts. Matches `design-language.md`'s specifics (margins, case, emphasis treatment, accent use). Logo used correctly on slide 5.
10. **System consistency.** Margins, counter and handle at identical positions across slides. Type scale consistent.
11. **Rhythm.** The slides don't all share one composition.
12. **Typesetting.** No descender/ascender collisions in tight headlines, no orphans (a single word alone on the last line of the headline or key line), no awkward breaks (a line ending on "a", "the", "of").
13. **Image–text conflicts** (if images): no subject behind text; contrast holds.

## Copy
14. Concise, in the brand voice (`brand.md`), no filler, no words from the "avoid" list, no repetition between slides.

## Render report
15. **Zero errors.** Overflow, safe-area, budget, emphasis, contrast, font and markup errors are all must-fix. Warnings: fix unless deliberate, and say why if you keep one.

## Fix loop
- For each failure, edit that slide's HTML (or copy in the plan), then re-render **only the affected slides** with `--slide NN`, which also rebuilds the contact sheet.
- **Max 2 rounds.** After round 2, stop and tell the user plainly what's still imperfect and what you'd try next. Don't loop.
- Record in `meta.json` → `critique`: rounds run, what was fixed, anything left.
