const models = require('../models'),
    ttl = process.env.TTL || 60 * 5, // default 5m
    redisUrl = process.env.REDISTOGO_URL || '',
    cache = require('express-redis-cache')({
        client: require('redis').createClient(redisUrl),
        expire: {
            200: ttl,
            '4xx': 10,
            '5xx': 10,
            'xxx': 1
        }
    }),
    express = require('express'),
    router = express.Router();

let lastPayload = {};

function getRoundLabel(type, num) {
    if (type === 'swiss') {
        return `Round ${num}`;
    } else if (type === 'elimination') {
        switch (num) {
            case '32':
            case 32:
                return 'Top 32'; break;
            case '16':
            case 16:
                return 'Sweet Sixteen'; break;
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

router.get('/results', (req, res) => {
    res.json(lastPayload);
});

router.post('/results', (req, res, next) => {
    let results = req.body,
        p = 0, m = 0

    lastPayload = results;

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
        cache.del('*', (err, num) => {
            if (err) {
                return next(err);
            }
            res.send(`RESULTS: Added ${p} players. Added ${m} matches. Deleted ${num} cached entries.`);
        });
    })
    .catch(err => {
        console.error('/results transaction error');
        console.error(err);
        res.status(500);
        res.send('/results transaction error');
    });
});

router.get('/', cache.route(), (req, res, next) => {
    models.Player.findAll({})
        .then(results => {
            res.render('index', {players: results});
        })
        .catch(err => {
            console.error('/ player findAll error');
            console.error(err);
            next(err);
        });
});

router.get('/rounds/:type', cache.route(), (req, res, next) => {
    let type = req.params.type.toLowerCase() || 'swiss';

    models.Match.findAll({
            attributes: ['label', 'roundType', 'roundNumber', 'updatedAt'],
            where: { roundType: type },
            order: [ ['roundNumber', 'DESC'] ]
        })
        .then(results => {
            if (results.length === 0) {
                return res.status(404).render('404', {type: 'Match Type'});
            }

            let rounds = uniqueRounds(results),
                title = type === 'swiss' ? 'Swiss' : 'Single Elimination';

            res.render('matches', {title: title, rounds: rounds});
        })
        .catch(err => {
            console.error('/rounds/:type match findAll error');
            console.error(err);
            next(err);
        });
});

router.get('/round/:type/:num', cache.route(), (req, res, next) => {
    let type = req.params.type || 'swiss',
        num = req.params.num  || 1;

    models.Match.findAll({ where: { roundType: type, roundNumber: num } })
        .then(results => {
            if (results.length === 0) {
                return res.status(404).render('404', {type: 'Round'});
            }

            res.render('rounds', {matches: results});
        })
        .catch(err => {
            console.error('/round/:type/:num match findAll error');
            console.error(err);
            next(err);
        });
});

router.get('/player/:player', cache.route(), (req, res, next) => {
    let name = req.params.player || 'no-name';

    models.Player.findAll({ where: { name: name } })
        .then(players => {
            if (players.length === 0) {
                return res.status(404).render('404', {type: 'Player'});
            }
            let player = players[0];

            models.Match.findAll({ where: { $or: [{player1: name}, {player2: name}] } })
                .then(matches => {
                    let results = {
                            player: player,
                            matches: matches
                        };

                    res.render('player', results);
                })
                .catch(err => {
                    console.error('/player/:player match findAll error');
                    console.error(err);
                    next(err);
                });
        })
        .catch(err => {
            console.error('/player/:player player findAll error');
            console.error(err);
            next(err);
        });
});

module.exports = router;
