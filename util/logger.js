(function () {
    "use strict";

    var winston = require('winston');


    module.exports = new (winston.Logger) ({
        transports: [
            new (winston.transports.Console)({
                level: process.env.LOG_LEVEL || 'debug', // possible levels include DEBUG, WARN, INFO AND ERROR
                colorize: false,
                timestamp: true
            })
        ]
    });

})();