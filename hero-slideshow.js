/* トップ写真のスライドショー（ホーム）
   - 1枚目は HTML に直接書いてあるので、すぐ表示されます。
   - 2枚目以降はページの読み込みが終わってから読み込みます。
   - 「視差効果を減らす」設定の端末では、1枚目の写真だけを表示します。 */
(function () {
  'use strict';
  var INTERVAL = 6000; // 1枚あたりの表示間隔（ミリ秒）。切り替えのフェードは CSS で 1.5 秒。

  var box = document.querySelector('.hero-slides');
  if (!box) return;
  var slides = Array.prototype.slice.call(box.querySelectorAll('img'));
  if (slides.length < 2) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var current = 0;
  var timer = null;
  var loaded = false;

  function isReady(img) {
    return img.getAttribute('src') && img.complete && img.naturalWidth > 0;
  }

  function loadRest() {
    if (loaded) return;
    loaded = true;
    slides.forEach(function (img) {
      var src = img.getAttribute('data-src');
      if (src) {
        img.src = src;
        img.removeAttribute('data-src');
      }
    });
  }

  function next() {
    var n = (current + 1) % slides.length;
    // 次の写真がまだ読み込めていなければ、今回は切り替えずに待つ
    if (!isReady(slides[n])) return;
    slides.forEach(function (img) { img.classList.remove('is-prev'); });
    slides[current].classList.add('is-prev');
    slides[current].classList.remove('is-active');
    slides[n].classList.add('is-active');
    current = n;
  }

  function start() {
    if (timer || (reduce && reduce.matches) || document.hidden) return;
    loadRest();
    timer = setInterval(next, INTERVAL);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  if (reduce) {
    var onChange = function () { if (reduce.matches) stop(); else start(); };
    if (reduce.addEventListener) reduce.addEventListener('change', onChange);
    else if (reduce.addListener) reduce.addListener(onChange);
  }
})();
