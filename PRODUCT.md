# Product

## Register

product

## Users

General anime fans globally. They're browsing on their phone at night, looking for the latest episode of a currently-airing show, adding series to their bookmarks, and picking up where they left off via watch history. The primary device is mobile (bottom-nav layout, fullscreen player), but it works on desktop too. The job is "find → watch → repeat" with minimal friction.

## Product Purpose

Cerydra is an anime streaming app — no backend, no auth, just a proxy API layer over rodoknai.fun. Users search for anime, browse trending results, view episode lists, stream via a custom Vidstack player with MD3-style controls, and save their progress (bookmarks via localStorage, watch history via Turso edge DB). Success is one tap from the homepage to an episode playing. No login gates, no recommendation bloat, no ads.

## Brand Personality

Sleek, energetic, playful. Dark and immersive like the content it serves, but with a cyan accent (#3DD9E0) that keeps it from feeling gothic or heavy. Playful means timing (micro-animations, subtle transitions) and voice (English-language labels with personality), not decorative doodles. Energetic means the UI stays out of the way — fast, responsive, high-contrast.

## Anti-references

- Generic streaming clones (Netflix-style hero rails, carousel-over-carousel layouts, dense poster grids). Cerydra should not look like a template.
- Cluttered UIs. Low information density per screen: clean spacing, prominent thumbnails, minimal chrome.
- Side-stripe borders, gradient text, glassmorphism, hero-metric templates, numbered section markers on a non-sequential page — all absolute bans per the impeccable playbook.

## Design Principles

1. **Content first.** The anime poster and title own every card. UI chrome — nav bars, search fields, metadata — is subordinate to the visual. No competing decorations.
2. **One tap to watch.** The shallowest navigation tree possible: homepage → trending result → episode list → video player. No confirmation dialogs, no "are you sure?" between the user and the episode.
3. **Mobile native feel.** Bottom tab bar, fullscreen video, thumb-reachable controls, swipe-friendly scrolling, oversized tap targets. Desktop is a graceful expansion of the mobile canvas, not the other way around.
4. **Dark by immersion.** Dark mode is the only mode. The user's context is dim light, bed, or commute at night. Near-black background (#0B0E1A) with cool-tinted surfaces (#141A2E) and cyan energy (#3DD9E0) — not inverted-light or blue-light special.
5. **Playful restraint.** Let the anime's own energy carry the page. The UI contributes through timing (animation duration, easing, stagger), not through decorative flourishes, badges, or visual noise. Every extra pixel earns its place.

## Accessibility & Inclusion

WCAG 2.1 AA. Body text contrast >= 4.5:1 on all surfaces. Large text >= 3:1. Reduced motion support via `prefers-reduced-motion: reduce` (crossfade or instant transitions). Keyboard-navigable via native `<a>` and `<button>` elements — no custom interactive widgets without ARIA. Video player provides standard controls (play/pause, volume, fullscreen, seek).
