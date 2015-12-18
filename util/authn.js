(function () {
    "use strict";

    var restify = require('restify'),
        passport = require('passport'),
        logger = require(__dirname + '/../util/logger.js'),
        BasicStrategy = require('passport-http').BasicStrategy,
        nconf = require('nconf');

    nconf.file(__dirname + '/../conf/config.json');
    var userId = nconf.get("id"),
        pwd = nconf.get("pwd");

    passport.use(new BasicStrategy(
        function (username, password, done) {
            findByUsername(username, function (err, user) {
                if (err) {
                    return done(err);
                }
                if (!user) {
                    return done(null, false, { message: 'Incorrect username.' });
                }
                if (user.password !== password) {
                    return done(null, false, { message: 'Incorrect password.' });
                }
                return done(null, user);
            });
        }
    ));

    // Just use a single user that can access this service set from deployment var
    var users = [
        { id: 1, username: userId, password: pwd}
    ];

    function findByUsername(username, fn) {
        for (var i = 0, len = users.length; i < len; i++) {
            var user = users[i];
            if (user.username === username) {
                return fn(null, user);
            }
        }
        return fn(null, null);
    }

    exports.authenticate = function (req, res, next, callback) {
        passport.authenticate('basic', function (err, user) {
            if (err) {
                logger.error(err);
                return next(err);
            }
            if (!user) {
                var error = new restify.InvalidCredentialsError("Authentication failure");
                logger.error(error);
                res.send(error);
                return next();
            }

            callback(req, res, next);
        })(req, res, next);
    };
})();