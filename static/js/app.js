/* H_BLOG 通用交互 —— 保持极简，不做任何追踪 */
(function () {
  'use strict';

  /* ---------- 1. 代码块头部：语言标签 ---------- */
  document.querySelectorAll('.highlight').forEach(function (el) {
    if (el.querySelector('.cb-head')) return;
    var code = el.querySelector('code[data-lang]');
    var lang = (code && code.getAttribute('data-lang')) || 'TEXT';
    var head = document.createElement('div');
    head.className = 'cb-head';
    var f = document.createElement('span');
    f.className = 'f';
    f.textContent = lang;
    var l = document.createElement('span');
    l.className = 'l';
    l.textContent = 'CODE';
    head.appendChild(f);
    head.appendChild(l);
    el.insertBefore(head, el.firstChild);
  });

  /* ---------- 2. Cmd/Ctrl + K 打开检索 ---------- */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      var base = document.body.getAttribute('data-base') || '/';
      window.location.href = base.replace(/\/$/, '') + '/search/';
    }
  });

  /* ---------- 3. 目录栏跟随阅读位置 ---------- */
  var tocItems = document.querySelectorAll('.toc-item[data-target]');
  if (tocItems.length) {
    var headings = [];
    tocItems.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('data-target'));
      if (el) headings.push({ el: el, link: a });
    });

    var onScroll = function () {
      var y = window.scrollY + 120;
      var active = headings[0];
      headings.forEach(function (h) {
        if (h.el.offsetTop <= y) active = h;
      });
      tocItems.forEach(function (a) { a.classList.remove('on'); });
      if (active) active.link.classList.add('on');
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 4. 复制链接 ---------- */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var text = btn.getAttribute('data-copy') || window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          var old = btn.textContent;
          btn.textContent = '已复制';
          setTimeout(function () { btn.textContent = old; }, 1600);
        });
      }
    });
  });
})();
