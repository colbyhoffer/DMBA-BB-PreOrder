(function () {
  'use strict';

  var C = window.PREORDER_CONFIG;
  var DEMO = !C.apiUrl;
  var DEMO_KEY = 'preorder-demo-orders';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var qty = {};
  C.designs.forEach(function (d) { qty[d.id] = 0; });

  var deadline = new Date(C.deadline);
  var closed = false;

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

  // ---------- static copy from config ----------
  function fillStatic() {
    $$('.organizer-name').forEach(function (el) { el.textContent = C.organizerName; });
    $('#min-total-copy').textContent = C.minTotal;
    $('#min-design-copy').textContent = C.minPerDesign;
    $('#total-min').textContent = C.minTotal;
    $('#faq-max').textContent = C.maxPerDesignPerPerson;
    $('#patch-type').textContent = C.patch.type;
    $('#patch-size').textContent = C.patch.size;
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
          '<div class="design-img"><img src="' + d.image + '" alt="Design ' + d.id + ': ' + escapeHtml(d.name) + '" loading="lazy"></div>' +
          '<div class="design-head"><span class="design-letter">' + d.id + '</span><span class="design-name">' + escapeHtml(d.name) + '</span><span class="swatches">' + swatches + '</span></div>' +
          '<p class="design-style">' + escapeHtml(d.style) + '</p>' +
          '<p class="design-colorway">' + escapeHtml(d.colorway) + '</p>' +
          '<div class="qty" role="group" aria-label="Quantity for design ' + d.id + '">' +
            '<button type="button" data-dir="-1" aria-label="Remove one">&minus;</button>' +
            '<span class="qty-value" aria-live="polite">0</span>' +
            '<button type="button" data-dir="1" aria-label="Add one">+</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    wrap.addEventListener('click', function (e) {
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
    if (C.pricePerHat == null) {
      $('#summary-price').textContent = 'TBD';
    } else {
      $('#summary-price').textContent = money(n * C.pricePerHat);
    }
    $('#submit-btn').disabled = n === 0 || closed;
  }

  // ---------- progress ----------
  function renderProgress(counts) {
    var total = counts.totalHats || 0;
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
    var totalLabel = C.pricePerHat == null ? plural(n, 'hat') + ' &middot; price TBD' : plural(n, 'hat') + ' &middot; ' + money(n * C.pricePerHat);
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
  tickCountdown();
  setInterval(tickCountdown, 1000);
  loadCounts();
  setInterval(loadCounts, 60000);
})();
