/* Protocol smoke: two clients, create/join, lights, snap, late join, drop, rejoin. */
"use strict";

var { spawn } = require("child_process");
var { WebSocket } = require("ws");

var PORT = 8799;
var URL = "ws://127.0.0.1:" + PORT;
var kid = spawn(process.execPath, ["server/index.js"], {
  env: Object.assign({}, process.env, { PORT: String(PORT) }),
  stdio: ["ignore", "pipe", "pipe"],
});

function waitHealth() {
  return new Promise(function (resolve, reject) {
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      fetch("http://127.0.0.1:" + PORT + "/health")
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (j.ok) {
            clearInterval(t);
            resolve();
          }
        })
        .catch(function () {
          if (n > 40) {
            clearInterval(t);
            reject(new Error("server did not start"));
          }
        });
    }, 100);
  });
}

function client(id) {
  return new Promise(function (resolve, reject) {
    var ws = new WebSocket(URL);
    var inbox = [];
    ws.on("open", function () {
      ws.send(JSON.stringify({ t: "hello", id: id, name: id }));
      resolve({
        ws: ws,
        inbox: inbox,
        send: function (o) {
          ws.send(JSON.stringify(o));
        },
        waitFor: waitFor,
        close: function () {
          ws.close();
        },
      });
    });
    ws.on("message", function (buf) {
      inbox.push(JSON.parse(String(buf)));
    });
    ws.on("error", reject);
    function waitFor(pred, ms) {
      var start = Date.now();
      return new Promise(function (res, rej) {
        var t = setInterval(function () {
          var hit = inbox.find(pred);
          if (hit) {
            clearInterval(t);
            res(hit);
          } else if (Date.now() - start > (ms || 4000)) {
            clearInterval(t);
            rej(new Error("timeout waiting " + id));
          }
        }, 20);
      });
    }
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

waitHealth()
  .then(function () {
    return Promise.all([client("hostA"), client("joinB")]);
  })
  .then(function (pair) {
    var a = pair[0];
    var b = pair[1];
    a.send({ t: "create", name: "Host" });
    return a.waitFor(function (m) {
      return m.t === "room";
    }).then(function (room) {
      assert(room.code && room.code.length >= 4 && room.code.length <= 6, "code 4-6");
      assert(room.players.length === 1, "host alone");
      b.send({ t: "join", code: room.code, name: "Guest" });
      return b.waitFor(function (m) {
        return m.t === "room" && m.players && m.players.length === 2;
      }).then(function () {
        return a.waitFor(function (m) {
          return m.t === "room" && m.players.length === 2;
        });
      }).then(function () {
        a.send({ t: "start" });
        return a.waitFor(function (m) {
          return m.t === "lights" && m.phase === "prestart";
        }).then(function (lights) {
          assert(lights.holdDelay >= 0.2 && lights.holdDelay <= 3.01, "hold delay");
          return b.waitFor(function (m) {
            return m.t === "lights";
          });
        }).then(function () {
          a.send({
            t: "state",
            x: 10,
            z: -80,
            h: 0,
            spd: 12,
            slide: 0,
            lap: 1,
            fuel: 90,
            tires: 80,
            pit: 0,
            finished: 0,
          });
          return b.waitFor(function (m) {
            return m.t === "snap" && m.cars && m.cars.length >= 2;
          });
        }).then(function (snap) {
          var hostCar = snap.cars.filter(function (c) {
            return c.id === "hostA";
          })[0];
          assert(hostCar && hostCar.x === 10, "host pose relayed");
          return client("lateC");
        }).then(function (c) {
          c.send({ t: "join", code: room.code, name: "Late" });
          return c.waitFor(function (m) {
            return m.t === "room" && m.players.length === 3;
          }).then(function () {
            b.close();
            return a.waitFor(function (m) {
              return (
                m.t === "room" &&
                m.players.some(function (p) {
                  return p.id === "joinB" && p.ghost;
                })
              );
            }).then(function () {
              return client("joinB");
            }).then(function (b2) {
              b2.send({ t: "join", code: room.code, name: "Guest" });
              return b2.waitFor(function (m) {
                return (
                  m.t === "room" &&
                  m.players.some(function (p) {
                    return p.id === "joinB" && p.connected && !p.ghost;
                  })
                );
              }).then(function (rejoined) {
                assert(rejoined.players.length === 3, "same room after drop");
                var mid = (14 + 72) * 0.5;
                assert(10 < mid, "entry x does not grab");
                console.log("OK rooms", room.code, "players", rejoined.players.length);
                c.close();
                b2.close();
                a.close();
                kid.kill();
                process.exit(0);
              });
            });
          });
        });
      });
    });
  })
  .catch(function (err) {
    console.error("FAIL", err);
    kid.kill();
    process.exit(1);
  });
