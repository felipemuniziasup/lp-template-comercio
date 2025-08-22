// gulpfile.js
// Build simples para HTML com parciais via @@include (pasta: src/_partials)

const { src, dest, series, parallel, watch } = require('gulp');
const del = require('del');
const fileInclude = require('gulp-file-include');
const htmlmin = require('gulp-htmlmin');
const browserSync = require('browser-sync').create();

const PATHS = {
  html: 'src/**/*.html',
  partials: 'src/_partials',
  out: 'dist'
};

function clean() {
  return del([PATHS.out]);
}

function html() {
  return src(['src/*.html']) // só páginas da raiz de src (index, celulares, etc)
    .pipe(
      fileInclude({
        prefix: '@@',
        basepath: PATHS.partials // <<< AQUI usa _partials
      })
    )
    .pipe(
      htmlmin({
        collapseWhitespace: false,
        removeComments: true
      })
    )
    .pipe(dest(PATHS.out))
    .pipe(browserSync.stream());
}

function assets() {
  // copia tudo que não é html (imagens, sw.js, manifest, etc)
  return src([
    'assets/**/*',
    'sw.js',
    'manifest.webmanifest',
    '!**/*.md'
  ], { allowEmpty: true, base: '.' })
    .pipe(dest(PATHS.out));
}

function serve() {
  browserSync.init({
    server: { baseDir: PATHS.out },
    open: false,
    notify: false
  });

  watch(['src/**/*.html'], html);
  watch(['assets/**/*', 'sw.js', 'manifest.webmanifest'], assets);
}

exports.clean = clean;
exports.build = series(clean, parallel(html, assets));
exports.dev = series(clean, parallel(html, assets), serve);
exports.default = exports.build;
