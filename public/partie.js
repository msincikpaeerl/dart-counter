/* Game page: shows the mode and the play order of the game. French UI. */
(function () {
  'use strict';

  var id = window.location.pathname.split('/').pop();
  var status = document.getElementById('status');

  fetch('/api/games/' + encodeURIComponent(id))
    .then(function (response) {
      if (!response.ok) throw new Error('not found');
      return response.json();
    })
    .then(function (game) {
      document.getElementById('title').textContent = 'Partie ' + game.mode;
      status.textContent = 'Double out · ordre de passage :';
      var order = document.getElementById('order');
      var rows = game.players.map(function (player, index) {
        var row = document.createElement('li');
        var rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = String(index + 1);
        var name = document.createElement('span');
        name.className = 'name';
        name.textContent = player.name;
        row.appendChild(rank);
        row.appendChild(name);
        return row;
      });
      order.replaceChildren.apply(order, rows);
    })
    .catch(function () {
      status.textContent = 'Partie introuvable.';
    });
})();
