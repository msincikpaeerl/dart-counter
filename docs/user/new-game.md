# Starting a game

The home page of Dart Counter is the game setup screen. You choose the type of game and who plays, then the app draws the order of play at random.

## Choose the game

1. Under **Type de partie**, choose the kind of game: **X01** (selected at first) or **Tour du monde**. The options below always belong to the type chosen.
2. Under **Options**, set the options of the type:
   - **Tour du monde** has one option, **Niveau**: **Débutant** (selected at first) or **Professionnel**. See [Playing a game](playing.md#around-the-world-tour-du-monde) for the rules.
   - **X01** has these options:
     - **Score de départ**: **301**, **501** or **701**. 501 is selected at first.
     - **Finish**: **Simple out** (selected at first) or **Double out**. With simple out, a player finishes by reaching exactly 0 with any dart. With double out, every player must finish on a double or on the bull; any other last dart is a bust and the turn is cancelled.

   The finish you choose applies to all players of the game. A player who has the option **Double out forcé** on their profile (see [Managing players](players.md)) always has to double out, even when the game is set to simple out.

3. In the **Joueurs** list, tap each person who plays. A red tick appears and the row gets a cream border. Tap again to untick. You can play alone: one player is enough.
4. The counter at the top right of the list shows how many players are selected.

Archived players are not in the list. If someone is missing, press **Créer un joueur** to add them (see [Managing players](players.md)).

## Draw the order

Press **Tirer au sort**. The button stays grey until at least one player is selected. A window **Ordre de passage** shows the random order of play. The first player has a **Commence** label.

You cannot place players by hand: the order is always drawn by chance.

- **Relancer**: draws a new order. The "Tirage n°" counter goes up each time.
- **Modifier la sélection**: closes the window and brings you back to the selection, to add or remove players.
- **C’est parti**: creates the game with this order and opens the game page.

If the game cannot be created (for example the network is down), a red message appears in the window and you can press **C’est parti** again.

## The game page

It shows the game in progress: see [Playing a game](playing.md).
