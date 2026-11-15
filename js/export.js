/*
 * 가계도 내려받기: PNG
 * 브라우저 안에서만 만든다. 외부 라이브러리·네트워크 없음.
 */
(function (global) {
  'use strict';

  function svgToCanvas(svgString, width, height, scale) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas');
        c.width = Math.round(width * scale);
        c.height = Math.round(height * scale);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c);
      };
      img.onerror = function () { reject(new Error('이미지를 만들지 못했어요.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    });
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function stamp() {
    var d = new Date();
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }

  // 파일 이름: 사례 제목이 있으면 "사례제목.png", 없으면 "가계도-날짜.png" (파일 이름에 쓸 수 없는 글자는 뺀다)
  function png(g, title) {
    var safe = String(title || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    var name = (safe || '가계도-' + stamp()) + '.png';
    return svgToCanvas(g.svg, g.width, g.height, 3).then(function (c) {
      return new Promise(function (resolve) {
        c.toBlob(function (blob) { download(blob, name); resolve(); }, 'image/png');
      });
    });
  }

  global.GenogramExport = { png: png };
})(window);
