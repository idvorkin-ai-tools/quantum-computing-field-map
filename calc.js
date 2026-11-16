// QEC overhead calculator: plain surface-code memory heuristic.
//   p_L(d) = A * (p / p_th)^((d+1)/2)   per logical qubit per QEC round
//   physical qubits per logical = 2d^2 - 1   (d^2 data + d^2 - 1 measure)
//   pick the smallest odd d with  N * R * p_L(d) <= budget
// ponytail: ignores magic-state factories, routing space and decoder latency;
// real designs (yoked codes, qLDPC) beat it. Upgrade path: add a factory term.
(function () {
  var A = 0.1, PTH = 0.01, BUDGET = 0.1;
  var root = document.getElementById('qec-calc');
  if (!root) return;

  var PRESETS = [
    { name: 'Today-ish superconducting', p: -2.52, n: 100, r: 6 },      // p ≈ 3e-3
    { name: 'Starling-class run', p: -3, n: 200, r: 8 },                 // 200 logical, ~1e8 steps
    { name: 'RSA-2048-class run', p: -3, n: 1400, r: 11.6 },             // ~1,400 logical, ~5 days at 1 µs
    { name: 'Better hardware', p: -4, n: 1400, r: 11.6 }
  ];

  root.innerHTML =
    '<h3>Physical qubits per logical qubit</h3>' +
    '<div class="presets"></div>' +
    '<label>Physical error rate per operation, p <output id="qc-p"></output><input id="qc-pi" type="range" min="-4" max="-1.7" step="0.02" aria-label="physical error rate, log scale"></label>' +
    '<label>Logical qubits the algorithm needs, N <output id="qc-n"></output><input id="qc-ni" type="range" min="1" max="4" step="any" aria-label="logical qubits, log scale"></label>' +
    '<label>Error-correction rounds in the whole run, R <output id="qc-r"></output><input id="qc-ri" type="range" min="3" max="13" step="0.1" aria-label="rounds, log scale"></label>' +
    '<div class="out">' +
      '<div><div class="k">Λ = p_th / p</div><div class="v" id="qc-lam"></div></div>' +
      '<div><div class="k">Code distance d</div><div class="v" id="qc-d"></div></div>' +
      '<div><div class="k">Physical per logical</div><div class="v" id="qc-ppl"></div></div>' +
      '<div><div class="k">Total physical</div><div class="v" id="qc-tot"></div></div>' +
      '<div><div class="k">Logical error / round</div><div class="v" id="qc-pl"></div></div>' +
    '</div>' +
    '<div class="warn" id="qc-warn" hidden></div>' +
    '<p class="fine">Model: p_L(d) = 0.1 · (p / 0.01)^((d+1)/2) per logical qubit per round; 2d² − 1 physical qubits per surface-code patch; smallest odd d with N · R · p_L ≤ 0.1 (a 90% chance the whole run finishes clean). Memory only: no magic-state factories, routing or decoder, so real machines need more, and qLDPC codes or tricks like yoked surface codes need less.</p>';

  var pi = root.querySelector('#qc-pi'), ni = root.querySelector('#qc-ni'), ri = root.querySelector('#qc-ri');
  var pres = root.querySelector('.presets');

  function sci(x) {
    if (!isFinite(x)) return '∞';
    var e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e);
    if (m >= 9.95) { m = 1; e += 1; }
    return m.toFixed(1) + '×10' + sup(e);
  }
  function sup(e) {
    var map = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    return String(e).split('').map(function (c) { return map[c]; }).join('');
  }
  function big(x) {
    if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + 'M';
    if (x >= 1e4) return Math.round(x / 1e3) + 'k';
    return Math.round(x).toLocaleString('en-US');
  }
  function set(id, v) { root.querySelector(id).textContent = v; }

  function render() {
    var p = Math.pow(10, +pi.value), n = Math.round(Math.pow(10, +ni.value)), r = Math.pow(10, +ri.value);
    set('#qc-p', sci(p) + '  (' + (100 * (1 - p)).toFixed(p < 1e-3 ? 3 : 2) + '% fidelity)');
    set('#qc-n', n.toLocaleString('en-US'));
    set('#qc-r', sci(r));
    var lam = PTH / p;
    set('#qc-lam', lam.toFixed(lam < 10 ? 2 : 1));
    var warn = root.querySelector('#qc-warn');
    if (p >= PTH) {
      warn.hidden = false;
      warn.textContent = 'At or above threshold: a bigger code makes the logical qubit worse, not better. No distance works.';
      ['#qc-d', '#qc-ppl', '#qc-tot', '#qc-pl'].forEach(function (id) { set(id, '—'); });
      return;
    }
    var target = BUDGET / (n * r), d = 3, pl;
    for (;; d += 2) {
      pl = A * Math.pow(p / PTH, (d + 1) / 2);
      if (pl <= target || d > 199) break;
    }
    var ppl = 2 * d * d - 1;
    warn.hidden = d <= 199;
    if (d > 199) warn.textContent = 'Needs a distance above 199: too close to threshold to be practical.';
    set('#qc-d', d);
    set('#qc-ppl', ppl.toLocaleString('en-US'));
    set('#qc-tot', big(ppl * n));
    set('#qc-pl', sci(pl));
  }

  PRESETS.forEach(function (ps, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = ps.name;
    b.addEventListener('click', function () {
      pi.value = ps.p; ni.value = Math.log10(ps.n); ri.value = ps.r;
      pres.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      render();
    });
    pres.appendChild(b);
    if (i === 1) { pi.value = ps.p; ni.value = Math.log10(ps.n); ri.value = ps.r; b.classList.add('on'); }
  });
  [pi, ni, ri].forEach(function (el) {
    el.addEventListener('input', function () {
      pres.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      render();
    });
  });
  render();
})();
