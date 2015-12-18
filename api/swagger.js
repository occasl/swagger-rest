(function () {
    "use strict";

    var restify = require('restify'),
        logger = require(__dirname + '/../util/logger.js'),
        basicAuth = require(__dirname + '/../util/authn.js'),
        swaggerService = require(__dirname + '/../service/swagger-service.js');

    exports.getPets = function (req, res, next) {
        basicAuth.authenticate(req, res, next, function() {
            var sortBy = req.params.sort || 'id';
            var status = req.params.status || 'available';
            if (sortBy.toLowerCase() === 'name' || sortBy.toLowerCase() === 'id') {
                swaggerService.getPets(sortBy, status, function(err, result) {
                    if (err) {
                        res.send(500, err);
                    } else {
                        res.send(result);
                    }
                });
            }
            else {
                logger.warn("Unsupported sort parameter provided: " + sortBy);
                return next(new restify.MissingParameterError("Sort only supports name or id. Please try again."));
            }
        });
    };

    exports.addPet = function (req, res, next) {
        basicAuth.authenticate(req, res, next, function() {
            var postData = req.body;
            if (postData && postData.name && postData.photoUrls) {
                swaggerService.addPet(postData, function(err, result) {
                    if (err) {
                        res.send(500, err);
                    } else {
                        res.send(result);
                    }
                });
            }
            else {
                return next(new restify.MissingParameterError("You must at least provide a name and photoURLs."));
            }
        });
    };

    exports.deletePet = function (req, res, next) {
        basicAuth.authenticate(req, res, next, function() {
            var petId = req.params.petId;
            if (petId) {
                swaggerService.deletePet(petId, function(err, result) {
                    if (err) {
                        res.send(500, err);
                    } else {
                        res.send(result);
                    }
                });
            }
            else {
                return next(new restify.MissingParameterError("You must provide which Pet ID to delete."));
            }
        });
    };

})();