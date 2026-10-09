---
version: beta
name: TillPayDay
description: Glazed earthenware for a money app. The pay period is a row of equal clay cups; the app shows how full today's is.
colors:
  primary: "#0B5D4B"
  on-primary: "#FFFFFF"
  primary-soft: "#E1EEE8"
  on-primary-soft: "#0A4F40"
  hero: "#0A4F40"
  hero-highlight: "#0D6450"
  on-hero: "#F6F3EA"
  on-hero-muted: "#BFD9CD"
  canvas: "#EDF0EA"
  surface: "#FFFFFF"
  surface-2: "#F4F6F1"
  ink: "#14211C"
  ink-muted: "#55635C"
  line: "#DAE0D8"
  line-strong: "#77827C"
  clay: "#B5532E"
  clay-ink: "#9A4322"
  clay-soft: "#F7E4DA"
  ochre: "#E3A33B"
  ochre-ink: "#85570B"
  ochre-soft: "#FBEFD8"
  warning: "#A3410A"
  expense-bar: "#E2A07C"
  expense-bar-edge: "#9A4322"
  dark-canvas: "#0C1311"
  dark-surface: "#141C19"
  dark-surface-2: "#19231F"
  dark-ink: "#E7ECE7"
  dark-ink-muted: "#9DABA3"
  dark-line: "#26332E"
  dark-primary: "#74CFB2"
  dark-on-primary: "#0C1311"
  dark-hero: "#0E4A3C"
  dark-hero-highlight: "#11594A"
  dark-on-hero: "#F3F0E6"
  dark-clay: "#E08A63"
  dark-clay-ink: "#EEA585"
  dark-ochre: "#F0B95A"
  dark-ochre-ink: "#F3C878"
  dark-warning: "#F0A06A"
typography:
  display:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 2.875rem
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "tnum"
  page-title:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  section-title:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 1.0625rem
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body-md:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 1rem
    fontWeight: 450
    lineHeight: 1.5
  label:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.3
  amount:
    fontFamily: Plus Jakarta Sans Variable
    fontSize: 1rem
    fontWeight: 650
    lineHeight: 1.3
    fontFeature: "tnum"
rounded:
  card: 22px
  card-sm: 16px
  button: 12px
  chip: 10px
  vessel: 30%
  input-bar: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  hero:
    backgroundColor: "{colors.hero}"
    textColor: "{colors.on-hero}"
    rounded: "{rounded.card}"
    padding: 20px
  hero-dark:
    backgroundColor: "{colors.dark-hero}"
    textColor: "{colors.dark-on-hero}"
    rounded: "{rounded.card}"
  hero-meta:
    backgroundColor: "{colors.hero}"
    textColor: "{colors.on-hero-muted}"
  rail:
    backgroundColor: "{colors.hero}"
    textColor: "{colors.on-hero}"
  rail-active:
    backgroundColor: "{colors.on-hero}"
    textColor: "{colors.hero}"
  record-button-rail:
    backgroundColor: "{colors.ochre}"
    textColor: "#2B1D05"
    rounded: "{rounded.button}"
  record-button-tab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: 9999px
    size: 56px
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
  status-ok:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
    rounded: 9999px
  status-near:
    backgroundColor: "{colors.ochre-soft}"
    textColor: "{colors.ochre-ink}"
    rounded: 9999px
  status-over:
    backgroundColor: "{colors.clay-soft}"
    textColor: "{colors.clay-ink}"
    rounded: 9999px
  warning-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
  divider:
    backgroundColor: "{colors.line}"
  chart-expense:
    backgroundColor: "{colors.expense-bar}"
    textColor: "{colors.ink}"
  chart-expense-edge:
    backgroundColor: "{colors.expense-bar-edge}"
---
## Overview

A personal finance PWA for one person or a couple, used on a phone several times a day and on a laptop for
admin. Mode: operate. The visual world is glazed earthenware, the celengan and the clay cup: the pay period is a
row of equal cups, one per day, and the app shows how full today's cup is. The world lends four things only:
palette, type, density and one signature move (the day-cup strip). Navigation, controls and layout stay the
standard ones people already know.

Each screen says what it is for in one line under its title and offers one primary action. Nothing is saved
without a confirmation, and the record flow says "not saved yet" until it is.

## Colors

- **Evergreen glaze (#0A4F40 hero, #0B5D4B accent):** the shell (desktop rail), the hero on Home, Budget and
  sign-in, primary buttons and the raised Record button on phones. The hero carries the one soft highlight of
  the glaze (a radial step to #0D6450 at the top left); it is the only gradient in the system.
- **Terracotta (#B5532E, text #9A4322):** money already spent: a day cup that went over its share, a budget
  over its limit, an overdue bill, the expense bars in charts (#E2A07C with a #9A4322 edge).
- **Ochre (#E3A33B, text #85570B):** today and "close": today's cup, a budget that is nearly used, an unpaid
  bill that is not yet late, the "not saved yet" label, and the Record button on the desktop rail.
- **Mineral ground (#EDF0EA), white surface, surface-2 (#F4F6F1):** page, cards, grouped rows and date headers.
  Cards are separated by a 1px line (#DAE0D8), not by shadow.
- **Ink (#14211C), muted (#55635C, 5.5:1 on the ground):** text. Secondary text on the hero is tinted from the
  glaze (#BFD9CD), never grey.
- **State is never colour alone.** Every status carries its word (Aman, Hampir habis, Lewat batas, Lunas,
  Lewat jatuh tempo); every signed amount prints + or −.
- Dark mode keeps the hues: canvas #0C1311, surface #141C19, accent #74CFB2, hero #0E4A3C, terracotta #E08A63,
  ochre #F0B95A. All text pairs pass 4.5:1 (checked with the contrast tool), graphics 3:1.
- Alternate accents (slate, plum, graphite) replace the glaze pair (hero and highlight) in light and dark.
- Selection, caret, `accent-color`, focus rings and scrollbars use the palette.

## Typography

Plus Jakarta Sans (variable, self-hosted). It was drawn for Jakarta's city identity, which is why it stays: the
app's home is Indonesian. Tabular figures on every amount. Ramp: display 2.875rem/750 (3.5rem on desktop) for
the one focal number, page titles 1.5rem/700, section titles 1.0625rem/700, body 1rem/450, labels 0.875rem/600.
All sizes are rem, so the per-device text size setting (93.75%, 100%, 112.5%, 125%) scales the whole interface.

## Layout

- Phones (390px first): content column with 16px gutters; a fixed bottom stack of the input bar and the tab bar
  (Home, Transactions, raised Record button, Accounts, More). More opens a sheet with every page grouped by
  job (Everyday, Money, Plans, Reports) plus Settings and Sign out.
- Desktop (>= 1024px): a 252px evergreen rail with the Record button on top and the same groups; the input bar
  sits above the content; content up to 1200px with 32px gutters.
- Home on desktop: hero and recent transactions in the main column, notes, first steps and the glance tiles
  in a 360px side column. On phones the order is hero, notes, first steps, glance, recent.
- Sign-in pages: the glaze panel (name, one-line promise, a still row of cups) beside the form on desktop,
  above it on phones.
- Wide tables scroll inside their own region; the page never scrolls sideways.

## Elevation & Depth

Flat by default. Shadows have offset and blur and mark only what floats: the hero (a soft glaze shadow), the
input bar, dialogs and sheets, the raised Record button and primary buttons (a short accent-tinted drop).
Backdrop blur is used only on the two bars that float over scrolling content (bottom tab bar, input bar).

## Shapes

Hero 22px, cards 16px, buttons 12px, chips 10px, status pills and the input bar fully round. Brand tiles and
account logos use a 30% corner, like a thrown vessel's soft square. Bottom sheets have a 24px top corner and a
grab handle.

## Components

- **Day-cup strip (signature):** one vessel per day of the period, drawn in SVG. Past days hold what was left
  of their share (an empty cup with a terracotta rim went over), today is ringed and filled in ochre, future
  days are dashed outlines filled with the even share of what is left. Tap or arrow keys pick a day; the line
  below reads that day's share and what is left or over. On Home and on Budget. The cups rise from their foot
  once when the page opens (720ms, ease-out, from 25% height); reduced motion shows them still.
- **"Why this number?":** a disclosure inside the hero that lays out income, carried over, goal savings, fixed
  bills, the spending pool, spent before today and the split over the days left.
- **First steps:** a numbered list on Home (account, salary, regular bills, goal) that ticks itself off and
  disappears once everything is done.
- **Account logos:** institution marks on a 30%-corner tile in the brand colour: Simple Icons glyphs where the
  brand has one, otherwise a short monogram; a type icon on accent-soft when the institution is unknown. Used
  in account lists, account details, debts, transaction rows and account choices on confirmation cards.
- **Status pill:** ok (accent-soft), near (ochre-soft), over (terracotta-soft), neutral; always with a word.
- **Bill rows:** a date tile (day over month) tinted by state, the name, a status pill, the amount, and the
  actions (Skip, Pay). Unpaid first, earliest due on top.
- **Page header:** optional back link, title, one-line purpose, actions.
- **Empty state:** says why it is empty and offers the action that fills it.
- **Money input:** the currency symbol inside the field; digits are grouped when it loses focus.
- **PIN pad:** six dots, a 3x4 keypad of 56px round keys, keyboard digits and backspace, a shake and a message
  on a wrong PIN.
- Icons: lucide-react at 1.75 stroke; only glyphs that name the action or the page.

## Logo

Five bars of equal height, the middle one highlighted: money split evenly per day, the bright bar is today.
`public/logo.svg` is the single source (64x64 canvas, bars 28 tall, 6 wide, 5 apart, 3px radius, dim bars at
40% opacity). Below 25 px the three-bar form in `public/logo-small.svg` is used instead, so the mark stays sharp
in a tab or a launcher.

- App icon: rounded square, corners at 22.5% of the side, accent fill, **main** five-bar mark at 72% of the
  side. On the glaze (rail, sign-in panel) the tile inverts: on-hero fill, hero mark.
- Maskable PWA icon: accent fills the whole canvas, mark at 56% so a platform crop cannot clip it.
- One-colour: the mark in ink on light, in white on dark, no tile, `currentColor` driven.
- Lockup: icon, then the name from `APP_NAME` in Plus Jakarta Sans 800, tracking -0.02em, capitals about 45%
  of the icon height, gap 25% of the icon height.
- `npm run check:logo` measures the dim and bright bars against every real background and fails below 3:1.
- Don't: change the bar count, proportions, radius or opacity; add shadow, gradient, outline or any effect.

## Do's and Don'ts

- Do keep one focal figure per screen and give every page a one-line purpose.
- Do say what happens next: "not saved yet" on unconfirmed cards, the period on Budget, the state on bills.
- Do print + or − on every signed amount and a word on every status; colour is secondary.
- Do respect `prefers-reduced-motion`: the cup rise and the PIN shake are the only authored motion.
- Don't add gradients beyond the glaze highlight, glow, decorative glass, emoji, mascots in the app, streaks
  or confetti.
- Don't put labels or kickers above headings, or a coloured stripe on the side of cards.
- Don't use em dashes in UI copy.
