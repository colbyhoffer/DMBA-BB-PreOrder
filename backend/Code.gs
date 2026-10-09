/**
 * Texas McCombs Hat Pre-Order: Google Apps Script backend
 *
 * Stores pre-orders in a Google Sheet and exposes two endpoints:
 *   GET  ?action=counts  -> current totals (used for the progress bars)
 *   POST (JSON body)     -> submit a pre-order
 *
 * Setup is in the repo README. Short version:
 *   1. Create a Google Sheet. Extensions > Apps Script. Paste this file.
 *   2. Edit CONFIG below. Run `setup` once (authorize when prompted).
 *   3. Deploy > New deployment > Web app. Execute as: Me.
 *      Who has access: Anyone. Copy the web app URL into js/config.js.
 */

var CONFIG = {
  SHEET_NAME: 'Orders',
  SUMMARY_SHEET_NAME: 'Summary',

  // Must match js/config.js. ISO string with offset. '' disables enforcement.
  DEADLINE: '2026-10-16T23:59:00-05:00',

  DESIGNS: ['A', 'B', 'C', 'D'],
  DESIGN_NAMES: {
    A: 'Burnt Orange / White Rope',
    B: 'Black / Burnt Orange Rope',
    C: 'White / Burnt Orange Rope',
    D: 'Burnt Orange Performance',
  },
  MAX_PER_DESIGN: 5,
  MIN_TOTAL: 24,
  MIN_PER_DESIGN: 6,

  // Organizer notifications. Leave blank to turn off.
  NOTIFY_EMAIL: '',

  // Confirmation email to the person who ordered.
  SEND_CONFIRMATION: true,
  ORGANIZER_NAME: 'Colby',
  ORGANIZER_FULL_NAME: 'Colby Hoffer',
  ORGANIZER_PHONE: '214-670-2136',
  ORGANIZER_EMAIL: 'hoffercolby@gmail.com',
  REPLY_TO: 'hoffercolby@gmail.com',
  VENMO: '@ColbyHoffer',
  ZELLE: '214-670-2136',
  PRICE_PER_HAT: null,    // number, or null if TBD
};

var HEADERS = [
  'Order ID', 'Timestamp', 'Name', 'Email', 'Phone', 'Class Year', 'Payment Method',
  'Qty A', 'Qty B', 'Qty C', 'Qty D', 'Total Hats', 'Notes', 'Paid?', 'Amount Paid',
];

// ---------------------------------------------------------------- endpoints

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'counts';
  if (action === 'counts') return json_(getCounts_());
  return json_({ ok: false, error: 'Unknown action' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json_({ ok: false, error: 'Server busy, please try again.' });
  }
  try {
    var body = {};
    try {
      body = JSON.parse(e.postData.contents || '{}');
    } catch (err) {
      return json_({ ok: false, error: 'Bad request.' });
    }

    // Honeypot
    if (body.website) return json_({ ok: true, orderId: 'OK' });

    if (CONFIG.DEADLINE && new Date() > new Date(CONFIG.DEADLINE)) {
      return json_({ ok: false, error: 'The pre-order window has closed.' });
    }

    var name = clean_(body.name, 80);
    var email = clean_(body.email, 120).toLowerCase();
    var phone = clean_(body.phone, 30);
    var classYear = clean_(body.classYear, 10);
    var payment = clean_(body.payment, 20);
    var notes = clean_(body.notes, 200);

    if (name.length < 2) return json_({ ok: false, error: 'Name is required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: 'Valid email is required.' });
    if (phone.replace(/\D/g, '').length < 10) return json_({ ok: false, error: 'Phone number is required.' });
    if (!classYear) return json_({ ok: false, error: 'Class year is required.' });
    if (!payment) return json_({ ok: false, error: 'Payment method is required.' });

    var q = {};
    var total = 0;
    CONFIG.DESIGNS.forEach(function (id) {
      var n = parseInt((body.qty || {})[id], 10) || 0;
      n = Math.max(0, Math.min(CONFIG.MAX_PER_DESIGN, n));
      q[id] = n;
      total += n;
    });
    if (total === 0) return json_({ ok: false, error: 'Pick at least one hat.' });

    var sheet = getSheet_();
    if (emailExists_(sheet, email)) {
      return json_({ ok: false, error: 'There is already a pre-order under that email. Email ' + CONFIG.ORGANIZER_NAME + ' to change it.' });
    }

    var orderId = makeOrderId_();
    var row = [
      orderId, new Date(), name, email, phone, classYear, payment,
      q.A, q.B, q.C, q.D, total, notes, false, '',
    ];
    sheet.appendRow(row);

    var last = sheet.getLastRow();
    sheet.getRange(last, HEADERS.indexOf('Paid?') + 1).insertCheckboxes();

    try { sendEmails_(orderId, name, email, phone, classYear, payment, q, total, notes); } catch (err) { /* don't fail the order over email */ }

    return json_({ ok: true, orderId: orderId });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------- helpers

function getCounts_() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var by = {};
  CONFIG.DESIGNS.forEach(function (id) { by[id] = 0; });
  var totalHats = 0;
  var totalOrders = 0;
  if (lastRow > 1) {
    var firstQtyCol = HEADERS.indexOf('Qty A') + 1;
    var values = sheet.getRange(2, firstQtyCol, lastRow - 1, CONFIG.DESIGNS.length).getValues();
    values.forEach(function (r) {
      var rowTotal = 0;
      CONFIG.DESIGNS.forEach(function (id, i) {
        var n = parseInt(r[i], 10) || 0;
        by[id] += n;
        rowTotal += n;
      });
      if (rowTotal > 0) totalOrders += 1;
      totalHats += rowTotal;
    });
  }
  return {
    ok: true,
    totalHats: totalHats,
    totalOrders: totalOrders,
    byDesign: by,
    minTotal: CONFIG.MIN_TOTAL,
    minPerDesign: CONFIG.MIN_PER_DESIGN,
  };
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function emailExists_(sheet, email) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var col = HEADERS.indexOf('Email') + 1;
  var emails = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  return emails.some(function (r) { return String(r[0]).toLowerCase() === email; });
}

function makeOrderId_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = 'HAT-';
  for (var i = 0; i < 5; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').trim().slice(0, max);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sendEmails_(orderId, name, email, phone, classYear, payment, q, total, notes) {
  var lines = CONFIG.DESIGNS.filter(function (id) { return q[id] > 0; }).map(function (id) {
    return '  ' + id + '. ' + CONFIG.DESIGN_NAMES[id] + ' x ' + q[id];
  }).join('\n');
  var priceLine = CONFIG.PRICE_PER_HAT == null
    ? 'Price per hat: TBD (confirmed before payment is requested)'
    : 'Estimated total: $' + (total * CONFIG.PRICE_PER_HAT).toFixed(2) + ' (' + total + ' x $' + Number(CONFIG.PRICE_PER_HAT).toFixed(2) + ')';

  if (CONFIG.SEND_CONFIRMATION) {
    var body =
      'Hi ' + name.split(' ')[0] + ',\n\n' +
      'Your Texas McCombs hat pre-order is logged. Reference: ' + orderId + '\n\n' +
      lines + '\n\n' +
      'Total hats: ' + total + '\n' +
      priceLine + '\n\n' +
      'What happens next:\n' +
      '  1. Ordering closes ' + (CONFIG.DEADLINE ? new Date(CONFIG.DEADLINE).toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' CT' : 'soon') + '.\n' +
      '  2. If we hit ' + CONFIG.MIN_TOTAL + ' hats total and ' + CONFIG.MIN_PER_DESIGN + ' per design, ' + CONFIG.ORGANIZER_NAME + ' will email you the final amount.\n' +
      '  3. Pay by ' + payment + ' (Venmo ' + CONFIG.VENMO + ' / Zelle ' + CONFIG.ZELLE + '). Don\'t send anything until then.\n' +
      '  4. Once everyone has paid, the order goes to Branded Bills.\n\n' +
      'Questions or need to change something? Reply to this email or reach me directly:\n\n' +
      CONFIG.ORGANIZER_FULL_NAME + '\n' +
      CONFIG.ORGANIZER_PHONE + '\n' +
      CONFIG.ORGANIZER_EMAIL + '\n\n' +
      'Hook \'em,\n' + CONFIG.ORGANIZER_NAME;
    var opts = { name: 'McCombs Hat Pre-Order' };
    if (CONFIG.REPLY_TO) opts.replyTo = CONFIG.REPLY_TO;
    MailApp.sendEmail(email, 'Hat pre-order confirmed (' + orderId + ')', body, opts);
  }

  if (CONFIG.NOTIFY_EMAIL) {
    var counts = getCounts_();
    MailApp.sendEmail(
      CONFIG.NOTIFY_EMAIL,
      'New hat pre-order: ' + name + ' (' + total + ')',
      name + ' <' + email + '> ' + phone + ', class of ' + classYear + ', pays by ' + payment + '\n\n' +
      lines + '\n' + (notes ? '\nNotes: ' + notes + '\n' : '') +
      '\nRunning totals: ' + counts.totalHats + ' hats from ' + counts.totalOrders + ' people. ' +
      'A=' + counts.byDesign.A + ' B=' + counts.byDesign.B + ' C=' + counts.byDesign.C + ' D=' + counts.byDesign.D
    );
  }
}

// ---------------------------------------------------------------- one-time setup

/** Run this once from the editor to create the Orders and Summary sheets. */
function setup() {
  var sheet = getSheet_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var summary = ss.getSheetByName(CONFIG.SUMMARY_SHEET_NAME);
  if (!summary) summary = ss.insertSheet(CONFIG.SUMMARY_SHEET_NAME);
  summary.clear();
  var o = "'" + CONFIG.SHEET_NAME + "'!";
  var rows = [
    ['Metric', 'Value', 'Minimum', 'Status'],
    ['Total hats', '=SUM(' + o + 'L2:L)', CONFIG.MIN_TOTAL, '=IF(B2>=C2,"MET","SHORT BY "&(C2-B2))'],
    ['Total people', '=COUNTA(' + o + 'A2:A)', '', ''],
    ['Paid', '=COUNTIF(' + o + 'N2:N,TRUE)', '', '=IF(B3=0,"",B4&" of "&B3&" paid")'],
    ['', '', '', ''],
    ['Design', 'Hats', 'Minimum', 'Status'],
  ];
  CONFIG.DESIGNS.forEach(function (id, i) {
    var col = String.fromCharCode('H'.charCodeAt(0) + i);
    var r = rows.length + 1;
    rows.push([id + '. ' + CONFIG.DESIGN_NAMES[id], '=SUM(' + o + col + '2:' + col + ')', CONFIG.MIN_PER_DESIGN, '=IF(B' + r + '>=C' + r + ',"MET","SHORT BY "&(C' + r + '-B' + r + '))']);
  });
  summary.getRange(1, 1, rows.length, 4).setValues(rows);
  summary.getRange(1, 1, 1, 4).setFontWeight('bold');
  summary.getRange(6, 1, 1, 4).setFontWeight('bold');
  summary.autoResizeColumns(1, 4);
  Logger.log('Setup complete. Sheet "' + sheet.getName() + '" ready.');
}

/** Optional: run from the editor to sanity-check the POST handler without the site. */
function testPost() {
  var fake = { postData: { contents: JSON.stringify({
    name: 'Test Person', email: 'test+' + Date.now() + '@example.com', phone: '5125550123',
    classYear: '2027', payment: 'Venmo', notes: 'test', qty: { A: 1, B: 0, C: 2, D: 0 },
  }) } };
  Logger.log(doPost(fake).getContent());
  Logger.log(doGet({ parameter: { action: 'counts' } }).getContent());
}
