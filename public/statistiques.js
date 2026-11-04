/* Statistics and history screen: players, one player's figures, finished games, one game's visits. French UI. */
(function () {
  'use strict';

  var RING_COLOURS = ['#efdcb0', '#d9261c', '#0b8a3c'];

  function $(id) {
    return document.getElementById(id);
  }

  var title = $('title');
  var message = $('message');
  var playersList = $('players');
  var playerView = $('player-view');
  var gamesList = $('games');
  var gameView = $('game-view');
  var tabs = $('tabs');
  var tabPlayers = $('tab-players');
  var tabHistory = $('tab-history');

  /** What "back" does from the current view. */
  var goBack = function () {
    window.location.href = '/';
  };

  function ringColour(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return RING_COLOURS[sum % RING_COLOURS.length];
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function buildAvatar(player, big) {
    var avatar = el('div', big ? 'avatar big' : 'avatar');
    avatar.style.setProperty('--ring', ringColour(player.name));
    if (player.photoUrl) {
      var img = document.createElement('img');
      img.src = player.photoUrl;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = (player.name.trim().charAt(0) || '?').toUpperCase();
    }
    return avatar;
  }

  function number(value, decimals) {
    return value.toFixed(decimals).replace('.', ',');
  }

  function formatDate(iso) {
    var date = new Date(iso);
    return (
      date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) +
      ' · ' +
      date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  }

  async function getJson(url) {
    var response = await fetch(url);
    if (!response.ok) throw new Error('request failed');
    return response.json();
  }

  function showMessage(text) {
    message.textContent = text || '';
    message.hidden = !text;
  }

  /** Hides every view; each show* function then reveals its own. */
  function reset() {
    showMessage('');
    playersList.hidden = true;
    playerView.hidden = true;
    gamesList.hidden = true;
    gameView.hidden = true;
    tabs.hidden = true;
  }

  function setTab(name) {
    tabs.hidden = false;
    tabPlayers.setAttribute('aria-pressed', String(name === 'players'));
    tabHistory.setAttribute('aria-pressed', String(name === 'history'));
  }

  // ---------- Players ----------

  async function showPlayers() {
    reset();
    setTab('players');
    title.textContent = 'Statistiques';
    goBack = function () {
      window.location.href = '/';
    };
    try {
      var entries = await getJson('/api/stats/players');
      playersList.replaceChildren.apply(playersList, entries.map(buildPlayerRow));
      playersList.hidden = false;
      if (entries.length === 0) {
        showMessage('Aucune partie terminée pour l’instant. Les statistiques apparaîtront ici.');
      }
    } catch {
      showMessage('Impossible de charger les statistiques.');
    }
  }

  function buildPlayerRow(entry) {
    var item = el('li');
    var row = el('button', 'row');
    row.type = 'button';
    row.appendChild(buildAvatar(entry.player));
    var text = el('div', 'row-text');
    text.appendChild(el('div', 'row-title', entry.player.name));
    var sub = entry.stats.gamesPlayed + (entry.stats.gamesPlayed > 1 ? ' parties' : ' partie');
    if (entry.player.archived) sub += ' · archivé';
    text.appendChild(el('div', 'row-sub', sub));
    row.appendChild(text);
    var figure = el('div', 'row-figure', number(entry.stats.winPercent, 0) + ' %');
    figure.appendChild(el('small', null, 'Victoires'));
    row.appendChild(figure);
    row.addEventListener('click', function () {
      showPlayer(entry.player.id);
    });
    item.appendChild(row);
    return item;
  }

  // ---------- One player ----------

  function addStat(grid, label, value, wide) {
    var box = el('div', wide ? 'stat wide' : 'stat');
    box.appendChild(el('dt', null, label));
    box.appendChild(el('dd', null, value));
    grid.appendChild(box);
  }

  async function showPlayer(id) {
    reset();
    title.textContent = 'Joueur';
    goBack = showPlayers;
    try {
      var data = await getJson('/api/stats/players/' + id);
      var player = data.player;
      var stats = data.stats;
      $('player-avatar').replaceChildren(buildAvatar(player, true));
      $('player-name').textContent = player.name;
      $('player-nickname').textContent = player.nickname ? '« ' + player.nickname + ' »' : '';
      $('player-archived').hidden = !player.archived;

      var grid = $('stat-grid');
      grid.replaceChildren();
      addStat(grid, 'Parties jouées', String(stats.gamesPlayed));
      addStat(grid, 'Parties gagnées', String(stats.gamesWon));
      addStat(grid, '% de victoires', number(stats.winPercent, 1) + ' %');
      addStat(
        grid,
        'Moyenne 3 fléchettes',
        stats.threeDartAverage === null ? '–' : number(stats.threeDartAverage, 1),
      );
      addStat(grid, 'Meilleure volée', String(stats.bestVisit));
      addStat(grid, '180', String(stats.count180));
      addStat(grid, 'Volées à 100+', String(stats.visits100Plus));
      addStat(
        grid,
        'Plus haut checkout',
        stats.highestCheckout === null ? '–' : String(stats.highestCheckout),
      );
      playerView.hidden = false;

      var games = await getJson('/api/history?playerId=' + id);
      gamesList.replaceChildren.apply(
        gamesList,
        games.map(function (game) {
          return buildGameRow(game, function () {
            showPlayer(id);
          });
        }),
      );
      gamesList.hidden = false;
      if (games.length === 0) showMessage('Aucune partie terminée pour ce joueur.');
    } catch {
      showMessage('Impossible de charger ce joueur.');
    }
  }

  // ---------- History ----------

  /** The type and options of a game, e.g. "X01 · 701 · Double out". */
  function optionsLabel(game) {
    return 'X01 · ' + game.mode + (game.doubleOut ? ' · Double out' : ' · Simple out');
  }

  function buildGameRow(game, back) {
    var item = el('li');
    var row = el('button', 'row');
    row.type = 'button';
    row.appendChild(el('div', 'mode-chip', String(game.mode)));
    var text = el('div', 'row-text');
    text.appendChild(
      el('div', 'row-title', optionsLabel(game) + ' · ' + formatDate(game.finishedAt)),
    );
    text.appendChild(
      el(
        'div',
        'row-sub',
        game.players
          .map(function (p) {
            return p.name;
          })
          .join(', '),
      ),
    );
    row.appendChild(text);
    var winner = el('div', 'row-figure', game.winner ? game.winner.name : '–');
    winner.appendChild(el('small', null, 'Vainqueur'));
    row.appendChild(winner);
    row.addEventListener('click', function () {
      showGame(game.id, back);
    });
    item.appendChild(row);
    return item;
  }

  async function showHistory() {
    reset();
    setTab('history');
    title.textContent = 'Historique';
    goBack = function () {
      window.location.href = '/';
    };
    try {
      var games = await getJson('/api/history');
      gamesList.replaceChildren.apply(
        gamesList,
        games.map(function (game) {
          return buildGameRow(game, showHistory);
        }),
      );
      gamesList.hidden = false;
      if (games.length === 0) showMessage('Aucune partie terminée pour l’instant.');
    } catch {
      showMessage('Impossible de charger l’historique.');
    }
  }

  // ---------- One game ----------

  /** `back` returns to the screen the game was opened from (history, or a player's page). */
  async function showGame(id, back) {
    reset();
    title.textContent = 'Partie';
    goBack = back;
    try {
      var game = await getJson('/api/history/' + id);
      var names = {};
      game.players.forEach(function (p) {
        names[p.id] = p.name;
      });

      var summary = $('game-summary');
      summary.replaceChildren();
      summary.appendChild(
        el('div', 'row-title', optionsLabel(game) + ' · ' + formatDate(game.finishedAt)),
      );
      summary.appendChild(
        el(
          'div',
          'row-sub',
          game.players
            .map(function (p) {
              return p.name;
            })
            .join(', '),
        ),
      );
      if (game.winner) {
        summary.appendChild(el('div', 'winner-banner', 'Vainqueur : ' + game.winner.name));
      }

      var list = $('visits');
      list.replaceChildren.apply(
        list,
        game.visits.map(function (visit) {
          var item = el('li', 'visit' + (visit.bust ? ' bust' : visit.finished ? ' finish' : ''));
          item.appendChild(el('span', 'visit-no', String(visit.round)));
          var who = el('div');
          who.appendChild(el('div', 'visit-who', names[visit.playerId] || ''));
          var darts = visit.darts
            .map(function (d) {
              return d.label;
            })
            .join(' · ');
          if (visit.bust) darts += ' — Bust';
          who.appendChild(el('div', 'visit-darts', darts));
          item.appendChild(who);
          var score = el('div', 'visit-score', String(visit.scored));
          score.appendChild(el('small', null, 'reste ' + visit.remaining));
          item.appendChild(score);
          return item;
        }),
      );
      gameView.hidden = false;
    } catch {
      showMessage('Impossible de charger cette partie.');
    }
  }

  tabPlayers.addEventListener('click', showPlayers);
  tabHistory.addEventListener('click', showHistory);
  $('back').addEventListener('click', function () {
    goBack();
  });

  showPlayers();
})();
