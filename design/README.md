# Dart Counter — Design reference

These mockups are the **source of truth for look and behaviour** of v1.
They are reference material, not production code: re-implement them in the
project's own stack. Do not copy the mockup runtime.

## Files

| Screen | Phone (390×844, portrait) | Tablet (1194×834, landscape) |
|---|---|---|
| Game setup | `mobile-1-menu.html` | `tablette-1-menu.html` |
| Random order draw (overlay) | `png/mobile-1-menu--tirage.png` | `png/tablette-1-menu--tirage.png` |
| New player + photo | `mobile-2-nouveau-joueur.html` | `tablette-2-nouveau-joueur.html` |
| Game in progress — dartboard input | `mobile-3-partie.html` | `tablette-3-partie.html` |
| Game in progress — keypad input | `png/mobile-3-partie--pave.png` | `png/tablette-3-partie--pave.png` |

Each `.html` file opens directly in a browser and is clickable: the board,
keypad, undo, bust, double-out, checkout hints and the random draw all work.
`png/` holds a static capture of every screen and state (2× pixel density).

The UI copy is in **French** and must stay in French in the app.

## Design tokens

Colours come from a Winmau dartboard.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0E0E0E` | App background |
| `surface` | `#161616` / `#181818` | Cards, list rows |
| `surface-raised` | `#1B1B1B` / `#1F1F1F` | Secondary buttons, selected rows |
| `border` | `#262626` / `#333333` | Hairlines |
| `board-black` | `#151515` | Dartboard black segments |
| `cream` | `#EFDCB0` | Dartboard light segments, primary accent text, "Joueur suivant" button |
| `red` | `#D9261C` | Primary CTA, active player frame, double ring, bull |
| `green` | `#0B8A3C` | Save button, finish banner, triple ring, outer bull |
| `text` | `#F4F1EA` | Body text |
| `text-muted` | `#9A9A9A` | Labels, secondary text |
| `finish-bg` | `#10301C`, text `#7FE0A3` | Checkout banner |
| `bust-bg` | `#3A0F0C`, text `#FFD9D6` | Bust message |

Typography (Google Fonts): **Barlow Condensed** 600/700/800 for numbers,
titles and buttons (uppercase, letter-spacing 0.04–0.12em); **Barlow**
400–700 for body text. Scores use tabular figures.

Shapes: radius 14–16px on phone and 16–24px on tablet. Touch targets are at
least 44px (phone) or 48px (tablet). Icons are simple stroke SVGs. No emoji.

## Screen behaviour

### 1. Game setup
- Choose **301** or **501**. Both are *double out*: you must finish on a double or the bull.
- Tick the players for this game from the list of saved players. "Créer un joueur" opens screen 2.
- "Tirer au sort" shuffles the selected players and shows the **order overlay**: rank, avatar, name and a "Commence" badge on the first player. The overlay offers "Relancer" (reshuffle), "C'est parti" (start the game) and "Modifier la sélection" (close the overlay).
- The play order is always random. Nobody picks it by hand.

### 2. New player
- Round camera viewfinder (front camera by default) with three controls: import from the gallery, shutter (take or retake the photo), switch camera.
- Fields: **Nom** (required) and **Surnom** (optional).
- The photo becomes the player's avatar. Without a photo, show the initial inside a coloured ring.

### 3. Game in progress
- Header: mode, current round (manche), back to setup and **Annuler** (undo the last dart, any number of times, including across turns).
- Active player card: avatar, name, big remaining score, the three dart slots of the current visit and the visit total.
- Other players appear in **play order after the current player**, with their remaining score and last visit.
- **Input switch "Cible / Pavé numérique"**:
  - *Cible*: SVG dartboard. Every segment can be tapped: inner single, triple, outer single and double for each number, plus the outer bull (25) and the bull (50).
  - *Pavé*: Simple / Double / Triple toggles, keys 1–20, then 25 and Bull. Keys tint red for Double and green for Triple and show their labels ("D16", "T20"). The modifier goes back to Simple after each dart. Triple 25 is disabled. Double 25 = Bull.
- "Raté · 0" records a miss. "Joueur suivant" ends the visit early.
- **Checkout hint**: when remaining ≤ 170 and a finish exists with the darts left, a "Finish" banner shows the combination (for example T15 · D18). The **first target blinks** on the board, or on the keypad key and its modifier. The other targets are outlined.
- **Bust** (remaining below 0, exactly 1, or 0 without a double): the visit scores nothing, the score goes back to its value at the start of the visit, a red message shows and play passes to the next player.
- **Win**: a "Game shot !" overlay with the winner and a "Rejouer" button.
