/*
 * 가계도 내려받기: PNG, PDF
 * 모두 브라우저 안에서 만든다. 외부 라이브러리·네트워크 없음.
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

  function png(g) {
    return svgToCanvas(g.svg, g.width, g.height, 3).then(function (c) {
      return new Promise(function (resolve) {
        c.toBlob(function (blob) { download(blob, '가계도-' + stamp() + '.png'); resolve(); }, 'image/png');
      });
    });
  }

  // JPEG 한 장을 A4 한 쪽에 맞춰 넣는 가장 작은 PDF
  function buildPdf(jpegBytes, imgW, imgH) {
    var landscape = imgW > imgH;
    var pageW = landscape ? 841.89 : 595.28, pageH = landscape ? 595.28 : 841.89;
    var margin = 36;
    var s = Math.min((pageW - 2 * margin) / imgW, (pageH - 2 * margin) / imgH);
    var w = imgW * s, h = imgH * s;
    var x = (pageW - w) / 2, y = pageH - margin - h;
    var content = 'q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im0 Do Q';

    var enc = new TextEncoder();
    var chunks = [], offsets = [], length = 0;
    function push(data) {
      var bytes = typeof data === 'string' ? enc.encode(data) : data;
      chunks.push(bytes);
      length += bytes.length;
    }
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    function obj(n, body) { offsets[n] = length; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); }
    obj(1, function () { push('<< /Type /Catalog /Pages 2 0 R >>'); });
    obj(2, function () { push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'); });
    obj(3, function () {
      push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pageW + ' ' + pageH + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
    });
    obj(4, function () {
      push('<< /Type /XObject /Subtype /Image /Width ' + imgW + ' /Height ' + imgH + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpegBytes.length + ' >>\nstream\n');
      push(jpegBytes);
      push('\nendstream');
    });
    obj(5, function () { push('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream'); });
    var xref = length;
    var x = 'xref\n0 6\n0000000000 65535 f \n';
    for (var i = 1; i <= 5; i++) x += ('0000000000' + offsets[i]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function pdf(g) {
    return svgToCanvas(g.svg, g.width, g.height, 3).then(function (c) {
      return new Promise(function (resolve) {
        c.toBlob(function (blob) {
          blob.arrayBuffer().then(function (buf) {
            download(buildPdf(new Uint8Array(buf), c.width, c.height), '가계도-' + stamp() + '.pdf');
            resolve();
          });
        }, 'image/jpeg', 0.95);
      });
    });
  }

  global.GenogramExport = { png: png, pdf: pdf };
})(window);
