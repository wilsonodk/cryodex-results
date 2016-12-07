const models = require('../models'),
    Caching = require('caching'),
    express = require('express'),
    router = express.Router();

const cacheType = process.env.CACHE_TYPE || 'memory',
    cache = new Caching(cacheType),
    ttl = process.env.TTL || 1000 * 60 * 5;

function getRoundLabel(type, num) {
    if (type === 'swiss') {
        return `Round ${num}`;
    } else if (type === 'elimination') {
        switch (num) {
            case '8':
            case 8:
                return 'Quarterfinals'; break;
            case '4':
            case 4:
                return 'Semifinals'; break;
            case '2':
            case 2:
                return 'Finals'; break;
        }
    } else {
        return `${type} ${num}`
    }
}

function uniqueRounds(matches) {
    let rounds = [], arr = matches.filter(item => {
        if (!rounds.includes(item.label)) {
            rounds.push(item.label);
            return true;
        } else {
            return false;
        }
    });

    return arr;
}

router.post('/results', (req, res, next) => {
    let results = req.body,
        p = 0, m = 0

    models.sequelize.transaction(t => {
        let calls = [];

        // Remove all players and matches
        calls.push(models.Player.destroy({ where: { id: { $gt: 0 } } }));
        calls.push(models.Match.destroy({ where: { id: { $gt: 0 } } }));

        // Add players
        if (results.players) {
            results.players.forEach(player => {
                let temp = models.Player.create({
                        name: player.name,
                        path: encodeURIComponent(player.name),
                        mov: player.mov,
                        score: player.score,
                        sos: player.sos,
                        rank: player.rank.swiss
                    }, {transaction: t});

                calls.push(temp);
                p++;
            });
        }

        // Add matches
        if (results.rounds) {
            results.rounds.forEach(round => {
                let table = 1;
                round.matches.forEach(match => {
                    let temp = models.Match.create({
                            label:         getRoundLabel(round['round-type'], round['round-number']),
                            roundType:     round['round-type'],
                            roundNumber:   round['round-number'],
                            table:         table,
                            player1:       match.player1,
                            player1points: match.player1points,
                            player2:       match.player2,
                            player2points: match.player2points
                        }, {transaction: t});

                    table++;
                    calls.push(temp);
                    m++;
                });
            });
        }
        return Promise.all(calls);

    })
    .then(result => {
        cache.store.remove('*');
        res.send(`RESULTS: Added ${p} players. Added ${m} matches.`);
    })
    .catch(err => {
        console.error('/results transaction error');
        console.error(err);
        res.status(500);
        res.send('/results transaction error');
    });
});

router.get('/', (req, res, next) => {
    cache('index', ttl,
        (passAlong) => {
            // run if nothing in cache
            models.Player.findAll({})
                .then(players => {
                    passAlong(null, players);
                })
                .catch(err => {
                    passAlong(err, null);
                });
        },
        (err, results) => {
            // results from cache
            if (err) {
                console.error('/ player findAll error');
                console.error(err);
                next(err);
            } else {
                res.render('index', {players: results});
            }
        }
    );
});

router.get('/rounds/:type', (req, res, next) => {
    let type = req.params.type.toLowerCase() || 'swiss',
        key = `round-${type}`;

    cache(key, ttl,
        (passAlong) => {
            // stuff if nothing in cache
            models.Match.findAll({
                    attributes: ['label', 'roundType', 'roundNumber', 'updatedAt'],
                    where: { roundType: type },
                    order: [ ['roundNumber', 'DESC'] ]
                })
                .then(matches => {
                    if (matches.length === 0) {
                        return passAlong({code: 404, type: 'Match Type'}, null);
                    }

                    let rounds = uniqueRounds(matches);

                    passAlong(null, rounds);
                })
                .catch(err => {
                    passAlong(err, null);
                });
        },
        (err, results) => {
            // results from cache
            if (err && err.code && err.type) {
                // 404s?
                res.status(404).render('404', {type: 'Match Type'});
            } else if (err) {
                // "normal errors"
                console.error('/rounds/:type match findAll error');
                console.error(err);
                next(err);
            } else {
                let title = type === 'swiss' ? 'Swiss' : 'Single Elimination'
                res.render('matches', {title: title, rounds: results});
            }
        }
    );
});

router.get('/round/:type/:num', (req, res, next) => {
    let type = req.params.type || 'swiss',
        num = req.params.num  || 1,
        key = `round-${type}-${num}`;

    cache(key, ttl,
        (passAlong) => {
            // do this stuff if nothing in cache
            models.Match.findAll({ where: { roundType: type, roundNumber: num } })
                .then(matches => {
                    if (matches.length === 0) {
                        return passAlong({code: 404, type: 'Match Type'}, null);
                    }

                    passAlong(null, matches);
                })
                .catch(err => {
                    passAlong(err, null);
                });
        },
        (err, results) => {
            // do something with the results from cache
            if (err && err.code && err.type) {
                res.status(404).render('404', {type: 'Round'});
            } else if (err) {
                console.error('/round/:type/:num match findAll error');
                console.error(err);
                next(err);
            } else {
                res.render('rounds', {matches: results});
            }
        }
    );
});

router.get('/player/:player', (req, res, next) => {
    let name = req.params.player || 'no-name',
        key = `player-${name}`;

    cache(key, ttl,
        (passAlong) => {
            // do this if nothing in cache
            models.Player.findAll({ where: { name: name } })
                .then(player => {
                    if (player.length === 0) {
                        return passAlong({code: 404, type: 'Match Type'}, null);
                    }
                    player = player[0];

                    models.Match.findAll({ where: { $or: [{player1: name}, {player2: name}] } })
                        .then(matches => {
                            passAlong(null, {
                                player: player,
                                matches: matches
                            });
                        })
                        .catch(err => {
                            passAlong(err, null);
                        });
                })
                .catch(err => {
                    passAlong(err, null);
                });
        },
        (err, results) => {
            // do something with results from cache
            if (err && err.code && err.type) {
                res.status(404).render('404', {type: 'Player'});
            } else if (err) {
                console.error('/player/:player player/match findAll error');
                console.error(err);
                next(err);
            } else {
                res.render('player', results);
            }
        }
    );
});

module.exports = router;
