# Playing a game

The game page opens when you press **C’est parti** (see [Starting a game](new-game.md)). It works the same on a phone and on a tablet: on a phone everything is in one column, on a tablet the board is on the left and the scores on the right.

## What you see

- **The top bar** shows the game (for example _X01 · 701 · Double out_: the type of game, the starting score and the finish chosen for the game; when the game is simple out but some players have **Double out forcé**, their names are listed) and the round (**Manche**). The arrow on the left leaves the game and goes back to the menu. **Annuler** undoes the last dart.
- **The player card** (red frame) belongs to the person who throws. It shows their name, their remaining score in large figures, the three darts of the current turn and the total of the turn.
- **The other players** are listed below, in the order they will throw after the current player, with their remaining score and the score of their last turn.
- **The board** fills the rest of the screen. The numbers 1 to 20 around it are shown in a light, bright, non-bold type so they stay easy to read on a phone; they are only labels, tapping a number itself does nothing special.

## Scoring a dart

Tap the zone of the board where the dart landed:

- the thin outer ring is the **double**, the thin inner ring is the **triple**;
- the two wide areas of a number are the **single**;
- the green ring in the middle is the **25**, the red centre is the **bull** (50, counts as a double).

The dart is saved on the server at once and the scores update. After three darts, the turn passes to the next player by itself.

- **Raté · 0**: the dart missed the board; it counts as a dart worth 0.
- **Joueur suivant**: ends the turn early, for example when a player has thrown only one or two darts. The darts not thrown count as 0.

## Finishing a game

Each player is judged by their own finishing rule, set on their profile (see [Managing players](players.md)):

- **Simple out** (the default): you win with any dart, single, double, triple or bull, that brings your score exactly to 0. Leaving 1 is not a problem.
- **Double out**: you only win with a double or the bull that brings your score exactly to 0. It is chosen for the whole game when you start it (see [Starting a game](new-game.md)), or forced for one player with **Double out forcé** on their profile.

The top bar shows the rule of the player whose turn it is (_Simple out_ or _Double out_).

- When a finish is possible with the darts you have left (a score of 180 or less in simple out, 170 or less in double out), a green **Finish** banner shows the darts to aim for, for example _T15 · D18_. It matches the rule of the player whose turn it is: in simple out the last target can be a single or a triple. The first target blinks on the board or on the keypad; the other targets have a white outline.
- **Bust**: if a dart takes you below 0 the whole turn scores nothing. For a player with **Double out forcé**, leaving 1, or reaching 0 without a double, is a bust too. After a bust, your score goes back to what it was at the start of the turn, a red message tells you so, and the turn passes to the next player.
- When someone checks out, a **Game shot !** window shows the winner. Press **Rejouer** to start a new game with the same players and the same type of game, starting score and finish. The order of play is drawn again at random.

## Bataille

In a Bataille game (see [Starting a game](new-game.md#bataille-by-teams)) the top bar shows _Bataille · 500 PV_ (or 1000, 2000) and the screen has a different layout:

- **The two team cards** at the top show, for **Équipe 1** and **Équipe 2**, the hit points left (large figures and a bar) and the names of the players. The card of the team that is throwing has a red frame. Both teams see these figures at all times.
- **The player card** shows who throws, the darts of the turn and the total of the turn. The large figure on the right is the hit points of the team being attacked.
- There is no list of next players, and no checkout hint.

Teams alternate: one player of a team throws their three darts, then a player of the other team, and so on. When a team has several players, they follow each other in turn each time it is the team's turn.

Darts are entered as in any game (board or keypad, **Raté · 0**, **Joueur suivant**, **Annuler**). The total of a turn is **taken off the hit points of the opposing team** as the darts are entered; a team never attacks itself. There is no bust.

As soon as a team has no hit points left, it has lost: the turn stops at that dart, and the window **Équipe N gagne** names the winning team and its players. **Rejouer** starts a new game with the same teams and a new order inside each team. **Annuler** reopens a finished game by undoing the last dart.

A Bataille game can be resumed or abandoned like any other (see [Resuming or abandoning a game](resume-game.md)). Bataille games are not part of the X01 statistics and history.

## Correcting a mistake

Press **Annuler** to remove the last dart. You can press it as many times as you like, even to go back to a previous player's turn, to cancel a bust, or to reopen a game that was just won. Nothing is left over: the scores and the saved darts go back to how they were.

If you reload the page or come back to the game later, it is shown exactly where it stopped.

## Entering darts with the keypad

Above the board, a switch lets you choose between **Cible** (the board) and **Pavé numérique** (the keypad). You can change at any time during a game: a dart scores exactly the same in both modes.

On the keypad:

1. Choose **Simple**, **Double** or **Triple** (Simple is selected by default). The number keys show what they will score, for example _D16_ or _T20_, and take a red tint for Double and a green tint for Triple.
2. Press the number (1 to 20), or **25**, or **Bull · 50**.

After each dart the choice goes back to Simple. Press Double or Triple a second time to cancel it. There is no triple 25 (the key is greyed out); **D25 = Bull** with Double selected is the same as **Bull · 50**.

When a finish is suggested, the first target blinks on the keypad: the number key, and the Double or Triple button if one is needed (the **25** or **Bull · 50** key for the centre).

## When no finish is shown

No finish is suggested when your score is above 170 (180 in simple out), when it is a "bogey" number that cannot be checked out in three darts (such as 169 or 159 in double out, 163 or 166 in simple out), or when you do not have enough darts left in the turn. The banner then says so, or invites you to score.
