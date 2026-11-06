(function () {
  'use strict';

  var C = window.PREORDER_CONFIG;
  var DEMO = !C.apiUrl;
  var DEMO_KEY = 'preorder-demo-orders';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var qty = {};
  C.designs.forEach(function (d) { qty[d.id] = 0; });

  var deadline = new Date(C.deadline);
  var closed = false;
  var ACCESS_KEY = 'preorder-access';
  var accessCode = '';
  var liveTotal = 0;          // hats ordered so far, from the backend
  var estQtyTouched = false;  // user typed their own number into the estimator

  // ---------- helpers ----------
  function fmtDate(d) {
    return d.toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: C.displayTimeZone || 'America/Chicago', timeZoneName: 'short'
    });
  }
  function money(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function totalHats() {
    return Object.keys(qty).reduce(function (s, k) { return s + qty[k]; }, 0);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- password gate ----------
  function sha256(str) {
    var data = new TextEncoder().encode(str);
    return crypto.subtle.digest('SHA-256', data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function initGate(onUnlock) {
    if (!C.accessCodeHash) { onUnlock(); return; }
    var gate = $('#gate');
    var form = $('#gate-form');
    var input = $('#gate-input');
    var err = $('#gate-error');
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(ACCESS_KEY) || 'null'); } catch (e) { /* ignore */ }
    if (saved && saved.hash === C.accessCodeHash && saved.code) {
      accessCode = saved.code;
      onUnlock();
      return;
    }
    document.body.classList.add('is-locked');
    gate.hidden = false;
    setTimeout(function () { input.focus(); }, 50);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var code = input.value.trim().toLowerCase();
      if (!code) return;
      if (!window.crypto || !crypto.subtle) {
        err.textContent = 'This browser can\'t check the password. Try a newer browser or an https link.';
        err.hidden = false;
        return;
      }
      sha256(code).then(function (hash) {
        if (hash === C.accessCodeHash) {
          accessCode = code;
          try { sessionStorage.setItem(ACCESS_KEY, JSON.stringify({ hash: hash, code: code })); } catch (e2) { /* ignore */ }
          gate.hidden = true;
          document.body.classList.remove('is-locked');
          onUnlock();
        } else {
          err.textContent = 'That\'s not it. Check the group chat and try again.';
          err.hidden = false;
          input.select();
        }
      });
    });
  }

  // ---------- static copy from config ----------
  function fillStatic() {
    $$('.organizer-name').forEach(function (el) { el.textContent = C.organizerName; });
    $('#min-total-copy').textContent = C.minTotal;
    $('#min-design-copy').textContent = C.minPerDesign;
    $('#total-min').textContent = C.minTotal;
    $('#pay-venmo').textContent = C.payment.venmo;
    $('#pay-zelle').textContent = C.payment.zelle;
    ['#organizer-mailto', '#organizer-mailto-closed'].forEach(function (s) {
      var a = $(s); a.textContent = C.organizerEmail; a.href = 'mailto:' + C.organizerEmail;
    });
    $('#closed-date').textContent = fmtDate(deadline);
    $('#countdown-date').textContent = fmtDate(deadline);

    var yearWrap = $('#class-year-choices');
    yearWrap.innerHTML = C.classYears.map(function (y, i) {
      return '<label class="choice"><input type="radio" name="classYear" value="' + y + '"' + (i === 0 ? ' required' : '') + '><span>' + y + '</span></label>';
    }).join('');

    if (DEMO) $('#demo-banner').hidden = false;
  }

  // ---------- pricing ----------
  var P = C.pricing;

  function tierFor(n) {
    var tier = P.tiers[0];
    for (var i = 0; i < P.tiers.length; i++) {
      if (n >= P.tiers[i].min) tier = P.tiers[i];
    }
    return tier;
  }

  function tierAfter(tier) {
    var i = P.tiers.indexOf(tier);
    return i >= 0 && i < P.tiers.length - 1 ? P.tiers[i + 1] : null;
  }

  function tierLabel(t) {
    return t.max ? t.min + '\u2013' + t.max : t.min + '+';
  }

  // Full per-hat estimate for an order of n hats.
  function estimate(n) {
    n = Math.max(C.minTotal, Math.floor(n) || 0);
    var tier = tierFor(n);
    var ship = P.shippingTotal / n;
    var taxable = tier.base + P.sidePatch + ship;
    var tax = taxable * P.taxRate;
    return {
      n: n, tier: tier, base: tier.base, side: P.sidePatch, ship: ship, tax: tax,
      perHat: taxable + tax,
    };
  }

  // The order size the estimate should assume: what's in so far plus this visitor's picks.
  function projectedTotal() {
    return Math.max(C.minTotal, liveTotal + totalHats());
  }

  function currentEstimateQty() {
    var input = $('#est-qty');
    if (estQtyTouched) {
      var v = parseInt(input.value, 10);
      if (v >= C.minTotal) return v;
    }
    return projectedTotal();
  }

  function renderEstimator() {
    var n = currentEstimateQty();
    var e = estimate(n);
    var input = $('#est-qty');
    if (!estQtyTouched) input.value = n;
    $('#est-reset').hidden = !estQtyTouched;

    $('#est-per-hat').textContent = money(e.perHat);

    var mine = totalHats();
    var basis;
    if (estQtyTouched) {
      basis = 'What-if at ' + plural(n, 'hat') + '. Live count is ' + plural(liveTotal, 'hat') + ' so far.';
    } else if (liveTotal + mine < C.minTotal) {
      basis = plural(liveTotal, 'hat') + ' ordered so far' + (mine ? ' plus your ' + mine : '') + '. Assuming we reach the ' + C.minTotal + '-hat minimum.';
    } else if (mine) {
      basis = plural(liveTotal, 'hat') + ' ordered so far plus your ' + mine + ' = ' + plural(liveTotal + mine, 'hat') + '.';
    } else {
      basis = plural(liveTotal, 'hat') + ' ordered so far.';
    }
    $('#est-basis').textContent = basis;

    $('#est-rows').innerHTML =
      '<tr><td>Hat<span class="small muted">' + 'order of ' + tierLabel(e.tier) + ' hats</span></td><td>' + money(e.base) + '</td></tr>' +
      '<tr><td>Longhorn side patch<span class="small muted">flat add-on per hat</span></td><td>+ ' + money(e.side) + '</td></tr>' +
      '<tr><td>Shipping share<span class="small muted">est. ' + money(P.shippingTotal) + ' split across ' + n + '</span></td><td>+ ' + money(e.ship) + '</td></tr>' +
      '<tr><td>Sales tax<span class="small muted">' + (P.taxRate * 100).toFixed(2).replace(/\.?0+$/, '') + '%</span></td><td>+ ' + money(e.tax) + '</td></tr>' +
      '<tr class="total"><td>Per hat</td><td>' + money(e.perHat) + '</td></tr>';

    $('#est-tiers').innerHTML = P.tiers.map(function (t) {
      var cls = t === e.tier ? ' is-active' : (t.min < e.tier.min ? ' is-below' : '');
      return '<div class="tier' + cls + '"><span class="tier-range">' + tierLabel(t) + '</span><span class="tier-price">' + money(t.base) + '</span></div>';
    }).join('');

    var next = tierAfter(e.tier);
    if (next) {
      var gap = next.min - n;
      var atNext = estimate(next.min);
      $('#est-next').textContent = plural(gap, 'more hat') + ' would reach the ' + tierLabel(next) + ' tier and bring it to about ' + money(atNext.perHat) + ' per hat.';
    } else {
      $('#est-next').textContent = 'That\'s the best tier on the sheet.';
    }

    $('#est-foot').textContent = 'Hat and patch prices are from the Branded Bills pricing sheet. Tax and shipping are estimates. The final per-hat amount is confirmed before anyone pays.';
  }

  function bindEstimator() {
    var input = $('#est-qty');
    input.min = C.minTotal;
    input.addEventListener('input', function () {
      var v = parseInt(input.value, 10);
      estQtyTouched = !isNaN(v);
      renderEstimator();
      updateSummary();
    });
    input.addEventListener('blur', function () {
      var v = parseInt(input.value, 10);
      if (isNaN(v) || v < C.minTotal) { estQtyTouched = false; }
      renderEstimator();
      updateSummary();
    });
    $('#est-reset').addEventListener('click', function () {
      estQtyTouched = false;
      renderEstimator();
      updateSummary();
    });
  }

  // ---------- countdown ----------
  function tickCountdown() {
    var now = new Date();
    var ms = deadline - now;
    var el = $('#countdown-value');
    var box = $('#countdown');
    if (ms <= 0) {
      el.textContent = 'Closed';
      box.classList.add('is-closed');
      if (!closed) setClosed();
      return;
    }
    var d = Math.floor(ms / 864e5);
    var h = Math.floor((ms % 864e5) / 36e5);
    var m = Math.floor((ms % 36e5) / 6e4);
    var s = Math.floor((ms % 6e4) / 1e3);
    if (d > 0) el.textContent = d + 'd ' + h + 'h ' + m + 'm';
    else el.textContent = h + 'h ' + m + 'm ' + s + 's';
  }

  function setClosed() {
    closed = true;
    $('#order-form').hidden = true;
    $('#closed').hidden = false;
    $$('.qty button').forEach(function (b) { b.disabled = true; });
  }

  // ---------- design cards ----------
  function renderDesigns() {
    var wrap = $('#designs');
    wrap.innerHTML = C.designs.map(function (d) {
      var swatches = (d.swatch || []).map(function (c) {
        return '<span class="swatch" style="background:' + c + '"></span>';
      }).join('');
      return (
        '<div class="design-card" data-id="' + d.id + '">' +
          '<div class="design-img">' +
            '<img class="design-img-front" src="' + d.image + '" alt="Design ' + d.id + ': ' + escapeHtml(d.name) + ', front" loading="lazy">' +
            (d.sideImage ? '<img class="design-img-side" src="' + d.sideImage + '" alt="Design ' + d.id + ': ' + escapeHtml(d.name) + ', side" loading="lazy" hidden>' : '') +
          '</div>' +
          (d.sideImage ?
            '<div class="view-toggle" role="group" aria-label="View">' +
              '<button type="button" class="view-btn is-active" data-view="front">Front</button>' +
              '<button type="button" class="view-btn" data-view="side">Side</button>' +
            '</div>' : '') +
          '<div class="design-head"><span class="design-letter">' + d.id + '</span><span class="design-name">' + escapeHtml(d.name) + '</span><span class="swatches">' + swatches + '</span></div>' +
          '<p class="design-style">' + escapeHtml(d.style) + '</p>' +
          '<p class="design-colorway">' + escapeHtml(d.colorway) + (d.sidePatch ? '<br><span class="design-side">Side: ' + escapeHtml(d.sidePatch) + '</span>' : '') + '</p>' +
          '<div class="qty" role="group" aria-label="Quantity for design ' + d.id + '">' +
            '<button type="button" data-dir="-1" aria-label="Remove one">&minus;</button>' +
            '<span class="qty-value" aria-live="polite">0</span>' +
            '<button type="button" data-dir="1" aria-label="Add one">+</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    wrap.addEventListener('click', function (e) {
      var view = e.target.closest('button[data-view]');
      if (view) {
        var c = view.closest('.design-card');
        var side = view.getAttribute('data-view') === 'side';
        c.querySelector('.design-img-front').hidden = side;
        c.querySelector('.design-img-side').hidden = !side;
        $$('.view-btn', c).forEach(function (b) { b.classList.toggle('is-active', b === view); });
        return;
      }
      var btn = e.target.closest('button[data-dir]');
      if (!btn || closed) return;
      var card = btn.closest('.design-card');
      var id = card.getAttribute('data-id');
      var next = qty[id] + parseInt(btn.getAttribute('data-dir'), 10);
      qty[id] = Math.max(0, Math.min(C.maxPerDesignPerPerson, next));
      updateCard(card);
      updateSummary();
    });
    C.designs.forEach(function (d) { updateCard(wrap.querySelector('[data-id="' + d.id + '"]')); });
  }

  function updateCard(card) {
    var id = card.getAttribute('data-id');
    card.querySelector('.qty-value').textContent = qty[id];
    card.classList.toggle('is-selected', qty[id] > 0);
    card.querySelector('[data-dir="-1"]').disabled = qty[id] === 0;
    card.querySelector('[data-dir="1"]').disabled = qty[id] >= C.maxPerDesignPerPerson;
  }

  function updateSummary() {
    var n = totalHats();
    $('#summary-hats').textContent = plural(n, 'hat');
    var e = estimate(currentEstimateQty());
    $('#summary-price').textContent = '~' + money(n * e.perHat);
    $('#summary-price-detail').textContent = n > 0 ? '(' + n + ' x ' + money(e.perHat) + ')' : '';
    $('#submit-btn').disabled = n === 0 || closed;
    if (document.body.contains($('#est-rows')) && !estQtyTouched) renderEstimator();
  }

  // ---------- progress ----------
  function renderProgress(counts) {
    var total = counts.totalHats || 0;
    liveTotal = total;
    renderEstimator();
    updateSummary();
    var pct = Math.min(100, (total / C.minTotal) * 100);
    $('#total-count').textContent = total;
    $('#total-fill').style.width = pct + '%';
    $('#total-goal').style.left = 'calc(100% - 2px)';
    $('#total-bar').setAttribute('aria-valuenow', total);
    $('#total-bar').classList.toggle('is-met', total >= C.minTotal);
    var orders = counts.totalOrders || 0;
    var note;
    if (total >= C.minTotal) {
      note = 'Minimum reached. ' + plural(orders, 'classmate') + ' in so far. More orders still welcome until the window closes.';
    } else {
      note = plural(C.minTotal - total, 'more hat') + ' needed to hit the minimum. ' + plural(orders, 'classmate') + ' in so far.';
    }
    $('#total-note').textContent = note;

    var grid = $('#design-progress');
    grid.innerHTML = C.designs.map(function (d) {
      var n = (counts.byDesign && counts.byDesign[d.id]) || 0;
      var met = n >= C.minPerDesign;
      var p = Math.min(100, (n / C.minPerDesign) * 100);
      return (
        '<div class="progress-card">' +
          '<div class="progress-card-head"><span class="design-letter">' + d.id + '</span><span class="progress-card-name">' + escapeHtml(d.name) + '</span></div>' +
          '<div class="bar' + (met ? ' is-met' : '') + '"><div class="bar-fill" style="width:' + p + '%"></div></div>' +
          '<div class="progress-card-count"><span><strong>' + n + '</strong> / ' + C.minPerDesign + '</span>' +
          '<span class="status-pill ' + (met ? 'met' : 'short') + '">' + (met ? 'Min hit' : (C.minPerDesign - n) + ' to go') + '</span></div>' +
        '</div>'
      );
    }).join('');

    $('#progress-updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '. Counts include unpaid pre-orders.';
  }

  function demoOrders() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch (e) { return []; }
  }
  function demoCounts() {
    var orders = demoOrders();
    var by = {};
    var total = 0;
    orders.forEach(function (o) {
      Object.keys(o.qty).forEach(function (k) { by[k] = (by[k] || 0) + o.qty[k]; total += o.qty[k]; });
    });
    return { ok: true, totalHats: total, totalOrders: orders.length, byDesign: by };
  }

  function loadCounts() {
    if (DEMO) { renderProgress(demoCounts()); return Promise.resolve(); }
    return fetch(C.apiUrl + '?action=counts&_=' + Date.now(), { method: 'GET', redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (j) { renderProgress(j); })
      .catch(function () {
        $('#progress-updated').textContent = "Couldn't load current totals. Ordering still works.";
      });
  }

  // ---------- form ----------
  function showError(msg) {
    var el = $('#form-error');
    el.textContent = msg;
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function validate(form) {
    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim().toLowerCase(),
      phone: form.phone.value.trim(),
      classYear: (form.querySelector('[name="classYear"]:checked') || {}).value || '',
      payment: (form.querySelector('[name="payment"]:checked') || {}).value || '',
      notes: form.notes.value.trim(),
      accessCode: accessCode,
      website: form.website.value, // honeypot
      qty: qty,
    };
    $$('.field input').forEach(function (i) { i.classList.remove('is-invalid'); });

    if (totalHats() === 0) return { error: 'Pick at least one hat above.' };
    if (data.name.length < 2) { form.name.classList.add('is-invalid'); return { error: 'Please enter your full name.' }; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { form.email.classList.add('is-invalid'); return { error: 'That email doesn\'t look right.' }; }
    if (data.phone.replace(/\D/g, '').length < 10) { form.phone.classList.add('is-invalid'); return { error: 'Please enter a phone number with area code.' }; }
    if (!data.classYear) return { error: 'Pick your class year.' };
    if (!data.payment) return { error: 'Let us know whether you\'ll pay by Venmo or Zelle.' };
    return { data: data };
  }

  function submitOrder(data) {
    if (DEMO) {
      var orders = demoOrders();
      if (orders.some(function (o) { return o.email === data.email; })) {
        return Promise.resolve({ ok: false, error: 'There is already a pre-order under that email. Email ' + C.organizerName + ' to change it.' });
      }
      var id = 'DEMO-' + Math.random().toString(36).slice(2, 7).toUpperCase();
      orders.push({ id: id, email: data.email, qty: Object.assign({}, data.qty), ts: Date.now() });
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(orders)); } catch (e) { /* ignore */ }
      return new Promise(function (res) { setTimeout(function () { res({ ok: true, orderId: id }); }, 500); });
    }
    return fetch(C.apiUrl, {
      method: 'POST',
      redirect: 'follow',
      // text/plain avoids a CORS preflight, which Apps Script can't answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data),
    }).then(function (r) { return r.json(); });
  }

  function showSuccess(data, result) {
    var n = totalHats();
    $('#order-form').hidden = true;
    var s = $('#success');
    s.hidden = false;
    $('#success-copy').innerHTML =
      'Thanks, ' + escapeHtml(data.name.split(' ')[0]) + '. Your pre-order for <strong>' + plural(n, 'hat') + '</strong> is logged' +
      (result.orderId ? ' (ref <code>' + escapeHtml(result.orderId) + '</code>)' : '') +
      '. A confirmation is on its way to <strong>' + escapeHtml(data.email) + '</strong>.';

    var rows = C.designs.filter(function (d) { return qty[d.id] > 0; }).map(function (d) {
      return '<tr><td>' + d.id + ' &middot; ' + escapeHtml(d.name) + '</td><td>' + qty[d.id] + '</td></tr>';
    }).join('');
    var e = estimate(Math.max(C.minTotal, liveTotal + n));
    var totalLabel = plural(n, 'hat') + ' &middot; est. ' + money(n * e.perHat) + ' <span class="small muted">(' + money(e.perHat) + ' each at the ' + tierLabel(e.tier) + ' tier)</span>';
    $('#success-order').innerHTML = '<table><tbody>' + rows + '<tr class="total"><td>Total</td><td>' + totalLabel + '</td></tr></tbody></table>';
    s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadCounts();
  }

  function bindForm() {
    var form = $('#order-form');
    var btn = $('#submit-btn');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (closed) return;
      showError('');
      var v = validate(form);
      if (v.error) { showError(v.error); return; }
      btn.disabled = true;
      btn.classList.add('is-loading');
      submitOrder(v.data).then(function (res) {
        if (res && res.ok) {
          showSuccess(v.data, res);
        } else {
          showError((res && res.error) || 'Something went wrong. Try again or email ' + C.organizerEmail + '.');
        }
      }).catch(function () {
        showError('Couldn\'t reach the order server. Check your connection and try again, or email ' + C.organizerEmail + '.');
      }).then(function () {
        btn.classList.remove('is-loading');
        updateSummary();
      });
    });
  }

  // ---------- init ----------
  fillStatic();
  renderDesigns();
  updateSummary();
  bindForm();
  bindEstimator();
  renderEstimator();
  tickCountdown();
  setInterval(tickCountdown, 1000);
  initGate(function () {
    loadCounts();
    setInterval(loadCounts, 60000);
  });
})();
