const models = require('../models'),
    express = require('express'),
    router = express.Router();

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
    let results = req.body;

    // Clear out all the stuff
    models.sequelize.sync({force: true})
    .then(_ => {
        let p = 0, m = 0;

        models.sequelize.transaction(t => {
            let calls = [];

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
            res.send(`results: players? ${p} matches? ${m}`)
        })
        .catch(err => {
            console.error('/results transaction error');
            console.error(err);
            res.status(500);
            res.send('/results transaction error');
        });
    })
    .catch(err => {
        console.error('/results sync error')
        console.error(err);
        res.status(500);
        res.send('/results sync error')
    });
});

router.get('/', (req, res, next) => {
    models.Player.findAll({})
    .then(players => {
        res.render('index', {players: players});
    })
    .catch(err => {
        console.error('/ player findAll error');
        console.error(err);
        next(err);
    });
});

router.get('/rounds/:type', (req, res, next) => {
    let type = req.params.type.toLowerCase() || 'swiss';

    models.Match.findAll({
        attributes: ['label', 'roundType', 'roundNumber', 'updatedAt'],
        where: {
            roundType: type
        },
        order: [['roundNumber', 'DESC']]
    })
    .then(matches => {
        let title = type === 'swiss' ? 'Swiss' : 'Single Elimination',
            rounds = uniqueRounds(matches);

        res.render('matches', {title: title, rounds: rounds});
    })
    .catch(err => {
        console.error('/rounds/:type match findAll error');
        console.error(err);
        next(err);
    });
});

router.get('/round/:type/:num', (req, res, next) => {
    let type = req.params.type || 'swiss',
        num = req.params.num  || 1;

    models.Match.findAll({
        where: {
            roundType: type,
            roundNumber: num
        }
    })
    .then(matches => {
        res.render('rounds', {
            matches: matches
        });
    })
    .catch(err => {
        console.error('/round/:type/:num match findAll error');
        console.error(err);
        next(err);
    });
});

router.get('/player/:player', (req, res, next) => {
    let name = req.params.player || 'no-name';
    models.Player.findAll({
        where: {
            name: name
        }
    })
    .then(player => {
        models.Match.findAll({
            where: {
                $or: [{player1: name}, {player2: name}]
            }
        })
        .then(matches => {
            res.render('player', {
                player: player[0],
                matches: matches
            });
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
