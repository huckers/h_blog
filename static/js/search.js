/* 站内检索 —— 索引在构建时生成，查询全在本地完成 */
(function () {
  'use strict';

  var script = document.querySelector('script[data-index]');
  var idxUrl = (script && script.getAttribute('data-index')) || '/index.json';

  var input = document.getElementById('q');
  var box = document.getElementById('results');
  var statL = document.getElementById('stat-l');
  var statR = document.getElementById('stat-r');
  var cnt = document.getElementById('result-count');
  if (!input || !box) return;

  var docs = [];
  var loaded = false;

  fetch(idxUrl)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      docs = d.map(prep);
      loaded = true;
      var q = new URLSearchParams(location.search).get('q') || '';
      if (q) {
        input.value = q;
        run(q);
      }
    })
    .catch(function () {
      statL.textContent = '索引加载失败';
    });

  function prep(d) {
    d._t = (d.title || '').toLowerCase();
    d._g = (d.tags || []).join(' ').toLowerCase();
    d._s = (d.summary || '').toLowerCase();
    d._x = (d.text || d.summary || '').toLowerCase();
    return d;
  }

  /* 解析查询：支持 tag:xxx、"短语"、裸词 */
  function parse(raw) {
    var terms = [];
    var tagFilters = [];
    var re = /"([^"]+)"|tag:(\S+)|(\S+)/g;
    var m;
    while ((m = re.exec(raw)) !== null) {
      if (m[1]) terms.push({ q: m[1].toLowerCase(), exact: true });
      else if (m[2]) tagFilters.push(m[2].toLowerCase());
      else if (m[3]) terms.push({ q: m[3].toLowerCase(), exact: false });
    }
    return { terms: terms, tags: tagFilters };
  }

  function score(d, terms) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var q = terms[i].q;
      var hit = 0;
      if (d._t.indexOf(q) >= 0) hit += 12;
      if (d._g.indexOf(q) >= 0) hit += 6;
      if (d._s.indexOf(q) >= 0) hit += 4;
      if (d._x.indexOf(q) >= 0) hit += 1;
      if (!hit) return -1; // 所有词必须命中
      total += hit;
    }
    return total;
  }

  function snippet(d, terms) {
    var src = d.summary || '';
    var low = src.toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      if (low.indexOf(terms[i].q) >= 0) return src;
    }
    var text = d.text || '';
    if (!text) return src;
    for (var j = 0; j < terms.length; j++) {
      var p = text.toLowerCase().indexOf(terms[j].q);
      if (p >= 0) {
        var start = Math.max(0, p - 30);
        return (start > 0 ? '…' : '') + text.slice(start, start + 110) + '…';
      }
    }
    return text.slice(0, 110) + '…';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mark(text, terms) {
    var out = esc(text);
    terms.forEach(function (t) {
      if (!t.q) return;
      var safe = esc(t.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp('(' + safe + ')', 'gi'), '<span style="color:var(--signal);">$1</span>');
    });
    return out;
  }

  function run(raw) {
    if (!loaded) return;
    var q = (raw || '').trim();
    var parsed = parse(q);

    if (!parsed.terms.length && !parsed.tags.length) {
      box.innerHTML = '';
      cnt.textContent = '—';
      statL.textContent = '等待输入';
      statR.textContent = docs.length + ' 篇已索引';
      return;
    }

    var hits = [];
    docs.forEach(function (d) {
      if (parsed.tags.length) {
        for (var i = 0; i < parsed.tags.length; i++) {
          if (d._g.indexOf(parsed.tags[i]) < 0) return;
        }
      }
      var s = parsed.terms.length ? score(d, parsed.terms) : 1;
      if (s >= 0) hits.push({ d: d, s: s });
    });

    hits.sort(function (a, b) { return b.s - a.s; });

    cnt.textContent = String(hits.length).padStart(2, '0');
    statL.textContent = hits.length
      ? '找到 ' + hits.length + ' 篇   ·   按相关度排序'
      : '没有匹配   ·   换个词试试';
    statR.textContent = docs.length + ' 篇已索引';

    if (!hits.length) {
      box.innerHTML =
        '<div class="result"><span class="a" style="padding:8px 0;">没有结果。可以试试更短的词，或者用 tag: 前缀限定主题。</span></div>';
      return;
    }

    box.innerHTML = hits.slice(0, 30).map(function (h) {
      var d = h.d;
      return '<a class="result" href="' + d.url + '">' +
        '<span class="meta">' +
          '<span class="p">' + esc((d.tags || [])[0] || '') + '   ·   ' + esc(d.date) + '</span>' +
          '<span class="h">' + esc((d.tags || []).join(' / ').toUpperCase()) + '</span>' +
        '</span>' +
        '<span class="t">' + mark(d.title, parsed.terms) + '</span>' +
        '<span class="a">' + mark(snippet(d, parsed.terms), parsed.terms) + '</span>' +
        '</a>';
    }).join('');

    // 同步到地址栏，方便分享检索结果
    var u = new URL(location.href);
    if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
  }

  var timer;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    var v = input.value;
    timer = setTimeout(function () { run(v); }, 140);
  });

  // CMD+K 聚焦
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
})();
