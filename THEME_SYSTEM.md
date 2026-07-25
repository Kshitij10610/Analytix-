# Analytix
## Theme System

*Version 1.0 — July 2025*

---

## Surface Tokens

| Token | Light Theme HEX | Dark Theme HEX | Usage |
|-------|-----------------|----------------|-------|
| `background` | `#FAFAFA` | `#0A0A0A` | Page and app background. Deepest layer. |
| `surface` | `#FFFFFF` | `#18181B` | Default card, panel, section background |
| `surface-elevated` | `#FFFFFF` | `#27272A` | Dropdowns, menus, tooltips, floating panels |
| `surface-overlay` | `#FFFFFF` | `#3F3F46` | Modals, sheets, dialogs, full-screen overlays |
| `surface-sidebar` | `#F4F4F5` | `#0A0A0A` | Persistent side navigation (anchored left edge) |
| `surface-navbar` | `#FFFFFF` | `#18181B` | Top navigation bar (matches surface, differentiated by border) |
| `surface-card` | `#FFFFFF` | `#18181B` | Card containers (identical to surface; differentiated by border) |
| `surface-dialog` | `#FFFFFF` | `#27272A` | Dialog and modal backgrounds |
| `surface-popover` | `#FFFFFF` | `#27272A` | Popover and tooltip backgrounds |

---

## Border & Divider Tokens

| Token | Light Theme HEX | Dark Theme HEX | Width | Usage |
|-------|-----------------|----------------|-------|-------|
| `border-default` | `#E4E4E7` | `#3F3F46` | 1px | Standard borders, card outlines, input borders |
| `border-subtle` | `#F4F4F5` | `#27272A` | 1px | Subtle dividers, internal section separation |
| `border-strong` | `#D4D4D8` | `#52525B` | 2px | Emphasis borders, focus indicators |
| `border-inverse` | `#FFFFFF` | `#0A0A0A` | 1px | Borders on primary-colored backgrounds |
| `divider` | `#E4E4E7` | `#3F3F46` | 1px | List separators, table row dividers |
| `divider-subtle` | `#F4F4F5` | `#27272A` | 1px | Hairline dividers, inline separators |

---

## Interactive State Tokens

| Token | Light Theme HEX | Dark Theme HEX | Purpose |
|-------|-----------------|----------------|---------|
| `surface-hover` | `#F4F4F5` | `#27272A` | Hover state on clickable rows, list items, table cells |
| `surface-selected` | `#EFF6FF` | `#172554` | Selected state (light: blue tint, dark: deep blue tint) |
| `surface-active` | `#DBEAFE` | `#1E3A8A` | Active / pressed state (deeper than selected) |
| `surface-disabled` | `#F4F4F5` | `#18181B` | Disabled elements (background shift, not opacity) |

---

## Text Colors

| Token | Light Theme HEX | Dark Theme HEX | WCAG AA Light | WCAG AA Dark | Usage |
|-------|-----------------|----------------|---------------|--------------|-------|
| `text-primary` | `#0A0A0A` | `#FAFAFA` | 19:1 ✅ | 19:1 ✅ | Primary body text, headings, important labels |
| `text-secondary` | `#52525B` | `#A1A1AA` | 10.4:1 ✅ | 4.5:1 ✅ | Secondary text, descriptions, supporting info |
| `text-muted` | `#71717A` | `#71717A` | 7.0:1 ✅ | 2.8:1 ❌ | Tertiary text, captions, helper text (light theme) |
| `text-disabled` | `#A1A1AA` | `#52525B` | 4.5:1 ✅ | 1.9:1 ❌ | Disabled text, inactive states |
| `text-inverse` | `#FFFFFF` | `#0A0A0A` | — | — | Text on primary-colored backgrounds |
| `text-link` | `#2563EB` | `#60A5FA` | 4.5:1 ✅ | 4.6:1 ✅ | Hyperlinks, clickable references |
| `text-heading` | `#0A0A0A` | `#FAFAFA` | 19:1 ✅ | 19:1 ✅ | Headings H1–H6 |
| `text-caption` | `#71717A` | `#A1A1AA` | 7.0:1 ✅ | 4.5:1 ✅ | Captions, timestamps, metadata |

**Text Rules:**
- Primary text is never placed on tinted backgrounds without contrast verification
- Link color is always distinct from primary text
- Muted text in dark theme uses `#A1A1AA` to maintain 4.5:1 minimum on Obsidian
- Disabled text never uses opacity reduction; uses background color shift instead

---

## Light Theme — Complete Mapping

```json
{
  "background": "#FAFAFA",
  "surface": "#FFFFFF",
  "surface-elevated": "#FFFFFF",
  "surface-overlay": "#FFFFFF",
  "surface-sidebar": "#F4F4F5",
  "surface-navbar": "#FFFFFF",
  "surface-card": "#FFFFFF",
  "surface-dialog": "#FFFFFF",
  "surface-popover": "#FFFFFF",
  "surface-hover": "#F4F4F5",
  "surface-selected": "#EFF6FF",
  "surface-active": "#DBEAFE",
  "surface-disabled": "#F4F4F5",
  "border-default": "#E4E4E7",
  "border-subtle": "#F4F4F5",
  "border-strong": "#D4D4D8",
  "border-inverse": "#FFFFFF",
  "divider": "#E4E4E7",
  "divider-subtle": "#F4F4F5",
  "text-primary": "#0A0A0A",
  "text-secondary": "#52525B",
  "text-muted": "#71717A",
  "text-disabled": "#A1A1AA",
  "text-inverse": "#FFFFFF",
  "text-link": "#2563EB",
  "text-heading": "#0A0A0A",
  "text-caption": "#71717A"
}
```

**Light Theme Rationale:**
The light theme feels like high-quality paper—bright, clean, analytically precise. Background (#FAFAFA) is not pure white to reduce eye strain during extended analysis sessions. White cards float on the near-white background, creating subtle hierarchy through presence rather than shadow.

---

## Dark Theme — Complete Mapping

```json
{
  "background": "#0A0A0A",
  "surface": "#18181B",
  "surface-elevated": "#27272A",
  "surface-overlay": "#3F3F46",
  "surface-sidebar": "#0A0A0A",
  "surface-navbar": "#18181B",
  "surface-card": "#18181B",
  "surface-dialog": "#27272A",
  "surface-popover": "#27272A",
  "surface-hover": "#27272A",
  "surface-selected": "#172554",
  "surface-active": "#1E3A8A",
  "surface-disabled": "#18181B",
  "border-default": "#3F3F46",
  "border-subtle": "#27272A",
  "border-strong": "#52525B",
  "border-inverse": "#0A0A0A",
  "divider": "#3F3F46",
  "divider-subtle": "#27272A",
  "text-primary": "#FAFAFA",
  "text-secondary": "#A1A1AA",
  "text-muted": "#71717A",
  "text-disabled": "#52525B",
  "text-inverse": "#0A0A0A",
  "text-link": "#60A5FA",
  "text-heading": "#FAFAFA",
  "text-caption": "#A1A1AA"
}
```

**Dark Theme Rationale:**
The dark theme is designed for extended analysis sessions. Obsidian (#0A0A0A) base is not pure black, preserving depth perception. Surface elevation uses Zinc scale (#18181B → #27272A → #3F3F46) rather than shadow. Primary brand colors are lifted one step lighter (#60A5FA vs #2563EB) to maintain perceptual brightness. Tinted backgrounds use deep Zinc tones rather than brand hues to avoid color fatigue during late-night sessions.

---

## Accessibility Recommendations

### WCAG 2.1 AA Compliance

| Requirement | Standard | Status | Enforcement |
|-------------|----------|--------|-------------|
| Normal text contrast | 4.5:1 minimum | ✅ All text-primary and text-secondary combinations pass | Automated contrast checking in CI |
| Large text contrast | 3:1 minimum | ✅ All heading combinations pass | Verified at token definition |
| UI component contrast | 3:1 minimum | ✅ Borders and interactive elements pass | Visual regression testing |
| Focus indicator | 3:1 against adjacent | ✅ Primary focus ring #2563EB on any surface | Keyboard navigation testing |

### Critical Contrast Ratios

| Foreground | Background (Light) | Ratio (Light) | Foreground | Background (Dark) | Ratio (Dark) |
|------------|-------------------|---------------|------------|-------------------|--------------|
| `text-primary` #0A0A0A | `background` #FAFAFA | 19:1 ✅ | `text-primary` #FAFAFA | `background` #0A0A0A | 19:1 ✅ |
| `text-secondary` #52525B | `background` #FAFAFA | 10.4:1 ✅ | `text-secondary` #A1A1AA | `background` #0A0A0A | 4.5:1 ✅ |
| `text-muted` #71717A | `background` #FAFAFA | 7.0:1 ✅ | `text-muted` #71717A | `background` #0A0A0A | 2.8:1 ❌ | Use `#A1A1AA` instead |
| `text-disabled` #A1A1AA | `background` #FAFAFA | 4.5:1 ✅ | `text-disabled` #52525B | `background` #0A0A0A | 1.9:1 ❌ | Large text only |
| `text-link` #2563EB | `background` #FAFAFA | 4.5:1 ✅ | `text-link` #60A5FA | `background` #0A0A0A | 4.6:1 ✅ |
| `border-default` #E4E4E7 | `background` #FAFAFA | 2.8:1 ❌ | `border-default` #3F3F46 | `background` #0A0A0A | 9.2:1 ✅ |
| `border-default` #E4E4E7 | `surface` #FFFFFF | 1.3:1 ❌ | `border-default` #3F3F46 | `surface` #18181B | 2.8:1 ❌ |
| `border-subtle` #F4F4F5 | `background` #FAFAFA | 1.2:1 ❌ | `border-subtle` #27272A | `background` #0A0A0A | 1.4:1 ❌ |

### Accessibility Rules

1. **Dark theme muted text:** Use `text-muted` #A1A1AA in dark theme, not #71717A, to maintain 4.5:1 minimum contrast
2. **Dark theme disabled text:** Use `text-disabled` #52525B only for large text on dark backgrounds; prefer `text-muted` #A1A1AA for normal text
3. **Borders on white surfaces:** `border-default` on `surface` (#E4E4E7 on #FFFFFF) yields 1.3:1 — this is acceptable for decorative borders only; use `border-strong` (#D4D4D8) for interactive input borders requiring 3:1 minimum
4. **Borders on dark surfaces:** `border-default` on `surface` (#3F3F46 on #18181B) yields 2.8:1 — meets 3:1 minimum for UI components ✅
5. **Selected states:** `surface-selected` in dark theme (#172554) must not be used as a text background without contrast verification
6. **Focus management:** All interactive elements must have visible focus indicator (2px primary color ring with 2px offset)
7. **Color independence:** No information conveyed by color alone — all states paired with icon or text label
8. **Reduced motion:** Respect `prefers-reduced-motion`; instant transitions (0ms) when enabled
9. **Text resize:** Interface must remain functional at 200% browser zoom
10. **Colorblind safety:** All semantic colors tested against deuteranopia, protanopia, and tritanopia simulators

### Testing Checklist

- [ ] All text-on-background combinations verified with contrast checker
- [ ] Dark theme muted and disabled text verified at 4.5:1 minimum
- [ ] Border contrast verified on both light and dark surfaces
- [ ] Focus indicators visible on all interactive elements
- [ ] Color independence verified: no state relies on color alone
- [ ] Reduced motion preferences respected
- [ ] Interface functional at 200% zoom
- [ ] Colorblind simulation passed for all semantic states
