# Retention framework

> High-retention carousels follow a simple structure: a strong hook, clean and focused slides, and visual hierarchy that guides the reader. Retention isn't luck. It's layout.

This sits **above** the brand's design language. The brand decides how a slide *looks*. This decides how it is *structured*. Load it on every generation and revision. Every rule here is checked in the critique pass, and the measurable ones are enforced by `scripts/render.mjs`.

## 1. The hook (slide 1)
- **Retention starts with clarity.** If slide one is confusing, people leave. The cover plainly states what the reader will **gain**: a benefit or a promise, not a theme. "Your mornings are leaking focus" promises something; "Thoughts on mornings" doesn't.
- Headline: **≤ 8 words**, the largest type in the whole carousel, the single dominant element on the slide.
- One supporting line (the key line), **≤ 15 words**, that makes the promise concrete. Its key phrase may be emphasised.
- A **swipe cue** pulls the eye to the next slide: a line or arrow running off the right edge, a counter, a cropped element, "Swipe for…". Styled in the brand language. Tagged `data-cue="swipe"`.
- Slide 1 total: **≤ 35 words** including everything except meta (handle/counter).

## 2. One slide = one idea (slides 2–4)
- Each slide delivers **one** clear idea. If you need "and" to state it, split it or cut it.
- One main point, strong hierarchy, plenty of empty space.
- Scannable in about **2 seconds**.

## 3. Visual hierarchy: a fixed reading order
Every slide uses the same levels, in this order of visual weight:

| Level | `data-text` | What it is |
|---|---|---|
| 1. Headline | `headline` | The dominant element. Optionally **one** emphasised word via a style switch (italic, weight, accent colour) per the brand tokens. Exactly one per slide. |
| 2. Key line | `key` | One short sentence carrying the slide's point. Its key phrase may be emphasised (underline/bold). |
| 3. Support | `support` | Lighter weight, at most 2 short lines. |
| 4. Cues / list | `item` (+ `clarifier`) | ≤ 4 items of ~4 words, each with the same marker (arrow, number, check in the brand's style). Optional short clarifier under an item in a lighter style. |
| — Meta | `meta` | Handle, counter, kicker, teaser line. Small, quiet, consistent. |

Rules:
- At most **one emphasis per element**. If everything is emphasised, nothing is.
- High contrast for all text (≥ 4.5:1). Over images use a scrim, a solid panel, or reserved negative space.

## 4. What kills retention (hard fails)
- **Paragraph blocks:** too dense. Over-budget text fails the render report.
- **Too many elements:** visual overload. Max one image/visual and one cue set per slide.
- **Weak transitions:** no flow between slides.
- **No clear progression:** feels random. If a slide doesn't build on the last, people bail.

## 5. Progression and flow
- Before any HTML, write the **narrative spine**: one line per slide, hook promise → point → point → payoff → follow. Each line answers "why swipe next?"
- Use a transition device on slides 1–4: a numbered sequence (1/3, 2/3…), a running visual motif, a question answered on the next slide, or a teaser line at the bottom ("But silence alone isn't enough →").
- Keep the system identical across slides: same margins, same counter/handle position, same marker style. Vary composition (type-led vs inverse vs visual-led) only within that system.

## 6. Frameworks
Pick one in the strategy step and record it in `meta.json` as `framework`. If the user names one, use it; otherwise choose and say which.

| Framework | Slide pattern (5 slides) |
|---|---|
| Listicle | Hook (number + promise) → item 1 → item 2 → item 3 → follow |
| Mistakes to avoid | Hook (the cost of the mistake) → mistake 1 + fix → mistake 2 + fix → mistake 3 + fix → follow |
| Problem → solution | Hook (the pain) → why it happens → the fix → the result → follow |
| Myth vs. fact | Hook (the contrarian claim) → myth 1 busted → myth 2 busted → myth 3 busted → follow |
| Step-by-step | Hook (the outcome) → step 1 → step 2 → step 3 → follow |
| Before / after | Hook (the transformation) → before → what changed → after → follow |

Slide 5 is always the follow/CTA slide: logo, handle, the brand's closing CTA text. Calm and minimal.

## 7. Text budgets (enforced by the render script)

| Level | Budget |
|---|---|
| Headline | ≤ 8 words (hook); ≤ 10 words (other slides) |
| Key line | ≤ 15 words |
| Support | ≤ 25 words, ≤ 2 lines |
| List | ≤ 4 items, ≤ 5 words each (+ optional ≤ 5-word clarifier) |
| Total per slide | ≤ 50 words (≤ 35 on the hook), meta excluded |
| Emphasis | ≤ 1 span per element |

Budgets live in `tokens.json` under `retention` (defaults in `scripts/lib/workspace.mjs`). A brand may tighten them. If a user asks to loosen them, warn that it trades retention for density and confirm before changing.

**Check copy against these budgets in the slide plan, before writing HTML.** Cutting copy is cheaper than fixing layout.

## 8. Reference structure (from example posts that work)
A well-performing pattern to keep in mind, described structurally (no third-party images are bundled):
- A large serif headline with **one italic emphasis word**, set as the only big element.
- An **underlined key line** under it carrying the concrete promise.
- Lists with **arrow or check markers**, one short item per line, generous spacing.
- Backgrounds that add texture without competing: **grid paper**, or a **photo with clear negative space** where the text sits.
- A **vertical or horizontal swipe line** running off the edge as the cue.
