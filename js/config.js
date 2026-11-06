// ============================================================
//  Pre-order site configuration
//  Edit this file to change the deadline, pricing, payment
//  handles, minimums, or the hat lineup. No other code changes
//  are needed for the common stuff.
// ============================================================
window.PREORDER_CONFIG = {
  // Google Apps Script web app URL (see README). Leave empty to run
  // the site in demo mode, which stores orders in this browser only.
  apiUrl: 'https://script.google.com/macros/s/AKfycbz79gj9sJzzcbspy2yG4Ws9YE_UbCAcA5jdWpDeJ2vIeLR1ec0L952WETs8DYmfw3LB2w/exec',

  // Password gate. This is the SHA-256 hash of the password, lowercased.
  // Regenerate with:  printf 'newpassword' | sha256sum
  // Set to '' to remove the gate. Keep Code.gs ACCESS_CODE in sync.
  accessCodeHash: 'ea637674efdab3bd4328ce15f307b4d588e0fa0d012650b99f910d522174c881',

  organizerName: 'Colby',
  organizerEmail: 'hoffercolby@gmail.com',

  // Order window closes at this time. Use an ISO string with offset.
  // Central Time is -05:00 during daylight time, -06:00 after the first Sunday in November.
  deadline: '2026-11-13T23:59:00-06:00',
  // Time zone used when showing the deadline to visitors.
  displayTimeZone: 'America/Chicago',

  // Pricing, from the Branded Bills custom pricing sheet (260901).
  // Both hat styles (#545-05R, #500-00X) are in the Signature Collection.
  // The estimator picks the tier from the live order count, adds the
  // side patch, then tax and a shipping share. Keep Code.gs PRICING in sync.
  pricing: {
    collection: 'Signature Collection',
    tiers: [
      { min: 24, max: 49, base: 28.00 },
      { min: 50, max: 99, base: 26.00 },
      { min: 100, max: 249, base: 24.50 },
      { min: 250, max: 599, base: 23.00 },
      { min: 600, max: 999, base: 21.50 },
      { min: 1000, max: null, base: 21.00 },
    ],
    sidePatch: 6.00,        // "Side PVC or Silicone" add-on, per hat
    taxRate: 0.0825,        // Austin sales tax. Applied to hats + shipping.
    shippingTotal: 30.00,   // PLACEHOLDER: estimated shipping for the whole order, split across hats
    sheetVersion: '260901',
  },

  // Group order minimums from Branded Bills.
  minTotal: 24,
  minPerDesign: 6,
  maxPerDesignPerPerson: 5,

  classYears: ['2027', '2028'],

  payment: {
    venmo: '@ColbyHoffer',
    zelle: '214-670-2136',
  },

  designs: [
    {
      id: 'A',
      name: 'Burnt Orange / White Rope',
      style: '#545-05R Curved 5-Panel Rope',
      colorway: 'Burnt orange crown and bill, white rope',
      image: 'images/design-a.png',
      sideImage: 'images/side-a.png',
      sidePatch: 'F2 all-white Longhorn',
      swatch: ['#BF5700', '#FFFFFF'],
    },
    {
      id: 'B',
      name: 'Black / Burnt Orange Rope',
      style: '#545-05R Curved 5-Panel Rope',
      colorway: 'Black crown and bill, burnt orange rope',
      image: 'images/design-b.png',
      sideImage: 'images/side-b.png',
      sidePatch: 'F1 burnt orange Longhorn',
      swatch: ['#1A1A1A', '#BF5700'],
    },
    {
      id: 'C',
      name: 'White / Burnt Orange Rope',
      style: '#545-05R Curved 5-Panel Rope',
      colorway: 'White crown and bill, burnt orange rope',
      image: 'images/design-c.png',
      sideImage: 'images/side-c.png',
      sidePatch: 'F1 burnt orange Longhorn',
      swatch: ['#FFFFFF', '#BF5700'],
    },
    {
      id: 'D',
      name: 'Burnt Orange Performance',
      style: '#500-00X Curved Performance',
      colorway: 'Burnt orange, no rope, moisture-wicking',
      image: 'images/design-d.png',
      sideImage: 'images/side-d.png',
      sidePatch: 'F2 all-white Longhorn',
      swatch: ['#BF5700'],
    },
  ],

  patch: {
    type: '3D PVC rubber patch',
    size: '2.8 in x 2.17 in',
    sideType: '3D PVC rubber Longhorn side patch',
    sideSize: '2.39 in x 1.25 in',
  },
};
