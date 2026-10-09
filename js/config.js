// ============================================================
//  Pre-order site configuration
//  Edit this file to change the deadline, pricing, payment
//  handles, minimums, or the hat lineup. No other code changes
//  are needed for the common stuff.
// ============================================================
window.PREORDER_CONFIG = {
  // Google Apps Script web app URL (see README). Leave empty to run
  // the site in demo mode, which stores orders in this browser only.
  apiUrl: '',

  organizerName: 'Colby',
  organizerEmail: 'hoffercolby@gmail.com',

  // Order window closes at this time. Use an ISO string with offset.
  // Central Time is -05:00 during daylight time, -06:00 in winter.
  deadline: '2026-10-16T23:59:00-05:00',
  // Time zone used when showing the deadline to visitors.
  displayTimeZone: 'America/Chicago',

  // Price per hat in USD. Set to null if you don't have the number yet;
  // the site will say the price is TBD.
  pricePerHat: null,

  // Group order minimums from Branded Bills.
  minTotal: 24,
  minPerDesign: 6,
  maxPerDesignPerPerson: 5,

  classYears: ['2027', '2028'],

  payment: {
    venmo: '@your-venmo',   // e.g. '@Colby-Hoffer'
    zelle: 'your-zelle',    // phone number or email tied to Zelle
  },

  designs: [
    {
      id: 'A',
      name: 'Burnt Orange / White Rope',
      style: '#545-05R Curved 5-Panel Rope',
      colorway: 'Burnt orange crown and bill, white rope',
      image: 'images/design-a.png',
      swatch: ['#BF5700', '#FFFFFF'],
    },
    {
      id: 'B',
      name: 'Black / Burnt Orange Rope',
      style: '#545-05R Curved 5-Panel Rope',
      colorway: 'Black crown and bill, burnt orange rope',
      image: 'images/design-b.png',
      swatch: ['#1A1A1A', '#BF5700'],
    },
    {
      id: 'C',
      name: 'White / Burnt Orange Rope',
      style: '#545-05R Curved 5-Panel Rope',
      colorway: 'White crown and bill, burnt orange rope',
      image: 'images/design-c.png',
      swatch: ['#FFFFFF', '#BF5700'],
    },
    {
      id: 'D',
      name: 'Burnt Orange Performance',
      style: '#500-00X Curved Performance',
      colorway: 'Burnt orange, no rope, moisture-wicking',
      image: 'images/design-d.png',
      swatch: ['#BF5700'],
    },
  ],

  patch: {
    type: '3D PVC rubber patch',
    size: '2.8 in x 2.17 in',
  },
};
