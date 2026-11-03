# Playing a game

The game page opens when you press **C’est parti** (see [Starting a game](new-game.md)). It works the same on a phone and on a tablet: on a phone everything is in one column, on a tablet the board is on the left and the scores on the right.

## What you see

- **The top bar** shows the game (for example _501 · Double out_) and the round (**Manche**). The arrow on the left leaves the game and goes back to the menu. **Annuler** undoes the last dart.
- **The player card** (red frame) belongs to the person who throws. It shows their name, their remaining score in large figures, the three darts of the current turn and the total of the turn.
- **The other players** are listed below, in the order they will throw after the current player, with their remaining score and the score of their last turn.
- **The board** fills the rest of the screen.

## Scoring a dart

Tap the zone of the board where the dart landed:

- the thin outer ring is the **double**, the thin inner ring is the **triple**;
- the two wide areas of a number are the **single**;
- the green ring in the middle is the **25**, the red centre is the **bull** (50, counts as a double).

The dart is saved on the server at once and the scores update. After three darts, the turn passes to the next player by itself.

- **Raté · 0**: the dart missed the board; it counts as a dart worth 0.
- **Joueur suivant**: ends the turn early, for example when a player has thrown only one or two darts. The darts not thrown count as 0.

## Finishing a game

Each game is played with a _double out_: you must reach exactly 0 with a double (or the bull).

- When your remaining score is 170 or less and a finish is possible with the darts you have left, a green **Finish** banner shows the darts to aim for, for example _T15 · D18_. The first target blinks on the board or on the keypad; the other targets have a white outline.
- **Bust**: if a dart takes you below 0, leaves you on 1, or reaches 0 without a double, the whole turn scores nothing. Your score goes back to what it was at the start of the turn, a red message tells you so, and the turn passes to the next player.
- When someone checks out, a **Game shot !** window shows the winner. Press **Rejouer** to start a new game with the same players and the same type of game (301 or 501). The order of play is drawn again at random.

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

No finish is suggested when your score is above 170, when it is a "bogey" number that cannot be checked out in three darts (such as 169 or 159), or when you do not have enough darts left in the turn. The banner then says so, or invites you to score.
