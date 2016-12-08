const express = require('express'),
    models = require('./models'),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    http = require('http'),
    path = require('path'),
    cors = require('cors'),
    favicon = require('serve-favicon');

const app = express(),
    port = normalizePort(process.env.PORT || 7070);

app.set('x-powered-by', false);
app.set('etag', false);
app.set('view engine', 'pug');
app.set('views', './views');

app.use(morgan('tiny'));
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.static('public', {etag: false, maxAge: '1d'}));
app.use(bodyParser.json());
app.use(cors());
app.use((req, res, next) => {
    res.set('Cache-Control', 'public, max-age=60');
    next();
});

const routes = require('./routes');
app.use('/', routes);

// Error handling
app.use((err, req, res, next) => {
    let code = err.statusCode || 500,
        body = {
            status: code,
            message: err.message || err.toString() || err
        },
        stack;

    if (err.stack) {
        body.stack = err.stack.split('\n');
    }

    res.status(code);
    res.json(body);
});

// setup server
const server = http.createServer(app);

const forceSync = process.env.NODE_ENV && process.env.NODE_ENV === 'production' ? false : true;

models.sequelize.sync({force: forceSync}).then(_ => {
    server.listen(port, _ => {
        console.log('Atlanta X-Wing starting');
    });
    server.on('error', error => {
        if (error.syscall !== 'listen') {
           throw error;
        }

        let bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

        switch (error.code) {
        case 'EACCES':
            console.error(`${bind} requires elevated privileges`);
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(`${bind} is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
        }
    });
    server.on('listening', _ => {
        let addr = server.address(),
            bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;

        console.log(`Listing on ${bind}`)
    });
});

function normalizePort(val) {
    let port = parseInt(val, 10);

    if (isNaN(port)) {
       return val; // named pipe
    }

    if (port >= 0) {
        return port; // port number
    }

    return false;
}

module.exports = app;
