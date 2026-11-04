/* Game screen: clickable dartboard, scores, undo, winner overlay. French UI.
   All scoring is done by the server (scoring engine); this page sends each dart and shows the state. */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var RING_COLOURS = ['#efdcb0', '#d9261c', '#0b8a3c'];
  var ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  // Radii of the rings, from the centre: bull, single (inner), triple, single (outer), double.
  var R_BULL = 25;
  var R_INNER = 96;
  var R_TRIPLE = 118;
  var R_OUTER = 146;
  var R_DOUBLE = 168;
  var DARK = '#151515';
  var CREAM = '#EFDCB0';
  var RED = '#D9261C';
  var GREEN = '#0B8A3C';

  var id = window.location.pathname.split('/').pop();
  var state = null;
  var queue = Promise.resolve();

  function $(name) {
    return document.getElementById(name);
  }

  function svg(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  // ---- Board ----

  function point(radius, angle) {
    var rad = (angle * Math.PI) / 180;
    return (radius * Math.sin(rad)).toFixed(2) + ' ' + (-radius * Math.cos(rad)).toFixed(2);
  }

  function ringPath(r1, r2, a1, a2) {
    return (
      'M' +
      point(r1, a1) +
      ' L' +
      point(r2, a1) +
      ' A' +
      r2 +
      ' ' +
      r2 +
      ' 0 0 1 ' +
      point(r2, a2) +
      ' L' +
      point(r1, a2) +
      ' A' +
      r1 +
      ' ' +
      r1 +
      ' 0 0 0 ' +
      point(r1, a1) +
      'Z'
    );
  }

  /** Key of a board zone, used to highlight the checkout targets. */
  function zoneKey(sector, multiplier, ring) {
    if (sector === 25) return multiplier === 2 ? 'db' : 'sb';
    if (multiplier === 3) return 't' + sector;
    if (multiplier === 2) return 'd' + sector;
    return 's' + sector + (ring || 'i');
  }

  var WORDS = { 1: 'Simple', 2: 'Double', 3: 'Triple' };

  function zone(key, sector, multiplier, fill, shape) {
    shape.setAttribute('fill', fill);
    shape.setAttribute('stroke', '#7a7a7a');
    shape.setAttribute('stroke-width', '0.6');
    shape.setAttribute('class', 'seg');
    shape.setAttribute('data-key', key);
    shape.setAttribute('data-sector', String(sector));
    shape.setAttribute('data-multiplier', String(multiplier));
    shape.setAttribute(
      'aria-label',
      sector === 25 ? (multiplier === 2 ? 'Bull 50' : 'Bull 25') : WORDS[multiplier] + ' ' + sector,
    );
    shape.setAttribute('role', 'button');
    return shape;
  }

  function buildBoard() {
    var board = $('board');
    board.appendChild(
      svg('circle', { r: 192, fill: '#111111', stroke: '#3A3A3A', 'stroke-width': 2 }),
    );
    ORDER.forEach(function (sector, index) {
      var a1 = index * 18 - 9;
      var a2 = index * 18 + 9;
      var light = index % 2 === 1;
      var single = light ? CREAM : DARK;
      var ring = light ? GREEN : RED;
      var parts = [
        [zoneKey(sector, 1, 'i'), 1, single, R_BULL, R_INNER],
        [zoneKey(sector, 3), 3, ring, R_INNER, R_TRIPLE],
        [zoneKey(sector, 1, 'o'), 1, single, R_TRIPLE, R_OUTER],
        [zoneKey(sector, 2), 2, ring, R_OUTER, R_DOUBLE],
      ];
      parts.forEach(function (part) {
        board.appendChild(
          zone(
            part[0],
            sector,
            part[1],
            part[2],
            svg('path', { d: ringPath(part[3], part[4], a1, a2) }),
          ),
        );
      });
    });
    board.appendChild(zone('sb', 25, 1, GREEN, svg('circle', { r: R_BULL })));
    board.appendChild(zone('db', 25, 2, RED, svg('circle', { r: 11 })));
    ORDER.forEach(function (sector, index) {
      var text = svg('text', {
        x: (181 * Math.sin((index * 18 * Math.PI) / 180)).toFixed(1),
        y: (-181 * Math.cos((index * 18 * Math.PI) / 180)).toFixed(1),
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: '#E8E8E8',
        'font-family': 'Barlow, sans-serif',
        'font-weight': '500',
        'font-size': '16',
        'aria-hidden': 'true',
        'pointer-events': 'none',
      });
      text.textContent = String(sector);
      board.appendChild(text);
    });
    board.addEventListener('click', function (event) {
      var target = event.target.closest ? event.target.closest('[data-key]') : null;
      if (!target || !state || state.winnerId !== null) return;
      send('POST', '/darts', {
        sector: Number(target.getAttribute('data-sector')),
        multiplier: Number(target.getAttribute('data-multiplier')),
      });
    });
  }

  // ---- Players ----

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

  function playerById(playerId) {
    return state.players.filter(function (p) {
      return p.id === playerId;
    })[0];
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---- Rendering ----

  function renderStatus(current, remaining) {
    var box = $('status');
    var node;
    if (state.bust) {
      var busted = playerById(state.bust.playerId);
      node = el('div', 'bust', 'Bust ! ' + busted.name + ' reste à ' + state.bust.remaining);
    } else if (state.checkout && state.winnerId === null) {
      node = el('div', 'finish');
      node.appendChild(el('span', 'finish-label', 'Finish'));
      var combo = el('div', 'finish-combo');
      state.checkout.forEach(function (dart, index) {
        combo.appendChild(el('span', index === 0 ? 'chip first' : 'chip', dart.label));
      });
      node.appendChild(combo);
    } else if (state.winnerId === null) {
      node = el(
        'div',
        'hint',
        remaining <= (current.doubleOut ? 170 : 180)
          ? 'Pas de finish possible avec ' +
              state.dartsLeft +
              ' fléchette' +
              (state.dartsLeft > 1 ? 's' : '')
          : view === 'pad'
            ? 'Choisissez une touche pour marquer'
            : 'Touchez la cible pour marquer',
      );
    }
    box.replaceChildren.apply(box, node ? [node] : []);
  }

  // ---- Keypad ----

  var view = 'board';
  var modifier = 1;
  var MOD_PREFIX = { 1: '', 2: 'D', 3: 'T' };

  function buildPad() {
    var keys = $('pad-keys');
    for (var n = 1; n <= 20; n++) {
      var key = el('button', 'key', String(n));
      key.type = 'button';
      key.setAttribute('data-key', String(n));
      keys.appendChild(key);
    }
    keys.addEventListener('click', function (event) {
      var target = event.target.closest ? event.target.closest('[data-key]') : null;
      if (target) pressKey(Number(target.getAttribute('data-key')));
    });
    $('key-25').addEventListener('click', function () {
      pressKey(25);
    });
    $('key-bull').addEventListener('click', function () {
      pressKey('bull');
    });
    var mods = document.querySelectorAll('.mod');
    for (var i = 0; i < mods.length; i++) {
      mods[i].addEventListener('click', function (event) {
        var value = Number(event.currentTarget.getAttribute('data-mod'));
        // Tapping the active Double or Triple again goes back to Simple.
        modifier = modifier === value && value > 1 ? 1 : value;
        renderPad();
      });
    }
    $('view-board').addEventListener('click', function () {
      setView('board');
    });
    $('view-pad').addEventListener('click', function () {
      setView('pad');
    });
  }

  function setView(next) {
    view = next;
    modifier = 1;
    renderView();
    if (state) render();
  }

  function pressKey(key) {
    var dart = window.Keypad.dartFor(key, modifier);
    modifier = 1;
    renderPad();
    if (!dart || !state || state.winnerId !== null) return;
    send('POST', '/darts', dart);
  }

  function renderView() {
    var onPad = view === 'pad';
    $('pad').hidden = !onPad;
    $('board-wrap').hidden = onPad;
    $('view-board').setAttribute('aria-pressed', String(!onPad));
    $('view-pad').setAttribute('aria-pressed', String(onPad));
    renderPad();
  }

  /** Labels and tints of the keys for the modifier, and the blinking checkout target. */
  function renderPad() {
    var first =
      state && state.checkout && state.winnerId === null && !state.bust && state.checkout[0]
        ? window.Keypad.keyFor(state.checkout[0])
        : null;
    var pad = $('pad');
    pad.className = 'pad' + (modifier === 2 ? ' is-double' : modifier === 3 ? ' is-triple' : '');
    var mods = pad.querySelectorAll('.mod');
    for (var m = 0; m < mods.length; m++) {
      var value = Number(mods[m].getAttribute('data-mod'));
      mods[m].setAttribute('aria-pressed', String(value === modifier));
      mods[m].classList.toggle(
        'padnext',
        !!first && value > 1 && value === first.modifier && value !== modifier,
      );
    }
    var keys = pad.querySelectorAll('#pad-keys .key');
    for (var k = 0; k < keys.length; k++) {
      var n = Number(keys[k].getAttribute('data-key'));
      keys[k].textContent = MOD_PREFIX[modifier] + n;
      keys[k].setAttribute('aria-label', WORDS[modifier] + ' ' + n);
      keys[k].classList.toggle('padnext', !!first && first.key === n);
    }
    var k25 = $('key-25');
    k25.textContent = modifier === 2 ? 'D25 = Bull' : '25';
    k25.setAttribute('aria-label', modifier === 2 ? 'Bull 50' : 'Bull 25');
    k25.disabled = modifier === 3;
    k25.classList.toggle('padnext', !!first && first.key === 25);
    $('key-bull').classList.toggle('padnext', !!first && first.key === 'bull');
  }

  function renderBoard() {
    var classes = {};
    if (state.checkout && state.winnerId === null && !state.bust) {
      state.checkout.forEach(function (dart, index) {
        var keys =
          dart.multiplier === 1 && dart.sector !== 25
            ? [zoneKey(dart.sector, 1, 'i'), zoneKey(dart.sector, 1, 'o')]
            : [zoneKey(dart.sector, dart.multiplier)];
        keys.forEach(function (key) {
          classes[key] = index === 0 ? 'seg blink' : 'seg tgt';
        });
      });
    }
    var zones = $('board').querySelectorAll('[data-key]');
    for (var i = 0; i < zones.length; i++) {
      zones[i].setAttribute('class', classes[zones[i].getAttribute('data-key')] || 'seg');
    }
  }

  /** Bataille: both teams' hit points, the team to hit is the one the current player attacks. */
  function renderBattle() {
    var current = playerById(
      state.currentPlayerId !== null ? state.currentPlayerId : state.winnerId,
    );
    $('mode').textContent = 'Bataille · ' + state.mode + ' PV';
    $('round').textContent = 'Manche ' + state.round;
    $('undo').disabled = !state.canUndo;

    var box = $('battle-teams');
    var cards = state.teams.map(function (team) {
      var card = el('div', 'battle-team');
      if (team.number === state.currentTeam) card.classList.add('playing');
      if (state.winnerTeam === team.number) card.classList.add('won');
      if (team.hitPoints === 0) card.classList.add('down');
      card.appendChild(el('span', 'battle-team-name', 'Équipe ' + team.number));
      card.appendChild(el('span', 'battle-hp', String(team.hitPoints)));
      var bar = el('span', 'battle-bar');
      var fill = el('span', 'battle-bar-fill');
      fill.style.width = Math.round((100 * team.hitPoints) / state.mode) + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      card.appendChild(
        el(
          'span',
          'battle-members',
          team.playerIds
            .map(function (playerId) {
              return playerById(playerId).name;
            })
            .join(', '),
        ),
      );
      return card;
    });
    box.replaceChildren.apply(box, cards);
    box.hidden = false;

    var avatar = buildAvatar(current);
    avatar.id = 'cur-avatar';
    $('cur-avatar').replaceWith(avatar);
    $('cur-name').textContent = current.name;
    var attackedTeam = state.currentTeam === null ? null : 3 - state.currentTeam;
    $('cur-score').textContent =
      attackedTeam === null ? '' : String(state.teams[attackedTeam - 1].hitPoints);

    var visit =
      state.currentVisit && state.currentVisit.playerId === current.id ? state.currentVisit : null;
    var thrown = visit ? visit.darts : [];
    for (var i = 0; i < 3; i++) {
      var slot = $('slot-' + i);
      if (thrown[i]) {
        slot.className = 'slot';
        slot.textContent = thrown[i].label;
      } else {
        slot.className = 'slot empty';
        slot.textContent = i === thrown.length ? '▸' : '·';
      }
    }
    $('total').textContent = '= ' + (visit ? visit.scored : 0);

    document.querySelector('.others').hidden = true;
    var status = $('status');
    status.replaceChildren(
      state.winnerId === null
        ? el(
            'div',
            'hint',
            'Chaque point marqué retire des points de vie à l’équipe ' + attackedTeam,
          )
        : el('div', 'hint', ''),
    );
    var zones = $('board').querySelectorAll('[data-key]');
    for (var z = 0; z < zones.length; z++) zones[z].setAttribute('class', 'seg');
    renderPad();

    var won = state.winnerId !== null;
    $('winner').hidden = !won;
    if (won) {
      $('winner-name').textContent =
        'Équipe ' +
        state.winnerTeam +
        ' gagne · ' +
        state.teams[state.winnerTeam - 1].playerIds
          .map(function (playerId) {
            return playerById(playerId).name;
          })
          .join(', ');
    }
    $('miss').disabled = won;
    $('next').disabled = won;
  }

  function render() {
    if (state.type === 'battle') {
      renderBattle();
      return;
    }
    var current = playerById(
      state.currentPlayerId !== null ? state.currentPlayerId : state.winnerId,
    );
    var remaining = state.remaining[current.id];

    // The finish shown is the game's; a player forced to double out is mentioned by name.
    var forced = state.players.filter(function (p) {
      return p.doubleOut;
    });
    $('mode').textContent =
      'X01 · ' +
      state.mode +
      (state.doubleOut
        ? ' · Double out'
        : ' · Simple out' +
          (forced.length > 0
            ? ' (double out : ' +
              forced
                .map(function (p) {
                  return p.name;
                })
                .join(', ') +
              ')'
            : ''));
    $('round').textContent = 'Manche ' + state.round;
    $('undo').disabled = !state.canUndo;

    var avatar = buildAvatar(current);
    avatar.id = 'cur-avatar';
    $('cur-avatar').replaceWith(avatar);
    $('cur-name').textContent = current.name;
    $('cur-score').textContent = String(remaining);

    var visit =
      state.currentVisit && state.currentVisit.playerId === current.id ? state.currentVisit : null;
    var thrown = visit ? visit.darts : [];
    for (var i = 0; i < 3; i++) {
      var slot = $('slot-' + i);
      if (thrown[i]) {
        slot.className = 'slot';
        slot.textContent = thrown[i].label;
      } else {
        slot.className = 'slot empty';
        slot.textContent = i === thrown.length ? '▸' : '·';
      }
    }
    $('total').textContent = '= ' + (visit ? visit.scored : 0);

    var position = state.players.indexOf(current);
    var others = $('others');
    var rows = [];
    for (var k = 1; k < state.players.length; k++) {
      var player = state.players[(position + k) % state.players.length];
      var last = state.lastScores[player.id];
      var lastText = last === null || last === undefined ? '–' : String(last);
      var row = el('div', 'other');
      row.appendChild(buildAvatar(player));
      var text = el('div', 'other-text');
      text.appendChild(el('span', 'other-name', player.name));
      var lastLine = el('span', 'other-last');
      lastLine.appendChild(el('span', 'short', 'Dern. ' + lastText));
      lastLine.appendChild(el('span', 'long', 'Dernière volée : ' + lastText));
      text.appendChild(lastLine);
      row.appendChild(text);
      row.appendChild(el('span', 'other-score', String(state.remaining[player.id])));
      rows.push(row);
    }
    others.replaceChildren.apply(others, rows);
    document.querySelector('.others').hidden = rows.length === 0;

    renderStatus(current, remaining);
    renderBoard();
    renderPad();

    var won = state.winnerId !== null;
    $('winner').hidden = !won;
    if (won) $('winner-name').textContent = current.name + ' gagne';
    $('miss').disabled = won;
    $('next').disabled = won;
  }

  // ---- Server ----

  function showError(message) {
    var box = $('status');
    box.replaceChildren(el('div', 'bust', message));
  }

  /** Sends one action to the server; actions are queued so quick taps are saved in order. */
  function send(method, path, body) {
    queue = queue.then(function () {
      return fetch('/api/games/' + encodeURIComponent(id) + path, {
        method: method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(function (response) {
          if (!response.ok) throw new Error('refused');
          return response.json();
        })
        .then(function (next) {
          state = next;
          render();
        })
        .catch(function () {
          showError('Connexion perdue : la fléchette n’a pas été enregistrée.');
        });
    });
    return queue;
  }

  $('undo').addEventListener('click', function () {
    send('DELETE', '/darts/last');
  });
  $('miss').addEventListener('click', function () {
    if (state && state.winnerId === null) send('POST', '/darts', { sector: 0, multiplier: 0 });
  });
  $('next').addEventListener('click', function () {
    if (state && state.winnerId === null) send('POST', '/next');
  });
  $('replay').addEventListener('click', function () {
    fetch('/api/games/' + encodeURIComponent(id) + '/rematch', { method: 'POST' })
      .then(function (response) {
        if (!response.ok) throw new Error('refused');
        return response.json();
      })
      .then(function (game) {
        window.location.href = '/partie/' + game.id;
      })
      .catch(function () {
        showError('Impossible de relancer la partie. Réessayez.');
      });
  });

  buildBoard();
  buildPad();
  fetch('/api/games/' + encodeURIComponent(id))
    .then(function (response) {
      if (!response.ok) throw new Error('not found');
      return response.json();
    })
    .then(function (game) {
      state = game;
      $('error').hidden = true;
      $('game').hidden = false;
      render();
    })
    .catch(function () {
      $('error').textContent = 'Partie introuvable.';
    });
})();
