---
version: alpha
name: TillPayDay
description: A calm money tool. Numbers lead; everything else steps back.
colors:
  primary: "#0B5D4B"
  on-primary: "#FFFFFF"
  primary-soft: "#E3EFEA"
  on-primary-soft: "#0B5D4B"
  primary-muted-on-primary: "#CFE5DC"
  canvas: "#F2F4F1"
  surface: "#FFFFFF"
  ink: "#12211C"
  ink-muted: "#55635D"
  line: "#DDE3DE"
  warning: "#A3410A"
  expense-bar: "#E8A15C"
  expense-bar-edge: "#A3410A"
  dark-canvas: "#0E1513"
  dark-surface: "#16201D"
  dark-surface-raised: "#1E2B27"
  dark-ink: "#E6ECE8"
  dark-ink-muted: "#9AA8A1"
  dark-line: "#2A3833"
  dark-primary: "#6CCBAE"
  dark-on-primary: "#0E1513"
  dark-hero: "#0F5A49"
  dark-on-hero: "#F4F7F5"
  dark-warning: "#F0A06A"
typography:
  display:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 2.75rem
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  title:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 1.25rem
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body-md:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 1rem
    fontWeight: 450
    lineHeight: 1.5
  label:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 0.875rem
    fontWeight: 550
    lineHeight: 1.3
  amount:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "tnum"
rounded:
  card: 18px
  card-sm: 16px
  button: 12px
  chip: 10px
  input-bar: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  hero-card:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.card}"
    padding: 24px
  hero-card-dark:
    backgroundColor: "{colors.dark-hero}"
    textColor: "{colors.dark-on-hero}"
    rounded: "{rounded.card}"
  hero-card-meta:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-muted-on-primary}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card-sm}"
    padding: 16px
  card-muted-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
  card-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
  card-dark-muted:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink-muted}"
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
  page-dark:
    backgroundColor: "{colors.dark-canvas}"
    textColor: "{colors.dark-ink}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.button}"
    height: 44px
  button-primary-dark:
    backgroundColor: "{colors.dark-primary}"
    textColor: "{colors.dark-on-primary}"
    rounded: "{rounded.button}"
  chip-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
    rounded: "{rounded.chip}"
  warning-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
  warning-text-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-warning}"
  divider:
    backgroundColor: "{colors.line}"
  divider-dark:
    backgroundColor: "{colors.dark-line}"
  chart-expense:
    backgroundColor: "{colors.expense-bar}"
    textColor: "{colors.ink}"
  chart-expense-edge:
    backgroundColor: "{colors.expense-bar-edge}"
  raised-dark:
    backgroundColor: "{colors.dark-surface-raised}"
    textColor: "{colors.dark-primary}"
---

## Overview

Reading this as: a personal finance PWA (Monitor surface for Home and Dashboard, Operate surface for
Transactions, Configure surface for Settings) for one person or a couple who run it on their own server.
Visual language: calm tool, not advertising. Dials: ENERGY 1 / RHYTHM 2 / MOTION 1.

The figure is the protagonist. Each screen has one focal number (safe-to-spend on Home, net worth on
Dashboard); everything else is set smaller and quieter. No gamification, no mascots, no emoji as icons,
no decorative gradients, no background patterns.

Identity motif: the deep evergreen hero card. It appears once per screen, holds the most important
figure, and nothing else in the UI uses a filled accent surface of that size.

## Colors

- **Evergreen (#0B5D4B):** the single accent. Hero card, primary buttons, active tab, income sign.
  Chosen by the owner in the approved mockup; it reads as "money, steady" without the neon-fintech look.
- **Sage canvas (#F2F4F1)** and **white surface (#FFFFFF):** page and cards. Cards are separated from
  the canvas by tone and a 1px line (#DDE3DE), not by shadow.
- **Ink (#12211C)** primary text (15.1:1 on canvas). **Muted ink (#55635D)** for captions (5.7:1 on canvas,
  6.3:1 on white).
- **Rust (#A3410A):** warnings, near-limit budgets, losses (6.3:1 on white). Never the only signal:
  always paired with a sign (+/-), an icon, or words.
- **Amber (#E8A15C):** expense series in charts only. It has low contrast on white (2.2:1), so chart bars
  carry a 1px rust edge (#A3410A) to reach 3:1 non-text contrast, and every bar has a value label on
  hover or focus.
- Dark mode derives from the same hues: canvas #0E1513, surface #16201D, ink #E6ECE8 (15.4:1),
  muted #9AA8A1 (6.8:1 on surface), accent lifts to #6CCBAE (8.6:1 on surface), hero card #0F5A49 with
  #F4F7F5 text (7.6:1), warning lifts to #F0A06A (7.9:1).
- The user may swap the accent from a short list (evergreen, slate blue, plum, graphite). Each option
  is stored as a full light and dark pair that passes the same contrast checks.

## Typography

Plus Jakarta Sans (variable, self-hosted from the Fontsource package; no CDN). It was named in the owner's
mockup and its open apertures keep digits legible at small sizes. Tabular figures (`tnum`) on every amount
so columns of numbers align. Weights 450/550/650/700 give hierarchy without changing size.
The safe-to-spend figure is the only display-size text on Home.

## Layout

- Mobile first. Home is a single column at 390px: header row, hero card, two small cards side by side,
  recent transactions, then the input bar fixed above the bottom tab bar (both inside safe areas).
- Desktop (>= 1024px): 248px sidebar, fluid content up to 1280px, 24px gutters.
- Dashboard at 1360px: four-card row (hero card first), then chart (left, 2fr) and budgets (right, 1fr),
  then accounts and goals, then investments and recent transactions tables. Collapses to one column below 768px.
- Wide tables scroll inside their own container; the page never scrolls sideways.

## Elevation & Depth

Flat. Cards use a 1px line, no shadow. The only shadow is on the floating input bar and bottom sheets
(`0 8px 24px rgb(18 33 28 / 0.08)`) because they sit above scrolling content.

## Shapes

Cards 18px (small cards 16px), buttons 12px, chips 10px, input bar fully round. Documented rule, applied
everywhere: containers soft, controls slightly tighter, the input bar is the only pill.

## Components

- `hero-card`: evergreen surface, label, display amount, progress bar (track is a translucent white line,
  not a filled grey slab), two captions, divider, days-to-payday row.
- `button-primary`: evergreen fill, 44px min height, `scale(0.98)` on press.
- Chips (category, account): soft evergreen tint, 10px radius, 32px tall inside a 44px hit area.
- Amounts: sign is always printed (`+` income, `-` expense, none for transfers with an arrow icon).
- Icons: lucide-react, 1.75 stroke, 20px. The owner's brief names this family; we use only glyphs that
  describe the action (camera, send, arrows), never sparkles or robots.
- States: every data view ships an empty state (what to do next), a loading skeleton matching its shape,
  and an error state with a retry button.

## Logo

Five bars of equal height, the middle one highlighted: money split evenly per day, the bright bar is today.
`public/logo.svg` is the single source (64x64 canvas, bars 28 tall, 6 wide, 5 apart, 3px radius, dim bars at
40% opacity). Below 25 px the three-bar form in `public/logo-small.svg` is used instead, so the mark stays sharp
in a tab or a launcher.

- App icon: rounded square, corners at 22.5% of the side, accent fill, **main** five-bar mark at 72% of the
  side. The icon never uses the small form, whatever its own size: the 24 px rule is about how big the *mark*
  is drawn, not how big the tile is.
- Maskable PWA icon: accent fills the whole canvas, mark at 56% so a platform crop cannot clip it.
- One-colour: the mark in ink (#12211C) on light, in white on dark, no tile, `currentColor` driven.
- Lockup: icon, then the name from `APP_NAME` in Plus Jakarta Sans 800, tracking -0.02em, capitals about 45%
  of the icon height, gap 25% of the icon height.
- Size rule: the mark scales with the icon; the two bars that carry meaning (dim vs bright) must stay
  distinguishable. `npm run check:logo` measures that against every real background and fails below 3:1.
- Don't: change the bar count, proportions, radius or opacity; add shadow, gradient, outline or any effect;
  leave less than one bar of padding around the mark.

## Do's and Don'ts

- Do keep one focal figure per screen.
- Do print + or - on every signed amount; colour is secondary.
- Do respect `prefers-reduced-motion`: only 150ms colour/opacity transitions remain.
- Don't use gradients, glow, glass, emoji, mascots, streaks, badges or confetti.
- Don't use em dashes in UI copy.
- Don't put more than one filled accent surface on a screen.
