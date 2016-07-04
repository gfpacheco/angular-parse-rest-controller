'use strict';

var gulp = require('gulp');
var KarmaServer = require('karma').Server;
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var bump = require('gulp-bump');
var git = require('gulp-git-streamed');
var filter = require('gulp-filter');
var tagVersion = require('gulp-tag-version');
var path = require('path');
var plumber = require('gulp-plumber');
var runSequence = require('run-sequence');
var eslint = require('gulp-eslint');

/*
** Directories and files
*/

var rootDirectory = path.resolve('./');
var sourceDirectory = path.join(rootDirectory, './src');
var testDirectory = path.join(rootDirectory, './tests');

var jsSourceFiles = [
  // Make sure module files are handled first
  path.join(sourceDirectory, '/**/module.js'),
  path.join(sourceDirectory, '/**/*.js')
];

var lintFiles = [
  'gulpfile.js',
  'karma-*.conf.js'
].concat(jsSourceFiles);

var versionFiles = [
  path.join(rootDirectory, 'package.json'),
  path.join(rootDirectory, 'bower.json')
];

/*
** Lint and build
*/

gulp.task('lint-js', function() {
  return gulp.src(lintFiles)
    .pipe(plumber())
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('build-js', function() {
  return gulp.src(jsSourceFiles)
    .pipe(plumber())
    .pipe(concat('angular-parse-rest-controller.js'))
    .pipe(gulp.dest('./dist/'))
    .pipe(uglify())
    .pipe(rename('angular-parse-rest-controller.min.js'))
    .pipe(gulp.dest('./dist'));
});

/*
** Test
*/

gulp.task('test-src', function(done) {
  new KarmaServer({
    configFile: path.join(__dirname, '/karma-src.conf.js'),
    singleRun: true
  }, done).start();
});

gulp.task('test-dist-concatenated', function(done) {
  new KarmaServer({
    configFile: path.join(__dirname, '/karma-dist-concatenated.conf.js'),
    singleRun: true
  }, done).start();
});

gulp.task('test-dist-minified', function(done) {
  new KarmaServer({
    configFile: path.join(__dirname, '/karma-dist-minified.conf.js'),
    singleRun: true
  }, done).start();
});

gulp.task('test-all', function(done) {
  runSequence(
    'lint-js',
    'test-src',
    'build-js',
    'test-dist-concatenated',
    'test-dist-minified',
    done
  );
});

/*
** Release
*/

function release(type) {
  return gulp.src(versionFiles)
    .pipe(bump({ type: type }))
    .pipe(gulp.dest(rootDirectory))
    .pipe(git.commit('Version bump'))
    .pipe(filter('package.json'))
    .pipe(tagVersion())
    .pipe(git.push('origin', 'master'))
    .pipe(git.push('origin', 'master', { args: '--tags' }));
}

gulp.task('release-patch', function() {
  release('patch');
});

gulp.task('release-minor', function() {
  release('minor');
});

gulp.task('release-major', function() {
  release('major');
});

/*
** Develop
*/

gulp.task('watch', function() {
  gulp.watch(jsSourceFiles, function() {
    runSequence('lint-js', 'build-js', 'test-src');
  });
  gulp.watch(path.join(testDirectory, '/**/*.js'), ['test-src']);
});

/*
** Default
*/

gulp.task('default', function(done) {
  runSequence('test-all', done);
});
