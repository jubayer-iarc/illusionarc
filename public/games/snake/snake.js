window.onload = function () {
  // Session context
  function getParams() {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (e) {
      return new URLSearchParams("");
    }
  }

  var params = getParams();

  var sessionContext = {
    gameSlug: String(params.get("gameSlug") || ""),
    tournamentSlug: String(params.get("tournamentSlug") || ""),
    sessionId: String(params.get("sessionId") || ""),
    sessionNonce: String(params.get("sessionNonce") || ""),
    deviceType: String(params.get("deviceType") || ""),
    startedAt: String(params.get("startedAt") || ""),
    expiresAt: String(params.get("expiresAt") || ""),
    autostart: String(params.get("autostart") || "")
  };

  window.IA_SESSION_CONTEXT = sessionContext;

  window.IA_GetSessionContext = function () {
    return {
      gameSlug: sessionContext.gameSlug,
      tournamentSlug: sessionContext.tournamentSlug,
      sessionId: sessionContext.sessionId,
      sessionNonce: sessionContext.sessionNonce,
      deviceType: sessionContext.deviceType,
      startedAt: sessionContext.startedAt,
      expiresAt: sessionContext.expiresAt,
      autostart: sessionContext.autostart
    };
  };

  window.IA_HasSession = function () {
    return !!(sessionContext.sessionId && sessionContext.sessionNonce);
  };

  // Canvas + context
  var canvas = document.getElementById("viewport");
  var context = canvas.getContext("2d");

  // Timing
  var lastframe = 0;
  var fpstime = 0;
  var framecount = 0;
  var fps = 0;

  var initialized = false;

  // Images
  var images = [];
  var tileimage;

  // Preload tracking
  var loadcount = 0;
  var loadtotal = 0;
  var preloaded = false;

  function loadImages(imagefiles) {
    loadcount = 0;
    loadtotal = imagefiles.length;
    preloaded = false;

    var loadedimages = [];
    for (var i = 0; i < imagefiles.length; i++) {
      var image = new Image();
      image.onload = function () {
        loadcount++;
        if (loadcount === loadtotal) preloaded = true;
      };
      image.src = imagefiles[i];
      loadedimages[i] = image;
    }
    return loadedimages;
  }

  // Level
  var Level = function (columns, rows, tilewidth, tileheight) {
    this.columns = columns;
    this.rows = rows;
    this.tilewidth = tilewidth;
    this.tileheight = tileheight;

    this.tiles = [];
    for (var i = 0; i < this.columns; i++) {
      this.tiles[i] = [];
      for (var j = 0; j < this.rows; j++) {
        this.tiles[i][j] = 0;
      }
    }
  };

  Level.prototype.generate = function () {
    for (var i = 0; i < this.columns; i++) {
      for (var j = 0; j < this.rows; j++) {
        if (i === 0 || i === this.columns - 1 || j === 0 || j === this.rows - 1) {
          this.tiles[i][j] = 1;
        } else {
          this.tiles[i][j] = 0;
        }
      }
    }
  };

  // Snake
  var Snake = function () {
    this.directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    this.init(0, 0, 1, 9, 4);
  };

  Snake.prototype.init = function (x, y, direction, speed, numsegments) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.speed = speed;

    this.movedelay = 0;
    this.growsegments = 0;

    this.segments = [];
    for (var i = 0; i < numsegments; i++) {
      this.segments.push({
        x: this.x - i * this.directions[direction][0],
        y: this.y - i * this.directions[direction][1]
      });
    }

    this.prevSegments = this._cloneSegments(this.segments);
  };

  Snake.prototype._cloneSegments = function (segs) {
    var out = [];
    for (var i = 0; i < segs.length; i++) out.push({ x: segs[i].x, y: segs[i].y });
    return out;
  };

  Snake.prototype.grow = function () {
    this.growsegments++;
  };

  Snake.prototype.nextMove = function () {
    return {
      x: this.x + this.directions[this.direction][0],
      y: this.y + this.directions[this.direction][1]
    };
  };

  Snake.prototype.stepMove = function () {
    this.prevSegments = this._cloneSegments(this.segments);

    var nextmove = this.nextMove();
    this.x = nextmove.x;
    this.y = nextmove.y;

    var lastseg = this.segments[this.segments.length - 1];
    var growx = lastseg.x;
    var growy = lastseg.y;

    for (var i = this.segments.length - 1; i >= 1; i--) {
      this.segments[i].x = this.segments[i - 1].x;
      this.segments[i].y = this.segments[i - 1].y;
    }

    if (this.growsegments > 0) {
      this.segments.push({ x: growx, y: growy });
      this.growsegments--;
      this.prevSegments.push({ x: growx, y: growy });
    }

    this.segments[0].x = this.x;
    this.segments[0].y = this.y;
  };

  var snake = new Snake();
  var level = null;

  // Game state
  var score = 0;
  var gameover = true;
  var gameovertime = 1;
  var gameoverdelay = 0.5;

  // Messaging
  var sentFinal = false;
  var lastProgressSentScore = -1;

  function canSendSessionScore() {
    return !!(sessionContext.sessionId && sessionContext.sessionNonce);
  }

  function sendScore(final) {
    try {
      if (!window.parent || window.parent === window) return;
      if (!canSendSessionScore()) {
        console.warn("[Snake] Missing sessionId/sessionNonce; score not posted.");
        return;
      }

      window.parent.postMessage(
        {
          type: "SCORE",
          score: score,
          final: !!final,
          game: sessionContext.gameSlug || "snake",
          sessionId: sessionContext.sessionId,
          sessionNonce: sessionContext.sessionNonce
        },
        window.location.origin
      );
    } catch (e) {
      console.error("[Snake] SCORE postMessage failed", e);
    }
  }

  // Responsive sizing
  var dpr = 1;
  function setupCanvasAndLevel() {
    dpr = window.devicePixelRatio || 1;
    var vw = Math.max(1, window.innerWidth);
    var vh = Math.max(1, window.innerHeight);

    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = false;

    var tile = Math.floor(Math.min(vw / 22, vh / 16));
    tile = Math.max(18, Math.min(tile, 40));

    var cols = Math.floor(vw / tile);
    var rows = Math.floor(vh / tile);

    cols = Math.max(cols, 14);
    rows = Math.max(rows, 12);

    level = new Level(cols, rows, tile, tile);
    level.generate();

    var sx = Math.floor(cols / 2);
    var sy = Math.floor(rows / 2);

    snake.init(sx, sy, 1, 9, 4);

    score = 0;
    sentFinal = false;
    lastProgressSentScore = -1;
    addApple();
    gameover = true;
    gameovertime = 1;
  }

  window.addEventListener("resize", function () {
    setupCanvasAndLevel();
  });

  function addApple() {
    var valid = false;
    while (!valid) {
      var ax = randRange(1, level.columns - 2);
      var ay = randRange(1, level.rows - 2);

      var overlap = false;
      for (var i = 0; i < snake.segments.length; i++) {
        if (ax === snake.segments[i].x && ay === snake.segments[i].y) {
          overlap = true;
          break;
        }
      }

      if (!overlap && level.tiles[ax][ay] === 0) {
        level.tiles[ax][ay] = 2;
        valid = true;
      }
    }
  }

  function init() {
    images = loadImages(["snake-graphics.png"]);
    tileimage = images[0];

    canvas.addEventListener("mousedown", onMouseDown);
    installTouchControls();
    document.addEventListener("keydown", onKeyDown, { passive: false });

    setupCanvasAndLevel();
    main(0);
  }

  function tryNewGame() {
    if (gameovertime > gameoverdelay) {
      newGame();
      gameover = false;
    }
  }

  function newGame() {
    level.generate();
    score = 0;
    sentFinal = false;
    lastProgressSentScore = -1;

    var sx = Math.floor(level.columns / 2);
    var sy = Math.floor(level.rows / 2);
    snake.init(sx, sy, 1, 9, 4);

    addApple();
    gameover = false;
  }

  function main(tframe) {
    window.requestAnimationFrame(main);

    if (!initialized) {
      context.clearRect(0, 0, canvas.width, canvas.height);

      var vw = window.innerWidth;
      var vh = window.innerHeight;

      var loadpercentage = loadtotal ? loadcount / loadtotal : 0;
      context.strokeStyle = "#ff8080";
      context.lineWidth = 3;
      context.strokeRect(18.5, vh - 51, vw - 37, 32);
      context.fillStyle = "#ff8080";
      context.fillRect(18.5, vh - 51, loadpercentage * (vw - 37), 32);

      var loadtext = "Loaded " + loadcount + "/" + loadtotal + " images";
      context.fillStyle = "#ffffff";
      context.font = "16px Verdana";
      context.fillText(loadtext, 18, vh - 63);

      if (preloaded) initialized = true;
      return;
    }

    update(tframe);
    render();
  }

  function update(tframe) {
    var dt = (tframe - lastframe) / 1000;
    lastframe = tframe;

    if (dt > 0.08) dt = 0.08;
    if (dt < 0) dt = 0;

    updateFps(dt);

    if (!gameover) updateGame(dt);
    else gameovertime += dt;
  }

  function updateGame(dt) {
    var maxmovedelay = 1 / snake.speed;
    snake.movedelay += dt;

    while (snake.movedelay >= maxmovedelay) {
      var next = snake.nextMove();
      var nx = next.x;
      var ny = next.y;

      if (nx < 0 || nx >= level.columns || ny < 0 || ny >= level.rows || level.tiles[nx][ny] === 1) {
        gameover = true;
        gameovertime = 0;
        if (!sentFinal) {
          sentFinal = true;
          sendScore(true);
        }
        break;
      }

      for (var i = 0; i < snake.segments.length; i++) {
        if (nx === snake.segments[i].x && ny === snake.segments[i].y) {
          gameover = true;
          gameovertime = 0;
          if (!sentFinal) {
            sentFinal = true;
            sendScore(true);
          }
          break;
        }
      }
      if (gameover) break;

      snake.stepMove();

      if (level.tiles[nx][ny] === 2) {
        level.tiles[nx][ny] = 0;
        addApple();
        snake.grow();
        score++;
      }

      snake.movedelay -= maxmovedelay;
    }
  }

  function updateFps(dt) {
    if (fpstime > 0.25) {
      fps = Math.round(framecount / fpstime);
      fpstime = 0;
      framecount = 0;
    }
    fpstime += dt;
    framecount++;
  }

  function render() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    context.fillStyle = "#577ddb";
    context.fillRect(0, 0, vw, vh);

    drawLevel();
    drawSnake();

    context.fillStyle = "rgba(0,0,0,0.35)";
    context.fillRect(12, 12, 140, 34);
    context.fillStyle = "#fff";
    context.font = "18px Verdana";
    context.fillText("Score: " + score, 22, 36);

    if (gameover) {
      context.fillStyle = "rgba(0, 0, 0, 0.55)";
      context.fillRect(0, 0, vw, vh);

      context.fillStyle = "#ffffff";
      context.font = "26px Verdana";
      drawCenterText("Tap / Press any key to start", 0, vh / 2, vw);

      context.font = "16px Verdana";
      drawCenterText("Swipe or Arrow Keys to move", 0, vh / 2 + 34, vw);
    }
  }

  function drawLevel() {
    for (var i = 0; i < level.columns; i++) {
      for (var j = 0; j < level.rows; j++) {
        var tile = level.tiles[i][j];
        var tilex = i * level.tilewidth;
        var tiley = j * level.tileheight;

        if (tile === 0) {
          context.fillStyle = "#f7e697";
          context.fillRect(tilex, tiley, level.tilewidth, level.tileheight);
        } else if (tile === 1) {
          context.fillStyle = "#bcae76";
          context.fillRect(tilex, tiley, level.tilewidth, level.tileheight);
        } else if (tile === 2) {
          context.fillStyle = "#f7e697";
          context.fillRect(tilex, tiley, level.tilewidth, level.tileheight);

          var tx = 0, ty = 3, tilew = 64, tileh = 64;
          context.drawImage(
            tileimage,
            tx * tilew, ty * tileh, tilew, tileh,
            tilex, tiley, level.tilewidth, level.tileheight
          );
        }
      }
    }
  }

  function drawSnake() {
    for (var i = 0; i < snake.segments.length; i++) {
      var segment = snake.segments[i];
      var segx = segment.x;
      var segy = segment.y;

      var tilex = segx * level.tilewidth;
      var tiley = segy * level.tileheight;

      var tx = 0;
      var ty = 0;

      if (i === 0) {
        var nseg = snake.segments[i + 1];
        if (nseg) {
          if (segy < nseg.y) { tx = 3; ty = 0; }
          else if (segx > nseg.x) { tx = 4; ty = 0; }
          else if (segy > nseg.y) { tx = 4; ty = 1; }
          else if (segx < nseg.x) { tx = 3; ty = 1; }
        }
      } else if (i === snake.segments.length - 1) {
        var pseg = snake.segments[i - 1];
        if (pseg) {
          if (pseg.y < segy) { tx = 3; ty = 2; }
          else if (pseg.x > segx) { tx = 4; ty = 2; }
          else if (pseg.y > segy) { tx = 4; ty = 3; }
          else if (pseg.x < segx) { tx = 3; ty = 3; }
        }
      } else {
        var p = snake.segments[i - 1];
        var n = snake.segments[i + 1];
        if (p && n) {
          if ((p.x < segx && n.x > segx) || (n.x < segx && p.x > segx)) { tx = 1; ty = 0; }
          else if ((p.x < segx && n.y > segy) || (n.x < segx && p.y > segy)) { tx = 2; ty = 0; }
          else if ((p.y < segy && n.y > segy) || (n.y < segy && p.y > segy)) { tx = 2; ty = 1; }
          else if ((p.y < segy && n.x < segx) || (n.y < segy && p.x < segx)) { tx = 2; ty = 2; }
          else if ((p.x > segx && n.y < segy) || (n.x > segx && p.y < segy)) { tx = 0; ty = 1; }
          else if ((p.y > segy && n.x > segx) || (n.y > segy && p.x > segx)) { tx = 0; ty = 0; }
        }
      }

      context.drawImage(
        tileimage,
        tx * 64, ty * 64, 64, 64,
        tilex, tiley,
        level.tilewidth, level.tileheight
      );
    }
  }

  function drawCenterText(text, x, y, width) {
    var textdim = context.measureText(text);
    context.fillText(text, x + (width - textdim.width) / 2, y);
  }

  function randRange(low, high) {
    return Math.floor(low + Math.random() * (high - low + 1));
  }

  function onMouseDown(e) {
    if (gameover) {
      tryNewGame();
    } else {
      snake.direction = (snake.direction + 1) % snake.directions.length;
    }
  }

  function onKeyDown(e) {
    if ([37, 38, 39, 40].indexOf(e.keyCode) !== -1) e.preventDefault();

    if (gameover) {
      tryNewGame();
      return;
    }

    if (e.keyCode === 37 || e.keyCode === 65) {
      if (snake.direction !== 1) snake.direction = 3;
    } else if (e.keyCode === 38 || e.keyCode === 87) {
      if (snake.direction !== 2) snake.direction = 0;
    } else if (e.keyCode === 39 || e.keyCode === 68) {
      if (snake.direction !== 3) snake.direction = 1;
    } else if (e.keyCode === 40 || e.keyCode === 83) {
      if (snake.direction !== 0) snake.direction = 2;
    }

    if (e.keyCode === 32) snake.grow();
  }

  function installTouchControls() {
    var startX = 0, startY = 0;
    var active = false;
    var THRESH = 22;

    function onStart(e) {
      var t = e.touches && e.touches[0];
      if (!t) return;
      active = true;
      startX = t.clientX;
      startY = t.clientY;
    }

    function onMove(e) {
      if (!active) return;
      var t = e.touches && e.touches[0];
      if (!t) return;

      var dx = t.clientX - startX;
      var dy = t.clientY - startY;

      if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESH) return;

      active = false;

      if (gameover) {
        tryNewGame();
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && snake.direction !== 3) snake.direction = 1;
        else if (dx < 0 && snake.direction !== 1) snake.direction = 3;
      } else {
        if (dy > 0 && snake.direction !== 0) snake.direction = 2;
        else if (dy < 0 && snake.direction !== 2) snake.direction = 0;
      }

      e.preventDefault();
    }

    function onEnd() { active = false; }

    canvas.addEventListener("touchstart", onStart, { passive: true });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    canvas.addEventListener("touchend", onEnd, { passive: true });
  }

  console.log("[Snake] Session context:", sessionContext);
  init();
};