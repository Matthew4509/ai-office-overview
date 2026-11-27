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
    // South and Central America and the Caribbean (a region guess of +35 is a long way off for most of these).
    'America/Montevideo': [-34.9, -56.16], 'America/Asuncion': [-25.26, -57.58], 'America/La_Paz': [-16.5, -68.15],
    'America/Caracas': [10.49, -66.88], 'America/Guayaquil': [-2.17, -79.92], 'America/Manaus': [-3.12, -60.02],
    'America/Fortaleza': [-3.73, -38.52], 'America/Recife': [-8.05, -34.88], 'America/Bahia': [-12.97, -38.5],
    'America/Belem': [-1.46, -48.5], 'America/Maceio': [-9.67, -35.74], 'America/Araguaina': [-7.19, -48.21],
    'America/Cuiaba': [-15.6, -56.1], 'America/Campo_Grande': [-20.47, -54.62], 'America/Porto_Velho': [-8.76, -63.9],
    'America/Rio_Branco': [-9.97, -67.81], 'America/Boa_Vista': [2.82, -60.67], 'America/Santarem': [-2.44, -54.71],
    'America/Noronha': [-3.85, -32.42], 'America/Argentina/Cordoba': [-31.42, -64.18], 'America/Cordoba': [-31.42, -64.18],
    'America/Argentina/Mendoza': [-32.89, -68.83], 'America/Mendoza': [-32.89, -68.83], 'America/Argentina/Salta': [-24.79, -65.41],
    'America/Argentina/Ushuaia': [-54.8, -68.3], 'America/Punta_Arenas': [-53.16, -70.91], 'America/Paramaribo': [5.85, -55.2],
    'America/Cayenne': [4.92, -52.31], 'America/Guyana': [6.8, -58.16], 'America/Panama': [8.98, -79.52],
    'America/Costa_Rica': [9.93, -84.09], 'America/Guatemala': [14.63, -90.51], 'America/El_Salvador': [13.69, -89.22],
    'America/Tegucigalpa': [14.07, -87.19], 'America/Managua': [12.11, -86.24], 'America/Havana': [23.11, -82.37],
    'America/Jamaica': [18.0, -76.8], 'America/Santo_Domingo': [18.49, -69.93], 'America/Puerto_Rico': [18.47, -66.1],
    'America/Port_of_Spain': [10.65, -61.52], 'America/Barbados': [13.1, -59.61], 'America/Martinique': [14.6, -61.07],
    'America/Monterrey': [25.69, -100.32], 'America/Cancun': [21.16, -86.85], 'America/Tijuana': [32.51, -117.04],
    // North America beyond the big cities above.
    'America/Edmonton': [53.55, -113.49], 'America/Winnipeg': [49.9, -97.14], 'America/Regina': [50.45, -104.6],
    'America/St_Johns': [47.56, -52.71], 'America/Montreal': [45.5, -73.57], 'America/Detroit': [42.33, -83.05],
    'America/Nuuk': [64.18, -51.72], 'America/Godthab': [64.18, -51.72], 'America/Boise': [43.62, -116.2],
    'America/Miquelon': [47.1, -56.38], 'America/Scoresbysund': [70.49, -21.97], 'America/Danmarkshavn': [76.77, -18.67],
    // Africa.
    'Africa/Windhoek': [-22.56, 17.08], 'Africa/Maputo': [-25.97, 32.57], 'Africa/Harare': [-17.83, 31.05],
    'Africa/Lusaka': [-15.39, 28.32], 'Africa/Gaborone': [-24.65, 25.91], 'Africa/Maseru': [-29.31, 27.48],
    'Africa/Mbabane': [-26.3, 31.13], 'Africa/Luanda': [-8.84, 13.23], 'Africa/Kinshasa': [-4.44, 15.27],
    'Africa/Lubumbashi': [-11.66, 27.48], 'Africa/Dar_es_Salaam': [-6.79, 39.21], 'Africa/Kampala': [0.35, 32.58],
    'Africa/Kigali': [-1.95, 30.06], 'Africa/Blantyre': [-15.79, 35.01], 'Africa/Addis_Ababa': [9.03, 38.74],
    'Africa/Khartoum': [15.5, 32.56], 'Africa/Casablanca': [33.57, -7.59], 'Africa/Algiers': [36.75, 3.06],
    'Africa/Tunis': [36.8, 10.18], 'Africa/Tripoli': [32.89, 13.19], 'Africa/Accra': [5.6, -0.19],
    'Africa/Abidjan': [5.36, -4.01], 'Africa/Dakar': [14.72, -17.47],
    // Indian Ocean, the Pacific and the rest of Australia.
    'Indian/Mauritius': [-20.16, 57.5], 'Indian/Reunion': [-20.88, 55.45], 'Indian/Antananarivo': [-18.88, 47.51],
    'Indian/Maldives': [4.17, 73.51], 'Pacific/Fiji': [-18.14, 178.44], 'Pacific/Port_Moresby': [-9.44, 147.18],
    'Pacific/Noumea': [-22.27, 166.46], 'Pacific/Tongatapu': [-21.14, -175.2], 'Pacific/Apia': [-13.83, -171.76],
    'Pacific/Tahiti': [-17.53, -149.57], 'Pacific/Guam': [13.44, 144.79], 'Pacific/Chatham': [-43.95, -176.55],
    'Pacific/Efate': [-17.73, 168.32], 'Pacific/Guadalcanal': [-9.43, 159.95], 'Pacific/Kiritimati': [1.87, -157.43],
    'Pacific/Easter': [-27.11, -109.35], 'Pacific/Galapagos': [-0.9, -89.6], 'Pacific/Rarotonga': [-21.21, -159.78],
    'Australia/Lord_Howe': [-31.55, 159.08], 'Australia/Broken_Hill': [-31.95, 141.47], 'Australia/Lindeman': [-20.27, 149.0],
    'Australia/Eucla': [-31.68, 128.88], 'Australia/ACT': [-35.28, 149.13], 'Australia/NSW': [-33.87, 151.21],
    'Australia/Victoria': [-37.81, 144.96], 'Australia/Queensland': [-27.47, 153.03], 'Australia/South': [-34.93, 138.6],
    'Australia/West': [-31.95, 115.86], 'Australia/North': [-12.46, 130.84], 'Australia/Tasmania': [-42.88, 147.33],
    // Asia beyond the big cities above.
    'Asia/Kathmandu': [27.7, 85.32], 'Asia/Colombo': [6.93, 79.86], 'Asia/Kabul': [34.53, 69.17], 'Asia/Tashkent': [41.3, 69.24],
    'Asia/Almaty': [43.24, 76.89], 'Asia/Baku': [40.41, 49.87], 'Asia/Tbilisi': [41.72, 44.79], 'Asia/Yerevan': [40.18, 44.51],
    'Asia/Baghdad': [33.31, 44.36], 'Asia/Kuwait': [29.38, 47.99], 'Asia/Qatar': [25.29, 51.53], 'Asia/Muscat': [23.59, 58.41],
    'Asia/Beirut': [33.89, 35.5], 'Asia/Amman': [31.95, 35.93], 'Asia/Yangon': [16.87, 96.2], 'Asia/Phnom_Penh': [11.56, 104.92],
    'Asia/Makassar': [-5.14, 119.42], 'Asia/Jayapura': [-2.53, 140.72], 'Asia/Dili': [-8.56, 125.57],
    'Asia/Ulaanbaatar': [47.89, 106.91], 'Asia/Novosibirsk': [55.03, 82.92], 'Asia/Yekaterinburg': [56.84, 60.6],
    'Asia/Vladivostok': [43.12, 131.89],
  };
  /** For a zone not listed: a latitude by its region (the longitude comes from its offset from UTC). */
  const REGION_LAT = { Europe: 50, America: 35, Asia: 30, Africa: 5, Australia: -33, Pacific: -15, Atlantic: 40, Indian: -10, Antarctica: -75, Arctic: 78 };
  /** A region guess finer than REGION_LAT: Argentina's zones, and an American zone at UTC-3 or further east all year
   * (most of them are in South America). */
  function regionLat(z, behind) {
    if (/^America\/Argentina\//.test(z)) return -33;
    if (z.split('/')[0] === 'America' && behind <= 180) return -20;
    return REGION_LAT[z.split('/')[0]] ?? 0;
  }

  /** Where the sun is reckoned from: this PC's time zone, its city's name, and whether it is only a rough guess. */
  function place(zone, now = Date.now()) {
    const z = zone || (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })();
    const city = z.split('/').pop().replace(/_/g, ' ') || 'this PC';
    if (PLACES[z]) return { zone: z, city, lat: PLACES[z][0], lon: PLACES[z][1], rough: false };
    // The offset without summer time (the larger of January's and July's, in minutes behind UTC) gives the longitude.
    const y = new Date(now).getFullYear();
    const behind = Math.max(new Date(y, 0, 1).getTimezoneOffset(), new Date(y, 6, 1).getTimezoneOffset());
    return { zone: z, city, lat: regionLat(z, behind), lon: -behind / 4, rough: true };
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
      const picks = [...doc.querySelectorAll('[data-theme-pick]')];
      // One stop for Tab, as a radio group has: the choice in use (the first, for Match Windows, which is not on it);
      // the arrow keys move along it.
      const stop = picks.find((b) => b.dataset.themePick === choice) || picks[0];
      for (const b of picks) {
        b.setAttribute('aria-checked', String(b.dataset.themePick === choice));
        b.tabIndex = b === stop ? 0 : -1;
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
    // The arrow keys (and Home, End) move to the next choice and pick it, as in any radio group.
    doc.addEventListener('keydown', async (e) => {
      const b = e.target.closest?.('[data-theme-pick]');
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!b || (!step && e.key !== 'Home' && e.key !== 'End')) return;
      e.preventDefault();
      const picks = [...b.parentElement.querySelectorAll('[data-theme-pick]')];
      const i = picks.indexOf(b);
      const to = e.key === 'Home' ? picks[0] : e.key === 'End' ? picks.at(-1) : picks[(i + step + picks.length) % picks.length];
      for (const p of picks) p.tabIndex = p === to ? 0 : -1;
      to.focus();
      try { await choose(to.dataset.themePick); } catch (err) { window.aiOffice?.showFault?.(err); apply(); }
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
