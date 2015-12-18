(function () {
    "use strict";

    var restify = require('restify'),
        bunyan = require('bunyan'),
        swagger = require('./api/swagger.js');

    // Get the environment variables we need.
    var host = process.env.DOCKER_HOST || 'localhost';
    var port = process.env.DOCKER_PORT || 8080;
    var version = process.env.VERSION || "1.0.0";

    var logger = bunyan.createLogger({
        name: 'Swagger REST API Service',
        streams: [
            {
                level: process.env.LOG_LEVEL || 'info',
                stream: process.stdout
            },
            {
                level: 'error',
                stream: process.stderr
            }
        ]
    });

    var server = restify.createServer({
        name: 'Swagger REST API Service',
        version: version,
        log: logger
    });

    server.pre(restify.pre.sanitizePath()); // Cleans up sloppy paths
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.authorizationParser());
    server.use(restify.queryParser());
    server.use(restify.bodyParser());

    // Turns audit logger on
    server.on('after', restify.auditLogger({
        log: logger
    }));

    // Service API
    server.get('/pet', swagger.getPets);
    server.get('/pet/findByStatus/:status', swagger.getPets);
    server.post('/pet/', swagger.addPet);
    server.del('/pet/:petId', swagger.deletePet);

    process.on("error", function(err) {
        logger.error(err);
        process.exit(4);
    });

    // catch the uncaught errors that weren't wrapped in a domain or try catch statement
    // do not use this in modules, but only in applications, as otherwise we could have multiple of these bound
    process.on('uncaughtException', function(err) {
        // handle the error safely
        logger.error(err);
        process.exit(1);
    });

    console.log("Starting up " + server.name + ", v" + version);

    server.listen(port, host, function () {
        console.log('%s listening at %s', server.name, server.url);
    });

})();