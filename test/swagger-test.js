(function () {
    "use strict";
    var restify = require('restify');
    var swagger = require('../api/swagger.js');
    var _ = require('lodash');

    // Chai Assertion Library
    var chai = require('chai');
    chai.use(require('chai-string'));
    var should = chai.should();

    var client = restify.createJsonClient({
        version: '1.0.0',
        //url: 'http://swagger-rest.lsacco.sandbox.runq.runq-ssat.qualcomm.com/',
        //url: 'http://192.168.99.100:8080',
        //url: 'http://localhost:8080',
        // Required for Jenkins CI/CD Build
        url: process.env.APPLICATION_HOSTNAME,
        headers: {Authorization: 'Basic dXNlcjpwYXNzd29yZA=='}
    });

    var timeout = 30000; //in ms
    describe('swagger-tests', function () {
        var petId;
        describe('#createPet', function () {
            this.timeout(timeout);
            it('should add a new pet', function (done) {
                var json = {
                    "name": "freddie",
                    "photoUrls": ["http://pet.swagger.com/456.png"],
                    "tags": [{"id": 0, "name": "fredclan"}]
                };
                client.post('/pet/', json, function (err, req, res, data) {
                    if (err) {
                        throw new Error(err);
                    }
                    else {
                        var result = JSON.parse(JSON.parse(data));
                        petId = result.id; // use to clean-up during delete
                        (result.name).should.equal(json.name);
                    }
                    done();
                });
            });
        });
        describe('#getPets', function () {
            this.timeout(timeout);
            it('should exist and return an Array', function (done) {
                client.get('/pet?status=available,pending,sold', function (err, req, res, data) {
                    if (err) {
                        throw new Error(err);
                    }
                    else {
                        should.exist(data);
                        data.should.be.a('Array');
                        done();
                    }
                });
            });
            it('should have at least 1 pet in list', function (done) {
                client.get('/pet?status=available,pending,sold', function (err, req, res, data) {
                    if (err) {
                        throw new Error(err);
                    }
                    else {
                        //assert.isAbove(data.length, 0, "Should have more than 1 pet.");
                        data.should.have.length.above(1);
                        done();
                    }
                });
            });
            it('should return error if search not name or id', function (done) {
                client.get('/pet?sort=ids', function (err, req, res, data) {
                    (data.message).should.equal("Sort only supports name or id. Please try again.");
                    done();
                });
            });
            it('should be sorted by ID', function (done) {
                client.get('/pet?sort=id', function (err, req, res, data) {
                    if (err) {
                        throw new Error(err);
                    }
                    else {
                        data.should.have.length.above(1);
                        _.forEach(data, function (val, idx, array) {
                            if (typeof val !== 'undefined' && idx >= 1) {
                                (val.id >= array[idx - 1].id).should.be.true;
                            }
                        });
                        done();
                    }
                });
            });
            it('should be sorted by ID even if no parameter', function (done) {
                client.get('/pet', function (err, req, res, data) {
                    if (err) {
                        throw new Error(err);
                    }
                    else {
                        data.should.have.length.above(1);
                        _.forEach(data, function (val, idx, array) {
                            if (typeof val !== 'undefined' && idx >= 1) {
                                if (val.id < array[idx - 1].id) {
                                    console.log(val.id + " < " + array[idx-1].id);
                                }

                                (val.id >= array[idx - 1].id).should.be.true;
                            }
                        });
                        done();
                    }
                });
            });
            it('should be only available pets', function (done) {
                client.get('/pet/findByStatus/available', function (err, req, res, data) {
                    if (err) {
                        throw new Error(err);
                    }
                    else {
                        _.forEach(data, function (val, idx, array) {
                            if (typeof val.name !== 'undefined' && idx >= 1) {
                                if (val.status.toLowerCase() !== 'available') {
                                    console.log(val.name + " = " + val.status);
                                }
                                (val.status.toLowerCase() === 'available').should.be.true;
                            }
                        });
                        done();
                    }
                });
            });
        });
        describe('#getPetsSortedByName', function () {
           this.timeout(500000); // this one takes longer than the others
           it('should be sorted by name', function (done) {
               client.get('/pet?sort=name', function (err, req, res, data) {
                   if (err) {
                       throw new Error(err);
                   }
                   else {
                       data.should.have.length.above(1);
                       _.forEach(data, function (val, idx, array) {
                           if (typeof val.name !== 'undefined' && idx >= 1) {
                               if (val.name.toLowerCase() < array[idx - 1].name.toLowerCase()) {
                                   console.log(val.name + " <= " + array[idx-1].name);
                               }
                               (val.name.toLowerCase() >= array[idx - 1].name.toLowerCase()).should.be.true;
                           }
                       });
                       done();
                   }
               });
           });
        });
        describe('#deletePet', function () {
            this.timeout(timeout);
            it('should delete a pet', function (done) {
                client.del('/pet/' + petId, function (err, req, res, data) {
                    if (err) {
                        throw new Error(err);
                    }
                    data.should.be.empty;
                    done();
                });
            });
        });
    });
})();