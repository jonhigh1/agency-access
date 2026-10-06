# Frame packet: 01-chase

## Project inputs

- Project: /Users/jon.high/agency-access/videos/authhub-launch
- Design tokens: /Users/jon.high/agency-access/videos/authhub-launch/frame.md
- RULES_DIR: /Users/jon.high/.agents/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 1 — The chase

- scene: Chase words roll in one slot, then ONE LINK shoves them off
- duration: 5.5s
- poster: 4.6s
- transition_in: cut
- status: outline
- type: hook
- persuasion: Open on the viewer's mess, not the product
- beat: tension
- blueprint: ticker-takeover (Adapt)
- focal: kinetic-type-swap
- asset_candidates: []
- roles: none — type is the subject
- sfx: tick, impact
- src: compositions/frames/01-chase.html
- handoff_out: element "ONE LINK"; x 960; y 470; scale 1; opacity 1; motion settled, still, centered

Adapt: keep the signature crash. The cycling slot is the chase. The hero that shoves it is the phrase ONE LINK, not a logo. Install and restyle `kinetic-type-swap` for the slot. The crash itself is the blueprint's off-screen shove, not a second component.

Scene 1 (0.0–1.1s): ink field. Mono kicker STILL CHASING sits upper third. Nothing else. Centered, sparse, two layers (field + kicker).
Scene 2 (1.1–3.2s): the fixed line "Send the" holds center-left. One masked slot rolls PASSWORD, then INVITE, then SCREENSHOT. Each swap is a vertical roll. The slot is the joke. Asymmetric, type occupies ~60% of the width. `kinetic-type-swap`.
Scene 3 (3.2–4.4s): ONE LINK enters from the right at speed and shoves the whole line off the left. The phrase lands heavy, coral (`yellow`) on ink, display-hero, dead center. The struck line is displaced. It does not fade.
Scene 4 (4.4–5.5s): ONE LINK holds still at center. Subtle jitter only. This pose is the handoff.

## Selected blueprint: ticker-takeover

# ticker-takeover — Ticker Displace / Takeover

**intent**: A context phrase types in, an accent word cycles through options like a slot-machine to suggest "this could be many things," then a hero CRASHES in from off-screen and physically shoves the text aside — "actually, this is what it is." A collision, not a fade.

**roles served**

- Hook (from `takeover-ticker-displace`): when a static lead-in phrase + a cycling accent word should be **physically replaced** (not cross-dissolved) by a hero arriving with momentum, and the final frame is the hero alone. Reach for it when the takeover should read as an impact.
- Brand_Outro: the same collision used as a sign-off — options cycle, the brand mark crashes in and owns the frame.

**duration**: 5–7s

**shot structure** (a `[bg]` canvas; one text group on the left/center that gets ejected by an incoming hero)

- **Scene 1 (0.0–~1.4s) — context build.** A typewriter lays down a `[lead-in phrase]` character-by-character (smooth, no typos — selling confidence, not human chaos). Camera static.
- **Scene 2 (~1.4–3.0s) — the cycling beat.** An `[accent word]` slot inside the line ticks through 2–3 `[options]` on a vertical spring-roll (each click a new word), suggesting breadth — "many things this could be." (More than ~3 reads as filler.)
- **Scene 3 (~3.0–4.2s) — the collision (signature move).** A `[hero]` crashes in from off-screen with momentum and physically SHOVES the whole text group aside — the text reacts to the impact (gets displaced), it does not fade. The hero lands **heavy** — a longer settle, not a zip — so it reads as mass, not speed.
- **Scene 4 (~4.2–end) — the hero alone.** The hero settles dead-center and reads still. Holds.

**motion vocabulary**: smooth character typewriter; vertical spring-ticker word roll (2–3 steps); off-screen hero crash-in with momentum; reactive displacement of the struck text group; heavy long-tail landing (not bouncy); dual-axis subtle jitter on the resting hero.

**rule mapping**

- smooth single-phrase typewriter lead-in → `discrete-text-sequence` (smooth-slice / continuous `floor(progress)` form — no typo machinery)
- accent word slot-machine cycling through options → `vertical-spring-ticker` (`STEPS` = number of options the hero will replace; the rule's footer-reveal is unused — Scene 3 takes its place)
- hero shoves the text group aside on impact → `reactive-displacement` (the text is the displaced mass; express the hero's "heavy land" as a longer `power2` settle, not the rule's default `back.out`)
- hero's fast off-screen crash-in → `motion-blur-streak` (directional velocity blur resolving sharp as it lands)
- resting-hero aliveness → `sine-wave-loop` (low-amplitude dual-frequency register — scale + rotation jitter composing onto the hero's final landed scale; never a yoyo around 1)

**camera modifier**: camera-static — the displacement happens in element space (the hero moves the text), so there is no real camera move; the impact is the only motion.
