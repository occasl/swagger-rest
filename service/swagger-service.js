(function () {
    "use strict";

    var nconf = require('nconf'),
        http = require('http'),
        _ = require('lodash');

    nconf.file(__dirname + '/../conf/config.json');
    var host = nconf.get("swagger.host"),
        port = nconf.get("swagger.port"),
        apiKey = nconf.get('secretAccessKey');

    var logger = require(__dirname + '/../util/logger.js');

    // URL Constants
    var GET_URL = '/v2/pet/findByStatus?status=';
    var POST_DEL_URL = '/v2/pet/';

    exports.getPets = function (sortBy, status, callback) {
        sortBy = sortBy || 'available';
        var httpOptions = {
            hostname: host,
            path: GET_URL + status,
            port: port,
            method: 'GET'
        };

        var reqGet = http.request(httpOptions, function (response) {
            var content = '';
            response.on('data', function (chunk) {
                content += chunk;
            });
            response.on('end', function () {
                var err, rslt;
                try {
                    rslt = sort(JSON.parse(content), sortBy);
                }
                catch (e) {
                    var msg = 'Error processing response: ' + e + ' using this content ' + content + '\n';
                    logger.error(msg);
                    err = {msg: msg, code: 500};
                }
                callback(err, rslt);
            });
        });

        reqGet.on('error', function (e) {
            var msg = 'An error occurred when calling server' + host + ":" + port + GET_URL + ': ' + e;
            var err = {msg: msg, code: 500};
            callback(err);
        });

        reqGet.end();
    };

    exports.addPet = function (postData, callback) {
        var httpOptions = {
            hostname: host,
            path: POST_DEL_URL,
            port: port,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_key': apiKey
            }
        };

        var reqPost = http.request(httpOptions, function (response) {
            var content = '',
                err = null,
                result;
            response.setEncoding('utf8');
            response.on('data', function (chunk) {
                content += chunk;
            });
            response.on('end', function () {
                try {
                    logger.debug("Received the following response: " + content);
                    result = JSON.stringify(content);
                }
                catch (e) {
                    var msg = 'Error processing response: ' + e + ' using this content ' + content + '\n';
                    logger.error(msg);
                    err = {code: 500, message: msg};
                }
                callback(err, result);
            });
        });

        reqPost.on('error', function (e) {
            var msg = 'An error occurred when calling server' + host + ":" + port + POST_DEL_URL + ': ' + e;
            var err = {msg: msg, code: 500};
            callback(err);
        });

        reqPost.write(JSON.stringify(postData));
        reqPost.end();
    };

    exports.deletePet = function (id, callback) {
        var httpOptions = {
            hostname: host,
            path: POST_DEL_URL,
            port: port,
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'api_key': apiKey
            }
        };

        var reqDelete = http.request(httpOptions, function (response) {
            var content = '';
            response.on('data', function (chunk) {
                content += chunk;
            });
            response.on('end', function () {
                callback(null);
            });
        });

        reqDelete.on('error', function (e) {
            var msg = 'An error occurred when calling server' + host + ":" + port + POST_DEL_URL + ': ' + e;
            var err = {msg: msg, code: 500};
            callback(err);
        });

        reqDelete.end();
    };

    // *** Private Functions
    function sort(content, sortBy) {
        if (sortBy === 'id') {
            return (_.sortBy(content, sortBy));
        } else if (sortBy === 'name') {
            var rslt = [];

            // Clone original content and sort mixed-case names in lower-case
            var clone = _.cloneDeep(content);
            var sortArr = _.sortBy(_.forEach(clone, function (n) {
                n.name = _.isString(n.name) ? n.name.toLowerCase() : n.name;
                return n;
            }), "name");

            // Reorganize original content based on sorted content
            _.forEach(sortArr, function (n, key) {
                var element = _.find(content, function (c) {
                    return c.id === n.id;
                });
                rslt.push(element);
            });
            return rslt;
        }
    }
})();