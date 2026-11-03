/* Players screen: list, create, edit, archive, photo. French UI. */
(function () {
  'use strict';

  var RING_COLOURS = ['#efdcb0', '#d9261c', '#0b8a3c'];

  function $(id) {
    return document.getElementById(id);
  }

  var listView = $('list-view');
  var formView = $('form-view');
  var form = $('player-form');
  var nameInput = $('name');
  var nicknameInput = $('nickname');
  var errorBox = $('error');
  var video = $('video');
  var preview = $('preview');
  var initial = $('initial');
  var caption = $('caption');
  var shutter = $('shutter');
  var shutterDot = $('shutter-dot');
  var shutterRetake = $('shutter-retake');
  var switchButton = $('switch-camera');
  var removeButton = $('remove-photo');
  var fileCamera = $('file-camera');
  var fileGallery = $('file-gallery');
  var saveButton = $('save');

  var editingId = null; // null = creating
  var photoBlob = null; // new photo chosen in this session
  var existingPhotoUrl = null; // photo already saved for the player being edited
  var removePhoto = false;
  var stream = null;
  var facingMode = 'user';
  var previewUrl = null;

  /** The live camera needs a secure context (HTTPS or localhost). */
  var cameraAvailable = Boolean(
    window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
  );

  function ringColour(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return RING_COLOURS[sum % RING_COLOURS.length];
  }

  function initialOf(name) {
    return (name.trim().charAt(0) || '?').toUpperCase();
  }

  function setError(message) {
    errorBox.hidden = !message;
    errorBox.textContent = message || '';
    nameInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  // ---------- List ----------

  function buildAvatar(player) {
    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.setProperty('--ring', ringColour(player.name));
    if (player.photoUrl) {
      var img = document.createElement('img');
      img.src = player.photoUrl;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = initialOf(player.name);
    }
    return avatar;
  }

  function buildButton(label, className, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function buildRow(player) {
    var row = document.createElement('li');
    row.className = 'player-row';
    row.appendChild(buildAvatar(player));

    var names = document.createElement('div');
    names.className = 'player-names';
    var name = document.createElement('div');
    name.className = 'player-name';
    name.textContent = player.name;
    names.appendChild(name);
    if (player.nickname) {
      var nickname = document.createElement('div');
      nickname.className = 'player-nickname';
      nickname.textContent = '« ' + player.nickname + ' »';
      names.appendChild(nickname);
    }
    row.appendChild(names);

    row.appendChild(
      buildButton('Modifier', 'row-button', function () {
        openForm(player);
      }),
    );
    row.appendChild(
      buildButton('Archiver', 'row-button danger', function () {
        archive(player);
      }),
    );
    return row;
  }

  async function loadList() {
    var list = $('player-list');
    try {
      var response = await fetch('/api/players');
      var players = await response.json();
      list.replaceChildren.apply(list, players.map(buildRow));
      $('list-empty').hidden = players.length > 0;
    } catch {
      $('list-empty').textContent = 'Impossible de charger les joueurs.';
      $('list-empty').hidden = false;
    }
  }

  async function archive(player) {
    var ok = window.confirm(
      'Archiver ' + player.name + ' ? Le joueur disparaîtra de la liste de sélection.',
    );
    if (!ok) return;
    var response = await fetch('/api/players/' + player.id + '/archive', { method: 'POST' });
    if (!response.ok) window.alert("L'archivage a échoué. Réessayez.");
    await loadList();
  }

  function showList() {
    stopCamera();
    formView.hidden = true;
    listView.hidden = false;
    loadList();
  }

  // ---------- Photo ----------

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
      stream = null;
    }
    video.srcObject = null;
  }

  async function startCamera() {
    stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = stream;
      return true;
    } catch {
      cameraAvailable = false;
      return false;
    }
  }

  function currentPhotoUrl() {
    if (previewUrl) return previewUrl;
    if (!removePhoto && existingPhotoUrl) return existingPhotoUrl;
    return null;
  }

  /** Shows what the photo area should display for the current state. */
  function refreshPhotoArea() {
    var live = Boolean(stream);
    var photo = live ? null : currentPhotoUrl();
    video.hidden = !live;
    preview.hidden = !photo;
    if (photo) preview.src = photo;
    var name = nameInput.value;
    initial.textContent = initialOf(name);
    initial.style.setProperty('--ring', ringColour(name));
    initial.hidden = live || Boolean(photo);

    shutterDot.hidden = Boolean(photo) && !live;
    shutterRetake.hidden = !photo || live;
    switchButton.hidden = !cameraAvailable;
    removeButton.hidden = !photo;

    if (live) {
      caption.textContent = 'Cadrez votre visage';
      shutter.setAttribute('aria-label', 'Prendre la photo');
    } else if (photo) {
      caption.textContent = 'Photo enregistrée';
      shutter.setAttribute('aria-label', 'Reprendre la photo');
    } else {
      caption.textContent = 'Sans photo';
      shutter.setAttribute('aria-label', 'Prendre la photo');
    }
  }

  function setPhoto(blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    photoBlob = blob;
    previewUrl = URL.createObjectURL(blob);
    removePhoto = false;
    stopCamera();
    refreshPhotoArea();
  }

  function captureFrame() {
    var width = video.videoWidth;
    var height = video.videoHeight;
    if (!width || !height) return;
    var side = Math.min(width, height);
    var canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    canvas
      .getContext('2d')
      .drawImage(video, (width - side) / 2, (height - side) / 2, side, side, 0, 0, side, side);
    canvas.toBlob(
      function (blob) {
        if (blob) setPhoto(blob);
      },
      'image/jpeg',
      0.9,
    );
  }

  async function onShutter() {
    if (stream) {
      captureFrame();
      return;
    }
    if (cameraAvailable && (await startCamera())) {
      refreshPhotoArea();
      return;
    }
    // Plain HTTP, or camera refused: the device's own camera app via the file input.
    refreshPhotoArea();
    fileCamera.click();
  }

  async function onSwitchCamera() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    if (!(await startCamera())) facingMode = facingMode === 'user' ? 'environment' : 'user';
    refreshPhotoArea();
  }

  function onFileChosen(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (file) setPhoto(file);
  }

  // ---------- Form ----------

  async function openForm(player) {
    editingId = player ? player.id : null;
    photoBlob = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    existingPhotoUrl = player ? player.photoUrl : null;
    removePhoto = false;
    nameInput.value = player ? player.name : '';
    nicknameInput.value = player && player.nickname ? player.nickname : '';
    setError('');
    $('form-title').textContent = player ? 'Modifier le joueur' : 'Nouveau joueur';
    listView.hidden = true;
    formView.hidden = false;
    window.scrollTo(0, 0);
    // Straight to the viewfinder for a new player without a photo.
    if (!existingPhotoUrl && cameraAvailable) await startCamera();
    refreshPhotoArea();
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    var name = nameInput.value.trim();
    if (!name) {
      setError('Le nom est obligatoire.');
      nameInput.focus();
      return;
    }
    var data = new FormData();
    data.append('name', name);
    data.append('nickname', nicknameInput.value.trim());
    if (removePhoto) data.append('removePhoto', '1');
    if (photoBlob) data.append('photo', photoBlob, 'photo.jpg');
    saveButton.disabled = true;
    try {
      var response = await fetch(
        editingId === null ? '/api/players' : '/api/players/' + editingId,
        {
          method: editingId === null ? 'POST' : 'PUT',
          body: data,
        },
      );
      if (response.ok) {
        showList();
        return;
      }
      var body = await response.json().catch(function () {
        return {};
      });
      setError(body.error || "L'enregistrement a échoué. Réessayez.");
      if (response.status === 409) nameInput.focus();
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez la connexion et réessayez.');
    } finally {
      saveButton.disabled = false;
    }
  }

  $('new-player').addEventListener('click', function () {
    openForm(null);
  });
  $('form-back').addEventListener('click', showList);
  $('cancel').addEventListener('click', showList);
  $('gallery').addEventListener('click', function () {
    fileGallery.click();
  });
  shutter.addEventListener('click', onShutter);
  switchButton.addEventListener('click', onSwitchCamera);
  fileCamera.addEventListener('change', onFileChosen);
  fileGallery.addEventListener('change', onFileChosen);
  removeButton.addEventListener('click', function () {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    photoBlob = null;
    removePhoto = true;
    refreshPhotoArea();
  });
  nameInput.addEventListener('input', function () {
    setError('');
    if (!currentPhotoUrl()) refreshPhotoArea();
  });
  form.addEventListener('submit', onSubmit);
  window.addEventListener('pagehide', stopCamera);

  loadList();
})();
