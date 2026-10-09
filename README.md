# Texas McCombs Hat Pre-Order

A one-page pre-order site for a group hat order from Branded Bills. Static HTML/CSS/JS on the front, a Google Sheet (via Apps Script) on the back. No framework, no build step, nothing to pay for.

**What it does**

- Shows the four designs with live progress toward the minimums (24 total, 6 per design)
- Collects name, email, phone, class year (2027/2028), payment method (Venmo/Zelle), and hat quantities
- Rejects duplicate emails, blocks submissions after the deadline, and hides a honeypot from bots
- Writes every order to a Google Sheet you own, with a Summary tab and a "Paid?" checkbox column
- Emails each person a confirmation with their order and the payment plan (optional)
- Runs in a demo mode (orders stored in the browser) until the backend is connected

## Setup (about 10 minutes)

### 1. Backend: Google Sheet + Apps Script

1. Create a new Google Sheet at [sheets.new](https://sheets.new). Name it something like "McCombs Hat Orders".
2. Go to **Extensions > Apps Script**. Delete the placeholder code and paste in the contents of [`backend/Code.gs`](backend/Code.gs).
3. Edit the `CONFIG` block at the top:
   - `DEADLINE`: same value you'll put in `js/config.js`
   - `VENMO`, `ZELLE`: your handles
   - `PRICE_PER_HAT`: the per-hat price once you have it, or leave `null`
   - `NOTIFY_EMAIL`: your email if you want a ping on every order
4. Save, then pick `setup` from the function dropdown and click **Run**. Authorize it when prompted (it only touches this sheet and sends mail as you). This creates the `Orders` and `Summary` tabs.
5. Click **Deploy > New deployment**. Type: **Web app**. Execute as: **Me**. Who has access: **Anyone**. Click Deploy and copy the Web app URL (ends in `/exec`).

Any time you change `Code.gs` later, you need **Deploy > Manage deployments > edit > New version** for the change to go live.

### 2. Site config

Open [`js/config.js`](js/config.js) and set:

- `apiUrl`: the `/exec` URL from step 5
- `deadline`: ISO timestamp with timezone offset (Central is `-05:00` during daylight time)
- `pricePerHat`: number or `null`
- `payment.venmo` and `payment.zelle`
- `organizerEmail` if it's not already right

Everything else (designs, minimums, class years) is already filled in from the Branded Bills design sheet.

### 3. Host it on GitHub Pages

1. Merge this branch to `main`.
2. Repo **Settings > Pages**. Source: **Deploy from a branch**. Branch: `main`, folder `/ (root)`. Save.
3. The site will be at `https://<your-username>.github.io/DMBA-BB-PreOrder/` in a minute or two.

Any static host works (Netlify, Vercel, Cloudflare Pages). Just serve the repo root.

## Running the order

- Watch the **Summary** tab in the sheet for totals and which designs are short.
- When the window closes, the site stops accepting orders on its own (client and server both check the deadline).
- Message everyone with the final per-person amount. As money comes in, tick the **Paid?** box on their row; the Summary tab tracks paid vs. total.
- Designs that didn't hit 6: contact those people to swap or drop. Edit their row in the sheet directly.
- Once everyone has paid, place the order with Branded Bills using the Qty columns.

Need to extend the deadline? Change it in both `js/config.js` and `Code.gs` (then redeploy the script).

## Local preview

Open `index.html` in a browser, or run any static server:

```
python3 -m http.server 8000
```

With `apiUrl` empty the site runs in demo mode and stores orders in `localStorage` so you can click through the whole flow.

## Files

```
index.html        page markup
css/styles.css    styles (UT brand colors)
js/config.js      everything you'd want to change
js/app.js         form, progress bars, countdown, submission
backend/Code.gs   Apps Script backend (paste into your sheet)
images/           hat renders cropped from the Branded Bills design sheet
```
