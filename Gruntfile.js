(function () {
    'use strict';
    module.exports = function (grunt) {
        grunt.initConfig({
            pkg: grunt.file.readJSON('package.json'),
            clean: ["dist"],
            copy: {
                build: {
                    files: [
                        {
                            src: ['./**/*.js', './*.json', './README.md', 'config/*.json', '.ebextensions/*', '.elasticbeanstalk/*', '!./nunit.js', '!./test/**/*', '!./dist/**/*', '!./node_modules/**/*', '!./Gruntfile.js', '!./coverage/**/*', 'conf/*', 'Dockerfile', 'continuum.conf'],
                            dest: 'dist/'
                        }
                    ]
                }
            },
            'string-replace': {
                test: {
                    files: {
                        "dist/": ["newrelic.js", "package.json", "conf/*.json", "Dockerfile"]
                    },
                    options: {
                        replacements: [
                            {
                                pattern: /\$SWAGGER_SERVER/g,
                                replacement: 'petstore.swagger.io'
                            },
                            {
                                pattern: /\$SWAGGER_PORT/g,
                                replacement: '80'
                            },
                            {
                                pattern: /\$VERSION/g,
                                replacement: '1.3.1'
                            },
                            {
                                pattern: /\$ID/g,
                                replacement: 'user'
                            },
                            {
                                pattern: /\$PWD/g,
                                replacement: 'password'
                            },
                            {
                                pattern: /\$SECRET_ACCESS_KEY/g,
                                replacement: "special-key"
                            },
                            {
                                pattern: /\$LOG_LEVEL/g,
                                replacement: "debug"
                            },
                            {
                                pattern: /\$INSTANCES/g,
                                replacement: "1"
                            },
                            {
                                pattern: /\$NEWRELIC_TRACE_LVL/g,
                                replacement: "info"
                            }
                        ]
                    }
                }
            },
            jshint: {
                options: {
                    curly: true,
                    eqeqeq: true,
                    eqnull: true,
                    strict: true,
                    globals: {
                        jQuery: true
                    },
                    ignores: ['dist/test/**/*.js']
                },
                files: ['Gruntfile.js', 'dist/**/*.js']
            },
            mochaTest: {
                test: {
                    options: {
                        reporter: 'spec',
                        captureFile: 'results.txt', // Optionally capture the reporter output to a file
                        quiet: false, // Optionally suppress output to standard out (defaults to false)
                        clearRequireCache: false // Optionally clear the require cache before running tests (defaults to false)
                    },
                    src: ['test/**/*.js']
                }
            }
        });

        grunt.loadNpmTasks('grunt-contrib-copy');
        grunt.loadNpmTasks('grunt-contrib-clean');
        grunt.loadNpmTasks('grunt-contrib-jshint');
        grunt.loadNpmTasks('grunt-string-replace');
        grunt.loadNpmTasks('grunt-mocha-test');

        grunt.registerTask('default', ['clean', 'copy:build', 'string-replace:test', 'jshint']);
    };
})();
