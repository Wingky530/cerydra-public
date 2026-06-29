---
name: Cerydra
description: Responsive anime streaming app
colors:
  primary: "#36BAE8"
  primary-light: "#5FE0ED"
  primary-deep: "#1B4F91"
  secondary: "#A3A3A3"
  neutral-bg: "#1E1E1E"
  neutral-surface: "#212121"
  neutral-text: "#E5E5E5"
  neutral-muted: "#A3A3A3"
  neutral-divider: "#404040"
  error: "#ef4444"
  error-light: "#f87171"
typography:
  title:
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif'
    fontWeight: 700
  body:
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif'
    fontWeight: 400
  caption:
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif'
    fontWeight: 400
rounded:
  sm: "8px"
  md: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  card-default:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  card-hover:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  input-small:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  bottom-nav:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-muted}"
    rounded: "0"
  skeleton:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.sm}"
---

# Design System: Cerydra

## 1. Overview

**Creative North Star: "The Dark Console"**

Cerydra's visual system treats the screen like a handheld game console interface: a deep, immersive dark field (background) with precise, glowing accent elements (cyan) that guide attention without competing with the content. The anime poster art owns every card — the UI is a minimal chrome frame around the show.

The system is flat at rest and lifts on interaction. Cards sit on a subtly lighter surface than the background, creating a quiet depth hierarchy without shadows. On hover they lift (scale + border glow) — a tactile response that signals interactivity without visual noise.

**Key Characteristics:**
- Dark-immersive by default: near-black background (#1E1E1E), cool-tinted surfaces (#212121)
- Single cyan accent: one voice (#36BAE8), used sparingly on interactive elements and hover states
- Content-forward: anime poster art is the hero on every card, UI chrome is subordinate
- Flat at rest, tactile on interaction: hover states use scale(1.03) + border accent + shadow lift
- Clean serifless typography: Inter throughout, single-weight hierarchy (400/500/600/700)

This system explicitly rejects: generic streaming clones (Netflix-style hero rails, carousel grids), cluttered layouts with high information density, glassmorphism, gradient text, side-stripe colored borders, and any decorative element that competes with poster art.

## 2. Colors

A restrained dark palette with one energetic accent. The background is near-black navy (#1E1E1E), surfaces step up to a cool dark slate (#212121). Cyan Pulse (#36BAE8) provides the only saturated energy — it's the accent for interactive elements, hover borders, and attention cues.

### Primary
- **Cyan Pulse** (#36BAE8 / oklch(80% 0.1 190)): The single energy source. Used for interactive element borders on hover, attention cues, and the primary color role in MUI. Appears on ≤5% of any given screen. Its rarity makes it meaningful.

### Secondary
- **Lavender Haze** (#A3A3A3 / oklch(76% 0.1 320)): A warm purple accent, used sparingly for secondary interactive elements and alternate states. Secondary to the cyan in both frequency and visual weight.

### Neutral
- **Deep Navy** (#1E1E1E / oklch(12% 0.02 260)): The canvas. All content sits on this near-black background.
- **Storm Gray** (#212121 / oklch(18% 0.025 260)): The surface layer. Cards, nav bar, inputs, and paper elements use this value to create depth without shadows.
- **Frost White** (#E5E5E5 / oklch(92% 0.01 240)): Primary text. High contrast against both Deep Navy and Storm Gray (≥12:1).
- **Arctic Fog** (#A3A3A3 / oklch(74% 0.03 240)): Secondary text. Captions, episode counts, muted labels.
- **Harbor Line** (#404040 / oklch(30% 0.04 260)): Dividers and borders. Low luminance but visible against both surface layers.
- **Red Alert** (#ef4444 / oklch(58% 0.2 30)): Error states and destructive actions.
- **Ember Light** (#f87171 / oklch(68% 0.18 30)): Error message text, softer than Red Alert.

### The Single Voice Rule
The cyan accent (#36BAE8) appears on ≤5% of any given screen. Its rarity is the point. If a screen has two competing cyan elements, one is wrong. The accent signals "this is interactive" — hover borders, active states, focused inputs. Never decorative.

## 3. Typography

**Body Font:** Inter (with Roboto and Helvetica as fallbacks)

**Character:** Clean, technical, and unobtrusive. Inter's generous x-height and open counters keep body text readable at small sizes on mobile screens. The weight range (400–700) covers the hierarchy without needing display faces — the content provides the visual variety, not the type.

### Hierarchy
- **Title** (700, 1.25rem / 20px, 1.6): Section headers like "Trending", episode list headings. Bold but same size as large body.
- **Body** (400, 0.875rem / 14px, 1.43): Anime card titles, general UI text. 2-line clamped on cards with overflow ellipsis.
- **Caption** (400, 0.75rem / 12px, 1.66): Episode counts, metadata, timestamps. In Arctic Fog (secondary text color).

### The One-Size Rule
There is no display headline. The largest text is title weight at 1.25rem. On mobile-sized screens, hierarchy comes from weight and spacing, not size. The anime poster is the hero, not the headline.

### Loading Treatment
Skeletons use the surface color (Storm Gray) as a pulsing placeholder. Rectangular skeletons match the card's rounded corners (8px). Text skeletons are narrower than full width (80% and 40%).

## 4. Elevation

The system is flat by default. Depth is conveyed through tonal layering: surfaces sit on Deep Navy (#1E1E1E), paper elements lift to Storm Gray (#212121), and cards are Storm Gray surfaces with transparent borders.

### Hover Lift
Cards on hover gain a scaled transform (scale(1.03)), a Cyan Pulse border (1px), and an elevated MUI shadow (boxShadow 4). This is the only shadow in the system — it exists purely as a response to interaction.

### No Resting Shadows
Surfaces do not cast shadows at rest. Dividers are thin (1px, Harbor Line #404040) and used only in the bottom nav bar. The background-to-surface contrast (12% → 18% lightness) provides enough separation without shadows.

## 5. Components

### Buttons
Cerydra has no custom buttons. The MUI defaults inherit: dark surface background for contained buttons, Cyan Pulse text for text buttons, and 12px border-radius everywhere.

### Cards / Containers
- **Corner Style:** Gently rounded (12px default via MUI shape), with a slightly tighter 8px option for skeletons and sub-containers.
- **Background:** Storm Gray (#212121), stepped up from the Deep Navy canvas.
- **Shadow Strategy:** None at rest. On hover: scale(1.03) + border-color transition to Cyan Pulse + boxShadow 4.
- **Border:** 1px transparent at rest (preserves layout during border-color transition on hover).
- **Internal Padding:** 12px (spacing.sm) inside CardContent.
- **Poster Aspect Ratio:** Fixed 2:3 for anime cover art. Covers the full card width, clipped via object-fit: cover.
- **Title:** 2-line clamp with ellipsis overflow. body2 size (0.875rem), default weight (400).
- **Metadata:** caption size (0.75rem), Arctic Fog color.

### Inputs / Fields
- **Style:** Standard MUI TextField with the dark palette. No custom border treatment.
- **Size:** `small` variant used across all pages (search, text entry).
- **Focus:** Inherits MUI's cyan focus ring (primary color).

### Bottom Navigation
- **Position:** Fixed to bottom of viewport, full width.
- **Style:** Storm Gray background, Harbor Line top border (1px). Four tabs with inline SVG icons.
- **Typography:** MUI BottomNavigationAction's default label size.
- **Z-Index:** 1200 — above all content but below modals/overlays.
- **Spacing:** Content area has 56px bottom padding to avoid overlap with the fixed nav.

### Video Player (Md3VideoPlayer)
- **Aspect Ratio:** 16:9, full width, absolute positioned inside container.
- **Runtime:** Vidstack MediaPlayer headless hooks (`useMediaStore`, `useMediaRemote`, `useMediaPlayer`) with fully custom UI built in Tailwind.
- **Controls:** No DefaultVideoLayout — custom MD3-style overlay:
  - Auto-hide on idle (3s timeout), show on mouse move / tap.
  - Center play button (large cyan circle with play icon, shown when paused).
  - Loading spinner (cyan ring) shown during `waiting` state.
  - **Seekbar:** SVG-based — straight cyan line for played portion, white semi-transparent sine-wave (snake) path for unplayed portion, glowing cyan playhead dot at boundary.
  - Play/pause button, volume control (slider on hover), time display (`currentTime / duration`), fullscreen toggle.
- **Fullscreen:** Uses Vidstack `remote.enterFullscreen()` / `remote.exitFullscreen()` — not native DOM API.
- **Controls Gradient:** Bottom gradient overlay (black/90 → transparent) behind controls group for readability on bright video.
- **Poster:** Optional, passed from episode data.

### Skeletons
- **Shape:** Rectangular with 8px border-radius for images, text-shaped for lines.
- **Color:** Storm Gray (#212121) — matches the surface layer. Uses MUI Skeleton's pulse animation.
- **Grid:** 8 skeleton items in a 2-column mobile grid matching the live content layout.

### Error Boundary
- **Background:** Deep Navy matching the app canvas.
- **Text:** Monospace stack. Error heading in Red Alert (#ef4444), message in Ember Light (#f87171), stack trace in Arctic Fog (#A3A3A3) at 12px.
- **Layout:** Padded 24px, full viewport height. Functional, not polished — errors should not happen.

## 6. Do's and Don'ts

### Do:
- **Do** let the anime poster art own the card. Title and metadata are subordinate.
- **Do** use Cyan Pulse (#36BAE8) sparingly — it signals interactivity. One element per screen gets the accent.
- **Do** keep surfaces flat at rest. Depth comes from tonal contrast, not shadows.
- **Do** use Inter for all text. No display fonts, no decorative type.
- **Do** obey the 2:3 poster aspect ratio on all anime card images.
- **Do** clamp card titles to 2 lines. Overflow gets ellipsis.
- **Do** use 12px border-radius as the default shape token throughout.
- **Do** keep content density low — clean spacing, prominent visuals, minimal chrome.

### Don't:
- **Don't** create generic streaming clone layouts (hero rails, carousel-over-carousel, dense poster grids). Cerydra is not a Netflix template.
- **Don't** clutter screens. One primary action per page, generous spacing, limited information density.
- **Don't** use glassmorphism, gradient text, side-stripe colored borders, or hero-metric templates.
- **Don't** use the cyan accent as decoration. If it's not interactive, it doesn't get the accent.
- **Don't** add shadows to resting elements. Lifted = interactive.
- **Don't** add decorative illustrations, badges, or visual noise to cards. The poster is enough.
- **Don't** use display-sized headlines. Largest text is 1.25rem / 20px.
- **Don't** introduce a second font family. Inter covers the full hierarchy.
- **Don't** break the dark-only mode. There is no light mode.
