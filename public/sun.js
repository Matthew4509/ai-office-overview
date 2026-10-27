// Day or night by the sun, for the Auto theme: light from sunrise to sunset, dark the rest. Where the sun rises is
// taken from this PC's time zone (its main city, or, for a zone not listed, the zone's offset and region), so it is
// close, not exact, and nothing is asked online. The same file runs in the office (Node, for the page's first colours)
// and on the page (window.officeSun), where it also keeps the theme: the header's sun / moon / auto switch.
'use strict';

(function (root, make) {
  const sun = make();
  if (typeof module === 'object' && module.exports) module.exports = sun;
  else root.officeSun = sun;
})(typeof self !== 'undefined' ? self : this, () => {
  /** The main city of common time zones: [latitude, longitude]. */
  const PLACES = {
    'Australia/Sydney': [-33.87, 151.21], 'Australia/Melbourne': [-37.81, 144.96], 'Australia/Brisbane': [-27.47, 153.03],
    'Australia/Adelaide': [-34.93, 138.6], 'Australia/Perth': [-31.95, 115.86], 'Australia/Hobart': [-42.88, 147.33],
    'Australia/Darwin': [-12.46, 130.84], 'Australia/Canberra': [-35.28, 149.13], 'Pacific/Auckland': [-36.85, 174.76],
    'Asia/Tokyo': [35.68, 139.69], 'Asia/Seoul': [37.57, 126.98], 'Asia/Shanghai': [31.23, 121.47], 'Asia/Hong_Kong': [22.32, 114.17],
    'Asia/Taipei': [25.03, 121.57], 'Asia/Singapore': [1.35, 103.82], 'Asia/Kuala_Lumpur': [3.14, 101.69], 'Asia/Bangkok': [13.76, 100.5],
    'Asia/Jakarta': [-6.2, 106.85], 'Asia/Manila': [14.6, 120.98], 'Asia/Ho_Chi_Minh': [10.82, 106.63], 'Asia/Kolkata': [22.57, 88.36],
    'Asia/Calcutta': [22.57, 88.36], 'Asia/Dubai': [25.2, 55.27], 'Asia/Karachi': [24.86, 67.0], 'Asia/Dhaka': [23.81, 90.41],
    'Asia/Tehran': [35.69, 51.39], 'Asia/Jerusalem': [31.77, 35.21], 'Asia/Riyadh': [24.71, 46.68], 'Europe/London': [51.51, -0.13],
    'Europe/Dublin': [53.35, -6.26], 'Europe/Paris': [48.86, 2.35], 'Europe/Berlin': [52.52, 13.4], 'Europe/Madrid': [40.42, -3.7],
    'Europe/Rome': [41.9, 12.5], 'Europe/Amsterdam': [52.37, 4.9], 'Europe/Brussels': [50.85, 4.35], 'Europe/Zurich': [47.38, 8.54],
    'Europe/Vienna': [48.21, 16.37], 'Europe/Stockholm': [59.33, 18.07], 'Europe/Oslo': [59.91, 10.75], 'Europe/Copenhagen': [55.68, 12.57],
    'Europe/Helsinki': [60.17, 24.94], 'Europe/Warsaw': [52.23, 21.01], 'Europe/Prague': [50.08, 14.44], 'Europe/Athens': [37.98, 23.73],
    'Europe/Istanbul': [41.01, 28.98], 'Europe/Moscow': [55.76, 37.62], 'Europe/Lisbon': [38.72, -9.14], 'Europe/Kyiv': [50.45, 30.52],
    'Europe/Kiev': [50.45, 30.52], 'Africa/Johannesburg': [-26.2, 28.05], 'Africa/Cairo': [30.04, 31.24], 'Africa/Lagos': [6.52, 3.38],
    'Africa/Nairobi': [-1.29, 36.82], 'America/New_York': [40.71, -74.01], 'America/Chicago': [41.88, -87.63], 'America/Denver': [39.74, -104.99],
    'America/Los_Angeles': [34.05, -118.24], 'America/Phoenix': [33.45, -112.07], 'America/Anchorage': [61.22, -149.9],
    'America/Toronto': [43.65, -79.38], 'America/Vancouver': [49.28, -123.12], 'America/Halifax': [44.65, -63.57],
    'America/Mexico_City': [19.43, -99.13], 'America/Sao_Paulo': [-23.55, -46.63], 'America/Argentina/Buenos_Aires': [-34.6, -58.38],
    'America/Buenos_Aires': [-34.6, -58.38], 'America/Santiago': [-33.45, -70.67], 'America/Bogota': [4.71, -74.07], 'America/Lima': [-12.05, -77.04],
    'Pacific/Honolulu': [21.31, -157.86], 'Atlantic/Reykjavik': [64.15, -21.94],
  };
  /** For a zone not listed: a latitude by its region (the longitude comes from its offset from UTC). */
  const REGION_LAT = { Europe: 50, America: 35, Asia: 30, Africa: 5, Australia: -33, Pacific: -15, Atlantic: 40, Indian: -10, Antarctica: -75, Arctic: 78 };

  /** Where the sun is reckoned from: this PC's time zone, its city's name, and whether it is only a rough guess. */
  function place(zone, now = Date.now()) {
    const z = zone || (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();
    const city = z.split('/').pop().replace(/_/g, ' ') || 'this PC';
    if (PLACES[z]) return { zone: z, city, lat: PLACES[z][0], lon: PLACES[z][1], rough: false };
    // The offset without summer time (the larger of January's and July's, in minutes behind UTC) gives the longitude.
    const y = new Date(now).getFullYear();
    const behind = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
    return { zone: z, city, lat: REGION_LAT[z.split('/')[0]] ?? 0, lon: -behind / 4, rough: true };
  }

  /** Sunrise and sunset (ms) on the local day of `now`, by NOAA's simple formulas; a day the sun does not rise or set
   * says so instead ({ polar: 'day' | 'night' }). */
  function times(now, lat, lon) {
    // The local calendar day (not the UTC day of local noon, which is yesterday at UTC+13 and +14).
    const d = new Date(now);
    const dayStart = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const n = Math.round((dayStart - Date.UTC(d.getFullYear(), 0, 1)) / 864e5) + 1;
    const g = (2 * Math.PI / 365) * (n - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const la = (lat * Math.PI) / 180;
    const c = Math.cos((90.833 * Math.PI) / 180) / (Math.cos(la) * Math.cos(decl)) - Math.tan(la) * Math.tan(decl);
    if (c > 1) return { polar: 'night' };
    if (c < -1) return { polar: 'day' };
    const ha = (Math.acos(c) * 180) / Math.PI;
    return { rise: dayStart + (720 - 4 * (lon + ha) - eq) * 60000, set: dayStart + (720 - 4 * (lon - ha) - eq) * 60000 };
  }

  /** Is the sun up now, where this PC's time zone says it is? */
  function isDay(now = Date.now(), at = place(undefined, now)) {
    const t = times(now, at.lat, at.lon);
    return t.polar ? t.polar === 'day' : now >= t.rise && now < t.set;
  }
  /** The colours a theme choice means now: 'auto' by the sun; 'system' left to Windows (the page's own CSS). */
  const resolve = (choice, now = Date.now()) => (choice === 'auto' ? (isDay(now) ? 'light' : 'dark') : choice);

  // ---- On the page: the theme in use, kept by the sun while it is Auto, and the header's switch ----
  function keep(doc) {
    const html = doc.documentElement;
    const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    /** Today's sunrise and sunset in words, and where they are reckoned from. */
    function today() {
      const at = place();
      const t = times(Date.now(), at.lat, at.lon);
      const where = at.rough ? `roughly, from this PC's time zone (${at.zone || 'unknown'})` : `near ${at.city}, from this PC's time zone`;
      if (t.polar) return `The sun ${t.polar === 'day' ? 'does not set' : 'does not rise'} today ${where}.`;
      return `today the sun rises at ${clock(t.rise)} and sets at ${clock(t.set)} ${where}.`.replace(/^t/, 'T');
    }
    const apply = () => {
      const choice = html.dataset.themeChoice || html.dataset.theme || 'light';
      const want = resolve(choice);
      if (html.dataset.theme !== want) html.dataset.theme = want;
      for (const b of doc.querySelectorAll('[data-theme-pick]')) {
        b.setAttribute('aria-checked', String(b.dataset.themePick === choice));
        if (b.dataset.themePick === 'auto') b.title = `Auto: light from sunrise to sunset, dark at night. ${today()}`;
      }
    };
    /** A choice made (the switch or Setup): saved by the office, used at once. */
    async function choose(choice) {
      await window.aiOffice.api('/api/settings', { theme: choice });
      html.dataset.themeChoice = choice;
      apply();
    }
    doc.addEventListener('click', async (e) => {
      const b = e.target.closest?.('[data-theme-pick]');
      if (!b) return;
      try { await choose(b.dataset.themePick); } catch (err) { window.aiOffice?.showFault?.(err); }
    });
    setInterval(apply, 60000);
    doc.addEventListener('visibilitychange', apply);
    self.addEventListener('focus', apply);
    apply();
    return { apply, choose, today };
  }

  const api = { PLACES, place, times, isDay, resolve };
  if (typeof document !== 'undefined') api.theme = keep(document);
  return api;
});
