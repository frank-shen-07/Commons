---
name: Commons
description: A welcoming light-first library for open-source software.
colors:
  canvas: "#f7f8fa"
  surface: "#fff"
  ink: "#17191d"
  muted: "#637083"
  accent: "#246bfd"
  border: "#e8ebf0"
  selection: "#ebf2ff"
typography:
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  prose:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "12px"
    lineHeight: 1.9
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  control: "8px"
  search: "10px"
  card: "12px"
  panel: "14px"
spacing:
  icon-gap: "8px"
  row-gap: "12px"
  grid-gap: "16px"
  section: "34px"
  gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 17px"
  button-secondary:
    backgroundColor: "#eaf1ff"
    textColor: "#205eca"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 17px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#3c5c8a"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 17px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.search}"
    padding: "14px 17px"
  app-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  navigation-active:
    backgroundColor: "#e1ebff"
    textColor: "#1559d8"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  category-selected:
    backgroundColor: "#e7efff"
    textColor: "#1759d3"
    rounded: "7px"
    padding: "9px 12px"
---

# Design System: Commons

## Overview

**Creative North Star: "The Welcoming Software Library"**

Commons is a light-first software library: calm editorial hierarchy, compact utility controls, and approachable app imagery. The user-selected balance is 60% Mac App Store, 25% Raycast, and 15% Setapp; this is directional inspiration, not permission to copy their identities.

White surfaces sit on a cool gray canvas. Ink headings establish hierarchy; blue directs action and pale blue marks selection. Real app imagery carries personality while the surrounding interface stays restrained. The same primitives can support the teammate-owned developer portal without importing the marketplace’s page composition.

**Key Characteristics:**
- Light canvas and white surfaces
- Compact Inter typography with clear hierarchy
- Blue actions and pale blue selection
- Rounded panels, fine borders, restrained motion

## Colors

The palette is cool, bright, and neutral, with a focused blue accent. Frontmatter records the reusable primitives from `app/globals.css`; local image backdrops and collection tints remain component treatments.

### Primary

- **Action Blue** (`accent`): primary buttons, links, caret, and active control details.
- **Selection Wash** (`selection`): quiet action pills and selected view controls.

### Neutral

- **Cool Canvas** (`canvas`): the page background and compact search fill.
- **White Surface** (`surface`): cards, topbar, fields, and download panels.
- **Reading Ink** (`ink`): headings and primary content.
- **Slate Metadata** (`muted`): descriptions, compatibility, and secondary information.
- **Fine Divider** (`border`): panel edges and structural separators.

**The Action Blue Rule.** Use blue to signal action, focus, or selection; keep ordinary reading text in ink or muted neutrals.

## Typography

**Display and Body Font:** self-hosted Inter, with system sans-serif fallbacks. Available weights are regular (400), medium (500), semibold (600), and bold (700). No separate display or mono family is established.

The character is precise and approachable. Headings use tight tracking; metadata is compact and lower contrast. The frontmatter headline and title roles capture the marketplace page heading and section heading, respectively. The base body size is distinct from smaller card descriptions and longer detail prose; do not treat every text block as the base body role.

- **Headline:** page identification; inner-page headings also use a nearby larger size (32px).
- **Title:** section labels and detail section headings.
- **Body:** default document text.
- **Prose:** detail paragraphs, with an observed maximum width (72ch).
- **Label:** button text; metadata has context-specific smaller sizes (8–12px).

## Layout

Use a stable application shell and generous outer gutters with compact content inside. The desktop sidebar is fixed (208px); the sticky white topbar is (72px). Content is centered within an observed maximum width (1440px). Default gutters are recorded in frontmatter; page top padding is (34px).

Responsive behavior is defined in CSS, not by framework-default breakpoints:

| Query | Existing shell and density behavior |
| --- | --- |
| At least 1650px | Gutters grow to 44px; feature panels become taller. |
| At most 1200px | Sidebar becomes 184px; gutters 26px; standard app grids use two columns. |
| At most 900px | Sidebar becomes 168px; gutters 22px; compact app grids use two columns; detail content stacks. |
| At most 700px | Sidebar is hidden; gutters 20px; search occupies its own topbar row; fixed bottom navigation appears; standard and related app grids become one column. |

At mobile width the topbar is auto-height with an observed minimum (108px), even though the topbar custom property changes to (65px). Preserve room below content for fixed bottom navigation. Category filters scroll horizontally on mobile. Route composition and interaction mode belong in `.impeccable/surfaces/marketplace.md`, not in global tokens.

## Elevation & Depth

Depth comes primarily from tonal layering and fine borders. Ordinary cards and controls have no resting shadow. Featured app screenshot images use the existing media shadow (`0 9px 25px #0003`); this is not a general panel elevation token.

**The Quiet Surface Rule.** Separate ordinary surfaces with tone and fine borders. Reserve the existing shadow treatment for product imagery.

## Shapes

Use gently rounded rectangular controls and panels. Controls use the frontmatter control radius; ordinary cards use the card radius; featured panels use the panel radius. App icons are more rounded than containers (53px square with 17px corners in the standard card). Small View affordances are pills. Preserve clipping around real screenshots and avoid adding ornamental shapes around ordinary form controls.

## Components

### Buttons

Compact and direct. The shared `Button` supports default/primary, secondary, and ghost variants, plus `asChild` for links. All share a minimum height (43px), inline icon gap (8px), and the frontmatter padding and label typography. Primary hover deepens to `#1558df`; secondary hover uses `#dce9ff`. Ghost has no distinct background hover in the current source. Disabled native buttons reduce opacity (0.48) and use the disabled cursor.

### Inputs / Fields

The full-width search field is white, finely outlined, gently rounded, and at least (52px) tall. It uses an inline search icon and an explicitly named input. Its border shifts to `#8cb2ff` on focus within. The compact global search is (36px) tall with an (8px) radius and canvas fill; its focus-within border becomes `#a7c4ff`. This is an established search pattern, not a complete portal form specification. Native selects exist; validation and success patterns for publisher forms remain unestablished.

### Navigation

Sidebar links pair consistent rounded stroke icons with short labels. Primary links have a minimum height (43px), a quiet neutral default, a gray hover fill, and a pale blue active fill. Use `aria-current="page"` for the active route. Mobile uses a fixed bottom navigation and keeps global search visible. Search has a keyboard shortcut (Command/Control + K).

### Chips

Category filter buttons use a soft rectangular shape (7px corners), transparent default fill, and pale blue selected state. Selection must remain programmatically exposed by the consuming control. View pills inside cards are visual affordances within one linked card, not nested buttons.

### Cards / Containers

Standard app cards are white with a fine border and the frontmatter card radius. Hover changes border to `#b9cbe8` and fill to `#fcfdff`. Content padding is (18px 16px). Compact rows drop the outer box and retain a bottom divider. Preview cards add a real screenshot above app identity. Put category metadata below the app name and summary. Featured panels use the panel radius and image-led color treatments; their page arrangement is documented in the marketplace surface brief.

### Focus and Motion

Interactive links, buttons, selects, inputs, and summaries receive a visible focus outline (`3px solid #246bfd80`, offset `3px`). Search inputs use the surrounding field's focus-within border. Global color/background/border transitions last (180ms); transforms use the existing ease curve. Featured links lift (3px) and collection links lift (2px) on hover. Loading skeletons shimmer over (1.7s). Reduced-motion preference removes animation, transitions, and smooth scrolling.

## Do's and Don'ts

### Do:
- Do reuse the existing light palette and self-hosted Inter weights.
- Do preserve visible keyboard focus and reduced-motion behavior.
- Do let real application imagery carry visual variety.
- Do keep global design rules separate from route-specific composition in surface briefs.

### Don't:
- Don't add unsupported ratings, download counts, verification, or success claims.
- Don't replace the chosen light system with a dark-first interface.
- Don't turn compact metadata into competing headings.
- Don't invent portal form error or success styling and describe it as an existing component.
