
var theName = 'dj-component';

var
  gulp = require('gulp'),
  concat = require('gulp-concat'),
  babel = require("gulp-babel"),
  uglify = require('gulp-uglify'),
  cleanCSS = require('gulp-clean-css');


function build_js(path, name) {
  var theName = name || path;
  return gulp.src([path + "/src/**/*.module.js", path + "/src/**/*!(.module).js"])
    .pipe(concat(theName + ".js"))
    .pipe(babel({ presets: ['es2015'] }))
    .on('error', function (err) {
      console.log('babel 转换错误：', err);
      this.end();
    })
    .pipe(gulp.dest(path + "/dist"))
    .pipe(uglify({ compress: { drop_console: true } }))
    .pipe(concat(theName + ".min.js"))
    .pipe(gulp.dest(path + "/dist"));
}
function build_css(path, name) {
  var theName = name || path;
  return gulp.src([path + "/src/**/*.css"])
    .pipe(concat(theName + ".css"))
    .pipe(gulp.dest("dist"))
    .pipe(cleanCSS())
    .pipe(concat(theName + ".min.css"))
    .pipe(gulp.dest("dist"));
}

gulp.task('build', function () {
  var path = gulp.env.build || gulp.env.b;
  if (!path) {
    console.error("\n\nuse: gulp --build [path]\n\n");
    return;
  }
  build_css(path);
  return build_js(path);
});

gulp.task('test', function () {
  console.log(gulp.env)
});
gulp.task('default', ['build']);
