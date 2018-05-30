
var http = require('http');
var fs = require('fs');
var io = require('socket.io')();
var playerID = 1;
var clients = [];
var clientCount = 0;
var players = [];
var playerCount = 0;
var bullets = [];
var asteroids = [];
var screenSize = 800;

function reponse404(response) {
  response.writeHead(404, { 'Context-Type': 'text/plain' });
  response.write("Oh noes! 404 Page not found :( ");
  response.end();
}

function onRequest(request, response) {

  response.writeHead(200, { 'Context-Type': 'text/plain' });
  response.end(fs.readFileSync(__dirname + '/home.html'));
}

var server = http.createServer(onRequest).listen(9090);
console.log("server start...");

//broadcast to all clients every update
setInterval(function () {
  broadcastUpdate()
}, 25);

//when a client connects to the server...
io.listen(server).on('connection', function (socket) {

  //client has connected
  clientConnect(socket);

  //set up event handlers for the client
  socket.on('disconnect', function () { clientDisconnect(socket); });
  socket.on('message', function (data) { clientMessage(socket, data); });
  socket.on('input data', function (data) { clientInputData(socket, data); });
  socket.on('player name', function (name) { clientSetname(socket, name); });
  socket.on('join game', function (colour) { clientJoinGame(socket, colour); });
});

function isAlive(v) {
  return v.dead == false;
}

function broadcastUpdate() {

  var numeric_array = [];
  for (var items in players) {
    if (players[items].dead == false)
      numeric_array.push(mapPlayerForClient(players[items]));
  }

  var data = {
    player: numeric_array,
    bullet: bullets.filter(isAlive).map(function (b) {
      return {
        position: b.position,
        rotation: b.rotation
      }
    }),
    asteroid: asteroids.filter(isAlive).map(function (a) {
      return {
        vertices: a.vertices.map(function (v) {
          return v.add(a.position);
        })
      }
    })
  }

  io.emit('player data', data);
}

var sock;
function clientSetname(socket, name) {
  clients[socket.id] = name;
}

function clientConnect(socket) {
  clientCount++;
  clients[socket.id] = '';
  console.log("client connected ");
}

function clientDisconnect(socket) {
  console.log("client disconnected " + clients[socket.id] + "  " + socket.id);
  delete clients[socket.id];
  delete players[socket.id];
  clientCount--;
}

function clientMessage(socket, msg) {
  socket.broadcast.emit('message', clients[socket.id].name + " : " + msg, clients[socket.id].colour);
}

function clientJoinGame(socket) {
  console.log(clients[socket.id].name + " joined game ");
  players[socket.id] = new splayer(clients[socket.id].name, clients[socket.id].colour);
  sock = socket.id;
}

function clientInputData(socket, data) {
  var p = players[socket.id];
  if (p) players[socket.id].actions = data;
}

//todo- simulate as fast as possible, calculate this as delta time.
var timeStep = 16.66666 / 1000;

function splayer(p_name, p_colour) {
  return {
    actions: 0,
    name: p_name,
    colour: p_colour || colour(),
    position: new vector2(100, 100),
    rotation: 0,
    velocity: new vector2(),
    acceleration: new vector2(),
    forward: new vector2(-1, 0),
    maxSpeed: 20,
    turnRate: 20,
    rotation: 0,
    accelRate: 100,
    drag: 10, //drag in sace??!,
    shootCd: 5,
    shootCdRemaining: 0,
    dead: false,
    immuneTimeRemaining: 5,
    //un-transformed vertices. Transformed by rotation and position, which are stored in mappedVertices
    vertices: [
      vector2(- 15, 0),
      vector2(15, 15),
      vector2(7, 0),
      vector2(15, - 15)
    ],
    mappedVertices: [],
    interpolate: function () {
      var that = this;

      if (this.immuneTimeRemaining > 0)
        this.immuneTimeRemaining -= timeStep;

      this.shootCdRemaining -= timeStep;
      this.position = this.position.add(this.velocity.multiply(vector2(timeStep, timeStep)));
      this.velocity = this.velocity.add(this.acceleration.multiply(vector2(timeStep, timeStep)));


      if (this.velocity.magnitude() > this.maxSpeed) {
        this.velocity = this.velocity.normalise()
          .multiply(vector2(this.maxSpeed, this.maxSpeed));
      }

      //pre calc here so dont have to do trig calcs twice per vertex
      var rads = this.rotation * 0.0174532925;
      var s = Math.sin(rads);
      var c = Math.cos(rads);

      this.mappedVertices = this.vertices.map(function (v) {
        return new vector2(v.x, v.y).rotate(vector2(0, 0), that.rotation, s, c).add(that.position);
      });

      //handle player leaving screen.
      if (this.position.x < 0) {
        this.position.x = screenSize;
      }
      else if (this.position.x > screenSize) {
        this.position.x = 0;
      }
      if (this.position.y < 0) {
        this.position.y = screenSize;
      }
      else if (this.position.y > screenSize) {
        this.position.y = 0;
      }

    },
    resolveActions: function () {
      a = this.actions;
      if (a & action.forward) {
        this.acceleration = this.forward.multiply(
          vector2(this.accelRate * timeStep, this.accelRate * timeStep)
        );
      }
      else {
        this.acceleration = new vector2();
      }

      if (a & action.left || a & action.right) {

        if (a & action.left) {
          this.rotation -= this.turnRate * timeStep;
        } else if (a & action.right) {
          this.rotation += this.turnRate * timeStep;
        }

        this.forward = vector2(-1, 0).rotate(new vector2(), this.rotation);
        this.forward = this.forward.normalise();
      }

      //shoot
      if (a & action.shoot) {
        this.shoot();
      }
    },
    shoot() {

      if (this.shootCdRemaining <= 0) {

        this.shootCdRemaining = this.shootCd;

        var m = this.velocity.magnitude() * this.velocity.normalise().dot(this.forward);

        spawnBullet(this.position, this.forward, this.rotation, m > 0 ? m : 0);

      }
    },
    respawn: function () {
      this.dead = false;
      this.immuneTimeRemaining = 5;
      this.position = new vector2(Math.random() * screenSize, Math.random() * screenSize);
      this.forward = new vector2(0, 1);
      this.velocity = new vector2(0, 0);
      this.acceleration = new vector2(0, 0);
      this.rotation = 0;
    },
    die: function () {
      this.dead = true;
      io.emit('message', this.name + " died!", this.colour);
    }
  };
}

//send a light weight version of the player class to the client. Only what it needs to render
function mapPlayerForClient(player) {
  return {
    position: mapVec2ForClient(player.position),
    rotation: player.rotation,
    name: player.name,
    colour: player.colour,
    actions: player.actions,
    vertices: player.mappedVertices.map(function (v) {
      return mapVec2ForClient(v);
    })
  }
}

function bullet(pos, dir, rot, spe) {
  return {
    position: pos,
    direction: dir,
    rotation: rot,
    speed: spe,
    remainingTime: 30,
    dead: false,
    update: function () {

      if (this.dead) {
        return;
      }

      this.position = this.position.add(
        this.direction.multiply(vector2(this.speed * timeStep, this.speed * timeStep))
      );

      if (this.position.x < 0) {
        this.position.x = screenSize;
      }
      else if (this.position.x > screenSize) {
        this.position.x = 0;
      }
      if (this.position.y < 0) {
        this.position.y = screenSize;
      }
      else if (this.position.y > screenSize) {
        this.position.y = 0;
      }

      this.remainingTime -= timeStep;
      if (this.remainingTime <= 0) {
        this.dead = true;
      }

    }
  };
}

function asteroid(size, pos) {
  return {
    position: pos || getAsteroidStartPosition(),
    direction: new vector2(Math.random() * 2 - 1, Math.random() * 2 - 1).normalise(),
    size: size || 4 + ((Math.random() * 2) << 0),
    dead: false,
    speed: 5,
    rotation: 0,
    vertices: [],
    spin: (Math.random() * 2 - 1) * 0.1,
    rads: this.spin * 0.0174532925,
    s: Math.sin(this.rads),
    c: Math.cos(this.rads),
    getVerts: function () {

      var s = this.size * 10;
      this.vertices = [];
      this.vertices.push(new vector2(s, s * 0.5).subtract(this.getVertOffset()));
      this.vertices.push(new vector2(s, - s * 0.5).subtract(this.getVertOffset()));
      this.vertices.push(new vector2(s * 0.5, - s).subtract(this.getVertOffset()));
      this.vertices.push(new vector2(- s * 0.5, - s).subtract(this.getVertOffset()));
      this.vertices.push(new vector2(- s, - s * 0.5).subtract(this.getVertOffset()));
      this.vertices.push(new vector2(- s, s * 0.5).subtract(this.getVertOffset()));
      this.vertices.push(new vector2(- s * 0.5, s).subtract(this.getVertOffset()));
      this.vertices.push(new vector2(s * 0.5, s).subtract(this.getVertOffset()));

    },
    getVertOffset: function () {
      return new vector2(Math.random() * this.size * 6, Math.random() * this.size * 6);
    },
    update: function () {

      var that = this;

      if (this.dead) {
        return;
      }

      this.position = this.position.add(
        this.direction.multiply(vector2(this.speed * timeStep, this.speed * timeStep))
      );

      this.vertices = this.vertices.map(function (v) {
        return v.rotate(vector2(0, 0), that.spin, this.s, this.c);
      });

      if (this.position.x < 0) {
        this.position.x = screenSize;
      }
      else if (this.position.x > screenSize) {
        this.position.x = 0;
      }
      if (this.position.y < 0) {
        this.position.y = screenSize;
      }
      else if (this.position.y > screenSize) {
        this.position.y = 0;
      }
    },
    die: function () {
      this.dead = true;
      if (this.size > 1) {
        spawnAsteroid(this.size - 1, this.position);
        spawnAsteroid(this.size - 1, this.position);
      }
    }
  }
}

function getAsteroidStartPosition() {

  if (Math.random() >= 0.5) {
    var x = Math.random() * screenSize;
    var y;
    if (Math.random() >= 0.5) {
      y = 1;
    }
    else {
      y = screenSize - 1;
    }
    return new vector2(x, y);
  }

  var x;
  var y = Math.random() * screenSize;
  if (Math.random() >= 0.5) {
    x = 1;
  }
  else {
    x = screenSize - 1;
  }
  return new vector2(x, y);
}


function spawnBullet(pos, dir, rot, speed) {

  var b = null;
  for (bu in bullets) {
    if (bullet.dead) {
      b = bu;
      b.position = pos;
      b.direction = dir;
      b.rotation = rot;
      b.dead = false;
      b.speed = speed + 10
      break;
    }
  }

  if (b == null) {
    bullets.push(new bullet(pos, dir, rot, speed + 10));
  }

}

function spawnAsteroid(size, pos) {

  var a = null;
  for (var as in asteroids) {
    if (as.dead) {
      a = as;
      a.size = size;
      a.position = pos;
      a.direction = new vector2(Math.random() * 2 - 1, Math.random() * 2 - 1).normalise();
      a.dead = false;
      break;
    }
  }

  if (a == null) {
    a = new asteroid(size, pos);
    asteroids.push(a);
  }

  a.getVerts();

}

function pointInCircle(vars) {
  return vars.p.subtract(vars.c.p).magnitudeSqr() <= vars.c.r * vars.c.r;
}

//slightly modefied from
//http://stackoverflow.com/questions/11716268/point-in-polygon-algorithm
function pnpoly(nvert, verts, test) {
  var i, j, c = false;
  for (i = 0, j = nvert - 1; i < nvert; j = i++) {
    if (((verts[i].y > test.y) != (verts[j].y > test.y)) &&
      (test.x < (verts[j].x - verts[i].x) * (test.y - verts[i].y) / (verts[j].y - verts[i].y) + verts[i].x))
      c = !c;
  }
  return c;
}

function updateBullets() {

  for (var i = 0; i < bullets.length; i++) {
    bullets[i].update();
  }

}

function updateAsteroids() {

  for (var i = 0; i < asteroids.length; i++) {
    asteroids[i].update();
  }
}

function collisionChecks() {

  var bs = bullets.filter(isAlive);
  var as = asteroids.filter(isAlive);
  var ps = [];

  for (var items in players) {
    if (players[items].dead == false)
      ps.push(players[items]);
  }

  if (ps.length < 1) {
    gameStart();
  }

  //bullets vs asteroids
  for (var i = 0; i < bs.length; i++) {
    for (var j = 0; j < as.length; j++) {

      //broad phase
      //crude but fast check to see if objects are close to eachother
      if (pointInCircle({ p: bs[i].position, c: { p: as[j].position, r: 1.5 * (as[j].size * 10) } })) {

        //narrow phase
        //expensive check to see if close ofjects are touching
        if (pnpoly(8, as[j].vertices.map(function (e) {
          return new vector2(e.x, e.y).add(as[j].position);
        }), bs[i].position)) {

          //collision detected...
          as[j].die();
          bs[i].dead = true;
          return;
        }
      }
    }
  }

  //players vs asteroids
  for (var i = 0; i < ps.length; i++) {

    if (ps[i].immuneTimeRemaining > 0)
      continue;

    for (var j = 0; j < as.length; j++) {
      //broad phase
      //crude but fast check to see if objects are close to eachother
      if (pointInCircle({ p: ps[i].position, c: { p: as[j].position, r: 2.5 * (as[j].size * 10) } })) {
        //narrow phase
        //expensive check to see if close ofjects are touching
        for (var k = 0; k < 6; k++) {

          var vert;
          if (k <= 3) {
            vert = ps[i].mappedVertices[k];
          }
          else if (k == 4) {
            vert = ps[i].mappedVertices[1].subtract(ps[i].mappedVertices[0]).multiply(vector2(0.5, 0.5));
          }
          else {
            vert = ps[i].mappedVertices[3].subtract(ps[i].mappedVertices[0]).multiply(vector2(0.5, 0.5));
          }

          if (pnpoly(8, as[j].vertices.map(function (e) {
            return new vector2(e.x, e.y).add(as[j].position);
          }), vert)) {

            //collision detected...
            as[j].die();
            ps[i].die();
            return;
          }
        }
      }
    }
  }
}

function gameStart() {
  for (var items in players) {
    players[items].respawn();
    bullets = [];
    asteroids = [];
    for (var i = 0; i < 3; i++)
      spawnAsteroid();
  }
}

var lastUpdate = Date.now();
function serverGameLoop() {

  var now = Date.now();
  var timeStep = now - lastUpdate;
  lastUpdate = now;

  for (var item in players) {
    var p = players[item];
    p.resolveActions();
    p.interpolate();
  }

  updateBullets();

  updateAsteroids();

  collisionChecks();

  if (asteroids.filter(isAlive).length < 1) {
    for (var i = 0; i < 3; i++)
      spawnAsteroid();
  }
}

function vector2(xp, yp) {
  return {
    x: xp || 0,
    y: yp || 0,
    add: function (vec2) {
      return new vector2(this.x + vec2.x, this.y + vec2.y);
    },
    subtract: function (vec2) {
      return new vector2(this.x - vec2.x, this.y - vec2.y);
    },
    rotate: function (v, degrees, s, c) {
      var rads = s || degrees * 0.0174532925;
      var s = s || Math.sin(rads);
      var c = c || Math.cos(rads);

      var temp = new vector2(this.x, this.y);
      temp = temp.subtract(v);

      var tx = temp.x;
      var ty = temp.y;

      temp.x = (c * tx) - (s * ty);
      temp.y = (s * tx) + (c * ty);

      temp = temp.add(v);

      return temp;
    },
    inverse: function () {
      return new vector2(-this.x, -this.y);
    },
    multiply: function (vec2) {
      return new vector2(this.x * vec2.x, this.y * vec2.y);
    },
    magnitude: function () {
      return Math.sqrt((this.x * this.x) + (this.y * this.y));
    },
    magnitudeSqr: function () {
      return (this.x * this.x) + (this.y * this.y);
    },
    normalise: function () {
      var tx = this.x;
      var ty = this.y;
      var l = this.magnitude();
      tx /= l;
      ty /= l;
      return new vector2(tx, ty);
    },
    dot: function (v2) {

      return (this.x * v2.x) + (this.y * v2.y);
    }

  };
}

function mapVec2ForClient(vec2) {
  return { x: vec2.x, y: vec2.y }
}

var action = Object.freeze({
  none: 1,
  forward: 2,
  left: 4,
  right: 8,
  shoot: 16
});

setInterval(function () { serverGameLoop(); }, 0.1);
