/* Game setup screen: mode, players, random draw, start. French UI. */
(function () {
  'use strict';

  var RING_COLOURS = ['#efdcb0', '#d9261c', '#0b8a3c'];

  function $(id) {
    return document.getElementById(id);
  }

  var players = [];
  var selected = []; // player ids, in the order they were ticked
  var mode = 501;
  var drawn = null; // array of players in play order, or null when the overlay is closed
  var drawCount = 0;

  var playerList = $('players');
  var drawButton = $('draw');
  var overlay = $('overlay');
  var startButton = $('start');
  var startError = $('start-error');

  function ringColour(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return RING_COLOURS[sum % RING_COLOURS.length];
  }

  function buildAvatar(player) {
    var avatar = document.createElement('span');
    avatar.className = 'avatar';
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

  /** Uniform random integer in [0, max), from the browser's secure generator. */
  function randomBelow(max) {
    var buffer = new Uint32Array(1);
    var limit = Math.floor(4294967296 / max) * max;
    do {
      window.crypto.getRandomValues(buffer);
    } while (buffer[0] >= limit);
    return buffer[0] % max;
  }

  /** Fisher-Yates shuffle of a copy of the list. */
  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = randomBelow(i + 1);
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function renderModes() {
    document.querySelectorAll('.mode').forEach(function (button) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.mode) === mode));
    });
    $('draw-label').textContent = 'Tirer au sort · ' + mode;
  }

  function renderCount() {
    var n = selected.length;
    $('sel-count').textContent = n + (n > 1 ? ' sélectionnés' : ' sélectionné');
    drawButton.disabled = n < 1;
  }

  function renderPlayers() {
    var rows = players.map(function (player) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'player';
      button.setAttribute('aria-pressed', String(selected.indexOf(player.id) >= 0));
      button.appendChild(buildAvatar(player));

      var names = document.createElement('span');
      names.className = 'names';
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = player.name;
      names.appendChild(name);
      if (player.nickname) {
        var nick = document.createElement('span');
        nick.className = 'nick';
        nick.textContent = '« ' + player.nickname + ' »';
        names.appendChild(nick);
      }
      button.appendChild(names);

      var check = document.createElement('span');
      check.className = 'check';
      check.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      button.appendChild(check);

      button.addEventListener('click', function () {
        var index = selected.indexOf(player.id);
        if (index >= 0) selected.splice(index, 1);
        else selected.push(player.id);
        button.setAttribute('aria-pressed', String(index < 0));
        renderCount();
      });
      item.appendChild(button);
      return item;
    });
    playerList.replaceChildren.apply(playerList, rows);
    $('empty').hidden = players.length > 0;
    renderCount();
  }

  async function loadPlayers() {
    try {
      var response = await fetch('/api/players');
      players = await response.json();
      // Forget ticked players that were archived since.
      selected = selected.filter(function (id) {
        return players.some(function (p) {
          return p.id === id;
        });
      });
      renderPlayers();
    } catch {
      $('empty').textContent = 'Impossible de charger les joueurs.';
      $('empty').hidden = false;
    }
  }

  // ---------- Draw overlay ----------

  function renderOrder() {
    var order = $('order');
    var rows = drawn.map(function (player, index) {
      var row = document.createElement('li');
      if (index === 0) row.className = 'first';
      var rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = String(index + 1);
      row.appendChild(rank);
      row.appendChild(buildAvatar(player));
      var name = document.createElement('span');
      name.className = 'name';
      name.textContent = player.name;
      row.appendChild(name);
      if (index === 0) {
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = 'Commence';
        row.appendChild(badge);
      }
      return row;
    });
    order.replaceChildren.apply(order, rows);
    $('draw-count').textContent = 'Tirage n° ' + drawCount;
  }

  function draw() {
    var chosen = players.filter(function (p) {
      return selected.indexOf(p.id) >= 0;
    });
    if (chosen.length < 1) return;
    drawn = shuffle(chosen);
    drawCount += 1;
    startError.hidden = true;
    renderOrder();
    overlay.hidden = false;
    startButton.focus();
  }

  function closeOverlay() {
    drawn = null;
    overlay.hidden = true;
    drawButton.focus();
  }

  async function start() {
    if (!drawn) return;
    startError.hidden = true;
    startButton.disabled = true;
    try {
      var response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: mode,
          playerIds: drawn.map(function (p) {
            return p.id;
          }),
        }),
      });
      var body = await response.json().catch(function () {
        return {};
      });
      if (response.ok) {
        window.location.href = '/partie/' + body.id;
        return;
      }
      startError.textContent = body.error || 'La partie n’a pas pu être créée. Réessayez.';
    } catch {
      startError.textContent =
        'Impossible de joindre le serveur. Vérifiez la connexion et réessayez.';
    }
    startError.hidden = false;
    startButton.disabled = false;
  }

  document.querySelectorAll('.mode').forEach(function (button) {
    button.addEventListener('click', function () {
      mode = Number(button.dataset.mode);
      renderModes();
    });
  });
  drawButton.addEventListener('click', draw);
  $('redraw').addEventListener('click', draw);
  $('close').addEventListener('click', closeOverlay);
  startButton.addEventListener('click', start);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && drawn) closeOverlay();
  });
  // Coming back with the browser's back button must not keep a stale disabled state.
  window.addEventListener('pageshow', function () {
    startButton.disabled = false;
    loadPlayers();
  });

  renderModes();
  renderCount();
})();
