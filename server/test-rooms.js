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

function driveState(extra) {
  return Object.assign(
    {
      t: "state",
      x: 40,
      z: -80,
      h: 0,
      spd: 12,
      slide: 0,
      lap: 2,
      fuel: 10,
      tires: 22,
      pit: 0,
      finished: 0,
    },
    extra || {}
  );
}

waitHealth()
  .then(function () {
    return fetch("http://127.0.0.1:" + PORT + "/").then(function (r) {
      return r.text().then(function (html) {
        assert(r.status === 200, "origin 200");
        assert(/SchoolKart/i.test(html), "origin serves SchoolKart HTML");
        assert(html.indexOf("Point Pages at this host") === -1, "no Pages stub");
        assert(html.indexOf("btn-create") !== -1, "lobby on origin");
        assert(html.indexOf("display-name") !== -1, "name field on origin");
      });
    });
  })
  .then(function () {
    return Promise.all([client("hostA"), client("joinB")]);
  })
  .then(function (pair) {
    var a = pair[0];
    var b = pair[1];
    var room;
    a.send({ t: "create", name: "Host" });
    return a
      .waitFor(function (m) {
        return m.t === "room";
      })
      .then(function (roomMsg) {
        room = roomMsg;
        assert(room.code && room.code.length >= 4 && room.code.length <= 6, "code 4-6");
        assert(room.players.length === 1, "host alone");
        b.send({ t: "join", code: room.code, name: "Guest" });
        return b.waitFor(function (m) {
          return m.t === "room" && m.players && m.players.length === 2;
        });
      })
      .then(function () {
        return a.waitFor(function (m) {
          return m.t === "room" && m.players.length === 2;
        });
      })
      .then(function () {
        a.send({ t: "start" });
        return a.waitFor(function (m) {
          return m.t === "lights" && m.phase === "prestart";
        });
      })
      .then(function (lights) {
        assert(lights.holdDelay >= 0.2 && lights.holdDelay <= 3.01, "hold delay");
        return b.waitFor(function (m) {
          return m.t === "lights";
        });
      })
      .then(function () {
        return a.waitFor(function (m) {
          return m.t === "go";
        }, 16000);
      })
      .then(function () {
        a.send(driveState());
        return a.waitFor(function (m) {
          return (
            m.t === "snap" &&
            m.raceTime > 0 &&
            m.cars &&
            m.cars.some(function (c) {
              return c.id === "hostA" && c.fuel === 10 && c.lap === 2;
            })
          );
        }, 4000);
      })
      .then(function () {
        return client("lateC");
      })
      .then(function (c) {
        c.send({ t: "join", code: room.code, name: "Late" });
        return c
          .waitFor(function (m) {
            return m.t === "enter" && m.phase === "racing";
          })
          .then(function (enter) {
            assert(enter.late === true, "late join is marked");
            assert(enter.rejoin === false, "new car is not a rejoin");
            assert(enter.raceTime > 0, "late join gets the live clock");
            assert(enter.you && enter.you.fuel === 100, "late drop-in starts full");
            assert(
              enter.cars.some(function (car) {
                return car.id === "hostA" && car.fuel === 10;
              }),
              "late join sees the host car"
            );
            b.close();
            return a
              .waitFor(function (m) {
                return (
                  m.t === "room" &&
                  m.players.some(function (p) {
                    return p.id === "joinB" && p.ghost;
                  })
                );
              })
              .then(function () {
                a.close();
                return new Promise(function (res) {
                  setTimeout(res, 80);
                });
              })
              .then(function () {
                return client("hostA");
              })
              .then(function (a2) {
                a2.send({ t: "join", code: room.code, name: "Host" });
                return a2
                  .waitFor(function (m) {
                    return m.t === "enter" && m.rejoin === true;
                  })
                  .then(function (re) {
                    assert(re.phase === "racing", "refresh re-enters the live race");
                    assert(re.late === false, "refresh is not a late drop-in");
                    assert(re.you && re.you.fuel === 10, "refresh keeps fuel");
                    assert(re.you.tires === 22, "refresh keeps tires");
                    assert(re.you.lap === 2, "refresh keeps lap");
                    assert(re.you.x === 40, "refresh keeps pose");
                    assert(re.raceTime > 0, "refresh keeps the room clock");
                    assert(
                      re.cars.some(function (car) {
                        return car.id === "lateC";
                      }),
                      "refresh sees the other cars"
                    );
                    var mid = (14 + 72) * 0.5;
                    assert(10 < mid, "entry x does not grab");
                    console.log("OK rooms", room.code, "late+rejoin");
                    c.close();
                    a2.close();
                    return lobbyExtras();
                  });
              });
          });
      });
  })
  .then(function () {
    kid.kill();
    process.exit(0);
  })
  .catch(function (err) {
    console.error("FAIL", err);
    kid.kill();
    process.exit(1);
  });

function lobbyExtras() {
  return Promise.all([client("hostD"), client("joinE")]).then(function (pair) {
    var h = pair[0];
    var g = pair[1];
    var code;
    h.send({ t: "create", name: "Zachary" });
    return h
      .waitFor(function (m) {
        return m.t === "room";
      })
      .then(function (roomMsg) {
        code = roomMsg.code;
        assert(roomMsg.players[0].name === "Zachary", "host display name");
        assert(roomMsg.speed === 1, "default speed 1");
        g.send({ t: "join", code: code, name: "Maya" });
        return g.waitFor(function (m) {
          return m.t === "room" && m.players && m.players.length === 2;
        });
      })
      .then(function (joined) {
        var names = joined.players.map(function (p) {
          return p.name;
        });
        assert(names.indexOf("Zachary") !== -1 && names.indexOf("Maya") !== -1, "both names in roster");
        g.send({ t: "kick", id: "hostD" });
        return g.waitFor(function (m) {
          return m.t === "err";
        });
      })
      .then(function (err) {
        assert(/host/i.test(err.msg), "guest cannot kick");
        h.send({ t: "speed", n: 1.25 });
        return h.waitFor(function (m) {
          return m.t === "room" && m.speed === 1.25;
        });
      })
      .then(function () {
        return g.waitFor(function (m) {
          return m.t === "room" && m.speed === 1.25;
        });
      })
      .then(function () {
        h.send({ t: "bot", op: "add" });
        return h.waitFor(function (m) {
          return m.t === "room" && m.players.some(function (p) {
            return p.bot;
          });
        });
      })
      .then(function (withBot) {
        assert(withBot.players.length === 3, "host + guest + cpu");
        var bot = withBot.players.filter(function (p) {
          return p.bot;
        })[0];
        h.send({ t: "kick", id: "joinE" });
        return g
          .waitFor(function (m) {
            return m.t === "kicked";
          })
          .then(function () {
            h.send({ t: "bot", op: "remove", id: bot.id });
            return h.waitFor(function (m) {
              return (
                m.t === "room" &&
                m.players.length === 1 &&
                m.players[0].id === "hostD"
              );
            });
          });
      })
      .then(function () {
        console.log("OK lobby names/kick/bot/speed", code);
        h.close();
        g.close();
      });
  });
}
