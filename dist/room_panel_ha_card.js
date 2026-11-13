/* Raum-Panel v2 – Wandtablet-Dashboard im Block-Raster: Glasrahmen mit eigenständigen Modulen
   (Licht, Heizung, Wetter, Raumklima, Grundriss, Audio, Statusleiste, beliebige HA-Karten).
   Läuft getrennt von raum-tablet-card (v1); gemeinsame Bausteine unten sind von dort übernommen. */
const RP_VERSION = '2.106.0-beta.1';
// Ablageort dieser Datei (fonts/ und rp-icons/ liegen daneben), z. B. /hacsfiles/room_panel_ha_card/ oder /local/raum-tablet-card/
const RP_BASE = (() => {
  const dir = s => String(s).replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  try { if (document.currentScript && document.currentScript.src) return dir(document.currentScript.src); } catch (e) { /* Modul: kein currentScript */ }
  try { throw new Error(); } catch (e) {
    const st = String(e.stack || ''), m = st.match(/((?:https?|file):\/\/[^\s)'"]*?\/)(?:room_panel_ha_card|raum-panel)\.js/) || st.match(/((?:https?|file):\/\/[^\s)'"]*?\/)[^/\s)'"]+\.js/);
    if (m) return m[1];
  }
  try { const r = (performance.getEntriesByType('resource') || []).find(x => /\/(?:room_panel_ha_card|raum-panel)\.js/.test(x.name)); if (r) return dir(r.name); } catch (e) { /* Standardpfad */ }
  return '/local/raum-tablet-card/';
})();
// Optik des eingebetteten Haus-Grundriss-Ausschnitts (werden 1:1 an haus-grundriss durchgereicht)
const HG_LOOK = ['rund', 'rahmen', 'rahmen_farbe', 'schatten', 'schatten_staerke', 'schatten_transparenz', 'schatten_abstand', 'hier', 'hier_text', 'hier_farbe', 'here', 'here_text', 'here_color', 'hier_puls', 'here_pulse', 'hier_icon', 'here_icon', 'ansicht', 'stil', 'neigung', 'wandhoehe', 'schatten3d', 'bewegen3d', 'tageslicht', 'knopf3d', 'raum', 'raum_filter', 'verdecken3d', 'lichtschatten', 'masse3d', 'wetter', 'decke3d', 'halbe_waende', 'raumnamen', 'knopf_raeume', 'knopf_kuerzel', 'heizung_anzeige', 'flammen3d', 'raum_tafel', 'raum_werte', 'blick3d', 'werte_unten', 'neigung', 'wand_schnitt', 'gebaeude', 'nachbarhaus', 'nachbarwohnungen', 'nur_raum'];
const W = 1280, H = 800;
const NA = ['unavailable', 'unknown'];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Display-Transparenz (0–100 %) als Deckkraft --lcda am Element setzen; ohne Wert erbt es von außen (Panel → Rahmen → Modul → Element)
const setLcda = (el, v) => { if (!el) return; const n = Number(v); if (v == null || v === '' || !isFinite(n)) el.style.removeProperty('--lcda'); else el.style.setProperty('--lcda', (1 - clamp(n, 0, 100) / 100).toFixed(3)); };
const pad3 = n => String(Math.round(n)).padStart(3, '0');
const de = (n, d = 1) => (n == null || isNaN(n)) ? '--' : Number(n).toFixed(d).replace('.', ',');
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? '--:--' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); };
const rgba = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const hsCss = (h, s) => { const v = 1, sv = s / 100, l = v * (1 - sv / 2), sl = (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l); return `hsl(${Math.round(h)},${Math.round(sl * 100)}%,${Math.round(l * 100)}%)`; };
const KSTOPS = [[2000, [255, 138, 43]], [2700, [255, 194, 122]], [4000, [255, 241, 220]], [5500, [223, 234, 255]], [6500, [159, 195, 255]]];
const kCss = k => { k = clamp(k, 2000, 6500); for (let i = 1; i < KSTOPS.length; i++) { const [k1, c1] = KSTOPS[i - 1], [k2, c2] = KSTOPS[i]; if (k <= k2) { const t = (k - k1) / (k2 - k1); return `rgb(${c1.map((c, j) => Math.round(c + (c2[j] - c) * t)).join(',')})`; } } return 'rgb(159,195,255)'; };
const hueName = h => ['Rot', 'Orange', 'Gelb', 'Grün', 'Grün', 'Cyan', 'Blau', 'Blau', 'Violett', 'Magenta', 'Pink', 'Rot'][Math.floor(((h % 360) + 15) / 30) % 12];
const kelName = k => k < 3300 ? 'Warmweiß' : k < 5000 ? 'Neutralweiß' : 'Kaltweiß';
const isoWeek = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); };

// Lautstärke-Farbe (für alle Kanäle gleich): cyan < 25 % · grün ab 25 % · gelb ab 45 % · orange ab 75 % · rot ab 90 %
// Stützpunkte [Anteil, Farbton], dazwischen kurze weiche Übergänge
const VHUE = [[0, 199], [.22, 199], [.25, 135], [.42, 118], [.45, 54], [.72, 48], [.75, 30], [.87, 26], [.9, 3], [1, 0]];
const volCol = (f, dim = 1) => {
  f = clamp(f, 0, 1);
  let h = 0;
  for (let i = 1; i < VHUE.length; i++) { const [f1, h1] = VHUE[i - 1], [f2, h2] = VHUE[i]; if (f <= f2) { h = h1 + (h2 - h1) * (f - f1) / (f2 - f1); break; } }
  return `hsl(${Math.round(h)},100%,${Math.round(60 * dim)}%)`;
};
// Temperatur-Farbe des Z906: blau < 30 °C · grün ab 30 · gelb ab 50 · orange ab 65 · rot ab 75 °C
const THUE = [[0, 205], [28, 205], [31, 135], [48, 120], [51, 54], [63, 48], [66, 30], [73, 26], [76, 3], [150, 0]];
const tempCol = t => {
  t = clamp(t, 0, 150);
  let h = 0;
  for (let i = 1; i < THUE.length; i++) { const [t1, h1] = THUE[i - 1], [t2, h2] = THUE[i]; if (t <= t2) { h = h1 + (h2 - h1) * (t - t1) / (t2 - t1); break; } }
  return `hsl(${Math.round(h)},100%,60%)`;
};

// Sonnenstand (vereinfachte NOAA-Formel, Genauigkeit < 1°): Höhe in Grad + ob die Sonne steigt
const sunPos = (d, lat, lon) => {
  const R = Math.PI / 180, n = (d.getTime() - 946728000000) / 864e5;
  const g = (357.529 + .98560028 * n) * R, q = 280.459 + .98564736 * n;
  const L = (q + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * R, e = (23.439 - 3.6e-7 * n) * R;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ha = (((18.697374558 + 24.06570982441908 * n) * 15 + lon - ra / R) % 360 + 540) % 360 - 180;
  const el = Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha * R)) / R;
  // Azimut ab Nord (90 = Ost, 180 = Süd, 270 = West)
  const az = (Math.atan2(Math.sin(ha * R), Math.cos(ha * R) * Math.sin(lat * R) - Math.tan(dec) * Math.cos(lat * R)) / R + 180 + 360) % 360;
  return { el, rising: ha < 0, az };
};
// Sonne + Mond: Höhe/Azimut (ab Nord) und Mondphase (0 Neumond · 0,25 erstes Viertel · 0,5 Vollmond · 0,75 letztes Viertel)
const AST = (() => {
  const rad = Math.PI / 180, e = rad * 23.4397, J1970 = 2440588, J2000 = 2451545;
  const days = d => d.valueOf() / 864e5 - .5 + J1970 - J2000;
  const ra = (l, b) => Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = (l, b) => Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const azi = (H, phi, d) => Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi));
  const alt = (H, phi, d) => Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H));
  const sid = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  const refr = h => (h < 0 ? 0 : .0002967 / Math.tan(h + .00312536 / (h + .08901179)));
  const sunC = d => { const M = rad * (357.5291 + .98560028 * d), C = rad * (1.9148 * Math.sin(M) + .02 * Math.sin(2 * M) + .0003 * Math.sin(3 * M)), L = M + C + rad * 102.9372 + Math.PI; return { dec: dec(L, 0), ra: ra(L, 0) }; };
  const moonC = d => { const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d), l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F); return { ra: ra(l, b), dec: dec(l, b), dist: 385001 - 20905 * Math.cos(M) }; };
  const deg = x => x / rad, north = x => (deg(x) + 180 + 360) % 360;
  return (date, lat, lon) => {
    const lw = rad * -lon, phi = rad * lat, d = days(date), s = sunC(d), m = moonC(d);
    const Hs = sid(d, lw) - s.ra, Hm = sid(d, lw) - m.ra;
    let mh = alt(Hm, phi, m.dec); mh += refr(mh);
    const sd = 149598000, pi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra));
    const inc = Math.atan2(sd * Math.sin(pi), m.dist - sd * Math.cos(pi));
    const ang = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    // Lage im Tagesbogen: 0 = Aufgang, 0,5 = höchster Stand, 1 = Untergang (h0 = Höhe beim Auf-/Untergang)
    const arc = (H, dc, h0) => { const c = (Math.sin(rad * h0) - Math.sin(phi) * Math.sin(dc)) / (Math.cos(phi) * Math.cos(dc)), H0 = Math.acos(Math.max(-1, Math.min(1, c))) || 1e-6, h = Math.atan2(Math.sin(H), Math.cos(H));
      return { x: .5 + h / (2 * H0), top: Math.max(1, 90 - Math.abs(deg(phi - dc))) }; };
    return { sun: { az: north(azi(Hs, phi, s.dec)), el: deg(alt(Hs, phi, s.dec)), ...arc(Hs, s.dec, -.833) },
      moon: { az: north(azi(Hm, phi, m.dec)), el: deg(mh), frac: (1 + Math.cos(inc)) / 2, phase: .5 + .5 * inc * (ang < 0 ? -1 : 1) / Math.PI, ...arc(Hm, m.dec, .133) } };
  };
})();
const moonName = ph => ph < .03 || ph > .97 ? 'Neumond' : ph < .22 ? 'zunehmende Sichel' : ph < .28 ? 'zunehmender Halbmond' : ph < .47 ? 'zunehmender Mond'
  : ph < .53 ? 'Vollmond' : ph < .72 ? 'abnehmender Mond' : ph < .78 ? 'abnehmender Halbmond' : 'abnehmende Sichel';
const dirName = az => ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest'][Math.round(((az % 360) + 360) % 360 / 45) % 8];
// Himmelsfarbe (oben, Horizont) je Sonnenhöhe für den Hintergrund "Himmel"
const CEL_SKY = [[-18, '#02040a', '#060a16'], [-10, '#050918', '#121a36'], [-5, '#0e1636', '#3a2f5c'], [-1, '#1f2c5c', '#c0603e'], [3, '#2c4a86', '#f09a55'],
  [8, '#33609e', '#e9c08e'], [15, '#3a72b8', '#a8cbe8'], [35, '#2d6ab8', '#98c2ea'], [90, '#2a64b4', '#90bce8']];
const celSky = el => { el = clamp(el, -18, 90); for (let i = 1; i < CEL_SKY.length; i++) { const [a, t1, h1] = CEL_SKY[i - 1], [b, t2, h2] = CEL_SKY[i]; if (el <= b) { const t = (el - a) / (b - a); return [mixHex(t1, t2, t), mixHex(h1, h2, t)]; } } return [CEL_SKY[8][1], CEL_SKY[8][2]]; };
// Farbstützpunkte je Sonnenhöhe: [Höhe, Grundton, 4 Aurora-Farben, Intensität]
const SKY_NIGHT = ['#060a18', '#1d3fa8', '#2a86d9', '#1fb8a6', '#5a36c8', .62];
const SKY_DAY = ['#252b35', '#fffaf0', '#cfe8ff', '#fff4d6', '#e8f4ff', .66];
const SKY_UP = [[-18, ...SKY_NIGHT], [-12, '#0a0c20', '#2a3a9c', '#5a4bc8', '#2aa6c0', '#7a3fb8', .62], [-6, '#161228', '#6a3fa8', '#d0588a', '#3a6fd0', '#f07a8a', .66],
  [-1, '#1f1520', '#ff7a4c', '#ffb347', '#c8508a', '#ff9a6a', .7], [4, '#231a13', '#ffc34d', '#ffa53c', '#ffe08a', '#ff8a4c', .66], [12, '#24231f', '#ffeab0', '#ffd88a', '#fff6e0', '#d6ecff', .62], [28, ...SKY_DAY]];
const SKY_DOWN = [[-18, ...SKY_NIGHT], [-12, '#0a0c20', '#3a3aa8', '#6a3fb8', '#2a86d9', '#2a5ac0', .62], [-6, '#170c1e', '#b03a6a', '#7a3ab8', '#ff5a4a', '#3a4ac8', .68],
  [-1, '#26100f', '#ff4a2e', '#ff2d55', '#ff8a3c', '#c03a7a', .74], [4, '#26170f', '#ff9a3c', '#ff6a3c', '#ffc070', '#ff4a4a', .7], [12, '#25201c', '#ffe4a8', '#ffc880', '#fff2d8', '#ffc080', .62], [28, ...SKY_DAY]];
// Umrisse der leuchtenden Aurora-Bänder (Koordinaten 0–100, unten der helle, geschwungene Rand)
const AURORA = [
  'M0 34 C18 12 36 40 56 22 S86 4 100 16 L100 58 C86 74 70 52 52 64 S16 84 0 66 Z',
  'M0 20 C22 2 44 26 64 10 S92 6 100 14 L100 52 C80 66 64 46 44 60 S12 70 0 58 Z',
  'M0 30 C24 18 48 36 70 22 S94 20 100 26 L100 60 C78 74 58 58 38 70 S10 76 0 64 Z',
  'M0 26 C20 8 46 30 68 14 S94 12 100 20 L100 62 C82 78 62 60 40 72 S12 80 0 68 Z',
];
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a, b, t) => { const x = hex2(a), y = hex2(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const skyAt = (el, rising) => {
  const T = rising ? SKY_UP : SKY_DOWN;
  let i = T.findIndex(s => el <= s[0]);
  if (i === -1) i = T.length - 1;
  const a = T[Math.max(0, i - 1)], b = T[i], t = a === b ? 0 : clamp((el - a[0]) / (b[0] - a[0]), 0, 1);
  const k = t * t * (3 - 2 * t); // weich ein- und auslaufen
  return { base: mixHex(a[1], b[1], k), c: [2, 3, 4, 5].map(j => mixHex(a[j], b[j], k)), i: a[6] + (b[6] - a[6]) * k };
};

const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>';
const PWR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10"/></svg>';
const SVG = p => `<svg viewBox="0 0 24 24" fill="currentColor">${p}</svg>`;
const IC = {
  prev: SVG('<path d="M6 6h2v12H6zM9.5 12L18 18V6z"/>'),
  play: SVG('<path d="M8 5v14l11-7z"/>'),
  pause: SVG('<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'),
  stop: SVG('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
  next: SVG('<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"/>'),
  vol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
  fan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M12 10c-1-3-.5-7 2.5-7 3.5 0 3 4.5-.5 7.5M14 12c3-1 7-.5 7 2.5 0 3.5-4.5 3-7.5-.5M12 14c1 3 .5 7-2.5 7-3.5 0-3-4.5.5-7.5M10 12c-3 1-7 .5-7-2.5C3 6 7.5 6.5 10.5 10"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5"/><circle cx="12" cy="14.5" r="3.5"/><circle cx="12" cy="6.5" r="1" fill="currentColor"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-10-2 1.5-3 3.5-3 6-1-1-2-2-2.5-3.5C7.5 9.5 5 12 5 15c0 4.3 3 7 7 7z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const WX_DE = { 'clear-night': 'klar', cloudy: 'bewölkt', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter', partlycloudy: 'teils bewölkt', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'sonnig', windy: 'windig', 'windy-variant': 'windig', exceptional: 'Unwetter' };
// Wettersymbole mit leichter Animation (Strahlen drehen, Wolken ziehen, Regen/Schnee fällt, Blitz flackert)
const SUN = '<g class="wsr"><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2 2M22.5 22.5l2 2M7.5 24.5l2-2M22.5 9.5l2-2" stroke="#ffc34d" stroke-width="2" stroke-linecap="round"/></g><circle class="wsc" cx="16" cy="16" r="6" fill="#ffc34d"/>';
const MOON = '<path class="wmo" d="M17 5a7 7 0 1 0 8.5 8.5A6 6 0 0 1 17 5z" fill="#ffd27a"/><circle class="wst" cx="7" cy="8" r=".9" fill="#fff"/><circle class="wst" cx="25" cy="24" r=".7" fill="#fff" style="animation-delay:-1.3s"/>';
const CLOUD = (y = 0, c = '#9aa3b2') => `<g class="wcl"><path transform="translate(0 ${y})" d="M23 22H10a5.5 5.5 0 1 1 5.2-7.3h.3A4.4 4.4 0 0 1 24 16a3 3 0 0 1-1 6z" fill="${c}"/></g>`;
const drops = (el, n = 3) => [12, 17, 22].slice(0, n).map((x, i) => el(x, i)).join('');
const wxIcon = c => {
  let b;
  switch (c) {
    case 'sunny': b = SUN; break;
    case 'clear-night': b = MOON; break;
    case 'partlycloudy': b = '<g class="wsr" style="transform-origin:12px 12px"><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" stroke="#ffc34d" stroke-width="1.6" stroke-linecap="round"/></g><circle class="wsc" cx="12" cy="12" r="5" fill="#ffc34d"/><g class="wcl"><path d="M24 25H12a5 5 0 1 1 4.8-6.5h.2A4 4 0 0 1 25 19a3 3 0 0 1-1 6z" fill="#b4bcc8"/></g>'; break;
    case 'rainy': case 'pouring': b = drops((x, i) => `<path class="wrn" style="animation-delay:${-i * .37}s" d="M${x} 24l-1 3" stroke="#6fb2ff" stroke-width="2" stroke-linecap="round"/>`) + CLOUD(); break;
    case 'snowy': case 'snowy-rainy': case 'hail': b = drops((x, i) => `<circle class="wsn" style="animation-delay:${-i * .8}s" cx="${x}" cy="26" r="1.6" fill="#fff"/>`) + CLOUD(); break;
    case 'lightning': case 'lightning-rainy': b = CLOUD() + '<path class="wbt" d="M17 22l-3 5h3l-2 4 5-6h-3l2-3z" fill="#ffd166"/>'; break;
    case 'fog': b = '<path class="wfg" d="M6 12h20" stroke="#9aa3b2" stroke-width="2.4" stroke-linecap="round"/><path class="wfg" style="animation-direction:alternate-reverse" d="M4 17h24" stroke="#9aa3b2" stroke-width="2.4" stroke-linecap="round"/><path class="wfg" d="M7 22h18" stroke="#9aa3b2" stroke-width="2.4" stroke-linecap="round"/>'; break;
    case 'windy': case 'windy-variant': b = '<path class="wwd" d="M4 12h15a3 3 0 1 0-3-3M4 18h21a3 3 0 1 1-3 3M4 24h10" stroke="#b4bcc8" stroke-width="2.2" fill="none" stroke-linecap="round"/>'; break;
    default: b = CLOUD();
  }
  return `<svg class="wx" viewBox="0 0 32 32">${b}</svg>`;
};

// Standard-Grundriss (wird durch floorplan.image ersetzt)
const PLAN_SVG = `<svg viewBox="0 0 360 340" width="100%" height="100%" style="display:block">
<defs><pattern id="rtcwood" width="90" height="18" patternUnits="userSpaceOnUse"><rect width="90" height="18" fill="#2c261f"/><rect y="9" width="90" height="9" fill="#2f2821"/><path d="M0 8.5H90M0 17.5H90" stroke="#1f1a15"/><path d="M28 0V9M72 9V18" stroke="#1f1a15"/></pattern>
<radialGradient id="rtclamp"><stop offset="0" stop-color="rgba(255,180,90,.28)"/><stop offset="1" stop-color="rgba(255,180,90,0)"/></radialGradient></defs>
<rect x="20" y="20" width="320" height="300" fill="url(#rtcwood)"/><circle cx="165" cy="170" r="120" fill="url(#rtclamp)"/>
<rect x="78" y="112" width="170" height="130" rx="6" fill="#3a3e48" stroke="#4b505c" stroke-width="2" opacity=".9"/>
<rect x="62" y="252" width="196" height="42" rx="9" fill="#4a4e57" stroke="#5a5f69"/><rect x="62" y="150" width="42" height="144" rx="9" fill="#4a4e57" stroke="#5a5f69"/>
<path d="M110 258h40M160 258h40M210 258h40M68 200v40M68 160v34" stroke="#3b3f47" stroke-width="3" stroke-linecap="round"/>
<rect x="140" y="150" width="76" height="46" rx="5" fill="#5a4632" stroke="#735a41"/><circle cx="160" cy="170" r="5" fill="#3d7a4d"/>
<rect x="270" y="238" width="48" height="48" rx="10" fill="#4a4e57" stroke="#5a5f69"/>
<rect x="148" y="30" width="72" height="14" rx="2" fill="#1c1d20" stroke="#4a4d54"/><rect x="156" y="44" width="56" height="3" fill="#6fb2ff" opacity=".5"/>
<circle cx="312" cy="298" r="12" fill="#2f5e3b"/><circle cx="306" cy="293" r="6" fill="#3f7a4d"/><circle cx="318" cy="302" r="5" fill="#3f7a4d"/>
<rect x="20" y="20" width="320" height="300" fill="none" stroke="#5b5f67" stroke-width="10"/>
</svg>`;

const CSS = `
:host{display:block;position:relative;overflow:hidden;background:#111215;--fz:1}
*{box-sizing:border-box;margin:0}
.stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:top left;overflow:hidden;color:#c9ccd2;padding:14px;line-height:1.2;
  font-family:Rajdhani,'Segoe UI',sans-serif;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
  background-color:#141519;transition:background-color 12s linear}

.blob{position:absolute;border-radius:50%;filter:blur(100px);pointer-events:none;transition:background 1s}
.sky{position:absolute;inset:-12%;pointer-events:none;transition:opacity 12s linear}
.sky::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.45))}
.wash{position:absolute;left:5%;top:0;width:90%;height:70%;border-radius:50%;filter:blur(90px);opacity:.26;mix-blend-mode:screen;transition:background-color 12s linear}
.au{position:absolute;filter:blur(15px);mix-blend-mode:screen;color:#1d3fa8;transition:color 12s linear,transform var(--td,24s) cubic-bezier(.45,0,.55,1);will-change:transform,opacity}
.au svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.au.a1{left:2%;top:8%;width:72%;height:42%;transform:rotate(-7deg);animation:rtcgl 9s ease-in-out infinite alternate}
.au.a2{left:40%;top:2%;width:62%;height:36%;transform:rotate(6deg);animation:rtcgl 11s ease-in-out -4s infinite alternate}
.au.a3{left:14%;top:36%;width:64%;height:30%;transform:rotate(-3deg);animation:rtcgl2 13s ease-in-out -6s infinite alternate}
.au.a4{left:58%;top:40%;width:44%;height:34%;transform:rotate(11deg);animation:rtcgl2 10s ease-in-out -2s infinite alternate}
.still .au{animation:none}
@keyframes rtcgl{from{opacity:.78}to{opacity:1}}
@keyframes rtcgl2{from{opacity:.55}to{opacity:.92}}
.z{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;gap:14px}
.mono{font-family:'Share Tech Mono',monospace}
.eng{text-shadow:0 1px 0 rgba(255,255,255,.07),0 -1px 0 #000}
.cap{font-size:12px;letter-spacing:2.5px;color:#9a9fa8;font-weight:700;text-transform:uppercase}
.led{width:9px;height:9px;border-radius:50%;flex:none;background:var(--lc,#3a3c41);box-shadow:0 0 8px var(--lc,transparent)}
.acc{color:var(--acc);text-shadow:0 0 10px var(--accg)}
.heat{color:#ff8a4c;text-shadow:0 0 10px rgba(255,120,60,.7)}
[data-act]{cursor:pointer}
.plate{position:relative;border-radius:20px;overflow:hidden;background:linear-gradient(180deg,rgba(50,52,58,calc(var(--pa1,.78) * var(--pt,1))),rgba(24,25,29,calc(var(--pa2,.88) * var(--pt,1))));
  -webkit-backdrop-filter:var(--pbf,none);backdrop-filter:var(--pbf,none);
  border:1px solid rgba(255,255,255,.07);box-shadow:0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.14),inset 0 -1px 0 rgba(0,0,0,.6),0 20px 36px rgba(0,0,0,.55)}

.card{padding:16px 18px}
.head{display:flex;align-items:center;gap:10px}.head .t{flex:1;min-width:0}
.head h2{font-size:18px;letter-spacing:2.5px;text-transform:uppercase;color:#e2e4e8;line-height:1.1}
.head p{font-size:11.5px;letter-spacing:1.3px;color:#979ca5;text-transform:uppercase;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.grid{flex:1;display:grid;grid-template-columns:404px 404px 416px;grid-template-rows:minmax(0,1fr);gap:14px;min-height:0}
.col{grid-row:1;display:flex;flex-direction:column;justify-content:flex-end;gap:14px;min-height:0}
.mod{display:flex;flex-direction:column;min-height:0}
.mod>.plate{flex:1 1 auto!important;min-height:0!important;height:auto!important;margin-top:0!important}
.xcard{position:relative;min-height:0;overflow:auto;border-radius:20px;scrollbar-width:none}
.xcard>*{display:block;height:100%}
.xerr{padding:14px;border-radius:20px;background:rgba(255,90,90,.12);color:#ff8a8a;font-size:13px}
.strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.strip .rk{height:44px;padding:0 7px;gap:5px;box-shadow:0 4px 0 #0b0b0c,0 6px 10px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.1)}.strip .rk:not(.off)>svg{width:15px;height:15px}
.strip .rk::after{left:9px;right:9px;bottom:4px;height:2px}.strip .rk>div:first-of-type{min-width:0}
.strip .rk .nm{font-size:10.5px;letter-spacing:.2px;line-height:1.3;white-space:nowrap}.strip .rk .st{font-size:17px;letter-spacing:1.5px}
.strip .rk .since{font-size:9.5px;line-height:1.15;flex:none}.strip .rk .since b{font-size:12.5px}
.strip .rk.off{gap:7px;padding:0 8px;color:#ff6b6b}.strip .rk.off::after{display:none}.strip .rk.off svg{width:18px;height:18px}
.strip .rk.off .nm{font-size:12px;letter-spacing:1.5px;color:#ff8a8a;white-space:nowrap}
.strip .rk.on{transform:translateY(2px);box-shadow:0 2px 0 #0b0b0c,0 4px 8px rgba(0,0,0,.5),0 0 20px var(--g),inset 0 1px 0 rgba(255,255,255,.1)}
.rk{height:56px;border-radius:13px;position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;padding:0 18px;color:#9a9ea6;
  background:linear-gradient(180deg,#36383d,#222327);box-shadow:0 5px 0 #0b0b0c,0 8px 14px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);transition:transform .08s}
.rk::before{content:"";position:absolute;inset:0;background:linear-gradient(125deg,rgba(255,255,255,.08),rgba(255,255,255,0) 38%)}
.rk::after{content:"";position:absolute;left:18px;right:18px;bottom:6px;height:3px;border-radius:2px;background:#3a3c41;box-shadow:inset 0 1px 2px #000}
.rk svg{width:26px;height:26px;flex:none}
.rk .nm{font-size:13px;letter-spacing:2.5px;font-weight:700;text-transform:uppercase;color:#9a9ea6;line-height:1}
.rk .st{font-size:22px;letter-spacing:3px;font-weight:700;text-transform:uppercase;line-height:1.05;color:#b5b9c0}
.rk .since{margin-left:auto;text-align:right;font-family:'Share Tech Mono',monospace;font-size:13px;color:#8d929b;line-height:1.25}
.rk .since b{display:block;font-weight:400;font-size:17px;color:#c9ccd2}
.rk.on{transform:translateY(3px);box-shadow:0 2px 0 #0b0b0c,0 4px 8px rgba(0,0,0,.5),0 0 26px var(--g),inset 0 1px 0 rgba(255,255,255,.1)}
.rk.on::after{background:var(--c);box-shadow:0 0 10px var(--c)}
.rk.on svg{color:var(--c);filter:drop-shadow(0 0 5px var(--c))}
.rk.on .st{color:var(--t);text-shadow:0 0 12px var(--g)}
.rk:active{transform:translateY(4px)}
.rk.off{justify-content:center;color:#ff6b6b}
.rk.na{opacity:.5;filter:grayscale(.7)}
.rk.na:active,.na .hk:active,.na .key:active,.na.pmw:active{transform:none}
.tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:5px;border-radius:13px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05)}
.tab{position:relative;height:44px;border-radius:9px;display:flex;align-items:center;gap:9px;padding:0 12px;font-size:14px;letter-spacing:2px;font-weight:700;text-transform:uppercase;color:#9a9fa8}
.tab small{margin-left:auto;font-family:'Share Tech Mono',monospace;font-size:13px;letter-spacing:0;font-weight:400}
.tab.on{color:#f0f1f3;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 3px 0 #0b0b0c,0 5px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12)}
.tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:4px;height:2px;border-radius:1px;background:var(--tc);box-shadow:0 0 6px var(--tc)}
.tab .led{transition:background .3s,box-shadow .3s}
.fkeys{grid-template-columns:repeat(4,minmax(0,1fr))}
.fk{height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;font-size:10.5px;letter-spacing:1px;font-weight:700;text-transform:uppercase;color:#9a9fa8;background:linear-gradient(180deg,#2c2e33,#1f2023);box-shadow:inset 0 1px 0 rgba(255,255,255,.07);white-space:nowrap;overflow:hidden}
.fk i{width:12px;height:4px;border-radius:2px;flex:none;background:#3a3c41;box-shadow:inset 0 1px 2px #000;transition:background .3s,box-shadow .3s}
.fk.rdy{color:#b5b9c0}.fk.rdy i{background:#3ddc84;box-shadow:0 0 8px #3ddc84}
.fk.act{color:#f0f1f3}.fk.act i{background:#ff9f2e;box-shadow:0 0 10px #ff9f2e}
.fk .tm{font-family:'Share Tech Mono',monospace;font-size:13px;letter-spacing:0;color:#ff9f2e}
.lcd .lau{margin-top:8px;padding-top:7px;border-top:1px dashed rgba(255,255,255,.12);color:var(--auc,var(--acc))}
.lcd .lau.idle{opacity:.32}
.lcd .lau .row{align-items:center}
.lcd .lau .lal{font-size:12px;letter-spacing:1.5px}
.lcd .lau .lav{font-size:22px;line-height:1;text-shadow:0 0 10px var(--auc,var(--accg))}
.lcd .lau.idle .av{font-size:16px;text-shadow:none}
.lcd .lau .lab{margin-top:5px;height:5px;border-radius:3px;background:rgba(255,255,255,.06);box-shadow:inset 0 1px 2px #000;overflow:hidden}
.lcd .lau .lab b{display:block;height:100%;width:0;background:var(--auc,var(--acc));box-shadow:0 0 8px var(--auc,var(--acc));transition:width 1s linear}
.lcd .lau.idle .ab b{width:0!important}
@keyframes aublink{50%{opacity:.35}}
.lcd .lau.warn .av{animation:aublink 1s steps(2) infinite}
.dwrap{position:relative;flex:none;touch-action:none;cursor:pointer}
.dial{position:absolute;left:0;top:0;width:330px;height:330px;transform-origin:top left}
.dot{position:absolute;width:4.4px;height:11px;margin:-5.5px 0 0 -2.2px;border-radius:1px;pointer-events:none;transition:background .15s,box-shadow .15s}
/* Rillenkranz knapp unter der ersten/letzten LED waagerecht abgeschnitten – Metallring + Innenkreis stehen unten über */
.skirt{position:absolute;left:30px;top:30px;width:270px;height:270px;filter:drop-shadow(0 14px 14px rgba(0,0,0,.7)) drop-shadow(0 4px 5px rgba(0,0,0,.6))}
.skirt::before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(transparent 0deg 135deg,#141518 135deg 225deg,transparent 225deg),repeating-conic-gradient(from 1deg,#34363b 0 2deg,#141518 2deg 4deg);box-shadow:0 0 0 2px #050506,inset 0 0 0 1px rgba(255,255,255,.05);clip-path:inset(-3px -3px 25px -3px)}
.dial.big .skirt{left:20px;top:20px;width:290px;height:290px}
.dial.big .skirt::before{inset:10px}
.dial.big .skw{position:absolute;inset:0;pointer-events:none}
.dial.big .skw.l{--gc:77,163,255}.dial.big .skw.r{--gc:255,70,50}
.dial.big .skw{filter:drop-shadow(0 .35px 1.5px rgba(var(--gc),.85)) drop-shadow(0 .8px 4px rgba(var(--gc),.45))}
/* LED-Kranz noch einmal über dem Schein: oben leuchtet die Ausbuchtung so nur bis an den Kranz.
   Sein schwarzer Außenrand (.skro) läuft nur über den LED-Bogen, nicht durch den Teil mit den Gradzahlen */
.dial.big .skr{position:absolute;inset:10px;border-radius:50%;pointer-events:none;background:conic-gradient(transparent 0deg 135deg,#141518 135deg 225deg,transparent 225deg),repeating-conic-gradient(from 1deg,#34363b 0 2deg,#141518 2deg 4deg);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);clip-path:inset(-3px -3px 25px -3px);-webkit-mask:conic-gradient(#000 0deg 135deg,transparent 135deg 225deg,#000 225deg);mask:conic-gradient(#000 0deg 135deg,transparent 135deg 225deg,#000 225deg)}
.dial.big .skro{position:absolute;inset:8px;border-radius:50%;pointer-events:none;background:#050506;-webkit-mask:conic-gradient(#000 0deg 135deg,transparent 135deg 225deg,#000 225deg);mask:conic-gradient(#000 0deg 135deg,transparent 135deg 225deg,#000 225deg)}
.dial.big .skb{position:absolute;inset:0;background:#141518;box-shadow:inset 0 -1px 0 rgba(var(--gc),.35)}
.dial.big .bezel{left:22px;top:22px}
.dlim{position:absolute;transform:translate(-50%,-50%);font:600 11px Rajdhani,sans-serif;letter-spacing:1px;color:#8a8f99;pointer-events:none;white-space:nowrap}
.bezel{position:absolute;left:12px;top:12px;width:246px;height:246px;border-radius:50%;background:conic-gradient(from 20deg,#3c3e44,#141518,#4b4e55,#101113,#37393f,#131417,#45484e,#111214,#3c3e44);box-shadow:inset 0 2px 2px rgba(255,255,255,.22),inset 0 -3px 5px rgba(0,0,0,.7),0 0 0 1px #000}
.wheel,.face{position:absolute;left:16px;top:16px;width:214px;height:214px;border-radius:50%;overflow:hidden}
.wheel{background:radial-gradient(circle,rgba(255,255,255,.9) 0%,rgba(255,255,255,.55) 16%,rgba(255,255,255,0) 60%),conic-gradient(from 90deg,#ff3b3b,#ffb03b,#f4ff3b,#3bff6f,#3bf0ff,#3b6fff,#b43bff,#ff3bb7,#ff3b3b);box-shadow:inset 0 0 0 3px #111,inset 0 8px 18px rgba(0,0,0,.75),inset 0 -4px 10px rgba(0,0,0,.4);transition:filter .3s}
.wheel.ct{background:radial-gradient(circle,rgba(255,255,255,.85) 0%,rgba(255,255,255,.45) 18%,rgba(255,255,255,0) 58%),conic-gradient(from 225deg,#ff8a2b 0deg,#ffb066 55deg,#ffd9a8 110deg,#fff3e2 150deg,#e6eeff 195deg,#b9d2ff 240deg,#8fb8ff 270deg,#3a3f48 282deg,#1b1d21 315deg,#3a3f48 348deg,#ff8a2b 360deg)}
.face{background:radial-gradient(circle at 50% 70%,rgba(255,110,50,.35),rgba(0,0,0,0) 60%),radial-gradient(circle at 50% 40%,#23252a,#0c0d0f);box-shadow:inset 0 0 0 3px #111,inset 0 8px 18px rgba(0,0,0,.85)}
.wheel::after,.face::after{content:"";position:absolute;inset:0;border-radius:50%;background:linear-gradient(160deg,rgba(255,255,255,.38) 0%,rgba(255,255,255,.07) 38%,rgba(255,255,255,0) 40%);pointer-events:none}
.handle{position:absolute;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:50%;z-index:3;background:radial-gradient(circle,var(--hc) 0 42%,transparent 44%),conic-gradient(from 20deg,#55585f,#16171a,#4a4d53,#121315,#55585f);box-shadow:0 4px 8px rgba(0,0,0,.7),0 0 12px var(--hc)}
.hub{position:absolute;left:50%;top:50%;width:108px;height:108px;margin:-54px 0 0 -54px;border-radius:50%;z-index:2;background:conic-gradient(from 20deg,#44464c,#141518,#50535a,#111214,#3e4046,#131417,#44464c);box-shadow:0 6px 14px rgba(0,0,0,.8),inset 0 1px 1px rgba(255,255,255,.2);display:grid;place-items:center}
.hub .lcd{width:88px;height:88px;border-radius:50%;display:grid;place-items:center;text-align:center;padding:0}
.hub b{font-size:34px;font-weight:400;line-height:1}.hub span{font-size:12px;display:block;opacity:.8;margin-top:2px}
.tlcd{position:absolute;inset:0;display:grid;place-items:center;text-align:center;font-family:'Share Tech Mono',monospace;z-index:2}
/* Verlauf 24 h im Display: Ist = Balken unten, Soll = Linie darüber; Text bekommt einen Schatten, damit er lesbar bleibt */
.fch{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1}
.fch .fcb rect{fill:rgba(120,190,255,.30)}
.fch .fcl{fill:none;stroke:#ff8a4c;stroke-width:1.6;stroke-linejoin:round;opacity:.9;filter:drop-shadow(0 0 1.5px #000) drop-shadow(0 1px 2px rgba(0,0,0,.9)) drop-shadow(0 0 2px rgba(255,138,76,.7))}
.fch .fcd{fill:none;stroke:rgba(255,255,255,.08);stroke-width:1}
.tlcd>div{text-shadow:0 0 6px #000,0 0 3px #000,0 0 12px rgba(0,0,0,.9)}
.tlcd .heat{text-shadow:0 0 10px rgba(255,120,60,.55),0 0 4px #000,0 0 2px #000,0 2px 12px rgba(0,0,0,.95)}
.tlcd b{font-size:62px;font-weight:400;line-height:1}.tlcd .u{font-size:16px;letter-spacing:3px;opacity:.8}.tlcd .i{font-size:18px;color:#c9ccd2;margin-top:8px;opacity:.9}
.lcd{border-radius:11px;padding:9px 12px;background:linear-gradient(180deg,rgba(17,14,10,var(--lcda,1)),rgba(6,5,4,var(--lcda,1)));box-shadow:inset 0 4px 10px rgba(0,0,0,var(--lcda,1)),0 1px 0 rgba(255,255,255,calc(.08 * var(--lcda,1)));font-family:'Share Tech Mono',monospace;position:relative;overflow:hidden}
.lcd::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,calc(.18 * var(--lcda,1))) 0 1px,transparent 1px 3px),linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,0) 40%);pointer-events:none}
.lcd .row{display:flex;justify-content:space-between;align-items:baseline;gap:6px;white-space:nowrap}
.lcd.dstr{display:flex;flex-direction:column;justify-content:center}
.keys2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.keys4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.hk{height:40px;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:7px;font-size:13.5px;letter-spacing:1.8px;font-weight:700;text-transform:uppercase;color:#9a9ea6;background:linear-gradient(180deg,#34363b,#222327);box-shadow:0 4px 0 #0b0b0c,0 6px 10px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.1)}
.hk i{width:14px;height:4px;border-radius:2px;background:#3a3c41;box-shadow:inset 0 1px 2px #000}
.hk.on{transform:translateY(3px);color:#f0f1f3;box-shadow:0 1px 0 #0b0b0c,0 3px 6px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)}
.hk.on i{background:var(--c);box-shadow:0 0 10px var(--c)}
.hk:active{transform:translateY(4px)}
/* Heizungs-Drehregler gleich groß wie der Licht-Regler: Regler 316, ±-Tasten rund ausgeschnitten, Ist/Ventil in den unteren Ecken */
.trow{position:relative;height:350px;margin:8px 0 0}
/* Ist/Ventil-Kacheln so groß wie die Kacheln der Raumklima-Karte (die wird stärker skaliert) */
.htl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;zoom:var(--hz,1.52);width:calc(440px / var(--hz,1.52))}
.htl .n{letter-spacing:1px}
.tmm{position:absolute;top:283px;left:104px;right:104px;display:flex;justify-content:space-between}
.trow .dwrap{position:absolute;left:50%;top:0;margin-left:-164.5px}
.pmw{position:absolute;top:78px;width:92px;height:150px;filter:drop-shadow(0 4px 0 #0b0b0c) drop-shadow(0 7px 9px rgba(0,0,0,.55));transition:transform .08s,filter .08s;cursor:pointer}
.pmw:active{transform:translateY(3px);filter:drop-shadow(0 1px 0 #0b0b0c) drop-shadow(0 3px 5px rgba(0,0,0,.5))}
.pmw.l{left:0}.pmw.r{right:0}
.pm{width:100%;height:100%;border-radius:14px;display:flex;align-items:center;font:700 32px Rajdhani,sans-serif;color:#d8dade;background:linear-gradient(180deg,#3a3c42,#222327 55%,#1c1d20);box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
.pmw.l .pm{padding-left:18px;-webkit-mask:radial-gradient(circle at calc(100% + 128px) 50%,transparent 161px,#000 161.5px);mask:radial-gradient(circle at calc(100% + 128px) 50%,transparent 161px,#000 161.5px)}
.pmw.r .pm{justify-content:flex-end;padding-right:18px;-webkit-mask:radial-gradient(circle at -128px 50%,transparent 161px,#000 161.5px);mask:radial-gradient(circle at -128px 50%,transparent 161px,#000 161.5px)}
/* −/+ unten links/rechts, innen dem LED-Ring angepasst (gehören fest zum Drehregler) */
.pmw.seg .pm{position:relative;display:block;padding:0;border-radius:0;-webkit-mask:none;mask:none;background:linear-gradient(180deg,#3a3c42,#26272b 45%,#1c1d20)}
.pmw.seg .pm>span{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;line-height:.9;pointer-events:none}
.sect{display:flex;justify-content:space-between;margin:0 0 5px}
.slot{height:56px;position:relative;touch-action:none;cursor:pointer}
.slot .groove{position:absolute;left:0;right:0;top:24px;height:8px;border-radius:4px;box-shadow:inset 0 2px 4px #000,0 1px 0 rgba(255,255,255,.07)}
.ticks{position:absolute;left:0;right:0;top:38px;height:8px;background:repeating-linear-gradient(90deg,#4a4d53 0 1px,transparent 1px 10%)}
.fader{position:absolute;top:0;width:30px;height:56px;margin-left:-15px;border-radius:7px;z-index:2;background:conic-gradient(from 110deg,#55585f,#1c1d20,#4a4d53,#16171a,#55585f);box-shadow:0 4px 8px rgba(0,0,0,.85),0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.25)}
.fader::after{content:"";position:absolute;left:50%;top:14px;bottom:14px;width:3px;margin-left:-1.5px;border-radius:1px;background:var(--acc);box-shadow:0 0 6px var(--acc)}
.tempg{background:linear-gradient(90deg,#ff8a2b,#ffc27a 30%,#fff1dc 55%,#dfeaff 78%,#9fc3ff);opacity:.85}
.keys8{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
.key{height:32px;border-radius:7px;position:relative;background:linear-gradient(180deg,#34363b,#232428);box-shadow:0 4px 0 #0d0d0f,0 6px 10px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)}
.key::after{content:"";position:absolute;left:7px;right:7px;top:7px;height:7px;border-radius:3px;background:var(--c);opacity:.35}
.key.on{transform:translateY(3px);box-shadow:0 1px 0 #0d0d0f,0 0 16px var(--c),inset 0 1px 0 rgba(255,255,255,.1)}
.key.on::after{opacity:1;box-shadow:0 0 10px var(--c),0 0 3px #fff}
.dim{opacity:.42}.na{opacity:.45;filter:grayscale(.6)}
.lock{opacity:.25!important;pointer-events:none;filter:grayscale(1)}
.tile{position:relative;overflow:hidden;border-radius:12px;padding:9px 12px;background:rgba(0,0,0,.25);box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05);min-width:0}
.tile .n{font-size:11.5px;letter-spacing:2px;font-weight:700;color:#8a8e96;text-transform:uppercase;display:flex;justify-content:space-between;gap:4px;white-space:nowrap}
.tile .val{font-family:'Share Tech Mono',monospace;font-size:26px;color:#e8e9ec;line-height:1.1;margin-top:3px;white-space:nowrap}
.tile .val small{font-size:13px;color:#8a8e96}
.bar{height:6px;border-radius:3px;margin-top:6px;background:#15161a;box-shadow:inset 0 1px 2px #000;position:relative;overflow:hidden}
.bar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;transition:width .6s}
.fc{display:grid;gap:8px}
.fc>div{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;padding:5px 0 4px;min-height:0;overflow:hidden;border-radius:10px;background:rgba(0,0,0,.25);box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05)}
.fc svg{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-22px 0 0 -23px;z-index:0}
.fc .d,.fc .ft{position:relative;z-index:1;text-shadow:0 0 3px #000,0 0 6px rgba(0,0,0,.9),0 1px 2px #000}
.fc .d{font-size:10.5px;letter-spacing:1.5px;font-weight:700;color:#aeb2b9}.fc .tt{font-size:12px;color:#f0f1f3}.fc .pp{font-size:10px;color:#9fc3ff;margin-top:1px;font-weight:600}
#w-ic svg{width:100%;height:100%;display:block}
.wx .wsr{transform-origin:16px 16px;animation:wxspin 30s linear infinite}
.wx .wsc,.wx .wmo{animation:wxpulse 4s ease-in-out infinite alternate}
.wx .wcl{animation:wxdrift 7s ease-in-out infinite alternate}
.wx .wrn{animation:wxrain 1.1s linear infinite}
.wx .wsn{animation:wxsnow 2.4s linear infinite}
.wx .wbt{animation:wxflash 3.5s linear infinite}
.wx .wfg{animation:wxfog 5s ease-in-out infinite alternate}
.wx .wst{animation:wxtw 2.6s ease-in-out infinite}
.wx .wwd{stroke-dasharray:18 5;animation:wxwind 3s linear infinite}
.calm .wx *{animation:none !important}
@keyframes wxspin{to{transform:rotate(360deg)}}
@keyframes wxpulse{from{opacity:.8}to{opacity:1}}
@keyframes wxdrift{from{transform:translateX(-1.2px)}to{transform:translateX(1.4px)}}
@keyframes wxrain{0%{transform:translateY(-3px);opacity:0}25%{opacity:1}100%{transform:translateY(4px);opacity:0}}
@keyframes wxsnow{0%{transform:translate(0,-3px);opacity:0}30%{opacity:1}100%{transform:translate(1px,4px);opacity:0}}
@keyframes wxflash{0%,80%,86%,100%{opacity:1}83%,90%{opacity:.15}}
@keyframes wxfog{from{transform:translateX(-1.5px)}to{transform:translateX(1.5px)}}
@keyframes wxtw{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes wxwind{to{stroke-dashoffset:-46}}
.planbox{flex:1;min-height:0;margin-top:12px;border-radius:14px;overflow:hidden;background:#0d0f12;container-type:size;box-shadow:inset 0 3px 10px #000,0 1px 0 rgba(255,255,255,.07);position:relative;display:grid;place-items:center}
.planbox::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(150deg,rgba(255,255,255,.07),rgba(255,255,255,0) 35%)}
/* Ausschnitt aus haus-grundriss: kein dunkler Kasten, Rundung/Schatten trägt der Plan selbst */
.planbox.hgb{background:none;box-shadow:none;border-radius:0;overflow:visible}.planbox.hgb::after{display:none}
.planar{position:relative;width:min(100cqw,100cqh * var(--ar));height:min(100cqh,100cqw / var(--ar));container-type:size}
.plrot{position:absolute;left:50%;top:50%;width:100cqw;height:100cqh;transform:translate(-50%,-50%) rotate(var(--rot))}
.plrot.q{width:100cqh;height:100cqw}
.planar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.mk{position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:#1b1d20;border:2px solid var(--mc);display:grid;place-items:center;font:700 12px Rajdhani,sans-serif;color:var(--mc);box-shadow:0 0 10px var(--mg);z-index:2}
.mk.open{animation:rtcpulse 1.6s infinite}
@keyframes rtcpulse{0%,100%{box-shadow:0 0 6px var(--mg)}50%{box-shadow:0 0 18px var(--mc)}}
.lg3{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:13px;font-weight:600;color:#aeb2b9;white-space:nowrap;margin-top:12px}
.lg3 div{display:flex;align-items:center;gap:8px;min-width:0}.lg3 span.n{overflow:hidden;text-overflow:ellipsis}
.lg3 b{margin-left:auto;font-family:'Share Tech Mono',monospace;font-weight:400;font-size:13px;color:var(--mc)}
.aud{position:relative;height:100%}
.apage{position:absolute;inset:0;transition:opacity .25s}
#mc[data-view="main"] .adet,#mc[data-view="det"] .amain{opacity:0;pointer-events:none}
.atab{position:absolute;right:96px;top:5px;z-index:5;display:flex;gap:3px;padding:3px;border-radius:9px;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.05)}
#mc[data-view="det"] .atab{right:0;top:0}
.atab b{font:700 10px Rajdhani,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:#9a9fa8;padding:4px 6px;border-radius:6px;cursor:pointer}
#mc[data-view="main"] .atab b[data-v="main"],#mc[data-view="det"] .atab b[data-v="det"]{color:#f0f1f3;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12)}
.amain>.hk,.adet>.hk,.amain>.part>.hk,.adet>.part>.hk{position:absolute}
.hk.sm{height:24px;font-size:11px;letter-spacing:1.4px;border-radius:7px;gap:6px;box-shadow:0 3px 0 #0b0b0c,0 5px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)}
.hk.sm.on{transform:translateY(2px);box-shadow:0 1px 0 #0b0b0c,0 3px 5px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.1)}
.hk.sm i{width:10px;height:3px}
.hk.empty{color:#8a8f98}
.alcd{position:absolute;padding:3px 5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:8px;text-align:center}
.alcd span{font-size:8px;letter-spacing:1.5px;color:#8a8e96;line-height:1}
.alcd b{font-weight:400;font-size:19px;line-height:1;color:#979ca5;text-shadow:0 0 10px currentColor;white-space:nowrap}
.fsl{position:absolute;width:16px;touch-action:none;cursor:pointer}
.fsl .segs{position:absolute;inset:0;display:flex;flex-direction:column-reverse;gap:2px;padding:4px 3px;border-radius:5px;background:linear-gradient(180deg,#141518,#1e1f23);box-shadow:inset 0 2px 6px #000,0 1px 0 rgba(255,255,255,.07)}
.fsl .segs i{flex:1;border-radius:1px;background:#26282c;transition:background .12s}
.fsl .knob{position:absolute;left:50%;width:46px;height:30px;margin-left:-23px;border-radius:6px;z-index:2;background:conic-gradient(from 20deg,#55585f,#1c1d20,#4a4d53,#16171a,#55585f);box-shadow:0 4px 8px rgba(0,0,0,.85),0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.25);transition:bottom .12s}
.fsl .knob::after{content:"";position:absolute;left:12px;right:12px;top:50%;height:3px;margin-top:-1.5px;border-radius:1px;background:var(--vc,#3a3c41);box-shadow:0 0 6px var(--vc,transparent)}
.fsl.ro{cursor:default}
.fsl.na{opacity:.4}
.apwf{position:absolute;z-index:2;padding:3px;border-radius:9px;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.05)}
.apwf b svg{transition:filter .2s}
.apwf b{display:flex;align-items:center;justify-content:center;width:46px;height:20px;border-radius:6px;cursor:pointer;color:#979ca5;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12)}
.ainfo{position:absolute;font-size:9.5px;letter-spacing:.6px;line-height:1.4;font-weight:700;color:#8a8e96;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
.ainfo b{color:#c9ccd2;font-weight:700}
.adisp{position:absolute;border-radius:4px;padding:5px 8px 4px;display:flex;flex-direction:column;overflow:hidden}
.adisp .ainfo{position:static;text-align:left;font-size:8.5px;letter-spacing:0;padding-bottom:4px;border-bottom:2px solid rgba(90,94,102,.45)}
.ainfo s{display:inline-block;width:2px;height:9px;margin:0 5px;vertical-align:-1px;background:rgba(90,94,102,.6);text-decoration:none}
.adisp .mqw{position:relative;flex:1;overflow:hidden}
.adisp .mq{position:absolute;left:0;top:50%;white-space:nowrap;font-size:16px;line-height:1;color:var(--acc);text-shadow:0 0 10px var(--accg);will-change:transform;transform:translate(var(--mqa,0),-50%)}
.adisp .mq.run{animation:rtcmq var(--mqd,10s) linear infinite}
@keyframes rtcmq{from{transform:translate(var(--mqa,0),-50%)}to{transform:translate(var(--mqx,0),-50%)}}
.mbtn{position:absolute;display:flex;gap:7px}
.mbtn .hk.ic{flex:1;width:auto;height:32px}.mbtn .hk.ic svg{width:16px;height:16px}
.mbtn #m-mute{order:-1;margin-right:7px}
#m-vu .segs i{transition:none}
.apre{position:absolute;display:grid;grid-template-columns:repeat(6,1fr);gap:5px}
.apick{position:absolute;left:0;top:40px;width:100%;z-index:7;padding:10px 12px 12px;border-radius:12px;background:linear-gradient(180deg,rgba(40,42,48,.97),rgba(20,21,25,.98));box-shadow:0 0 0 1px #000,0 12px 30px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12)}
.apick .apo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
/* Audio frei angeordnet: Elemente im Raster, Einstellungs-Seite als Tafel darüber */
#mc.acust .adet{right:auto;bottom:auto;width:384px;height:var(--adh,208px);z-index:6;padding:8px;box-sizing:content-box;border-radius:12px;background:linear-gradient(180deg,rgba(40,42,48,.97),rgba(20,21,25,.98));box-shadow:0 0 0 1px #000,0 12px 30px rgba(0,0,0,.7)}
#mc.acust[data-view="det"] .cgrid{opacity:0;pointer-events:none}
.acust .cin .hk[data-act^="apick"]{position:absolute}
.apick[hidden],.ppop[hidden]{display:none}
.ppop{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(0,0,0,.45);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ppbox{width:470px;padding:18px 22px 20px}
.ppsl{display:flex;justify-content:space-around;margin:16px 0 18px}
.ppc{position:relative;width:60px;height:250px}
.ppef{display:flex;align-items:center;gap:8px;margin:0 0 16px}
.ppef .cap{margin-right:4px}
.ppef .hk.sm{flex:1;height:28px}
#pp-e>.hk:first-child{flex:1.7}
.ppbtn{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:10px}
.cmp .tile .n span{display:none}
.spark{position:absolute;left:8px;right:8px;top:22px;bottom:15px;display:flex;align-items:flex-end;gap:1.5px;opacity:.3;pointer-events:none}
.spark i{flex:1;min-height:1px;border-radius:1.5px 1.5px 0 0}
.tile>:not(.spark){position:relative}
.hk.ic{width:36px;height:36px;flex:none;padding:0}.hk.ic svg{width:18px;height:18px}
.chip{font-size:11.5px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:3px 8px;border-radius:7px;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.05);color:#aeb2b9;display:flex;align-items:center;gap:6px;white-space:nowrap;flex:none}
.np{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.status{height:66px;flex:none;display:flex;align-items:center;padding:0 18px}
.status .it{display:flex;align-items:center;gap:10px;padding:0 16px;white-space:nowrap;height:42px;border-left:1px solid rgba(0,0,0,.6);box-shadow:inset 1px 0 0 rgba(255,255,255,.05)}
.status .it:first-child{border:0;box-shadow:none;padding-left:0}
.status .s{font-size:11.5px;letter-spacing:1.5px;color:#9a9fa8;font-weight:700;text-transform:uppercase;margin-top:2px}
.status .v{font-size:17px;color:#e6e7ea;font-weight:700;line-height:1;max-width:260px;overflow:hidden;text-overflow:ellipsis}
#s-np .v{max-width:220px}
.status svg{width:26px;height:26px;flex:none}
.lcdtime{font-size:32px;color:#ffb347;padding:3px 14px;border-radius:9px;line-height:1.05;background:linear-gradient(180deg,rgba(26,18,6,var(--lcda,1)),rgba(13,9,3,var(--lcda,1)));box-shadow:inset 0 3px 8px rgba(0,0,0,var(--lcda,1)),0 1px 0 rgba(255,255,255,calc(.08 * var(--lcda,1)));text-shadow:0 0 12px rgba(255,170,60,.8)}
.av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;margin-left:-8px;border:2px solid #1d1e22}
.status .it.rgt{margin-left:auto}
.status .it.rgt~.it.rgt{margin-left:0}
.status .sic.na{opacity:.35}
/* Einstellungs-Taste als eigenes Segment der Leiste: volle Höhe, links und rechts weiche Trennfugen (Leiste endet / geht weiter) */
.status .it.sic{align-self:stretch;align-items:stretch;height:auto;padding:0;margin:0 4px;border:0;box-shadow:none}
.status .it.sic+.it{border-left:0;box-shadow:none}
.skt{display:flex;align-items:stretch;padding:0 9px;background:rgba(0,0,0,.42);
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 8px,#000 calc(100% - 8px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 8px,#000 calc(100% - 8px),transparent 100%)}
.skey{position:relative;width:74px;border-radius:13px;display:grid;place-items:center;cursor:pointer;color:#b9d9f0;overflow:hidden;
  background:linear-gradient(180deg,rgba(66,68,75,.96),rgba(30,31,35,.98));border:1px solid rgba(255,255,255,.08);
  box-shadow:0 0 0 1px #000,inset 0 1px 0 rgba(255,255,255,.16),inset 0 -1px 0 rgba(0,0,0,.6),0 0 12px rgba(0,0,0,.55);transition:transform .12s,filter .12s}

.skey::after{content:"";position:absolute;left:24px;right:24px;bottom:9px;height:2px;border-radius:1px;background:#4dc3ff;box-shadow:0 0 6px #4dc3ff;opacity:.7;transition:opacity .12s}
.skey svg{position:relative;z-index:1;width:24px;height:24px;margin-top:-4px;filter:drop-shadow(0 0 4px rgba(77,195,255,.55));transition:transform .6s cubic-bezier(.3,1.4,.5,1)}
.skey:active{transform:translateY(1px);filter:brightness(.92)}
.skey:active::after{opacity:1}
.skey:active svg{transform:rotate(60deg)}
/* Digitalanzeige links: Alarmanlage + Anwesenheit nur als Symbole */
.sdisp{display:flex;align-items:center;gap:12px;height:46px;padding:0 16px;border-radius:10px}
.sdisp>*{position:relative;z-index:1}
.sdisp svg{width:26px;height:26px;display:block;transition:color .4s,filter .4s}
.sdsep{width:2px;height:26px;border-radius:1px;background:rgba(90,94,102,.35)}
.sdp{display:flex;gap:8px}
.sdk{display:flex;gap:12px;cursor:pointer}
.sdb{position:relative;display:block;width:38px;height:30px;transition:color .4s}
.sdb img.h{width:38px;height:30px;display:block;transition:filter .4s}
/* Abzeichen als rote gewölbte Kuppe mit weißem Zeichen */
.sdb .bdg,.sbm .bdg{position:absolute;right:-6px;bottom:-5px;width:13px;height:13px;border-radius:50%;display:none;place-items:center;color:#fff;
  background:radial-gradient(circle at 36% 28%,#ffb0a8 0,#f0443c 32%,#b81b1b 68%,#5e0808 100%);
  box-shadow:0 1.5px 1.5px rgba(0,0,0,.9),0 3px 4px rgba(0,0,0,.5),inset 0 -1px 1.5px rgba(0,0,0,.45),inset 0 .5px 0 rgba(255,255,255,.5)}
.sdb .bdg svg{width:9px;height:9px;display:block;stroke-width:2.6;filter:drop-shadow(0 .5px .4px rgba(80,0,0,.9))}
.sdb .bdg.bmute,.sdb .bdg.boff{display:grid}
.sbm{position:relative;display:block;width:30px;height:30px;cursor:pointer}
.sbm svg{width:30px;height:30px;display:block;overflow:visible;transition:filter .4s}
.sbm .bmf{fill:var(--bc);transition:y .8s ease,height .8s ease,fill .6s}
.sbm.low svg{animation:batlow 1s ease-in-out infinite}
.sbm .bmn{right:-7px;bottom:-4px;width:15px;height:15px;font:700 9.5px/1 Rajdhani,sans-serif;color:#fff;text-shadow:0 .5px .4px rgba(80,0,0,.9)}
.s3defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}
/* Akku: Lichtreflex wandert beim Laden über das Glas */
.s3sw{animation:s3sweep 9s ease-in-out infinite;animation-delay:var(--sd,0s)}
@keyframes s3sweep{0%,74%{transform:translateX(0)}100%{transform:translateX(var(--sx,34px))}}
.bat:not(.charge) .s3sw{display:none}
@media (prefers-reduced-motion:reduce){.s3sw{animation:none}}

.sdp svg{width:24px;height:24px}
.sdi.alarm img{animation:batlow 1s ease-in-out infinite}
/* Mit Start-Taste zeichnet die Statusleiste ihr Glas selbst: zwei getrennte Platten mit echter Lücke */
.sbwrap{display:flex;height:100%;gap:1.5px}
.sbwrap>.status{flex:1;min-width:0;border-radius:3px 20px 20px 3px;background:linear-gradient(180deg,rgba(50,52,58,calc(var(--pa1,.78) * .8 * var(--pt,1))),rgba(24,25,29,calc(var(--pa2,.88) * .8 * var(--pt,1))))}

.sbwrap>.sbstart{border-radius:20px 3px 3px 20px;background:linear-gradient(180deg,rgba(50,52,58,calc(var(--pa1,.78) * .8 * var(--pt,1))),rgba(24,25,29,calc(var(--pa2,.88) * .8 * var(--pt,1))))}
.sbstart{flex:none;width:86px;display:grid;place-items:center;cursor:pointer;transition:transform .2s cubic-bezier(.2,.8,.3,1)}
/* Drücken: Mulde breitet sich von der Mitte nach außen aus, Platte gibt minimal nach */
.sbstart::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transform:scale(.25);background:radial-gradient(ellipse at center,rgba(0,0,0,.42) 0%,rgba(0,0,0,.2) 45%,rgba(0,0,0,0) 78%);box-shadow:inset 0 0 16px rgba(0,0,0,.7),inset 0 3px 7px rgba(0,0,0,.6);transition:opacity .25s ease,transform .3s cubic-bezier(.2,.8,.3,1)}
.sbstart.pr{transform:scale(.982)}
.sbstart.pr::after{opacity:1;transform:scale(1);transition:opacity .12s ease,transform .18s cubic-bezier(.2,.8,.3,1)}
.sbstart.pr .sbk{transform:scale(.93)}
.sbk{transition:transform .2s cubic-bezier(.2,.8,.3,1)}
.sbstart.na{opacity:.4;pointer-events:none}
.sbk{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:8px;color:#b9d9f0}
.sbk .g3{position:relative;display:block;width:54px;height:32px;transition:transform .2s cubic-bezier(.2,.8,.3,1)}
.sbk .g3 img{position:absolute;inset:0;width:100%;height:100%}
.sbk .g3t{filter:blur(.4px) brightness(.8) drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.sbk .g3r{filter:drop-shadow(0 1.5px 1px rgba(0,0,0,.9)) drop-shadow(0 3.5px 3px rgba(0,0,0,.55)) drop-shadow(0 2px 6px rgba(77,195,255,.25));transition:transform .25s cubic-bezier(.2,.8,.3,1)}
.sbk::after{content:"";width:28px;height:2px;border-radius:1px;background:#4dc3ff;box-shadow:0 0 6px #4dc3ff;opacity:.7;transition:opacity .12s}
.sbstart.pr .sbk .g3r{transform:scale(.92)}
.sbstart.pr .sbk::after{opacity:1}
/* Start-Taste ganz links: bündig am Rand, nur rechts eine Trennfuge */
.status .it.sic.first{margin-left:-18px}
.sic.first .skt{padding-left:0;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 8px),transparent 100%);mask-image:linear-gradient(90deg,#000 calc(100% - 8px),transparent 100%)}
.sic.first .skey{border-radius:0 13px 13px 0;border-left:0}
/* Infobereich rechts (wie Windows-Taskleiste): Tray-Symbole + Uhrzeit/Datum in einem Display */
.status .it.trayw{padding-right:0;border:0;box-shadow:none}
.stray{display:flex;align-items:center;gap:16px;height:54px;padding:0 18px;border-radius:11px}
.stray>*{position:relative;z-index:1}
.stray .sdi img,.stray .sdp img{width:30px;height:30px;display:block;transition:filter .4s}
.stray .sdp{gap:6px}
.stray .sdsep{height:32px}
.tbat{position:relative;top:6px;display:flex;align-items:center}
.tbat svg.batic{width:40px;height:20px}
.tbat b{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:1px;line-height:1;white-space:nowrap;font:400 12px 'Share Tech Mono',monospace;color:var(--bc);text-shadow:0 0 8px var(--bg,transparent);transition:color .6s}
.bat.low b{animation:batlow 1.6s ease-in-out infinite}
.sclk{text-align:center;line-height:1;white-space:nowrap}
.sct{font-size:30px;color:#ffb347;text-shadow:0 0 12px rgba(255,170,60,.8)}
.scd{font-size:11.5px;letter-spacing:1px;color:rgba(255,179,71,.72);text-shadow:0 0 8px rgba(255,170,60,.4);margin-top:4px}
.bat{--bc:#6f737c;gap:12px}
.bat .bcol{display:flex;flex-direction:column;align-items:center;gap:3px}
.bat .bcol .v{font-size:15px!important;line-height:1}
.bat .s:empty{display:none}
.bat svg.batic{width:42px;height:21px;color:var(--bc);overflow:visible;filter:drop-shadow(0 1.4px .8px rgba(0,0,0,.95)) drop-shadow(0 3px 2.5px rgba(0,0,0,.6))}
.bat .bbody{fill:url(#s3-case);stroke:url(#s3-rim);stroke-width:1.1}
.bat .bfill{fill:var(--bc);transition:width .8s ease,fill .6s}
.bat .bflow{fill:var(--bc);opacity:0;transform-box:fill-box;transform-origin:left center}
.bat .bshine{fill:url(#s-bshine);opacity:0}
.bat .bsym{fill:#fff;stroke:#101114;stroke-width:1.3;stroke-linejoin:round;paint-order:stroke;opacity:0;transition:opacity .3s}
.bat .v{color:var(--bc);text-shadow:0 0 10px var(--bg,transparent);transition:color .6s}
.bat.charge .bflow{animation:batflow 1.8s cubic-bezier(.4,0,.6,1) infinite}
.bat.charge .bshine{opacity:1;animation:batshine 2.4s linear infinite}
.bat.charge .bsym.bolt,.bat.full .bsym.plug{opacity:1}
.bat.charge .bsym.bolt{animation:batbolt 1.8s ease-in-out infinite}
.bat.charge svg.batic,.bat.full svg.batic{filter:drop-shadow(0 1.4px .8px rgba(0,0,0,.95)) drop-shadow(0 3px 2.5px rgba(0,0,0,.6)) drop-shadow(0 2px 6px var(--bg))}
.bat.low svg.batic,.bat.low .v{animation:batlow 1.6s ease-in-out infinite}
@keyframes batflow{0%{transform:scaleX(0);opacity:.0}15%{opacity:.75}80%{transform:scaleX(1);opacity:.5}100%{transform:scaleX(1);opacity:0}}
@keyframes batshine{from{transform:translateX(-60px)}to{transform:translateX(60px)}}
@keyframes batbolt{0%,100%{filter:drop-shadow(0 0 1px #fff)}50%{filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 9px var(--bc))}}
@keyframes batlow{0%,100%{opacity:1;filter:drop-shadow(0 0 8px #ff3b3b) drop-shadow(0 0 2px #ff5a5a)}50%{opacity:.22;filter:none}}
`;

// ======================================================================================
// Raum-Panel v2: Block-Raster mit Glasrahmen, darin eigenständige Module (beliebig oft)
// ======================================================================================

// Zusatz-Styles für Module (Inhalt ohne eigenen Hintergrund, auf Rahmengröße skaliert)
const MOD_CSS = `
:host{display:block;position:relative;width:100%;height:100%;overflow:visible;background:transparent;color:#c9ccd2;line-height:1.2;
  font-family:Rajdhani,'Segoe UI',sans-serif;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.box{position:absolute;left:0;top:0;transform-origin:top left}
.part{min-width:0}
.cell{position:relative;min-width:0;min-height:0}.cin{position:absolute;left:0;top:0;transform-origin:top left}
/* Hülle eines einzeln gesetzten Teil-Elements: Klassen der Gruppe (Aussehen), aber ohne deren Lage/Raster */
.subw{position:relative!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;display:block!important;margin:0!important;transform:none!important;width:auto;height:auto}
.subw>.hk,.subw>.rk,.subw>.tab,.subw>.tile{width:100%}
.vcol{display:flex;flex-direction:column}.hrow{display:flex}
.hstep{display:grid;grid-template-columns:72px 1fr 72px;gap:12px;align-items:stretch}
.hstep>.hk{height:auto;min-height:64px;font:700 30px Rajdhani,sans-serif;letter-spacing:0}
.hst{text-align:center;padding:6px 8px}.hst .u{font-size:11px;letter-spacing:3px;opacity:.8}.hst b{display:block;font-size:36px;font-weight:400;line-height:1.05}.hst .i{font-size:13px;color:#c9ccd2;opacity:.85}
.fill{height:100%}
.ovlhost{position:absolute;inset:0;pointer-events:none;z-index:30}
.rp-ovl{position:absolute;inset:0;pointer-events:none}
.rp-ovl>*{pointer-events:auto}
.rp-ovl .ppbox{transform:scale(var(--su,1))}
.xerr{padding:14px;border-radius:14px;background:rgba(255,90,90,.12);color:#ff8a8a;font-size:13px}
.aset{display:flex;gap:26px;align-items:stretch}
.aset .asec{position:relative;display:flex;flex-direction:column;gap:10px;min-width:0}
.aset .asec+.asec{padding-left:26px;border-left:1px solid rgba(0,0,0,.55);box-shadow:inset 1px 0 0 rgba(255,255,255,.05)}
.aset .achs{position:relative;height:296px}
.aset .asub{font-size:10.5px;margin-top:8px}
.aset .aopts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.aset .aopts .hk{height:30px}
.aset .cap small{font-size:10px;letter-spacing:1px;color:#8a8f98;margin-left:8px}
.aset #m-dol{height:36px}
.aem{font-style:normal;color:#8a8f98;font-size:12px;letter-spacing:2px}
.aprs{display:flex;flex-direction:column;gap:9px}
.aprow{display:grid;grid-template-columns:70px 1fr 130px;gap:12px;align-items:center}
.aprow>.hk{height:36px}
.apv{display:flex;gap:4px;height:38px;padding:4px 10px;align-items:center;border-radius:9px}
.apv span{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:16px;color:#c9ccd2;line-height:1;position:relative;z-index:1}
.apv small{font:700 8px Rajdhani,sans-serif;letter-spacing:1.3px;color:#979ca5}
.apv em{flex:1;text-align:center;font-style:normal;color:#8a8f98;font-size:12px;letter-spacing:2px}
`;

// Styles des Panels: Bühne, Hintergrund, Rahmen
const PANEL_CSS = `
:host{display:block;position:relative;overflow:hidden;background:#111215}
.pstage{position:absolute;inset:0;overflow:hidden;background-color:#141519;transition:background-color 12s linear;
  font-family:Rajdhani,'Segoe UI',sans-serif;color:#c9ccd2}
/* Hintergrund: Bild (Diashow) · Himmel mit echtem Sonnen-/Mondstand; Abdunkeln über --dk */
.bgimg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.6s ease}
.bgimg.on{opacity:1}.bgimg::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,var(--dk,.25))}
.cel{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 2s}.cel.on{opacity:1}
.cel .cgr{position:absolute;inset:0;transition:background 20s linear}.cel.nograd .cgr,.cel.nograd .cdk{display:none}
.cel canvas{position:absolute;inset:0;width:100%;height:100%;transition:opacity 20s linear}
.cel .sunb{position:absolute;border-radius:50%;background:radial-gradient(circle,#fffdf2 0 34%,var(--sc,#ffe08a) 48%,rgba(255,200,90,.35) 60%,transparent 72%);box-shadow:0 0 calc(var(--sr) * 1.4) calc(var(--sr) * .45) var(--sg,rgba(255,210,120,.45))}
.cel .moonb{position:absolute;overflow:visible;filter:drop-shadow(0 0 calc(var(--mr) * .25) rgba(215,225,255,var(--mg,.45)))}
.cel .cdk{position:absolute;inset:0;background:rgba(0,0,0,var(--dk,.2))}
.cel.live .sunb,.cel.live .moonb{transition:opacity 8s linear}
/* Sonnen-Schimmer: Lichtfleck oben auf den Glasrahmen an der horizontalen Position der Sonne (Ost links, West rechts) */
.frame.plate::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;transition:background 2s linear;
  background:radial-gradient(calc(420px * var(--su,1)) calc(240px * var(--su,1)) at var(--gx,-9999px) calc(-30px * var(--su,1)),rgba(var(--gc,255,240,210),calc(var(--ga,0) * .2)) 0%,rgba(var(--gc,255,240,210),calc(var(--ga,0) * .07)) 42%,rgba(var(--gc,255,240,210),0) 72%)}
.frame.plate::after{content:"";position:absolute;left:0;right:0;top:0;height:2px;pointer-events:none;
  background:radial-gradient(calc(300px * var(--su,1)) 2px at var(--gx,-9999px) 0,rgba(var(--gc,255,240,210),calc(var(--ga,0) * .85)),rgba(var(--gc,255,240,210),0) 70%)}
.frame.nosun::before,.frame.nosun::after{display:none}
.frames{position:absolute;inset:0;z-index:2}
.frame{position:absolute;display:flex;min-width:0;min-height:0}
.frame.plate{border-radius:calc(20px * var(--su,1))}
.frame>.fb{position:relative;flex:1;display:flex;min-width:0;min-height:0}
/* freie Form (ecken:): Kante + Schatten kommen als SVG, die Lichtkante oben passt nicht zu schrägen Kanten */
.frame.poly{border:0;box-shadow:none}
.frame.poly::after{display:none}
.pedge{position:absolute;left:0;top:0;z-index:4;pointer-events:none;overflow:visible}
.pshadow{position:absolute;pointer-events:none;overflow:visible}
.frame.poly>.dbgl{left:var(--lbx,6px);top:var(--lby,4px)}
.editing .frame.poly>.edov{border-color:transparent;box-shadow:none}
.editing .frame.poly>.edov>.edrs{display:none}
.editing .frame.poly .pedge .eo{stroke:rgba(77,195,255,.6);stroke-width:5;stroke-dasharray:10 7}
.editing .frame.poly.psel .pedge .eo{stroke:#4dc3ff;stroke-dasharray:none}
.pslot{position:relative;min-width:0;min-height:0;display:flex;box-sizing:border-box}
/* zoom: Doppeltipp – Rahmen wird zum Vollbild-Rechteck (Form wird animiert), Module bekommen den ganzen Platz */
.frame.zon{z-index:20}
.rpfps{position:absolute;left:8px;top:8px;z-index:60;pointer-events:none;padding:6px 10px;border-radius:8px;background:rgba(0,0,0,.72);font:13px/1.35 'Share Tech Mono',monospace!important;color:#c9ccd2;white-space:nowrap}
.rpfps small{display:block;font-size:10.5px;color:#9a9fa8}
.zpre{position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;z-index:-1}
.zpre>.pslot{position:absolute;left:0;top:0;contain:strict}
/* während der Zoom-Bewegung: kein Weichzeichner hinter dem Rahmen (würde in jedem Bild neu berechnet), dafür deckender */
.frame.zanim{--pbf:none;--pa1:.86;--pa2:.93}
.frame.zanim>.pedge,.pshadow.zanim{visibility:hidden}
.zback{position:absolute;inset:0;z-index:19;background:rgba(0,0,0,.62);opacity:0;pointer-events:none;transition:opacity .35s;will-change:opacity}
.zback.on{opacity:1;pointer-events:auto}
.pstage.zoomon .frames{z-index:35}
.pstage.zoomon .edelov{z-index:36}
.zbar{position:absolute;right:calc(18px * var(--su,1));top:calc(18px * var(--su,1));z-index:37;display:flex;gap:8px}
.zbar[hidden]{display:none}
.zbar button{height:34px;padding:0 13px;border-radius:17px;border:1px solid rgba(255,255,255,.18);background:rgba(20,21,25,.72);color:#9fd8ff;font:600 13px 'Segoe UI',sans-serif;cursor:pointer}
.zbar button:hover{border-color:#4dc3ff}
.zbar.ed{right:350px}
.edside.zleft,.edside.left{right:auto;left:0;border-left:0;border-right:1px solid rgba(77,195,255,.25)}
.edside.off{display:none}
.edbar button.on{border-color:#4dc3ff;color:#9fd8ff}
.pslot>*{flex:1;min-width:0;min-height:0}
.ovlhost{position:absolute;inset:0;pointer-events:none;z-index:40}
.rp-ovl{position:absolute;inset:0;pointer-events:none}
.rp-ovl>*{pointer-events:auto}
.rp-ovl .ppbox{transform:scale(var(--su,1))}
.xcard{overflow:auto;scrollbar-width:none;border-radius:calc(14px * var(--su,1))}
.xerr{padding:14px;border-radius:14px;background:rgba(255,90,90,.12);color:#ff8a8a;font-size:13px}
.grid-dbg{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.55}
.grid-num{position:absolute;inset:0;z-index:3;pointer-events:none}
.dbgl{position:absolute;left:6px;top:4px;z-index:5;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.75);color:#9fd8ff;font:600 12px sans-serif;pointer-events:none;white-space:nowrap}
.dbgov{outline:3px solid #ff5a5a;outline-offset:-3px}.dbgov>.dbgl{color:#ff8a8a}
/* Einstellungen: eigenes Dashboard als Fenster mit Navigationsleiste */
.spop{position:absolute;inset:0;z-index:38;display:grid;place-items:center;background:rgba(0,0,0,.42);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.spop[hidden]{display:none}
.spop.anim{animation:spfade .25s ease}
.spop.anim .swin{animation:spwin .34s cubic-bezier(.2,1.15,.4,1)}
@keyframes spfade{from{opacity:0}}
@keyframes spwin{from{opacity:0;transform:scale(calc(var(--su,1) * .93)) translateY(16px)}}
.swin{width:1140px;height:700px;flex:none;display:flex;flex-direction:column;transform:scale(var(--su,1));--pa1:.82;--pa2:.92;color:#c9ccd2;line-height:1.2;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;font-family:Rajdhani,'Segoe UI',sans-serif}
.sbar{position:relative;z-index:1;display:flex;align-items:center;gap:16px;height:62px;flex:none;padding:0 14px 0 16px;border-bottom:1px solid rgba(0,0,0,.55);box-shadow:0 1px 0 rgba(255,255,255,.05);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,0))}
.snav{display:flex;gap:4px;padding:3px;border-radius:11px;background:rgba(0,0,0,.35);box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.05)}
.sbtn{width:40px;height:34px;border-radius:8px;display:grid;place-items:center;color:#aeb2b9;cursor:pointer;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12);transition:opacity .2s}
.sbtn svg{width:18px;height:18px}
.sbtn:active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.1)}
.sbtn.dis{opacity:.28;pointer-events:none}
.sbtn.sx{width:46px;height:38px;color:#ff8a8a;border-radius:10px}
.sbtn.sx svg{filter:drop-shadow(0 0 4px rgba(255,90,90,.6))}
.scrumb{flex:1;align-self:center;height:42px;padding:0 14px;border-radius:11px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05);display:flex;align-items:center;gap:9px;font-size:15px;letter-spacing:1.8px;font-weight:700;text-transform:uppercase;color:#9a9fa8;white-space:nowrap;min-width:0;overflow:hidden}
.scrumb>svg:first-child{width:22px;height:22px;color:#4dc3ff;filter:drop-shadow(0 0 5px rgba(77,195,255,.6))}
.scrumb .sep{width:13px;height:13px;opacity:.45;flex:none}
.scrumb [data-s]{cursor:pointer}
.scrumb b{color:#eef0f3;text-shadow:0 0 12px var(--tc,transparent);transition:text-shadow .3s}
.stabs{position:relative;display:flex;gap:6px;flex:none;margin:16px 18px 0;padding:5px;border-radius:13px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05)}
.stab{position:relative;z-index:1;flex:1;height:48px;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:14.5px;letter-spacing:2px;font-weight:700;text-transform:uppercase;color:#9a9fa8;cursor:pointer;transition:color .3s;white-space:nowrap}
.stabs:has(.stab:nth-child(7)) .stab{letter-spacing:1px;gap:7px;font-size:13.5px}
.stab svg,.stab ha-icon{width:21px;height:21px;--mdc-icon-size:21px;flex:none;transition:color .3s,filter .3s}
.stab.on{color:#f0f1f3}
.stab.on svg,.stab.on ha-icon{color:var(--tc);filter:drop-shadow(0 0 5px var(--tc))}
.stab:active{transform:translateY(1px)}
.sind{position:absolute;z-index:0;top:5px;left:5px;width:0;height:48px;border-radius:9px;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 3px 0 #0b0b0c,0 5px 10px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12);transition:left .4s cubic-bezier(.3,1.2,.5,1),width .4s cubic-bezier(.3,1.2,.5,1)}
.sind.noanim{transition:none}
.sind::after{content:"";position:absolute;left:18px;right:18px;bottom:4px;height:2px;border-radius:1px;background:var(--tc,#4dc3ff);box-shadow:0 0 6px var(--tc,#4dc3ff);transition:background .3s,box-shadow .3s}
.sbody{position:relative;flex:1;min-height:0;margin-top:14px;color-scheme:dark;
  --ha-card-background:rgba(0,0,0,.25);--card-background-color:#1d1e22;--ha-card-border-radius:14px;--ha-card-border-width:0;
  --ha-card-box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05);--primary-text-color:#e6e7ea;--secondary-text-color:#8a8e96;
  --primary-color:#4dc3ff;--accent-color:#4dc3ff;--divider-color:rgba(255,255,255,.08);--state-icon-color:#aeb2b9;--paper-item-icon-color:#aeb2b9;
  --mdc-theme-primary:#4dc3ff;--secondary-background-color:#26272b;--primary-background-color:#141519;--input-fill-color:rgba(0,0,0,.3)}
.spage{position:absolute;inset:0;overflow:auto;padding:4px 18px 20px;scrollbar-width:thin;scrollbar-color:#3a3c41 transparent}
.spage[hidden]{display:none}
.spage.in-r{animation:spr .36s cubic-bezier(.2,.9,.3,1)}.spage.in-l{animation:spl .36s cubic-bezier(.2,.9,.3,1)}
@keyframes spr{from{opacity:0;transform:translateX(46px)}}
@keyframes spl{from{opacity:0;transform:translateX(-46px)}}
.sgrid{display:grid;grid-template-columns:repeat(var(--sc,2),minmax(0,1fr));gap:16px;align-items:start}
.scell{position:relative;min-width:0}
.scell.rpm{border-radius:16px;background:rgba(0,0,0,.22);box-shadow:inset 0 2px 6px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05);padding:8px}
.scell.rpm>*{display:block;width:100%;height:100%}
.sempty,.serr{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;color:#979ca5;font-size:15px;letter-spacing:1px}
.sempty svg{width:72px;height:72px;color:var(--tc,#3a3c41);opacity:.35}
.sempty b{font-size:22px;letter-spacing:3px;text-transform:uppercase;color:#9a9ea6}
.serr b{color:#ff8a8a;font-size:18px;letter-spacing:2px;text-transform:uppercase}
.serr code{font-family:'Share Tech Mono',monospace;color:#c9ccd2}
`;

const L = (d, c) => Object.assign({}, d, c);
const loadFonts = () => {
  if (document.getElementById('rtc-fonts')) return;
  const l = document.createElement('link');
  l.id = 'rtc-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Share+Tech+Mono&display=swap';
  document.head.appendChild(l);
};
// Schrift „Charlie Dotted“ (Erscheinungsbild): große Texte aus Leuchtpunkten, kleine in der ausgefüllten Fassung derselben Schrift.
// Dateien: <RP_FONT_BASE>charlie_punkte.ttf / charlie_voll.ttf (CC BY-SA 3.0, nirmalbiswas – erweitert um ä ö ü ß ° …)
const CD_PITCH = 32 / 1024;                 // Punktabstand je em
const CD_MIN = 3.2;                         // ab so vielen Bildschirmpixeln Punktabstand → Punkte, darunter ausgefüllt
const cdFaces = () => {
  if (document.getElementById('rp-cd-faces')) return;
  const b = window.RP_FONT_BASE || RP_BASE + 'fonts/', st = document.createElement('style'); st.id = 'rp-cd-faces';
  st.textContent = `@font-face{font-family:'RP Charlie Punkte';src:url('${b}charlie_punkte.ttf') format('truetype');font-display:block}
@font-face{font-family:'RP Charlie Voll';src:url('${b}charlie_voll.ttf') format('truetype');font-display:block}`;
  document.head.appendChild(st);
};
// cap-height angleichen: Charlie ist bei gleicher Schriftgröße kleiner als Rajdhani/Share Tech Mono
const CD_CSS = `*{font-family:'RP Charlie Voll','Share Tech Mono',monospace!important;font-weight:400!important;font-synthesis:none!important;font-size-adjust:cap-height .6}
.rpcd,.rpcd *{font-family:'RP Charlie Punkte','RP Charlie Voll',monospace!important}`;
// Elemente mit eigenem Text: Punkte, wenn der Punktabstand auf dem Bildschirm groß genug ist
// Schätzung über die Skalierung des Moduls (host._scale); nur in der Nähe der Schwelle wird genau gemessen.
// list = nur diese Elemente (aus dem MutationObserver), sonst alle des Roots
let CD_HOLD = 0;                             // > 0: Zoom-Animation läuft – Prüfung aufschieben
const CD_LATER = new Set();
const cdMark = (root, list) => {
  if (CD_HOLD) { CD_LATER.add(root); return; }
  const host = root.host, rs = (host && host._scale) || 1, dpr = window.devicePixelRatio || 1;
  for (const e of list || root.querySelectorAll('*')) {
    if (!e.isConnected || e.nodeType !== 1) continue;
    const tag = e.tagName; if (tag === 'STYLE' || tag === 'SCRIPT') continue;
    const svgT = tag === 'text' || tag === 'tspan';
    let txt = false; for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { txt = true; break; }
    if (!svgT && !txt) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize); let dp = fs * CD_PITCH * rs * dpr;
    if (dp > CD_MIN * .45 && dp < CD_MIN * 2.2) {   // unsicher (eigene Skalierung möglich) → genau messen
      let sc = rs;
      if (svgT) { const m = e.getScreenCTM && e.getScreenCTM(); sc = m ? Math.hypot(m.a, m.b) : rs; }
      else if (e.offsetHeight) sc = e.getBoundingClientRect().height / e.offsetHeight;
      dp = fs * CD_PITCH * sc * dpr;
    }
    const on = dp >= CD_MIN; if (e.classList.contains('rpcd') !== on) e.classList.toggle('rpcd', on);
    e._cd = 1;                                 // entschieden – reine Textwechsel prüfen wir nicht erneut
  }
};
const cdRelease = () => { if (--CD_HOLD > 0) return; CD_HOLD = 0; const rs = [...CD_LATER]; CD_LATER.clear(); rs.forEach(r => cdMark(r)); };
// Schrift an einem Shadow-Root ein-/ausschalten (Stil + Beobachter für neu gerenderte Texte)
// adoptedStyleSheets: übersteht Karten, die ihr ganzes shadowRoot.innerHTML neu schreiben (z. B. Batterie-Manager)
const CD_OBS = new WeakMap();
let CD_SHEET = null;
try { CD_SHEET = new CSSStyleSheet(); CD_SHEET.replaceSync(CD_CSS); } catch (e) { CD_SHEET = null; }
const cdSet = (r, on) => {
  let st = CD_SHEET ? null : [...r.children].find(e => e.matches('style.rp-cd'));
  if (!on) {
    if (CD_SHEET) { if (r.adoptedStyleSheets.includes(CD_SHEET)) r.adoptedStyleSheets = r.adoptedStyleSheets.filter(s => s !== CD_SHEET); }
    else if (st) st.remove();
    const o = CD_OBS.get(r); if (o) { o.disconnect(); CD_OBS.delete(r); } return;
  }
  cdFaces();
  if (CD_SHEET) { if (!r.adoptedStyleSheets.includes(CD_SHEET)) r.adoptedStyleSheets = [...r.adoptedStyleSheets, CD_SHEET]; }
  else if (!st) { st = document.createElement('style'); st.className = 'rp-cd'; st.textContent = CD_CSS; r.appendChild(st); }
  if (!CD_OBS.has(r)) {
    // nur die geänderten Elemente sammeln und einmal je Bild prüfen
    let q = 0; const todo = new Set();
    const o = new MutationObserver(recs => {
      for (const m of recs) {
        // Uhr, Countdown usw. schreiben jede Sekunde Text neu – Schriftgröße ändert sich dabei nicht → nur neue Elemente prüfen
        const t = m.type === 'characterData' ? m.target.parentElement : m.target;
        if (t && t.nodeType === 1 && !t._cd) todo.add(t);
        for (const n of m.addedNodes) if (n.nodeType === 1) { if (!n._cd) todo.add(n); n.querySelectorAll && n.querySelectorAll('*').forEach(x => { if (!x._cd) todo.add(x); }); }
      }
      if (!q && todo.size) q = requestAnimationFrame(() => { q = 0; const l = [...todo]; todo.clear(); cdMark(r, l); });
    });
    o.observe(r, { childList: true, subtree: true, characterData: true }); CD_OBS.set(r, o);
    cdMark(r);                              // einmal komplett beim Einschalten
  }
};
// ---- Globale Schrift für alle eigenen Karten (v2.49): Standard 'charlie'.
// raum-panel.js ist als Ressource auf jedem Dashboard geladen und kümmert sich deshalb auch um die anderen eigenen Karten.
// Im Raum-Panel: YAML schrift: charlie|standard (Bett-Tablets: Einstellung „Erscheinungsbild“ hat Vorrang).
// Ganz abschalten: window.RP_SCHRIFT = 'standard' (z. B. in einer eigenen Ressource vor raum-panel.js).
const CD_TAGS = /^(RP-[A-Z0-9-]+|BATTERIE-MANAGER|BLE-ANLERNEN-CARD|FENSTER-TUER-MANAGER|HAUS-GRUNDRISS|HOME-TWIN-[A-Z0-9-]+|KLINGEL-KAMERA-CARD|RAUM-TABLET-CARD|RING-SPRECHEN-CARD)$/;
const cdDefault = () => (window.RP_SCHRIFT || 'charlie') === 'charlie';
const cdInPanel = h => { while (h) { if (h.tagName === 'RAUM-PANEL') return true; const r = h.getRootNode(); h = r && r.host; } return false; };
const CD_G = { pend: new Set(), q: 0, fontsLoaded: false };
const cdGlobalRun = () => {
  CD_G.q = 0;
  for (const r of [...CD_G.pend]) {
    if (!r.host.isConnected) continue;              // noch nicht eingehängt → später erneut
    CD_G.pend.delete(r);
    if (cdInPanel(r.host)) continue;                // das Raum-Panel steuert seine Module selbst
    cdSet(r, cdDefault());
  }
  if (CD_G.pend.size) CD_G.q = setTimeout(cdGlobalRun, 700);
  if (cdDefault() && document.fonts && !CD_G.fontsLoaded) {
    CD_G.fontsLoaded = true;
    document.fonts.load("40px 'RP Charlie Punkte'").then(() => document.fonts.load("40px 'RP Charlie Voll'")).then(() => cdGlobalScan(true)).catch(() => {});
  }
};
const cdGlobalAdd = r => { CD_G.pend.add(r); if (!CD_G.q) CD_G.q = setTimeout(cdGlobalRun, 0); };
// Karten, die schon vor raum-panel.js erzeugt wurden, über den ganzen Baum suchen (einmal je Seitenwechsel)
const cdGlobalScan = remark => {
  const walk = root => { for (const e of root.querySelectorAll('*')) if (e.shadowRoot) { if (CD_TAGS.test(e.tagName)) { if (remark && CD_OBS.has(e.shadowRoot)) cdMark(e.shadowRoot); else if (!CD_OBS.has(e.shadowRoot)) cdGlobalAdd(e.shadowRoot); } walk(e.shadowRoot); } };
  try { walk(document); } catch (e) { /* egal */ }
};
if (!window.__rpCdHook) {
  window.__rpCdHook = true;
  const as = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (o) { const r = as.call(this, o); if (CD_TAGS.test(this.tagName) && o && o.mode === 'open') cdGlobalAdd(r); return r; };
  setTimeout(() => cdGlobalScan(), 1500);
  window.addEventListener('location-changed', () => setTimeout(() => cdGlobalScan(), 600));
}
// size = sichtbare Größe (Außenkante des Rillenkranzes). LEDs sitzen genau auf den hellen Balken des Kranzes
// (alle 4°, 135°…403°), behalten deren Form und leuchten statt des früheren Punktkranzes.
// ring: { min, max } = Ring wie üblich (270, LEDs r 129), aber unten zwischen den LED-Enden ausgebuchtet (r 145, Box 290)
// mit min/max-Beschriftung darin; die Reglermitte bleibt gleich groß, size ist entsprechend größer (306 → 329)
// Seitenteil der unteren Ausbuchtung (Kranz-Box 290, Mitte 145): Keil 45°, Rand r145, unten flach bei 118 – Ecken gerundet
const SKB = {};
const skbPath = side => SKB[side] || (SKB[side] = (() => {
  const c = 145, R = 145, cut = 118, rad = a => a * Math.PI / 180, x = a => c + R * Math.cos(rad(a)), y = a => c + R * Math.sin(rad(a));
  const a0 = side < 0 ? 135 : 45, a1 = side < 0 ? 180 - Math.asin(cut / R) * 180 / Math.PI : Math.asin(cut / R) * 180 / Math.PI;
  const arc = [0, .5, 1].map(t => a0 + (a1 - a0) * t).map(a => [x(a), y(a)]);
  // innen nur bis zum Metallring (Bezel r123 trifft die Unterkante) – der Rest liegt unter dem Regler
  const xb = Math.sqrt(123 * 123 - cut * cut) * side;
  const P = [[c, c], ...arc, [c + xb, c + cut]];
  return polyPath(side < 0 ? P : P.reverse(), 6);
})());
const dialHtml = (id, kind, size, ring) => {
  const U = ring ? 290 : 270, R = 129, off = (330 - U) / 2, pt = (a, r) => [165 + r * Math.cos(a * Math.PI / 180), 165 + r * Math.sin(a * Math.PI / 180)];
  let dots = '';
  // 68 LEDs von 136° bis 404° – links und rechts gleich weit von der Unterseite
  for (let i = 0; i < 68; i++) { const a = 136 + i * 4, [x, y] = pt(a, R); dots += `<div class="dot" style="left:${x.toFixed(2)}px;top:${y.toFixed(2)}px;transform:rotate(${a + 90}deg)"></div>`; }
  if (ring) { const [lx, ly] = pt(126, 135), [rx, ry] = pt(54, 135); dots += `<span class="dlim" id="${ring.min}" style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px"></span><span class="dlim" id="${ring.max}" style="left:${rx.toFixed(1)}px;top:${ry.toFixed(1)}px"></span>`; }
  const inner = kind === 'light'
    ? '<div class="skirt"><div class="bezel"><div class="wheel"></div></div></div><div class="hub"><div class="lcd acc"><div><b class="hv">--</b><span>% HELL</span></div></div></div><div class="handle"></div>'
    : '<div class="skirt"><div class="bezel"><div class="face"><svg class="fch" viewBox="0 0 214 214" preserveAspectRatio="none"><g class="fcb"></g><path class="fcl"/><path class="fcd"/></svg><div class="tlcd"><div><div class="u heat">SOLL</div><b class="heat tv">--</b><div class="i ti">IST --</div></div></div></div></div></div>';
  const inn = ring ? inner.replace('<div class="skirt">', `<div class="skirt"><i class="skw l"><i class="skb" style="clip-path:path('${skbPath(-1)}')"></i></i><i class="skw r"><i class="skb" style="clip-path:path('${skbPath(1)}')"></i></i><i class="skro"></i><i class="skr"></i>`) : inner;
  return `<div class="dwrap" id="${id}" data-u="${U}" style="width:${size}px;height:${size}px"><div class="dial${ring ? ' big' : ''}" style="transform:scale(${size / U}) translate(-${off}px,-${off}px)">${inn}${dots}</div></div>`;
};
const mediaTitle = p => {
  if (!p) return null;
  const a = p.attributes, pad = n => String(n).padStart(2, '0');
  if (a.media_series_title) return [a.media_series_title, a.media_season != null ? `S${pad(a.media_season)}E${pad(a.media_episode || 0)}` : '', a.media_title].filter(Boolean).join(' · ');
  if (a.media_artist) return `${a.media_artist} – ${a.media_title || ''}`;
  return a.media_title || a.app_name || a.friendly_name || p.entity_id;
};
// Zustand eines Fenster-/Türkontakts: open / tilt / closed / na
const contactState = (states, ct) => {
  const ok = s => !!s && !NA.includes(s.state);
  const o = states[ct.entity], t = ct.tilt ? states[ct.tilt] : undefined;
  const on = s => ok(s) && ['on', 'open', 'offen', 'true'].includes(String(s.state).toLowerCase());
  const tilted = s => ok(s) && ['tilted', 'gekippt', 'tilt'].includes(String(s.state).toLowerCase());
  if (!ok(o) && !ok(t)) return 'na';
  if (on(o)) return 'open';
  if (tilted(o) || on(t)) return 'tilt';
  return 'closed';
};

// Verlaufssäulen: überall gleich breit auf dem Bildschirm (Abstand = 1/248 der Panel-Breite, wie die Ventil-Kachel bei 24 Säulen).
// Die Säulenzahl ergibt sich aus der tatsächlichen Breite; die Messwerte werden passend zusammengefasst.
// Breite einstellbar: Einstellungen → Allgemein → Haus „Balkenbreite der Verläufe“ (input_number, % – 100 = Standard)
const SPARK_PITCH = 1280 / 248, SPARK_W = 'input_number.haus_sys_panel_cfg_spark_width';
const sparkF = mod => { const h = mod && mod._hass, s = h && h.states[SPARK_W], v = s ? Number(s.state) : NaN; return isFinite(v) && v > 0 ? clamp(v / 100, .3, 4) : 1; };
const sparkN = (screenW, mod) => {
  const p = mod && mod._panel && mod._panel(), pw = p ? p.getBoundingClientRect().width : 0;
  if (!screenW || !pw) return Math.round(24 / sparkF(mod));
  return clamp(Math.round(screenW / (SPARK_PITCH * sparkF(mod) * pw / 1280)), 3, 96);
};
const sparkDown = (h, n) => {
  if (!h || h.length <= n) return h;
  return Array.from({ length: n }, (_, k) => { const a = Math.floor(k * h.length / n), b = Math.floor((k + 1) * h.length / n), v = h.slice(a, b).filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; });
};

// Bildschirm-Fläche eines Knotens; Hüllen ohne eigene Größe (absolut gesetzte Kinder) = Vereinigung der Kinder
const rectOf = (el, d = 0) => {
  const r = el.getBoundingClientRect();
  if ((r.width && r.height) || d > 3) return r.width && r.height ? r : null;
  let a = null;
  for (const k of el.children) { const q = rectOf(k, d + 1); if (!q) continue; a = a ? { left: Math.min(a.left, q.left), top: Math.min(a.top, q.top), right: Math.max(a.right, q.right), bottom: Math.max(a.bottom, q.bottom) } : { left: q.left, top: q.top, right: q.right, bottom: q.bottom }; }
  return a && { left: a.left, top: a.top, right: a.right, bottom: a.bottom, width: a.right - a.left, height: a.bottom - a.top };
};

// ---------------------------------------------------------------------------------
// Grundklasse aller Module. Ein Modul baut seinen Inhalt in Design-Pixeln (Breite bw,
// Mindesthöhe mh) und wird auf die Größe seines Platzes skaliert. fw/fh: Inhalt darf in
// Breite/Höhe mitwachsen, sonst wird er im Platz zentriert.
// ---------------------------------------------------------------------------------
class RPModule extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); loadFonts(); this._prev = {}; this._drag = null; }
  get meta() { return { bw: 368, mh: 300, fw: false, fh: true }; }
  // Varianten (Anordnungen) des Moduls: { name: { bw, mh, fw, fh, maxh, minh, weight, hide } }
  //   bw/mh  = Design-Breite / geschätzte Mindesthöhe (zur Auswahl; skaliert wird nach gemessener Höhe)
  //   fw/fh  = darf in Breite / Höhe mitwachsen · weight = Bevorzugung (kompakte Varianten < 1)
  //   hide   = Elemente, die diese Variante standardmäßig ausblendet
  variants() { return { default: this.meta }; }
  static getStubConfig() { return {}; }
  getCardSize() { return Math.ceil(this.meta.mh / 50); }

  // Alle Varianten inkl. "custom" (Phase 4: Elemente frei im Modul-Raster, layout: custom + elements)
  _vs() {
    const vs = this.variants();
    if (!this.constructor.NO_CUSTOM && (this._raw.layout === 'custom' || this._raw.elements)) {
      const first = Object.values(vs)[0], g = this._cg(), els = Object.values(this._raw.elements || {});
      const rows = Number(g.rows) || Math.max(1, ...els.map(e => (Number(e.row) || 1) + (Number(e.h) || 1) - 1));
      vs.custom = { bw: Number(g.width) || first.bw, mh: rows * g.row_height + (rows - 1) * g.gap, fw: false, fh: false, manual: true, rows };
    }
    return vs;
  }
  _cg() { return L({ columns: 12, row_height: 20, gap: 6 }, this._raw.grid); }
  // Schriftgröße-Faktor: Modul > Rahmen/Panel (data-schrift vom Panel) > 1
  _sg() { const v = Number(this._raw.schriftgroesse ?? this.dataset.schrift); return isFinite(v) && v > 0 ? clamp(v, .3, 4) : 1; }
  // Raster-Hülle der freien Anordnung; p = { elementname: html }
  _cgrid(p, id = '', extra = '') {
    const g = this._cg(), V = this._vs().custom;
    return `<div ${id ? `id="${id}"` : ''} class="cgrid" ${extra} style="display:grid;grid-template-columns:repeat(${g.columns},minmax(0,1fr));grid-template-rows:repeat(${V.rows},${g.row_height}px);gap:${g.gap}px">${Object.values(p).join('')}</div>`;
  }
  // Elemente in die Zellen einpassen: dial = skalieren, plan/forecast = ausfüllen, Rest = Originalgröße (nur verkleinern)
  _fitCells() {
    const els = this._raw.elements || {};
    this.shadowRoot.querySelectorAll('#box .cell').forEach(cell => {
      if (cell.style.display === 'none') return;
      const cin = cell.firstElementChild, e = els[cell.dataset.part] || {}, cw = cell.clientWidth, ch = cell.clientHeight;
      if (!cin || !cw || !ch) return;
      // absolut gesetzte Inhalte werden einmal zusammengeschoben und dann wie ein Drehrad eingepasst
      const kind = this._absNorm(cin) && cell.dataset.kind !== 'fill' ? 'fit' : cell.dataset.kind;
      setLcda(cell, e.transparenz);
      const z = Number(e.zoom) || 1, al = String(e.align || ''), ax = /left/.test(al) ? 0 : /right/.test(al) ? 1 : .5, ay = /top/.test(al) ? 0 : /bottom/.test(al) ? 1 : .5;
      const place = (w, h, sc) => { cin.style.transform = `translate(${((cw - w * sc) * ax).toFixed(1)}px,${((ch - h * sc) * ay).toFixed(1)}px) scale(${sc.toFixed(4)})`; };
      cin.style.transform = '';
      // Displays (.lcd) frei strecken: Kasten füllt die Zelle in Breite UND Höhe (keine festen Proportionen),
      // Schrift wächst gleichmäßig mit, soweit sie hineinpasst. Abschalten je Element: strecken: false
      const disp = e.strecken !== false && this._dispOf(cin);
      if (disp) {
        if (!disp._nat) {
          // natürliche Größe einmal messen: absolut gesetzte Displays (Audio) haben feste Maße, sonst Inhaltsbreite
          const abs = /px$/.test(disp.style.width), ow = disp.style.width, oh = disp.style.height;
          if (!abs) Object.assign(disp.style, { width: 'max-content', height: 'auto' });
          const w = disp.offsetWidth, h = disp.offsetHeight;
          if (!abs) Object.assign(disp.style, { width: ow, height: oh });
          if (!w || !h) return;
          disp._nat = { w, h };
          if (getComputedStyle(disp).display === 'block') disp.classList.add('dstr');   // Inhalt bei mehr Höhe senkrecht mittig
        }
        for (let n = cin; n && n !== disp; n = n.firstElementChild) Object.assign(n.style, { width: cw + 'px', height: ch + 'px', transform: n === cin ? '' : n.style.transform });
        const sc = Math.min(cw / disp._nat.w, ch / disp._nat.h) * z;
        Object.assign(disp.style, { left: '0', top: '0', right: 'auto', bottom: 'auto', margin: '0', width: (cw / sc) + 'px', height: (ch / sc) + 'px', transformOrigin: '0 0', transform: `scale(${sc.toFixed(4)})` });
        cell._vis = { x: 0, y: 0, w: cw, h: ch };
        return;
      }
      // schriftgroesse je Element (Standard: Wert des Moduls): Texte wachsen in ihrer Zelle, ohne überzustehen
      const sgv = Number(e.schriftgroesse), SG = isFinite(sgv) && sgv > 0 ? clamp(sgv, .3, 4) : this._sg();
      if (kind === 'fill') {
        if (SG === 1) { cin.style.width = cw + 'px'; cin.style.height = ch + 'px'; return; }
        cin.style.width = (cw / SG) + 'px'; cin.style.height = (ch / SG) + 'px'; place(cw / SG, ch / SG, SG);
        return;
      }
      if (kind === 'fit') {
        cin.style.width = 'max-content'; cin.style.height = 'auto';
        // nur den sichtbaren Teil einpassen (z. B. Drehregler ohne die leere Breite seiner Zeile)
        const T = tightBox(cin) || { x: 0, y: 0, w: cin.offsetWidth, h: cin.offsetHeight };
        const sc = Math.min(cw / T.w, ch / T.h) * z, tx = (cw - T.w * sc) * ax - T.x * sc, ty = (ch - T.h * sc) * ay - T.y * sc;
        cin.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${sc.toFixed(4)})`;
        cell._vis = { x: tx + T.x * sc, y: ty + T.y * sc, w: T.w * sc, h: T.h * sc };
        return;
      }
      cin.style.width = cw + 'px'; cin.style.height = 'auto';
      const nh = cin.offsetHeight; let sb = Math.min(1, ch / nh);
      if (SG !== 1 && nh) {
        // größten Faktor bis SG suchen, bei dem der neu umbrochene Inhalt noch in die Zelle passt
        // abgeschnittene Texte („…“, overflow hidden) zählen: mehr als vorher = passt nicht
        const cut = () => { let n = 0; for (const x of cin.querySelectorAll('*')) if (x.clientWidth && x.scrollWidth > x.clientWidth + 1) n++; return n; };
        const cut0 = cut();
        const fits = k => { cin.style.width = (cw / k) + 'px'; return cin.offsetHeight * k <= ch + .5 && cin.scrollWidth <= cw / k + 1 && cut() <= cut0; };
        if (SG <= sb || fits(SG)) sb = SG;
        else if (SG > sb) { let lo = sb, hi = SG; for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } sb = lo; }
        cin.style.width = cw + 'px';
      }
      const sc = sb * z;
      if (sc !== 1) cin.style.width = (cw / sc) + 'px';
      place(cw / sc, cin.offsetHeight, sc);
    });
  }
  // Besteht der Zelleninhalt nur aus einem Display (.lcd, ggf. in Hüllen mit je einem Kind)? → dieses Display
  _dispOf(cin) {
    const real = el => [...el.children].filter(k => !/^(STYLE|SCRIPT|TEMPLATE)$/.test(k.tagName) && k.style.display !== 'none');
    let n = cin;
    for (let i = 0; i < 6 && n; i++) {
      if (n !== cin && n.classList.contains('lcd')) return n;
      const k = real(n); if (k.length !== 1) return null;
      n = k[0];
    }
    return null;
  }
  // Aktuelle Anordnung als freie Anordnung übernehmen (Startpunkt für den Editor)
  _toElements(cols = 12, rowH = 20, gap = 6) {
    const box = this.$('box'), P = parseFloat(box.style.padding) || 0;
    const W = box.offsetWidth - 2 * P, els = {};
    this.shadowRoot.querySelectorAll('#box .part').forEach(p => {
      if (p.style.display === 'none') return;
      const e = this._gridPos(p, cols, rowH, gap); if (e) els[p.dataset.part] = e;
    });
    // Rundungs-Überlappungen auflösen: von oben nach unten, überlappende Elemente eine Reihe tiefer
    const placed = [], hit = (a, b) => a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;
    for (const e of Object.values(els).sort((a, b) => a.row - b.row || a.col - b.col)) { for (let i = 0; i < 200 && placed.some(o => hit(e, o)); i++) e.row++; placed.push(e); }
    return { grid: { columns: cols, row_height: rowH, gap, width: Math.round(W) }, elements: els };
  }
  // Lage eines Knotens im Modul-Raster (Spalte/Reihe/Breite/Höhe); leere Hüllen = Fläche ihrer Inhalte
  _gridPos(node, cols, rowH, gap) {
    const box = this.$('box'), br = box.getBoundingClientRect(), k = br.width / box.offsetWidth || 1, P = parseFloat(box.style.padding) || 0;
    const W = box.offsetWidth - 2 * P, stepX = (W - (cols - 1) * gap) / cols + gap, stepY = rowH + gap;
    const r = rectOf(node); if (!r) return null;
    const x = (r.left - br.left) / k - P, y = (r.top - br.top) / k - P, w = r.width / k, h = r.height / k;
    const col = clamp(Math.round(x / stepX) + 1, 1, cols), row = Math.max(1, Math.round(y / stepY) + 1);
    return { col, row, w: clamp(Math.round((w + gap) / stepX), 1, cols - col + 1), h: Math.max(1, Math.round((h + gap) / stepY)) };
  }
  // Gruppen ohne eigene Teil-Namen: ihre Bausteine automatisch als <gruppe>.1, .2 … markieren (zerlegbar im Editor).
  // Wrapper mit nur einem Kind werden übersprungen; Drehrad/Plan/Vorhersage bleiben ganz.
  _autoSubs() {
    const grid = this.$('box') && this.$('box').querySelector('.cgrid'); if (!grid) return;
    for (const cell of grid.querySelectorAll(':scope>.part.cell')) {
      const n = cell.dataset.part; if (!n || cell.dataset.kind !== 'shrink' || cell.querySelector('[data-sub]')) continue;
      let root = cell.querySelector(':scope>.cin'); if (!root) continue;
      const real = el => [...el.children].filter(k => !/^(STYLE|SCRIPT|TEMPLATE)$/.test(k.tagName));
      while (real(root).length === 1 && real(real(root)[0]).length) root = real(root)[0];
      const kids = real(root); if (kids.length < 2) continue;
      kids.forEach((k, i) => { k.dataset.sub = n + '.' + (i + 1); k.dataset.autosub = '1'; });
    }
  }
  // Teil-Elemente (z. B. "power.alloff"): einzelne Bedienelemente aus ihrer Gruppe lösen und in eigene Zellen setzen.
  // Die Hülle trägt die Klassen der alten Gruppe, damit das Aussehen gleich bleibt.
  _splitSubs() {
    const box = this.$('box'), grid = box && box.querySelector('.cgrid'); if (!grid) return;
    const els = this._raw.elements || {}, hide = this._raw.hide || [];
    for (const [n, e] of Object.entries(els)) {
      if (!n.includes('.')) continue;
      const node = box.querySelector(`[data-sub="${n}"]`); if (!node) continue;
      const cell = document.createElement('div');
      cell.className = 'part cell'; cell.dataset.part = n; cell.dataset.kind = node.dataset.kind || 'shrink';
      cell.style.cssText = `${hide.includes(n) ? 'display:none;' : ''}grid-column:${Number(e.col) || 1} / span ${Number(e.w) || 1};grid-row:${Number(e.row) || 1} / span ${Number(e.h) || 1}`;
      const cin = document.createElement('div'); cin.className = 'cin';
      const wrap = document.createElement('div'); wrap.className = (node.parentElement.className || '') + ' subw';
      wrap.appendChild(node); cin.appendChild(wrap); cell.appendChild(cin); grid.appendChild(cell);
    }
  }
  // Inhalt aus absolut gesetzten Teilen (Audio, Plus/Minus am Drehrad): auf ihre Fläche zusammenschieben,
  // damit die Zelle sie wie ein normales Element einpassen kann
  _absNorm(cin) {
    if (cin._norm) return cin._norm === 'abs';
    let T = cin.firstElementChild && cin.firstElementChild.classList.contains('subw') && cin.children.length === 1 ? cin.firstElementChild : null;
    const kids = [], walk = (el, d) => { for (const k of el.children) { const cs = getComputedStyle(k); if (cs.position === 'absolute' || cs.position === 'fixed') kids.push([k, true]); else if (d < 3 && (!k.offsetWidth || !k.offsetHeight) && k.children.length) walk(k, d + 1); else kids.push([k, false]); } };
    walk(T || cin, 0);
    if (!kids.some(([, a]) => a)) { cin._norm = 'plain'; return false; }
    if (!T) { T = document.createElement('div'); T.className = 'subw'; while (cin.firstChild) T.appendChild(cin.firstChild); cin.appendChild(T); }
    const pos = kids.map(([k]) => { let x = 0, y = 0, o = k; while (o && o !== T) { x += o.offsetLeft; y += o.offsetTop; o = o.offsetParent; } return [k, x, y, k.offsetWidth, k.offsetHeight]; }).filter(p => p[3] && p[4]);
    if (!pos.length) return false;
    const x0 = Math.min(...pos.map(p => p[1])), y0 = Math.min(...pos.map(p => p[2])), x1 = Math.max(...pos.map(p => p[1] + p[3])), y1 = Math.max(...pos.map(p => p[2] + p[4]));
    for (const [k, x, y, w, h] of pos) Object.assign(k.style, { position: 'absolute', left: (x - x0) + 'px', top: (y - y0) + 'px', right: 'auto', bottom: 'auto', margin: '0', width: w + 'px', height: h + 'px' });
    T.style.width = (x1 - x0) + 'px'; T.style.height = (y1 - y0) + 'px';
    cin._norm = 'abs'; return true;
  }

  // Element ausgeblendet? (show: nur diese Elemente · hide: diese nicht · Variante blendet evtl. selbst aus)
  _hid(n) {
    const r = this._raw || {}, show = r.show, hide = r.hide || [];
    if (Array.isArray(show) && show.length) return !show.includes(n);
    if (this._v === 'custom') return hide.includes(n) || !(this._raw.elements || {})[n];
    const V = this.variants()[this._v] || {};
    return hide.includes(n) || (V.hide || []).includes(n);
  }
  // Element-Hülle: bleibt im DOM (Updates laufen weiter), ausgeblendet = display:none
  P(n, html, style = '') {
    if (this._v === 'custom') {
      const e = (this._raw.elements || {})[n] || {};
      return `<div class="part cell" data-part="${n}" data-kind="${(this._kinds || this.constructor.KINDS || {})[n] || { dial: 'fit', plan: 'fill', forecast: 'fill' }[n] || 'shrink'}" style="${this._hid(n) ? 'display:none;' : ''}grid-column:${Number(e.col) || 1} / span ${Number(e.w) || 1};grid-row:${Number(e.row) || 1} / span ${Number(e.h) || 1}"><div class="cin">${html}</div></div>`;
    }
    return `<div class="part" data-part="${n}" style="${this._hid(n) ? 'display:none;' : ''}${style}">${html}</div>`; }
  // Automatische Wahl: volle Varianten (weight 1) haben Vorrang – die größte gewinnt.
  // Reduzierte Varianten (weight < 1, z. B. kompakt) erst, wenn eine volle unter 72 % schrumpfen müsste.
  pickVariant(w, h, vs, P) {
    const sc = ([n, V]) => Math.min(w / (V.bw + 2 * P), h / (this._nat(n, V, P) + 2 * P));
    const all = Object.entries(vs).filter(([, V]) => !V.manual);
    const best = list => list.reduce((a, b) => (sc(b) > sc(a) ? b : a));
    const full = all.filter(([, V]) => (V.weight ?? 1) >= 1);
    if (full.length) { const f = best(full); if (sc(f) >= .72 || full.length === all.length) return f[0]; }
    return best(all)[0];
  }
  // Natürliche Höhe einer Variante (einmal unsichtbar aufgebaut und gemessen, ausgeblendete Elemente zählen nicht)
  _nat(n, V, P) {
    if (V.estimate) return V.mh || 100;
    const C = this._natCache || (this._natCache = {});
    if (C[n] == null) {
      const old = this._v, d = document.createElement('div');
      this._v = n;
      d.className = 'box v-' + n; d.style.cssText = `visibility:hidden;width:${V.bw + 2 * P}px;padding:${P}px;transform:none`;
      d.innerHTML = this.html(n); this.shadowRoot.appendChild(d);
      C[n] = Math.max(d.offsetHeight - 2 * P, V.minh || 0) || V.mh || 100;
      d.remove(); this._v = old;
    }
    return C[n];
  }


  setConfig(cfg) {
    this._raw = cfg || {};
    this._c = this.norm(this._raw);
    this._prev = {}; this._rendered = false; this._natCache = {};
    if (this._built || this.isConnected) this._build();
  }
  norm(c) { return c; }

  connectedCallback() {
    if (!this._built) this._build();
    // ohne Panel (z. B. als normale Lovelace-Karte): Mindesthöhe vorgeben
    if (!this.dataset.inpanel && !this.style.height) this.style.height = (Object.values(this.variants())[0].mh + 16) + 'px';
    this._ro = new ResizeObserver(() => this._fit()); this._ro.observe(this);
    requestAnimationFrame(() => this._fit());
    if (this.tick) { this.tick(); clearInterval(this._tk); this._tk = setInterval(() => this.tick(), 10000); }
    if (this.onConnect) this.onConnect();
  }
  disconnectedCallback() {
    this._ro && this._ro.disconnect(); clearInterval(this._tk);
    if (this._ovl) { this._ovl.remove(); this._ovl = null; }
    if (this.onDisconnect) this.onDisconnect();
  }

  _build() {
    if (!this._c) return;
    const r = this.shadowRoot;
    r.innerHTML = `<style>${CSS}${MOD_CSS}${this.constructor.CSS || ''}</style><div class="box" id="box"></div><div class="ovlhost" id="ovlhost"></div>`;
    this.$ = id => r.getElementById(id) || (this._ovl ? this._ovl.querySelector('#' + id) : null);
    if (!this._clk) { this._clk = true; r.addEventListener('click', e => this._click(e)); r.addEventListener('pointerdown', e => this._repDown(e)); }
    this._built = true;
    const vs = this._vs();
    this._render(vs.custom ? 'custom' : this._raw.layout && vs[this._raw.layout] ? this._raw.layout : Object.keys(vs)[0]);
    this._fit();
  }

  // Inhalt in einer Variante aufbauen (bei Wechsel der Variante neu)
  _render(vn) {
    const box = this.$('box'); if (!box) return;
    this._v = vn; this._measured = false;
    box.className = 'box v-' + vn;
    box.innerHTML = this.html(vn);
    if (vn === 'custom') { this._autoSubs(); this._splitSubs(); }
    if (this.bind) this.bind();
    if (this._hass) { this._rendered = false; this._prev = {}; this.hass = this._hass; }
  }

  _fit() {
    const box = this.$ && this.$('box'); if (!box) return;
    const w = this.clientWidth, h = this.clientHeight; if (!w || !h) return;
    // padding: Innenabstand in Design-px – Platz für Regler-Knöpfe, Schatten und Leuchten am Rand
    const P = Math.max(0, Number(this._raw.padding ?? this.defaultPad ?? 8));
    // layout: feste Variante, sonst automatisch nach Form des Platzes
    const vs = this._vs(), vn = vs.custom ? 'custom' : this._raw.layout && vs[this._raw.layout] ? this._raw.layout : this.pickVariant(w, h, vs, P);
    if (vn !== this._v) this._render(vn);
    const m = vs[this._v], BW = m.bw + 2 * P;
    // tatsächliche Inhaltshöhe messen (ausgeblendete Elemente zählen nicht)
    box.style.padding = P + 'px'; box.style.width = BW + 'px'; box.style.height = 'auto';
    const MH = Math.max(box.offsetHeight, (m.minh || 0) + 2 * P, 40);
    // zoom: < 1 verkleinert, > 1 vergrößert (ragt dann über den Platz hinaus)
    let s = Math.min(w / BW, h / MH) * (Number(this._raw.zoom) || 1), BWx = BW, MHx = MH;
    // schriftgroesse (nicht frei angeordnet): Inhalt wächst bis zum Faktor, Design-Fläche wird dafür kleiner (Text bricht neu um) –
    // nur so weit, wie alles noch in den Platz passt; nie über den Rand hinaus
    const SG = this._sg();
    if (SG !== 1 && this._v !== 'custom') {
      const cut = () => { let n = 0; for (const x of box.querySelectorAll('*')) if (x.clientWidth && x.scrollWidth > x.clientWidth + 1) n++; return n; };
      const cut0 = cut();
      const tryS = k => { box.style.width = (w / k) + 'px'; box.style.height = 'auto'; const hh = box.offsetHeight; return hh * k <= h + .5 && box.scrollWidth <= w / k + 1 && cut() <= cut0 ? hh : 0; };
      let best = 0, bs = s;
      const hi0 = s * SG, r0 = tryS(hi0);
      if (r0) { best = r0; bs = hi0; }
      else if (SG > 1) { let lo = s, hi = hi0; for (let i = 0; i < 7; i++) { const mid = (lo + hi) / 2, r = tryS(mid); if (r) { lo = mid; best = r; bs = mid; } else hi = mid; } }
      if (best && Math.abs(bs / s - 1) > .02) { s = bs; BWx = w / s; MHx = Math.max(best, (m.minh || 0) + 2 * P, 40); }
    }
    // feste Fläche (im Panel height: gesetzt, data-fixh): Modul füllt Breite UND Höhe seiner Fläche –
    // nicht an seine Proportionen gebunden; die Richtung mit mehr Platz wird zu mehr Inhaltsfläche statt zu Leerraum
    const fix = this.dataset.fixh === '1';
    const bw = m.fw || fix ? Math.max(BWx, w / s) : BWx, bh = m.fh ? clamp(h / s, MHx, (m.maxh || Infinity) + 2 * P) : fix ? Math.max(MHx, h / s) : MHx;
    box.style.padding = P + 'px'; box.style.width = bw + 'px'; box.style.height = bh + 'px';
    // align: Lage im Platz, z. B. "top", "left", "bottom right" (Standard: Mitte)
    const al = String(this._raw.align || ''), ax = /left/.test(al) ? 0 : /right/.test(al) ? 1 : .5, ay = /top/.test(al) ? 0 : /bottom/.test(al) ? 1 : .5;
    box.style.transform = `translate(${((w - bw * s) * ax).toFixed(2)}px,${((h - bh * s) * ay).toFixed(2)}px) scale(${s.toFixed(4)})`;
    this._scale = s;
    if (this._v === 'custom') this._fitCells();
  }

  set hass(h) {
    this._hass = h;
    if (!this._built) return;
    if (!this._hassInit) { this._hassInit = true; if (this.onHass) this.onHass(); }
    const ch = this._changed(h);
    if (!ch.length) return;
    if (this.onChange) this.onChange(ch); else this.update();
    // nach dem ersten Füllen mit Daten einmal neu vermessen
    if (!this._measured) { this._measured = true; requestAnimationFrame(() => this._fit()); }
  }
  get hass() { return this._hass; }
  watch() { return []; }
  _changed(h) {
    const out = this._rendered ? [] : ['*'];
    for (const id of this.watch(h).filter(Boolean)) { const v = id.startsWith('dev:') ? id : h.states[id]; if (this._prev[id] !== v) { this._prev[id] = v; out.push(id); } }
    this._rendered = true;
    return out;
  }
  update() {}

  // Ebene für Fenster über dem ganzen Panel (z. B. Preset-Editor); ohne Panel über dem Modul
  _panel() {
    let n = this;
    for (let i = 0; i < 20 && n; i++) { const root = n.getRootNode(); n = root && root.host; if (n && n.tagName === 'RAUM-PANEL') return n; }
    return null;
  }
  _overlay() {
    if (this._ovl) return this._ovl;
    const panel = this._panel();
    const host = (panel && panel._ovlHost()) || this.shadowRoot.getElementById('ovlhost');
    const d = document.createElement('div'); d.className = 'rp-ovl';
    host.appendChild(d);
    d.addEventListener('click', e => this._click(e));
    this._ovl = d; return d;
  }

  // Gedrückt halten = weiterzählen: −/+-Tasten (temp:+, ivol:-1, num:k:0.5, dur:i|1, lsv:i|-1, bg:nh:5 …) wiederholen
  // nach 450 ms, dann immer schneller; der Klick nach dem Loslassen zählt nicht noch einmal
  _repDown(e) {
    this._repEat = false;
    const t = e.target.closest && e.target.closest('[data-act]'); if (!t || !this._hass || !e.isPrimary) return;
    const a = t.dataset.act, cmd = a.split(':')[0];
    if (!REP_CMDS.includes(cmd) || !/[:|]([+-]|[+-]?d+(.d+)?)$/.test(a) || /^(bg:(art|farbe|bild|del|schrift|bat|nacht))/.test(a)) return;
    clearTimeout(this._repT); this._repN = 0; this._repEat = false;
    const [c, arg] = a.split(/:(.*)/s), step = () => { if (!t.isConnected) return stop(); this._repN++; this._repEat = true; if (this.act) this.act(c, arg, t); this._repT = setTimeout(step, this._repN < 6 ? 160 : this._repN < 20 ? 90 : 50); };
    const stop = () => { clearTimeout(this._repT); window.removeEventListener('pointerup', stop, true); window.removeEventListener('pointercancel', stop, true); };
    window.addEventListener('pointerup', stop, true); window.addEventListener('pointercancel', stop, true);
    this._repT = setTimeout(step, 450);
  }
  _click(e) {
    if (this._repEat) { this._repEat = false; return; }
    const t = e.target.closest('[data-act]');
    if (this.beforeClick) this.beforeClick(t);
    if (!t || !this._hass) return;
    const [cmd, arg] = t.dataset.act.split(/:(.*)/s);
    if (cmd === 'more') { this._more(arg); return; }
    if (this.act) this.act(cmd, arg, t);
  }

  _html(el, html) { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }
  _call(d, s, data) {
    if (this.onCall) this.onCall(d, s, data);
    return this._hass.callService(d, s, data).catch(e => console.warn('raum-panel', e));
  }
  _more(entityId) { const ev = new Event('hass-more-info', { bubbles: true, composed: true }); ev.detail = { entityId }; this.dispatchEvent(ev); }
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  // immer boolean: classList.toggle(x, undefined) würde sonst bei jedem Update umschalten
  _ok(s) { return !!s && !NA.includes(s.state); }
  _dragActive(kind) { const d = this._drag; return d && d.kind === kind && (d.active || Date.now() < d.until); }

  // Drehregler (Licht: Ring = Helligkeit, Innenrad = Farbe, Mitte = an/aus · Heizung: Ring = Solltemperatur)
  _bindDial(el, kind) {
    if (!el) return;
    let zone = null, rect = null;
    const geo = ev => { const k = rect.width / (Number(el.dataset.u) || 270); const dx = (ev.clientX - (rect.left + rect.width / 2)) / k, dy = (ev.clientY - (rect.top + rect.height / 2)) / k; return { dist: Math.hypot(dx, dy), ang: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360 }; };
    const ringFrac = ang => { let a = (ang - 135 + 360) % 360; if (a > 270) a = a > 315 ? 0 : 270; return a / 270; };
    const apply = (ev, final) => {
      const g = geo(ev);
      if (kind === 'light') {
        if (zone === 'wheel' && this._wheelMode === 'k') { const [kmin, kmax] = this._krange(); this._drag = { kind: 'k', v: Math.round((kmin + ringFrac(g.ang) * (kmax - kmin)) / 50) * 50, active: !final, until: Date.now() + 2000 }; }
        else if (zone === 'wheel') this._drag = { kind: 'hs', h: g.ang, s: clamp((g.dist - 54) / 53, 0, 1) * 100, active: !final, until: Date.now() + 2000 };
        else this._drag = { kind: 'bri', v: Math.max(1, Math.round(ringFrac(g.ang) * 100)), active: !final, until: Date.now() + 2000 };
        this._updLight();
      } else {
        const s = this._st(this._c.climate.entity); if (!this._ok(s)) return;
        const [mn, mx] = this._trange(s), step = s.attributes.target_temp_step || 0.5;
        this._drag = { kind: 'temp', v: Math.round((mn + ringFrac(g.ang) * (mx - mn)) / step) * step, active: !final, until: Date.now() + (final ? 8000 : 2500) };
        this._updHeat();
      }
      // Thermostate (Funk, z. B. Homematic IP) vertragen keine schnelle Befehlsfolge –
      // Solltemperatur nur einmal beim Loslassen senden; Licht weiter alle 0,45 s
      if (kind !== 'light' ? final : (final || Date.now() - (this._sent || 0) > 450)) { this._sent = Date.now(); this._commit(); }
    };
    el.addEventListener('pointerdown', ev => {
      if (!this._hass) return;
      if (!this._ok(this._st(kind === 'light' ? this._c.lights[this._tab].entity : this._c.climate.entity))) return;
      rect = el.getBoundingClientRect();
      const g = geo(ev);
      if (kind === 'light' && g.dist < 54) { const le = this._c.lights[this._tab].entity, on = (this._st(le) || {}).state === 'on'; this._call('light', 'toggle', withFade(this._hass, raumOf(this, this._c), this._tab, on ? 'off' : 'on', { entity_id: le })); return; }
      zone = kind === 'light' && g.dist <= 112 ? 'wheel' : 'ring';
      if (kind === 'light') this._wheelMode = this._lightInfo(this._tab).isColor ? 'hs' : 'k';   // Weiß-Modus: Innenrad = Farbtemperatur
      el.setPointerCapture(ev.pointerId); ev.preventDefault();
      apply(ev, false);
      const mv = e2 => apply(e2, false);
      const up = e2 => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); apply(e2, true); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
}

// ---------------------------------------------------------------- Licht
// Automatik-Funktionen der Lichtsteuerung: [Funktionsname in den Helfern, Anzeige]
const AUTO_FN = [['motion', 'Bewegung'], ['schedule', 'Zeit'], ['lux', 'Helligkeit'], ['simulation', 'Simulation']];
const autoEnabled = (r, f, t) => `input_boolean.${r}_light_${f}_${t}_cfg_enabled`;
function autoIds(r, t) {
  const b = `${r}_light_motion_${t}`, rb = `${r}_light_motion`;
  return { source: `input_select.${b}_source`, timer: `timer.${b}`, lock: `timer.${b}_lock`, warning: `input_boolean.${b}_warning`,
    warn_enabled: `input_boolean.${b}_cfg_warn_enabled`, warn_duration: `input_number.${b}_warn_duration`,
    occupied: `binary_sensor.${rb}_occupied`,
    ...Object.fromEntries(AUTO_FN.map(([f]) => ['ena_' + f, autoEnabled(r, f, t)])) };
}
// Laufender Timer -> { left, total } in Sekunden (aus finishes_at), sonst null
const hms2s = v => { const p = String(v || '').split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : 0; };
function auRun(s) {
  if (!s || s.state !== 'active' || !s.attributes.finishes_at) return null;
  const left = Math.max(0, Math.round((new Date(s.attributes.finishes_at) - Date.now()) / 1000));
  return { left, total: Math.max(hms2s(s.attributes.duration), left, 1) };
}
const mmss = n => { n = Math.max(0, Math.round(n)); const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), x = n % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };

class RPLight extends RPModule {
  constructor() { super(); this._tab = 'primary'; this._last = { primary: {}, secondary: {} }; }
  get meta() { return this.variants().tall; }
  // hoch = wie bisher · breit = großes Drehrad links · kompakt = Schalter, Reiter, Helligkeit
  variants() {
    return {
      tall: { bw: 440, mh: 440, maxh: 600, fw: false, fh: true, hide: ['ctemp', 'brightness'] },
      wide: { bw: 700, mh: 370, maxh: 480, fw: false, fh: true, hide: ['ctemp', 'brightness'] },
      compact: { bw: 368, mh: 165, fw: false, fh: false, weight: .7, hide: ['subtitle', 'dial', 'display', 'modes', 'ctemp', 'favorites'] },
    };
  }
  static getStubConfig() { return { lights: { primary: { entity: '' }, secondary: { entity: '' } } }; }
  norm(c) {
    const lights0 = c.lights || { primary: c.primary, secondary: c.secondary }, sel = this._lampSel || {};
    // Lampen aus den Einstellungen (Helfer) vor YAML; Name/Farbe bleiben aus dem YAML
    const lights = { primary: sel.primary ? { ...(lights0.primary || {}), entity: sel.primary } : lights0.primary,
      secondary: sel.secondary ? { ...(lights0.secondary || {}), entity: sel.secondary === '-' ? '' : sel.secondary } : lights0.secondary };
    if (!lights.primary) throw new Error('rp-light: lights.primary fehlt');
    const out = {
      lights: {
        primary: L({ name: 'Primär', subtitle: 'Hauptlicht', color: '#ffb347' }, lights.primary),
        secondary: L({ name: 'Sekundär', subtitle: 'Akzentlicht', color: '#a36bff' }, lights.secondary || {}),
      },
      favorites: c.favorites || [{ kelvin: 2700 }, { kelvin: 4000 }, { kelvin: 6000 }, { hs: [0, 90] }, { hs: [140, 80] }, { hs: [195, 90] }, { hs: [268, 70] }, { hs: [320, 85] }],
    };
    this._last = { primary: {}, secondary: {} };
    try { const t = localStorage.getItem('raum-tablet-card:tab:' + out.lights.primary.entity); if (t === 'primary' || t === 'secondary') this._tab = t; } catch (e) { /* ohne Speicher */ }
    return out;
  }
  // Elemente: power, tabs, automatik, subtitle, dial, display, modes, ctemp, brightness, favorites
  html(vn) {
    const c = this._c, one = !c.lights.secondary.entity;
    const favs = c.favorites.map((f, i) => `<div class="key" data-act="fav:${i}" style="--c:${f.kelvin ? kCss(f.kelvin) : hsCss(f.hs[0], f.hs[1])}"></div>`).join('');
    const pw = t => `<div class="rk" id="pw-${t}" data-sub="power.${t}" data-act="toggle:${t}">${BULB}<div><div class="nm" id="pw-${t}-nm"></div><div class="st" id="pw-${t}-st">--</div></div><div class="since" id="pw-${t}-si"></div></div>`;
    const ds = vn === 'wide' ? 300 : 240;
    const p = {
      power: this.P('power', `<div class="strip"${one ? ' style="grid-template-columns:repeat(2,minmax(0,1fr))"' : ''}>${pw('primary')}<div class="rk off" data-sub="power.alloff" data-act="alloff">${PWR}<div class="nm">Alles aus</div></div>${one ? '' : pw('secondary')}</div>`),
      tabs: this.P('tabs', `<div class="tabs">
    <div class="tab" id="tab-primary" data-sub="tabs.primary" data-act="tab:primary" style="--tc:${c.lights.primary.color}"><span class="led" id="tab-primary-led"></span>${c.lights.primary.name}<small id="tab-primary-v" style="color:${c.lights.primary.color}"></small></div>
    <div class="tab" id="tab-secondary" data-sub="tabs.secondary" data-act="tab:secondary" style="--tc:${c.lights.secondary.color}"><span class="led" id="tab-secondary-led"></span>${c.lights.secondary.name}<small id="tab-secondary-v" style="color:${c.lights.secondary.color}"></small></div></div>`, one ? 'display:none' : ''),
      automatik: this.P('automatik', `<div class="tabs fkeys">${AUTO_FN.map(([f, n]) => `<div class="fk" id="fk-${f}" data-sub="automatik.${f}" data-act="autoset:${f}"><i></i><span id="fk-${f}-t">${n}</span></div>`).join('')}</div>`),
      subtitle: this.P('subtitle', '<div class="cap" id="l-sub" style="font-size:11px;color:#979ca5"></div>'),
      dial: this.P('dial', dialHtml('ldial', 'light', ds), 'flex:none'),
      display: this.P('display', `<div class="lcd acc"><div class="row"><span id="l-v" style="font-size:32px;line-height:1">---%</span><span id="l-r" style="font-size:14px"></span></div>
      <div class="row" style="font-size:11.5px;margin-top:5px;opacity:.85"><span id="l-m"></span><span id="l-n"></span></div>
      <div class="lau idle" id="l-au"><div class="row"><span class="lal" id="l-au-l">AUTO</span><span class="lav" id="l-au-v">--:--</span></div><div class="lab"><b id="l-au-b"></b></div></div></div>`, vn === 'wide' ? 'flex:1' : 'flex:none'),
      modes: this.P('modes', '<div class="keys2"><div class="hk" id="l-white" data-sub="modes.white" data-act="mode:white" style="--c:var(--acc)"><i></i>Weiß</div><div class="hk" id="l-color" data-sub="modes.color" data-act="mode:color" style="--c:var(--acc)"><i></i>Farbe</div></div>'),
      ctemp: this.P('ctemp', '<div id="f-temp-w"><div class="sect cap eng" style="white-space:nowrap">Farbtemp.<span class="acc mono" id="f-temp-v" style="letter-spacing:1px"></span></div><div class="slot" id="f-temp"><div class="groove tempg"></div><div class="ticks"></div><div class="fader"></div></div></div>'),
      brightness: this.P('brightness', '<div id="l-bri-w"><div class="sect cap eng">Helligkeit<span class="acc mono" id="f-bri-v" style="letter-spacing:1px"></span></div><div class="slot" id="f-bri"><div class="groove" id="f-bri-g"></div><div class="ticks"></div><div class="fader"></div></div></div>'),
      favorites: this.P('favorites', `<div id="l-fav-w"><div class="cap eng" style="margin:0 0 6px">Lichtfarbe · Favoriten</div><div class="keys8" id="favs">${favs}</div></div>`),
    };
    if (vn === 'custom') return this._cgrid(p, 'lc');
    if (vn === 'wide') return `<div id="lc" class="fill vcol" style="gap:14px;justify-content:space-between">
     <div class="hrow" style="gap:20px;align-items:center">${p.dial}<div class="vcol" style="flex:1;min-width:0;gap:10px">
      <div class="vcol" style="gap:12px">${p.power}${p.tabs}${p.automatik}</div>${p.subtitle}
      <div class="hrow" style="gap:12px;align-items:stretch">${p.display}<div class="vcol" style="flex:1;min-width:0;gap:8px">${p.modes}${p.ctemp}</div></div></div></div>
     <div class="hrow" style="gap:18px;align-items:flex-end"><div style="flex:1;min-width:0">${p.brightness}</div><div style="flex:1;min-width:0">${p.favorites}</div></div></div>`;
    if (vn === 'compact') return `<div id="lc" class="vcol" style="gap:12px">${p.power}${p.tabs}${p.automatik}${p.brightness}${p.favorites}${p.subtitle}${p.display}${p.modes}${p.ctemp}${p.dial}</div>`;
    return `<div id="lc" class="fill vcol" style="justify-content:space-between;gap:10px">
     <div class="vcol" style="gap:12px">${p.power}${p.tabs}${p.automatik}</div>${p.subtitle}
     <div class="hrow" style="gap:16px;align-items:center">${p.dial}<div class="vcol" style="flex:1;min-width:0;gap:10px">${p.display}${p.modes}${p.ctemp}${p.brightness}</div></div>
     ${p.favorites}</div>`;
  }
  bind() {
    this._bindDial(this.$('ldial'), 'light');
    this._bindFader(this.$('f-temp'), 'temp');
    this._bindFader(this.$('f-bri'), 'bri');
  }
  // geänderte Auswahl im Helfer → Karte mit den neuen Lampen neu aufbauen
  set hass(h) {
    const r = this._raw && raumOf(this, this._raw), sel = r ? lampSel(h, r) : {}, key = JSON.stringify(sel);
    if (this._raw && key !== (this._lampKey || '{}')) { this._lampKey = key; this._lampSel = sel; this._hass = h; this.setConfig(this._raw); }
    super.hass = h;
  }
  get hass() { return this._hass; }
  watch(h) {
    const c = this._c, ids = [c.lights.primary.entity, c.lights.secondary.entity, lampId(raumOf(this, this._raw))];
    for (const t of ['primary', 'secondary']) { const s = h.states[c.lights[t].entity]; if (s && Array.isArray(s.attributes.entity_id)) ids.push(...s.attributes.entity_id); }
    ids.push(favId(raumOf(this, c)));
    const r = raumOf(this, this._raw);
    if (r) for (const t of ['primary', 'secondary']) ids.push(...Object.values(autoIds(r, t)), `group.${r}_light_motion_${t}`);
    if (r) ids.push(zsId(r), luxId(r), PS_ID);
    return ids;
  }
  update() { this._updPower(); this._updLight(); this._updFavs(); this._updAuto(); }
  onConnect() { clearInterval(this._auI); this._auI = setInterval(() => this._updAuto(), 1000); }
  onDisconnect() { clearInterval(this._auI); }

  // Automatik-Anzeige (Bewegung / Zeit / Helligkeit / Simulation) für das gewählte Licht.
  // LED grau = Funktion aus · grün = bereit · orange = hat das Licht eingeschaltet (source).
  // LCD-Zeile: Vorwarnung > Nachlauf > Sperre > Belegt, sonst gedimmt "AUTO --:--".
  _updAuto() {
    const r = raumOf(this, this._raw); if (!r || !this.$('l-au')) return;
    const t = this._tab, id = autoIds(r, t), st = k => this._st(id[k]), on = k => (st(k) || {}).state === 'on';
    const src = (st('source') || {}).state, compact = this._v === 'compact';
    const run = auRun(st('timer')), lock = auRun(st('lock')), warn = on('warning');
    // Restzeit bis "Licht aus": laufende Phase + (falls noch nicht in der Vorwarnung) die Vorwarnung
    const warnLen = !warn && on('warn_enabled') ? Number((st('warn_duration') || {}).state) || 0 : 0;
    let line = null;
    if (run && warn) line = { l: 'VORWARNUNG', v: run.left, f: run.left / run.total, c: '#ff7a45', cls: 'warn' };
    else if (run) line = { l: 'AUS IN', v: run.left + warnLen, f: (run.left + warnLen) / (run.total + warnLen) };
    else if (lock) line = { l: 'SPERRE', v: lock.left, f: lock.left / lock.total, c: '#ff6b6b' };
    else if ((this._st(id.occupied) || {}).state === 'on') {
      // Medienwiedergabe läuft: Bewegung schaltet das Licht gerade nicht ein
      line = { l: 'MEDIEN', t: 'LÄUFT', f: 1, c: '#6fb7ff' };
    }
    // Zeit- und Helligkeitssteuerung: Profile, deren Lampen sich mit diesem Licht überschneiden (Karten-Licht, seine Mitglieder, Bewegungsgruppe)
    const le = this._st((this._c.lights[t] || {}).entity), mg = this._st(`group.${r}_light_motion_${t}`);
    const mine = new Set([(this._c.lights[t] || {}).entity, ...((le && le.attributes.entity_id) || []), ...((mg && mg.attributes.entity_id) || [])].filter(Boolean));
    const prof = {};
    for (const [f, sid, lbl] of [['schedule', zsId, 'ZEIT'], ['lux', luxId, 'LUX']]) {
      const s = this._st(sid(r)), P = ((s && s.attributes.profiles) || []).filter(p => p.enabled && (p.lamps || []).some(e => mine.has(e)));
      const run = P.flatMap(p => p.running || []).filter(x => (x.lamps || []).some(e => mine.has(e)));
      prof[f] = { P, run };
      if (!line && run.length) { const u = run.map(x => x.until).filter(Boolean).sort().pop(); line = { l: lbl, t: u ? 'BIS ' + new Date(u).toTimeString().slice(0, 5) : 'AN', f: 1, c: '#ff9f2e' }; }
    }
    // Anwesenheitssimulation (hausweit): grün = Modus nicht Aus und der Raum steht im Tagesplan, orange = hat Lampen dieses Lichts an
    const ps = (this._st(PS_ID) || {}).attributes || {}, pe = (ps.plan || {}).entries || [];
    const simRun = (ps.running_lamps || []).some(e => mine.has(e)) || src === 'simulation';
    prof.simulation = { P: ps.mode && ps.mode !== 'off' && pe.some(e => e.room === r) ? [1] : [], run: simRun ? [1] : [] };
    if (!line && simRun) { const e = pe.find(x => x.state === 'on' && x.room === r); line = { l: 'SIM', t: e ? 'BIS ' + psHM(e.off) : 'AN', f: 1, c: '#b48cff' }; }
    for (const [f] of AUTO_FN) {
      const el = this.$('fk-' + f); if (!el) continue;
      let ena = (this._st(autoEnabled(r, f, t)) || {}).state === 'on', act = src === f;
      if (prof[f]) { ena = prof[f].P.length > 0; act = act || prof[f].run.length > 0; }
      el.classList.toggle('act', act); el.classList.toggle('rdy', ena && !act);
      // kompakt (ohne LCD): Restzeit steht in der orangen Taste
      this.$('fk-' + f + '-t').innerHTML = compact && act && line && line.v != null ? `<span class="tm">${mmss(line.v)}</span>` : AUTO_FN.find(x => x[0] === f)[1];
    }
    const au = this.$('l-au');
    au.classList.toggle('idle', !line); au.classList.toggle('warn', !!line && line.cls === 'warn');
    au.style.setProperty('--auc', line && line.c ? line.c : '');
    if (!line) au.style.removeProperty('--auc');
    this.$('l-au-l').textContent = line ? line.l : 'AUTO';
    this.$('l-au-v').textContent = !line ? '--:--' : line.t || mmss(line.v);
    // Balken: erster Wert (und Wechsel des Lichts) ohne Animation, danach weich im Sekundentakt
    const bar = this.$('l-au-b'), w = line ? clamp(line.f, 0, 1) * 100 + '%' : '0', key = t + (line ? line.l : '');
    if (bar._k !== key) { bar.style.transition = 'none'; bar.style.width = w; void bar.offsetWidth; bar.style.transition = ''; bar._k = key; }
    else bar.style.width = w;
  }
  // Favoriten: input_text.licht_favoriten_<raum> (Einstellungen → Lichtsteuerung → Manuell), sonst favorites: der Konfiguration
  _favs() { const st = this._st(favId(raumOf(this, this._c))); return (st && favDec(st.state)) || this._c.favorites; }
  _updFavs() { const l = this._favs(); this.shadowRoot.querySelectorAll('.key[data-act^="fav:"]').forEach(k => { const f = l[+k.dataset.act.slice(4)]; if (f) k.style.setProperty('--c', favCss(f)); }); }

  act(cmd, arg) {
    if (!this._c.lights.secondary.entity) this._tab = 'primary';
    const c = this._c, le = c.lights[this._tab].entity;
    if (cmd === 'autoset' && arg === 'simulation') { const p = this._panel(); window.__rpPsJump = true; if (p && p.openSettings) p.openSettings('allgemein'); return; }
    if (cmd === 'autoset') { const p = this._panel(); window.__rpLightJump = { fn: arg, light: this._tab }; if (p && p.openSettings) p.openSettings('licht'); return; }
    if ((cmd === 'mode' || cmd === 'fav') && !this._ok(this._st(le))) return;
    if (cmd === 'toggle' && !this._ok(this._st(c.lights[arg].entity))) return;
    switch (cmd) {
      case 'tab':
        this._tab = arg; this._drag = null;
        try { localStorage.setItem('raum-tablet-card:tab:' + c.lights.primary.entity, arg); } catch (e) { /* ohne Speicher */ }
        this.update(); break;
      case 'toggle': { const le = c.lights[arg].entity, on = (this._st(le) || {}).state === 'on'; this._call('light', 'toggle', withFade(this._hass, raumOf(this, c), arg, on ? 'off' : 'on', { entity_id: le })); break; }
      case 'alloff': {
        for (const L of ['primary', 'secondary']) { const e = c.lights[L].entity; if (this._ok(this._st(e))) this._call('light', 'turn_off', withFade(this._hass, raumOf(this, c), L, 'off', { entity_id: e })); }
        break;
      }
      case 'mode': {
        const s = this._st(le), a = (s && s.attributes) || {}, last = this._memLoad(this._tab);
        if (arg === 'white') this._call('light', 'turn_on', { entity_id: le, color_temp_kelvin: clamp(last.k || 3000, a.min_color_temp_kelvin || 2000, a.max_color_temp_kelvin || 6500) });
        else this._call('light', 'turn_on', { entity_id: le, hs_color: last.hs || [30, 80] });
        break;
      }
      case 'fav': {
        const f = this._favs()[+arg], s = this._st(le), a = (s && s.attributes) || {};
        this._call('light', 'turn_on', f.kelvin ? { entity_id: le, color_temp_kelvin: clamp(f.kelvin, a.min_color_temp_kelvin || 2000, a.max_color_temp_kelvin || 6500) } : { entity_id: le, hs_color: f.hs });
        break;
      }
    }
  }

  // Zuletzt gesendete Lichtwerte merken (für Lampen ohne Rückmeldung, z. B. MiLight-Hub)
  onCall(d, s, data) {
    if (d !== 'light' || s !== 'turn_on') return;
    const t = ['primary', 'secondary'].find(x => this._c.lights[x].entity === data.entity_id); if (!t) return;
    const last = this._memLoad(t);
    if (data.hs_color) { last.hs = data.hs_color; last.mode = 'color'; }
    if (data.color_temp_kelvin) { last.k = data.color_temp_kelvin; last.mode = 'white'; }
    if (data.brightness_pct != null) last.bri = data.brightness_pct;
    try { localStorage.setItem('raum-tablet-card:light:' + data.entity_id, JSON.stringify({ hs: last.hs, k: last.k, bri: last.bri, mode: last.mode })); } catch (e) { /* ohne Speicher */ }
  }
  _memLoad(t) {
    const last = this._last[t];
    if (!last._ld) {
      last._ld = true;
      try { const v = JSON.parse(localStorage.getItem('raum-tablet-card:light:' + this._c.lights[t].entity) || 'null'); if (v) for (const k in v) if (last[k] == null && v[k] != null) last[k] = v[k]; } catch (e) { /* ohne Speicher */ }
    }
    return last;
  }

  _bindFader(el, kind) {
    if (!el) return;
    const apply = (ev, final) => {
      const r = el.getBoundingClientRect(), f = clamp((ev.clientX - r.left) / r.width, 0, 1);
      if (kind === 'bri') this._drag = { kind: 'bri', v: Math.max(1, Math.round(f * 100)), active: !final, until: Date.now() + 2000 };
      else { const [kmin, kmax] = this._krange(); this._drag = { kind: 'k', v: Math.round((kmin + f * (kmax - kmin)) / 50) * 50, active: !final, until: Date.now() + 2000 }; }
      this._updLight();
      if (final || Date.now() - (this._sent || 0) > 450) { this._sent = Date.now(); this._commit(); }
    };
    el.addEventListener('pointerdown', ev => {
      if (!this._hass || !this._ok(this._st(this._c.lights[this._tab].entity))) return;
      el.setPointerCapture(ev.pointerId); ev.preventDefault(); apply(ev, false);
      const mv = e2 => apply(e2, false);
      const up = e2 => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); apply(e2, true); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
  _commit() {
    const d = this._drag; if (!d) return;
    const le = this._c.lights[this._tab].entity;
    if (d.kind === 'bri') this._call('light', 'turn_on', { entity_id: le, brightness_pct: d.v });
    else if (d.kind === 'k') this._call('light', 'turn_on', { entity_id: le, color_temp_kelvin: d.v });
    else if (d.kind === 'hs') this._call('light', 'turn_on', { entity_id: le, hs_color: [Math.round(d.h), Math.round(d.s)] });
  }
  _krange() { const s = this._st(this._c.lights[this._tab].entity), a = (s && s.attributes) || {}; return [a.min_color_temp_kelvin || 2000, a.max_color_temp_kelvin || 6500]; }

  _lightInfo(t) {
    const L2 = this._c.lights[t], s = this._st(L2.entity), a = (s && s.attributes) || {};
    const ok = this._ok(s), on = ok && s.state === 'on';
    const last = this._memLoad(t);
    const repColor = ['hs', 'rgb', 'xy', 'rgbw', 'rgbww'].includes(a.color_mode), repWhite = a.color_mode === 'color_temp';
    const isColor = repColor || (!repWhite && last.mode === 'color');
    if (repColor) last.mode = 'color'; else if (repWhite) last.mode = 'white';
    if (a.color_temp_kelvin) last.k = a.color_temp_kelvin;
    if (a.hs_color && repColor) last.hs = a.hs_color;
    if (a.brightness != null) last.bri = Math.round(a.brightness / 2.55);
    return { L: L2, s, a, ok, on, isColor, bri: !on ? 0 : a.brightness == null ? (last.bri ?? null) : Math.round(a.brightness / 2.55), k: a.color_temp_kelvin || last.k || 3000, hs: (repColor && a.hs_color) || last.hs || [30, 80] };
  }
  _updPower() {
    for (const t of ['primary', 'secondary']) {
      const i = this._lightInfo(t), el = this.$('pw-' + t);
      if (!el) continue;
      el.style.setProperty('--c', i.L.color); el.style.setProperty('--g', rgba(i.L.color, .35)); el.style.setProperty('--t', i.L.color);
      el.classList.toggle('on', i.on); el.classList.toggle('na', !i.ok);
      this.$(`pw-${t}-nm`).textContent = i.L.name;
      this.$(`pw-${t}-st`).textContent = !i.ok ? 'n.v.' : i.on ? 'Ein' : 'Aus';
      this.$(`pw-${t}-si`).innerHTML = i.ok ? `seit<b>${hhmm(i.s.last_changed)}</b>` : '';
      this.$(`tab-${t}-v`).textContent = !i.ok ? 'n.v.' : !i.on ? 'AUS' : i.bri == null ? 'AN' : i.bri + '%';
      const led = this.$(`tab-${t}-led`);
      led.style.background = !i.ok ? '#3a3c41' : i.on ? i.L.color : rgba(i.L.color, .28);
      led.style.boxShadow = i.on ? `0 0 8px ${i.L.color}` : 'none';
      this.$('tab-' + t).classList.toggle('on', this._tab === t);
    }
  }
  _updLight() {
    if (!this._c.lights.secondary.entity) this._tab = 'primary';
    const i = this._lightInfo(this._tab), $ = this.$, lc = $('lc');
    let { bri, k, hs, isColor } = i;
    if (this._dragActive('bri')) bri = this._drag.v;
    const briNA = bri == null, briPos = briNA ? 100 : bri;
    if (this._dragActive('k')) { k = this._drag.v; isColor = false; }
    if (this._dragActive('hs')) { hs = [this._drag.h, this._drag.s]; isColor = true; }
    const acc = i.L.color;
    lc.style.setProperty('--acc', acc); lc.style.setProperty('--accg', rgba(acc, .7));
    this.$('lc').querySelectorAll('.part').forEach(e => { if (!['power', 'tabs', 'subtitle'].includes(e.dataset.part.split('.')[0])) e.classList.toggle('na', !i.ok); });
    $('l-sub').textContent = i.L.subtitle;
    $('l-v').textContent = !i.ok ? '---%' : briNA ? 'AN' : pad3(bri) + '%';
    $('l-r').textContent = !i.ok ? '' : isColor ? `H${Math.round(hs[0])}°` : `${k}K`;
    $('l-m').textContent = !i.ok ? 'NICHT VERFÜGBAR' : !i.on ? 'AUS' : '▶ ' + (isColor ? hueName(hs[0]) : kelName(k)).toUpperCase();
    const mem = Array.isArray(i.a.entity_id) ? i.a.entity_id : null;
    $('l-n').textContent = !i.ok ? '' : mem ? `${mem.filter(e => (this._st(e) || {}).state === 'on').length}/${mem.length} AN` : (i.on ? 'AN' : 'AUS');
    const d = $('ldial');
    d.querySelector('.hv').textContent = i.ok && !briNA ? bri : '--';
    // LED-Kranz in der eingestellten Lichtfarbe (Weiß: Farbtemperatur, Farbe: Farbton/Sättigung)
    const lcol = isColor ? hsCss(hs[0], hs[1]) : kCss(k);
    d.querySelectorAll('.dot').forEach((e, n, A) => { const lit = i.on && n / (A.length - 1) * 100 <= briPos; e.style.background = lit ? lcol : ''; e.style.boxShadow = lit ? `0 0 6px ${lcol},0 0 2px ${lcol},inset 0 0 1.5px rgba(255,255,255,.85)` : ''; });
    const [kmin, kmax] = this._krange(), kf = clamp((k - kmin) / ((kmax - kmin) || 1), 0, 1);
    const hd = d.querySelector('.handle'), r = isColor ? 60 + hs[1] / 100 * 44 : 84, a = (isColor ? hs[0] : 135 + kf * 270) * Math.PI / 180;
    hd.style.display = i.ok ? '' : 'none';
    hd.style.left = (165 + r * Math.cos(a)) + 'px'; hd.style.top = (165 + r * Math.sin(a)) + 'px';
    hd.style.setProperty('--hc', isColor ? hsCss(hs[0], hs[1]) : kCss(k));
    d.querySelector('.wheel').classList.toggle('ct', !isColor);
    d.querySelector('.wheel').style.filter = i.on ? '' : 'saturate(.35) brightness(.7)';
    $('l-white').classList.toggle('on', i.on && !isColor);
    $('l-color').classList.toggle('on', i.on && isColor);
    const sup = i.a.supported_color_modes || [];
    const canK = !sup.length || sup.includes('color_temp');
    const canC = !sup.length || sup.some(x => ['hs', 'rgb', 'xy', 'rgbw', 'rgbww'].includes(x));
    $('l-white').style.display = canK ? '' : 'none';
    $('l-color').style.display = canC ? '' : 'none';
    $('f-temp-w').classList.toggle('lock', !canK);
    // kmin/kmax oben (Griff im Drehregler) bereits ermittelt
    $('f-temp').querySelector('.fader').style.left = clamp((k - kmin) / (kmax - kmin), 0, 1) * 100 + '%';
    $('f-temp-v').textContent = i.ok ? k + ' K' : '—';
    $('f-temp-w').classList.toggle('dim', isColor || !canK);
    $('f-bri').querySelector('.fader').style.left = briPos + '%';
    $('f-bri-v').textContent = i.ok && !briNA ? bri + ' %' : '—';
    $('f-bri-g').style.background = `linear-gradient(90deg,${rgba(acc, .12)},${acc})`;
    const favl = this._favs();   // gespeicherte Favoriten (Helfer), sonst Konfiguration
    $('favs').querySelectorAll('.key').forEach((e, n) => {
      const f = favl[n]; if (!f) return;
      e.classList.toggle('lock', f.kelvin ? !canK : !canC);
      const m = i.on && (f.kelvin ? (!isColor && Math.abs(f.kelvin - k) < 200) : (isColor && Math.abs(((f.hs[0] - hs[0] + 540) % 360) - 180) < 12 && Math.abs(f.hs[1] - hs[1]) < 15));
      e.classList.toggle('on', !!m);
    });
  }
}

// ---------------------------------------------------------------- Heizung: Quellen für Thermostat, Ist-Temperatur, Ventil
// Reihenfolge: gewählt (Einstellungen → Heizungssteuerung, Helfer input_text.heizung_sensoren_<raum> = "climate=…;current=…;valve=…")
// → YAML (climate: { entity, current, valve }) → automatisch (Sensoren desselben Geräts) → Attribute des Thermostats
// Lampen der Licht-Karte: gewählt in Einstellungen → Lichtsteuerung → Manuell, Helfer input_text.<raum>_light_manual_cfg_lamps
// = "primary=light.x;secondary=light.y" (secondary=- = kein zweites Licht) – hat Vorrang vor lights: im YAML
const lampId = raum => raum ? `input_text.${raum}_light_manual_cfg_lamps` : null;
const lampSel = (h, raum) => {
  const st = h && h.states && h.states[lampId(raum)], o = {};
  String((st && st.state) || '').split(';').forEach(x => { const [k, v] = x.split('=').map(s => (s || '').trim()); if (/^(primary|secondary)$/.test(k) && (/^(light|switch|group)\.\w+$/.test(v) || (k === 'secondary' && v === '-'))) o[k] = v; });
  return o;
};
const lampWrite = async (el, raum, map) => {
  const h = el._hass, id = lampId(raum); if (!id) throw new Error('kein Raum-Kürzel');
  if (!h.states[id]) {
    if (!(h.user && h.user.is_admin)) throw new Error('Helfer fehlt – nur Admin kann ihn anlegen');
    const made = await h.callWS({ type: 'input_text/create', name: raum.toUpperCase() + ' Licht Manuell Lampen', icon: 'mdi:lightbulb-group', min: 0, max: 255 });
    await new Promise(res => setTimeout(res, 700));
    // HA bildet die ID aus dem Anzeigenamen – auf das Namensschema umbenennen
    const mid = made && made.id ? 'input_text.' + made.id : null;
    if (mid && mid !== id) { await h.callWS({ type: 'config/entity_registry/update', entity_id: mid, new_entity_id: id }).catch(() => {}); await new Promise(res => setTimeout(res, 500)); }
  }
  await el._call('input_text', 'set_value', { entity_id: id, value: Object.entries(map).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join(';') });
};
const hsId = raum => raum ? 'input_text.heizung_sensoren_' + raum : null;
const hsSel = (h, raum) => { const st = h && h.states[hsId(raum)], o = {}; String((st && st.state) || '').split(';').forEach(t => { const [k, v] = t.split('='); if (k && v && /^(sensor|climate)\.\w+$/.test(v.trim())) o[k.trim()] = v.trim(); }); return o; };
const hsUnit = (h, id) => { const st = h && h.states[id]; return (st && st.attributes.unit_of_measurement) || ''; };
const hsAuto = (h, climate) => {
  const reg = (h && h.entities) || {}, dev = reg[climate] && reg[climate].device_id;
  if (!dev) return {};
  const ids = Object.keys(reg).filter(id => id.startsWith('sensor.') && reg[id] && reg[id].device_id === dev && h.states[id]);
  return { current: ids.find(id => /°/.test(hsUnit(h, id)) && /temp|actual|ist/i.test(id)) || ids.find(id => /°/.test(hsUnit(h, id))), valve: ids.find(id => /level|valve|ventil|position/i.test(id)) };
};
const hsSrcs = (h, raum, y = {}) => {
  const sel = hsSel(h, raum), climate = sel.climate || y.entity || null, au = h && climate ? hsAuto(h, climate) : {};
  const pick = k => sel[k] ? [sel[k], 'gewählt'] : y[k] ? [y[k], 'YAML'] : au[k] ? [au[k], 'automatisch'] : [null, 'Thermostat'];
  const [cur, ch] = pick('current'), [val, vh] = pick('valve');
  return { climate, current: cur, valve: val, auto: au, how: { climate: sel.climate ? 'gewählt' : 'YAML', current: ch, valve: vh } };
};
const hsWrite = async (el, raum, map) => {
  const h = el._hass, id = hsId(raum); if (!id) throw new Error('kein Raum-Kürzel');
  if (!h.states[id]) {
    if (!(h.user && h.user.is_admin)) throw new Error('Helfer fehlt – nur Admin kann ihn anlegen');
    await h.callWS({ type: 'input_text/create', name: 'Heizung Sensoren ' + raum.toUpperCase(), icon: 'mdi:radiator', min: 0, max: 255 });
    await new Promise(r => setTimeout(r, 700));
  }
  await el._call('input_text', 'set_value', { entity_id: id, value: Object.entries(map).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join(';') });
};

// Sichtbarer Inhalt eines Elements (in seinen eigenen px, ohne Transformation): Vereinigung aller Teile mit Hintergrund,
// Rahmen, Schatten, Bild/SVG oder Text – leere Hüllen (z. B. die 440 px breite Zeile um den Drehregler) zählen nicht
const tightBox = root => {
  const R = root.getBoundingClientRect(), k = R.width / (root.offsetWidth || 1) || 1;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const vis = (el, cs) => el instanceof SVGElement || /^(IMG|CANVAS|VIDEO)$/.test(el.tagName) || cs.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)
    || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || (!el.children.length && !!el.textContent.trim());
  const walk = n => {
    for (const el of n.children) {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height && vis(el, cs)) { x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
      if (!(el instanceof SVGSVGElement)) walk(el);
    }
  };
  walk(root);
  if (!isFinite(x0)) return null;
  return { x: (x0 - R.left) / k, y: (y0 - R.top) / k, w: Math.max(1, (x1 - x0) / k), h: Math.max(1, (y1 - y0) / k) };
};
// Befehle, deren −/+-Tasten beim Gedrückthalten weiterzählen (siehe RPModule._repDown)
const REP_CMDS = ['temp', 'ivol', 'num', 'dur', 'lsv', 'bg'];
// −/+ des Heizungs-Reglers: Rechtecke unten links/rechts; die innere obere Ecke ist ausgeschnitten
// und folgt dem Umriss des LED-Rings (Bogen + unten abgeflacht) mit gleichmäßiger Fuge.
const ZOOM_DT = 'input_number.haus_sys_panel_cfg_doubletap_ms', ZOOM_IGN = 'input_boolean.haus_sys_panel_cfg_doubletap_ignore_controls';
let PM_SEG = null;
const pmSeg = () => PM_SEG || (PM_SEG = (() => {
  const S = 329, k = S / 290, cx = 220, cy = S / 2, g = 6 / k;
  // tiefster Punkt des Ring-Umrisses bei Abstand dx (Kranz-Einheiten), mit Fuge g
  const low = dx => {
    let y = -1e9; const a = Math.abs(dx);
    if (a < 135 + g) y = Math.min(110 + g, Math.sqrt((135 + g) ** 2 - a * a));
    if (a < 145 + g) { const b = Math.min(118 + g, Math.sqrt((145 + g) ** 2 - a * a)); if (b >= a - g * 1.42) y = Math.max(y, b); }
    if (a < 123 + g) y = Math.max(y, Math.sqrt((123 + g) ** 2 - a * a));   // Metallring (Bezel) steht unten über
    return y;
  };
  const yOut = x => { const v = low((x - cx) / k); return v < -1e8 ? -1e9 : cy + v * k; };
  const rdp = (P, eps) => {
    if (P.length < 3) return P;
    const [a, b] = [P[0], P[P.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let mi = 0, md = 0;
    for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - P[i][1]) - (a[0] - P[i][0]) * (b[1] - a[1])) / L; if (d > md) { md = d; mi = i; } }
    return md > eps ? [...rdp(P.slice(0, mi + 1), eps).slice(0, -1), ...rdp(P.slice(mi), eps)] : [a, b];
  };
  const simp = P => P.filter((q, i) => { const a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length]; return Math.abs((q[0] - a[0]) * (b[1] - q[1]) - (q[1] - a[1]) * (b[0] - q[0])) > .05; });
  const one = (x0, x1, y0, y1, left) => {
    const N = 96, top = [];
    for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N; top.push([x, Math.max(y0, yOut(x))]); }
    const P = simp([...rdp(top, .7), [x1, y1], [x0, y1]].map(([x, y]) => [x - x0, y - y0]));
    const lx = left ? 40 : x1 - x0 - 40, ly = (y1 - y0 + Math.max(0, yOut(x0 + lx) - y0)) / 2 + 3;
    return { box: `left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px`, d: polyPath(P, 10), lx, ly };
  };
  // Oberkante auf Höhe der Ecke der Ausbuchtung (r145 auf dem 45°-Strahl), außen bündig mit dem Drehregler,
  // innen: bis dort, wo die Unterkante der Ausbuchtung (r145-Kranz, flach bei 118) auf den Metallring (Bezel, r123) trifft
  const e = 145 * k * Math.SQRT1_2, yt = Math.round(cy + e), xl = cx - S / 2, xr = cx + S / 2, rb = 123 * k;
  const xi = Math.sqrt(Math.max(0, rb * rb - (118 * k) ** 2));
  return { l: one(xl, cx - xi, yt, 348, true), r: one(cx + xi, xr, yt, 348, false) };
})());
const pmKey = (side, sign) => {
  const g = pmSeg()[side];
  return `<div class="pmw seg ${side}" data-act="temp:${sign}" style="${g.box}"><div class="pm" style="clip-path:path('${g.d}')"><span style="left:${g.lx.toFixed(1)}px;top:${g.ly.toFixed(1)}px">${sign === '-' ? '−' : '+'}</span></div></div>`;
};

// ---------------------------------------------------------------- Heizung
class RPHeating extends RPModule {
  get meta() { return this.variants().tall; }
  // hoch = wie bisher · breit = Drehrad links, Kopf + Modi rechts · kompakt = Modi + Soll-Wert mit −/+
  variants() {
    return {
      tall: { bw: 440, mh: 544, fw: false, fh: false, hide: ['stepper'] },
      wide: { bw: 690, mh: 374, fw: false, fh: false, hide: ['stepper'] },
      compact: { bw: 368, mh: 185, fw: false, fh: false, weight: .7, hide: ['dial'] },
    };
  }
  static getStubConfig() { return { entity: '' }; }
  norm(c) { const cl = L({ min: 12, max: 28, title: 'Heizung', subtitle: 'Heizkörper' }, c.climate || c); cl._y = { entity: cl.entity, current: cl.current, valve: cl.valve }; return { climate: cl }; }
  // Elemente: head, modes, dial (Drehrad mit Ist/Ventil), stepper (Soll-Wert mit −/+)
  html(vn) {
    const c = this._c;
    const p = {
      head: this.P('head', `<div class="head"><span class="led" style="--lc:#ff8a4c"></span><div class="t"><h2 class="eng">${c.climate.title}</h2><p id="h-sub">${c.climate.subtitle}</p></div>
    <div class="lcd" style="padding:5px 10px"><span class="heat" id="h-badge" style="font-size:14px">--</span></div></div>`),
      modes: this.P('modes', `<div class="keys4" id="h-modes" style="grid-template-columns:${vn === 'wide' ? 'repeat(2,1fr)' : 'repeat(auto-fit,minmax(78px,1fr))'}">
    <div class="hk" id="hm-heat" data-sub="modes.heat" data-act="hvac:heat" style="--c:#ff8a4c"><i></i>Heizen</div>
    <div class="hk" id="hm-boost" data-sub="modes.boost" data-act="boost" style="--c:#ff8a4c"><i></i>Boost</div><div class="hk" id="hm-off" data-sub="modes.off" data-act="hvac:off" style="--c:#4da3ff${vn === 'wide' ? ';grid-column:1/-1' : ''}"><i></i>Aus</div></div>`),
      dial: this.P('dial', `<div class="trow" id="trow" style="margin:0;width:440px">
    ${dialHtml('tdial', 'thermo', 329, { min: 't-min', max: 't-max' })}${pmKey('l', '-')}${pmKey('r', '+')}
    </div>
    <div class="htl">
     <div class="tile" id="h-ist-t" data-sub="dial.ist" data-act="more:${c.climate.entity}" style="padding:7px 10px"><div class="spark" id="h-ist-sp"></div><div class="n"><span>Ist-Temp.</span><span id="h-ist-s"></span></div><div class="val" id="h-ist" style="font-size:21px">--</div><div class="bar"><i id="h-ist-b"></i></div></div>
     <div class="tile" id="h-valve-t" data-sub="dial.valve" style="padding:7px 10px"><div class="spark" id="h-valve-sp"></div><div class="n"><span>Ventil</span><span id="h-valve-s"></span></div><div class="val" id="h-valve" style="font-size:21px">--</div><div class="bar"><i id="h-valve-b"></i></div></div>
    </div>`, 'flex:none;width:440px'),
      stepper: this.P('stepper', `<div class="hstep" id="h-step"><div class="hk" data-sub="stepper.minus" data-act="temp:-">−</div>
    <div class="lcd hst" data-sub="stepper.display"><div class="u heat">SOLL</div><b class="heat" id="h-tv2">--</b><div class="i" id="h-is2">IST --</div></div>
    <div class="hk" data-sub="stepper.plus" data-act="temp:+">+</div></div>`),
    };
    if (vn === 'custom') return this._cgrid(p, 'hc');
    if (vn === 'wide') return `<div id="hc" class="hrow" style="gap:18px;align-items:center">${p.dial}<div class="vcol" style="flex:1;min-width:0;gap:16px">${p.head}${p.modes}${p.stepper}</div></div>`;
    return `<div id="hc" class="vcol" style="gap:14px">${p.head}${p.modes}${p.dial}${p.stepper}</div>`;
  }
  bind() { this._bindDial(this.$('tdial'), 'thermo'); }
  watch() {
    const c = this._c.climate, q = this._srcs();
    // anderes Thermostat aus den Einstellungen → neu aufbauen
    if (q.climate && q.climate !== c.entity) { c.entity = q.climate; this._hHistAt = 0; this._hKey = null; setTimeout(() => { if (this._v) this._render(this._v); }, 0); }
    return [c.entity, q.current, q.valve, hsId(raumOf(this, this._c)), hcId(raumOf(this, this._c))];
  }
  _srcs() { return hsSrcs(this._hass, raumOf(this, this._c), this._c.climate._y); }
  // Heizungssteuerung (heat_control): aktiver Heizkreis dieses Thermostats → Grund + Gültigkeit als Untertitel
  _hcSub() {
    const s = this._st(hcId(raumOf(this, this._c))), e = this._c.climate.entity, cs = ((s && s.attributes.circuits) || []).filter(x => x.kind === 'heat' && x.enabled);
    const c = cs.find(x => (x.devices || []).includes(e) || (x.device_states || []).some(d => d.entity_id === e)) || cs[0];
    if (!c || !c.label) return null;
    return c.label + (c.target != null ? ' · ' + de(c.target) + '°' : '') + (c.until ? ' bis ' + hcHm(c.until) : '');
  }
  update() { this._updHeat(); }
  act(cmd, arg) {
    const c = this._c.climate;
    if (!this._ok(this._st(c.entity))) return;
    if (cmd === 'hvac') this._call('climate', 'set_hvac_mode', { entity_id: c.entity, hvac_mode: arg });
    else if (cmd === 'boost') { const s = this._st(c.entity); this._call('climate', 'set_preset_mode', { entity_id: c.entity, preset_mode: s.attributes.preset_mode === 'boost' ? 'none' : 'boost' }); }
    else if (cmd === 'temp') {
      // mehrere Klicks sammeln und den Endwert ~1,5 s nach dem letzten Klick einmal senden
      const a = this._st(c.entity).attributes, step = a.target_temp_step || 0.5;
      const v = clamp((this._dragActive('temp') ? this._drag.v : (a.temperature || 20)) + (arg === '+' ? step : -step), a.min_temp || 5, a.max_temp || 30);
      this._drag = { kind: 'temp', v, active: false, until: Date.now() + 30000, hold: true }; this._updHeat();
      clearTimeout(this._tempT); this._tempT = setTimeout(() => this._call('climate', 'set_temperature', { entity_id: c.entity, temperature: v }), 700);
    }
  }
  _commit() { const d = this._drag; if (d && d.kind === 'temp') this._call('climate', 'set_temperature', { entity_id: this._c.climate.entity, temperature: d.v }); }
  _trange(s) { const a = s.attributes, c = this._c.climate; return [Math.max(c.min, a.min_temp || c.min), Math.min(c.max, a.max_temp || c.max)]; }
  _updHeat() {
    const c = this._c.climate; let s = this._st(c.entity), ok = this._ok(s); const $ = this.$;
    // Gruppen-Thermostate melden beim Umstellen kurz „unavailable“ oder keinen Sollwert → letzten guten Stand bis 15 s weiter zeigen
    if (ok && s.attributes.temperature != null) this._hGood = { s, t: Date.now() };
    else if (this._hGood && Date.now() - this._hGood.t < 15000 && (!ok || s.state === this._hGood.s.state)) { s = this._hGood.s; ok = true; }
    const a = (s && s.attributes) || {};
    // gesendeter Sollwert bleibt stehen, bis der Thermostat ihn meldet (höchstens 30 s)
    if (this._drag && this._drag.kind === 'temp' && this._drag.hold && Math.abs(Number(a.temperature) - this._drag.v) < .01) this._drag.until = 0;
    $('hc').querySelectorAll('.keys4').forEach(e => e.classList.toggle('na', !ok));
    $('h-step').classList.toggle('na', !ok);
    $('tdial').classList.toggle('na', !ok);
    $('hc').querySelectorAll('.pmw').forEach(e => e.classList.toggle('na', !ok));
    let tgt = a.temperature;
    if (this._dragActive('temp')) tgt = this._drag.v;
    const [mn, mx] = ok ? this._trange(s) : [c.min, c.max];
    $('t-min').textContent = mn + '°'; $('t-max').textContent = mx + '°';
    const d = $('tdial');
    d.querySelector('.tv').textContent = ok && tgt != null ? de(tgt) + '°' : '--';
    d.querySelector('.ti').textContent = 'IST ' + (ok ? de(a.current_temperature) + '°' : '--');
    $('h-tv2').textContent = d.querySelector('.tv').textContent; $('h-is2').textContent = d.querySelector('.ti').textContent;
    const v = ok && tgt != null ? (tgt - mn) / (mx - mn) * 100 : -1;
    const lerp = (x, y, t) => Math.round(x + (y - x) * t);
    d.querySelectorAll('.dot').forEach((e, n, A) => {
      const f = n / (A.length - 1), lit = ok && f * 100 <= v && s.state !== 'off';
      const col = f < .5 ? `rgb(${lerp(77, 255, f * 2)},${lerp(163, 160, f * 2)},${lerp(255, 60, f * 2)})` : `rgb(255,${lerp(160, 70, (f - .5) * 2)},${lerp(60, 50, (f - .5) * 2)})`;
      e.style.background = lit ? col : ''; e.style.boxShadow = lit ? `0 0 6px ${col},0 0 2px ${col},inset 0 0 1.5px rgba(255,255,255,.85)` : '';
    });
    const boost = a.preset_mode === 'boost';
    ['heat', 'off'].forEach(m => $('hm-' + m).classList.toggle('on', ok && s.state === m && !boost));
    $('hm-boost').classList.toggle('on', ok && boost);
    $('hm-boost').style.display = (a.preset_modes || []).includes('boost') || !ok ? '' : 'none';
    const act = a.hvac_action, sub = this._hcSub();
    $('h-sub').textContent = sub || c.subtitle; $('h-sub').title = sub ? 'Heizungssteuerung' : '';
    $('h-badge').textContent = !ok ? 'N.V.' : act === 'heating' ? '▲ HEIZT' : act === 'idle' ? '● BEREIT' : s.state === 'off' ? 'AUS' : boost ? '▲ BOOST' : s.state === 'auto' ? '● AUTO' : '● HEIZEN';
    // Ist + Ventil als Kacheln wie in der Raumklima-Karte: Status, Wert, Balken, Verlauf 24 h im Hintergrund
    const q = this._srcs(), cs = this._st(q.current), val = this._st(q.valve), soll = ok && s.state !== 'off' && a.temperature != null ? Number(a.temperature) : null;
    let ist = q.current ? (this._ok(cs) ? Number(cs.state) : null) : ok && a.current_temperature != null ? Number(a.current_temperature) : null;
    if (ist != null && isNaN(ist)) ist = null;
    let vv = q.valve ? (this._ok(val) ? Number(val.state) : null) : ok && a.valve_position != null ? Number(a.valve_position) : null;
    $('h-ist-t').dataset.act = 'more:' + (q.current || c.entity); $('h-valve-t').dataset.act = 'more:' + (q.valve || c.entity);
    $('h-ist-t').title = 'Quelle: ' + (q.current || c.entity + ' (Attribut)') + ' · ' + q.how.current; $('h-valve-t').title = 'Quelle: ' + (q.valve || c.entity + ' (Attribut valve_position)') + ' · ' + q.how.valve;
    const hk = (q.current || '') + '|' + (q.valve || ''); if (this._hKey !== hk) { this._hKey = hk; this._hHistAt = 0; this._hHist = null; setTimeout(() => this._loadHist(), 0); }
    if (vv != null && val && val.attributes.unit_of_measurement !== '%' && vv <= 1) vv *= 100;
    if (vv != null && isNaN(vv)) vv = null;
    const iLvl = x => x == null || soll == null ? ['#979ca5', ''] : x < soll - .5 ? ['#4dc3ff', 'zu kalt'] : x > soll + .5 ? ['#ffb347', 'zu warm'] : ['#3ddc84', 'im Soll'];
    const vLvl = x => x == null ? ['#979ca5', 'n.v.'] : x <= 0 ? ['#979ca5', 'zu'] : x >= 70 ? ['#ff5a5a', 'offen'] : ['#ff8a4c', 'offen'];
    const [ic, it] = iLvl(ist), [vc, vt] = vLvl(vv);
    $('h-ist').innerHTML = ist != null ? `${de(ist)} <small>°C</small>` : '--';
    $('h-ist-s').textContent = ist == null ? 'n.v.' : it; $('h-ist-s').style.color = ic;
    $('h-ist-b').style.width = ist != null ? clamp((ist - mn) / ((mx - mn) || 1) * 100, 3, 100) + '%' : '0'; $('h-ist-b').style.background = ic;
    $('h-valve').innerHTML = vv != null ? `${Math.round(vv)} <small>%</small>` : '--';
    $('h-valve-s').textContent = vt; $('h-valve-s').style.color = vc;
    $('h-valve-b').style.width = vv != null ? clamp(vv, 3, 100) + '%' : '0'; $('h-valve-b').style.background = vc;
    const H = this._hHist || {};
    const spark = (hist, minRg, col) => { const hv = (hist || []).filter(x => x != null); if (!hv.length) return ''; const m0 = Math.min(...hv), rg = Math.max(Math.max(...hv) - m0, minRg); return hist.map(x => x == null ? '<i style="height:0"></i>' : `<i style="height:${(14 + 86 * (x - m0) / rg).toFixed(1)}%;background:${col(x)}"></i>`).join(''); };
    const sw = el => sparkN(el && el.getBoundingClientRect().width, this);
    this._html($('h-ist-sp'), spark(sparkDown(H.ist, sw($('h-ist-sp'))), 1, x => iLvl(x)[0]));
    this._html($('h-valve-sp'), spark(sparkDown(H.valve, sw($('h-valve-sp'))), 10, x => vLvl(x)[0]));
    this._faceChart(H);
  }
  // Display-Verlauf im runden Display (214er-Feld, Kreis r107): feste Skala – 30 °C auf halber Höhe (Mitte), unten 10 °C (bzw. darunter).
  // Die Balken enden unten an der Rundung des Displays, damit nichts abgeschnitten wirkt.
  _faceChart(H) {
    const svg = this.shadowRoot.querySelector('#tdial .fch'); if (!svg) return;
    const face = svg.parentElement, fw = face.getBoundingClientRect().width;
    const X0 = 12, X1 = 202, C = 107, R = 103, n = sparkN(fw * (X1 - X0) / 214, this), ist = sparkDown(H.ist, n) || [], soll = sparkDown(H.soll, n) || [];
    const all = [...ist, ...soll].filter(v => v != null);
    const key = n + '|' + ist.join() + '|' + soll.join(); if (svg._k === key) return; svg._k = key;
    const bars = svg.querySelector('.fcb'), line = svg.querySelector('.fcl'), base = svg.querySelector('.fcd');
    if (!all.length) { bars.innerHTML = ''; line.setAttribute('d', ''); base.setAttribute('d', ''); return; }
    const lo = Math.min(10, Math.floor(Math.min(...all)) - 1), hi = 30;
    const y = v => C + R - (v - lo) / (hi - lo) * R, bot = x => C + Math.sqrt(Math.max(0, R * R - (x - C) ** 2));
    const N = Math.max(ist.length, soll.length, 1), w = (X1 - X0) / N;
    bars.innerHTML = ist.map((v, i) => { if (v == null) return ''; const xc = X0 + (i + .5) * w, yt = y(v), yb = bot(xc); return yt >= yb - .5 ? '' : `<rect x="${(xc - w * .32).toFixed(1)}" y="${yt.toFixed(1)}" width="${(w * .64).toFixed(1)}" height="${(yb - yt).toFixed(1)}" rx="${Math.min(1, w * .2).toFixed(1)}"/>`; }).join('');
    let d = '', pen = false;
    soll.forEach((v, i) => { if (v == null) { pen = false; return; } const yy = y(v).toFixed(1); d += `${pen ? 'L' : 'M'}${(X0 + i * w).toFixed(1)} ${yy}L${(X0 + (i + 1) * w).toFixed(1)} ${yy}`; pen = true; });
    line.setAttribute('d', d);
    base.setAttribute('d', `M${X0} ${bot(X0).toFixed(1)}A${R} ${R} 0 0 0 ${X1} ${bot(X1).toFixed(1)}`);
  }
  // Verlauf der letzten 24 h (Ist-Temperatur, Ventil – aus den gewählten Sensoren bzw. Attributen), alle 10 min
  tick() { this._loadHist(); }
  onHass() { this._loadHist(); }
  async _loadHist() {
    const c = this._c.climate, q = this._srcs();
    if (!this._hass || !this._hass.callWS || !c.entity || Date.now() - (this._hHistAt || 0) < 6e5) return;
    this._hHistAt = Date.now();
    const end = new Date(), start = new Date(end - 24 * 36e5), N = 96, step = (end - start) / N;   // 96 Werte, je nach Breite (Balkenbreite) zusammengefasst
    try {
      const r = await this._hass.callWS({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
        entity_ids: [c.entity, q.current, q.valve].filter(Boolean), minimal_response: false, no_attributes: false, significant_changes_only: false });
      const bucket = (arr, get) => {
        let A = {}; const pts = (arr || []).map(q => { const at = q.a || q.attributes; if (at) A = at; return [q.lu != null ? q.lu * 1000 : Date.parse(q.last_updated || q.last_changed), get(q, A)]; }).filter(q => q[1] != null && !isNaN(q[1]));
        let last = null, j = 0;
        return Array.from({ length: N }, (_, i) => { const e = +start + (i + 1) * step; let sum = 0, n = 0; while (j < pts.length && pts[j][0] < e) { sum += pts[j][1]; n++; last = pts[j][1]; j++; } return n ? sum / n : last; });
      };
      const num = v => v == null || v === '' ? null : Number(v);
      this._hHist = {
        ist: q.current ? bucket(r[q.current], x => num(x.s ?? x.state)) : bucket(r[c.entity], (x, A) => num(A.current_temperature)),
        valve: q.valve ? bucket(r[q.valve], x => num(x.s ?? x.state)) : bucket(r[c.entity], (x, A) => num(A.valve_position)),
        soll: bucket(r[c.entity], (x, A) => (x.s ?? x.state) === 'off' ? null : num(A.temperature)),
      };
      this._prev = {}; this.update();
    } catch (e) { console.warn('raum-panel: Heizungs-Verlauf nicht verfügbar', e); }
  }
}

// ---------------------------------------------------------------- Wetter
class RPWeather extends RPModule {
  get meta() { return this.variants().wide; }
  // breit = wie bisher · hoch = aktuell oben, Vorhersage darunter · kompakt = nur aktuell
  variants() {
    return {
      wide: { bw: 372, mh: 190, fw: true, fh: true },
      tall: { bw: 300, mh: 360, fw: true, fh: true },
      compact: { bw: 170, mh: 175, fw: false, fh: false, weight: .7, hide: ['forecast'] },
    };
  }
  static getStubConfig() { return { entity: 'weather.forecast_home' }; }
  // days: Anzahl Vorhersagetage (1–8, Standard 8)
  norm(c) { return { weather: c.entity || c.weather, days: clamp(Math.round(Number(c.days) || 8), 1, 8) }; }
  // Elemente: now (aktuelles Wetter), forecast (Vorhersage)
  html(vn) {
    const n = this._c.days, cols = Math.min(4, n), rows = Math.ceil(n / 4);
    const now = this.P('now', `<div id="wx-head" style="text-align:center${vn === 'wide' ? ';width:128px' : ''}">
     <div id="w-ic" style="width:72px;height:72px;margin:-2px auto 0"></div>
     <div class="mono" id="w-t" style="font-size:32px;color:#eceef1;line-height:1">--</div><div class="cap" id="w-c" style="font-size:10.5px;letter-spacing:1.8px;margin-top:2px">Außen</div>
     <div id="w-d" style="font-size:12.5px;font-weight:600;color:#aeb2b9;line-height:1.35;margin-top:6px"></div></div>`, 'flex:none');
    const fc = this.P('forecast', `<div class="fc" id="w-fc" style="height:100%;grid-template-columns:repeat(${cols},minmax(0,1fr));grid-template-rows:repeat(${rows},minmax(0,1fr))"></div>`, 'flex:1;align-self:stretch;min-height:' + (rows * 84) + 'px');
    const more = this._c.weather ? `data-act="more:${this._c.weather}"` : '';
    if (vn === 'custom') return this._cgrid({ now, forecast: fc }, 'wc', more);
    if (vn === 'wide') return `<div id="wc" class="fill hrow" style="gap:14px;align-items:center" ${more}>${now}${fc}</div>`;
    return `<div id="wc" class="fill vcol" style="gap:12px;justify-content:center" ${more}>${now}${fc}</div>`;
  }
  watch() { return [this._c.weather]; }
  update() { this._updWeather(); }
  onHass() { this._subForecast(); }
  onConnect() { if (this._hass && !this._fcUnsub) this._subForecast(); }
  onDisconnect() { if (this._fcUnsub) { this._fcUnsub.then(u => u && u()).catch(() => {}); this._fcUnsub = null; } }
  _subForecast() {
    if (!this._hass || !this._c.weather || !this.isConnected || !this._hass.connection) return;
    if (this._fcUnsub) this._fcUnsub.then(u => u && u()).catch(() => {});
    this._fcUnsub = this._hass.connection.subscribeMessage(m => { this._fc = m.forecast; this._updWeather(); },
      { type: 'weather/subscribe_forecast', forecast_type: 'daily', entity_id: this._c.weather }).catch(() => null);
  }
  _updWeather() {
    if (!this._built || !this._hass) return;
    const s = this._st(this._c.weather), $ = this.$;
    if (!this._ok(s)) { $('w-t').textContent = '--'; $('w-c').textContent = 'Wetter n.v.'; this._html($('w-fc'), ''); return; }
    const a = s.attributes, fc = this._fc || [], t0 = fc[0] || {};
    this._html($('w-ic'), wxIcon(s.state));
    $('w-t').textContent = de(a.temperature) + '°';
    $('w-c').textContent = 'Außen · ' + (WX_DE[s.state] || s.state);
    const parts1 = [], parts2 = [];
    if (t0.temperature != null) parts1.push(`↑${Math.round(t0.temperature)}° ↓${Math.round(t0.templow ?? t0.temperature)}°`);
    if (a.apparent_temperature != null) parts1.push(`gefühlt ${Math.round(a.apparent_temperature)}°`);
    else if (a.humidity != null) parts1.push(`${Math.round(a.humidity)} % rF`);
    if (t0.precipitation_probability != null) parts2.push(`<span style="color:#9fc3ff">☂ ${Math.round(t0.precipitation_probability)} %</span>`);
    else if (t0.precipitation != null) parts2.push(`<span style="color:#9fc3ff">☂ ${de(t0.precipitation)} ${a.precipitation_unit || 'mm'}</span>`);
    if (a.wind_speed != null) parts2.push(`Wind ${Math.round(a.wind_speed)} ${a.wind_speed_unit || 'km/h'}`);
    this._html($('w-d'), parts1.join(' · ') + '<br>' + parts2.join(' · '));
    this._html($('w-fc'), fc.slice(0, this._c.days).map((f, n) => {
      const day = n === 0 ? 'HEUTE' : new Date(f.datetime).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase();
      const pp = f.precipitation_probability != null ? `☂ ${Math.round(f.precipitation_probability)}%` : f.precipitation ? `☂ ${de(f.precipitation)}` : '';
      return `<div><div class="d">${day}</div>${wxIcon(f.condition)}<div class="ft"><div class="tt mono">${Math.round(f.temperature)}°/${Math.round(f.templow ?? f.temperature)}°</div><div class="pp">${pp || '&nbsp;'}</div></div></div>`;
    }).join(''));
  }
}

// ---------------------------------------------------------------- Raumklima / Luftqualität
class RPAir extends RPModule {
  get meta() { return this.variants().row; }
  // Reihe = alle Werte nebeneinander · Raster = 2 Spalten (für hohe, schmale Rahmen)
  variants() {
    const n = Math.max(1, (this._c && this._c.air.length) || 1), r = Math.ceil(n / 2);
    return {
      row: { bw: Math.max(200, n * 93), mh: 90, fw: true, fh: false, estimate: true },
      grid: { bw: 250, mh: 26 + r * 70, fw: true, fh: false, estimate: true },
    };
  }
  static getStubConfig() { return { sensors: [] }; }
  norm(c) { return { air: c.sensors || c.air || [], air_history_hours: c.history_hours || c.air_history_hours || 24, title: c.title || 'Raumklima · Luftqualität' }; }
  // Elemente: title (Überschrift), tiles (Werte)
  html(vn) {
    const c = this._c, cols = vn === 'grid' ? Math.min(2, c.air.length || 1) : vn === 'custom' ? Math.max(1, Number(this._raw.tiles_columns) || c.air.length) : Math.max(1, c.air.length);
    const title = this.P('title', `<div class="cap eng" style="display:flex;justify-content:space-between;margin-bottom:6px">${c.title}<span id="air-st"></span></div>`);
    this._cols = cols;
    const tiles = this.P('tiles', `<div id="air" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px"></div>`);
    if (vn === 'custom') return this._cgrid({ title, tiles });
    return `<div class="${c.air.length > 3 && vn !== 'grid' ? 'cmp' : ''}">${title}
   ${tiles}</div>`;
  }
  watch() { return this._c.air.map(t => t.entity); }
  update() { this._updAir(); }
  tick() {
    this._loadAirHist();
    if (this._hass && Date.now() - (this._airSampled || 0) > 3e5) {
      this._airSampled = Date.now();
      for (const t of this._c.air) { const s = this._st(t.entity), v = this._ok(s) ? Number(s.state) : NaN; if (!isNaN(v)) this._airRec(t.entity, v); }
      this._updAir();
    }
  }
  onHass() { this._loadAirHist(); }
  _airLvl(t, v) {
    if (t.range) { const [lo, hi] = t.range; return v >= lo && v <= hi ? 0 : (v >= lo - 10 && v <= hi + 10) ? 2 : 3; }
    const [g, o] = t.levels || [Infinity, Infinity]; return v <= g ? 0 : v <= o ? 2 : 3;
  }
  async _loadAirHist() {
    const air = this._c.air.filter(t => t.entity && this._hass && this._hass.states[t.entity]), hrs = this._c.air_history_hours;
    if (!this._hass || !this._hass.callWS || !air.length || Date.now() - (this._airHistAt || 0) < 6e5) return;
    this._airHistAt = Date.now();
    const end = new Date(), start = new Date(end - hrs * 36e5), N = 96, step = (end - start) / N;   // 96 Werte, je nach Breite (Balkenbreite) zusammengefasst
    try {
      const r = await this._hass.callWS({ type: 'history/history_during_period', start_time: start.toISOString(), end_time: end.toISOString(),
        entity_ids: air.map(t => t.entity), minimal_response: true, no_attributes: true, significant_changes_only: false });
      const Hh = {};
      for (const t of air) {
        const pts = (r[t.entity] || []).map(p => [p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated || p.last_changed), Number(p.s ?? p.state)]).filter(p => !isNaN(p[1]));
        let last = null, j = 0;
        Hh[t.entity] = Array.from({ length: N }, (_, i) => {
          const e = +start + (i + 1) * step; let sum = 0, n = 0;
          while (j < pts.length && pts[j][0] < e) { sum += pts[j][1]; n++; last = pts[j][1]; j++; }
          return n ? sum / n : last;
        });
      }
      this._airHist = Hh; this._updAir();
    } catch (e) { console.warn('raum-panel: Verlauf aus HA nicht verfügbar – nutze eigenen Verlauf', e); }
  }
  _airStore() {
    if (!this._airLoc) { try { this._airLoc = JSON.parse(localStorage.getItem('raum-tablet-card:air') || '{}'); } catch (e) { this._airLoc = {}; } }
    return this._airLoc;
  }
  _airRec(id, v) {
    const S = this._airStore(), h = Math.floor(Date.now() / 36e5), b = (S[id] = S[id] || {}), e = b[h] || [0, 0];
    b[h] = [e[0] + v, e[1] + 1];
    for (const k of Object.keys(b)) if (+k < h - 48) delete b[k];
    if (Date.now() - (this._airSaved || 0) > 6e4) { this._airSaved = Date.now(); try { localStorage.setItem('raum-tablet-card:air', JSON.stringify(S)); } catch (e) { /* ohne Speicher */ } }
  }
  _airLocHist(id) {
    const b = this._airStore()[id], h = Math.floor(Date.now() / 36e5);
    return b ? Array.from({ length: 24 }, (_, i) => { const e = b[h - 23 + i]; return e ? e[0] / e[1] : null; }) : null;
  }
  _updAir() {
    if (!this._built || !this._hass) return;
    const $ = this.$, COL = ['#3ddc84', '#c8e06a', '#ffb347', '#ff5a5a'];
    let worst = -1, html = '';
    // Säulenzahl je Kachel aus der Kachelbreite: gleiche Säulenbreite wie in der Heizkarte
    const ar = $('air') ? $('air').getBoundingClientRect().width : 0, cols = this._cols || this._c.air.length || 1, sc = this._scale || 1;
    const NB = sparkN(ar ? (ar - (cols - 1) * 8 * sc) / cols - 16 * sc : 0, this);
    const down = h => sparkDown(h, NB);
    for (const t of this._c.air) {
      const s = this._st(t.entity), ok = this._ok(s), v = ok ? Number(s.state) : NaN;
      let lvl = -1, txt = 'n.v.';
      if (ok && !isNaN(v)) {
        lvl = this._airLvl(t, v);
        txt = (t.range ? ['optimal', '', 'mäßig', 'schlecht'] : ['gut', '', 'mäßig', 'schlecht'])[lvl];
        worst = Math.max(worst, lvl);
      }
      const col = lvl < 0 ? '#979ca5' : COL[lvl];
      const pct = ok && !isNaN(v) ? clamp(v / (t.max || 100) * 100, 3, 100) : 0;
      const unit = t.unit ?? (s && s.attributes.unit_of_measurement) ?? '';
      let hist = (this._airHist || {})[t.entity];
      if (!hist || !hist.some(x => x != null)) hist = this._airLocHist(t.entity);
      hist = down(hist);
      const hv = (hist || []).filter(x => x != null);
      let spark = '';
      if (hv.length) {
        const mn = Math.min(...hv), rg = Math.max(Math.max(...hv) - mn, (t.max || 100) * .1);
        spark = `<div class="spark">${hist.map(x => x == null ? '<i style="height:0"></i>' : `<i style="height:${(14 + 86 * (x - mn) / rg).toFixed(1)}%;background:${COL[this._airLvl(t, x)]}"></i>`).join('')}</div>`;
      }
      html += `<div class="tile" data-act="more:${t.entity}" style="padding:7px 10px">${spark}<div class="n">${t.name}<span style="color:${col}">${txt}</span></div><div class="val" style="font-size:21px">${ok && !isNaN(v) ? (t.decimals ? de(v, t.decimals) : Math.round(v)) : '--'} <small>${unit}</small></div><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></div>`;
    }
    this._html($('air'), html);
    const Lb = worst < 0 ? ['n.v.', '#979ca5'] : [['● Gut', '● Ok', '● Mäßig', '● Schlecht'][worst], COL[worst]];
    $('air-st').textContent = Lb[0]; $('air-st').style.color = Lb[1];
  }
}

// ---------------------------------------------------------------- Grundriss
class RPFloorplan extends RPModule {
  get meta() { return this.variants().tall; }
  // hoch = Legende unter dem Plan · breit = Plan links, Kopf und Legende rechts
  variants() {
    return {
      tall: { bw: 380, mh: 240, minh: 240, fw: true, fh: true },
      wide: { bw: 600, mh: 200, minh: 200, fw: true, fh: true },
    };
  }
  static getStubConfig() { return { contacts: [] }; }
  norm(c) {
    const fp = L({ title: 'Grundriss', aspect: 360 / 340, contacts: [] }, c.floorplan || c);
    fp.rot = ((Math.round((Number(fp.rotate) || 0) / 90) * 90) % 360 + 360) % 360;
    // Ausschnitt aus dem zentralen Haus-Grundriss (haus-grundriss.js)
    fp.ausschnitt = c.ausschnitt ?? c.view ?? fp.ausschnitt ?? fp.view; fp.quelle = c.quelle ?? c.source ?? fp.quelle ?? fp.source; fp.kuerzel = c.kuerzel ?? c.ids ?? fp.kuerzel; if (c.labels != null) fp.labels = c.labels; HG_LOOK.forEach(k => { if (c[k] != null) fp[k] = c[k]; });
    return { floorplan: fp };
  }
  // Elemente: head (Überschrift + Zusammenfassung), plan, legend
  html(vn) {
    if (this._c.floorplan.ausschnitt) {
      const pl = this.P('plan', `<div class="planbox hgb" style="height:100%;margin:0"><haus-grundriss id="hg" style="position:absolute;inset:0;height:100%"></haus-grundriss></div>`, 'flex:1;min-height:0;min-width:0');
      return vn === 'custom' ? this._cgrid({ plan: pl }) : `<div class="fill vcol">${pl}</div>`;
    }
    const fp = this._c.floorplan, plan = fp.image ? `<img src="${fp.image}" alt="">` : PLAN_SVG;
    const head = this.P('head', `<div class="head"><span class="led" id="fp-led"></span><div class="t"><h2 class="eng">${fp.title}</h2><p id="fp-sub"></p></div>
    <div class="lcd" style="padding:5px 10px"><span id="fp-sum" class="mono" style="font-size:13px">--</span></div></div>`);
    const pl = this.P('plan', `<div class="planbox" style="height:100%;margin:0"><div class="planar" style="--ar:${fp.rot % 180 ? 1 / fp.aspect : fp.aspect}"><div class="plrot${fp.rot % 180 ? ' q' : ''}" style="--rot:${fp.rot}deg">${plan}<svg id="ovl" viewBox="0 0 100 ${100 / fp.aspect}" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"></svg></div><div id="markers"></div></div></div>`, 'flex:1;min-height:0;min-width:0');
    const lg = this.P('legend', `<div class="lg3" id="legend" style="margin:0${vn === 'wide' ? ';grid-template-columns:1fr' : ''}"></div>`);
    if (vn === 'custom') return this._cgrid({ head, plan: pl, legend: lg });
    if (vn === 'wide') return `<div class="fill hrow" style="gap:16px">${pl}<div class="vcol" style="width:230px;flex:none;gap:14px">${head}${lg}</div></div>`;
    return `<div class="fill vcol" style="gap:12px">${head}${pl}${lg}</div>`;
  }
  watch() { const ids = []; this._c.floorplan.contacts.forEach(t => ids.push(t.entity, t.tilt)); return ids; }
  update() { if (this._c.floorplan.ausschnitt) return this._hg(); this._updPlan(); }
  set hass(h) { super.hass = h; if (this._c && this._c.floorplan.ausschnitt) this._hg(); }
  get hass() { return this._hass; }
  // eingebettete Haus-Grundriss-Karte (Ausschnitt ohne Namen/Legende) mit Daten versorgen
  _hg() {
    const g = this.shadowRoot.getElementById('hg'), fp = this._c.floorplan; if (!g || !this._hass) return;
    if (!customElements.get('haus-grundriss')) { if (!g._wait) { g._wait = true; g.innerHTML = '<div style="padding:12px;color:#ffb347;font:600 14px Rajdhani,sans-serif">Ressource floor_plan_ha_card.js (haus-grundriss) fehlt</div>'; customElements.whenDefined('haus-grundriss').then(() => this._hg()); } return; }
    if (!g._hgc) { g._hgc = true; g.innerHTML = ''; g.setConfig(Object.assign({ ausschnitt: fp.ausschnitt, fill: true, zoom: fp.zoom || 1, rund: 14, rahmen: 3, schatten: true }, Object.fromEntries(HG_LOOK.filter(k => fp[k] != null).map(k => [k, fp[k]])), fp.quelle ? { quelle: fp.quelle } : {}, fp.labels != null ? { labels: fp.labels } : {}, (fp.kuerzel ?? fp.ids) != null ? { kuerzel: fp.kuerzel ?? fp.ids } : {})); }
    g.hass = this._hass;
  }
  _sym(ct, st, col, VH) {
    const Ln = ct.length || 20, hl = Ln / 2, x = ct.x, y = ct.y * VH / 100, door = ct.type === 'door';
    const glow = `style="filter:drop-shadow(0 0 1.2px ${col})"`, sw = 1.2;
    let g = this._c.floorplan.image ? '' : `<rect x="${-hl}" y="-1.6" width="${Ln}" height="3.2" fill="#0d0f12"/>`;
    const wedge = `<path d="M${-hl} .8 L0 ${Ln * .2} L${hl} .8" fill="${rgba(col, .18)}" stroke="${col}" stroke-width=".5"/>`;
    if (!door) {
      g += `<line x1="${-hl}" y1="0" x2="${hl}" y2="0" stroke="#8fc9ff" stroke-opacity=".3" stroke-width="2.4"/>`;
      if (st === 'open') {
        const a = 55 * Math.PI / 180, q = hl, ex = q * Math.cos(a), ey = q * Math.sin(a);
        g += `<line x1="${-hl}" y1="0" x2="${-hl + ex}" y2="${ey}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" ${glow}/><line x1="${hl}" y1="0" x2="${hl - ex}" y2="${ey}" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" ${glow}/>`;
      } else g += `<line x1="${-hl}" y1="0" x2="${hl}" y2="0" stroke="${col}" stroke-width="${sw}" ${glow}/>`;
      if (st === 'tilt') g += wedge;
    } else {
      const a = (st === 'open' ? 70 : 0) * Math.PI / 180;
      g += `<path d="M${hl} 0 A${Ln} ${Ln} 0 0 1 ${-hl} ${Ln}" fill="none" stroke="${col}" stroke-opacity="${st === 'open' ? .55 : .22}" stroke-width=".45" stroke-dasharray="1.4 1.1"/>`;
      g += `<line x1="${-hl}" y1="0" x2="${-hl + Ln * Math.cos(a)}" y2="${Ln * Math.sin(a)}" stroke="${col}" stroke-width="${sw + .3}" stroke-linecap="round" ${glow}/>`;
      if (st === 'tilt') g += wedge;
    }
    const sx = ct.hinge === 'right' ? -1 : 1, sy = door && ct.swing === 'out' ? -1 : 1;
    return `<g transform="translate(${x} ${y}) rotate(${ct.rotate || 0}) scale(${sx} ${sy})">${g}</g>`;
  }
  _updPlan() {
    const fp = this._c.floorplan, cts = fp.contacts, $ = this.$, VH = 100 / fp.aspect;
    const COL = { closed: ['#3ddc84', 'ZU'], tilt: ['#ffb347', 'GEKIPPT'], open: ['#ff5a5a', 'OFFEN'], na: ['#979ca5', 'N.V.'] };
    let open = 0, tilt = 0, na = 0, mk = '', lg = '', sv = '';
    cts.forEach((ct, n) => {
      const st = contactState(this._hass.states, ct), [col, txt] = COL[st];
      if (st === 'open') open++; if (st === 'tilt') tilt++; if (st === 'na') na++;
      const id = ct.id || ('K' + (n + 1));
      if (ct.symbol !== false) sv += this._sym(ct, st, col, VH);
      let lx = ct.label_x, ly = ct.label_y;
      if (lx == null || ly == null) {
        const d = ct.label_offset ?? (ct.symbol === false ? 0 : ct.type === 'door' ? (ct.length || 20) * .6 : 7), r = (ct.rotate || 0) * Math.PI / 180;
        lx = ct.x - d * Math.sin(r); ly = (ct.y * VH / 100 + d * Math.cos(r)) / VH * 100;
      }
      [lx, ly] = fp.rot === 90 ? [100 - ly, lx] : fp.rot === 180 ? [100 - lx, 100 - ly] : fp.rot === 270 ? [ly, 100 - lx] : [lx, ly];
      mk += `<div class="mk ${st}" data-act="more:${ct.entity}" style="left:${lx}%;top:${ly}%;--mc:${col};--mg:${rgba(col, .45)}">${id}</div>`;
      lg += `<div data-act="more:${ct.entity}" style="--mc:${col}"><span class="led" style="--lc:${col}"></span><span class="n">${id} ${ct.name || ((this._hass.states[ct.entity] || {}).attributes || {}).friendly_name || ''}</span><b>${txt}</b></div>`;
    });
    this._html($('ovl'), sv); this._html($('markers'), mk); this._html($('legend'), lg);
    const sum = open || tilt ? [open ? `${open} OFFEN` : '', tilt ? `${tilt} KIPP` : ''].filter(Boolean).join(' · ') : na === cts.length && cts.length ? 'N.V.' : 'ALLES ZU';
    const col = open ? '#ff5a5a' : tilt ? '#ffb347' : na === cts.length ? '#979ca5' : '#3ddc84';
    $('fp-sum').textContent = sum; $('fp-sum').style.color = col; $('fp-sum').style.textShadow = `0 0 8px ${rgba(col, .6)}`;
    $('fp-led').style.setProperty('--lc', col);
    $('fp-sub').textContent = `Fenster & Türen · ${cts.length} Kontakte${na ? ` · ${na} n.v.` : ''}`;
  }
}

// ---------------------------------------------------------------- Audio
class RPAudio extends RPModule {
  get meta() { return this.variants().full; }
  // voll = wie bisher · kompakt = ohne Preset-Tasten (niedriger)
  variants() { return { full: { bw: 384, mh: 208, fw: false, fh: false }, compact: { bw: 384, mh: 172, fw: false, fh: false, weight: .7, hide: ['presets'] } }; }
  static getStubConfig() { return { players: [] }; }
  norm(c0) {
    const c = c0.media || c0;
    const mm = L({ title: 'Audio', players: [], signal_floor: 15000, detail_timeout: 20, preset_count: 6 }, c), COLS = ['#4dc3ff', '#a36bff', '#3ddc84', '#ffb347'];
    const chs = c.channels || (c.volume ? [{ name: 'Main', entity: c.volume }] : [{ name: 'Main', player: true }]);
    mm.channels = chs.slice(0, 4).map((ch, k) => L({ color: COLS[k], label: String(ch.name || 'CH' + (k + 1)).toUpperCase() }, ch));
    mm.source_names = L({}, c.source_names);
    mm.effect_names = L({ Off: 'Aus' }, c.effect_names);
    return { media: mm };
  }
  _sl(id, x, y, h, n, ro) { return `<div class="fsl${ro ? ' ro' : ''}" id="${id}" style="left:${x}px;top:${y}px;height:${h}px"><div class="segs">${'<i></i>'.repeat(n)}</div>${ro ? '' : '<b class="knob"></b>'}</div>`; }
  // Elemente: volume, power, source, display, transport, presets, meters (Signal + Temperatur)
  html(vn) {
    const m = this._c.media, mcol = m.color || '#4dc3ff', sl = this._sl.bind(this), npre = m.preset_count, P = this.P.bind(this);
    // ohne Preset-Tasten: niedriger, Regler entsprechend kürzer
    const low = vn === 'compact' || this._hid('presets'), sh = low ? 128 : 164, cust = vn === 'custom';
    const sub = (html, n) => html.replace(/^<div /, `<div data-sub="${n}" `);
    const p = {
      tabs: P('tabs', '<div class="atab"><b data-v="main" data-act="aview:main">Übersicht</b><b data-v="det" data-act="aview:det">Einstellungen</b></div>'),
      volume: P('volume', `<div class="lcd alcd" data-sub="volume.display" style="left:0;top:0;width:40px;height:36px"><span>VOL</span><b id="m-vv" style="font-size:14px">--</b></div>
      ${sub(sl('m-vs0', 12, 44, sh, 36), 'volume.slider')}`),
      power: P('power', `<div class="apwf" style="left:60px;top:5px"><b id="m-pw" data-act="mpower">${PWR.replace('<svg', '<svg style="width:13px;height:13px"')}</b></div>`),
      source: P('source', (m.source ? '<div class="hk sm" data-sub="source.source" data-act="apick:source" style="left:81px;top:46px;width:84px">Quelle</div>' : '') + (m.effect ? '<div class="hk sm" data-sub="source.effect" data-act="apick:effect" style="left:175px;top:46px;width:84px">Effekt</div>' : '')),
      display: P('display', `<div class="lcd adisp" style="left:52px;top:78px;width:236px;height:54px"><div class="ainfo" id="m-info"></div><div class="mqw"><div class="mq" id="m-title">--</div></div></div>`),
      transport: P('transport', `<div class="mbtn" style="left:52px;top:140px;width:236px">
       <div class="hk ic" data-sub="transport.prev" data-act="media:media_previous_track">${IC.prev}</div><div class="hk ic" id="m-pp" data-sub="transport.play" data-act="media:media_play_pause">${IC.play}</div>
       <div class="hk ic" data-sub="transport.stop" data-act="media:media_stop">${IC.stop}</div><div class="hk ic" data-sub="transport.next" data-act="media:media_next_track">${IC.next}</div>
       <div class="hk ic" id="m-mute" data-sub="transport.mute" data-act="mmute" style="--c:#ff5a5a">${IC.vol}</div>
      </div>`),
      presets: P('presets', `<div class="apre" id="m-pre" style="left:52px;top:180px;width:236px">${Array.from({ length: npre }, (_, i) => `<div class="hk sm" data-act="preset:${i}" style="--c:var(--acc)"><i></i>${i + 1}</div>`).join('')}</div>`),
      meters: P('meters', (m.signal ? `<div data-sub="meters.signal"><div class="lcd alcd" style="left:300px;top:0;width:40px;height:36px"><span>SIG</span><b id="m-sig" style="font-size:14px">--</b></div>${sl('m-vu', 312, 44, sh, 36, true)}</div>` : '') + (m.temperature ? `<div data-sub="meters.temp"><div class="lcd alcd" style="left:344px;top:0;width:40px;height:36px"><span>TEMP</span><b id="m-tv" style="font-size:14px">--</b></div>${sl('m-tb', 356, 44, sh, 36, true)}</div>` : '')),
    };
    const det = `<div class="apage adet">
      ${m.channels.map((ch, k) => `<div class="lcd alcd" style="left:${k * 50}px;top:0;width:44px;height:36px"><span>${ch.label}</span><b id="m-dv${k}">--</b></div>${sl('m-ds' + k, k * 50 + 14, 44, sh, 36)}`).join('')}
      ${m.dolby ? '<div class="hk" id="m-dol" data-act="dolby" style="left:212px;top:32px;width:172px;height:32px;--c:#4dc3ff"><i></i>Dolby</div>' : ''}
      <div class="cap eng" style="position:absolute;left:212px;top:78px;font-size:10.5px">Presets bearbeiten</div>
      <div class="apre" style="left:212px;top:96px;width:172px;grid-template-columns:repeat(3,1fr);gap:8px">${Array.from({ length: npre }, (_, i) => `<div class="hk sm" data-act="pedit:${i}" style="height:30px">✎ P${i + 1}</div>`).join('')}</div>
      <div class="ainfo" style="left:212px;top:${low ? 160 : 192}px;width:172px;text-align:left;font-size:9px;color:#979ca5">Zurück zur Übersicht nach ${m.detail_timeout} s</div>
     </div>`;
    // freie Anordnung: alle Elemente im Modul-Raster; die Einstellungs-Seite legt sich bei Bedarf darüber
    if (cust) return `<div id="mc" class="acust" data-view="main" style="position:relative;--acc:${mcol};--accg:${rgba(mcol, .6)};--adh:${low ? 172 : 208}px">
    <div class="aud">${this._cgrid(p)}${det}<div class="apick" id="m-pick" hidden></div></div></div>`;
    return `<div id="mc" data-view="main" style="position:relative;height:${low ? 172 : 208}px;--acc:${mcol};--accg:${rgba(mcol, .6)}">
    <div class="aud">
     ${p.tabs}
     <div class="apage amain">${p.volume}${p.power}${p.source}${p.display}${p.transport}${p.presets}${p.meters}</div>
     ${det}
     <div class="apick" id="m-pick" hidden></div>
    </div>
   </div>`;
  }
  _popHtml() {
    const m = this._c.media, mcol = m.color || '#4dc3ff', sl = this._sl.bind(this);
    return `<div class="ppop" id="pp" hidden><div class="plate card ppbox" style="--acc:${mcol};--accg:${rgba(mcol, .6)}">
    <div class="head"><span class="led" style="--lc:${mcol}"></span><div class="t"><h2 class="eng" id="pp-t">Preset</h2><p>Lautstärken${m.effect ? ' und Effekt' : ''} einstellen und speichern</p></div></div>
    <div class="ppsl">${m.channels.map((ch, k) => `<div class="ppc"><div class="lcd alcd" style="left:0;top:0;width:60px;height:40px"><span>${ch.label}</span><b id="pp-v${k}">--</b></div>${sl('pp-s' + k, 22, 50, 196, 44)}</div>`).join('')}</div>
    ${m.effect ? '<div class="ppef"><span class="cap eng">Effekt</span><div id="pp-e" style="display:contents"></div></div>' : ''}
    <div class="ppbtn"><div class="hk" data-act="pcur">Aktuelle Werte</div><div class="hk" data-act="pcancel">Abbrechen</div><div class="hk" data-act="psave" style="color:#3ddc84"><i style="background:#3ddc84;box-shadow:0 0 10px #3ddc84"></i>Speichern</div></div>
   </div></div>`;
  }
  _vdrag(el, onF) {
    if (!el) return;
    el.addEventListener('pointerdown', ev => {
      if (!this._hass) return;
      const calc = e => { const r = el.getBoundingClientRect(); return clamp(1 - (e.clientY - r.top) / r.height, 0, 1); };
      el.setPointerCapture(ev.pointerId); ev.preventDefault();
      onF(calc(ev), false);
      const mv = e2 => onF(calc(e2), false);
      const up = e2 => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); onF(calc(e2), true); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
  bind() {
    const m = this._c.media, $ = this.$;
    const setCh = (k, f, final) => {
      if (!this._chv(k)) return;
      this._drag = { kind: 'ch', k, f, active: !final, until: Date.now() + 2000 };
      this._updMedia();
      if (final || Date.now() - (this._sent || 0) > 450) { this._sent = Date.now(); this._commit(); }
    };
    this._vdrag($('m-vs0'), (f, fin) => setCh(0, f, fin));
    m.channels.forEach((ch, k) => this._vdrag($('m-ds' + k), (f, fin) => setCh(k, f, fin)));
    $('mc').addEventListener('pointerdown', () => { if ($('mc').dataset.view === 'det') this._avArm(); });
    const vu = $('m-vu'); this._vuSegs = vu ? [...vu.querySelectorAll('.segs i')] : null;
  }
  watch() { const m = this._c.media; return [m.mute, m.source, m.power, m.effect, m.dolby, m.signal, m.temperature, m.presets, ...(m.players || []), ...m.channels.map(ch => ch.entity)]; }
  onChange(ch) { const m = this._c.media; if (m.signal && ch.every(id => id === m.signal)) this._vuIn(); else this.update(); }
  update() { this._updMedia(); }
  onDisconnect() { if (this._vuRaf) { cancelAnimationFrame(this._vuRaf); this._vuRaf = null; } clearTimeout(this._avT); }
  beforeClick(t) { if (this._pickOpen && !(t && /^a(pick|opt):/.test(t.dataset.act))) this._apick(null); }
  act(cmd, arg) {
    const m = this._c.media;
    switch (cmd) {
      case 'media': { const p = this._player(); if (p) this._call('media_player', arg, { entity_id: p.entity_id }); break; }
      case 'mmute': {
        const ms = this._st(m.mute), p = this._player();
        if (this._ok(ms)) this._call(ms.entity_id.split('.')[0], 'toggle', { entity_id: ms.entity_id });
        else if (p) this._call('media_player', 'volume_mute', { entity_id: p.entity_id, is_volume_muted: !p.attributes.is_volume_muted });
        break;
      }
      case 'mpower': { const pw = this._st(m.power); if (this._ok(pw)) this._call(pw.entity_id.split('.')[0], 'toggle', { entity_id: pw.entity_id }); break; }
      case 'aview': {
        // mit Einstellungs-Dashboard im Panel: "Einstellungen" öffnet dort die Audio-Seite
        const p = arg === 'det' && this._c.media.settings_popup !== false ? this._panel() : null;
        if (p && p.hasSettings && p.hasSettings()) { p.openSettings('audio', { media: this._raw.media || this._raw }); break; }
        this._aview(arg); break;
      }
      case 'apick': this._apick(arg); break;
      case 'aopt': { const [kind, opt] = arg.split(/\|(.*)/s); this._call('select', 'select_option', { entity_id: kind === 'source' ? m.source : m.effect, option: opt }); this._apick(null); break; }
      case 'preset': this._presetApply(+arg); break;
      case 'pedit': this._presetEdit(+arg); break;
      case 'pcur': if (this._pp) { this._pp.v = this._curVols(); this._pp.e = this._curEff(); this._updPop(); } break;
      case 'peff': if (this._pp) { this._pp.e = arg || null; this._updPop(); } break;
      case 'pcancel': this._presetClose(); break;
      case 'psave': if (this._pp) this._presetSave(); break;
      case 'dolby': { const s = this._st(m.dolby); if (this._ok(s)) this._call(s.entity_id.split('.')[0], 'toggle', { entity_id: s.entity_id }); break; }
    }
  }
  _player() {
    const ps = (this._c.media.players || []).map(e => this._st(e)).filter(s => this._ok(s) && s.state !== 'off' && s.state !== 'standby');
    return ps.find(s => s.state === 'playing') || ps.find(s => s.state === 'paused') || ps[0] || null;
  }
  _chv(k) {
    const ch = this._c.media.channels[k]; if (!ch) return null;
    const s = ch.player ? this._player() : this._st(ch.entity);
    if (!this._ok(s)) return null;
    if (s.entity_id.startsWith('media_player.')) return s.attributes.volume_level != null ? { f: s.attributes.volume_level, player: s } : null;
    const a = s.attributes, mn = a.min ?? 0, mx = a.max ?? 100, v = Number(s.state);
    return isNaN(v) ? null : { f: clamp((v - mn) / (mx - mn), 0, 1), mn, mx, step: a.step || 1, ent: s };
  }
  _commit() {
    const d = this._drag; if (!d || d.kind !== 'ch') return;
    const v = this._chv(d.k); if (!v) return;
    if (v.ent) this._call(v.ent.entity_id.split('.')[0], 'set_value', { entity_id: v.ent.entity_id, value: Math.round((v.mn + d.f * (v.mx - v.mn)) / v.step) * v.step });
    else this._call('media_player', 'volume_set', { entity_id: v.player.entity_id, volume_level: Math.round(d.f * 100) / 100 });
  }
  _aview(v) {
    const mc = this.$('mc'); if (!mc) return;
    mc.dataset.view = v; this._apick(null);
    clearTimeout(this._avT);
    if (v === 'det') this._avArm();
  }
  _avArm() { clearTimeout(this._avT); this._avT = setTimeout(() => { if (this._pp) this._avArm(); else this._aview('main'); }, (this._c.media.detail_timeout || 20) * 1000); }
  _apick(kind) {
    const el = this.$('m-pick'); if (!el) return;
    if (!kind || this._pickOpen === kind) { el.hidden = true; this._pickOpen = null; return; }
    const m = this._c.media, s = this._st(kind === 'source' ? m.source : m.effect); if (!this._ok(s)) return;
    const names = kind === 'source' ? m.source_names : m.effect_names;
    el.innerHTML = `<div class="cap eng">${kind === 'source' ? 'Quelle wählen' : 'Effekt wählen'}</div><div class="apo">${(s.attributes.options || []).map(o => `<div class="hk sm${o === s.state ? ' on' : ''}" data-act="aopt:${kind}|${o}" style="--c:var(--acc)"><i></i>${names[o] || o}</div>`).join('')}</div>`;
    el.hidden = false; this._pickOpen = kind;
  }
  _presets() {
    const m = this._c.media, s = this._st(m.presets);
    let arr = null;
    if (this._ok(s)) { try { arr = JSON.parse(s.state); } catch (e) { arr = null; } }
    else if (!m.presets) { try { arr = JSON.parse(localStorage.getItem('raum-tablet-card:presets') || 'null'); } catch (e) { arr = null; } }
    if (!Array.isArray(arr)) arr = m.preset_defaults || [];
    const n = m.channels.length;
    return Array.from({ length: m.preset_count }, (_, i) => {
      const a = arr[i]; if (!Array.isArray(a) || a.length < n) return null;
      return { v: a.slice(0, n).map(Number), e: typeof a[n] === 'string' && a[n] ? a[n] : null };
    });
  }
  _curEff() { const s = this._st(this._c.media.effect); return this._ok(s) ? s.state : null; }
  _presetMatch(p, cur = this._curVols(), eff = this._curEff()) { return !!p && p.v.every((x, k) => Math.abs(x - cur[k]) <= 1) && (!p.e || !this._c.media.effect || p.e === eff); }
  _curVols() { return this._c.media.channels.map((ch, k) => { const v = this._chv(k); return v ? Math.round(v.f * 100) : 0; }); }
  _presetApply(i) {
    const p = this._presets()[i]; if (!p) { this._presetEdit(i); return; }
    const m = this._c.media, es = this._st(m.effect);
    if (p.e && this._ok(es) && es.state !== p.e && (es.attributes.options || []).includes(p.e)) this._call('select', 'select_option', { entity_id: m.effect, option: p.e });
    m.channels.forEach((ch, k) => {
      const s = this._st(ch.entity); if (!this._ok(s) || s.entity_id.startsWith('media_player.')) return;
      const a = s.attributes, mn = a.min ?? 0, mx = a.max ?? 100, st = a.step || 1;
      this._call(s.entity_id.split('.')[0], 'set_value', { entity_id: s.entity_id, value: Math.round((mn + clamp(p.v[k], 0, 100) / 100 * (mx - mn)) / st) * st });
    });
  }
  // Preset-Editor: wird bei Bedarf in der Panel-Ebene (über allen Rahmen) erzeugt
  _presetEdit(i) {
    const p = this._presets()[i];
    this._pp = { i, v: p ? p.v.slice() : this._curVols(), e: p ? p.e : this._curEff() };
    const o = this._overlay();
    if (!o.querySelector('#pp')) {
      o.insertAdjacentHTML('beforeend', this._popHtml());
      this._c.media.channels.forEach((ch, k) => this._vdrag(o.querySelector('#pp-s' + k), f => { if (!this._pp) return; this._pp.v[k] = Math.round(f * 100); this._updPop(); }));
    }
    this.$('pp-t').textContent = `Preset ${i + 1} bearbeiten`;
    this.$('pp').hidden = false; this._updPop();
  }
  _updPop() {
    if (!this._pp) return;
    this._c.media.channels.forEach((ch, k) => {
      const v = clamp(this._pp.v[k], 0, 100), col = this._paintSl(this.$('pp-s' + k), v / 100, true), b = this.$('pp-v' + k);
      b.textContent = Math.round(v); b.style.color = col;
    });
    const pe = this.$('pp-e'), es = this._st(this._c.media.effect);
    if (pe) {
      const names = this._c.media.effect_names, opts = this._ok(es) ? es.attributes.options || [] : [];
      this._html(pe, [['', 'Beibehalten'], ...opts.map(o => [o, names[o] || o])].map(([o, n]) => `<div class="hk sm${(this._pp.e || '') === o ? ' on' : ''}" data-act="peff:${o}" style="--c:var(--acc)"><i></i>${n}</div>`).join(''));
    }
  }
  _presetClose() { this._pp = null; const pp = this.$('pp'); if (pp) pp.hidden = true; if (this.$('mc').dataset.view === 'det') this._avArm(); }
  _presetSave() {
    const m = this._c.media, all = this._presets();
    all[this._pp.i] = { v: this._pp.v.map(x => Math.round(clamp(x, 0, 100))), e: this._pp.e };
    const json = JSON.stringify(all.map(p => p ? (p.e ? [...p.v, p.e] : p.v) : []));
    if (m.presets) this._call('input_text', 'set_value', { entity_id: m.presets, value: json });
    else { try { localStorage.setItem('raum-tablet-card:presets', json); } catch (e) { /* ohne Speicher */ } }
    this._presetClose();
  }
  _paintSl(el, f, ok, col = volCol(f)) {
    if (!el) return col;
    const segs = el._segs || (el._segs = [...el.querySelectorAll('.segs i')]), n = ok ? Math.round(f * segs.length) : 0;
    segs.forEach((s, i) => { const on = i < n; s.style.background = on ? col : ''; s.style.boxShadow = on ? `0 0 4px ${col}` : ''; });
    el.classList.toggle('na', !ok);
    const kn = el.querySelector('.knob');
    if (kn) { kn.style.bottom = `calc(${f} * (100% - 30px))`; kn.style.setProperty('--vc', ok ? col : '#3a3c41'); }
    return col;
  }
  _vuIn() {
    const m = this._c.media; if (!m.signal || !this._vuSegs) return;
    const s = this._st(m.signal), pw = this._st(m.power), off = this._ok(pw) && pw.state === 'off';
    let v = this._ok(s) && !off ? Number(s.state) : 0; if (isNaN(v) || v < 0) v = 0;
    const V = this._vu || (this._vu = { t: 0, d: 0, pk: 0, pkT: 0, hi: 0, hiT: Date.now(), last: 0 });
    const now = Date.now();
    V.hi = Math.max(v, V.hi * Math.exp(-(now - V.hiT) / 20000)); V.hiT = now;
    V.t = v;
    const sig = this.$('m-sig');
    if (sig) sig.textContent = this._ok(s) ? (v >= 100000 ? Math.round(v / 1000) + 'k' : String(Math.round(v))) : '--';
    this._vuStart();
  }
  _vuStart() { if (!this._vuRaf && this.isConnected && this._vu) this._vuRaf = requestAnimationFrame(t => this._vuFrame(t)); }
  _vuFrame(now) {
    this._vuRaf = null;
    const V = this._vu, segs = this._vuSegs, m = this._c.media; if (!V || !segs) return;
    const dt = V.last ? Math.min(.1, (now - V.last) / 1000) : 0; V.last = now;
    const max = Math.max(m.signal_floor, V.hi * 1.1), f = clamp(Math.sqrt(V.t / max), 0, 1);
    V.d = f > V.d ? f : Math.max(f, V.d - dt * 1.2);
    if (V.d >= V.pk) { V.pk = V.d; V.pkT = now; } else if (now - V.pkT > 1200) V.pk = Math.max(V.d, V.pk - dt * .6);
    const N = segs.length, n = Math.round(V.d * N), pk = V.pk > .01 ? Math.min(N - 1, Math.round(V.pk * (N - 1))) : -1, col = volCol(V.d);
    if (n !== V.n || pk !== V.pki || col !== V.col) {
      segs.forEach((e, i) => { const on = i < n || i === pk, c2 = i === pk && i >= n ? volCol(V.pk) : col; e.style.background = on ? c2 : ''; e.style.boxShadow = on ? `0 0 4px ${c2}` : ''; });
      V.n = n; V.pki = pk; V.col = col;
      const sig = this.$('m-sig'); if (sig) sig.style.color = V.t > 0 ? col : '';
    }
    if (V.d > f + .002 || V.pk > V.d + .002) this._vuStart();
  }
  _updMedia() {
    if (!this._built || !this._hass) return;
    const m = this._c.media, $ = this.$, p = this._player(), ms = this._st(m.mute), src = this._st(m.source), pw = this._st(m.power);
    const eff = this._st(m.effect), dol = this._st(m.dolby), tmp = this._st(m.temperature);
    const pwOff = this._ok(pw) && pw.state === 'off';
    $('m-pp').innerHTML = p && p.state === 'playing' ? IC.pause : IC.play;
    $('mc').querySelectorAll('[data-act^="media:"]').forEach(e => e.classList.toggle('na', !p));
    const tt = pwOff ? 'AUS' : p ? mediaTitle(p) : 'KEINE WIEDERGABE', te = $('m-title');
    if (te._t !== tt) {
      te._t = tt; te.textContent = tt; te.classList.remove('run');
      requestAnimationFrame(() => {
        const w = te.scrollWidth, cw = te.parentNode.clientWidth || 196;
        te.style.setProperty('--mqa', `${cw}px`); te.style.setProperty('--mqx', `${-w}px`);
        te.style.setProperty('--mqd', `${((cw + w) / 45).toFixed(1)}s`); te.classList.add('run');
      });
    }
    const srcN = this._ok(src) ? (m.source_names[src.state] || src.state) : '--', effN = this._ok(eff) ? (m.effect_names[eff.state] || eff.state) : '';
    const dolOn = this._ok(dol) && dol.state === 'on';
    this._html($('m-info'), `Quelle: <b>${srcN}</b>${m.effect ? `<s></s>Effekt: <b>${effN || '--'}</b>` : ''}`);
    m.channels.forEach((ch, k) => {
      const v = this._chv(k);
      let f = v ? v.f : 0;
      if (this._dragActive('ch') && this._drag.k === k) f = this._drag.f;
      const col = volCol(f);
      if (k === 0) { this._paintSl($('m-vs0'), f, !!v, col); const b = $('m-vv'); b.textContent = v ? Math.round(f * 100) : '--'; b.style.color = v ? col : ''; }
      this._paintSl($('m-ds' + k), f, !!v, col);
      const b = $('m-dv' + k); if (b) { b.textContent = v ? Math.round(f * 100) : '--'; b.style.color = v ? col : ''; }
    });
    const cur = this._curVols(), curE = this._curEff(), pre = this._presets();
    $('m-pre').querySelectorAll('.hk').forEach((e, i) => { const p2 = pre[i]; e.classList.toggle('empty', !p2); e.classList.toggle('on', this._presetMatch(p2, cur, curE)); });
    const muted = this._ok(ms) ? ms.state === 'on' : !!(p && p.attributes.is_volume_muted);
    const mk = $('m-mute');
    mk.innerHTML = muted ? IC.mute : IC.vol; mk.classList.toggle('on', muted); mk.style.color = muted ? '#ff6b6b' : '';
    mk.classList.toggle('na', !this._ok(ms) && !p);
    const dk = $('m-dol'); if (dk) { dk.classList.toggle('on', dolOn); dk.classList.toggle('na', !this._ok(dol)); }
    const pk = $('m-pw');
    pk.parentNode.style.display = this._ok(pw) ? '' : 'none';
    const on = this._ok(pw) && pw.state === 'on', col = m.color || '#4dc3ff';
    pk.style.color = on ? col : '#979ca5';
    const pi = pk.querySelector('svg'); if (pi) pi.style.filter = on ? `drop-shadow(0 0 2px ${col}) drop-shadow(0 0 6px ${rgba(col, .75)})` : '';
    if ($('m-tb')) {
      const t = this._ok(tmp) ? Number(tmp.state) : NaN, ok = !isNaN(t), tc = ok ? tempCol(t) : '#979ca5';
      this._paintSl($('m-tb'), ok ? clamp(t / 90, 0, 1) : 0, ok, tc);
      const tv = $('m-tv'); tv.textContent = ok ? `${Math.round(t)}°C` : '--'; tv.style.color = ok ? tc : '';
    }
    this._vuIn();
    if (this._pickOpen) { const k = this._pickOpen; this._pickOpen = null; this._apick(k); }
  }
}

// ---------------------------------------------------------------- Audio-Einstellungen
// Für das Einstellungs-Dashboard: Kanäle, Dolby/Effekt/Quelle und Presets (anwenden + bearbeiten).
// Ohne media-Angabe übernimmt das Panel die Konfiguration seines Audio-Moduls.
class RPAudioSettings extends RPAudio {
  static get NO_CUSTOM() { return true; }
  get meta() { return this.variants().full; }
  variants() { return { full: { bw: 1000, mh: 330, fw: false, fh: false } }; }
  html() {
    const m = this._c.media, mcol = m.color || '#4dc3ff', sl = this._sl.bind(this), n = m.channels.length;
    return `<div id="mc" data-view="set" class="aset" style="--acc:${mcol};--accg:${rgba(mcol, .6)}">
     <div class="asec" style="width:${n * 72}px;flex:none"><div class="cap eng">Kanäle</div>
      <div class="achs">${m.channels.map((ch, k) => `<div class="lcd alcd" style="left:${k * 72}px;top:0;width:56px;height:40px"><span>${ch.label}</span><b id="m-dv${k}">--</b></div>${sl('m-ds' + k, k * 72 + 20, 50, 246, 44)}`).join('')}</div></div>
     <div class="asec" style="width:250px;flex:none"><div class="cap eng">Klang</div>
      ${m.dolby ? '<div class="hk" id="m-dol" data-act="dolby" style="--c:#4dc3ff"><i></i>Dolby</div>' : ''}
      ${m.effect ? '<div class="cap eng asub">Effekt</div><div class="aopts" id="as-eff"></div>' : ''}
      ${m.source ? '<div class="cap eng asub">Quelle</div><div class="aopts" id="as-src"></div>' : ''}
     </div>
     <div class="asec" style="flex:1"><div class="cap eng">Presets<small>Tippen = anwenden</small></div><div class="aprs" id="as-pre"></div></div>
    </div>`;
  }
  bind() {
    this._c.media.channels.forEach((ch, k) => this._vdrag(this.$('m-ds' + k), (f, fin) => {
      if (!this._chv(k)) return;
      this._drag = { kind: 'ch', k, f, active: !fin, until: Date.now() + 2000 };
      this._updMedia();
      if (fin || Date.now() - (this._sent || 0) > 450) { this._sent = Date.now(); this._commit(); }
    }));
  }
  onChange() { this.update(); }
  _updMedia() {
    if (!this._built || !this._hass) return;
    const m = this._c.media, $ = this.$;
    m.channels.forEach((ch, k) => {
      const v = this._chv(k); let f = v ? v.f : 0;
      if (this._dragActive('ch') && this._drag.k === k) f = this._drag.f;
      const col = this._paintSl($('m-ds' + k), f, !!v), b = $('m-dv' + k);
      b.textContent = v ? Math.round(f * 100) : '--'; b.style.color = v ? col : '';
    });
    const dol = this._st(m.dolby), dk = $('m-dol');
    if (dk) { dk.classList.toggle('on', this._ok(dol) && dol.state === 'on'); dk.classList.toggle('na', !this._ok(dol)); }
    const opts = (kind, id) => {
      const el = $(id); if (!el) return;
      const s = this._st(kind === 'source' ? m.source : m.effect), names = kind === 'source' ? m.source_names : m.effect_names;
      this._html(el, this._ok(s) ? (s.attributes.options || []).map(o => `<div class="hk sm${o === s.state ? ' on' : ''}" data-act="aopt:${kind}|${o}" style="--c:var(--acc)"><i></i>${names[o] || o}</div>`).join('') : '<em class="aem">n.v.</em>');
    };
    opts('effect', 'as-eff'); opts('source', 'as-src');
    const cur = this._curVols(), curE = this._curEff();
    this._html($('as-pre'), this._presets().map((p, i) => `<div class="aprow"><div class="hk${this._presetMatch(p, cur, curE) ? ' on' : ''}${p ? '' : ' empty'}" data-act="preset:${i}" style="--c:var(--acc)"><i></i>P${i + 1}</div>
      <div class="lcd apv">${p ? p.v.map((x, k) => `<span><small>${m.channels[k].label}</small>${x}</span>`).join('') + (m.effect ? `<span><small>EFFEKT</small>${p.e ? (m.effect_names[p.e] || p.e) : '–'}</span>` : '') : '<em>– leer –</em>'}</div>
      <div class="hk sm" data-act="pedit:${i}" style="height:36px">✎ Bearbeiten</div></div>`).join(''));
  }
}

// ---------------------------------------------------------------- Benachrichtigungs-Regeln pro Raum
// Raum = Raum-Kürzel des Dashboards (Panel-Option  raum: bu  – sonst aus der Adresse /<kürzel>-wall-panel).
// Das Panel trägt sein Tablet als "<browser-id>@<kürzel>" in input_select.klingel_gerate ein (für das Klingel-Script).
// Helfer je Raum (fehlt einer = erlaubt):
//   schedule.benachrichtigung_<raum> (an = Popup erlaubt), schedule.benachrichtigung_ton_<raum> (an = Ton erlaubt),
//   input_boolean.benachrichtigung_aus_<raum> (Popup manuell aus), input_boolean.benachrichtigung_stumm_<raum> (Ton manuell stumm)
// Gleiche Logik serverseitig in /config/custom_templates/benachrichtigung.jinja (script.klingel_popup).
const NOTIFY_DOORS = [{ key: 'haustur', name: 'Haustür', roof: 'gable', device_entity: 'event.vordereingang_klingeln' }, { key: 'wohnungstur', name: 'Wohnungstür', roof: 'flat' }];
const bmSlug = b => String(b).replace(/[^a-z0-9]+/gi, '_').toLowerCase();
const bmMe = () => { try { return localStorage.getItem('browser_mod-browser-id'); } catch (e) { return null; } };
const bmDev = (hass, b) => { const e = b && hass && hass.entities && hass.entities['sensor.' + bmSlug(b) + '_browser_path']; return e ? e.device_id : null; };
const RAUM_NAMES = { wz: 'Wohnzimmer', bu: 'Büro', ku: 'Küche', sz: 'Schlafzimmer', fl: 'Flur', ke: 'Keller', ba: 'Balkon', bz: 'Badezimmer' };
const pathRaum = () => { const m = /^\/([a-z]{2,4})-wall-panel(\/|$)/.exec(location.pathname || ''); return m ? m[1] : null; };
const KL_DEVICES = 'input_select.klingel_gerate';
const klOpts = h => ((h && h.states[KL_DEVICES] && h.states[KL_DEVICES].attributes.options) || []).filter(o => o && o !== '–');
// Raum-Kürzel eines Elements: eigene Option raum → Raum-Panel (raum:) → Adresse
function raumOf(el, cfg) {
  if (cfg && cfg.raum) return String(cfg.raum).toLowerCase();
  let n = el;
  for (let i = 0; i < 20 && n; i++) { const root = n.getRootNode(); n = root && root.host; if (n && n.tagName === 'RAUM-PANEL') return n._raum ? n._raum() : null; }
  return pathRaum();
}
const roomIds = a => ({ sched: 'schedule.benachrichtigung_' + a, schedTon: 'schedule.benachrichtigung_ton_' + a, aus: 'input_boolean.benachrichtigung_aus_' + a, stumm: 'input_boolean.benachrichtigung_stumm_' + a });
function roomRules(hass, area) {
  if (!area || !hass) return { popup: true, sound: true, why: '', swhy: '', ids: null, missing: !area };
  const r = roomIds(area), st = id => (hass.states[id] || {}).state;
  const aus = st(r.aus) === 'on', plan = st(r.sched) === 'off', stumm = st(r.stumm) === 'on', tplan = st(r.schedTon) === 'off';
  return { ids: r, popup: !aus && !plan, sound: !stumm && !tplan, why: aus ? 'Popup manuell aus' : plan ? 'Zeitplan Popup: gerade aus' : '', swhy: stumm ? 'Ton manuell stumm' : tplan ? 'Zeitplan Ton: gerade aus' : '', missing: !hass.states[r.sched] };
}
// Zustand einer Tür aus Sicht dieses Tablets: shown = Popup erscheint hier, sound = Ton kommt hier
function doorStatus(hass, door, area, me) {
  const st = id => (hass.states[id] || {}).state, k = door.key, rr = roomRules(hass, area);
  const ziel = String(st('input_text.klingel_' + k + '_ziel') ?? 'alle').trim();
  // Tür-Auswahl (alle / aus / bestimmte Tablets) gilt für Popup und Ton; Raum-Regeln getrennt für Popup und Ton
  let sel = true, selWhy = '';
  if (ziel === 'aus') { sel = false; selWhy = door.name + ': Benachrichtigung aus'; }
  else if (ziel && ziel !== 'alle' && !NA.includes(ziel) && !ziel.split(',').map(x => x.trim()).includes(me)) { sel = false; selWhy = 'dieses Tablet ist nicht ausgewählt'; }
  const shown = sel && rr.popup, why = !sel ? selWhy : rr.why;
  const ton = st('input_text.klingel_' + k + '_ton'), vol = Number(st('input_number.klingel_' + k + '_lautstarke'));
  let sound = sel, swhy = selWhy;
  if (sel) {
    if (!ton || ton === 'Kein Ton') { sound = false; swhy = 'kein Klingelton'; }
    else if (vol === 0) { sound = false; swhy = 'Lautstärke 0 %'; }
    else if (!rr.sound) { sound = false; swhy = rr.swhy; }
  }
  return { shown, sound, why, swhy };
}
// Symbole: Haus mit Satteldach (Haustür) bzw. Flachdach (Wohnungstür), je mit Klingel; Abzeichen stumm / Anzeige aus
const NOTIFY_BELL = '<path d="M9.7 16.6v-2.1a2.3 2.3 0 0 1 4.6 0v2.1l.9.9H8.8z"/><path d="M11.2 19.3a.9.9 0 0 0 1.6 0"/>';
const NOTIFY_IC = {
  gable: '<path d="M2.5 11.5L12 3.5l9.5 8"/><path d="M5 9.6V21h14V9.6"/>' + NOTIFY_BELL,
  flat: '<path d="M2.5 7h19"/><path d="M4.5 7v14h15V7"/><path d="M4.5 4.5h15V7"/>' + NOTIFY_BELL,
  mute: '<path d="M3 9.5h3.5L11 6v12l-4.5-3.5H3z"/><path d="M15 9.5l5.5 5.5M20.5 9.5L15 15"/>',
  off: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18M9.5 9v10.5"/><path d="M2 2.5l20 19"/>',
};
const notifySvg = (k, cls = '') => '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + NOTIFY_IC[k] + '</svg>';

// Heizungs-Einstellungen, Reiter „Quellen der Karte“ (Klasse RPHeatingSettings steht hinter RPLightSettings)
const HSET_ROWS = [['climate', 'Thermostat', 'Regelt Soll-Temperatur und Modus'], ['current', 'Ist-Temperatur', 'Sensor für die Raumtemperatur'], ['valve', 'Ventilstellung', 'Öffnung des Heizkörperventils in %']];
const HSET_CSS = `<style>
.hsr{display:flex;flex-direction:column;gap:3px;padding:10px 14px;border-radius:11px;cursor:pointer;background:rgba(0,0,0,.25);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.hsr.on{box-shadow:0 0 0 2px #ff8a4c,inset 0 1px 3px rgba(0,0,0,.5)}
.hsr .t{display:flex;justify-content:space-between;font-size:11.5px;letter-spacing:2px;font-weight:700;color:#8a8e96;text-transform:uppercase}
.hsr .t i{font-style:normal;letter-spacing:1px;color:#ff8a4c}
.hsr b{font-size:14px;color:#e8e9ec;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hsr small{font-size:11px;color:#8a8e96;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hsq{height:34px;border-radius:9px;border:0;outline:0;padding:0 12px;font:500 13px Rajdhani,sans-serif;letter-spacing:1px;color:#e8e9ec;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 5px rgba(0,0,0,.6)}
.hsl{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:6px;padding-right:4px}
.hsl .hpi{padding:8px 12px;border-radius:9px;cursor:pointer;background:rgba(0,0,0,.25);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.hsl .hpi b{display:block;font-size:13px;color:#e8e9ec;font-weight:600}.hsl .hpi small{font-size:11px;color:#8a8e96}
.hsl .hpi.on{box-shadow:0 0 0 2px #ff8a4c,inset 0 1px 3px rgba(0,0,0,.5)}
.hsl .hpg{font-size:11px;letter-spacing:2px;color:#8a8e96;text-transform:uppercase;margin-top:4px}
</style>`;
// ---------------------------------------------------------------- Licht-Einstellungen (Einstellungsfenster)
// Reiter Manuell · Bewegungserkennung · Zeitsteuerung · Helligkeitssteuerung.
// Manuell: die 8 Favoriten-Tasten der Licht-Karte – je Taste Weiß (Kelvin) oder Farbe (Farbton + Sättigung).
// Gespeichert je Raum in input_text.licht_favoriten_<raum> als „k2700,k4000,h200s80,…“ (die Licht-Karte liest daraus).
const FAV_DEF = [{ kelvin: 2700 }, { kelvin: 4000 }, { kelvin: 6000 }, { hs: [0, 90] }, { hs: [140, 80] }, { hs: [195, 90] }, { hs: [268, 70] }, { hs: [320, 85] }];
const favEnc = l => l.map(f => f.kelvin ? 'k' + Math.round(f.kelvin) : `h${Math.round(f.hs[0]) % 360}s${Math.round(f.hs[1])}`).join(',');
const favDec = s => {
  const out = String(s || '').split(',').map(t => {
    let m = /^k(\d{4,5})$/.exec(t.trim()); if (m) return { kelvin: +m[1] };
    m = /^h(\d{1,3})s(\d{1,3})$/.exec(t.trim()); return m ? { hs: [+m[1] % 360, Math.min(100, +m[2])] } : null;
  });
  return out.length && out.every(Boolean) ? out : null;
};
const favId = raum => raum ? 'input_text.licht_favoriten_' + raum : null;
const favCss = f => f.kelvin ? kCss(f.kelvin) : hsCss(f.hs[0], f.hs[1]);
const favTxt = f => f.kelvin ? `${f.kelvin} K` : `${hueName(f.hs[0])} · ${Math.round(f.hs[1])} %`;
const LSET_TABS = ['Manuell', 'Bewegungserkennung', 'Zeitsteuerung', 'Helligkeitssteuerung'];
const LSET_CSS = `<style>
.lset{display:flex;flex-direction:column;gap:14px;height:100%}
.lseg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:4px;border-radius:11px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05)}
.lsg{position:relative;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;color:#9a9fa8;cursor:pointer;white-space:nowrap}
.lsg.on{color:#f0f1f3;background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,0 4px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12)}
.lsg.on::after{content:"";position:absolute;left:18px;right:18px;bottom:3px;height:2px;border-radius:1px;background:var(--acc);box-shadow:0 0 6px var(--acc)}
.lpg{flex:1;min-height:0;display:flex;gap:22px}
.lpg[hidden]{display:none}
#lpg0,#lpg1,#lpg2,#lpg3{flex:1 1 auto;height:300px}
.lcol{display:flex;flex-direction:column;gap:10px;min-width:0}
.lfav{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.lfk{position:relative;height:74px;border-radius:10px;cursor:pointer;background:linear-gradient(180deg,#34363b,#232428);box-shadow:0 4px 0 #0d0d0f,0 6px 10px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 6px 8px;transition:transform .1s,box-shadow .1s}
.lfk::before{content:"";position:absolute;left:10px;right:10px;top:10px;height:22px;border-radius:5px;background:var(--c);box-shadow:0 0 14px var(--c),inset 0 1px 2px rgba(255,255,255,.6),inset 0 -2px 4px rgba(0,0,0,.25)}
.lfk b{font-size:10.5px;letter-spacing:1.2px;color:#c9ccd2;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.lfk small{position:absolute;left:8px;top:-1px;font-size:9px;color:#979ca5}
.lfk.sel{transform:translateY(3px);box-shadow:0 1px 0 #0d0d0f,0 0 0 2px var(--acc),0 0 16px rgba(255,195,77,.35),inset 0 1px 0 rgba(255,255,255,.1)}
.lhint{font-size:11px;color:#8a8e96;letter-spacing:.5px;line-height:1.5}
.llamp{display:grid;grid-template-columns:1fr 1fr auto;gap:8px}
.llk{display:flex;flex-direction:column;gap:2px;min-width:0;padding:7px 10px;border-radius:9px;cursor:pointer;background:linear-gradient(180deg,#2a2c31,#1d1e22);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.08)}
.llk:active{transform:translateY(1px)}
.llk small{font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;color:#979ca5}
.llk small b.on{color:var(--acc);font-weight:700}
.llk span{font:600 13px Rajdhani,sans-serif;letter-spacing:.5px;color:#d7dae0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.llk.rs span{color:#8a8e96}
.lmsg{font-size:11.5px;min-height:16px;letter-spacing:.5px}
.ledit{flex:1}
.lrow{display:flex;align-items:center;gap:14px}
.lrow .slot{flex:1}
.lrow .lcd{width:118px;text-align:center;font-size:15px;padding:8px 6px;color:var(--acc)}
.hueg{background:linear-gradient(90deg,#ff3b3b,#ffb03b 14%,#f4ff3b 28%,#3bff6f 42%,#3bf0ff 56%,#3b6fff 70%,#b43bff 84%,#ff3b3b)}
.lsw{width:96px;height:96px;flex:none;border-radius:50%;background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.85),rgba(255,255,255,0) 45%),var(--c);box-shadow:0 0 30px var(--c),0 0 0 6px #1a1b1e,0 0 0 7px #000,0 8px 18px rgba(0,0,0,.8)}
.lbtns{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:auto}
.lsoon{flex:1;display:grid;place-items:center;text-align:center;color:#979ca5;font-size:13px;letter-spacing:1px;border-radius:12px;background:rgba(0,0,0,.2);box-shadow:inset 0 2px 6px rgba(0,0,0,.5)}
.lsoon b{display:block;color:#c9ccd2;font-size:15px;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.lset{position:relative}
.lmo{flex:1;min-width:0;display:flex;gap:18px}
.lmrail{width:194px;flex:none;display:flex;flex-direction:column;gap:5px;padding:6px;border-radius:12px;background:linear-gradient(180deg,#141518,#1c1d21);box-shadow:inset 0 2px 8px #000,0 1px 0 rgba(255,255,255,.06)}
.lmls{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:4px}
.lmls .hk{height:28px;font-size:10.5px;letter-spacing:1.2px}
.lmls.dim{opacity:.35;pointer-events:none}
.lmsec{position:relative;height:36px;border-radius:9px;display:flex;align-items:center;padding:0 12px 0 16px;color:#9a9fa8;font-size:11.5px;letter-spacing:1.6px;font-weight:700;text-transform:uppercase;cursor:pointer;white-space:nowrap}
.lmsec.on{color:#f0f1f3;background:linear-gradient(180deg,#35373c,#25262a);box-shadow:0 2px 6px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)}
.lmsec.on::after{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:2px;background:var(--acc);box-shadow:0 0 8px var(--acc)}
.lmsec small{margin-left:auto;font-size:9px;letter-spacing:1px;color:#8c919a}
.lmbody{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px 28px;align-content:start;overflow-y:auto;touch-action:pan-y;padding:2px 4px 6px 0}
.lmcol{display:flex;flex-direction:column;gap:4px;min-width:0}
.lmh{font:700 10px Rajdhani,sans-serif;letter-spacing:2.2px;color:#979ca5;text-transform:uppercase;margin:8px 0 2px}
.lmh:first-child{margin-top:0}
.lmr{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:32px}
.lmr>span{font-size:12.5px;color:#a9adb5;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.lmr.sub>span{padding-left:14px;color:#9a9fa8}
.lmr .hk{height:26px;font-size:10.5px;letter-spacing:1.2px;padding:0 10px;flex:none}
.lmseg{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
.lmseg .hk{padding:0 8px}
.lmr.stack{flex-direction:column;align-items:stretch;gap:5px;padding:2px 0 4px}
.lmr.stack .lmseg{justify-content:flex-start}
.lmst{display:flex;align-items:center;gap:5px;flex:none}
.lmst .hk{width:28px;padding:0;font-size:16px;letter-spacing:0;touch-action:none}
.lmst .dlcd{height:26px;min-width:72px;font-size:15px;color:var(--acc)}
.lmro{height:26px;min-width:72px;padding:0 10px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--acc);border-radius:8px}
.lmin{height:26px;width:96px;border:0;outline:0;border-radius:7px;padding:0 8px;font:500 14px 'Share Tech Mono',monospace;color:var(--acc);background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.07);color-scheme:dark}
.lmcolr{position:relative;width:64px;height:26px;border-radius:7px;background:var(--c);box-shadow:0 0 12px var(--c),inset 0 1px 2px rgba(255,255,255,.5);cursor:pointer;flex:none}
.lmcolr input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.lmen{max-width:260px;justify-content:flex-start!important}
.lmen span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:none;letter-spacing:.4px}
.lmmsg{grid-column:1/-1;font-size:12px;color:#8a8e96;line-height:1.5;padding:18px;text-align:center}
.lmpk{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:14px;background:rgba(17,18,21,.97);box-shadow:0 0 0 1px rgba(255,255,255,.06)}
.lmpk[hidden]{display:none}
.lmpk .top{display:flex;gap:10px;align-items:center}
.lmpk .top b{font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#d7d9de;white-space:nowrap}
.lmpk .top input{flex:1;height:32px;border:0;outline:0;border-radius:8px;padding:0 10px;font:500 14px Rajdhani,'Segoe UI',sans-serif;color:#e2e4e8;background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000}
.lmlist{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;display:flex;flex-direction:column;gap:6px;padding:4px;border-radius:10px;background:linear-gradient(180deg,#141518,#1a1b1f);box-shadow:inset 0 2px 6px #000,0 1px 0 rgba(255,255,255,.06)}
.lmrow{display:flex;align-items:center;gap:10px;min-height:42px;padding:4px 10px;border-radius:8px;cursor:pointer;background:linear-gradient(180deg,#2a2c31,#202125);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.07)}
.lmrow .chk{width:18px;height:18px;flex:none;border-radius:5px;background:#141518;box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.08);display:grid;place-items:center}
.lmrow.on .chk::after{content:"";width:10px;height:10px;border-radius:3px;background:var(--acc);box-shadow:0 0 8px var(--acc)}
.lmrow .dn{flex:1;min-width:0}
.lmrow .dn b{display:block;font-size:13.5px;color:#d7d9de;letter-spacing:.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lmrow .dn small{display:block;font-size:10.5px;color:#979ca5;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.lmempty{padding:14px;font-size:12px;color:#979ca5;text-align:center}
.lmpk .bt{display:flex;justify-content:flex-end;gap:10px}
.lmpk .bt .hk{height:34px;padding:0 18px}
.zsrail{width:236px}
.zslist{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;display:flex;flex-direction:column;gap:4px}
.zsit{position:relative;min-height:42px;border-radius:9px;display:flex;align-items:center;gap:10px;padding:4px 10px 4px 14px;cursor:pointer}
.zsit.on{background:linear-gradient(180deg,#35373c,#25262a);box-shadow:0 2px 6px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)}
.zsit.on::after{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:2px;background:var(--acc);box-shadow:0 0 8px var(--acc)}
.zsit .zsd{width:8px;height:8px;flex:none;border-radius:50%;background:#3a3c41;box-shadow:inset 0 1px 2px #000}
.zsit .zsd.rdy{background:#3ddc84;box-shadow:0 0 8px #3ddc84}.zsit .zsd.act{background:#ff9f2e;box-shadow:0 0 8px #ff9f2e}
.zsit .dn{flex:1;min-width:0}
.zsit .dn b{display:block;font-size:12.5px;letter-spacing:.8px;color:#d7d9de;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zsit .dn small{display:block;font-size:10px;letter-spacing:.4px;color:#979ca5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zsit.off .dn b{color:#9a9fa8}
.zsrail>.hk{height:30px;font-size:10.5px;letter-spacing:1.2px;flex:none;margin-top:4px}
.zsed{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.zshd{display:flex;gap:10px;align-items:center}
.zsname{flex:1;min-width:0;height:32px;border-radius:8px;padding:0 12px;display:flex;align-items:center;font:600 15px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.6px;color:#e2e4e8;background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.07);cursor:text;white-space:nowrap;overflow:hidden}
.zsname::after{content:"✎";margin-left:auto;padding-left:10px;color:#979ca5;font-size:13px}
.zshd .hk{height:30px;font-size:10.5px;letter-spacing:1.2px;padding:0 10px;flex:none}
.zsseg{display:flex;gap:5px;padding:3px;border-radius:9px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 5px rgba(0,0,0,.6)}
.zsseg .lsg{height:26px;padding:0 10px;font-size:10.5px;letter-spacing:1.2px}
.zsed .lmbody{flex:1}
.zsft{display:flex;gap:10px;align-items:center}
.zsft .lmsg{flex:1;min-width:0}
.zsft .hk{height:30px;padding:0 14px;font-size:10.5px;letter-spacing:1.2px}
.zsday{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;padding:2px 0 4px}
.zsday .hk{height:28px;padding:0;font-size:11px;letter-spacing:.8px}
.zsslot{display:flex;align-items:center;gap:7px;min-height:32px}
.zsslot b{font-size:10px;letter-spacing:1.6px;color:#979ca5;font-weight:700}
.zsslot .lmin{width:82px}
.zsslot .hk{height:26px;font-size:10px;letter-spacing:1px;padding:0 8px;flex:none}
.zsslot .lmro{min-width:82px;height:26px;color:#8c919a}
.zslamps{font-size:11px;color:#9a9fa8;letter-spacing:.4px;line-height:1.55;padding:0 0 4px 14px}
.lkb{justify-content:flex-end;gap:8px}
.kbv{height:44px;border-radius:9px;padding:0 14px;display:flex;align-items:center;font:600 21px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.8px;color:#f0f1f3;background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.07);white-space:pre;overflow:hidden}
.kbv i{width:2px;height:24px;margin-left:2px;background:var(--acc);animation:kbc 1s steps(1) infinite}
@keyframes kbc{50%{opacity:0}}
.kbv small{margin-left:auto;font:500 11px Rajdhani,sans-serif;color:#979ca5;letter-spacing:1px}
.kbd{display:flex;flex-direction:column;gap:7px}
.kbr{display:flex;gap:7px}
.kbr .hk{flex:1;height:42px;padding:0;font-size:18px;letter-spacing:0;text-transform:none;color:#d7d9de}
.kbr .hk.sp{flex:5}.kbr .hk.w2{flex:1.6;font-size:11px;letter-spacing:1.2px;text-transform:uppercase}
</style>`;
// Bewegungs-Lichtsteuerung: Abschnitte, Tageszeiten-Profile, Anzeige "eingeschaltet durch"
// (hausweite Werte – Tageszeiten, Quellen – stehen in rp-house-settings auf der Seite "Allgemein")
const LMO_SECS = [['gen', 'Allgemein'], ['cond', 'Bedingungen'], ['light', 'Licht'], ['off', 'Ausschalten'], ['room', 'Raum', 'beide']];
// Überblendzeit (Sekunden) des gerade gültigen Bewegungs-Profils von Licht L im Raum r
// (input_number.<r>_light_motion_<L>_cfg_<profil>_fade_on|off; Profil = Tageszeit, wenn dort eingeschaltet, sonst Allgemein)
const lmoSlotOf = (hass, b) => { const st = id => ((hass && hass.states[id]) || {}).state, d = st('sensor.haus_sys_daytime');
  return st(`input_boolean.${b}_cfg_daytime`) === 'on' && ['morning', 'midday', 'afternoon', 'evening', 'night'].includes(d) ? d : 'default'; };
const fadeOf = (hass, r, L, kind) => { if (!r) return null; const b = `${r}_light_motion_${L}`, s = hass && hass.states[`input_number.${b}_cfg_${lmoSlotOf(hass, b)}_fade_${kind}`], v = s ? Number(s.state) : NaN; return isNaN(v) ? null : Math.max(0, v); };
const withFade = (hass, r, L, kind, data) => { const t = fadeOf(hass, r, L, kind); return t == null ? data : { ...data, transition: t }; };
const LMO_SLOTS = [['default', 'Allgemein'], ['morning', 'Morgens'], ['midday', 'Mittags'], ['afternoon', 'Nachmittags'], ['evening', 'Abends'], ['night', 'Nachts']];
const LMO_SRC = { off: 'Aus', motion: 'Bewegung', manual: 'Hand', manual_adjust: 'Hand (gedimmt)', schedule: 'Zeitsteuerung', lux: 'Helligkeit', simulation: 'Simulation', other: 'Andere' };
const lmoTimer = s => { const r = auRun(s); return r ? mmss(r.left) : '–'; };
// Zeitsteuerung (Integration light_schedule): Profile stehen im Attribut profiles von sensor.<raum>_light_schedule,
// gespeichert wird per WebSocket light_schedule/save | delete | test.
const zsId = r => `sensor.${r}_light_schedule`;
const ZS_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const ZS_SECS = [['time', 'Zeiten'], ['cond', 'Bedingungen'], ['light', 'Licht']];
const ZS_DEF = { name: 'Neues Profil', enabled: true, independent: false, days: [0, 1, 2, 3, 4, 5, 6], date_enabled: false, date_from: '12-01', date_to: '12-31',
  slots: [{ on: '18:00', off: '22:00' }], lights: [], presence: 'always', alarm: 'always', lux_below_enabled: false, lux_below: 50,
  lux_above_enabled: false, lux_above: 5, lux_source: 'room', mode: 'color_temp', brightness: 80, kelvin: 3000, color: '#FFB060', transition: 1, transition_off: 1 };
const ZS_NUM = { brightness: [1, 100, 1, ' %'], kelvin: [2000, 6500, 100, ' K'], lux_below: [0, 5000, 5, ' lx'], lux_above: [0, 5000, 5, ' lx'], transition: [0, 60, .5, ' s'], transition_off: [0, 60, .5, ' s'] };
// Zeitraum als Tag im (Schalt-)Jahr, damit −/+ über Monats- und Jahresgrenzen läuft
const zsMdIdx = md => { const [m, d] = String(md).split('-').map(Number); return Math.round((Date.UTC(2024, m - 1, d) - Date.UTC(2024, 0, 1)) / 864e5); };
const zsIdxMd = i => { const x = new Date(Date.UTC(2024, 0, 1) + (((i % 366) + 366) % 366) * 864e5); return String(x.getUTCMonth() + 1).padStart(2, '0') + '-' + String(x.getUTCDate()).padStart(2, '0'); };
const zsMdTxt = md => { const [m, d] = String(md).split('-'); return `${d}.${m}.`; };
const zsDaysTxt = d => { const k = [...d].sort().join(''); return k === '0123456' ? 'täglich' : k === '01234' ? 'Mo–Fr' : k === '56' ? 'Sa+So' : !d.length ? 'kein Tag' : d.map(i => ZS_DAYS[i]).join(' '); };
const zsWhen = iso => {
  const t = new Date(iso), n = new Date(), hm = t.toTimeString().slice(0, 5);
  const dd = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
  const dm = `${String(t.getDate()).padStart(2, '0')}.${String(t.getMonth() + 1).padStart(2, '0')}. `;
  return (dd === 0 ? 'heute ' : dd === 1 ? 'morgen ' : dd < 7 ? ZS_DAYS[(t.getDay() + 6) % 7] + ' ' : dm) + hm;
};
// Helligkeitssteuerung (Integration light_lux): Profile in sensor.<raum>_light_lux, WebSocket light_lux/save | delete | test.
// Gegenstück zur Zeitsteuerung: die Helligkeit schaltet, die Zeitfenster (von – bis) begrenzen, wann das Profil reagiert.
const luxId = r => `sensor.${r}_light_lux`;
const HS_SECS = [['time', 'Zeiten'], ['lux', 'Helligkeit'], ['cond', 'Bedingungen'], ['light', 'Licht']];
const HS_DEF = { name: 'Neues Profil', enabled: true, independent: false, days: [0, 1, 2, 3, 4, 5, 6], date_enabled: false, date_from: '12-01', date_to: '12-31',
  slots: [{ from: '06:00', to: '23:00' }], lux_source: 'room', lux_on: 30, delay_on: 60, off_bright: true, lux_off: 80, delay_off: 300, off_at_end: true,
  lights: [], presence: 'always', alarm: 'always', mode: 'color_temp', brightness: 80, kelvin: 3000, color: '#FFB060', transition: 2, transition_off: 2 };
const HS_NUM = { brightness: [1, 100, 1, ' %'], kelvin: [2000, 6500, 100, ' K'], lux_on: [0, 5000, 5, ' lx'], lux_off: [0, 5000, 5, ' lx'],
  delay_on: [0, 3600, 10, 'mmss'], delay_off: [0, 7200, 30, 'mmss'], transition: [0, 60, .5, ' s'], transition_off: [0, 60, .5, ' s'] };
// Beide Profil-Editoren (Reiter Zeitsteuerung / Helligkeitssteuerung) – Unterschiede stehen hier
const fxClean = d => { const { lamps, next, running, waiting, lux, lux_entity, window: w, ...p } = d; return p; };
const FX = {
  zs: { ws: 'light_schedule', name: 'Zeitsteuerung', sid: zsId, def: ZS_DEF, secs: ZS_SECS, num: ZS_NUM, clean: fxClean,
    stat: p => {
      if (!p.enabled) return ['', 'inaktiv'];
      if (!(p.lamps || []).length) return ['rdy', 'keine Lampen gewählt'];
      const run = (p.running || [])[0];
      if (run) return ['act', run.until ? 'an bis ' + zsWhen(run.until).replace('heute ', '') : 'eingeschaltet'];
      if (p.waiting) return ['rdy', 'wartet · ' + p.waiting];
      return ['rdy', p.next ? (p.next.action === 'on' ? 'Ein ' : 'Aus ') + zsWhen(p.next.at) : 'kein Termin'];
    } },
  hs: { ws: 'light_lux', name: 'Helligkeitssteuerung', sid: luxId, def: HS_DEF, secs: HS_SECS, num: HS_NUM, clean: fxClean,
    stat: p => {
      if (!p.enabled) return ['', 'inaktiv'];
      if (!(p.lamps || []).length) return ['rdy', 'keine Lampen gewählt'];
      const lx = p.lux != null ? ` · ${Math.round(p.lux)} lx` : '', run = (p.running || [])[0], w = p.window;
      if (run) return ['act', (run.until ? 'an bis ' + zsWhen(run.until).replace('heute ', '') : 'eingeschaltet') + lx];
      if (w && w.open) return ['rdy', p.waiting || 'bereit' + lx];
      return ['rdy', w ? 'ab ' + zsWhen(w.at) : 'kein Zeitfenster'];
    } },
};
// Bildschirmtastatur (QWERTZ) – das Android-System-Keyboard verdeckt sonst die halbe Seite
const KB_ROWS = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'ß'], ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'], ['#sh', 'y', 'x', 'c', 'v', 'b', 'n', 'm', '-', '#bs']];
class RPLightSettings extends RPModule {
  get meta() { return this.variants().full; }
  variants() { return { full: { bw: 1000, mh: 392, fw: false, fh: true, maxh: 392 } }; }
  static getStubConfig() { return {}; }
  norm(c) {
    const lights = c.lights || {};
    return { raum: c.raum || null, color: c.color || '#ffc34d', light: c.light || (lights.primary && lights.primary.entity) || null, favorites: Array.isArray(c.favorites) && c.favorites.length ? c.favorites : FAV_DEF,
      y: { primary: c.light || (lights.primary && lights.primary.entity) || null, secondary: (lights.secondary && lights.secondary.entity) || null } };
  }
  _area() { return raumOf(this, this._c); }
  _fid() { return favId(this._area()); }
  // Lampen der Licht-Karte: gewählt (Helfer) vor YAML
  _lamps() {
    const s = lampSel(this._hass, this._area()), y = this._c.y || {};
    return { primary: s.primary || y.primary || null, secondary: s.secondary === '-' ? null : s.secondary || y.secondary || null, how: { primary: s.primary ? 'gewählt' : 'YAML', secondary: s.secondary ? 'gewählt' : 'YAML' } };
  }
  _light() { return this._lamps().primary; }
  watch() { const r = this._area(), lp = this._c.y ? this._lamps() : {}; return [this._fid(), lampId(r), lp.primary, lp.secondary, ...this._moIds(), ...(r ? [zsId(r), luxId(r)] : [])]; }
  // gespeicherte Favoriten (Helfer) oder Standard aus der Konfiguration
  _stored() { const s = this._st(this._fid()); return (s && favDec(s.state)) || this._c.favorites; }
  html() {
    const c = this._c, tab = this._tab || 0;
    return `${LSET_CSS}<div class="lset" id="ls" style="--acc:${c.color}">
      <div class="lseg">${LSET_TABS.map((t, i) => `<div class="lsg${i === tab ? ' on' : ''}" id="lsg${i}" data-act="tab:${i}">${t}</div>`).join('')}</div>
      <div class="lpg" id="lpg0"${tab ? ' hidden' : ''}>
        <div class="lcol" style="width:440px;flex:none">
          <div class="cap eng">Favoriten der Licht-Karte<span style="color:#979ca5;letter-spacing:1px;margin-left:10px">· Tippen = bearbeiten</span></div>
          <div class="lfav" id="lfav">${Array.from({ length: 8 }, (_, i) => `<div class="lfk" id="lfk${i}" data-act="sel:${i}"><small>${i + 1}</small><b id="lfkt${i}">--</b></div>`).join('')}</div>
          <div class="lhint" id="lhint"></div>
          <div class="cap eng" style="margin-top:2px">Lampen der Licht-Karte<span style="color:#979ca5;letter-spacing:1px;margin-left:10px">· Tippen = wählen</span></div>
          <div class="llamp" id="llamp"></div>
        </div>
        <div class="lcol ledit">
          <div class="cap eng" id="lhead">Favorit 1</div>
          <div class="lrow"><div class="keys2" style="flex:1"><div class="hk" id="lm-w" data-act="mode:w" style="--c:var(--acc)"><i></i>Weiß</div><div class="hk" id="lm-c" data-act="mode:c" style="--c:var(--acc)"><i></i>Farbe</div></div><div class="lsw" id="lsw"></div></div>
          <div id="lw-w"><div class="sect cap eng">Farbtemperatur</div><div class="lrow"><div class="slot" id="ls-k"><div class="groove tempg"></div><div class="ticks"></div><div class="fader"></div></div><div class="lcd" id="lv-k">--</div></div></div>
          <div id="lw-c" hidden>
            <div class="sect cap eng">Farbton</div><div class="lrow"><div class="slot" id="ls-h"><div class="groove hueg"></div><div class="ticks"></div><div class="fader"></div></div><div class="lcd" id="lv-h">--</div></div>
            <div class="sect cap eng">Sättigung</div><div class="lrow"><div class="slot" id="ls-s"><div class="groove" id="lg-s"></div><div class="ticks"></div><div class="fader"></div></div><div class="lcd" id="lv-s">--</div></div>
          </div>
          <div class="lmsg" id="lmsg"></div>
          <div class="lbtns"><div class="hk" data-act="test"><i></i>Am Licht testen</div><div class="hk" id="lsave" data-act="save" style="--c:#3ddc84"><i></i>Speichern</div><div class="hk" data-act="reset"><i></i>Standard</div></div>
        </div>
      </div>
      <div class="lpg" id="lpg1"${tab !== 1 ? ' hidden' : ''}><div class="lmo"><div class="lmrail" id="lmrail"></div><div class="lmbody" id="lmbody"></div></div></div>
      <div class="lpg" id="lpg2"${tab !== 2 ? ' hidden' : ''}><div class="lmo"><div class="lmrail zsrail" id="zsrail"></div><div class="zsed" id="zsed"></div></div></div>
      <div class="lpg" id="lpg3"${tab !== 3 ? ' hidden' : ''}><div class="lmo"><div class="lmrail zsrail" id="hsrail"></div><div class="zsed" id="hsed"></div></div></div>
      <div class="lmpk" id="lmpk" hidden></div>
      <div class="lmpk lkb" id="lkb" hidden></div>
    </div>`;
  }
  bind() {
    const drag = (el, cb) => {
      if (!el) return;
      const ap = ev => { const r = el.getBoundingClientRect(); cb(clamp((ev.clientX - r.left) / r.width, 0, 1)); this._paint(); };
      el.addEventListener('pointerdown', ev => {
        el.setPointerCapture(ev.pointerId); ev.preventDefault(); ap(ev);
        const mv = e2 => ap(e2), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    };
    drag(this.$('ls-k'), f => { this._cur().kelvin = Math.round((2000 + f * 4500) / 50) * 50; this._dirty = true; });
    drag(this.$('ls-h'), f => { this._cur().hs[0] = Math.round(f * 359); this._dirty = true; });
    drag(this.$('ls-s'), f => { this._cur().hs[1] = Math.round(f * 100); this._dirty = true; });
    this._moBind(); this._zsBind();
  }
  _cur() { return this._edit[this._sel || 0]; }
  update() {
    // gespeicherte Werte übernehmen, solange nichts ungespeichert bearbeitet wird
    if (!this._edit || !this._dirty) this._edit = this._stored().map(f => f.kelvin ? { kelvin: f.kelvin } : { hs: [f.hs[0], f.hs[1]] });
    while (this._edit.length < 8) this._edit.push(Object.assign({}, FAV_DEF[this._edit.length]));
    // Sprung aus der Licht-Karte (Funktionstaste): Reiter Bewegung + gewähltes Licht
    const jump = window.__rpLightJump; if (jump) { window.__rpLightJump = null; if (jump.light) this._moL = jump.light; if (jump.fn === 'motion') this.act('tab', '1'); if (jump.fn === 'schedule') this.act('tab', '2'); if (jump.fn === 'lux') this.act('tab', '3'); }
    this._paint(); this._lampPaint(); this._moPaint(); this._zsPaint();
  }
  _paint() {
    const $ = this.$, e = this._edit; if (!e || !$('lfav')) return;
    const sel = this._sel || 0, f = e[sel], fid = this._fid(), has = !!this._st(fid), admin = !!(this._hass && this._hass.user && this._hass.user.is_admin);
    e.forEach((x, i) => { const k = $('lfk' + i); k.style.setProperty('--c', favCss(x)); k.classList.toggle('sel', i === sel); $('lfkt' + i).textContent = favTxt(x); });
    $('lhead').textContent = `Favorit ${sel + 1} · ${favTxt(f)}`;
    $('lm-w').classList.toggle('on', !!f.kelvin); $('lm-c').classList.toggle('on', !f.kelvin);
    $('lw-w').hidden = !f.kelvin; $('lw-c').hidden = !!f.kelvin;
    $('lsw').style.setProperty('--c', favCss(f));
    if (f.kelvin) { $('ls-k').querySelector('.fader').style.left = clamp((f.kelvin - 2000) / 4500, 0, 1) * 100 + '%'; $('lv-k').textContent = f.kelvin + ' K'; }
    else {
      $('ls-h').querySelector('.fader').style.left = f.hs[0] / 359 * 100 + '%'; $('lv-h').textContent = `${Math.round(f.hs[0])}° ${hueName(f.hs[0])}`;
      $('ls-s').querySelector('.fader').style.left = f.hs[1] + '%'; $('lv-s').textContent = Math.round(f.hs[1]) + ' %';
      $('lg-s').style.background = `linear-gradient(90deg,#fff,${hsCss(f.hs[0], 100)})`;
    }
    $('lsave').classList.toggle('on', !!this._dirty);
    this._html($('lhint'), !this._area() ? 'Kein Raum-Kürzel – Favoriten können nicht gespeichert werden (Panel-Option <b>raum:</b>).'
      : has ? `Gespeichert in <b>${fid}</b>. Die Licht-Karte übernimmt Änderungen sofort.`
        : admin ? `Helfer <b>${fid}</b> fehlt noch. <span class="hk sm" data-act="mkhelper" style="display:inline-flex;height:24px;padding:0 10px;--c:#3ddc84;margin-left:6px"><i></i>Helfer anlegen</span>`
          : `Helfer <b>${fid}</b> fehlt – bitte als Admin anlegen.`);
  }
  _lampPaint() {
    const el = this.$('llamp'); if (!el) return;
    const lp = this._lamps(), nm = id => { const s = id && this._st(id); return s ? (s.attributes.friendly_name || id) : id || '— keins —'; };
    const key = (k, n) => `<div class="llk" data-act="lamp:${k}"><small>${n} · ${lp.how[k] === 'gewählt' ? '<b class="on">gewählt</b>' : 'aus YAML'}</small><span>${escH(nm(lp[k]))}</span></div>`;
    this._html(el, key('primary', 'Primär') + key('secondary', 'Sekundär') + (lp.how.primary === 'gewählt' || lp.how.secondary === 'gewählt' ? '<div class="llk rs" data-act="lamp:reset"><small>zurück</small><span>Standard (YAML)</span></div>' : ''));
  }
  // Lampe der Licht-Karte wählen (leer = Primär aus YAML · Sekundär keins), Standard = Helfer leeren
  async _lampPick(k) {
    const r = this._area(); if (!r) { this._msg('Kein Raum-Kürzel (Panel-Option raum:).', false); return; }
    const save = async m => { try { await lampWrite(this, r, m); this._msg('Lampen gespeichert – die Licht-Karte übernimmt sie sofort.'); } catch (e) { this._msg('Fehler: ' + ((e && e.message) || e), false); } };
    if (k === 'reset') { await save({}); return; }
    const cur = this._lamps()[k];
    this._pkShow({ l: k === 'primary' ? 'Primäres Licht der Karte' : 'Sekundäres Licht der Karte', dom: ['light', 'switch', 'group'], multi: false }, cur ? [cur] : [], sel => {
      const m = { ...lampSel(this._hass, r) }, v = sel[0];
      if (v) m[k] = v; else if (k === 'secondary') m.secondary = '-'; else delete m.primary;
      save(m);
    });
  }
  _msg(t, ok = true) { const m = this.$('lmsg'); if (m) { m.textContent = t; m.style.color = ok ? '#3ddc84' : '#ff8a8a'; } clearTimeout(this._mt); this._mt = setTimeout(() => { const m2 = this.$('lmsg'); if (m2) m2.textContent = ''; }, 4000); }
  act(cmd, arg) {
    if (cmd.startsWith('mo')) { this._moAct(cmd, arg); return; }
    if (cmd.startsWith('zs') || cmd.startsWith('hs')) { this._zsAct(cmd, arg); return; }
    if (cmd === 'lamp') { this._lampPick(arg); return; }
    if (cmd === 'kb') { this._kbKey(arg); return; }
    if (cmd === 'tab') { this._tab = +arg; LSET_TABS.forEach((_, i) => { this.$('lsg' + i).classList.toggle('on', i === this._tab); this.$('lpg' + i).hidden = i !== this._tab; }); return; }
    if (!this._edit) return;
    const f = this._cur();
    if (cmd === 'sel') { this._sel = +arg; this._paint(); return; }
    if (cmd === 'mode') {
      if (arg === 'w' && !f.kelvin) { delete f.hs; f.kelvin = 3000; this._dirty = true; }
      if (arg === 'c' && f.kelvin) { delete f.kelvin; f.hs = [30, 80]; this._dirty = true; }
      this._paint(); return;
    }
    if (cmd === 'test') {
      const lt = this._light();
      if (!lt) { this._msg('Keine Lampe bekannt (Licht-Karte im Panel fehlt).', false); return; }
      this._call('light', 'turn_on', f.kelvin ? { entity_id: lt, color_temp_kelvin: f.kelvin } : { entity_id: lt, hs_color: f.hs });
      return;
    }
    if (cmd === 'reset') { this._edit = this._c.favorites.map(x => x.kelvin ? { kelvin: x.kelvin } : { hs: [x.hs[0], x.hs[1]] }); this._dirty = true; this._paint(); this._msg('Standardwerte geladen – zum Übernehmen „Speichern“.'); return; }
    if (cmd === 'save') {
      const fid = this._fid();
      if (!this._st(fid)) { this._msg('Helfer fehlt – zuerst anlegen.', false); return; }
      this._call('input_text', 'set_value', { entity_id: fid, value: favEnc(this._edit) }).then(() => { this._dirty = false; this._paint(); this._msg('Favoriten gespeichert.'); });
      return;
    }
    if (cmd === 'mkhelper') this._mkHelper();
  }
  // ================================================================ Reiter "Bewegungserkennung"
  // Alle Werte liegen in den Helfern der Bewegungs-Lichtsteuerung (Pakete light_motion_*.yaml).
  // Zeilen sind Daten: _moRows() beschreibt jede Seite, _moPaint() zeichnet, _moAct()/_moBind() schreiben.
  _moIds() {
    const r = this._area(); if (!r) return [];
    const ids = new Set(['sensor.haus_sys_daytime']);
    for (const L of ['primary', 'secondary']) for (const sec of LMO_SECS) for (const row of this._moRows(sec[0], r, L, true)) {
      if (row.e) ids.add(row.e); (row.w || []).forEach(x => ids.add(x));
    }
    return [...ids];
  }
  _moRows(sec, r, L, all) {
    const b = `${r}_light_motion_${L}`, rb = `${r}_light_motion`, st = id => (this._st(id) || {}).state;
    const show = c => all || c;
    const S = LMO_SLOTS, rows = [];
    const add = (o, c = true) => { if (show(c)) rows.push(o); };
    if (sec === 'gen') {
      add({ k: 'head', l: 'Licht' });
      add({ k: 'bool', e: `input_boolean.${b}_cfg_enabled`, l: 'Bewegungssteuerung aktiv' });
      add({ k: 'ents', e: `input_text.${b}_cfg_members`, l: 'Lampen', dom: ['light', 'switch'], multi: true });
      add({ k: 'head', l: 'Nachlauf' });
      add({ k: 'num', e: `input_number.${b}_cfg_off_delay`, l: 'Aus nach (allgemein)', fmt: 'mmss' });
      add({ k: 'bool', e: `input_boolean.${b}_cfg_off_delay_by_daytime`, l: 'Nachlaufzeit nach Tageszeit' });
      for (const [k, n] of S.slice(1)) add({ k: 'num', e: `input_number.${b}_cfg_${k}_off_delay`, l: n + ' aus nach', fmt: 'mmss', sub: true }, st(`input_boolean.${b}_cfg_off_delay_by_daytime`) === 'on');
      add({ k: 'col2' });
      add({ k: 'head', l: 'Status' });
      add({ k: 'ro', l: 'Eingeschaltet durch', v: () => LMO_SRC[st(`input_select.${b}_source`)] || '–', w: [`input_select.${b}_source`] });
      add({ k: 'ro', l: 'Nachlauf', v: () => lmoTimer(this._st(`timer.${b}`)), w: [`timer.${b}`] });
      add({ k: 'ro', l: 'Vorwarnung', v: () => st(`input_boolean.${b}_warning`) === 'on' ? 'läuft' : '–', w: [`input_boolean.${b}_warning`] });
      add({ k: 'ro', l: 'Sperre', v: () => lmoTimer(this._st(`timer.${b}_lock`)), w: [`timer.${b}_lock`] });
      add({ k: 'ro', l: 'Medienwiedergabe', v: () => st(`binary_sensor.${rb}_occupied`) === 'on' ? 'läuft' : '–', w: [`binary_sensor.${rb}_occupied`] });
      add({ k: 'ro', l: 'Tageszeit', v: () => (S.find(x => x[0] === st('sensor.haus_sys_daytime')) || [, '–'])[1] });
    } else if (sec === 'cond') {
      add({ k: 'head', l: 'Nur einschalten, wenn …' });
      add({ k: 'sel', e: `input_select.${b}_cfg_alarm`, l: 'Alarmanlage', o: [['always', 'Immer'], ['disarmed', 'Unscharf'], ['not_away', 'Nicht abwesend']] });
      add({ k: 'sel', e: `input_select.${b}_cfg_presence`, l: 'Anwesenheit', o: [['always', 'Immer'], ['home', 'Jemand zuhause']] });
      const lux = st(`input_select.${b}_cfg_lux`);
      add({ k: 'sel', e: `input_select.${b}_cfg_lux`, l: 'Helligkeit', o: [['always', 'Immer'], ['below', 'Außen'], ['below_room', 'Raum'], ['sun', 'Sonne']] });
      add({ k: 'num', e: `input_number.${b}_cfg_lux_threshold`, l: 'Dunkler als', sub: true }, lux === 'below' || lux === 'below_room');
      add({ k: 'num', e: `input_number.${b}_cfg_sun_elevation`, l: 'Sonnenhöhe unter', sub: true }, lux === 'sun');
      add({ k: 'col2' });
      add({ k: 'head', l: 'Zeit' });
      const tw = st(`input_select.${b}_cfg_time`) === 'window';
      add({ k: 'sel', e: `input_select.${b}_cfg_time`, l: 'Zeitfenster', o: [['always', 'Immer'], ['window', 'Nur von – bis']] });
      add({ k: 'time', e: `input_datetime.${b}_cfg_time_start`, l: 'Von', sub: true }, tw);
      add({ k: 'time', e: `input_datetime.${b}_cfg_time_end`, l: 'Bis', sub: true }, tw);
    } else if (sec === 'light') {
      const dt = st(`input_boolean.${b}_cfg_daytime`) === 'on', slots = dt ? S : S.slice(0, 1);
      // gewählte Tageszeit nur beim Zeichnen der sichtbaren Seite anpassen – der Durchlauf über alle Lichter (all,
      // Liste der beobachteten Entitäten bei jedem Update) setzte sie sonst auf „Allgemein“ zurück
      const cur = slots.some(x => x[0] === this._moSlot) ? this._moSlot : slots[0][0];
      if (!all) this._moSlot = cur;
      const p = `${b}_cfg_${cur}`, mode = st(`input_select.${p}_mode`);
      add({ k: 'bool', e: `input_boolean.${b}_cfg_daytime`, l: 'Tageszeiten berücksichtigen' });
      add({ k: 'slot', l: 'Profil', o: slots });
      if (all) for (const [k] of S) for (const x of ['mode']) rows.push({ k: 'sel', e: `input_select.${b}_cfg_${k}_${x}`, o: [] }), rows.push({ k: 'num', e: `input_number.${b}_cfg_${k}_brightness` }), rows.push({ k: 'num', e: `input_number.${b}_cfg_${k}_kelvin` }), rows.push({ k: 'col', e: `input_text.${b}_cfg_${k}_color` }), rows.push({ k: 'num', e: `input_number.${b}_cfg_${k}_fade_on` }), rows.push({ k: 'num', e: `input_number.${b}_cfg_${k}_fade_off` });
      add({ k: 'col2' });
      add({ k: 'head', l: 'Profil ' + (S.find(x => x[0] === cur) || [, ''])[1] });
      add({ k: 'sel', e: `input_select.${p}_mode`, l: 'Modus', o: [['color_temp', 'Weiß'], ['color', 'Farbe'], ['auto', 'Beides'], ['brightness', 'Nur hell'], ['off', 'Nicht an']] });
      add({ k: 'num', e: `input_number.${p}_brightness`, l: 'Helligkeit' }, mode !== 'off');
      add({ k: 'num', e: `input_number.${p}_kelvin`, l: 'Farbtemperatur' }, mode === 'color_temp' || mode === 'auto');
      add({ k: 'col', e: `input_text.${p}_color`, l: 'Farbe' }, mode === 'color' || mode === 'auto');
      add({ k: 'num', e: `input_number.${p}_fade_on`, l: 'Einblenden' }, mode !== 'off');
      add({ k: 'num', e: `input_number.${p}_fade_off`, l: 'Ausblenden' });
      add({ k: 'btn', l: 'Profil am Licht testen', a: 'motest' }, mode !== 'off');
    } else if (sec === 'off') {
      // Vorrang: function = die andere Funktion setzt sich durch, motion = die Bewegung behält/übernimmt das Licht
      add({ k: 'head', l: 'Vorrang' });
      add({ k: 'sel', e: `input_select.${b}_cfg_priority_manual`, l: 'Hand (Taster, App, Dimmen)', o: [['function', 'Hand'], ['motion', 'Bewegung']] });
      add({ k: 'sel', e: `input_select.${b}_cfg_priority_schedule`, l: 'Zeitsteuerung', o: [['function', 'Zeit'], ['motion', 'Bewegung']] });
      add({ k: 'sel', e: `input_select.${b}_cfg_priority_lux`, l: 'Helligkeitssteuerung', o: [['function', 'Helligkeit'], ['motion', 'Bewegung']] });
      add({ k: 'head', l: 'Tür' });
      add({ k: 'bool', e: `input_boolean.${b}_cfg_door`, l: 'Türkontakt schaltet vorab ein' });
      add({ k: 'col2' });
      const lk = st(`input_boolean.${b}_cfg_lock_enabled`) === 'on', wn = st(`input_boolean.${b}_cfg_warn_enabled`) === 'on';
      add({ k: 'head', l: 'Sperre nach Hand-Aus' });
      add({ k: 'bool', e: `input_boolean.${b}_cfg_lock_enabled`, l: 'Sperre' });
      add({ k: 'num', e: `input_number.${b}_cfg_lock_minutes`, l: 'Dauer', sub: true }, lk);
      add({ k: 'head', l: 'Vorwarnung' });
      add({ k: 'bool', e: `input_boolean.${b}_cfg_warn_enabled`, l: 'Vorwarnung' });
      add({ k: 'num', e: `input_number.${b}_cfg_warn_seconds`, l: 'Vor Ablauf', sub: true }, wn);
      add({ k: 'num', e: `input_number.${b}_cfg_warn_brightness`, l: 'Dimmen auf', sub: true }, wn);
      add({ k: 'bool', e: `input_boolean.${b}_cfg_warn_priority`, l: 'Vorrang vor Nachlauf', sub: true }, wn);
    } else if (sec === 'room') {
      add({ k: 'head', l: 'Quellen (beide Lichter)' });
      add({ k: 'ents', e: `input_text.${rb}_cfg_motion_sensors`, l: 'Bewegungsmelder', dom: ['binary_sensor', 'input_boolean', 'group'], multi: true });
      add({ k: 'ents', e: `input_text.${rb}_cfg_presence_sensors`, l: 'Raum-Anwesenheit', dom: ['binary_sensor', 'input_boolean', 'group'], multi: true });
      add({ k: 'bool', e: `input_boolean.${rb}_cfg_presence_trigger`, l: 'Anwesenheit hält Licht an', sub: true });
      add({ k: 'ents', e: `input_text.${rb}_cfg_lux_sensor`, l: 'Raumhelligkeit', dom: ['sensor'], dc: 'illuminance' });
      add({ k: 'ents', e: `input_text.${rb}_cfg_door_sensors`, l: 'Türkontakte', dom: ['binary_sensor'], multi: true });
      add({ k: 'num', e: `input_number.${rb}_cfg_offset`, l: 'Melder-Offset' });
      add({ k: 'col2' });
      const om = st(`input_boolean.${rb}_cfg_occupied_media_enabled`) === 'on', occ = this._st(`binary_sensor.${rb}_occupied`);
      add({ k: 'head', l: 'Medienwiedergabe' });
      add({ k: 'bool', e: `input_boolean.${rb}_cfg_occupied_media_enabled`, l: 'Bewegung pausiert bei Wiedergabe' });
      add({ k: 'ents', e: `input_text.${rb}_cfg_occupied_media`, l: 'Medienplayer', dom: ['media_player'], multi: true, sub: true }, om);
      add({ k: 'ro', l: 'Spielt gerade', sub: true, w: [`binary_sensor.${rb}_occupied`],
        v: () => { const p = (occ && occ.attributes.playing) || []; return !p.length ? '–' : p.map(x => (this._st(x) || { attributes: {} }).attributes.friendly_name || x).join(', '); } }, om);
    } else if (sec === 'house') {
      add({ k: 'head', l: 'Tageszeiten beginnen um' });
      for (const [k, n] of S.slice(1)) add({ k: 'time', e: `input_datetime.haus_sys_daytime_cfg_${k}_start`, l: n });
      add({ k: 'ro', l: 'Jetzt', v: () => (S.find(x => x[0] === st('sensor.haus_sys_daytime')) || [, '–'])[1], w: ['sensor.haus_sys_daytime'] });
      add({ k: 'col2' });
      add({ k: 'head', l: 'Quellen für die Lichtsteuerung' });
      add({ k: 'ents', e: 'input_text.haus_light_motion_cfg_alarm_panel', l: 'Alarmanlage', dom: ['alarm_control_panel'] });
      add({ k: 'ents', e: 'input_text.haus_light_motion_cfg_presence_sensor', l: 'Anwesenheit', dom: ['zone', 'person', 'binary_sensor', 'group', 'input_boolean'] });
      add({ k: 'ents', e: 'input_text.haus_light_motion_cfg_lux_sensor', l: 'Außenhelligkeit', dom: ['sensor'], dc: 'illuminance' });
      add({ k: 'head', l: 'Bedienung der Wand-Panels' });
      add({ k: 'num', e: ZOOM_DT, l: 'Doppeltipp zum Vergrößern innerhalb' });
      add({ k: 'bool', e: ZOOM_IGN, l: 'Tasten und Regler beim Doppeltipp ignorieren' });
      add({ k: 'num', e: SPARK_W, l: 'Balkenbreite der Verläufe' });
    }
    return rows;
  }
  _moPaint() {
    const rail = this.$('lmrail'), body = this.$('lmbody'); if (!rail || !body) return;
    const r = this._area(), L = this._moL || (this._moL = 'primary'), sec = this._moSec || (this._moSec = 'gen');
    const perLight = !['room', 'house'].includes(sec);
    this._html(rail, `<div class="lmls${perLight ? '' : ' dim'}">${[['primary', 'Primär'], ['secondary', 'Sekundär']].map(([k, n]) => `<div class="hk sm${L === k ? ' on' : ''}" data-act="molight:${k}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`
      + LMO_SECS.map(([k, n, t]) => `<div class="lmsec${sec === k ? ' on' : ''}" data-act="mosec:${k}">${n}${t ? `<small>${t}</small>` : ''}</div>`).join(''));
    if (!r) { this._html(body, '<div class="lmmsg">Kein Raum-Kürzel – Panel-Option <b>raum:</b> fehlt.</div>'); return; }
    if (!this._st(`input_boolean.${r}_light_motion_${L}_cfg_enabled`)) { this._html(body, `<div class="lmmsg">Die Bewegungssteuerung für <b>${r.toUpperCase()}</b> ist in Home Assistant nicht eingerichtet (Paket <b>light_motion_${r}.yaml</b> fehlt).</div>`); return; }
    const rows = this._moRows(sec, r, L, false), cols = [[], []];
    let c = 0;
    for (const row of rows) { if (row.k === 'col2') { c = 1; continue; } cols[c].push(this._moRow(row)); }
    this._html(body, cols.map(x => `<div class="lmcol">${x.join('')}</div>`).join(''));
  }
  _moRow(row) {
    if (row.k === 'head') return `<div class="lmh">${row.l}</div>`;
    const s = this._st(row.e), v = s ? s.state : null, a = (s && s.attributes) || {}, cls = `lmr${row.sub ? ' sub' : ''}`;
    const lab = `<span>${row.l}</span>`;
    if (row.k === 'ro') return `<div class="${cls}">${lab}<div class="lcd lmro">${escH(row.v())}</div></div>`;
    if (row.k === 'btn') return `<div class="${cls}">${lab}<div class="hk" data-act="${row.a}" style="--c:var(--acc)"><i></i>Testen</div></div>`;
    if (row.k === 'slot') return `<div class="${cls} stack">${lab}<div class="lmseg">${row.o.map(([k, n]) => `<div class="hk${this._moSlot === k ? ' on' : ''}" data-act="moslot:${k}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div></div>`;
    if (!s) return `<div class="${cls}">${lab}<div class="lcd lmro" style="color:#ff8a8a">fehlt</div></div>`;
    if (row.k === 'bool') return `<div class="${cls}">${lab}<div class="hk${v === 'on' ? ' on' : ''}" data-act="mobool:${row.e}" style="--c:${v === 'on' ? '#3ddc84' : 'var(--acc)'}"><i></i>${v === 'on' ? 'An' : 'Aus'}</div></div>`;
    if (row.k === 'sel') return `<div class="${cls}${row.o.length > 2 ? ' stack' : ''}">${lab}<div class="lmseg">${row.o.map(([k, n]) => `<div class="hk${v === k ? ' on' : ''}" data-act="mosel:${row.e}|${k}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div></div>`;
    if (row.k === 'num') {
      const pend = this._moPend && this._moPend[row.e], n = pend != null ? pend : Number(v), u = a.unit_of_measurement || '';
      const txt = row.fmt === 'mmss' ? mmss(n) : `${Number.isInteger(n) ? n : n.toFixed(1)}${u === '%' ? ' %' : u ? ' ' + u : ''}`;
      return `<div class="${cls}">${lab}<div class="lmst"><div class="hk" data-step="${row.e}|-1">−</div><div class="dlcd">${txt}</div><div class="hk" data-step="${row.e}|1">+</div></div></div>`;
    }
    if (row.k === 'time') return `<div class="${cls}">${lab}<input class="lmin" type="time" data-time="${row.e}" value="${escH(String(v).slice(0, 5))}"></div>`;
    if (row.k === 'col') { const col = /^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'; return `<div class="${cls}">${lab}<label class="lmcolr" style="--c:${col}"><input type="color" data-color="${row.e}" value="${col}"></label></div>`; }
    if (row.k === 'ents') {
      const ids = String(v || '').split(',').map(x => x.trim()).filter(Boolean);
      const name = id => { const x = this._st(id); return x ? (x.attributes.friendly_name || id) : id + ' (fehlt)'; };
      const txt = !ids.length ? 'Keine' : ids.length === 1 ? name(ids[0]) : `${ids.length} gewählt`;
      return `<div class="${cls}">${lab}<div class="hk lmen" data-act="mopick:${row.e}" style="--c:var(--acc)"><i></i><span>${escH(txt)}</span></div></div>`;
    }
    return '';
  }
  _moFind(e) { const r = this._area(); for (const L of ['primary', 'secondary']) for (const [k] of LMO_SECS) { const x = this._moRows(k, r, L, true).find(y => y.e === e && y.k !== 'sel'); if (x) return x; } return null; }
  _moAct(cmd, arg) {
    const set = (d, sv, data) => this._call(d, sv, data);
    if (cmd === 'molight') { this._moL = arg; this._moPaint(); return; }
    if (cmd === 'mosec') { this._moSec = arg; this._moPaint(); return; }
    if (cmd === 'moslot') { this._moSlot = arg; this._moPaint(); return; }
    if (cmd === 'mobool') { set('input_boolean', 'toggle', { entity_id: arg }); return; }
    if (cmd === 'mosel') { const [e, o] = arg.split('|'); set('input_select', 'select_option', { entity_id: e, option: o }); return; }
    if (cmd === 'motest') { set('script', 'turn_on', { entity_id: 'script.light_motion_apply', variables: { room: this._area(), light: this._moL || 'primary' } }); return; }
    if (cmd === 'mopick') { this._moPickOpen(arg); return; }
    if (cmd === 'mopk') { this._moPickAct(arg); }
  }
  // Zahlen: Tippen = ein Schritt, Halten = immer schneller; gesendet wird nach kurzer Pause
  _moBind() {
    const root = this.shadowRoot; if (this._moBound) return; this._moBound = true;
    root.addEventListener('pointerdown', ev => {
      const t = ev.target.closest && ev.target.closest('[data-step]'); if (!t) return;
      ev.preventDefault();
      const [e, dir] = t.dataset.step.split('|'), s = this._st(e); if (!s) return;
      const a = s.attributes, step = Number(a.step) || 1, min = Number(a.min), max = Number(a.max);
      this._moPend = this._moPend || {};
      let n = 0;
      const go = () => {
        const cur = this._moPend[e] != null ? this._moPend[e] : Number(s.state), k = n < 8 ? 1 : n < 20 ? 4 : 12;
        this._moPend[e] = clamp(Math.round((cur + dir * step * k) / step) * step, min, max); n++;
        this._moPaint(); clearTimeout(this._moSend); this._moSend = setTimeout(() => this._moFlush(), 700);
      };
      go(); clearInterval(this._moRep);
      const to = setTimeout(() => { this._moRep = setInterval(go, 110); }, 420);
      const up = () => { clearTimeout(to); clearInterval(this._moRep); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    root.addEventListener('change', ev => {
      const t = ev.target;
      if (t.dataset && t.dataset.time) this._call('input_datetime', 'set_datetime', { entity_id: t.dataset.time, time: t.value + ':00' });
      if (t.dataset && t.dataset.color) this._call('input_text', 'set_value', { entity_id: t.dataset.color, value: t.value.toUpperCase() });
    });
    root.addEventListener('input', ev => { const t = ev.target; if (t.id === 'lmpkq') { this._moPkQ = t.value; this._moPickList(); } if (t.dataset && t.dataset.color) t.parentElement.style.setProperty('--c', t.value); });
  }
  _moFlush() {
    const p = this._moPend || {}; this._moPend = {};
    for (const [e, v] of Object.entries(p)) this._call('input_number', 'set_value', { entity_id: e, value: v });
  }
  // Auswahlfenster für Entitäten (mehrere oder eine)
  _moPickOpen(e) {
    const row = this._moFind(e); if (!row) return;
    const cur = String((this._st(e) || {}).state || '').split(',').map(x => x.trim()).filter(Boolean);
    this._pkShow(row, cur, null, e);
  }
  // Auswahlfenster anzeigen; cb(sel) statt Helfer schreiben (Zeitsteuerung)
  _pkShow(row, cur, cb, e = null) {
    this._moPk = { e, row, sel: cur, cb }; this._moPkQ = '';
    const pk = this.$('lmpk'); pk.hidden = false;
    pk.innerHTML = `<div class="top"><b>${escH(row.l)}</b><input id="lmpkq" placeholder="Suchen …" autocomplete="off"></div><div class="lmlist" id="lmpkl"></div>
      <div class="bt"><div class="hk" data-act="mopk:clear"><i></i>Leeren</div><div class="hk" data-act="mopk:cancel"><i></i>Abbrechen</div><div class="hk on" data-act="mopk:ok" style="--c:#3ddc84"><i></i>Übernehmen</div></div>`;
    this._moPickList();
  }
  _moPickList() {
    const pk = this._moPk, el = this.$('lmpkl'); if (!pk || !el) return;
    const q = (this._moPkQ || '').toLowerCase(), row = pk.row;
    const list = Object.values(this._hass.states).filter(s => row.dom.includes(s.entity_id.split('.')[0]) && (!row.dc || s.attributes.device_class === row.dc) && (!row.fit || row.fit(s)))
      .filter(s => !q || s.entity_id.includes(q) || String(s.attributes.friendly_name || '').toLowerCase().includes(q))
      .sort((x, y) => (pk.sel.includes(y.entity_id) - pk.sel.includes(x.entity_id)) || x.entity_id.localeCompare(y.entity_id)).slice(0, 150);
    el.innerHTML = list.length ? list.map(s => `<div class="lmrow${pk.sel.includes(s.entity_id) ? ' on' : ''}" data-act="mopk:t|${s.entity_id}"><span class="chk"></span><span class="dn"><b>${escH(s.attributes.friendly_name || s.entity_id)}</b><small>${s.entity_id} · ${escH(s.state)}</small></span></div>`).join('')
      : '<div class="lmempty">Nichts gefunden.</div>';
  }
  _moPickAct(arg) {
    const pk = this._moPk, box = this.$('lmpk'); if (!pk) return;
    if (arg.startsWith('t|')) {
      const id = arg.slice(2);
      if (!pk.row.multi) pk.sel = pk.sel[0] === id ? [] : [id];
      else pk.sel = pk.sel.includes(id) ? pk.sel.filter(x => x !== id) : [...pk.sel, id];
      this._moPickList(); return;
    }
    if (arg === 'clear') { pk.sel = []; this._moPickList(); return; }
    if (arg === 'ok') { if (pk.cb) pk.cb(pk.sel); else this._call('input_text', 'set_value', { entity_id: pk.e, value: pk.sel.join(', ').slice(0, 255) }); }
    box.hidden = true; this._moPk = null;
  }
  // ================================================================ Reiter "Zeitsteuerung" + "Helligkeitssteuerung"
  // Gleicher Editor für beide Integrationen (k = 'zs' light_schedule · 'hs' light_lux, siehe FX):
  // links die Profile des Raums, rechts der Editor mit Abschnitten. Aktionen heißen <k><befehl> (zssave, hssave …).
  // Bearbeitet wird ein Entwurf (this._fx[k].d); erst „Speichern“ schickt ihn an die Integration.
  _fz(k) { const o = this._fx || (this._fx = {}); return o[k] || (o[k] = { sec: FX[k].secs[0][0], sel: null }); }
  _zsList(k) { const r = this._area(), s = r && this._st(FX[k].sid(r)); return s ? s.attributes.profiles || [] : null; }
  _zsPaint(k) {
    if (!k) { this._zsPaint('zs'); this._zsPaint('hs'); return; }
    const F = FX[k], rail = this.$(k + 'rail'), ed = this.$(k + 'ed'); if (!rail || !ed) return;
    const r = this._area(), list = this._zsList(k);
    if (!r || !list) {
      this._html(rail, '');
      this._html(ed, `<div class="lmmsg">${!r ? 'Kein Raum-Kürzel – Panel-Option <b>raum:</b> fehlt.' : `Die ${F.name} ist in Home Assistant nicht eingerichtet (Integration <b>${F.ws}</b>, Sensor <b>${F.sid(r)}</b> fehlt).`}</div>`);
      return;
    }
    const z = this._fz(k);
    if (z.sel !== 'new' && !list.find(p => p.id === z.sel) && !(z.keep > Date.now())) { z.sel = list[0] ? list[0].id : null; z.dirty = false; z.d = null; }
    const found = list.find(p => p.id === z.sel);
    if (found && !z.dirty) z.d = JSON.parse(JSON.stringify(found));
    if (!z.sel) z.d = null;
    const items = list.map(p => { const [c, t] = F.stat(p); return `<div class="zsit${p.id === z.sel ? ' on' : ''}${p.enabled ? '' : ' off'}" data-act="${k}sel:${p.id}"><span class="zsd ${c}"></span><span class="dn"><b>${escH(p.name)}</b><small>${p.independent ? 'unabhängig · ' : ''}${escH(zsDaysTxt(p.days))} · ${escH(t)}</small></span></div>`; });
    if (z.sel === 'new') items.push(`<div class="zsit on"><span class="zsd"></span><span class="dn"><b>${escH(z.d.name)}</b><small>neu · noch nicht gespeichert</small></span></div>`);
    this._html(rail, `<div class="zslist">${items.join('') || '<div class="lmempty">Noch keine Profile.</div>'}</div><div class="hk" data-act="${k}new" style="--c:#3ddc84"><i></i>+ Neues Profil</div>`);
    if (!z.d) { this._html(ed, '<div class="lmmsg">Noch kein Profil ausgewählt.<br>Mit <b>+ Neues Profil</b> legst du eins an.</div>'); return; }
    const d = z.d;
    const hd = `<div class="zshd"><div class="zsname" data-act="${k}name">${escH(d.name)}</div>
      <div class="hk${d.enabled ? ' on' : ''}" data-act="${k}set:enabled|t" style="--c:${d.enabled ? '#3ddc84' : 'var(--acc)'}"><i></i>${d.enabled ? 'Aktiv' : 'Inaktiv'}</div>
      <div class="zsseg">${F.secs.map(([s, n]) => `<div class="lsg${z.sec === s ? ' on' : ''}" data-act="${k}sec:${s}">${n}</div>`).join('')}</div></div>`;
    const cols = this._zsRows(k, d, z.sec, r);
    const body = `<div class="lmbody">${cols.map(x => `<div class="lmcol">${x.join('')}</div>`).join('')}</div>`;
    const ft = `<div class="zsft"><div class="lmsg" id="${k}msg">${escH(z.msg || '')}</div>
      <div class="hk" data-act="${k}test" style="--c:var(--acc)"><i></i>Testen</div>
      ${z.sel !== 'new' ? `<div class="hk${z.del ? ' on' : ''}" data-act="${k}del" style="--c:#ff6b6b"><i></i>${z.del ? 'Wirklich löschen?' : 'Löschen'}</div>` : `<div class="hk" data-act="${k}cancel"><i></i>Verwerfen</div>`}
      <div class="hk${z.dirty ? ' on' : ''}" data-act="${k}save" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
    // nicht neu zeichnen, während eine Uhrzeit-/Farbauswahl offen ist (sonst schließt sie sich)
    const ae = this.shadowRoot.activeElement;
    if (ae && ae.tagName === 'INPUT' && ed.contains(ae)) return;
    this._html(ed, hd + body + ft);
    const m = this.shadowRoot.getElementById(k + 'msg'); if (m) m.style.color = z.msgOk === false ? '#ff8a8a' : '#3ddc84';
  }
  _zsRows(k, d, sec, r) {
    const F = FX[k], L = [[], []], h = (c, t) => L[c].push(`<div class="lmh">${t}</div>`);
    const row = (c, l, ctl, sub) => L[c].push(`<div class="lmr${sub ? ' sub' : ''}"><span>${l}</span>${ctl}</div>`);
    const seg = (key, o) => `<div class="lmseg">${o.map(([v, n]) => `<div class="hk${d[key] === v ? ' on' : ''}" data-act="${k}set:${key}|${v}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`;
    const tog = key => `<div class="hk${d[key] ? ' on' : ''}" data-act="${k}set:${key}|t" style="--c:${d[key] ? '#3ddc84' : 'var(--acc)'}"><i></i>${d[key] ? 'An' : 'Aus'}</div>`;
    const num = key => { const [, , , u] = F.num[key], v = Number(d[key]); return `<div class="lmst"><div class="hk" data-zstep="${k}|${key}|-1">−</div><div class="dlcd">${u === 'mmss' ? mmss(v) : (Number.isInteger(v) ? v : v.toFixed(1)) + u}</div><div class="hk" data-zstep="${k}|${key}|1">+</div></div>`; };
    const md = key => `<div class="lmst"><div class="hk" data-zstep="${k}|${key}|-1">−</div><div class="dlcd">${zsMdTxt(d[key])}</div><div class="hk" data-zstep="${k}|${key}|1">+</div></div>`;
    const stack = (c, l, ctl) => L[c].push(`<div class="lmr stack"><span>${l}</span>${ctl}</div>`);
    const nm = id => { const s = this._st(id); return s ? s.attributes.friendly_name || id : id + ' (fehlt)'; };
    const luxSrc = () => {
      const custom = !['room', 'outdoor'].includes(d.lux_source);
      return `<div class="lmseg">${[['room', 'Raum'], ['outdoor', 'Außen']].map(([v, n]) => `<div class="hk${d.lux_source === v ? ' on' : ''}" data-act="${k}set:lux_source|${v}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}<div class="hk lmen${custom ? ' on' : ''}" data-act="${k}pick:lux" style="--c:var(--acc)"><i></i><span>${custom ? escH(nm(d.lux_source)) : 'Anderer …'}</span></div></div>`;
    };
    const luxNow = () => {
      const src = d.lux_source === 'room' ? (this._st(`input_text.${r}_light_motion_cfg_lux_sensor`) || {}).state : d.lux_source === 'outdoor' ? (this._st('input_text.haus_light_motion_cfg_lux_sensor') || {}).state : d.lux_source;
      const ls = this._st(src);
      return `<div class="lcd lmro">${ls ? escH(ls.state) + ' lx' : 'kein Sensor'}</div>`;
    };
    const days = () => {
      h(0, 'Wochentage');
      L[0].push(`<div class="zsday">${ZS_DAYS.map((n, i) => `<div class="hk${d.days.includes(i) ? ' on' : ''}" data-act="${k}day:${i}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`);
      L[0].push(`<div class="lmseg" style="justify-content:flex-start">${[['all', 'Täglich'], ['work', 'Mo–Fr'], ['wend', 'Sa+So']].map(([x, n]) => `<div class="hk sm" data-act="${k}days:${x}" style="padding:0 10px"><i></i>${n}</div>`).join('')}</div>`);
      h(0, 'Zeitraum im Jahr');
      row(0, 'Nur in einem Zeitraum', tog('date_enabled'));
      if (d.date_enabled) L[0].push(`<div class="lmr sub"><span>Vom</span>${md('date_from')}<span>bis</span>${md('date_to')}</div>`);
    };
    const addSlot = () => { if (d.slots.length < 8) L[1].push(`<div class="lmseg" style="justify-content:flex-start;margin-top:4px"><div class="hk sm" data-act="${k}slot:add" style="padding:0 12px;--c:#3ddc84"><i></i>+ ${k === 'hs' ? 'Zeitfenster' : 'Zeit'} hinzufügen</div></div>`); };
    const cond = () => {
      h(0, 'Andere Funktionen');
      row(0, 'Unabhängig (schaltet immer)', tog('independent'));
      L[0].push(`<div class="lhint" style="margin:-2px 0 4px">${!d.independent ? 'Aus: Vorrang der Bewegungssteuerung gilt, schon eingeschaltete Lampen bleiben unberührt.'
        : k === 'hs' ? 'Schaltet ein, egal ob Bewegung, Hand oder Zeitsteuerung das Licht gerade hat, und lässt deren Vorrang und Zustand unberührt. Ausgeschaltet werden nur Lampen, die vorher aus waren.'
          : 'Schaltet ein, egal ob Bewegung, Hand oder Helligkeit das Licht gerade hat, und lässt deren Vorrang und Zustand unberührt. Zur Aus-Zeit gehen nur Lampen aus, die vorher aus waren.'}</div>`);
      h(0, 'Nur einschalten, wenn …');
      stack(0, 'Anwesenheit', seg('presence', [['always', 'Immer'], ['home', 'Jemand zuhause'], ['away', 'Niemand zuhause']]));
      stack(0, 'Alarmanlage', seg('alarm', [['always', 'Immer'], ['disarmed', 'Unscharf'], ['not_away', 'Nicht abwesend']]));
    };
    if (sec === 'light') {
      h(0, 'Lampen');
      row(0, 'Lampen / Gruppen', `<div class="hk lmen" data-act="${k}pick:lights" style="--c:var(--acc)"><i></i><span>${!d.lights.length ? 'Keine' : d.lights.length === 1 ? escH(nm(d.lights[0])) : d.lights.length + ' gewählt'}</span></div>`);
      if (d.lights.length > 1) L[0].push(`<div class="zslamps">${d.lights.map(e => escH(nm(e))).join('<br>')}</div>`);
      row(0, 'Einblenden', num('transition'));
      row(0, 'Ausblenden', num('transition_off'));
      h(1, 'Licht');
      stack(1, 'Modus', seg('mode', [['color_temp', 'Weiß'], ['color', 'Farbe'], ['auto', 'Beides'], ['brightness', 'Nur hell'], ['on', 'Nur ein']]));
      if (d.mode !== 'on') row(1, 'Helligkeit', num('brightness'));
      if (d.mode === 'color_temp' || d.mode === 'auto') row(1, 'Farbtemperatur', num('kelvin'));
      if (d.mode === 'color' || d.mode === 'auto') row(1, 'Farbe', `<label class="lmcolr" style="--c:${d.color}"><input type="color" data-zc="1" value="${d.color.toLowerCase()}"></label>`);
      return L;
    }
    if (k === 'hs') {
      if (sec === 'time') {
        days();
        h(1, 'Zeitfenster pro Tag');
        d.slots.forEach((s, i) => L[1].push(`<div class="zsslot"><b>VON</b><input class="lmin" type="time" data-zt="${i}|from" value="${s.from}"><b>BIS</b><input class="lmin" type="time" data-zt="${i}|to" value="${s.to}">${s.from === s.to ? '<b style="color:var(--acc)">GANZER TAG</b>' : `<div class="hk" data-act="hsslot:day|${i}" title="ganzer Tag">24 h</div>`}<div class="hk" data-act="hsslot:del|${i}" style="--c:#ff6b6b">✕</div></div>`));
        addSlot();
        L[1].push('<div class="lhint" style="margin-top:6px">Nur in diesen Zeitfenstern reagiert das Profil auf die Helligkeit. Von = Bis heißt ganzer Tag, über Mitternacht (z. B. 18:00–02:00) geht auch.</div>');
      } else if (sec === 'lux') {
        h(0, 'Sensor');
        stack(0, 'Helligkeitssensor', luxSrc());
        row(0, 'Gerade', luxNow(), true);
        h(0, 'Einschalten');
        row(0, 'Wenn dunkler als', num('lux_on'));
        row(0, 'Mindestens', num('delay_on'), true);
        h(1, 'Ausschalten');
        row(1, 'Bei Helligkeit ausschalten', tog('off_bright'));
        row(1, 'Wenn heller als', num('lux_off'));
        row(1, 'Mindestens', num('delay_off'), true);
        row(1, 'Am Fensterende ausschalten', tog('off_at_end'));
        L[1].push(`<div class="lhint" style="margin-top:6px">${d.off_bright ? 'Wird es wieder hell, schaltet das Profil seine Lampen aus und danach bei Dunkelheit wieder ein.' : 'Das Licht bleibt an, auch wenn es hell wird.'} Schaltet jemand von Hand aus, bleibt es aus, bis es wieder hell war. Ohne Sensor schaltet das Profil nicht.</div>`);
      } else cond();
      return L;
    }
    if (sec === 'time') {
      days();
      h(1, 'Zeiten pro Tag');
      d.slots.forEach((s, i) => L[1].push(`<div class="zsslot"><b>EIN</b><input class="lmin" type="time" data-zt="${i}|on" value="${s.on}"><b>AUS</b>${s.off != null
        ? `<input class="lmin" type="time" data-zt="${i}|off" value="${s.off}"><div class="hk" data-act="zsslot:nooff|${i}" title="ohne Aus-Zeit">ohne</div>`
        : `<div class="lcd lmro">—</div><div class="hk" data-act="zsslot:off|${i}">+ Aus</div>`}<div class="hk" data-act="zsslot:del|${i}" style="--c:#ff6b6b">✕</div></div>`));
      addSlot();
      L[1].push('<div class="lhint" style="margin-top:6px">Ohne Aus-Zeit schaltet das Profil nur ein (Bedingungen werden bis 15 min nach der Ein-Zeit geprüft). Mit Aus-Zeit wartet es im ganzen Zeitraum, bis die Bedingungen passen.</div>');
    } else if (sec === 'cond') {
      cond();
      h(1, 'Helligkeit');
      row(1, 'Nur wenn dunkler als', tog('lux_below_enabled'));
      if (d.lux_below_enabled) row(1, 'Grenze', num('lux_below'), true);
      row(1, 'Nur wenn heller als', tog('lux_above_enabled'));
      if (d.lux_above_enabled) row(1, 'Grenze', num('lux_above'), true);
      if (d.lux_below_enabled || d.lux_above_enabled) {
        stack(1, 'Sensor', luxSrc());
        row(1, 'Gerade', luxNow(), true);
      }
      L[1].push('<div class="lhint" style="margin-top:6px">Fehlt ein Sensor oder meldet er nichts, gilt die Bedingung als erfüllt.</div>');
    }
    return L;
  }
  _zsDirty(k) { const z = this._fz(k); z.dirty = true; z.del = false; this._zsPaint(k); }
  _zsMsg(k, t, ok = true) { const z = this._fz(k); z.msg = t; z.msgOk = ok; this._zsPaint(k); clearTimeout(z.mt); z.mt = setTimeout(() => { z.msg = ''; this._zsPaint(k); }, 4000); }
  _zsSend(type, extra) { return this._hass.callWS({ type, ...extra }); }
  async _zsAct(cmd, arg) {
    const k = cmd.slice(0, 2), op = cmd.slice(2), F = FX[k], z = this._fz(k), d = z.d, r = this._area();
    const dirty = () => this._zsDirty(k), msg = (t, ok) => this._zsMsg(k, t, ok), err = e => msg('Fehler: ' + ((e && e.message) || e), false);
    if (op === 'sel') { if (z.sel === arg) return; z.sel = arg; z.dirty = false; z.d = null; z.del = false; z.msg = ''; this._zsPaint(k); return; }
    if (op === 'sec') { z.sec = arg; this._zsPaint(k); return; }
    if (op === 'new') {
      const lamp = this._light() ? [this._light()] : [];
      z.sel = 'new'; z.d = JSON.parse(JSON.stringify({ ...F.def, lights: lamp })); z.dirty = true; z.del = false; z.sec = F.secs[0][0]; z.msg = '';
      this._zsPaint(k); return;
    }
    if (op === 'cancel') { z.sel = null; z.d = null; z.dirty = false; this._zsPaint(k); return; }
    if (!d) return;
    if (op === 'name') { this._kbOpen('Profilname', d.name === F.def.name ? '' : d.name, 40, v => { d.name = v.trim() || d.name; dirty(); }); return; }
    if (op === 'set') { const [key, v] = arg.split('|'); d[key] = v === 't' ? !d[key] : v; dirty(); return; }
    if (op === 'day') { const i = +arg; d.days = d.days.includes(i) ? d.days.filter(x => x !== i) : [...d.days, i].sort(); dirty(); return; }
    if (op === 'days') { d.days = { all: [0, 1, 2, 3, 4, 5, 6], work: [0, 1, 2, 3, 4], wend: [5, 6] }[arg]; dirty(); return; }
    if (op === 'slot') {
      const [a, i] = arg.split('|'), s = d.slots[+i], last = d.slots[d.slots.length - 1];
      const plus2 = hm => { const [hh, mm] = hm.split(':').map(Number); return String((hh + 2) % 24).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
      if (a === 'add') d.slots.push(k === 'hs' ? (last ? { from: last.to, to: plus2(last.to) } : { from: '06:00', to: '23:00' }) : { on: last && last.off ? last.off : '07:00', off: null });
      if (a === 'del') d.slots.splice(+i, 1);
      if (a === 'day' && s) { s.from = '00:00'; s.to = '00:00'; }
      if (a === 'off' && s) s.off = plus2(s.on);
      if (a === 'nooff' && s) s.off = null;
      dirty(); return;
    }
    if (op === 'pick') {
      if (arg === 'lights') this._pkShow({ l: 'Lampen / Gruppen', dom: ['light', 'switch', 'group'], multi: true }, [...d.lights], sel => { d.lights = sel; dirty(); });
      else this._pkShow({ l: 'Helligkeitssensor', dom: ['sensor'], dc: 'illuminance' }, ['room', 'outdoor'].includes(d.lux_source) ? [] : [d.lux_source], sel => { d.lux_source = sel[0] || 'room'; dirty(); });
      return;
    }
    if (op === 'test') {
      try { await this._zsSend(F.ws + '/test', { profile: { ...F.clean(d), room: r } }); msg('Lichteinstellung an den Lampen gezeigt.'); } catch (e) { err(e); }
      return;
    }
    if (op === 'del') {
      if (!z.del) { z.del = true; this._zsPaint(k); clearTimeout(z.dt); z.dt = setTimeout(() => { z.del = false; this._zsPaint(k); }, 4000); return; }
      try { await this._zsSend(F.ws + '/delete', { profile_id: z.sel }); z.sel = null; z.d = null; z.dirty = false; z.del = false; msg('Profil gelöscht.'); } catch (e) { err(e); }
      return;
    }
    if (op === 'save') {
      if (!d.slots.length) { msg(k === 'hs' ? 'Mindestens ein Zeitfenster anlegen.' : 'Mindestens eine Zeit anlegen.', false); return; }
      if (!d.days.length) { msg('Mindestens einen Wochentag wählen.', false); return; }
      if (k === 'hs' && Number(d.lux_off) <= Number(d.lux_on)) { msg('„Heller als“ muss größer sein als „Dunkler als“.', false); return; }
      try {
        const res = await this._zsSend(F.ws + '/save', { profile: { ...F.clean(d), id: z.sel === 'new' ? undefined : z.sel, room: r } });
        z.sel = res.result; z.dirty = false; z.keep = Date.now() + 5000;
        msg(d.lights.length ? 'Gespeichert.' : 'Gespeichert – noch keine Lampen gewählt.', !!d.lights.length);
      } catch (e) { err(e); }
    }
  }
  _zsBind() {
    const root = this.shadowRoot; if (this._zsBound) return; this._zsBound = true;
    const kindOf = t => (t.closest('#hsed') ? 'hs' : 'zs');
    root.addEventListener('pointerdown', ev => {
      const t = ev.target.closest && ev.target.closest('[data-zstep]'); if (!t) return;
      const [k, key, dir] = t.dataset.zstep.split('|'), z = this._fz(k), d = z.d; if (!d) return;
      ev.preventDefault();
      let n = 0;
      const go = () => {
        const f = n < 8 ? 1 : n < 20 ? 4 : 12; n++;
        if (key === 'date_from' || key === 'date_to') d[key] = zsIdxMd(zsMdIdx(d[key]) + dir * f);
        else { const [lo, hi, st] = FX[k].num[key]; d[key] = clamp(Math.round((Number(d[key]) + dir * st * f) / st) * st, lo, hi); }
        this._zsDirty(k);
      };
      go(); clearInterval(this._zsRep);
      const to = setTimeout(() => { this._zsRep = setInterval(go, 110); }, 420);
      const up = () => { clearTimeout(to); clearInterval(this._zsRep); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    root.addEventListener('change', ev => {
      const t = ev.target; if (!t.dataset || !(t.dataset.zt || t.dataset.zc)) return;
      const k = kindOf(t), d = this._fz(k).d; if (!d) return;
      if (t.dataset.zt) { const [i, key] = t.dataset.zt.split('|'); if (d.slots[+i] && /^\d\d:\d\d/.test(t.value)) { d.slots[+i][key] = t.value.slice(0, 5); this._zsDirty(k); } }
      if (t.dataset.zc) { d.color = t.value.toUpperCase(); this._zsDirty(k); }
    });
    root.addEventListener('input', ev => { const t = ev.target; if (t.dataset && t.dataset.zc) t.parentElement.style.setProperty('--c', t.value); });
  }
  // ---------------------------------------------------------------- Bildschirmtastatur
  _kbOpen(title, value, max, cb) {
    this._kb = { title, v: value || '', max, cb, sh: !value };
    this.$('lkb').hidden = false; this._kbPaint();
    this._kbKd = ev => {
      if (ev.key === 'Enter') this._kbKey('#ok'); else if (ev.key === 'Escape') this._kbKey('#esc'); else if (ev.key === 'Backspace') this._kbKey('#bs');
      else if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey) { const k = this._kb; if (k.v.length < k.max) k.v += ev.key; k.sh = false; this._kbPaint(); }
      else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', this._kbKd);
  }
  _kbPaint() {
    const k = this._kb, el = this.$('lkb'); if (!k || !el) return;
    const cap = c => k.sh ? c.toUpperCase() : c;
    const key = c => c === '#sh' ? `<div class="hk w2${k.sh ? ' on' : ''}" data-act="kb:#sh" style="--c:var(--acc)">⇧</div>`
      : c === '#bs' ? '<div class="hk w2" data-act="kb:#bs">⌫</div>'
        : `<div class="hk" data-act="kb:${escH(c)}"${c === 'ß' ? ' style="font-family:Rajdhani,sans-serif!important"' : ''}>${escH(cap(c))}</div>`;   // ß fehlt in der Charlie-Schrift
    el.innerHTML = `<div class="top"><b>${escH(k.title)}</b></div><div class="kbv">${escH(k.v)}<i></i><small>${k.v.length}/${k.max}</small></div>
      <div class="kbd">${KB_ROWS.map(r => `<div class="kbr">${r.map(key).join('')}</div>`).join('')}
      <div class="kbr"><div class="hk w2" data-act="kb:#esc">Abbrechen</div><div class="hk" data-act="kb:.">.</div><div class="hk sp" data-act="kb:#sp">Leerzeichen</div><div class="hk" data-act="kb:/">/</div><div class="hk w2 on" data-act="kb:#ok" style="--c:#3ddc84"><i></i>OK</div></div></div>`;
  }
  _kbKey(c) {
    const k = this._kb; if (!k) return;
    if (c === '#ok' || c === '#esc') {
      window.removeEventListener('keydown', this._kbKd); this.$('lkb').hidden = true; this._kb = null;
      if (c === '#ok') k.cb(k.v); return;
    }
    if (c === '#sh') k.sh = !k.sh;
    else if (c === '#bs') k.v = k.v.slice(0, -1);
    else if (k.v.length < k.max) { k.v += c === '#sp' ? ' ' : k.sh ? c.toUpperCase() : c; k.sh = false; }
    this._kbPaint();
  }
  async _mkHelper() {
    const raum = this._area(); if (!raum) return;
    try {
      await this._hass.callWS({ type: 'input_text/create', name: 'Licht Favoriten ' + raum.toUpperCase(), icon: 'mdi:palette', min: 0, max: 255 });
      setTimeout(() => this._call('input_text', 'set_value', { entity_id: favId(raum), value: favEnc(this._edit || this._c.favorites) }), 600);
      this._msg('Helfer angelegt.');
    } catch (e) { this._msg('Fehler: ' + ((e && e.message) || e), false); }
  }
}

// ---------------------------------------------------------------- Heizungs-Einstellungen (Einstellungsfenster → Heizungssteuerung)
// Reiter Heizungssteuerung: Heiz- und Kühlkreise des Raums (Integration heat_control, sensor.<raum>_heat_control),
//   links die Kreise, rechts der Editor mit Abschnitten; bearbeitet wird ein Entwurf, „Speichern“ schickt heat_control/save.
// Reiter Haus · Urlaub: hausweite Werte (Urlaub, Abwesenheit, Außensensor + Mittelwerte) → heat_control/house.
// Reiter Quellen der Karte: Thermostat, Ist-Temperatur, Ventilstellung der Heizkarte (input_text.heizung_sensoren_<raum>).
// Nutzt Auswahlfenster und Bildschirmtastatur der Licht-Einstellungen (_pkShow, _kbOpen).
const HC_TABS = ['Heizungssteuerung', 'Haus · Urlaub', 'Quellen der Karte'];
const HC_HOUSE = 'sensor.haus_heat_control';
const hcId = raum => raum ? `sensor.${raum}_heat_control` : null;
const HC_SECS = { heat: [['stat', 'Übersicht'], ['temp', 'Temperaturen'], ['dev', 'Geräte · Fenster'], ['pres', 'Anwesenheit'], ['lim', 'Heizgrenze']],
  cool: [['stat', 'Übersicht'], ['temp', 'Temperaturen'], ['dev', 'Geräte · Fenster'], ['pres', 'Anwesenheit'], ['lim', 'Kühlen · Heizen']] };
const HC_PER = [['night', 'Nachts'], ['morning', 'Morgens'], ['midday', 'Mittags'], ['afternoon', 'Nachmittags'], ['evening', 'Abends']];
const HC_BASES = [['now', 'Aktuell'], ['1d', '1 Tag'], ['7d', '1 Woche'], ['30d', '1 Monat'], ['365d', '1 Jahr']];
const HC_BASIS_DAYS = { '1d': 1, '7d': 7, '30d': 30, '365d': 365 };
const HC_ALARM = { disarmed: 'Unscharf', armed_away: 'Scharf · abwesend', armed_home: 'Scharf · zuhause', armed_night: 'Scharf · Nacht', armed_vacation: 'Scharf · Urlaub', triggered: 'Alarm!', arming: 'Wird scharf', pending: 'Verzögerung' };
const HC_STATUS = { home: 'Zuhause', away: 'Abwesend', vacation: 'Urlaub', return: 'Rückkehr (Vorheizen)' };
const HC_TT = [4.5, 32, .5, ' °C'], HC_OO = [-20, 35, .5, ' °C'];
const HC_NUM = {
  'temps.night': HC_TT, 'temps.morning': HC_TT, 'temps.midday': HC_TT, 'temps.afternoon': HC_TT, 'temps.evening': HC_TT, 'temps.fixed': HC_TT, 'temps.away': HC_TT, 'temps.vacation': HC_TT, 'temps.frost': [4.5, 12, .5, ' °C'],
  window_delay_s: [0, 600, 10, ' s'], hold_hours: [.5, 24, .5, ' h'], hysteresis: [.2, 3, .1, ' K'], both_below: HC_OO,
  'limit.on': HC_OO, 'limit.off': HC_OO, 'cool_limit.on': HC_OO, 'cool_limit.off': HC_OO, 'heat_limit.on': HC_OO, 'heat_limit.off': HC_OO,
  away_delay_min: [0, 240, 5, ' min'], vacation_preheat_h: [0, 48, 1, ' h'], vacation_away_h: [0, 240, 6, ' h'],
};
const hcGet = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const hcSet = (o, p, v) => { const ks = p.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k] || (a[k] = {}), o)[last] = v; };
const hcT = v => v == null ? '--' : de(v, 1) + ' °C';
const hcHm = iso => { if (!iso) return ''; const d = new Date(iso), n = new Date(); const hm = d.toTimeString().slice(0, 5); return d.toDateString() === n.toDateString() ? hm : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + hm; };
const HC_CSS = `<style>
.hcavg{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:2px 0 4px}
.hcavg div{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:8px;background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000}
.hcavg div.on{box-shadow:inset 0 2px 5px #000,0 0 0 1.5px var(--acc)}
.hcavg b{font:500 14px 'Share Tech Mono',monospace;color:var(--acc)}.hcavg small{font-size:9.5px;letter-spacing:1px;color:#979ca5;text-transform:uppercase}
.hcavg i{font-style:normal;font-size:9px;color:#8a6a4a}
.hcbig{display:flex;align-items:baseline;gap:14px;padding:4px 0 6px}
.hcbig b{font:500 30px 'Share Tech Mono',monospace;color:var(--acc)}.hcbig span{font-size:13px;color:#c9ccd2;letter-spacing:.6px}
.hcdev{font-size:11px;color:#9a9fa8;letter-spacing:.4px;line-height:1.6}
.hcdev b{color:#c9ccd2;font-weight:600}.hcdev i{font-style:normal;color:#ff9f2e}
.hcin{width:168px}
#hcp0,#hcp1{flex:1 1 auto;height:300px}
</style>`;
class RPHeatingSettings extends RPLightSettings {
  get meta() { return this.variants().full; }
  variants() { return { full: { bw: 1000, mh: 392, fw: false, fh: true, maxh: 392 } }; }
  static getStubConfig() { return {}; }
  norm(c) { const cl = c.climate || {}; return { raum: c.raum || null, color: c.color || '#ff8a4c', y: { entity: cl.entity || c.entity || null, current: cl.current || null, valve: cl.valve || null } }; }
  _area() { return raumOf(this, this._c); }
  _q() { return hsSrcs(this._hass, this._area(), this._c.y); }
  watch() {
    const q = this._q(), r = this._area(), list = this._hcList() || [], H = this._hcH() || {}, f = H.facts || {};
    const ents = list.flatMap(c => [...(c.devices || []), ...(c.windows || []), c.sensor_in, c.outdoor_entity]);
    return [hsId(r), q.climate, q.current, q.valve, hcId(r), HC_HOUSE, f.presence_entity, f.alarm_entity, ...ents].filter(Boolean);
  }
  html() {
    const tab = this._htab || 0;
    return `${LSET_CSS}${HSET_CSS}${HC_CSS}<div class="lset" id="ls" style="--acc:${this._c.color}">
      <div class="lseg" style="grid-template-columns:repeat(${HC_TABS.length},1fr)">${HC_TABS.map((t, i) => `<div class="lsg${i === tab ? ' on' : ''}" id="hcg${i}" data-act="htab:${i}">${t}</div>`).join('')}</div>
      <div class="lpg" id="hcp0"${tab ? ' hidden' : ''}><div class="lmo"><div class="lmrail zsrail" id="hcrail"></div><div class="zsed" id="hced"></div></div></div>
      <div class="lpg" id="hcp1"${tab !== 1 ? ' hidden' : ''}><div class="zsed" id="hhed"></div></div>
      <div class="lpg" id="hcp2"${tab !== 2 ? ' hidden' : ''} style="flex:1 1 auto;height:300px">
        <div class="lcol" style="width:420px;flex:none">
          <div class="cap eng">Quellen der Heizkarte<span style="color:#979ca5;letter-spacing:1px;margin-left:10px">· Tippen = ändern</span></div>
          ${HSET_ROWS.map(([k, t]) => `<div class="hsr" id="hs-${k}" data-act="qsel:${k}"><div class="t">${t}<i id="hs-${k}-h"></i></div><b id="hs-${k}-n">--</b><small id="hs-${k}-v">--</small></div>`).join('')}
          <div class="lhint" id="hs-hint"></div>
        </div>
        <div class="lcol" style="flex:1">
          <div class="cap eng" id="hs-head">Auswahl</div>
          <input class="hsq" id="hs-q" placeholder="Suchen …" autocomplete="off">
          <div class="hsl" id="hs-l"></div>
          <div class="lmsg" id="hs-msg"></div>
        </div>
      </div>
      <div class="lmpk" id="lmpk" hidden></div>
      <div class="lmpk lkb" id="lkb" hidden></div>
    </div>`;
  }
  bind() {
    const q = this.$('hs-q'); if (q) q.addEventListener('input', () => { this._f = q.value.trim().toLowerCase(); this._qList(); });
    const root = this.shadowRoot; if (this._hcBound) return; this._hcBound = true;
    root.addEventListener('input', ev => { if (ev.target.id === 'lmpkq') { this._moPkQ = ev.target.value; this._moPickList(); } });
    root.addEventListener('pointerdown', ev => {
      const t = ev.target.closest && ev.target.closest('[data-hcstep]'); if (!t) return;
      const [w, key, dir] = t.dataset.hcstep.split('|'), d = w === 'h' ? (this._hh || {}).d : (this._hz || {}).d; if (!d) return;
      ev.preventDefault();
      let n = 0;
      const go = () => {
        const f = n < 8 ? 1 : n < 20 ? 4 : 12; n++;
        const [lo, hi, st] = HC_NUM[key]; hcSet(d, key, clamp(Math.round((Number(hcGet(d, key)) + dir * st * f) / st) * st, lo, hi));
        if (w === 'h') this._hhDirty(); else this._hcDirty();
      };
      go(); clearInterval(this._hcRep);
      const to = setTimeout(() => { this._hcRep = setInterval(go, 110); }, 420);
      const up = () => { clearTimeout(to); clearInterval(this._hcRep); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    root.addEventListener('change', ev => {
      const t = ev.target, ds = t.dataset || {};
      if (ds.hct && this._hz && this._hz.d && /^\d\d:\d\d/.test(t.value)) { this._hz.d.times[ds.hct] = t.value.slice(0, 5); this._hcDirty(); }
      if (ds.hhdt && this._hh && this._hh.d) { this._hh.d[ds.hhdt] = /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(t.value) ? t.value.slice(0, 16) : ''; this._hhDirty(); }
    });
  }
  update() { this._hcPaint(); this._hhPaint(); this._qPaint(); this._qList(); }
  act(cmd, arg) {
    if (cmd === 'htab') { this._htab = +arg; HC_TABS.forEach((_, i) => { this.$('hcg' + i).classList.toggle('on', i === this._htab); this.$('hcp' + i).hidden = i !== this._htab; }); return; }
    if (cmd === 'mopk') { this._moPickAct(arg); return; }
    if (cmd === 'kb') { this._kbKey(arg); return; }
    if (cmd.startsWith('hc')) { this._hcAct(cmd.slice(2), arg); return; }
    if (cmd.startsWith('hh')) { this._hhAct(cmd.slice(2), arg); return; }
    if (cmd === 'qsel' || cmd === 'qset') this._qAct(cmd, arg);
  }
  _hcList() { const s = this._st(hcId(this._area())); return s ? s.attributes.circuits || [] : null; }
  _hcH() { const s = this._st(HC_HOUSE); return s ? s.attributes : null; }
  _ws(type, extra) { return this._hass.callWS({ type: 'heat_control/' + type, ...extra }); }
  _nm(id) { const s = this._st(id); return s ? s.attributes.friendly_name || id : id + ' (fehlt)'; }
  // Außen-Mittelwerte: aus sensor.haus_heat_control, für andere Sensoren einmal per WebSocket nachladen
  _avg(e) {
    if (!e) return null;
    const H = this._hcH(), a = H && H.outdoor && H.outdoor[e]; if (a) return a;
    const c = this._avgC || (this._avgC = {});
    if (!c[e] && this._hass) { c[e] = { loading: true }; this._ws('averages', { entity_id: e }).then(r => { c[e] = r.result; this._hcPaint(); this._hhPaint(); }).catch(() => { c[e] = { failed: true }; }); }
    return c[e].loading || c[e].failed ? null : c[e];
  }
  _avgHtml(e, basis) {
    const a = this._avg(e);
    if (!a) return '<div class="lhint">Mittelwerte werden geladen …</div>';
    return `<div class="hcavg">${HC_BASES.map(([b, n]) => { const days = HC_BASIS_DAYS[b], cov = a[b + '_days'];
      return `<div class="${b === basis ? 'on' : ''}"><small>${n}</small><b>${a[b] == null ? '--' : de(a[b], 1) + '°'}</b>${days && cov != null && cov < days * .9 ? `<i>nur ${de(cov, cov < 2 ? 1 : 0)} T</i>` : ''}</div>`; }).join('')}</div>`;
  }
  // ================================================================ Reiter Heizungssteuerung
  _hcDirty() { const z = this._hz; z.dirty = true; z.del = false; this._hcPaint(); }
  _hcMsg(t, ok = true) { const z = this._hz; z.msg = t; z.msgOk = ok; this._hcPaint(); clearTimeout(z.mt); z.mt = setTimeout(() => { z.msg = ''; this._hcPaint(); }, 4000); }
  _hcPaint() {
    const rail = this.$('hcrail'), ed = this.$('hced'); if (!rail || !ed) return;
    const r = this._area(), list = this._hcList();
    if (!r || !list) {
      this._html(rail, '');
      this._html(ed, `<div class="lmmsg">${!r ? 'Kein Raum-Kürzel – Panel-Option <b>raum:</b> fehlt.' : `Die Heizungssteuerung ist in Home Assistant nicht eingerichtet (Integration <b>heat_control</b>, Sensor <b>${hcId(r)}</b> fehlt).`}</div>`);
      return;
    }
    const z = this._hz || (this._hz = { sel: null, sec: 'stat' });
    if (!list.find(c => c.id === z.sel) && !(z.keep > Date.now())) { z.sel = list[0] ? list[0].id : null; z.dirty = false; z.d = null; }
    const live = list.find(c => c.id === z.sel);
    if (live && !z.dirty) z.d = JSON.parse(JSON.stringify(live));
    if (!z.sel) z.d = null;
    const item = c => {
      const led = !c.enabled ? '' : c.manual || c.window || ['window', 'season', 'off', 'cooling', 'heatpump'].includes(c.key) ? 'act' : 'rdy';
      const t = !c.enabled ? 'inaktiv' : (c.label || '') + (c.target != null ? ' · ' + hcT(c.target) : c.hvac === 'off' ? '' : '');
      return `<div class="zsit${c.id === z.sel ? ' on' : ''}${c.enabled ? '' : ' off'}" data-act="hcsel:${c.id}"><span class="zsd ${led}"></span><span class="dn"><b>${escH(c.name)}</b><small>${c.kind === 'cool' ? (c.role === 'heatpump' ? 'Wärmepumpe · ' : 'Kühlen · ') : ''}${escH(t)}</small></span></div>`;
    };
    this._html(rail, `<div class="zslist">${list.map(item).join('') || '<div class="lmempty">Noch keine Kreise.</div>'}</div>
      <div class="hk" data-act="hcnew:heat" style="--c:#3ddc84"><i></i>+ Heizkreis</div><div class="hk" data-act="hcnew:cool" style="--c:#5fb4ff"><i></i>+ Kühlkreis / Klima</div>`);
    if (!z.d) { this._html(ed, '<div class="lmmsg">Noch kein Kreis vorhanden.<br>Mit <b>+ Heizkreis</b> legst du einen an.</div>'); return; }
    const d = z.d, secs = HC_SECS[d.kind] || HC_SECS.heat;
    if (!secs.find(s => s[0] === z.sec)) z.sec = 'stat';
    const hd = `<div class="zshd"><div class="zsname" data-act="hcname">${escH(d.name)}</div>
      <div class="hk${d.enabled ? ' on' : ''}" data-act="hcset:enabled|t" style="--c:${d.enabled ? '#3ddc84' : 'var(--acc)'}"><i></i>${d.enabled ? 'Aktiv' : 'Inaktiv'}</div>
      <div class="zsseg">${secs.map(([s, n]) => `<div class="lsg${z.sec === s ? ' on' : ''}" data-act="hcsec:${s}">${n}</div>`).join('')}</div></div>`;
    const cols = this._hcRows(d, z.sec, live || d);
    const body = `<div class="lmbody">${cols.map(x => `<div class="lmcol">${x.join('')}</div>`).join('')}</div>`;
    const ft = `<div class="zsft"><div class="lmsg" id="hcmsg">${escH(z.msg || '')}</div>
      <div class="hk${z.del ? ' on' : ''}" data-act="hcdel" style="--c:#ff6b6b"><i></i>${z.del ? 'Wirklich löschen?' : 'Löschen'}</div>
      ${z.dirty ? '<div class="hk" data-act="hccancel"><i></i>Verwerfen</div>' : ''}
      <div class="hk${z.dirty ? ' on' : ''}" data-act="hcsave" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
    const ae = this.shadowRoot.activeElement;
    if (ae && ae.tagName === 'INPUT' && ed.contains(ae)) return;
    this._html(ed, hd + body + ft);
    const m = this.shadowRoot.getElementById('hcmsg'); if (m) m.style.color = z.msgOk === false ? '#ff8a8a' : '#3ddc84';
  }
  _hcRows(d, sec, live) {
    const L = [[], []], h = (c, t) => L[c].push(`<div class="lmh">${t}</div>`), hint = (c, t) => L[c].push(`<div class="lhint" style="margin:-2px 0 4px">${t}</div>`);
    const row = (c, l, ctl, sub) => L[c].push(`<div class="lmr${sub ? ' sub' : ''}"><span>${l}</span>${ctl}</div>`);
    const stack = (c, l, ctl) => L[c].push(`<div class="lmr stack"><span>${l}</span>${ctl}</div>`);
    const seg = (key, o) => `<div class="lmseg">${o.map(([v, n]) => `<div class="hk${hcGet(d, key) === v ? ' on' : ''}" data-act="hcset:${key}|${v}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`;
    const tog = (key, a = 'An', b = 'Aus') => { const v = hcGet(d, key); return `<div class="hk${v ? ' on' : ''}" data-act="hcset:${key}|t" style="--c:${v ? '#3ddc84' : 'var(--acc)'}"><i></i>${v ? a : b}</div>`; };
    const num = key => { const [, , st, u] = HC_NUM[key], v = Number(hcGet(d, key)); return `<div class="lmst"><div class="hk" data-hcstep="c|${key}|-1">−</div><div class="dlcd">${de(v, st < 1 ? 1 : 0)}${u}</div><div class="hk" data-hcstep="c|${key}|1">+</div></div>`; };
    const ro = v => `<div class="lcd lmro">${v}</div>`;
    const pick = (what, label) => `<div class="hk lmen" data-act="hcpick:${what}" style="--c:var(--acc)"><i></i><span>${label}</span></div>`;
    const ents = (list, none) => !list.length ? none : list.length === 1 ? escH(this._nm(list[0])) : list.length + ' gewählt';
    const cool = d.kind === 'cool', H = this._hcH() || {}, f = H.facts || {}, set = H.settings || {};
    const outE = d.sensor_out || set.outdoor_sensor || '';
    if (sec === 'stat') {
      const L0 = live;
      h(0, 'Jetzt');
      L[0].push(`<div class="hcbig"><b>${L0.target != null ? hcT(L0.target) : L0.hvac === 'off' ? 'AUS' : '--'}</b><span>${escH(L0.label || '')}${L0.until ? ' · bis ' + hcHm(L0.until) : ''}</span></div>`);
      if (!d.enabled) hint(0, 'Kreis ist <b>inaktiv</b> – es wird nichts gesendet. Die Anzeige zeigt, was er tun würde.');
      row(0, 'Status', ro(escH(HC_STATUS[L0.status] || '–')));
      if (L0.note) hint(0, escH(L0.note));
      row(0, 'Ist-Temperatur', ro(hcT(L0.room_temp)));
      if (L0.offset) row(0, 'Ausgleich Raumsensor', ro((L0.offset > 0 ? '+' : '') + de(L0.offset, 1) + ' K'), true);
      if (L0.manual) { row(0, 'Von Hand gesetzt', `<div class="hk" data-act="hcreset" style="--c:#ff9f2e"><i></i>Aufheben</div>`); }
      if (L0.window) row(0, 'Fenster offen', ro(escH(this._nm(L0.window))));
      h(1, 'Geräte');
      L[1].push(`<div class="hcdev">${(L0.device_states || []).map(x => `<b>${escH(this._nm(x.entity_id))}</b><br>${escH(x.state || '–')} · Soll ${hcT(x.target)} · Ist ${hcT(x.current)}${x.pending ? ` · <i>wartet auf Bestätigung (${x.tries}.)</i>` : ''}`).join('<br>') || 'Keine Geräte gewählt.'}</div>`);
      h(1, 'Außen');
      row(1, escH(this._nm(outE)), ro(hcT(this._st(outE) ? Number(this._st(outE).state) : null)));
      const lim = cool ? d.cool_limit : d.limit;
      if (lim && lim.enabled) row(1, cool ? 'Kühlen erlaubt' : 'Heizgrenze', ro(cool ? (L0.season_cool ? 'ja' : 'nein') : (L0.season_heat === false ? 'aus' : 'heizen')), true);
      return L;
    }
    if (sec === 'temp') {
      stack(0, 'Betriebsart', seg('mode', [['schedule', 'Tageszeiten'], ['fixed', 'Festwert'], ['off', cool ? 'Aus' : 'Aus (Frostschutz)']]));
      const times = live.times_used || d.times;
      if (d.mode === 'schedule') {
        h(0, cool && d.follow_comfort ? 'Tageszeiten · vom Heizkreis' : 'Temperatur je Tageszeit');
        HC_PER.forEach(([p, n]) => row(0, `${n} <small style="color:#979ca5">ab ${escH((d.own_times ? d.times : times)[p] || '')}</small>`, cool && d.follow_comfort ? ro('Heizkreis') : num('temps.' + p)));
      } else if (d.mode === 'fixed') { h(0, 'Festwert'); row(0, 'Temperatur', cool && d.follow_comfort ? ro('Heizkreis') : num('temps.fixed')); }
      h(1, 'Wenn niemand da ist');
      if (cool) row(1, 'Bei Abwesenheit', seg('away_cool', [['temp', 'Temperatur'], ['off', 'Aus']]));
      if (!cool || d.away_cool === 'temp') { row(1, 'Abwesend', num('temps.away')); row(1, 'Urlaub', num('temps.vacation')); }
      if (!cool) { h(1, 'Schutz'); row(1, 'Frostschutz (Minimum)', num('temps.frost')); }
      if (cool) { h(1, 'Komfortwerte'); row(1, 'Wie Heizkreis', tog('follow_comfort', 'Ja', 'Nein')); }
      if (d.mode === 'schedule') {
        h(1, 'Beginn der Tageszeiten');
        row(1, 'Eigene Zeiten für diesen Kreis', tog('own_times', 'Ja', 'Nein'));
        if (d.own_times) HC_PER.forEach(([p, n]) => L[1].push(`<div class="zsslot"><b style="width:96px">${n.toUpperCase()}</b><input class="lmin" type="time" data-hct="${p}" value="${d.times[p]}"></div>`));
        else hint(1, 'Es gelten die Zeiten des Hauses (Einstellungen → Allgemein → Haus).');
      }
      return L;
    }
    if (sec === 'dev') {
      h(0, cool ? 'Klimaanlagen' : 'Thermostate');
      row(0, 'Geräte', pick('devices', ents(d.devices, 'Keine')));
      if (d.devices.length > 1) L[0].push(`<div class="zslamps">${d.devices.map(e => escH(this._nm(e))).join('<br>')}</div>`);
      if (cool && !d.devices.length) hint(0, 'Noch keine Klimaanlage in Home Assistant? Den Kreis trotzdem einrichten – sobald das Gerät eingebunden ist, hier auswählen.');
      h(0, 'Temperatursensoren');
      row(0, 'Innen', pick('sensor_in', d.sensor_in ? escH(this._nm(d.sensor_in)) : 'vom Gerät'));
      row(0, 'Außen', pick('sensor_out', d.sensor_out ? escH(this._nm(d.sensor_out)) : 'wie Haus'));
      if (!cool) { row(0, 'Ausgleich mit Innensensor', tog('compensate')); hint(0, d.compensate ? 'Misst das Thermostat am Heizkörper mehr als der Raumsensor, wird der Sollwert um die Differenz erhöht (max. ±3 K, höchstens alle 15 min).' : 'Der Innensensor wird angezeigt; das Thermostat regelt mit seinem eigenen Fühler.'); }
      h(1, 'Fensterkontakte');
      row(1, 'Kontakte', pick('windows', ents(d.windows, 'Keine')));
      if (d.windows.length > 1) L[1].push(`<div class="zslamps">${d.windows.map(e => `${escH(this._nm(e))} · ${escH((this._st(e) || {}).state || '–')}`).join('<br>')}</div>`);
      row(1, 'Reagieren nach', num('window_delay_s'));
      row(1, 'Gekippt zählt als offen', tog('window_tilted', 'Ja', 'Nein'));
      hint(1, cool ? 'Ist ein Kontakt offen, geht die Klimaanlage aus.' : `Ist ein Kontakt offen, geht der Kreis auf Frostschutz (${hcT(d.temps.frost)}) und danach zurück.`);
      return L;
    }
    if (sec === 'pres') {
      h(0, 'Zuhause heißt …');
      row(0, 'Jemand anwesend', tog('use_presence', 'Ja', 'egal'));
      row(0, 'Alarmanlage unscharf', tog('use_alarm', 'Ja', 'egal'));
      if (d.use_presence && d.use_alarm) row(0, 'Verknüpfung', seg('link', [['or', 'ODER'], ['and', 'UND']]));
      hint(0, 'Sonst gilt der Kreis nach der Verzögerung als abwesend. Urlaub stellst du unter <b>Haus · Urlaub</b> ein.');
      h(0, 'Gerade');
      row(0, 'Anwesenheit', ro(f.presence == null ? '–' : f.presence ? 'jemand da' : 'niemand da'), true);
      row(0, 'Alarmanlage', ro(escH(HC_ALARM[f.alarm] || f.alarm || '–')), true);
      h(1, 'Von Hand geändert');
      stack(1, 'Hand-Wert gilt', seg('hold', [['period', 'Bis nächste Tageszeit'], ['hours', 'Stunden'], ['never', 'Nie (Plan gilt)']]));
      if (d.hold !== 'never') row(1, d.hold === 'hours' ? 'Dauer' : 'Höchstens (Festwert/Abwesend)', num('hold_hours'), true);
      hint(1, 'Dreht jemand am Thermostat oder am Dashboard, bleibt der Wert so lange. Fenster, Heizgrenze und Statuswechsel beenden ihn.');
      return L;
    }
    // sec === 'lim'
    const limRows = (c, key, isCool, title) => {
      const lim = d[key];
      h(c, title);
      row(c, 'Verwenden', tog(key + '.enabled'));
      if (!lim.enabled) return;
      stack(c, 'Grundlage', seg(key + '.basis', HC_BASES));
      row(c, isCool ? 'An über' : 'An unter', num(key + '.on'));
      row(c, isCool ? 'Aus unter' : 'Aus über', num(key + '.off'));
    };
    if (!cool) {
      limRows(0, 'limit', false, 'Heizgrenze (Außentemperatur)');
      hint(0, d.limit.enabled ? 'Unter „an“ wird geheizt, über „aus“ nicht (Frostschutz). Dazwischen bleibt es, wie es war.' : 'Aus: es wird unabhängig von draußen geheizt.');
      h(1, 'Außen · Mittelwerte');
      L[1].push(this._avgHtml(outE, d.limit.enabled ? d.limit.basis : null));
      hint(1, escH(this._nm(outE)) + ' · aus der Langzeitstatistik von Home Assistant.');
      return L;
    }
    h(0, 'Gerät');
    stack(0, 'Art', seg('role', [['cool', 'Nur kühlen'], ['heatpump', 'Wärmepumpe (heizt + kühlt)']]));
    limRows(0, 'cool_limit', true, 'Kühlen erlaubt (Außentemperatur)');
    if (d.role === 'heatpump') {
      h(1, 'Heizen');
      stack(1, 'Wer heizt', seg('heat_by', [['thermostats', 'Thermostate'], ['heatpump', 'Wärmepumpe'], ['both', 'Beide']]));
      if (d.heat_by === 'both') row(1, 'Thermostate helfen unter', num('both_below'), true);
      if (d.heat_by !== 'thermostats') {
        const heats = (this._hcList() || []).filter(c => c.kind === 'heat');
        if (heats.length > 1) stack(1, 'Temperaturen vom Heizkreis', seg('heat_ref', [['', 'Erster'], ...heats.map(c => [c.id, escH(c.name)])]));
        limRows(1, 'heat_limit', false, 'Wärmepumpe heizt (Außentemperatur)');
        row(1, 'Umschalten ab ± (Hysterese)', num('hysteresis'), true);
      }
    }
    h(1, 'Außen · Mittelwerte');
    L[1].push(this._avgHtml(outE, d.cool_limit.enabled ? d.cool_limit.basis : null));
    hint(1, 'Heizen und Kühlen laufen nie gleichzeitig: kühlt die Klimaanlage, gehen die Thermostate des Raums auf Frostschutz.');
    return L;
  }
  async _hcAct(op, arg) {
    const z = this._hz || (this._hz = { sel: null, sec: 'stat' }), d = z.d, r = this._area();
    const msg = (t, ok) => this._hcMsg(t, ok), err = e => msg('Fehler: ' + ((e && e.message) || e), false);
    if (op === 'sel') { if (z.sel === arg) return; z.sel = arg; z.dirty = false; z.d = null; z.del = false; z.msg = ''; this._hcPaint(); return; }
    if (op === 'sec') { z.sec = arg; this._hcPaint(); return; }
    if (op === 'new') {
      if (z.dirty) { msg('Erst speichern oder verwerfen.', false); return; }
      const cool = arg === 'cool', q = this._q();
      try {
        const res = await this._ws('save', { circuit: { room: r, kind: arg, name: cool ? 'Klimaanlage' : 'Heizkörper', enabled: false, devices: !cool && q.climate ? [q.climate] : [] } });
        z.sel = res.result; z.d = null; z.dirty = false; z.keep = Date.now() + 5000; z.sec = cool ? 'dev' : 'temp'; msg('Kreis angelegt (inaktiv).');
      } catch (e) { err(e); }
      return;
    }
    if (op === 'cancel') { z.dirty = false; z.d = null; this._hcPaint(); return; }
    if (!d) return;
    if (op === 'name') { this._kbOpen('Name des Kreises', d.name, 40, v => { d.name = v.trim() || d.name; this._hcDirty(); }); return; }
    if (op === 'set') { const [key, v] = arg.split('|'); hcSet(d, key, v === 't' ? !hcGet(d, key) : v); this._hcDirty(); return; }
    if (op === 'pick') {
      const temp = s => s.attributes.device_class === 'temperature' || /°C/.test(s.attributes.unit_of_measurement || '');
      const win = s => s.entity_id.startsWith('input_boolean.') || (s.entity_id.startsWith('binary_sensor.') && ['window', 'door', 'opening', 'garage_door'].includes(s.attributes.device_class))
        || (s.entity_id.startsWith('sensor.') && ['open', 'closed', 'tilted'].includes(s.state));
      const P = {
        devices: [{ l: d.kind === 'cool' ? 'Klimaanlagen' : 'Thermostate', dom: ['climate'], multi: true }, d.devices, sel => { d.devices = sel; }],
        sensor_in: [{ l: 'Innen-Temperatur (leer = vom Gerät)', dom: ['sensor'], fit: temp }, d.sensor_in ? [d.sensor_in] : [], sel => { d.sensor_in = sel[0] || ''; }],
        sensor_out: [{ l: 'Außen-Temperatur (leer = wie Haus)', dom: ['sensor'], fit: temp }, d.sensor_out ? [d.sensor_out] : [], sel => { d.sensor_out = sel[0] || ''; }],
        windows: [{ l: 'Fensterkontakte', dom: ['binary_sensor', 'sensor', 'input_boolean'], fit: win, multi: true }, d.windows, sel => { d.windows = sel; }],
      }[arg];
      if (P) this._pkShow(P[0], [...P[1]], sel => { P[2](sel); this._hcDirty(); });
      return;
    }
    if (op === 'reset') { try { await this._ws('reset_manual', { circuit_id: z.sel }); msg('Hand-Wert aufgehoben.'); } catch (e) { err(e); } return; }
    if (op === 'del') {
      if (!z.del) { z.del = true; this._hcPaint(); clearTimeout(z.dt); z.dt = setTimeout(() => { z.del = false; this._hcPaint(); }, 4000); return; }
      try { await this._ws('delete', { circuit_id: z.sel }); z.sel = null; z.d = null; z.dirty = false; z.del = false; msg('Kreis gelöscht.'); } catch (e) { err(e); }
      return;
    }
    if (op === 'save') {
      const live = (this._hcList() || []).find(c => c.id === z.sel) || {};
      try {
        const keys = ['name', 'enabled', 'devices', 'mode', 'temps', 'own_times', 'times', 'use_presence', 'use_alarm', 'link', 'sensor_in', 'sensor_out', 'compensate', 'limit',
          'windows', 'window_delay_s', 'window_tilted', 'hold', 'hold_hours', 'role', 'heat_by', 'both_below', 'hysteresis', 'heat_ref', 'follow_comfort', 'away_cool', 'cool_limit', 'heat_limit'];
        const res = await this._ws('save', { circuit: { id: z.sel, room: r, kind: d.kind, ...Object.fromEntries(keys.map(k => [k, d[k]])) } });
        z.sel = res.result; z.dirty = false; z.keep = Date.now() + 5000;
        // Innensensor des ersten Heizkreises = Ist-Temperatur der Heizkarte
        const first = (this._hcList() || []).find(c => c.kind === 'heat');
        if (d.kind === 'heat' && (!first || first.id === z.sel) && d.sensor_in !== live.sensor_in && d.sensor_in) {
          try { await hsWrite(this, r, { ...hsSel(this._hass, r), current: d.sensor_in }); } catch (e) { /* Karte behält ihre Quelle */ }
        }
        msg(d.devices.length ? 'Gespeichert.' : 'Gespeichert – noch keine Geräte gewählt.', !!d.devices.length);
      } catch (e) { err(e); }
    }
  }
  // ================================================================ Reiter Haus · Urlaub
  _hhDirty() { const z = this._hh; z.dirty = true; this._hhPaint(); }
  _hhMsg(t, ok = true) { const z = this._hh; z.msg = t; z.msgOk = ok; this._hhPaint(); clearTimeout(z.mt); z.mt = setTimeout(() => { z.msg = ''; this._hhPaint(); }, 4000); }
  _hhPaint() {
    const ed = this.$('hhed'); if (!ed) return;
    const H = this._hcH();
    if (!H) { this._html(ed, '<div class="lmmsg">Die Heizungssteuerung ist in Home Assistant nicht eingerichtet (<b>sensor.haus_heat_control</b> fehlt).</div>'); return; }
    const z = this._hh || (this._hh = {});
    if (!z.dirty) z.d = JSON.parse(JSON.stringify(H.settings || {}));
    const d = z.d, f = H.facts || {}, L = [[], []];
    const h = (c, t) => L[c].push(`<div class="lmh">${t}</div>`), hint = (c, t) => L[c].push(`<div class="lhint" style="margin:-2px 0 4px">${t}</div>`);
    const row = (c, l, ctl, sub) => L[c].push(`<div class="lmr${sub ? ' sub' : ''}"><span>${l}</span>${ctl}</div>`);
    const tog = (key, a = 'An', b = 'Aus') => `<div class="hk${d[key] ? ' on' : ''}" data-act="hhset:${key}" style="--c:${d[key] ? '#3ddc84' : 'var(--acc)'}"><i></i>${d[key] ? a : b}</div>`;
    const num = (key, zero) => { const [, , st, u] = HC_NUM[key], v = Number(d[key]); return `<div class="lmst"><div class="hk" data-hcstep="h|${key}|-1">−</div><div class="dlcd">${zero && !v ? zero : de(v, st < 1 ? 1 : 0) + u}</div><div class="hk" data-hcstep="h|${key}|1">+</div></div>`; };
    const ro = v => `<div class="lcd lmro">${v}</div>`;
    h(0, 'Urlaub eintragen');
    row(0, 'Urlaub', tog('vacation_enabled', 'Eingetragen', 'Aus'));
    if (d.vacation_enabled) {
      row(0, 'Von', `<input class="lmin hcin" type="datetime-local" data-hhdt="vacation_from" value="${escH(d.vacation_from || '')}">`, true);
      row(0, 'Bis (Rückkehr)', `<input class="lmin hcin" type="datetime-local" data-hhdt="vacation_to" value="${escH(d.vacation_to || '')}">`, true);
      row(0, 'Vorheizen vor Rückkehr', num('vacation_preheat_h'), true);
    }
    h(0, 'Automatisch Urlaub, wenn …');
    row(0, 'Alarmanlage auf Urlaub', tog('vacation_alarm', 'Ja', 'Nein'));
    row(0, 'Länger weg als', num('vacation_away_h', 'nie'));
    hint(0, 'Im Urlaub gilt je Kreis die Urlaubstemperatur. Vor dem eingetragenen Ende wird wieder auf Tageszeit geheizt.');
    h(1, 'Abwesenheit');
    row(1, 'Abwesend erst nach', num('away_delay_min'));
    row(1, 'Gerade', ro(escH(HC_STATUS[(this._st(HC_HOUSE) || {}).state] || '–')), true);
    if (f.vacation || f.returning) row(1, f.returning ? 'Rückkehr' : 'Urlaub weil', ro(escH(f.returning ? 'vorheizen' : f.vacation_reason || '')), true);
    if (f.away_since) row(1, 'Weg seit', ro(hcHm(f.away_since)), true);
    h(1, 'Außentemperatur');
    row(1, 'Sensor', `<div class="hk lmen" data-act="hhpick" style="--c:var(--acc)"><i></i><span>${d.outdoor_sensor ? escH(this._nm(d.outdoor_sensor)) : 'Keiner'}</span></div>`);
    if (d.outdoor_sensor) { row(1, 'Aktuell', ro(hcT(this._st(d.outdoor_sensor) ? Number(this._st(d.outdoor_sensor).state) : null)), true); L[1].push(this._avgHtml(d.outdoor_sensor, null)); }
    const ft = `<div class="zsft"><div class="lmsg" id="hhmsg">${escH(z.msg || '')}</div>${z.dirty ? '<div class="hk" data-act="hhcancel"><i></i>Verwerfen</div>' : ''}<div class="hk${z.dirty ? ' on' : ''}" data-act="hhsave" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
    const ae = this.shadowRoot.activeElement;
    if (ae && ae.tagName === 'INPUT' && ed.contains(ae)) return;
    this._html(ed, `<div class="cap eng">Haus · gilt für alle Räume</div><div class="lmbody">${L.map(x => `<div class="lmcol">${x.join('')}</div>`).join('')}</div>${ft}`);
    const m = this.shadowRoot.getElementById('hhmsg'); if (m) m.style.color = z.msgOk === false ? '#ff8a8a' : '#3ddc84';
  }
  async _hhAct(op, arg) {
    const z = this._hh; if (!z || !z.d) return;
    if (op === 'set') { z.d[arg] = !z.d[arg]; this._hhDirty(); return; }
    if (op === 'cancel') { z.dirty = false; this._hhPaint(); return; }
    if (op === 'pick') {
      const temp = s => s.attributes.device_class === 'temperature' || /°C/.test(s.attributes.unit_of_measurement || '');
      this._pkShow({ l: 'Außen-Temperatur', dom: ['sensor'], fit: temp }, z.d.outdoor_sensor ? [z.d.outdoor_sensor] : [], sel => { z.d.outdoor_sensor = sel[0] || ''; this._hhDirty(); });
      return;
    }
    if (op === 'save') {
      try { await this._ws('house', { settings: z.d }); z.dirty = false; this._hhMsg('Gespeichert.'); } catch (e) { this._hhMsg('Fehler: ' + ((e && e.message) || e), false); }
    }
  }
  // ================================================================ Reiter Quellen der Karte
  _qPaint() {
    const h = this._hass; if (!h || !this.$('hs-head')) return;
    const q = this._q(), sel = this._sel || 'current', raum = this._area(), admin = !!(h.user && h.user.is_admin);
    HSET_ROWS.forEach(([k]) => {
      const id = q[k], st = id && h.states[id];
      this.$('hs-' + k).classList.toggle('on', k === sel);
      this.$('hs-' + k + '-h').textContent = q.how[k];
      this.$('hs-' + k + '-n').textContent = id ? (st && st.attributes.friendly_name) || id : 'Attribut des Thermostats';
      this.$('hs-' + k + '-v').textContent = !id ? (k === 'current' ? 'current_temperature' : 'valve_position') + ' von ' + (q.climate || '–')
        : id + ' · ' + (st ? (k === 'climate' ? st.state + (st.attributes.current_temperature != null ? ' · ' + st.attributes.current_temperature + ' °C' : '') : st.state + ' ' + hsUnit(h, id)) : 'nicht gefunden');
    });
    this.$('hs-head').textContent = 'Auswahl · ' + HSET_ROWS.find(r => r[0] === sel)[1];
    this._html(this.$('hs-hint'), !raum ? 'Kein Raum-Kürzel – Auswahl kann nicht gespeichert werden (Panel-Option <b>raum:</b>).'
      : h.states[hsId(raum)] ? `Gespeichert in <b>${hsId(raum)}</b>. Die Heizkarte übernimmt Änderungen sofort.`
        : admin ? `Beim ersten Speichern wird der Helfer <b>${hsId(raum)}</b> angelegt.` : `Helfer <b>${hsId(raum)}</b> fehlt – Auswahl nur als Admin möglich.`);
  }
  _qList() {
    const h = this._hass; if (!h || !this.$('hs-l')) return;
    const sel = this._sel || 'current', q = this._q(), cur = hsSel(h, this._area())[sel] || '', f = this._f || '';
    const reg = h.entities || {}, dev = q.climate && reg[q.climate] && reg[q.climate].device_id;
    const fit = id => sel === 'climate' ? id.startsWith('climate.') : id.startsWith('sensor.') && (sel === 'current' ? /°/.test(hsUnit(h, id)) : hsUnit(h, id) === '%' || /level|valve|ventil|position/i.test(id));
    const match = id => !f || id.toLowerCase().includes(f) || String((h.states[id].attributes || {}).friendly_name || '').toLowerCase().includes(f);
    const all = Object.keys(h.states).filter(id => fit(id) && match(id));
    const same = sel === 'climate' ? [] : all.filter(id => dev && reg[id] && reg[id].device_id === dev), rest = all.filter(id => !same.includes(id)).sort().slice(0, 120);
    const row = id => { const st = h.states[id]; return `<div class="hpi${id === cur ? ' on' : ''}" data-act="qset:${sel}|${id}"><b>${escH(st.attributes.friendly_name || id)}</b><small>${id} · ${escH(st.state)} ${escH(hsUnit(h, id))}</small></div>`; };
    const y = this._c.y[sel === 'climate' ? 'entity' : sel], au = q.auto[sel];
    const autoTxt = sel === 'climate' ? 'Aus der Karten-Konfiguration: ' + (y || '–') : y ? 'Aus der Karten-Konfiguration: ' + y : au ? 'Sensor des Thermostats: ' + au : 'Wert des Thermostats (Attribut)';
    this._html(this.$('hs-l'), `<div class="hpi${cur ? '' : ' on'}" data-act="qset:${sel}|"><b>${sel === 'climate' ? 'Standard' : 'Automatisch'}</b><small>${escH(autoTxt)}</small></div>`
      + (same.length ? '<div class="hpg">Gleiches Gerät</div>' + same.map(row).join('') : '')
      + (rest.length ? `<div class="hpg">${sel === 'climate' ? 'Thermostate' : 'Weitere Sensoren'}</div>` + rest.map(row).join('') : '<div class="hpg">Keine passenden Einträge</div>'));
  }
  _qMsg(t, ok = true) { const m = this.$('hs-msg'); if (m) { m.textContent = t; m.style.color = ok ? '#3ddc84' : '#ff8a8a'; } clearTimeout(this._qmt); this._qmt = setTimeout(() => { const m2 = this.$('hs-msg'); if (m2) m2.textContent = ''; }, 4000); }
  async _qAct(cmd, arg) {
    if (cmd === 'qsel') { this._sel = arg; this._f = ''; const q = this.$('hs-q'); if (q) q.value = ''; this._qPaint(); this._qList(); return; }
    const [k, id] = arg.split('|'), m = hsSel(this._hass, this._area());
    if (id) m[k] = id; else delete m[k];
    try { await hsWrite(this, this._area(), m); this._qMsg('Gespeichert.'); } catch (e) { this._qMsg('Fehler: ' + ((e && e.message) || e), false); }
  }
}

// ---------------------------------------------------------------- Lüftungs-Einstellungen (Einstellungsfenster → Lüftungssteuerung)
// Reiter Lüftungssteuerung: Lüfter des Raums (Integration vent_control, sensor.<raum>_vent_control), links die Lüfter,
//   rechts der Editor mit Abschnitten; bearbeitet wird ein Entwurf, „Speichern“ schickt vent_control/save.
// Reiter Haus · Nachtruhe: Hauptschalter und hausweite Nachtruhe → vent_control/house.
// Nutzt Auswahlfenster und Bildschirmtastatur der Licht-Einstellungen (_pkShow, _kbOpen) und die Optik der Heizungs-Einstellungen.
const VC_TABS = ['Lüftungssteuerung', 'Haus · Nachtruhe'];
const VC_HOUSE = 'sensor.haus_vent_control';
const vcId = raum => raum ? `sensor.${raum}_vent_control` : null;
const VC_SECS = [['stat', 'Übersicht'], ['dev', 'Geräte · Sensoren'], ['mot', 'Nach Bewegung'], ['auto', 'Ohne Bewegung'], ['run', 'Laufzeit · Ruhe']];
const VC_REASON = { m_timer: 'Nach Bewegung', m_hum: 'Bewegung + Feuchte', m_air: 'Bewegung + Luft', a_hum: 'Feuchte', a_air: 'Luftqualität', a_interval: 'Intervall', follow: 'Nachlauf', min_run: 'Mindestlaufzeit' };
const VC_STATE = { run: 'LÄUFT', idle: 'BEREIT', off: 'AUS', window: 'FENSTER', pause: 'PAUSE', quiet: 'NACHTRUHE', manual: 'HAND' };
const VC_MIN = [0, 240, 1, ' min'], VC_PCT = [0, 100, 1, ' %'], VC_SPD = [0, 100, 5, ' %'];
// Schritte der Luftqualität je nach Einheit (ppm grob, µg/m³ und Index fein)
const vcAirStep = u => /pp[mb]/i.test(u || 'ppm') ? [0, 5000, 50, ' ' + (u || 'ppm')] : [0, 1000, 1, u ? ' ' + u : ''];
const vcNum = (key, airU) => ({
  'm_timer.delay_min': [0, 120, .5, ' min'], 'm_timer.run_min': [.5, 240, .5, ' min'], 'm_timer.speed': VC_SPD,
  'm_hum.on': VC_PCT, 'm_hum.off': VC_PCT, 'm_hum.speed': VC_SPD, 'a_hum.on': VC_PCT, 'a_hum.off': VC_PCT, 'a_hum.speed': VC_SPD,
  'm_air.speed': VC_SPD, 'a_air.speed': VC_SPD, 'a_interval.every_h': [.5, 48, .5, ' h'], 'a_interval.run_min': [1, 240, 1, ' min'], 'a_interval.speed': VC_SPD,
  m_window_min: VC_MIN, min_presence_min: [0, 60, .5, ' min'], presence_gap_s: [0, 600, 10, ' s'], min_run_min: [0, 60, .5, ' min'], follow_min: [0, 120, .5, ' min'], max_run_min: [0, 1440, 5, ' min'], pause_min: [1, 240, 1, ' min'],
  manual_hold_min: [0, 720, 5, ' min'], window_delay_s: [0, 600, 10, ' s'],
}[key] || (/air\.(on|off)$/.test(key) ? vcAirStep(airU) : VC_MIN));
const vcFan = (h, e) => { const s = h && h.states[e]; return !!s && e.startsWith('fan.') && ((s.attributes.supported_features || 0) & 1) === 1; };
const VC_CSS = `<style>
.vcval{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:2px 0 6px}
.vcval div{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:8px;background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000}
.vcval div.on{box-shadow:inset 0 2px 5px #000,0 0 0 1.5px #ff9f2e}
.vcval b{font:500 15px 'Share Tech Mono',monospace;color:var(--acc)}.vcval small{font-size:9.5px;letter-spacing:1px;color:#979ca5;text-transform:uppercase}
.vcval i{font-style:normal;font-size:9px;color:#9a9fa8}
.vcrs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 6px}
.vcrs span{font-size:10.5px;letter-spacing:.6px;padding:3px 9px;border-radius:7px;background:rgba(255,159,46,.14);color:#ffb35c}
.vcrs span.bl{background:rgba(255,255,255,.05);color:#979ca5;text-decoration:line-through}
.vcbtn{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 6px}
.vcbtn .hk{height:28px;font-size:10.5px;letter-spacing:1px;padding:0 10px;flex:none}
#vcp0,#vcp1{flex:1 1 auto;height:300px}
.psli{display:flex;flex-direction:column;gap:3px}
.psli div{display:flex;gap:8px;font-size:11.5px;color:#a9adb5;letter-spacing:.3px;line-height:1.35}
.psli div b{flex:none;width:86px;font:500 11.5px 'Share Tech Mono',monospace;color:var(--acc)}
.psli div i{font-style:normal;color:#979ca5}
.pswarn{color:#ffb35c}
</style>`;
class RPVentSettings extends RPLightSettings {
  get meta() { return this.variants().full; }
  // fh: füllt die Fläche im Einstellungsfenster ganz aus (Reiter oben, Bereich darunter wächst mit)
  variants() { return { full: { bw: 1000, mh: 392, fw: false, fh: true, maxh: 392 } }; }
  static getStubConfig() { return {}; }
  norm(c) { return { raum: c.raum || null, color: c.color || '#5fd0ff' }; }
  _area() { return raumOf(this, this._c); }
  watch() {
    const r = this._area(), list = this._vcList() || [];
    const ents = list.flatMap(u => [...(u.devices || []), ...(u.motion_sensors_used || []), ...(u.presence_sensors_used || []), ...(u.humidity_sensors || []), ...(u.air_sensors || []), ...(u.windows || [])]);
    return [vcId(r), VC_HOUSE, ...ents].filter(Boolean);
  }
  html() {
    const tab = this._vtab || 0;
    return `${LSET_CSS}${HC_CSS}${VC_CSS}<div class="lset" id="ls" style="--acc:${this._c.color}">
      <div class="lseg" style="grid-template-columns:repeat(${VC_TABS.length},1fr)">${VC_TABS.map((t, i) => `<div class="lsg${i === tab ? ' on' : ''}" id="vcg${i}" data-act="vtab:${i}">${t}</div>`).join('')}</div>
      <div class="lpg" id="vcp0"${tab ? ' hidden' : ''}><div class="lmo"><div class="lmrail zsrail" id="vcrail"></div><div class="zsed" id="vced"></div></div></div>
      <div class="lpg" id="vcp1"${tab !== 1 ? ' hidden' : ''}><div class="zsed" id="vhed"></div></div>
      <div class="lmpk" id="lmpk" hidden></div>
      <div class="lmpk lkb" id="lkb" hidden></div>
    </div>`;
  }
  bind() {
    const root = this.shadowRoot; if (this._vcBound) return; this._vcBound = true;
    root.addEventListener('input', ev => { if (ev.target.id === 'lmpkq') { this._moPkQ = ev.target.value; this._moPickList(); } });
    root.addEventListener('pointerdown', ev => {
      const t = ev.target.closest && ev.target.closest('[data-vcstep]'); if (!t) return;
      const [key, dir] = t.dataset.vcstep.split('|'), d = (this._vz || {}).d; if (!d) return;
      ev.preventDefault();
      let n = 0;
      const go = () => {
        const f = n < 8 ? 1 : n < 20 ? 4 : 12; n++;
        const [lo, hi, st] = vcNum(key, this._airU(d)); hcSet(d, key, clamp(Math.round((Number(hcGet(d, key)) + dir * st * f) / st) * st, lo, hi));
        this._vcDirty();
      };
      go(); clearInterval(this._vcRep);
      const to = setTimeout(() => { this._vcRep = setInterval(go, 110); }, 420);
      const up = () => { clearTimeout(to); clearInterval(this._vcRep); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    root.addEventListener('change', ev => {
      const t = ev.target, ds = t.dataset || {};
      if (ds.vht && this._vh && this._vh.d && /^\d\d:\d\d/.test(t.value)) { this._vh.d[ds.vht] = t.value.slice(0, 5); this._vhDirty(); }
    });
  }
  update() { this._vcPaint(); this._vhPaint(); }
  act(cmd, arg) {
    if (cmd === 'vtab') { this._vtab = +arg; VC_TABS.forEach((_, i) => { this.$('vcg' + i).classList.toggle('on', i === this._vtab); this.$('vcp' + i).hidden = i !== this._vtab; }); return; }
    if (cmd === 'mopk') { this._moPickAct(arg); return; }
    if (cmd === 'kb') { this._kbKey(arg); return; }
    if (cmd.startsWith('vc')) { this._vcAct(cmd.slice(2), arg); return; }
    if (cmd.startsWith('vh')) this._vhAct(cmd.slice(2), arg);
  }
  _vcList() { const s = this._st(vcId(this._area())); return s ? s.attributes.units || [] : null; }
  _vcH() { const s = this._st(VC_HOUSE); return s ? s.attributes : null; }
  _ws(type, extra) { return this._hass.callWS({ type: 'vent_control/' + type, ...extra }); }
  _nm(id) { const s = this._st(id); return s ? s.attributes.friendly_name || id : id + ' (fehlt)'; }
  _unit(id) { const s = this._st(id); return s ? s.attributes.unit_of_measurement || '' : ''; }
  _airU(d) { return d && d.air_sensors && d.air_sensors[0] ? this._unit(d.air_sensors[0]) : 'ppm'; }
  // ================================================================ Reiter Lüftungssteuerung
  _vcDirty() { const z = this._vz; z.dirty = true; z.del = false; this._vcPaint(); }
  _vcMsg(t, ok = true) { const z = this._vz; z.msg = t; z.msgOk = ok; this._vcPaint(); clearTimeout(z.mt); z.mt = setTimeout(() => { z.msg = ''; this._vcPaint(); }, 4000); }
  _vcPaint() {
    const rail = this.$('vcrail'), ed = this.$('vced'); if (!rail || !ed) return;
    const r = this._area(), list = this._vcList();
    if (!r || !list) {
      this._html(rail, '');
      this._html(ed, `<div class="lmmsg">${!r ? 'Kein Raum-Kürzel – Panel-Option <b>raum:</b> fehlt.' : `Die Lüftungssteuerung ist in Home Assistant nicht eingerichtet (Integration <b>vent_control</b>, Sensor <b>${vcId(r)}</b> fehlt).`}</div>`);
      return;
    }
    const z = this._vz || (this._vz = { sel: null, sec: 'stat' });
    if (!list.find(u => u.id === z.sel) && !(z.keep > Date.now())) { z.sel = list[0] ? list[0].id : null; z.dirty = false; z.d = null; }
    const live = list.find(u => u.id === z.sel);
    if (live && !z.dirty) z.d = JSON.parse(JSON.stringify(live));
    if (!z.sel) z.d = null;
    const H = this._vcH() || {}, master = !H.settings || H.settings.enabled !== false;
    const item = u => {
      const led = !u.enabled || !master ? '' : u.state === 'run' || u.state === 'manual' && u.on ? 'act' : 'rdy';
      const t = !u.enabled ? 'inaktiv' : !master ? 'Hauptschalter aus' : u.label || '';
      return `<div class="zsit${u.id === z.sel ? ' on' : ''}${u.enabled ? '' : ' off'}" data-act="vcsel:${u.id}"><span class="zsd ${led}"></span><span class="dn"><b>${escH(u.name)}</b><small>${escH(t)}</small></span></div>`;
    };
    this._html(rail, `<div class="zslist">${list.map(item).join('') || '<div class="lmempty">Noch keine Lüfter.</div>'}</div>
      <div class="hk" data-act="vcnew" style="--c:#3ddc84"><i></i>+ Lüfter</div>
      ${master ? '' : '<div class="lhint" style="margin:6px 4px 0">Hauptschalter ist <b>aus</b> (Reiter Haus · Nachtruhe).</div>'}`);
    if (!z.d) { this._html(ed, '<div class="lmmsg">Noch kein Lüfter eingerichtet.<br>Mit <b>+ Lüfter</b> legst du einen an.</div>'); return; }
    const d = z.d;
    if (!VC_SECS.find(s => s[0] === z.sec)) z.sec = 'stat';
    const hd = `<div class="zshd"><div class="zsname" data-act="vcname">${escH(d.name)}</div>
      <div class="hk${d.enabled ? ' on' : ''}" data-act="vcset:enabled|t" style="--c:${d.enabled ? '#3ddc84' : 'var(--acc)'}"><i></i>${d.enabled ? 'Aktiv' : 'Inaktiv'}</div>
      <div class="zsseg">${VC_SECS.map(([s, n]) => `<div class="lsg${z.sec === s ? ' on' : ''}" data-act="vcsec:${s}">${n}</div>`).join('')}</div></div>`;
    const cols = this._vcRows(d, z.sec, live || d);
    const body = `<div class="lmbody">${cols.map(x => `<div class="lmcol">${x.join('')}</div>`).join('')}</div>`;
    const ft = `<div class="zsft"><div class="lmsg" id="vcmsg">${escH(z.msg || '')}</div>
      <div class="hk${z.del ? ' on' : ''}" data-act="vcdel" style="--c:#ff6b6b"><i></i>${z.del ? 'Wirklich löschen?' : 'Löschen'}</div>
      ${z.dirty ? '<div class="hk" data-act="vccancel"><i></i>Verwerfen</div>' : ''}
      <div class="hk${z.dirty ? ' on' : ''}" data-act="vcsave" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
    const ae = this.shadowRoot.activeElement;
    if (ae && ae.tagName === 'INPUT' && ed.contains(ae)) return;
    this._html(ed, hd + body + ft);
    const m = this.shadowRoot.getElementById('vcmsg'); if (m) m.style.color = z.msgOk === false ? '#ff8a8a' : '#3ddc84';
  }
  _vcRows(d, sec, live) {
    const L = [[], []], h = (c, t) => L[c].push(`<div class="lmh">${t}</div>`), hint = (c, t) => L[c].push(`<div class="lhint" style="margin:-2px 0 4px">${t}</div>`);
    const row = (c, l, ctl, sub) => L[c].push(`<div class="lmr${sub ? ' sub' : ''}"><span>${l}</span>${ctl}</div>`);
    const stack = (c, l, ctl) => L[c].push(`<div class="lmr stack"><span>${l}</span>${ctl}</div>`);
    const seg = (key, o) => `<div class="lmseg">${o.map(([v, n]) => `<div class="hk${hcGet(d, key) === v ? ' on' : ''}" data-act="vcset:${key}|${v}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`;
    const tog = (key, a = 'An', b = 'Aus') => { const v = hcGet(d, key); return `<div class="hk${v ? ' on' : ''}" data-act="vcset:${key}|t" style="--c:${v ? '#3ddc84' : 'var(--acc)'}"><i></i>${v ? a : b}</div>`; };
    const airU = this._airU(d);
    const num = (key, zero) => { const [, , st, u] = vcNum(key, airU), v = Number(hcGet(d, key)); return `<div class="lmst"><div class="hk" data-vcstep="${key}|-1">−</div><div class="dlcd">${zero && !v ? zero : de(v, st < 1 ? 1 : 0) + u}</div><div class="hk" data-vcstep="${key}|1">+</div></div>`; };
    const ro = v => `<div class="lcd lmro">${v}</div>`;
    const pick = (what, label) => `<div class="hk lmen" data-act="vcpick:${what}" style="--c:var(--acc)"><i></i><span>${label}</span></div>`;
    const ents = (list, none) => !list.length ? none : list.length === 1 ? escH(this._nm(list[0])) : list.length + ' gewählt';
    const vals = list => list.map(e => `${escH(this._nm(e))} · ${escH((this._st(e) || {}).state || '–')} ${escH(this._unit(e))}`).join('<br>');
    const speed = (d.devices || []).some(e => vcFan(this._hass, e));
    const spd = (c, key) => { if (speed) row(c, 'Stufe', num(key, 'Ein'), true); };
    const pct = v => v == null ? '--' : de(v, 0) + ' %', air = v => v == null ? '--' : de(v, 0) + (airU ? ' ' + airU : '');
    const thr = (c, key, isAir, title) => {
      h(c, title);
      row(c, 'Verwenden', tog(key + '.enabled'));
      if (!hcGet(d, key + '.enabled')) return;
      if (!(isAir ? d.air_sensors : d.humidity_sensors).length) hint(c, `<span class="pswarn">Noch kein ${isAir ? 'Luftqualitäts' : 'Feuchte'}sensor gewählt (Geräte · Sensoren).</span>`);
      row(c, 'An über', num(key + '.on'), true);
      row(c, 'Aus unter', num(key + '.off'), true);
      spd(c, key + '.speed');
    };
    if (sec === 'stat') {
      const V = live, master = ((this._vcH() || {}).settings || {}).enabled !== false;
      h(0, 'Jetzt');
      L[0].push(`<div class="hcbig"><b>${VC_STATE[V.state] || '--'}</b><span>${escH(V.label || '')}${V.until ? ' · bis ' + hcHm(V.until) : ''}${V.state === 'run' && V.speed ? ' · ' + V.speed + ' %' : ''}</span></div>`);
      if (!master) hint(0, 'Der <b>Hauptschalter</b> der Lüftungssteuerung ist aus (Reiter Haus · Nachtruhe).');
      else if (!d.enabled) hint(0, 'Lüfter ist <b>inaktiv</b> – es wird nichts geschaltet. Die Anzeige zeigt, was er tun würde.');
      if ((V.reasons || []).length || (V.blocked || []).length) L[0].push(`<div class="vcrs">${(V.reasons || []).map(r => `<span>${VC_REASON[r] || r}</span>`).join('')}${(V.blocked || []).map(r => `<span class="bl">${VC_REASON[r] || r}</span>`).join('')}</div>`);
      if ((V.blocked || []).length) hint(0, 'Durchgestrichen = würde lüften, ist aber durch die Nachtruhe gesperrt.');
      L[0].push(`<div class="vcval"><div class="${V.motion ? 'on' : ''}"><small>Bewegung</small><b>${V.motion ? 'JA' : 'NEIN'}</b><i>${V.presence_left != null ? 'noch ' + de(V.presence_left, V.presence_left % 1 ? 1 : 0) + ' min bis lang genug' : V.motion && V.presence_since ? 'seit ' + hcHm(V.presence_since) : V.armed_until ? 'reagiert bis ' + hcHm(V.armed_until) : '&nbsp;'}</i></div>
        <div class="${['m_hum', 'a_hum'].some(r => (V.reasons || []).includes(r)) ? 'on' : ''}"><small>Feuchte</small><b>${pct(V.humidity)}</b><i>${d.humidity_sensors.length ? '&nbsp;' : 'kein Sensor'}</i></div>
        <div class="${['m_air', 'a_air'].some(r => (V.reasons || []).includes(r)) ? 'on' : ''}"><small>Luft</small><b>${air(V.air)}</b><i>${d.air_sensors.length ? '&nbsp;' : 'kein Sensor'}</i></div></div>`);
      if (V.timer && V.state !== 'run') row(0, 'Zeit nach Bewegung', ro(`${hcHm(V.timer.start)} – ${hcHm(V.timer.end)}`), true);
      if (V.interval_next && d.a_interval.enabled) row(0, 'Nächstes Intervall', ro(hcHm(V.interval_next)), true);
      if (V.window) row(0, 'Fenster offen', ro(escH(this._nm(V.window))), true);
      h(0, 'Jetzt lüften');
      L[0].push(`<div class="vcbtn">${[10, 30, 60].map(m => `<div class="hk" data-act="vcrun:${m}" style="--c:#3ddc84"><i></i>${m} min</div>`).join('')}${V.state === 'manual' ? '<div class="hk" data-act="vcrun:0" style="--c:#ff9f2e"><i></i>Automatik</div>' : ''}</div>`);
      if (V.state === 'manual') hint(0, `Automatik pausiert bis ${hcHm(V.until)} (${V.manual && V.manual.by === 'Taste' ? 'Taste' : 'am Gerät geschaltet'}).`);
      h(1, 'Geräte');
      L[1].push(`<div class="hcdev">${(V.device_states || []).map(x => `<b>${escH(this._nm(x.entity_id))}</b> · ${escH(x.state || '–')}${x.percentage != null && x.state === 'on' ? ' · ' + x.percentage + ' %' : ''}`).join('<br>') || 'Keine Geräte gewählt.'}</div>`);
      h(1, 'Zuletzt');
      L[1].push(`<div class="psli">${(V.log || []).slice(0, 7).map(x => `<div><b>${hcHm(x.at)}</b><span>${escH(x.t)}</span></div>`).join('') || '<div><i>Noch nichts geschaltet.</i></div>'}</div>`);
      return L;
    }
    if (sec === 'dev') {
      h(0, 'Lüfter');
      row(0, 'Geräte', pick('devices', ents(d.devices, 'Keine')));
      if (d.devices.length > 1) L[0].push(`<div class="zslamps">${d.devices.map(e => escH(this._nm(e))).join('<br>')}</div>`);
      hint(0, speed ? 'Lüfter mit Stufen: je Regel lässt sich eine Stufe (%) einstellen.' : 'Lüfter, Schalter, Steckdosen oder Licht-Kanäle – alle gewählten schalten gemeinsam.');
      h(0, 'Bewegung · Anwesenheit');
      row(0, 'Melder', pick('motion_sensors', d.motion_sensors.length ? ents(d.motion_sensors, '') : 'wie Licht'));
      if (!d.motion_sensors.length) hint(0, (live.motion_sensors_used || []).length ? 'Aus der Licht-Bewegungssteuerung: ' + (live.motion_sensors_used || []).map(e => escH(this._nm(e))).join(', ') : '<span class="pswarn">Für diesen Raum ist auch in der Lichtsteuerung kein Melder eingetragen.</span>');
      row(0, 'Anwesenheit', pick('presence_sensors', d.presence_sensors.length ? ents(d.presence_sensors, '') : d.presence_light ? 'wie Licht' : 'Keine'));
      if (!d.presence_sensors.length) row(0, 'Ohne Auswahl: wie Licht', tog('presence_light', 'Ja', 'Nein'), true);
      if ((live.presence_sensors_used || []).length && !d.presence_sensors.length && d.presence_light) hint(0, 'Aus der Licht-Bewegungssteuerung: ' + (live.presence_sensors_used || []).map(e => escH(this._nm(e))).join(', '));
      hint(0, 'Anwesenheitsmelder (z. B. Radar) zählen wie Bewegung – sie halten den Aufenthalt auch, wenn man still sitzt.');
      h(1, 'Luftsensoren');
      row(1, 'Feuchte', pick('humidity_sensors', ents(d.humidity_sensors, 'Keiner')));
      if (d.humidity_sensors.length) L[1].push(`<div class="zslamps">${vals(d.humidity_sensors)}</div>`);
      row(1, 'Luftqualität', pick('air_sensors', ents(d.air_sensors, 'Keiner')));
      if (d.air_sensors.length) L[1].push(`<div class="zslamps">${vals(d.air_sensors)}</div>`);
      hint(1, 'Bei mehreren Sensoren zählt der höchste Wert. Luftqualität = CO₂, VOC, Feinstaub o. Ä. (gleiche Einheit wählen).');
      h(1, 'Fensterkontakte');
      row(1, 'Kontakte', pick('windows', ents(d.windows, 'Keine')));
      if (d.windows.length) { row(1, 'Reagieren nach', num('window_delay_s'), true); hint(1, 'Ist ein Kontakt offen, bleibt der Lüfter aus.'); }
      return L;
    }
    if (sec === 'mot') {
      const t = d.m_timer, need = Number(d.min_presence_min) || 0, now = need > 0 && d.min_presence_then === 'now';
      const mn = x => de(x, x % 1 ? 1 : 0);
      h(0, 'Erst nach Aufenthalt');
      row(0, 'Mindestens anwesend', num('min_presence_min', 'egal'));
      if (need > 0) {
        stack(0, 'Dann einschalten', seg('min_presence_then', [['now', 'Sofort'], ['delay', 'Nach Verzögerung']]));
        row(0, 'Kurze Pause erlaubt', num('presence_gap_s', 'keine'), true);
        hint(0, `Nur wenn ${mn(need)} min am Stück Bewegung bzw. Anwesenheit war (Lücken bis ${d.presence_gap_s} s zählen mit). Kurze Besuche lösen nichts aus – gilt auch für Feuchte/Luft nach Bewegung.`);
      } else hint(0, 'Egal = jede erkannte Bewegung zählt.');
      h(0, 'Zeit nach Bewegung');
      row(0, 'Verwenden', tog('m_timer.enabled'));
      if (t.enabled) {
        stack(0, 'Verzögerung ab', seg('m_timer.from', [['start', 'Bewegung erkannt'], ['end', 'Bewegung vorbei']]));
        row(0, 'Einschalten nach', now ? ro('sofort') : num('m_timer.delay_min', 'sofort'), true);
        row(0, 'Läuft, solange Bewegung', tog('m_timer.restart', 'Ja', 'Nein'), true);
        row(0, t.restart ? 'Nachlauf nach letzter Bewegung' : 'Laufzeit', num('m_timer.run_min'), true);
        spd(0, 'm_timer.speed');
        const an = need > 0 ? (t.from === 'start' ? `Sind ${mn(need)} min Aufenthalt erreicht: ${now ? 'sofort' : mn(t.delay_min) + ' min später'} an`
          : `Nach einem Aufenthalt von mindestens ${mn(need)} min: ${now ? 'sofort' : mn(t.delay_min) + ' min'} nachdem keine Bewegung mehr ist an`)
          : t.from === 'start' ? `${mn(t.delay_min)} min nach erkannter Bewegung an` : `${mn(t.delay_min)} min nachdem keine Bewegung mehr ist an`;
        hint(0, an + (t.restart ? `, bleibt an, solange Bewegung erkannt wird, und geht ${mn(t.run_min)} min nach der letzten Bewegung aus.`
          : `, läuft ${mn(t.run_min)} min und geht dann aus – auch wenn noch Bewegung ist.`) + (t.from === 'end' ? ' Kommt vorher wieder Bewegung, wartet er neu.' : ''));
      }
      h(1, 'Feuchte / Luft nach Bewegung');
      row(1, 'Reagieren bis nach Bewegung', num('m_window_min', 'nur während'));
      hint(1, 'Feuchte und Luftqualität lösen hier nur aus, wenn Bewegung ist oder bis zu dieser Zeit danach. Einmal an, läuft er bis „Aus unter“.');
      thr(1, 'm_hum', false, 'Feuchte');
      thr(1, 'm_air', true, 'Luftqualität');
      return L;
    }
    if (sec === 'auto') {
      hint(0, 'Diese Regeln gelten immer – auch wenn niemand im Raum ist.');
      thr(0, 'a_hum', false, 'Feuchte');
      thr(0, 'a_air', true, 'Luftqualität');
      const iv = d.a_interval;
      h(1, 'Intervall');
      row(1, 'Verwenden', tog('a_interval.enabled'));
      if (iv.enabled) {
        row(1, 'Spätestens alle', num('a_interval.every_h'), true);
        row(1, 'Laufzeit', num('a_interval.run_min'), true);
        spd(1, 'a_interval.speed');
        hint(1, 'Lief der Lüfter so lange nicht, lüftet er von selbst.');
      }
      return L;
    }
    // sec === 'run'
    h(0, 'Laufzeit');
    row(0, 'Mindestens', num('min_run_min', 'egal'));
    row(0, 'Nachlauf (Feuchte/Luft)', num('follow_min', 'keiner'));
    row(0, 'Höchstens am Stück', num('max_run_min', 'unbegrenzt'));
    if (d.max_run_min) row(0, 'Danach Pause', num('pause_min'), true);
    hint(0, 'Nachlauf: so lange läuft er weiter, nachdem Feuchte bzw. Luft wieder gut sind. Die Zeit-Regel endet genau nach ihrer Laufzeit.');
    const Hs = (this._vcH() || {}).settings || {};
    h(1, 'Nachtruhe');
    row(1, 'Nachtruhe gilt', tog('quiet', 'Ja', 'Nein'));
    if (d.quiet) row(1, 'Feuchte darf trotzdem', tog('quiet_hum', 'Ja', 'Nein'), true);
    hint(1, Hs.quiet_enabled ? `Nachtruhe des Hauses: ${escH(Hs.quiet_from)} – ${escH(Hs.quiet_to)} (Reiter Haus · Nachtruhe).` : 'Die Nachtruhe des Hauses ist ausgeschaltet (Reiter Haus · Nachtruhe).');
    h(1, 'Von Hand geschaltet');
    row(1, 'Automatik pausiert', num('manual_hold_min', 'nie'));
    hint(1, 'Schaltet jemand den Lüfter am Gerät oder im Dashboard, greift die Automatik so lange nicht ein.');
    return L;
  }
  async _vcAct(op, arg) {
    const z = this._vz || (this._vz = { sel: null, sec: 'stat' }), d = z.d, r = this._area();
    const msg = (t, ok) => this._vcMsg(t, ok), err = e => msg('Fehler: ' + ((e && e.message) || e), false);
    if (op === 'sel') { if (z.sel === arg) return; z.sel = arg; z.dirty = false; z.d = null; z.del = false; z.msg = ''; this._vcPaint(); return; }
    if (op === 'sec') { z.sec = arg; this._vcPaint(); return; }
    if (op === 'new') {
      if (z.dirty) { msg('Erst speichern oder verwerfen.', false); return; }
      try {
        const res = await this._ws('save', { unit: { room: r, name: 'Lüfter', enabled: false } });
        z.sel = res.result; z.d = null; z.dirty = false; z.keep = Date.now() + 5000; z.sec = 'dev'; msg('Lüfter angelegt (inaktiv).');
      } catch (e) { err(e); }
      return;
    }
    if (op === 'cancel') { z.dirty = false; z.d = null; this._vcPaint(); return; }
    if (op === 'run') { try { await this._ws('run', { unit_id: z.sel, minutes: +arg }); msg(+arg ? `Lüftet ${arg} min.` : 'Automatik wieder aktiv.'); } catch (e) { err(e); } return; }
    if (!d) return;
    if (op === 'name') { this._kbOpen('Name des Lüfters', d.name, 40, v => { d.name = v.trim() || d.name; this._vcDirty(); }); return; }
    if (op === 'set') { const [key, v] = arg.split('|'); hcSet(d, key, v === 't' ? !hcGet(d, key) : v); this._vcDirty(); return; }
    if (op === 'pick') {
      const u = s => String(s.attributes.unit_of_measurement || '');
      const hum = s => s.attributes.device_class === 'humidity' || (u(s) === '%' && /humid|feucht/i.test(s.entity_id));
      const airQ = s => ['carbon_dioxide', 'volatile_organic_compounds', 'volatile_organic_compounds_parts', 'aqi', 'pm25', 'pm10', 'pm1'].includes(s.attributes.device_class) || /pp[mb]|µg\/m³/.test(u(s));
      const mot = s => s.entity_id.startsWith('input_boolean.') || ['motion', 'occupancy', 'presence', 'moving'].includes(s.attributes.device_class);
      const win = s => s.entity_id.startsWith('input_boolean.') || (s.entity_id.startsWith('binary_sensor.') && ['window', 'door', 'opening', 'garage_door'].includes(s.attributes.device_class))
        || (s.entity_id.startsWith('sensor.') && ['open', 'closed', 'tilted'].includes(s.state));
      const P = {
        devices: [{ l: 'Lüfter · Schalter', dom: ['fan', 'switch', 'light', 'input_boolean'], multi: true }, d.devices, sel => { d.devices = sel; }],
        motion_sensors: [{ l: 'Bewegungsmelder (leer = wie Licht)', dom: ['binary_sensor', 'input_boolean'], fit: mot, multi: true }, d.motion_sensors, sel => { d.motion_sensors = sel; }],
        presence_sensors: [{ l: 'Anwesenheitsmelder (Radar, Präsenz)', dom: ['binary_sensor', 'input_boolean'], fit: mot, multi: true }, d.presence_sensors, sel => { d.presence_sensors = sel; }],
        humidity_sensors: [{ l: 'Feuchtesensoren', dom: ['sensor'], fit: hum, multi: true }, d.humidity_sensors, sel => { d.humidity_sensors = sel; }],
        air_sensors: [{ l: 'Luftqualität (CO₂, VOC, Feinstaub)', dom: ['sensor'], fit: airQ, multi: true }, d.air_sensors, sel => { d.air_sensors = sel; }],
        windows: [{ l: 'Fensterkontakte', dom: ['binary_sensor', 'sensor', 'input_boolean'], fit: win, multi: true }, d.windows, sel => { d.windows = sel; }],
      }[arg];
      if (P) this._pkShow(P[0], [...P[1]], sel => { P[2](sel); this._vcDirty(); });
      return;
    }
    if (op === 'del') {
      if (!z.del) { z.del = true; this._vcPaint(); clearTimeout(z.dt); z.dt = setTimeout(() => { z.del = false; this._vcPaint(); }, 4000); return; }
      try { await this._ws('delete', { unit_id: z.sel }); z.sel = null; z.d = null; z.dirty = false; z.del = false; msg('Lüfter gelöscht.'); } catch (e) { err(e); }
      return;
    }
    if (op === 'save') {
      try {
        const keys = ['name', 'enabled', 'devices', 'motion_sensors', 'presence_sensors', 'presence_light', 'min_presence_min', 'min_presence_then', 'presence_gap_s', 'humidity_sensors', 'air_sensors', 'windows', 'window_delay_s', 'm_timer', 'm_hum', 'm_air', 'm_window_min',
          'a_hum', 'a_air', 'a_interval', 'min_run_min', 'follow_min', 'max_run_min', 'pause_min', 'quiet', 'quiet_hum', 'manual_hold_min'];
        const res = await this._ws('save', { unit: { id: z.sel, room: r, ...Object.fromEntries(keys.map(k => [k, d[k]])) } });
        z.sel = res.result; z.dirty = false; z.keep = Date.now() + 5000;
        msg(d.devices.length ? 'Gespeichert.' : 'Gespeichert – noch keine Geräte gewählt.', !!d.devices.length);
      } catch (e) { err(e); }
    }
  }
  // ================================================================ Reiter Haus · Nachtruhe
  _vhDirty() { const z = this._vh; z.dirty = true; this._vhPaint(); }
  _vhMsg(t, ok = true) { const z = this._vh; z.msg = t; z.msgOk = ok; this._vhPaint(); clearTimeout(z.mt); z.mt = setTimeout(() => { z.msg = ''; this._vhPaint(); }, 4000); }
  _vhPaint() {
    const ed = this.$('vhed'); if (!ed) return;
    const H = this._vcH();
    if (!H) { this._html(ed, '<div class="lmmsg">Die Lüftungssteuerung ist in Home Assistant nicht eingerichtet (<b>sensor.haus_vent_control</b> fehlt).</div>'); return; }
    const z = this._vh || (this._vh = {});
    if (!z.dirty) z.d = JSON.parse(JSON.stringify(H.settings || {}));
    const d = z.d, L = [[], []];
    const h = (c, t) => L[c].push(`<div class="lmh">${t}</div>`), hint = (c, t) => L[c].push(`<div class="lhint" style="margin:-2px 0 4px">${t}</div>`);
    const row = (c, l, ctl, sub) => L[c].push(`<div class="lmr${sub ? ' sub' : ''}"><span>${l}</span>${ctl}</div>`);
    const tog = (key, a = 'An', b = 'Aus') => `<div class="hk${d[key] ? ' on' : ''}" data-act="vhset:${key}" style="--c:${d[key] ? '#3ddc84' : 'var(--acc)'}"><i></i>${d[key] ? a : b}</div>`;
    const ro = v => `<div class="lcd lmro">${v}</div>`;
    h(0, 'Lüftungssteuerung');
    row(0, 'Hauptschalter', tog('enabled', 'Ein', 'Aus'));
    hint(0, d.enabled ? 'Jeder Lüfter lässt sich zusätzlich einzeln aktivieren (Reiter Lüftungssteuerung).' : 'Aus: keine Automatik in keinem Raum. Laufende Lüfter werden beim Speichern ausgeschaltet.');
    row(0, 'Gerade laufen', ro(String((H.running || []).length)), true);
    h(1, 'Nachtruhe');
    row(1, 'Nachtruhe', tog('quiet_enabled'));
    if (d.quiet_enabled) {
      L[1].push(`<div class="zsslot"><b style="width:40px">VON</b><input class="lmin" type="time" data-vht="quiet_from" value="${escH(d.quiet_from)}"><b>BIS</b><input class="lmin" type="time" data-vht="quiet_to" value="${escH(d.quiet_to)}"></div>`);
      row(1, 'Gerade', ro(H.quiet_now ? 'Nachtruhe' : '–'), true);
    }
    hint(1, 'In der Nachtruhe lüften nur Lüfter, bei denen „Nachtruhe gilt“ aus ist – oder Feuchte, wenn „Feuchte darf trotzdem“ an ist.');
    const ft = `<div class="zsft"><div class="lmsg" id="vhmsg">${escH(z.msg || '')}</div>${z.dirty ? '<div class="hk" data-act="vhcancel"><i></i>Verwerfen</div>' : ''}<div class="hk${z.dirty ? ' on' : ''}" data-act="vhsave" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
    const ae = this.shadowRoot.activeElement;
    if (ae && ae.tagName === 'INPUT' && ed.contains(ae)) return;
    this._html(ed, `<div class="cap eng">Haus · gilt für alle Räume</div><div class="lmbody">${L.map(x => `<div class="lmcol">${x.join('')}</div>`).join('')}</div>${ft}`);
    const m = this.shadowRoot.getElementById('vhmsg'); if (m) m.style.color = z.msgOk === false ? '#ff8a8a' : '#3ddc84';
  }
  async _vhAct(op, arg) {
    const z = this._vh; if (!z || !z.d) return;
    if (op === 'set') { z.d[arg] = !z.d[arg]; this._vhDirty(); return; }
    if (op === 'cancel') { z.dirty = false; this._vhPaint(); return; }
    if (op === 'save') {
      try { await this._ws('house', { settings: z.d }); z.dirty = false; this._vhMsg('Gespeichert.'); } catch (e) { this._vhMsg('Fehler: ' + ((e && e.message) || e), false); }
    }
  }
}

// ---------------------------------------------------------------- Haus-Einstellungen (Einstellungsfenster → Allgemein)
// Reiter Haus: hausweite Werte, die für alle Räume gelten: Tageszeit-Grenzen (input_datetime.haus_sys_daytime_cfg_*_start)
// und die Quellen der Lichtsteuerung (input_text.haus_light_motion_cfg_*). Nutzt die Zeilen-Bausteine der
// Licht-Einstellungen (Abschnitt "house" in _moRows) samt Auswahlfenster – gleiche Optik und Bedienung.
// Reiter Anwesenheit: Anwesenheitssimulation für die ganze Wohnung (Integration presence_sim, siehe PS_* unten).
const HOUSE_TABS = ['Haus', 'Anwesenheit', 'Batterie-Management'];
// Anwesenheitssimulation: Einstellungen, Profile, Tagesplan und Protokoll stehen in sensor.haus_sys_presence_sim,
// gespeichert wird per WebSocket presence_sim/settings | save | delete | preview | replan | start | stop.
// Einstellungen gelten sofort, Profile werden als Entwurf bearbeitet und erst mit „Speichern“ übernommen.
const PS_ID = 'sensor.haus_sys_presence_sim';
const PS_SECS = [['act', 'Aktivierung'], ['rooms', 'Räume'], ['eve', 'Abend'], ['night', 'Nacht · Morgen'], ['light', 'Licht']];
const PS_SIM = [['auto', 'Automatisch'], ['fixed', 'Fest'], ['random', 'Zufall']];
const PS_SIM_TXT = Object.fromEntries(PS_SIM);
const PS_MODES = [['off', 'Aus'], ['auto', 'Automatisch'], ['manual', 'Manuell']];
const PS_KIND = { evening: ['Abend', '#ffb347'], fixed: ['Feste Zeit', '#5fb4ff'], bed: ['Zu Bett', '#b48cff'], night: ['Nacht', '#7186e8'], morning: ['Morgen', '#3ddc84'] };
const PS_STATE = { pending: 'geplant', on: 'läuft', done: 'erledigt', skipped: 'übersprungen', cancelled: 'abgebrochen' };
const PS_ALARM = { disarmed: 'Unscharf', armed_away: 'Scharf · abwesend', armed_home: 'Scharf · zuhause', armed_night: 'Scharf · Nacht', armed_vacation: 'Scharf · Urlaub',
  armed_custom_bypass: 'Scharf · individuell', arming: 'Wird scharf', pending: 'Verzögerung', triggered: 'ALARM' };
const PS_NUM = { priority: [1, 99, 1, ''], away_min: [0, 1440, 5, ' min'], max_parallel: [1, 3, 1, ''], gap_min: [0, 240, 1, ' min'], gap_max: [0, 240, 1, ' min'],
  jitter: [0, 60, 1, ' min'], evening_offset: [-120, 120, 5, ' min'], bed_step_min: [.5, 60, .5, ' min'], bed_step_max: [.5, 60, .5, ' min'],
  bed_last_min: [1, 120, 1, ' min'], bed_last_max: [1, 120, 1, ' min'], night_chance: [0, 100, 5, ' %'], night_step_min: [.5, 30, .5, ' min'],
  night_step_max: [.5, 30, .5, ' min'], night_brightness: [1, 100, 1, ' %'], morning_step_min: [1, 90, 1, ' min'], morning_step_max: [1, 90, 1, ' min'],
  brightness: [1, 100, 1, ' %'], kelvin: [2000, 6500, 100, ' K'], transition: [0, 60, .5, ' s'], weight: [1, 5, 1, ''], min_on: [1, 240, 1, ' min'], max_on: [1, 480, 1, ' min'] };
const PS_ROOM_DEF = { enabled: false, lights: [], role: 'visitor', weight: 3, min_on: 5, max_on: 20, slots: [] };
const PS_DEF = { name: 'Neues Profil', enabled: true, priority: 10, sim_mode: 'auto', presence: 'away', away_min: 60, alarm: 'ignore', logic: 'and',
  days: [0, 1, 2, 3, 4, 5, 6], date_enabled: false, date_from: '', date_to: '', rooms: [], max_parallel: 1, gap_min: 5, gap_max: 30, jitter: 15,
  evening_start: 'sun', evening_offset: 0, evening_time: '18:00', bed_enabled: true, bed_from: '22:30', bed_to: '23:30', bed_route: ['fl', 'bz', 'sz'],
  bed_step_min: 2, bed_step_max: 8, bed_last_min: 10, bed_last_max: 25, night_enabled: true, night_chance: 40, night_from: '01:00', night_to: '04:30',
  night_route: ['fl', 'bz'], night_step_min: 2, night_step_max: 5, night_brightness: 30, morning_enabled: true, morning_days: [0, 1, 2, 3, 4],
  morning_from: '06:15', morning_to: '07:15', morning_route: ['bz', 'ku'], morning_step_min: 5, morning_step_max: 20, morning_dark_only: true,
  mode: 'color_temp', brightness: 80, kelvin: 2900, color: '#FFB060', transition: 2, tv_enabled: false, tv_light: '', ring_enabled: false, sound_enabled: false };
const psHM = iso => iso ? new Date(iso).toTimeString().slice(0, 5) : '--:--';
const psYmd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const psAddDay = (ymd, n) => { const d = /^\d{4}-\d\d-\d\d$/.test(ymd || '') ? new Date(ymd + 'T12:00:00') : new Date(); d.setDate(d.getDate() + n); return psYmd(d); };
const psDateTxt = ymd => /^\d{4}-\d\d-\d\d$/.test(ymd || '') ? `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(2, 4)}` : '–';
const psMin = v => { v = Number(v); return (Number.isInteger(v) ? v : v.toFixed(1)) + ' min'; };
// laufender Simulationstag (12:00 – 12:00), wie in der Integration
const psDayBounds = () => { const n = new Date(), a = new Date(n); a.setHours(12, 0, 0, 0); if (n < a) a.setDate(a.getDate() - 1); const b = new Date(a); b.setDate(b.getDate() + 1); return [a.toISOString(), b.toISOString()]; };
const psClean = d => { const { why, ...p } = d; return p; };
// Tagesplan als Zeitleiste: eine Zeile je Raum, Balken je Eintrag (Farbe = Art), rote Linie = jetzt
function psTimeline(entries, from, to, rooms) {
  const a = +new Date(from), b = +new Date(to), span = b - a || 1, now = Date.now();
  const x = t => clamp((+new Date(t) - a) / span, 0, 1) * 100;
  const order = (rooms || []).map(r => r.room), names = Object.fromEntries((rooms || []).map(r => [r.room, r.name]));
  const rs = [...new Set(entries.map(e => e.room))].sort((p, q) => order.indexOf(p) - order.indexOf(q));
  const nowL = now >= a && now <= b ? `<u style="left:${x(now)}%"></u>` : '';
  const ticks = Array.from({ length: 13 }, (_, i) => `<b style="left:${i / 12 * 100}%">${String((12 + i * 2) % 24).padStart(2, '0')}</b>`).join('');
  const rows = rs.map(r => `<div class="pstr"><span>${escH(names[r] || r.toUpperCase())}</span><div class="pstb">${entries.filter(e => e.room === r).map(e => {
    const k = PS_KIND[e.kind] || ['', '#888'], l = x(e.on), w = Math.max(.4, x(e.off) - l);
    return `<i class="${e.state}" style="left:${l}%;width:${w}%;--c:${k[1]}" title="${escH(`${k[0]} ${psHM(e.on)}–${psHM(e.off)} · ${PS_STATE[e.state] || e.state}${e.note ? ' · ' + e.note : ''}`)}"></i>`;
  }).join('')}${nowL}</div></div>`).join('');
  const leg = Object.values(PS_KIND).map(([n, c]) => `<em style="--c:${c}">${n}</em>`).join('');
  return `<div class="pstl"><div class="psth">${ticks}</div>${rows || '<div class="lmempty">Heute ist nichts geplant.</div>'}<div class="psleg">${leg}<em class="sk">übersprungen</em></div></div>`;
}
const PS_CSS = `<style>
.hset .lseg{grid-template-columns:repeat(2,1fr)}
#hpg0{flex-direction:column;gap:8px}
#hpg0,#hpg1{flex:1 1 auto;height:300px}
.psov{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;display:flex;flex-direction:column;gap:8px;padding:4px 4px 0 0}
.psst{flex:1;min-width:0;height:32px;border-radius:8px;padding:0 12px;display:flex;align-items:center;gap:10px;font:600 14px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.6px;color:#d7d9de;background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.07);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psst .zsd{width:9px;height:9px;flex:none;border-radius:50%;background:#3a3c41}
.psst .zsd.rdy{background:#3ddc84;box-shadow:0 0 8px #3ddc84}.psst .zsd.act{background:#ff9f2e;box-shadow:0 0 8px #ff9f2e}
.psinfo{display:flex;gap:8px;flex-wrap:wrap}
.psinfo span{font-size:11px;letter-spacing:.5px;color:#9a9fa8;padding:3px 9px;border-radius:7px;background:rgba(0,0,0,.25)}
.psinfo b{color:#c9ccd2;font-weight:600}
.pshd2{display:flex;align-items:center;gap:10px}
.pshd2 .lmh{margin:0;flex:1}
.pshd2 .hk{height:26px;font-size:10px;letter-spacing:1px;padding:0 10px;flex:none}
.pstl{position:relative;display:flex;flex-direction:column;gap:3px;padding:6px 10px 8px;border-radius:10px;background:linear-gradient(180deg,#141518,#1a1b1f);box-shadow:inset 0 2px 6px #000,0 1px 0 rgba(255,255,255,.06)}
.psth{position:relative;margin:0 4px 2px 96px;height:12px;font-size:9px;color:#979ca5}
.psth b{position:absolute;transform:translateX(-50%);font-weight:500}
.pstr{display:flex;align-items:center;gap:8px;height:16px}
.pstr>span{width:88px;flex:none;font-size:10.5px;color:#a9adb5;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pstb{position:relative;flex:1;height:12px;margin-right:4px;border-radius:3px;background:rgba(255,255,255,.035)}
.pstb i{position:absolute;top:1px;bottom:1px;border-radius:3px;background:var(--c);opacity:.55;min-width:2px}
.pstb i.on{opacity:1;box-shadow:0 0 8px var(--c)}
.pstb i.done{opacity:.22}
.pstb i.skipped,.pstb i.cancelled{background:none;opacity:.6;box-shadow:inset 0 0 0 1px var(--c)}
.pstb u{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#ff5e5e;box-shadow:0 0 6px #ff5e5e;text-decoration:none}
.psleg{display:flex;gap:12px;flex-wrap:wrap;margin:4px 0 0 96px;font-size:9.5px;color:#9a9fa8;letter-spacing:.4px}
.psleg em{font-style:normal;display:flex;align-items:center;gap:5px}
.psleg em::before{content:"";width:12px;height:7px;border-radius:2px;background:var(--c)}
.psleg em.sk::before{background:none;box-shadow:inset 0 0 0 1px #9a9ea6}
.psli{display:flex;flex-direction:column;gap:3px}
.psli div{display:flex;gap:8px;font-size:11.5px;color:#a9adb5;letter-spacing:.3px;line-height:1.35}
.psli div b{flex:none;width:86px;font:500 11.5px 'Share Tech Mono',monospace;color:var(--acc)}
.psli div i{font-style:normal;color:#979ca5}
.psli div.on b{color:#ff9f2e}
.psrm{display:flex;align-items:center;gap:8px;min-height:30px;padding:2px 8px;border-radius:8px;cursor:pointer}
.psrm.sel{background:linear-gradient(180deg,#35373c,#25262a);box-shadow:0 2px 6px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)}
.psrm>span{flex:1;min-width:0;font-size:12.5px;color:#a9adb5;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.psrm.off>span{color:#8c919a}
.psrm small{font-size:9.5px;letter-spacing:1px;color:#979ca5;text-transform:uppercase}
.psrm .hk{height:24px;font-size:10px;letter-spacing:1px;padding:0 9px;flex:none}
.psroute{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.psroute em{font-style:normal;font-size:11.5px;color:#c9ccd2;letter-spacing:.3px}
.psroute em.ar{color:#979ca5}
.lmr.psp>.lmst{align-self:flex-end}
.lmr.psp .dlcd{min-width:64px}
.psrail-h{font:700 10px Rajdhani,sans-serif;letter-spacing:2.2px;color:#979ca5;text-transform:uppercase;margin:6px 0 0 6px}
.pswarn{color:#ffb35c}
.lmrow .chk.nr{font:700 11px Rajdhani,sans-serif;color:var(--acc)}
.lmrow.on .chk.nr::after{display:none}
</style>`;
class RPHouseSettings extends RPLightSettings {
  get meta() { return this.variants().full; }
  variants() { return { full: { bw: 1000, mh: 392, fw: false, fh: true, maxh: 392 } }; }
  html() {
    const tab = this._htab || 0;
    return `${LSET_CSS}${PS_CSS}<div class="lset hset" id="ls" style="--acc:${this._c.color}">
      <div class="lseg">${HOUSE_TABS.map((t, i) => `<div class="lsg${i === tab ? ' on' : ''}" id="hsg${i}" data-act="htab:${i}">${t}</div>`).join('')}</div>
      <div class="lpg" id="hpg0"${tab ? ' hidden' : ''}><div class="cap eng">Haus · gilt für alle Räume</div><div class="lmbody" id="lmbody" style="flex:1"></div></div>
      <div class="lpg" id="hpg1"${tab !== 1 ? ' hidden' : ''}><div class="lmo"><div class="lmrail zsrail" id="psrail"></div><div class="zsed" id="psed"></div></div></div>
      <div class="lpg" id="hpg2"${tab !== 2 ? ' hidden' : ''}><div class="cap eng">Batterie-Fenster der Statusleiste · je Raum</div><div class="lmbody" id="bmset" style="flex:1"></div></div>
      <div class="lmpk" id="lmpk" hidden></div>
      <div class="lmpk lkb" id="lkb" hidden></div>
    </div>`;
  }
  bind() { this._moBind(); this._psBind(); }
  _hRows(all) { return this._moRows('house', '', 'primary', all); }
  watch() {
    const a = this._psA() || {};
    return ['sensor.haus_sys_daytime', ...this._hRows(true).map(r => r.e).filter(Boolean), PS_ID, a.presence_source, (this._st('input_text.haus_light_motion_cfg_alarm_panel') || {}).state];
  }
  update() {
    if (window.__rpPsJump) { window.__rpPsJump = false; this.act('htab', '1'); }
    this._moPaint(); this._psPaint();
  }
  act(cmd, arg) {
    if (cmd === 'htab') { this._htab = +arg; HOUSE_TABS.forEach((_, i) => { this.$('hsg' + i).classList.toggle('on', i === this._htab); this.$('hpg' + i).hidden = i !== this._htab; }); if (this._htab === 2) this._bmLoad(); return; }
    if (cmd === 'bmcmp') { this._bmToggle(arg); return; }
    if (cmd.startsWith('ps')) { this._psAct(cmd.slice(2), arg); return; }
    super.act(cmd, arg);
  }
  _moFind(e) { return this._hRows(true).find(r => r.e === e) || null; }

  // ================================================================ Reiter "Batterie-Management"
  // Einstellung panel_compact der Integration batterie_manager: Räume, deren Batterie-Fenster nur die Liste zeigt
  _bmLoad() {
    const h = this._hass; if (!h || !h.connection) return;
    let unsub = null, done = false;
    h.connection.subscribeMessage(snap => {
      this._bmS = snap.settings || {}; this._bmErr = ''; this._bmPaint();
      if (!done) { done = true; if (unsub) unsub(); }
    }, { type: 'batterie_manager/subscribe' }).then(u => { unsub = u; if (done) u(); })
      .catch(e => { this._bmErr = /unknown command/i.test(String(e && (e.message || e.code))) ? 'Die Integration Batterie-Manager ist nicht geladen.' : String((e && e.message) || e); this._bmPaint(); });
    this._bmPaint();
  }
  _bmPaint() {
    const body = this.$('bmset'); if (!body) return;
    if (this._bmErr) { this._html(body, `<div class="lmmsg">${escH(this._bmErr)}</div>`); return; }
    if (!this._bmS) { this._html(body, '<div class="lmmsg">Lade …</div>'); return; }
    const on = this._bmS.panel_compact || [], cur = this._area(), rooms = Object.entries(RAUM_NAMES), half = Math.ceil(rooms.length / 2);
    const row = ([k, n]) => { const x = on.includes(k); return `<div class="lmr"><span>${escH(n)}${k === cur ? ' <small style="color:var(--acc)">· dieser Raum</small>' : ''}</span><div class="hk${x ? ' on' : ''}" data-act="bmcmp:${k}" style="--c:${x ? '#3ddc84' : 'var(--acc)'}"><i></i>${x ? 'Nur Liste' : 'Alles'}</div></div>`; };
    this._html(body, `<div class="lmcol"><div class="lmh">Nur die Batterieliste anzeigen</div>${rooms.slice(0, half).map(row).join('')}</div>
      <div class="lmcol"><div class="lmh">&nbsp;</div>${rooms.slice(half).map(row).join('')}
      <div class="lmmsg" style="margin-top:10px">„Nur Liste“: Das Fenster hinter dem Batterie-Symbol zeigt nur die Geräte (niedrigster Stand zuerst) – ohne Kopf, Reiter und Filter darüber.</div></div>`);
  }
  async _bmToggle(k) {
    if (!this._bmS) return;
    const on = new Set(this._bmS.panel_compact || []); on.has(k) ? on.delete(k) : on.add(k);
    const list = Object.keys(RAUM_NAMES).filter(r => on.has(r)).concat([...on].filter(r => !RAUM_NAMES[r]));
    this._bmS = { ...this._bmS, panel_compact: list }; this._bmPaint();
    try { await this._hass.callWS({ type: 'batterie_manager/settings/save', settings: { panel_compact: list } }); }
    catch (e) { this._bmErr = 'Speichern fehlgeschlagen: ' + ((e && e.message) || e); this._bmPaint(); this._bmErr = ''; setTimeout(() => this._bmLoad(), 2500); }
  }
  _moPaint() {
    const body = this.$('lmbody'); if (!body) return;
    const cols = [[], []]; let c = 0;
    for (const row of this._hRows(false)) { if (row.k === 'col2') { c = 1; continue; } cols[c].push(this._moRow(row)); }
    this._html(body, cols.map(x => `<div class="lmcol">${x.join('')}</div>`).join(''));
  }

  // ================================================================ Reiter "Anwesenheit"
  // Zustand: this._pz = { view: 'overview' | 'settings' | <Profil-ID> | 'new', sec, d (Entwurf), dirty, room, msg }
  _psA() { const s = this._st(PS_ID); return s ? s.attributes : null; }
  _pz() { return this._psz || (this._psz = { view: 'overview', sec: 'act', d: null, dirty: false, room: null }); }
  _psRooms() { return (this._psA() || {}).rooms || []; }
  _psRoomName(r) { const x = this._psRooms().find(y => y.room === r); return x ? x.name : String(r).toUpperCase(); }
  // Entwurf: Räume vollständig und in der Reihenfolge der Integration
  _psFill(p) {
    const d = JSON.parse(JSON.stringify(p)), have = Object.fromEntries((d.rooms || []).map(r => [r.room, r]));
    d.rooms = this._psRooms().map(({ room }) => ({ ...PS_ROOM_DEF, ...(have[room] || {}), room }));
    return d;
  }
  _psStatus(a) {
    if (a.active) return ['act', `Läuft · ${a.profile_name || ''} · seit ${zsWhen(a.since)}`];
    if (a.mode === 'off') return ['', 'Aus · die Simulation schaltet nichts'];
    if (a.mode === 'manual') return ['rdy', 'Manuell · startet gleich'];
    const p = (a.profiles || []).find(x => x.enabled);
    return ['rdy', p ? `Bereit · ${p.name}: ${p.why || 'wartet'}` : 'Bereit · kein aktives Profil'];
  }
  _psProfStat(p, a) {
    if (a.active && a.profile_id === p.id) return ['act', 'läuft'];
    if (!p.enabled) return ['', 'inaktiv'];
    return ['rdy', p.why || 'bereit'];
  }
  _psPaint() {
    const rail = this.$('psrail'), ed = this.$('psed'); if (!rail || !ed) return;
    const a = this._psA();
    if (!a) {
      this._html(rail, '');
      this._html(ed, '<div class="lmmsg">Die Anwesenheitssimulation ist in Home Assistant nicht eingerichtet (Integration <b>presence_sim</b>, Sensor <b>sensor.haus_sys_presence_sim</b> fehlt).</div>');
      return;
    }
    const z = this._pz(), list = a.profiles || [];
    if (!['overview', 'settings', 'new'].includes(z.view) && !list.find(p => p.id === z.view) && !(z.keep > Date.now())) { z.view = 'overview'; z.d = null; z.dirty = false; }
    const found = list.find(p => p.id === z.view);
    if (found && !z.dirty) z.d = this._psFill(found);
    const [sc, stx] = this._psStatus(a);
    const it = (view, name, sub, led) => `<div class="zsit${z.view === view ? ' on' : ''}" data-act="psview:${view}"><span class="zsd ${led}"></span><span class="dn"><b>${escH(name)}</b><small>${escH(sub)}</small></span></div>`;
    const items = [it('overview', 'Übersicht', stx.replace(/^[^·]*· /, ''), sc), it('settings', 'Einstellungen', 'Sperren · Ende · Ton', '')];
    items.push('<div class="psrail-h">Profile</div>');
    for (const p of list) { const [c, t] = this._psProfStat(p, a); items.push(it(p.id, p.name, `${(PS_SIM_TXT[p.sim_mode] || '')} · ${t}`, c)); }
    if (z.view === 'new' && z.d) items.push(`<div class="zsit on"><span class="zsd"></span><span class="dn"><b>${escH(z.d.name)}</b><small>neu · noch nicht gespeichert</small></span></div>`);
    this._html(rail, `<div class="zslist">${items.join('')}</div><div class="hk" data-act="psnew" style="--c:#3ddc84"><i></i>+ Neues Profil</div>`);
    // nicht neu zeichnen, während eine Uhrzeit-/Farbauswahl offen ist (sonst schließt sie sich)
    const ae = this.shadowRoot.activeElement;
    if (ae && ae.tagName === 'INPUT' && ed.contains(ae)) return;
    if (z.view === 'overview') this._html(ed, this._psOverview(a, sc, stx));
    else if (z.view === 'settings') this._html(ed, this._psSettings(a));
    else if (z.d) this._html(ed, this._psEditor(a, z));
    const m = this.shadowRoot.getElementById('psmsg'); if (m) m.style.color = z.msgOk === false ? '#ff8a8a' : '#3ddc84';
  }
  _psOverview(a, sc, stx) {
    const plan = a.plan || {}, ents = plan.entries || [], profs = a.profiles || [];
    const hd = `<div class="zshd"><div class="psst"><span class="zsd ${sc}"></span>${escH(stx)}</div>
      <div class="zsseg">${PS_MODES.map(([v, n]) => `<div class="lsg${a.mode === v ? ' on' : ''}" data-act="psmode:${v}">${n}</div>`).join('')}</div></div>`;
    const man = a.mode === 'manual' ? `<div class="lmr stack"><span>Profil für Manuell</span><div class="lmseg">${profs.map(p => `<div class="hk${(a.settings.manual_profile || (profs.find(x => x.enabled) || {}).id) === p.id ? ' on' : ''}" data-act="psmprof:${p.id}" style="--c:var(--acc)"><i></i>${escH(p.name)}</div>`).join('')}</div></div>` : '';
    const home = a.home == null ? 'keine Quelle' : a.home ? 'jemand zuhause' : 'niemand zuhause' + (a.away_since ? ' seit ' + zsWhen(a.away_since) : '');
    const info = `<div class="psinfo"><span>Anwesenheit <b>${escH(home)}</b></span><span>Alarmanlage <b>${escH(a.alarm ? PS_ALARM[a.alarm] || a.alarm : 'keine Quelle')}</b></span>${a.active ? `<span>Sperren <b>${['lock_motion', 'lock_schedule', 'lock_lux'].filter(k => a[k]).length ? [['lock_motion', 'Bewegung'], ['lock_schedule', 'Zeit'], ['lock_lux', 'Helligkeit']].filter(([k]) => a[k]).map(([, n]) => n).join(' · ') : 'keine'}</b></span>` : ''}</div>`;
    const pn = (profs.find(p => p.id === plan.profile) || {}).name;
    const tl = `<div class="pshd2"><div class="lmh">Tagesplan ${plan.from ? `${zsWhen(plan.from).replace(' 12:00', '')} 12:00 – ${zsWhen(plan.to).replace(' 12:00', '')} 12:00` : ''}${pn ? ' · ' + escH(pn) : ''}</div><div class="hk" data-act="psreplan" style="--c:var(--acc)"><i></i>Neu würfeln</div>${a.active && a.mode === 'manual' ? '<div class="hk" data-act="psstop" style="--c:#ff6b6b"><i></i>Beenden</div>' : ''}</div>
      ${psTimeline(ents, plan.from || psDayBounds()[0], plan.to || psDayBounds()[1], a.rooms)}`;
    const now = Date.now(), nm = r => escH(this._psRoomName(r));
    const nx = ents.filter(e => e.state === 'on' || (e.state === 'pending' && +new Date(e.off) > now)).slice(0, 7)
      .map(e => `<div class="${e.state}"><b>${psHM(e.on)}–${psHM(e.off)}</b><span>${nm(e.room)} <i>· ${(PS_KIND[e.kind] || [e.kind])[0]}${e.state === 'on' ? ' · läuft' : ''}</i></span></div>`).join('') || '<div><span><i>Heute nichts mehr geplant.</i></span></div>';
    const lg = (a.log || []).slice(0, 7).map(l => `<div><b>${zsWhen(l.at).replace('heute ', '')}</b><span>${l.room ? nm(l.room) + ' ' : ''}${escH(l.what)}${l.kind ? ` <i>· ${(PS_KIND[l.kind] || [l.kind])[0]}</i>` : ''}</span></div>`).join('') || '<div><span><i>Noch nichts geschaltet.</i></span></div>';
    return `${hd}<div class="psov">${man}${info}${tl}
      <div class="lmbody" style="overflow:visible"><div class="lmcol"><div class="lmh">Als Nächstes</div><div class="psli">${nx}</div></div><div class="lmcol"><div class="lmh">Protokoll</div><div class="psli">${lg}</div></div></div></div>`;
  }
  _psSettings(a) {
    const s = a.settings || {}, L = [[], []], h = (c, t) => L[c].push(`<div class="lmh">${t}</div>`);
    const row = (c, l, ctl, sub) => L[c].push(`<div class="lmr${sub ? ' sub' : ''}"><span>${l}</span>${ctl}</div>`);
    const tog = key => `<div class="hk${s[key] ? ' on' : ''}" data-act="psg:${key}|t" style="--c:${s[key] ? '#3ddc84' : 'var(--acc)'}"><i></i>${s[key] ? 'An' : 'Aus'}</div>`;
    const seg = (key, o) => `<div class="lmseg">${o.map(([v, n]) => `<div class="hk${s[key] === v ? ' on' : ''}" data-act="psg:${key}|${v}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`;
    const nm = id => { const x = this._st(id); return x ? x.attributes.friendly_name || id : id + ' (fehlt)'; };
    h(0, 'Während die Simulation läuft, schaltet nicht ein …');
    row(0, 'Bewegungssteuerung', tog('lock_motion'));
    row(0, 'Zeitsteuerung', tog('lock_schedule'));
    row(0, 'Helligkeitssteuerung', tog('lock_lux'));
    L[0].push('<div class="lhint">Ausschalten läuft bei allen normal weiter. Lampen, die die Simulation eingeschaltet hat, fasst keine andere Funktion an.</div>');
    h(0, 'Ende der Simulation');
    L[0].push(`<div class="lmr stack"><span>Eigene Lampen</span>${seg('end_action', [['off', 'Ausschalten'], ['keep', 'Anlassen']])}</div>`);
    row(0, 'Manuell endet bei Heimkehr', tog('manual_end_on_return'));
    L[0].push('<div class="lhint">Greift nur, wenn beim manuellen Start niemand zuhause war – ein Test zuhause läuft weiter.</div>');
    h(1, 'Ton');
    row(1, 'Ton erlaubt (alle Profile)', tog('sound_enabled'));
    const sp = s.speakers || [];
    row(1, 'Lautsprecher', `<div class="hk lmen" data-act="psgpick:speakers" style="--c:var(--acc)"><i></i><span>${!sp.length ? 'Keine' : sp.length === 1 ? escH(nm(sp[0])) : sp.length + ' gewählt'}</span></div>`, true);
    L[1].push('<div class="lhint">Ton-Bausteine (Radio, Reaktion auf Klingeln) folgen. Ist der Ton hier aus, spielt kein Profil etwas ab.</div>');
    h(1, 'Quellen');
    const al = (this._st('input_text.haus_light_motion_cfg_alarm_panel') || {}).state;
    row(1, 'Anwesenheit', `<div class="lcd lmro">${escH(a.presence_source ? nm(a.presence_source) : 'keine')}</div>`);
    row(1, 'Alarmanlage', `<div class="lcd lmro">${escH(al && al !== 'unknown' ? nm(al) : 'keine')}</div>`);
    L[1].push('<div class="lhint">Einstellbar im Reiter <b>Haus</b>. Fehlt eine Quelle, startet die Simulation nicht automatisch.</div>');
    return `<div class="zshd"><div class="psst">Einstellungen · gelten für alle Profile und sofort</div></div>
      <div class="lmbody">${L.map(x => `<div class="lmcol">${x.join('')}</div>`).join('')}</div>
      <div class="zsft"><div class="lmsg" id="psmsg">${escH(this._pz().msg || '')}</div></div>`;
  }
  _psEditor(a, z) {
    const d = z.d;
    const hd = `<div class="zshd"><div class="zsname" data-act="psname">${escH(d.name)}</div>
      <div class="hk${d.enabled ? ' on' : ''}" data-act="psset:enabled|t" style="--c:${d.enabled ? '#3ddc84' : 'var(--acc)'}"><i></i>${d.enabled ? 'Aktiv' : 'Inaktiv'}</div>
      <div class="zsseg">${PS_SECS.map(([s, n]) => `<div class="lsg${z.sec === s ? ' on' : ''}" data-act="pssec:${s}">${n}</div>`).join('')}</div></div>`;
    const cols = this._psRows(d, z.sec, a);
    const running = a.active && a.profile_id === z.view;
    const ft = `<div class="zsft"><div class="lmsg" id="psmsg">${escH(z.msg || '')}</div>
      <div class="hk" data-act="pspreview" style="--c:var(--acc)"><i></i>Vorschau</div>
      ${z.view !== 'new' ? (running && a.mode === 'manual' ? '<div class="hk" data-act="psstop" style="--c:#ff6b6b"><i></i>Beenden</div>' : `<div class="hk" data-act="psstart" style="--c:var(--acc)"><i></i>Jetzt starten</div>`) : ''}
      ${z.view !== 'new' ? `<div class="hk${z.del ? ' on' : ''}" data-act="psdel" style="--c:#ff6b6b"><i></i>${z.del ? 'Wirklich löschen?' : 'Löschen'}</div>` : '<div class="hk" data-act="pscancel"><i></i>Verwerfen</div>'}
      <div class="hk${z.dirty ? ' on' : ''}" data-act="pssave" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
    return hd + `<div class="lmbody">${cols.map(x => `<div class="lmcol">${x.join('')}</div>`).join('')}</div>` + ft;
  }
  _psRows(d, sec, a) {
    const L = [[], []], h = (c, t) => L[c].push(`<div class="lmh">${t}</div>`), z = this._pz();
    const row = (c, l, ctl, sub) => L[c].push(`<div class="lmr${sub ? ' sub' : ''}"><span>${l}</span>${ctl}</div>`);
    const stack = (c, l, ctl) => L[c].push(`<div class="lmr stack"><span>${l}</span>${ctl}</div>`);
    const hint = (c, t) => L[c].push(`<div class="lhint" style="margin:-2px 0 4px">${t}</div>`);
    const seg = (key, o) => `<div class="lmseg">${o.map(([v, n]) => `<div class="hk${d[key] === v ? ' on' : ''}" data-act="psset:${key}|${v}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`;
    const tog = key => `<div class="hk${d[key] ? ' on' : ''}" data-act="psset:${key}|t" style="--c:${d[key] ? '#3ddc84' : 'var(--acc)'}"><i></i>${d[key] ? 'An' : 'Aus'}</div>`;
    const fmt = (key, v) => { const u = (PS_NUM[key] || [])[3] || ''; return (Number.isInteger(v) ? v : v.toFixed(1)) + u; };
    const num = (key, path = key) => { const v = Number(path.startsWith('r.') ? (d.rooms.find(r => r.room === path.split('.')[1]) || {})[key] : d[key]); return `<div class="lmst"><div class="hk" data-psstep="${path}|-1">−</div><div class="dlcd">${fmt(key, v)}</div><div class="hk" data-psstep="${path}|1">+</div></div>`; };
    const pair = (a1, a2) => `<div class="lmst">${num(a1).replace(/^<div class="lmst">|<\/div>$/g, '')}<span style="color:#979ca5;font-size:11px">bis</span>${num(a2).replace(/^<div class="lmst">|<\/div>$/g, '')}</div>`;
    const time = key => `<input class="lmin" type="time" data-pst="${key}" value="${escH(d[key])}">`;
    const prow = (c, l, ctl) => L[c].push(`<div class="lmr stack psp"><span>${l}</span>${ctl}</div>`);
    const tpair = (k1, k2) => `<div class="lmst">${time(k1)}<span style="color:#979ca5;font-size:11px">bis</span>${time(k2)}</div>`;
    const days = (key, act) => `<div class="zsday">${ZS_DAYS.map((n, i) => `<div class="hk${(d[key] || []).includes(i) ? ' on' : ''}" data-act="${act}:${i}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`;
    const route = key => {
      const r = d[key] || [];
      return `<div class="psroute">${r.length ? r.map((x, i) => `${i ? '<em class="ar">→</em>' : ''}<em>${escH(this._psRoomName(x))}</em>`).join('') : '<em class="ar">keine Räume</em>'}<div class="hk" data-act="psroute:${key}" style="--c:var(--acc);height:26px;font-size:10px;padding:0 10px"><i></i>Ändern</div></div>`;
    };
    const nm = id => { const s = this._st(id); return s ? s.attributes.friendly_name || id : id + ' (fehlt)'; };
    if (sec === 'act') {
      h(0, 'Betriebsart');
      L[0].push(`<div class="lmr stack">${seg('sim_mode', PS_SIM)}</div>`);
      hint(0, { auto: 'Je Raum: gelernt (folgt) → feste Zeiten des Raums, falls vorhanden → Zufall.', fixed: 'Nur die festen Zeiten der Räume (mit halber Streuung). Räume ohne feste Zeiten machen abends nicht mit.', random: 'Haupt- und Besuchsräume nach Zufall, feste Zeiten werden ignoriert.' }[d.sim_mode] || '');
      row(0, 'Priorität', num('priority'));
      hint(0, 'Passen mehrere Profile, startet das mit der kleinsten Zahl.');
      h(0, 'Wochentage');
      L[0].push(days('days', 'psday'));
      L[0].push(`<div class="lmseg" style="justify-content:flex-start">${[['all', 'Täglich'], ['work', 'Mo–Fr'], ['wend', 'Sa+So']].map(([x, n]) => `<div class="hk sm" data-act="psdays:${x}" style="padding:0 10px"><i></i>${n}</div>`).join('')}</div>`);
      h(1, 'Startet automatisch, wenn …');
      stack(1, 'Anwesenheit', seg('presence', [['ignore', 'Egal'], ['away', 'Niemand zuhause']]));
      if (d.presence === 'away') row(1, 'seit mindestens', num('away_min'), true);
      stack(1, 'Alarmanlage', seg('alarm', [['ignore', 'Egal'], ['armed_away', 'Scharf abwesend'], ['armed_any', 'Scharf beliebig'], ['armed_vacation', 'Urlaub']]));
      if (d.presence !== 'ignore' && d.alarm !== 'ignore') row(1, 'Verknüpfung', seg('logic', [['and', 'Beides'], ['or', 'Eins davon']]));
      if (d.presence === 'ignore' && d.alarm === 'ignore') hint(1, '<span class="pswarn">Ohne Anwesenheit und Alarmanlage startet das Profil nur manuell.</span>');
      h(1, 'Zeitraum');
      row(1, 'Nur in einem Zeitraum', tog('date_enabled'));
      if (d.date_enabled) L[1].push(`<div class="lmr sub"><span>Vom</span><div class="lmst"><div class="hk" data-psstep="date_from|-1">−</div><div class="dlcd">${psDateTxt(d.date_from)}</div><div class="hk" data-psstep="date_from|1">+</div></div></div>
        <div class="lmr sub"><span>Bis</span><div class="lmst"><div class="hk" data-psstep="date_to|-1">−</div><div class="dlcd">${psDateTxt(d.date_to)}</div><div class="hk" data-psstep="date_to|1">+</div></div></div>`);
      const p = (a.profiles || []).find(x => x.id === z.view);
      if (p && p.why) row(1, 'Gerade', `<div class="lcd lmro" style="font-size:12px">${escH(p.why)}</div>`);
      return L;
    }
    if (sec === 'rooms') {
      if (!d.rooms.find(r => r.room === z.room)) z.room = (d.rooms.find(r => r.enabled) || d.rooms[0] || {}).room;
      h(0, 'Räume · antippen zum Bearbeiten');
      for (const r of d.rooms) L[0].push(`<div class="psrm${r.room === z.room ? ' sel' : ''}${r.enabled ? '' : ' off'}" data-act="psrsel:${r.room}"><span>${escH(this._psRoomName(r.room))}</span>${r.enabled ? `<small>${r.role === 'anchor' ? 'Hauptraum' : 'Besuch'}${r.slots.length ? ' · fest' : ''}</small>` : ''}
        <div class="hk${r.enabled ? ' on' : ''}" data-act="psrset:${r.room}|enabled|t" style="--c:${r.enabled ? '#3ddc84' : 'var(--acc)'}"><i></i>${r.enabled ? 'An' : 'Aus'}</div></div>`);
      const r = d.rooms.find(x => x.room === z.room);
      if (!r) return L;
      const rp = `r.${r.room}`;
      h(1, escH(this._psRoomName(r.room)));
      const lamps = r.lights.length ? r.lights : (((this._st(`group.${r.room}_light_motion_primary`) || {}).attributes || {}).entity_id || []);
      row(1, 'Lampen', `<div class="hk lmen" data-act="psrpick:${r.room}" style="--c:var(--acc)"><i></i><span>${r.lights.length ? (r.lights.length === 1 ? escH(nm(r.lights[0])) : r.lights.length + ' gewählt') : 'Bewegungslicht'}</span></div>`);
      L[1].push(`<div class="zslamps">${lamps.length ? lamps.map(e => escH(nm(e))).join('<br>') : '<span class="pswarn">Keine Lampen – bitte wählen (das Bewegungslicht primär ist leer).</span>'}</div>`);
      stack(1, 'Rolle am Abend', `<div class="lmseg">${[['anchor', 'Hauptraum'], ['visitor', 'Besuchsraum']].map(([v, n]) => `<div class="hk${r.role === v ? ' on' : ''}" data-act="psrset:${r.room}|role|${v}" style="--c:var(--acc)"><i></i>${n}</div>`).join('')}</div>`);
      if (r.role === 'visitor') {
        row(1, 'Häufigkeit (1–5)', num('weight', rp + '.weight'), true);
        prow(1, 'Dauer je Besuch', `<div class="lmst">${num('min_on', rp + '.min_on').replace(/^<div class="lmst">|<\/div>$/g, '')}<span style="color:#979ca5;font-size:11px">bis</span>${num('max_on', rp + '.max_on').replace(/^<div class="lmst">|<\/div>$/g, '')}</div>`);
      } else hint(1, 'Vom Abendstart bis zum Zu-Bett-Gehen an.');
      h(1, 'Feste Zeiten');
      r.slots.forEach((s, i) => L[1].push(`<div class="zsslot"><b>VON</b><input class="lmin" type="time" data-pst="slot|${r.room}|${i}|from" value="${s.from}"><b>BIS</b><input class="lmin" type="time" data-pst="slot|${r.room}|${i}|to" value="${s.to}"><div class="hk" data-act="psrslot:${r.room}|del|${i}" style="--c:#ff6b6b">✕</div></div>`));
      if (r.slots.length < 8) L[1].push(`<div class="lmseg" style="justify-content:flex-start;margin-top:2px"><div class="hk sm" data-act="psrslot:${r.room}|add" style="padding:0 12px;--c:#3ddc84"><i></i>+ Zeit hinzufügen</div></div>`);
      hint(1, d.sim_mode === 'random' ? 'Betriebsart Zufall: feste Zeiten werden nicht genutzt.' : 'Gelten in den Betriebsarten Fest und Automatisch (± halbe Streuung). Zeiten vor 12:00 zählen zum nächsten Morgen.');
      return L;
    }
    if (sec === 'eve') {
      h(0, 'Abendstart');
      stack(0, 'Beginnt', seg('evening_start', [['sun', 'Sonnenuntergang'], ['time', 'Uhrzeit']]));
      if (d.evening_start === 'sun') row(0, 'Versatz', num('evening_offset'), true);
      else row(0, 'Um', time('evening_time'), true);
      row(0, 'Streuung ±', num('jitter'));
      h(0, 'Besuche');
      row(0, 'Gleichzeitig', num('max_parallel'));
      prow(0, 'Pause zwischen Besuchen', pair('gap_min', 'gap_max'));
      hint(0, 'Haupträume bleiben den ganzen Abend an, Besuchsräume gehen zwischendurch kurz an. Startet der Abend später als 30 min vor dem Zu-Bett-Gehen, beginnt er trotzdem 30 min davor.');
      h(1, 'Zu Bett');
      row(1, 'Zu-Bett-Ablauf', tog('bed_enabled'));
      row(1, 'Zwischen', tpair('bed_from', 'bed_to'), true);
      if (d.bed_enabled) {
        stack(1, 'Weg', route('bed_route'));
        prow(1, 'Dauer je Raum', pair('bed_step_min', 'bed_step_max'));
        prow(1, 'Dauer letzter Raum', pair('bed_last_min', 'bed_last_max'));
      }
      hint(1, d.bed_enabled ? 'Um diese Zeit gehen die Haupträume aus, dann nacheinander der Weg ins Bett.' : 'Aus: zur Zu-Bett-Zeit geht einfach alles aus.');
      return L;
    }
    if (sec === 'night') {
      h(0, 'Nachts kurz auf');
      row(0, 'Nacht-Ablauf', tog('night_enabled'));
      if (d.night_enabled) {
        row(0, 'Wahrscheinlichkeit', num('night_chance'), true);
        row(0, 'Zwischen', tpair('night_from', 'night_to'), true);
        stack(0, 'Weg', route('night_route'));
        prow(0, 'Dauer je Raum', pair('night_step_min', 'night_step_max'));
        row(0, 'Helligkeit', num('night_brightness'), true);
      }
      h(1, 'Morgens');
      row(1, 'Morgen-Ablauf', tog('morning_enabled'));
      if (d.morning_enabled) {
        L[1].push(days('morning_days', 'psmday'));
        row(1, 'Zwischen', tpair('morning_from', 'morning_to'), true);
        stack(1, 'Weg', route('morning_route'));
        prow(1, 'Dauer je Raum', pair('morning_step_min', 'morning_step_max'));
        row(1, 'Nur solange dunkel', tog('morning_dark_only'), true);
      }
      return L;
    }
    // Licht
    h(0, 'Licht');
    stack(0, 'Modus', seg('mode', [['color_temp', 'Weiß'], ['color', 'Farbe'], ['auto', 'Beides'], ['brightness', 'Nur hell'], ['on', 'Nur ein']]));
    if (d.mode !== 'on') row(0, 'Helligkeit', num('brightness'));
    if (d.mode === 'color_temp' || d.mode === 'auto') row(0, 'Farbtemperatur', num('kelvin'));
    if (d.mode === 'color' || d.mode === 'auto') row(0, 'Farbe', `<label class="lmcolr" style="--c:${d.color}"><input type="color" data-psc="1" value="${d.color.toLowerCase()}"></label>`);
    row(0, 'Überblendzeit', num('transition'));
    h(1, 'Weitere Bausteine');
    row(1, 'TV-Flimmern', tog('tv_enabled'));
    if (d.tv_enabled) row(1, 'Lampe', `<div class="hk lmen" data-act="pspick:tv_light" style="--c:var(--acc)"><i></i><span>${d.tv_light ? escH(nm(d.tv_light)) : 'Keine'}</span></div>`, true);
    row(1, 'Reaktion auf Ring (Bewegung, Klingeln)', tog('ring_enabled'));
    row(1, 'Ton', tog('sound_enabled'));
    hint(1, `Diese Bausteine werden schon gespeichert, ihre Wirkung folgt mit den nächsten Versionen.${d.sound_enabled && !((a.settings || {}).sound_enabled) ? ' <span class="pswarn">Ton ist unter Einstellungen hausweit aus.</span>' : ''}`);
    return L;
  }
  _psDirty() { const z = this._pz(); z.dirty = true; z.del = false; this._psPaint(); }
  _psMsg(t, ok = true) { const z = this._pz(); z.msg = t; z.msgOk = ok; this._psPaint(); clearTimeout(z.mt); z.mt = setTimeout(() => { z.msg = ''; this._psPaint(); }, 4000); }
  _psWS(type, extra) { return this._hass.callWS({ type: 'presence_sim/' + type, ...extra }); }
  async _psAct(op, arg) {
    const z = this._pz(), a = this._psA() || {}, d = z.d;
    const msg = (t, ok) => this._psMsg(t, ok), err = e => msg('Fehler: ' + ((e && e.message) || e), false), dirty = () => this._psDirty();
    const room = c => d && d.rooms.find(r => r.room === c);
    if (op === 'view') { if (z.view === arg) return; z.view = arg; z.d = null; z.dirty = false; z.del = false; z.msg = ''; this._psPaint(); return; }
    if (op === 'new') {
      const base = (a.profiles || [])[0];
      z.view = 'new'; z.d = this._psFill({ ...PS_DEF, rooms: base ? base.rooms.map(r => ({ ...r })) : [] }); z.dirty = true; z.del = false; z.sec = 'act'; z.msg = '';
      this._psPaint(); return;
    }
    if (op === 'mode') { try { await this._psWS('settings', { settings: { mode: arg } }); } catch (e) { err(e); } return; }
    if (op === 'mprof') { try { await this._psWS('settings', { settings: { manual_profile: arg } }); } catch (e) { err(e); } return; }
    if (op === 'g') {
      const [key, v] = arg.split('|'), s = a.settings || {};
      try { await this._psWS('settings', { settings: { [key]: v === 't' ? !s[key] : v } }); msg('Übernommen.'); } catch (e) { err(e); }
      return;
    }
    if (op === 'gpick') {
      this._pkShow({ l: 'Lautsprecher', dom: ['media_player'], multi: true }, [...((a.settings || {}).speakers || [])], async sel => { try { await this._psWS('settings', { settings: { speakers: sel } }); msg('Übernommen.'); } catch (e) { err(e); } });
      return;
    }
    if (op === 'replan') { try { await this._psWS('replan'); msg('Neuer Tagesplan erzeugt.'); } catch (e) { err(e); } return; }
    if (op === 'stop') { try { await this._psWS('stop'); msg('Simulation beendet.'); } catch (e) { err(e); } return; }
    if (op === 'rt') { this._psRouteAct(arg); return; }
    if (op === 'cancel') { z.view = 'overview'; z.d = null; z.dirty = false; this._psPaint(); return; }
    if (!d) return;
    if (op === 'sec') { z.sec = arg; this._psPaint(); return; }
    if (op === 'name') { this._kbOpen('Profilname', d.name === PS_DEF.name ? '' : d.name, 40, v => { d.name = v.trim() || d.name; dirty(); }); return; }
    if (op === 'set') {
      const [key, v] = arg.split('|');
      d[key] = v === 't' ? !d[key] : v;
      if (key === 'date_enabled' && d.date_enabled && !d.date_from) { d.date_from = psAddDay('', 0); d.date_to = psAddDay('', 14); }
      dirty(); return;
    }
    if (op === 'day' || op === 'mday') { const k = op === 'day' ? 'days' : 'morning_days', i = +arg; d[k] = d[k].includes(i) ? d[k].filter(x => x !== i) : [...d[k], i].sort(); dirty(); return; }
    if (op === 'days') { d.days = { all: [0, 1, 2, 3, 4, 5, 6], work: [0, 1, 2, 3, 4], wend: [5, 6] }[arg]; dirty(); return; }
    if (op === 'rsel') { z.room = arg; this._psPaint(); return; }
    if (op === 'rset') { const [c, key, v] = arg.split('|'), r = room(c); if (!r) return; r[key] = v === 't' ? !r[key] : v; if (key === 'enabled') z.room = c; dirty(); return; }
    if (op === 'rslot') {
      const [c, what, i] = arg.split('|'), r = room(c); if (!r) return;
      if (what === 'add') { const last = r.slots[r.slots.length - 1]; r.slots.push(last ? { from: last.to, to: last.to } : { from: '19:00', to: '21:00' }); }
      if (what === 'del') r.slots.splice(+i, 1);
      dirty(); return;
    }
    if (op === 'rpick') { const r = room(arg); if (!r) return; this._pkShow({ l: 'Lampen · ' + this._psRoomName(arg), dom: ['light', 'switch', 'group'], multi: true }, [...r.lights], sel => { r.lights = sel; dirty(); }); return; }
    if (op === 'pick') { this._pkShow({ l: 'Lampe für TV-Flimmern', dom: ['light'], multi: false }, d.tv_light ? [d.tv_light] : [], sel => { d.tv_light = sel[0] || ''; dirty(); }); return; }
    if (op === 'route') { this._psRouteOpen(arg); return; }
    if (op === 'preview') {
      try {
        const res = await this._psWS('preview', { profile: psClean(d) }), [f, t] = psDayBounds(), pk = this.$('lmpk');
        pk.hidden = false;
        pk.innerHTML = `<div class="top"><b>Vorschau · ${escH(d.name)}</b><span class="lhint" style="flex:1">so könnte der heutige Simulationstag aussehen (jedes Mal neu gewürfelt, ohne Speichern)</span></div>
          <div style="flex:1;min-height:0;overflow-y:auto">${psTimeline(res.result || [], f, t, a.rooms)}</div>
          <div class="bt"><div class="hk" data-act="pspreview" style="--c:var(--acc)"><i></i>Neu würfeln</div><div class="hk on" data-act="mopk:cancel" style="--c:#3ddc84"><i></i>Schließen</div></div>`;
        this._moPk = { row: {}, sel: [] };
      } catch (e) { err(e); }
      return;
    }
    if (op === 'start') {
      if (z.dirty) { msg('Erst speichern, dann starten.', false); return; }
      try { await this._psWS('start', { profile_id: z.view }); msg('Simulation manuell gestartet.'); } catch (e) { err(e); }
      return;
    }
    if (op === 'del') {
      if (!z.del) { z.del = true; this._psPaint(); clearTimeout(z.dt); z.dt = setTimeout(() => { z.del = false; this._psPaint(); }, 4000); return; }
      try { await this._psWS('delete', { profile_id: z.view }); z.view = 'overview'; z.d = null; z.dirty = false; z.del = false; msg('Profil gelöscht.'); } catch (e) { err(e); }
      return;
    }
    if (op === 'save') {
      if (!d.days.length) { msg('Mindestens einen Wochentag wählen.', false); return; }
      if (!d.rooms.some(r => r.enabled)) { msg('Mindestens einen Raum einschalten.', false); return; }
      if (d.date_enabled && d.date_to < d.date_from) { msg('Der Zeitraum endet vor seinem Beginn.', false); return; }
      try {
        const res = await this._psWS('save', { profile: { ...psClean(d), id: z.view === 'new' ? undefined : z.view } });
        z.view = res.result; z.dirty = false; z.keep = Date.now() + 5000;
        msg(d.presence === 'ignore' && d.alarm === 'ignore' ? 'Gespeichert – startet nur manuell.' : 'Gespeichert.', !(d.presence === 'ignore' && d.alarm === 'ignore'));
      } catch (e) { err(e); }
    }
  }
  // Weg (Zu Bett / Nacht / Morgen): Räume in der angetippten Reihenfolge
  _psRouteOpen(key) {
    const d = this._pz().d; if (!d) return;
    this._psRt = { key, sel: [...(d[key] || [])] };
    const pk = this.$('lmpk'); pk.hidden = false;
    this._psRoutePaint();
  }
  _psRoutePaint() {
    const rt = this._psRt, pk = this.$('lmpk'); if (!rt || !pk) return;
    const t = { bed_route: 'Weg ins Bett', night_route: 'Weg nachts', morning_route: 'Weg morgens' }[rt.key] || 'Weg';
    pk.innerHTML = `<div class="top"><b>${t}</b><span class="lhint" style="flex:1">in der Reihenfolge antippen, in der die Räume nacheinander angehen</span></div>
      <div class="lmlist">${this._psRooms().map(({ room, name }) => { const i = rt.sel.indexOf(room); return `<div class="lmrow${i >= 0 ? ' on' : ''}" data-act="psrt:t|${room}"><span class="chk nr">${i >= 0 ? i + 1 : ''}</span><span class="dn"><b>${escH(name)}</b></span></div>`; }).join('')}</div>
      <div class="bt"><div class="hk" data-act="psrt:clear"><i></i>Leeren</div><div class="hk" data-act="psrt:cancel"><i></i>Abbrechen</div><div class="hk on" data-act="psrt:ok" style="--c:#3ddc84"><i></i>Übernehmen</div></div>`;
  }
  _psRouteAct(arg) {
    const rt = this._psRt, pk = this.$('lmpk'), d = this._pz().d; if (!rt) return;
    if (arg.startsWith('t|')) { const r = arg.slice(2); rt.sel = rt.sel.includes(r) ? rt.sel.filter(x => x !== r) : [...rt.sel, r]; this._psRoutePaint(); return; }
    if (arg === 'clear') { rt.sel = []; this._psRoutePaint(); return; }
    if (arg === 'ok' && d) { d[rt.key] = rt.sel; this._psDirty(); }
    pk.hidden = true; this._psRt = null;
  }
  // Zahlen: Tippen = ein Schritt, Halten = immer schneller (wie Zeit-/Helligkeitssteuerung)
  _psBind() {
    const root = this.shadowRoot; if (this._psBound) return; this._psBound = true;
    root.addEventListener('pointerdown', ev => {
      const t = ev.target.closest && ev.target.closest('[data-psstep]'); if (!t) return;
      const d = this._pz().d; if (!d) return;
      ev.preventDefault();
      const [path, dir] = t.dataset.psstep.split('|');
      let n = 0;
      const go = () => {
        const f = n < 8 ? 1 : n < 20 ? 4 : 12; n++;
        if (path === 'date_from' || path === 'date_to') d[path] = psAddDay(d[path], +dir * f);
        else {
          const parts = path.split('.'), key = parts[parts.length - 1], obj = parts[0] === 'r' ? d.rooms.find(r => r.room === parts[1]) : d;
          if (!obj) return;
          const [lo, hi, st] = PS_NUM[key];
          obj[key] = clamp(Math.round((Number(obj[key]) + +dir * st * f) / st) * st, lo, hi);
        }
        this._psDirty();
      };
      go(); clearInterval(this._psRep);
      const to = setTimeout(() => { this._psRep = setInterval(go, 110); }, 420);
      const up = () => { clearTimeout(to); clearInterval(this._psRep); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
    root.addEventListener('change', ev => {
      const t = ev.target; if (!t.dataset || !(t.dataset.pst || t.dataset.psc)) return;
      const d = this._pz().d; if (!d) return;
      if (t.dataset.psc) { d.color = t.value.toUpperCase(); this._psDirty(); return; }
      if (!/^\d\d:\d\d/.test(t.value)) return;
      const p = t.dataset.pst.split('|');
      if (p[0] === 'slot') { const r = d.rooms.find(x => x.room === p[1]), s = r && r.slots[+p[2]]; if (s) s[p[3]] = t.value.slice(0, 5); }
      else d[p[0]] = t.value.slice(0, 5);
      this._psDirty();
    });
    root.addEventListener('input', ev => { const t = ev.target; if (t.dataset && t.dataset.psc) t.parentElement.style.setProperty('--c', t.value); });
  }
}

// ---------------------------------------------------------------- Türklingel-Einstellungen (Einstellungsfenster)
// Links vertikale Reiter (Haustür / Wohnungstür / Ring Intercom), rechts die Seite – Wechsel per Tippen oder Wischen (hoch/runter).
// Pro Tür: Anzeigen auf (alle / Auswahl mehrerer Browser-Mod-Geräte / aus), Kamera (Fenster: auto / keine / camera.*,
// IP-Kamera hinzufügen, im Netzwerk gefundene), Klingelton (eingebaut + eigene aus dem Medienordner), Lautstärke, Dauer, Test.
// Helfer je Tür (key): input_text.klingel_<key>_ziel (alle | aus | id1,id2) / _ton / _kamera, input_number.klingel_<key>_lautstarke / _dauer
// Geräteliste (gemeinsam): input_select.klingel_gerate (Option 1 = Platzhalter "–", dann Browser-IDs)
// Lautsprecher (Music Assistant, z. B. Snapcast-Clients): input_text.klingel_<key>_lautsprecher (media_player-IDs), input_number.klingel_<key>_lautsprecher_lautstarke
const DOOR_TONES = ['Ding-Dong', 'Dreiklang', 'Westminster', 'Gong', 'Glocke', 'Doppelton'];
const DOOR_ICON = {
  room: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  door: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12.5" r="1" fill="currentColor"/></svg>',
  flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V5l9-2v18M15 5h3v16M3 21h18"/><circle cx="12" cy="12.5" r="1" fill="currentColor"/></svg>',
};
// Integrationen, deren Netzwerk-Funde als Kamera angeboten werden
const DOOR_CAM_DOMAINS = ['onvif', 'reolink', 'amcrest', 'axis', 'hikvision', 'hikvisioncam', 'dlink', 'foscam', 'ezviz', 'unifiprotect', 'tapo', 'tplink', 'doorbird', 'android_ip_webcam', 'motioneye', 'frigate', 'imou', 'dahua', 'uvc', 'netatmo', 'blink', 'eufy_security', 'synology_dsm', 'xiaomi_miio', 'yi'];
const DOOR_GAP = 40; // Abstand zwischen den Seiten (px) – Schatten der Tasten ragen nicht in die Nachbarseite
const DOOR_CSS = `<style>
.dset{display:flex;gap:22px;align-items:stretch;--acc:#ff6b8b}
.drail{position:relative;flex:none;width:208px;display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:14px;background:linear-gradient(180deg,#141518,#1c1d21);box-shadow:inset 0 2px 8px #000,0 1px 0 rgba(255,255,255,.06)}
.dind{position:absolute;left:6px;right:6px;top:6px;height:72px;border-radius:10px;background:linear-gradient(180deg,#35373c,#25262a);box-shadow:0 3px 8px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);transition:top .38s cubic-bezier(.3,1.25,.5,1),height .38s}
.dind::after{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:2px;background:var(--tc,var(--acc));box-shadow:0 0 10px var(--tc,var(--acc))}
.dind.noanim{transition:none}
.dtab{position:relative;z-index:1;height:72px;border-radius:10px;display:flex;align-items:center;gap:12px;padding:0 14px;color:#9a9fa8;cursor:pointer;transition:color .3s}
.dtab svg{width:24px;height:24px;flex:none;transition:color .3s,filter .3s}
.dtab b{display:block;font-size:14px;letter-spacing:2px;font-weight:700;text-transform:uppercase;white-space:nowrap}
.dtab small{display:block;font-size:11px;letter-spacing:.6px;color:#8c919a;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:138px}
.dtab.on{color:#f0f1f3}.dtab.on svg{color:var(--tc);filter:drop-shadow(0 0 5px var(--tc))}
.dtab .dl{min-width:0}
.dview{position:relative;flex:1;min-width:0;height:410px;overflow:hidden;touch-action:none;border-radius:12px}
.dpages{position:absolute;inset:0;transition:transform .42s cubic-bezier(.3,1.1,.4,1)}
.dpages.drag{transition:none}
.dpage{position:absolute;left:0;right:0;height:410px;display:flex;gap:22px;padding:2px 4px}
.dcol{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.dcol+.dcol{padding-left:22px;border-left:1px solid rgba(0,0,0,.55);box-shadow:inset 1px 0 0 rgba(255,255,255,.05)}
.dhead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px}
.dhead .cap{font-size:10.5px}
.dhead .hk{height:22px;padding:0 10px;font-size:10px}
.dseg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.dseg .hk{height:30px;font-size:12px}
.dseg .hk.off.on i{background:#ff5a5a;box-shadow:0 0 10px #ff5a5a}
.dopts{display:grid;grid-template-columns:1fr 1fr;gap:8px;overflow-y:auto;padding:2px 2px 6px;margin:-2px;touch-action:pan-y;align-content:start}
.dopts .hk{height:30px;font-size:12px;letter-spacing:1.2px;min-width:0;padding:0 8px}
.dopts .hk span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dopts .hk.off.on i{background:#ff5a5a;box-shadow:0 0 10px #ff5a5a}
.dopts .hk.wide{grid-column:1/-1}
.dopts .dgr{grid-column:1/-1;font:700 9.5px Rajdhani,sans-serif;letter-spacing:2px;color:#8c919a;text-transform:uppercase;margin-top:4px}
.dopts .dhint,.dhint{grid-column:1/-1;font-size:11px;color:#8c919a;letter-spacing:.4px;line-height:1.35}
.dtones{grid-template-columns:1fr 1fr 1fr}
.dtones .hk{letter-spacing:.6px;font-size:11.5px}
.dlist{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;display:flex;flex-direction:column;gap:6px;padding:4px;margin:0 -2px;border-radius:10px;background:linear-gradient(180deg,#141518,#1a1b1f);box-shadow:inset 0 2px 6px #000,0 1px 0 rgba(255,255,255,.06)}
.dlist.dim .drow2{opacity:.5}
.drow2{display:flex;align-items:center;gap:10px;min-height:44px;padding:4px 6px 4px 10px;border-radius:8px;cursor:pointer;background:linear-gradient(180deg,#2a2c31,#202125);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.07)}
.drow2 .chk{width:18px;height:18px;flex:none;border-radius:5px;background:#141518;box-shadow:inset 0 1px 3px #000,0 1px 0 rgba(255,255,255,.08);display:grid;place-items:center}
.drow2.on .chk::after{content:"";width:10px;height:10px;border-radius:3px;background:var(--acc);box-shadow:0 0 8px var(--acc)}
.drow2 .dn{flex:1;min-width:0}
.drow2 .dn b{display:block;font-size:13.5px;color:#d7d9de;letter-spacing:.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.drow2 .dn small{display:block;font-size:10.5px;color:#979ca5;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.drow2 .dn small em{font-style:normal;color:#3ddc84}.drow2 .dn small em.off{color:#9a9fa8}
.drow2 .hk{height:28px;width:30px;padding:0;font-size:13px;letter-spacing:0;flex:none}
.dmini{display:flex;align-items:center;gap:6px}.dmini .hk{height:22px;width:26px;padding:0;font-size:15px;letter-spacing:0}.dmini .dlcd{height:22px;min-width:48px;font-size:13px;padding:0 6px}
.dempty{padding:14px;font-size:12px;color:#979ca5;line-height:1.4;text-align:center}
.drow{display:grid;grid-template-columns:1fr 64px;gap:10px;align-items:center}
.dcam{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}
.dcam .lcd{height:32px;display:flex;align-items:center;padding:0 12px;font-size:15px;color:#ffb347;border-radius:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dcam .lcd span{position:relative;z-index:1;overflow:hidden;text-overflow:ellipsis}
.dcam .hk{height:32px;padding:0 14px;font-size:11px}
.hsl{position:relative;height:30px;touch-action:none;cursor:pointer}
.hsl .segs{position:absolute;inset:0;display:flex;gap:2px;padding:5px 4px;border-radius:6px;background:linear-gradient(180deg,#141518,#1e1f23);box-shadow:inset 0 2px 6px #000,0 1px 0 rgba(255,255,255,.07)}
.hsl .segs i{flex:1;border-radius:1px;background:#26282c;transition:background .12s}
.hsl .segs i.on{background:var(--acc);box-shadow:0 0 6px var(--acc)}
.dlcd{height:30px;padding:0 8px;display:flex;align-items:center;justify-content:center;font-size:17px;color:#ffb347;border-radius:8px}
.dlcd small{font-size:10px;margin-left:2px;color:#a07a40}
.dstep{display:grid;grid-template-columns:44px 1fr 44px;gap:8px}
.dstep .hk{height:30px;font-size:18px;letter-spacing:0}
.rlcd{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:12px}
.rlcd .row{font-size:20px;color:#ffb347;position:relative;z-index:1}
.rlcd .row small{font:700 10px Rajdhani,sans-serif;letter-spacing:1.6px;color:#7d6a4e}
.rnote{font-size:12px;color:#979ca5;letter-spacing:.4px;line-height:1.45}
.dna{opacity:.45;pointer-events:none}
.dtl{display:flex;flex-direction:column;gap:2px;padding:5px 8px;border-radius:10px;background:linear-gradient(180deg,#141518,#1a1b1f);box-shadow:inset 0 2px 6px #000,0 1px 0 rgba(255,255,255,.06)}
.dtl .tr{display:grid;grid-template-columns:24px 1fr;gap:6px;align-items:center;height:11px}
.dtl .tr b{font:700 9.5px Rajdhani,sans-serif;letter-spacing:1px;color:#979ca5}.dtl .tr.today b{color:#e2e4e8}
.dtl .bar{position:relative;height:8px;border-radius:3px;background:#24262a;overflow:hidden}
.dtl .bar i{position:absolute;top:0;bottom:0;background:var(--acc);box-shadow:0 0 6px var(--acc);border-radius:2px;opacity:.85}
.dtl .bar u{position:absolute;top:-1px;bottom:-1px;width:2px;background:#fff;box-shadow:0 0 4px #fff}
.dtl .ax{display:grid;grid-template-columns:24px 1fr;gap:6px}.dtl .ax span{display:flex;justify-content:space-between;font:600 8.5px Rajdhani,sans-serif;color:#9a9fa8}
.drs{display:flex;align-items:center;gap:8px;font-size:12px;color:#9a9ea6;letter-spacing:.3px}
.drs svg{width:18px;height:18px;flex:none}
.ddots{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;z-index:2;pointer-events:none}
.ddots i{width:4px;height:4px;border-radius:2px;background:#3a3c41;transition:all .3s}.ddots i.on{height:14px;background:var(--acc);box-shadow:0 0 6px var(--acc)}
</style>`;
// Fenster (Kamera wählen / hinzufügen, Gerät umbenennen) – liegt in der Overlay-Ebene des Panels
const DOOR_POP_CSS = `<style>
.dpop .ppbox{width:720px;max-height:92%;display:flex;flex-direction:column;gap:12px;--acc:#ff6b8b}
.dpop .ppbox.sm{width:440px}
.dpop .dpb{display:flex;gap:20px;min-height:0;flex:1}
.dpop .dpc{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.dpop .dpc+.dpc{padding-left:20px;border-left:1px solid rgba(0,0,0,.55);box-shadow:inset 1px 0 0 rgba(255,255,255,.05)}
.dpop .cap{font-size:10.5px}
.dpop .dopts{display:grid;grid-template-columns:minmax(0,1fr);overflow-x:hidden;gap:8px;overflow-y:auto;max-height:300px;padding:2px 2px 6px;margin:-2px;align-content:start}
.dpop .dopts .hk{min-width:0;height:32px;font-size:12px;letter-spacing:1px;justify-content:flex-start;padding:0 12px}
.dpop .dopts .hk span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.dpop .dopts .hk em{font-style:normal;width:7px;height:7px;border-radius:4px;background:#3a3c41;flex:none}
.dpop .dopts .hk em.live{background:#3ddc84;box-shadow:0 0 6px #3ddc84}
.dpop .dopts .hk.off.on i{background:#ff5a5a;box-shadow:0 0 10px #ff5a5a}
.dpop .dgr{font:700 9.5px Rajdhani,sans-serif;letter-spacing:2px;color:#8c919a;text-transform:uppercase;margin-top:4px}
.dpop .dfound{display:flex;align-items:center;gap:10px;padding:6px 8px 6px 12px;border-radius:8px;background:linear-gradient(180deg,#2a2c31,#202125);box-shadow:0 2px 0 #0b0b0c}
.dpop .dfound span{flex:1;min-width:0;font-size:12.5px;color:#d7d9de;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dpop .dfound small{display:block;font-size:10px;color:#979ca5;letter-spacing:.6px;text-transform:uppercase}
.dpop .dfound .hk{height:26px;padding:0 10px;font-size:10px}
.dpop label{min-width:0;display:flex;flex-direction:column;gap:4px;font:700 9.5px Rajdhani,sans-serif;letter-spacing:1.8px;color:#9a9fa8;text-transform:uppercase}
.dpop input{box-sizing:border-box;width:100%;min-width:0;height:34px;border:0;outline:0;border-radius:8px;padding:0 10px;font:500 14px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.4px;color:#e2e4e8;background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.07);-webkit-user-select:text;user-select:text}
.dpop input:focus{box-shadow:inset 0 2px 5px #000,0 0 0 1px var(--acc)}
.dpop .dfrm{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 10px}
.dpop .dfrm .w{grid-column:1/-1}
.dpop .dmsg{font-size:12px;letter-spacing:.3px;line-height:1.4;color:#9a9fa8;min-height:17px}
.dpop .dmsg.err{color:#ff8a8a}.dpop .dmsg.ok{color:#3ddc84}
.dpop .dbtn{display:flex;justify-content:flex-end;gap:10px}
.dpop .dbtn .hk{height:36px;padding:0 18px}
.dpop .dhint{font-size:11px;color:#8c919a;letter-spacing:.4px;line-height:1.4}
.dpop .dsch{display:grid;grid-template-columns:96px 1fr 1fr 34px;gap:7px 10px;align-items:center}
.dpop .dsch b{font-size:13px;color:#c9ccd2;letter-spacing:.8px}
.dpop .dsch .rg{display:flex;align-items:center;gap:5px;min-width:0}.dpop .dsch .rg em{font-style:normal;color:#8c919a}
.dpop .dsch input{height:30px;padding:0 6px;font-size:13px;color-scheme:dark}
.dpop .dsch .hk{height:26px;padding:0}
</style>`;
class RPDoorSettings extends RPModule {
  get meta() { return this.variants().full; }
  variants() { return { full: { bw: 1000, mh: 410, fw: false, fh: false } }; }
  static getStubConfig() { return {}; }
  norm(c) {
    const doors = (Array.isArray(c.doors) && c.doors.length ? c.doors : NOTIFY_DOORS.map(d => L(d, { icon: d.roof === 'flat' ? 'flat' : 'door' }))).map(d => {
      const k = d.key || 'haustur';
      return L({ name: k, ziel: `input_text.klingel_${k}_ziel`, ton: `input_text.klingel_${k}_ton`, kamera: `input_text.klingel_${k}_kamera`, lautsprecher: `input_text.klingel_${k}_lautsprecher`, ls_vol: `input_number.klingel_${k}_lautsprecher_lautstarke`, lautstaerke: `input_number.klingel_${k}_lautstarke`, dauer: `input_number.klingel_${k}_dauer` }, d);
    });
    const ring = c.intercom === false ? null : L({ name: 'Ring Intercom', battery: 'sensor.vordereingang_batterie', wifi: 'sensor.vordereingang_wlan_signalstarke', last: 'sensor.vordereingang_letztes_klingeln', volume: 'number.vordereingang_turklingel_lautstarke', automation: 'automation.klingel_haustur_popup' }, c.intercom);
    return { doors, ring, raum: c.raum || null, room: c.room !== false, devices: c.devices || 'input_select.klingel_gerate', color: c.color || '#ff6b8b', tones: c.tones_path || '/local/klingeltoene/', custom_tones: c.custom_tones || 'media-source://media_source/local/klingeltoene', speaker_platform: c.speaker_platform || 'music_assistant', popup_script: c.popup_script || 'script.klingel_popup', scan_script: c.scan_script || 'script.klingel_geraete_suchen' };
  }
  get _tabs() { const t = this._c.doors.map((d, i) => ({ kind: 'door', i, name: d.name, ic: DOOR_ICON[d.icon] || DOOR_ICON.door })); if (this._c.room) t.unshift({ kind: 'room', name: 'Allgemein', ic: DOOR_ICON.room }); if (this._c.ring) t.push({ kind: 'ring', name: this._c.ring.name, ic: IC.bell }); return t; }
  watch(h) {
    const r = this._c.ring || {}, ids = [this._c.devices, ...this._c.doors.flatMap(d => [d.ziel, d.ton, d.kamera, d.lautstaerke, d.dauer, d.lautsprecher, d.ls_vol])];
    // Online-Status + Browser-Info der bekannten Geräte
    this._devs(h).forEach(b => { const p = this._slug(b); ids.push(`sensor.${p}_browser_path`, `sensor.${p}_browser_useragent`, `sensor.${p}_browser_user`); });
    ids.push(...Object.keys(h.states).filter(e => e.startsWith('camera.')), ...this._speakers(h));
    const area = this._area(h); if (area) ids.push(...Object.values(roomIds(area)));
    return [...ids, r.battery, r.wifi, r.last, r.volume, r.automation].filter(Boolean);
  }
  _area() { return raumOf(this, this._c); }
  html() {
    const c = this._c, tabs = this._tabs, sel = this._tab || 0;
    const door = (d, i) => `<div class="dcol">
        <div class="dhead"><div class="cap eng">Anzeigen auf</div><div class="hk sm" data-act="scan" title="Gerade verbundene Browser-Mod-Geräte in die Liste aufnehmen">⟳ Geräte suchen</div></div>
        <div class="dseg" id="dm${i}"></div>
        <div class="dlist" id="dz${i}"></div>
        <div class="dhead"><div class="cap eng">Ton auch auf Lautsprechern</div><div class="dmini" id="dlvw${i}"><div class="hk" data-act="lsv:${i}|-1">−</div><div class="lcd dlcd" id="dlv${i}">--</div><div class="hk" data-act="lsv:${i}|1">+</div></div></div>
        <div class="dlist" id="dl${i}"></div>
      </div>
      <div class="dcol">
        <div class="dhead"><div class="cap eng">Kamera im Popup</div></div>
        <div class="dcam"><div class="lcd" id="dc${i}"><span>--</span></div><div class="hk" data-act="camdlg:${i}">Ändern</div></div>
        <div class="dhead"><div class="cap eng">Klingelton</div><div style="display:flex;gap:8px"><div class="hk sm" data-act="play:${i}">▶ Anhören</div><div class="hk sm" data-act="test:${i}" style="--c:var(--acc)"><i></i>Testen</div></div></div>
        <div class="dopts dtones" id="dt${i}" style="flex:1;min-height:0"></div>
        <div class="dhead"><div class="cap eng">Lautstärke</div></div>
        <div class="drow"><div class="hsl" id="dv${i}"><div class="segs">${'<i></i>'.repeat(20)}</div></div><div class="lcd dlcd" id="dvl${i}">--</div></div>
        <div class="dhead"><div class="cap eng">Anzeigedauer Popup</div></div>
        <div class="dstep"><div class="hk" data-act="dur:${i}|-1">−</div><div class="lcd dlcd" id="dd${i}">--</div><div class="hk" data-act="dur:${i}|1">+</div></div>
      </div>`;
    const ring = () => `<div class="dcol">
        <div class="dhead"><div class="cap eng">Status</div></div>
        <div class="lcd rlcd" id="drl"></div>
        <div class="rnote">Gegensprechen und Video bietet Ring für die Intercom nicht über Home Assistant an – Sprechen geht nur in der Ring-App.</div>
      </div>
      <div class="dcol">
        <div class="dhead"><div class="cap eng">Klingel-Lautstärke Intercom</div></div>
        <div class="dstep" id="drv"><div class="hk" data-act="ivol:-1">−</div><div class="lcd dlcd" id="drvl">--</div><div class="hk" data-act="ivol:1">+</div></div>
        <div class="dhead"><div class="cap eng">Popup bei Klingeln (Haustür)</div></div>
        <div class="hk" id="dra" data-act="auto" style="--c:var(--acc);height:36px"><i></i>Aktiv</div>
      </div>`;
    const room = () => `<div class="dcol">
        <div class="dhead"><div class="cap eng">Dieses Tablet</div></div>
        <div class="lcd rlcd" id="drt" style="gap:6px;padding:10px 14px"></div>
        <div class="dhead"><div class="cap eng">Schnellschalter für diesen Raum</div></div>
        <div class="dseg" id="drsw" style="grid-template-columns:1fr 1fr"></div>
        <div class="dhead"><div class="cap eng">Zustand auf diesem Tablet</div></div>
        <div id="drst" style="display:flex;flex-direction:column;gap:7px"></div>
        <div class="rnote" style="margin-top:auto">„Popup aus“ lässt den Klingelton weiter klingeln. „Ton stumm“ zeigt das Popup weiter an. Beides aus = keine Klingel auf diesem Tablet.</div>
      </div>
      <div class="dcol">${[0, 1].map(w => `<div class="dhead"><div class="cap eng">${w ? 'Zeitplan Ton' : 'Zeitplan Anzeige'}<small style="margin-left:8px;letter-spacing:1px;color:#8a8f98">farbig = erlaubt</small></div><div class="hk sm" data-act="schedit:${w}">✎ Bearbeiten</div></div>
        <div class="dtl" id="dtl${w}"></div>
        <div class="dseg" style="grid-template-columns:repeat(3,1fr)" id="dpre${w}">${['Immer', 'Nachtruhe 22–7', 'Werktags 6–22'].map((p, k) => `<div class="hk sm" data-act="schpre:${w}|${k}">${p}</div>`).join('')}</div>`).join('')}
        <div class="dmsg" id="drmsg" style="font-size:11.5px;color:#9a9fa8;min-height:15px"></div>
      </div>`;
    return `${DOOR_CSS}<div class="dset" style="--acc:${c.color}">
      <div class="drail" id="drail"><i class="dind noanim" id="dind"></i>${tabs.map((t, n) => `<div class="dtab${n === sel ? ' on' : ''}" data-act="dtab:${n}" style="--tc:${c.color}">${t.ic}<div class="dl"><b>${escH(t.name)}</b><small id="dsub${n}">&nbsp;</small></div></div>`).join('')}</div>
      <div class="dview" id="dview"><div class="dpages" id="dpages">${tabs.map((t, n) => `<div class="dpage" style="top:calc(${n} * (100% + ${DOOR_GAP}px))">${t.kind === 'door' ? door(c.doors[t.i], t.i) : t.kind === 'room' ? room() : ring()}</div>`).join('')}</div>
        <div class="ddots" id="ddots">${tabs.map(() => '<i></i>').join('')}</div></div>
    </div>`;
  }
  _pos(n, dy = 0) { return `translateY(calc(${-n} * (100% + ${DOOR_GAP}px) + ${dy}px))`; }
  bind() {
    if (window.__rpDoorTab) { const k = this._tabs.findIndex(t => t.kind === window.__rpDoorTab); if (k >= 0) this._tab = k; window.__rpDoorTab = null; }
    this._showTab(this._tab || 0, true);
    this._c.doors.forEach((d, i) => {
      const el = this.$('dv' + i); if (!el) return;
      const frac = ev => { const r = el.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1); };
      el.addEventListener('pointerdown', ev => {
        ev.stopPropagation();
        if (!this._hass || !this._ok(this._st(d.lautstaerke))) return;
        el.setPointerCapture(ev.pointerId); ev.preventDefault();
        const mv = e2 => { this._drag = { kind: 'vol', i, f: frac(e2), active: true }; this._updDoor(); };
        const up = e2 => {
          ['pointermove', 'pointerup', 'pointercancel'].forEach((t, n) => el.removeEventListener(t, n ? up : mv));
          const v = Math.round(frac(e2) * 20) * 5;
          this._drag = { kind: 'vol', i, f: v / 100, active: false, until: Date.now() + 3000 };
          this._call('input_number', 'set_value', { entity_id: d.lautstaerke, value: v }); this._updDoor();
        };
        mv(ev); el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    });
    // Wischen hoch/runter wechselt die Seite (Listen, die selbst scrollen, und der Regler sind ausgenommen)
    const view = this.$('dview'), pages = this.$('dpages');
    view.addEventListener('pointerdown', ev => {
      const lst = ev.target.closest('.dopts,.dlist');
      if (lst && lst.scrollHeight > lst.clientHeight + 2) return;
      const y0 = ev.clientY, x0 = ev.clientX, k = view.getBoundingClientRect().height / view.offsetHeight || 1, n = this._tabs.length;
      let dy = 0, on = false;
      const mv = e2 => {
        dy = (e2.clientY - y0) / k;
        if (!on && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs((e2.clientX - x0) / k)) { on = true; pages.classList.add('drag'); }
        if (!on) return;
        const t = this._tab || 0, edge = (t === 0 && dy > 0) || (t === n - 1 && dy < 0);
        pages.style.transform = this._pos(t, edge ? dy / 3 : dy);
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        if (!on) return;
        pages.classList.remove('drag');
        this._swiped = Date.now();
        const t = this._tab || 0, nt = dy < -60 ? t + 1 : dy > 60 ? t - 1 : t;
        this._showTab(clamp(nt, 0, n - 1));
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  _showTab(n, noanim) {
    this._tab = n;
    const pages = this.$('dpages'); if (!pages) return;
    pages.style.transform = this._pos(n);
    this.shadowRoot.querySelectorAll('.dtab').forEach((t, k) => t.classList.toggle('on', k === n));
    this.shadowRoot.querySelectorAll('#ddots i').forEach((t, k) => t.classList.toggle('on', k === n));
    const ind = this.$('dind'), tab = this.shadowRoot.querySelectorAll('.dtab')[n];
    if (ind && tab) {
      if (noanim) ind.classList.add('noanim');
      ind.style.top = tab.offsetTop + 'px'; ind.style.height = tab.offsetHeight + 'px';
      if (noanim) requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.remove('noanim')));
    }
    if (this._tabs[n] && this._tabs[n].kind === 'door') this._loadCustom();
    if (this._tabs[n] && this._tabs[n].kind === 'room') this._loadSched();
  }
  update() { this._updDoor(); this._updPop(); }
  onHass() { this._loadCustom(); }
  onDisconnect() { if (this._au) this._au.pause(); this._popClose(); }

  // ---- Geräte (Browser Mod)
  _slug(b) { return String(b).replace(/[^a-z0-9]+/gi, '_').toLowerCase(); }
  _devOpts(h = this._hass) { const s = h && h.states[this._c.devices]; return ((s && s.attributes.options) || []).filter(o => o && o !== '–'); }
  _devs(h = this._hass) { return this._devOpts(h).map(o => o.split('@')[0]); }
  _devRaum(b) { const o = this._devOpts().find(x => x.split('@')[0] === b); return o && o.includes('@') ? o.split('@')[1] : ''; }
  _me() { try { return localStorage.getItem('browser_mod-browser-id'); } catch (e) { return null; } }
  _devId(b) { const e = this._hass.entities && this._hass.entities[`sensor.${this._slug(b)}_browser_path`]; return e ? e.device_id : null; }
  // Bezeichnung aus dem User-Agent (Browser · System · Modell) – wird je Gerät lokal gemerkt, damit sie auch offline sichtbar bleibt
  _uaLabel(ua) {
    if (!ua) return '';
    const app = /Home ?Assistant\//i.test(ua) ? 'HA-App' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Android/.test(ua) ? 'Android' : /iPad|iPhone|iOS/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    const m = /Android [\d.]+; ([^;)]+?)(?: Build|[;)])/.exec(ua), model = m && !/^(K|wv)$/.test(m[1].trim()) ? m[1].trim() : '';
    return [app, os, model].filter(Boolean).join(' · ');
  }
  _devInfo(b) {
    const p = this._slug(b), ok = s => this._ok(this._st(s)), path = `sensor.${p}_browser_path`;
    const dev = this._hass.devices && this._hass.devices[this._devId(b)], key = 'raum-panel:bm:' + b;
    let cache = {}; try { cache = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { /* ohne Speicher */ }
    const ua = ok(`sensor.${p}_browser_useragent`) ? this._st(`sensor.${p}_browser_useragent`).state : cache.ua, user = ok(`sensor.${p}_browser_user`) ? this._st(`sensor.${p}_browser_user`).state : cache.user;
    if (ok(path) && (ua !== cache.ua || user !== cache.user)) { try { localStorage.setItem(key, JSON.stringify({ ua, user })); } catch (e) { /* ohne Speicher */ } }
    const auto = this._uaLabel(ua);
    return { id: b, live: ok(path), named: !!(dev && dev.name_by_user), name: (dev && dev.name_by_user) || auto || 'Gerät ' + b.replace(/^browser_mod_/, '').slice(0, 8), auto, user, devId: dev ? dev.id : this._devId(b), here: b === this._me() };
  }
  _ziel(d) { const s = this._st(d.ziel), v = this._ok(s) ? s.state.trim() : 'alle'; if (v === '' || v === 'alle') return { mode: 'alle', ids: [] }; if (v === 'aus') return { mode: 'aus', ids: [] }; return { mode: 'sel', ids: v.split(',').map(x => x.trim()).filter(Boolean) }; }
  _setZiel(d, mode, ids) { this._call('input_text', 'set_value', { entity_id: d.ziel, value: mode === 'sel' ? (ids.length ? ids.join(',') : 'aus') : mode }); }

  // ---- Lautsprecher (Music Assistant: Snapcast-Clients u. a. – erscheinen automatisch, sobald sie sich anmelden)
  _speakers(h = this._hass) {
    const ents = (h && h.entities) || {}, plat = this._c.speaker_platform;
    return Object.values(ents).filter(e => e.platform === plat && e.entity_id.startsWith('media_player.') && !e.hidden).map(e => e.entity_id);
  }
  _lsSel(d) { const s = this._st(d.lautsprecher); return this._ok(s) ? s.state.split(',').map(x => x.trim()).filter(Boolean) : []; }
  _lsInfo(id) {
    const s = this._st(id), e = this._hass.entities[id] || {}, dev = this._hass.devices && this._hass.devices[e.device_id];
    const ST = { playing: 'spielt', paused: 'pausiert', idle: 'bereit', on: 'an', off: 'aus', buffering: 'lädt', unavailable: 'offline' };
    return { id, name: (s && s.attributes.friendly_name) || id, live: this._ok(s), state: s ? (ST[s.state] || s.state) : 'fehlt', model: dev ? [dev.manufacturer, dev.model].filter(Boolean).join(' ') : '' };
  }

  // ---- Kameras
  _autoCam(d) {
    const ents = (this._hass && this._hass.entities) || {}, dev = d.device_entity && ents[d.device_entity] && ents[d.device_entity].device_id;
    const cam = dev && Object.values(ents).find(e => e.device_id === dev && e.entity_id.startsWith('camera.'));
    return cam ? cam.entity_id : null;
  }
  _name(id) { const s = this._st(id); return (s && s.attributes.friendly_name) || id; }
  _camLabel(d) {
    const s = this._st(d.kamera), v = this._ok(s) ? s.state : 'auto';
    if (v === 'none') return 'Keine Kamera';
    if (v.startsWith('camera.')) return this._name(v) + (this._ok(this._st(v)) ? '' : ' (nicht erreichbar)');
    const a = this._autoCam(d); return a ? `Automatisch · ${this._name(a)}` : 'Automatisch · keine erkannt';
  }

  // ---- eigene Klingeltöne aus dem Medienordner (media_source) – höchstens alle 30 s neu einlesen
  async _loadCustom() {
    if (!this._hass || !this._hass.callWS || (this._ctAt && Date.now() - this._ctAt < 30000)) return;
    this._ctAt = Date.now();
    try {
      const r = await this._hass.callWS({ type: 'media_source/browse_media', media_content_id: this._c.custom_tones });
      this._ct = (r.children || []).filter(ch => ch.can_play && (ch.media_class === 'music' || /^audio/.test(ch.media_content_type || ''))).map(ch => ({ id: ch.media_content_id, title: ch.title.replace(/\.[a-z0-9]+$/i, '') }));
    } catch (e) { this._ct = []; }
    this._updDoor();
  }
  _toneLabel(v) {
    if (!v || v === 'Kein Ton') return 'Kein Ton';
    if (v.startsWith('media-source://')) { const t = (this._ct || []).find(x => x.id === v); return t ? t.title : decodeURIComponent(v.split('/').pop()).replace(/\.[a-z0-9]+$/i, ''); }
    return v;
  }
  _vol(d, i) {
    if (this._dragActive('vol') && this._drag.i === i) return this._drag.f;
    const s = this._st(d.lautstaerke); return this._ok(s) ? Number(s.state) / 100 : null;
  }
  _updDoor() {
    if (!this._built || !this._hass) return;
    const key = (act, val, on, label, cls = '') => `<div class="hk sm${on ? ' on' : ''}${cls}" data-act="${act}:${escH(val)}" title="${escH(label)}" style="--c:var(--acc)"><i></i><span>${escH(label)}</span></div>`;
    const devs = this._devs().map(b => this._devInfo(b)), admin = !!(this._hass.user && this._hass.user.is_admin);
    this._c.doors.forEach((d, i) => {
      const z = this._ziel(d), t = this._st(d.ton), okz = this._ok(this._st(d.ziel));
      // Anzeigen auf: Modus + Geräteliste (Mehrfachauswahl)
      this._html(this.$('dm' + i), okz ? [key('zmode', `${i}|alle`, z.mode === 'alle', 'Alle Geräte'), key('zmode', `${i}|sel`, z.mode === 'sel', 'Auswahl'), key('zmode', `${i}|aus`, z.mode === 'aus', 'Aus', ' off')].join('') : '<em class="aem">Helfer fehlt</em>');
      const lst = this.$('dz' + i);
      if (lst) lst.classList.toggle('dim', z.mode !== 'sel');
      this._html(lst, devs.length ? devs.map(v => `<div class="drow2${z.mode === 'sel' && z.ids.includes(v.id) ? ' on' : ''}" data-act="ztog:${i}|${escH(v.id)}">
          <span class="chk"></span><div class="dn"><b>${escH(v.name)}${v.here ? ' · dieses Gerät' : ''}</b><small><em class="${v.live ? '' : 'off'}">${v.live ? '● online' : '○ offline'}</em> · ${escH([this._devRaum(v.id) ? 'Raum ' + this._devRaum(v.id).toUpperCase() : 'ohne Raum', v.named && v.auto, v.user, v.id.replace(/^browser_mod_/, '')].filter(Boolean).join(' · '))}</small></div>
          ${admin && v.devId ? `<div class="hk" data-act="rename:${escH(v.id)}" title="Umbenennen">✎</div>` : ''}<div class="hk" data-act="devdel:${escH(v.id)}" title="Aus der Liste entfernen">✕</div></div>`).join('')
        : '<div class="dempty">Noch keine Geräte in der Liste.<br>Tablets einschalten und „⟳ Geräte suchen“ drücken.</div>');
      const lsel = this._lsSel(d), spk = this._speakers().map(id => this._lsInfo(id)).sort((x, y) => x.name.localeCompare(y.name));
      spk.push(...lsel.filter(id => !spk.some(x => x.id === id)).map(id => this._lsInfo(id))); // gewählte, aber (noch) unbekannte
      this._html(this.$('dl' + i), spk.length ? spk.map(v => `<div class="drow2${lsel.includes(v.id) ? ' on' : ''}" data-act="ltog:${i}|${escH(v.id)}">
          <span class="chk"></span><div class="dn"><b>${escH(v.name)}</b><small><em class="${v.live ? '' : 'off'}">${v.live ? '●' : '○'} ${escH(v.state)}</em>${v.model ? ' · ' + escH(v.model) : ''}</small></div></div>`).join('')
        : '<div class="dempty">Keine Lautsprecher gefunden.<br>Music Assistant in Home Assistant verbinden – Snapcast-Clients erscheinen dann automatisch.</div>');
      const lv = this._st(d.ls_vol);
      this._html(this.$('dlv' + i), this._ok(lv) ? `${Math.round(Number(lv.state))}<small>%</small>` : '--');
      this.$('dlvw' + i).classList.toggle('dna', !this._ok(lv));
      this._html(this.$('dc' + i), `<span>${escH(this._camLabel(d))}</span>`);
      // Klingeltöne: eingebaut + eigene (Medienordner)
      const tv = this._ok(t) ? t.state : '', ct = this._ct || [];
      this._html(this.$('dt' + i), this._ok(t) ? [
        ...DOOR_TONES.map(n => key('tsel', `${i}|${n}`, tv === n, n)),
        key('tsel', `${i}|Kein Ton`, tv === 'Kein Ton' || tv === '', 'Kein Ton', ' off'),
        '<div class="dgr">Eigene Klingeltöne</div>',
        ...ct.map(x => key('tsel', `${i}|${x.id}`, tv === x.id, x.title)),
        ct.length ? '' : '<div class="dhint">MP3/WAV in den Medienordner <b>klingeltoene</b> legen (Samba-Freigabe „media“) – erscheinen hier automatisch.</div>',
      ].join('') : '<em class="aem">Helfer fehlt</em>');
      const v = this._vol(d, i), vel = this.$('dv' + i);
      if (vel) { vel.classList.toggle('dna', v === null); vel.querySelectorAll('i').forEach((seg, k) => seg.classList.toggle('on', v !== null && k < Math.round(v * 20))); }
      this._html(this.$('dvl' + i), v === null ? '--' : `${Math.round(v * 100)}<small>%</small>`);
      const du = this._st(d.dauer);
      this._html(this.$('dd' + i), this._ok(du) ? `${Math.round(Number(du.state))}<small>s</small>` : '--');
      // Untertitel im Reiter: Ziel · Ton
      const zl = z.mode === 'alle' ? 'Alle Geräte' : z.mode === 'aus' ? 'Aus' : `${z.ids.length} Gerät${z.ids.length === 1 ? '' : 'e'}`;
      const nls = this._lsSel(d).length;
      this._html(this.$('dsub' + this._tabs.findIndex(t => t.kind === 'door' && t.i === i)), escH(okz ? `${zl}${nls ? ` + ${nls} LS` : ''} · ${this._toneLabel(tv)}` : '–'));
    });
    // Reiter-Markierung nachziehen, falls beim Aufbau noch nicht vermessen
    const ind = this.$('dind'); if (ind && !parseFloat(ind.style.height)) this._showTab(this._tab || 0, true);
    this._updRoom();
    const r = this._c.ring; if (!r) return;
    const st = id => this._st(id), val = (id, u = '') => { const s = st(id); return this._ok(s) ? `${s.state}${u}` : '--'; };
    const last = st(r.last), lt = this._ok(last) ? new Date(last.state) : null;
    const fmt = lt && !isNaN(lt) ? `${String(lt.getDate()).padStart(2, '0')}.${String(lt.getMonth() + 1).padStart(2, '0')}. ${String(lt.getHours()).padStart(2, '0')}:${String(lt.getMinutes()).padStart(2, '0')}` : '--';
    this._html(this.$('drl'), `<div class="row"><small>BATTERIE</small> ${val(r.battery, ' %')}</div><div class="row"><small>WLAN</small> ${val(r.wifi, ' dBm')}</div><div class="row"><small>LETZTES KLINGELN</small> ${fmt}</div>`);
    const vs = st(r.volume);
    this.$('drv').classList.toggle('dna', !this._ok(vs));
    this._html(this.$('drvl'), this._ok(vs) ? String(Math.round(Number(vs.state))) : '--');
    const a = st(r.automation), ak = this.$('dra');
    ak.classList.toggle('on', this._ok(a) && a.state === 'on'); ak.classList.toggle('dna', !this._ok(a));
    this._html(ak, `<i></i>${this._ok(a) && a.state === 'on' ? 'Aktiv' : 'Aus'}`);
    const n = this._tabs.length - 1;
    this._html(this.$('dsub' + n), escH(`Batterie ${val(r.battery, ' %')}`));
  }
  // ---- Reiter "Dieser Raum": Tablet ↔ Bereich, Schnellschalter, Zeitpläne
  _roomTab() { return this._tabs.findIndex(t => t.kind === 'room'); }
  async _loadSched(force) {
    if (!this._hass || !this._hass.callWS || (!force && this._schAt && Date.now() - this._schAt < 20000)) return;
    this._schAt = Date.now();
    try { const l = await this._hass.callWS({ type: 'schedule/list' }); this._sch = {}; (l || []).forEach(x => { this._sch[x.id] = x; }); } catch (e) { this._sch = this._sch || {}; }
    this._updRoom();
  }
  _schOf(w) { const a = this._area(); return a && this._sch ? this._sch[(w ? 'benachrichtigung_ton_' : 'benachrichtigung_') + a] : null; }
  _updRoom() {
    const ti = this._roomTab(); if (ti < 0 || !this.$('drt')) return;
    const h = this._hass, me = bmMe(), area = this._area(), admin = !!(h.user && h.user.is_admin);
    const di = me ? this._devInfo(me) : null, an = area ? (RAUM_NAMES[area] || area.toUpperCase()) : null;
    this._html(this.$('drt'), '<div class="row" style="font-size:15px"><small>GERÄT</small> ' + escH(di ? di.name : 'kein Browser-Mod-Gerät') + '</div><div class="row" style="font-size:15px"><small>RAUM</small> ' + escH(area ? area.toUpperCase() + ' · ' + an : 'kein Raum-Kürzel (raum: im Dashboard)') + '</div>');
    const rr = roomRules(h, area);
    if (!area) { this._html(this.$('drsw'), '<div class="dhint" style="grid-column:1/-1">Im Dashboard fehlt das Raum-Kürzel (Option raum: bu).</div>'); }
    else if (rr.missing) this._html(this.$('drsw'), admin ? '<div class="hk" data-act="mkroom" style="grid-column:1/-1;height:32px;--c:#3ddc84"><i></i>Helfer für diesen Raum anlegen</div>' : '<div class="dhint" style="grid-column:1/-1">Für diesen Raum gibt es noch keine Helfer.</div>');
    else {
      const on = id => (h.states[id] || {}).state === 'on';
      this._html(this.$('drsw'), '<div class="hk sm' + (on(rr.ids.aus) ? ' on off' : '') + '" data-act="rtog:aus" style="height:32px;--c:#ff5a5a"><i></i>Popup aus</div><div class="hk sm' + (on(rr.ids.stumm) ? ' on off' : '') + '" data-act="rtog:stumm" style="height:32px;--c:#ff5a5a"><i></i>Ton stumm</div>');
    }
    // Zustand je Tür (wie in der Statusleiste)
    this._html(this.$('drst'), this._c.doors.map(d => {
      const s = doorStatus(h, d, area, me), on = s.shown || s.sound, col = on ? '#3ddc84' : '#8c919a';
      return '<div class="drs"><span style="color:' + col + '">' + notifySvg(d.roof === 'flat' || d.icon === 'flat' ? 'flat' : 'gable') + '</span><span><b style="color:#d7d9de">' + escH(d.name) + '</b> · ' + escH(!on ? 'kein Popup, kein Ton' : !s.sound ? 'Popup, kein Ton (' + s.swhy + ')' : !s.shown ? 'nur Ton, kein Popup (' + s.why + ')' : 'Popup + Ton') + '</span></div>';
    }).join(''));
    // Zeitachsen Mo–So
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], DN = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];
    const now = new Date(), today = (now.getDay() + 6) % 7, nowF = (now.getHours() * 60 + now.getMinutes()) / 1440;
    const tmin = t => { const [hh, mm] = String(t).split(':').map(Number); return (hh * 60 + (mm || 0)) / 1440; };
    [0, 1].forEach(w => {
      const sc = this._schOf(w), el = this.$('dtl' + w); if (!el) return;
      this._html(el, !area ? '<div class="dhint">Kein Raum gewählt.</div>' : !sc ? '<div class="dhint">' + (this._sch ? 'Zeitplan nicht gefunden.' : 'Lade …') + '</div>'
        : DAYS.map((d, k) => '<div class="tr' + (k === today ? ' today' : '') + '"><b>' + DN[k] + '</b><div class="bar">' + (sc[d] || []).map(r => { const a = tmin(r.from), b = tmin(r.to) || 1; return '<i style="left:' + (a * 100).toFixed(2) + '%;width:' + ((b - a) * 100).toFixed(2) + '%"></i>'; }).join('') + (k === today ? '<u style="left:' + (nowF * 100).toFixed(2) + '%"></u>' : '') + '</div></div>').join('')
          + '<div class="ax"><span></span><span><em>0</em><em>6</em><em>12</em><em>18</em><em>24</em></span></div>');
      const pre = this.$('dpre' + w); if (pre) pre.classList.toggle('dna', !sc || !admin);
    });
    this._html(this.$('dsub' + ti), escH(!area ? 'kein Raum' : area.toUpperCase() + ' · ' + (!rr.popup && !rr.sound ? 'aus' : !rr.popup ? 'nur Ton' : !rr.sound ? 'stumm' : 'aktiv')));
    if (!this._sch) this._loadSched();
  }
  async _schSave(w, days) {
    const sc = this._schOf(w); if (!sc) return;
    const msg = this.$('drmsg');
    try {
      const data = { type: 'schedule/update', schedule_id: sc.id, name: sc.name, icon: sc.icon || undefined };
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach((d, k) => { data[d] = days[k].map(r => ({ from: r.from.length === 5 ? r.from + ':00' : r.from, to: r.to.length === 5 ? r.to + ':00' : r.to })); });
      await this._hass.callWS(data);
      if (msg) { msg.textContent = 'Zeitplan gespeichert.'; msg.style.color = '#3ddc84'; }
      await this._loadSched(true); return true;
    } catch (e) { if (msg) { msg.textContent = 'Fehler: ' + ((e && e.message) || e); msg.style.color = '#ff8a8a'; } return false; }
  }
  _schPreset(w, k) {
    const all = (r) => Array.from({ length: 7 }, (_, i) => r(i));
    const P = [all(() => [{ from: '00:00', to: '24:00' }]), all(() => [{ from: '07:00', to: '22:00' }]), all(i => [i < 5 ? { from: '06:00', to: '22:00' } : { from: '08:00', to: '22:00' }])];
    this._schSave(w, P[k]);
  }
  async _mkRoom() {
    const area = this._area(), nm = String(area || '').toUpperCase(), msg = this.$('drmsg');
    const full = {}; ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(d => { full[d] = [{ from: '00:00:00', to: '24:00:00' }]; });
    try {
      await this._hass.callWS(L({ type: 'schedule/create', name: 'Benachrichtigung ' + nm, icon: 'mdi:bell-cog' }, full));
      await this._hass.callWS(L({ type: 'schedule/create', name: 'Benachrichtigung Ton ' + nm, icon: 'mdi:volume-source' }, full));
      await this._hass.callWS({ type: 'input_boolean/create', name: 'Benachrichtigung aus ' + nm, icon: 'mdi:bell-off' });
      await this._hass.callWS({ type: 'input_boolean/create', name: 'Benachrichtigung stumm ' + nm, icon: 'mdi:volume-off' });
      if (msg) { msg.textContent = 'Helfer für ' + nm + ' angelegt.'; msg.style.color = '#3ddc84'; }
      this._loadSched(true);
    } catch (e) { if (msg) { msg.textContent = 'Fehler: ' + ((e && e.message) || e); msg.style.color = '#ff8a8a'; } }
  }
  // Zeitplan-Editor (Fenster): je Tag bis zu zwei Zeiträume
  _schEdit(w) {
    const sc = this._schOf(w); if (!sc) return;
    this._popOpen('sched', w);
  }
  async _preview(i, ton) {
    const d = this._c.doors[i], v = this._vol(d, i);
    if (this._au) { this._au.pause(); this._au = null; }
    if (!ton || ton === 'Kein Ton' || NA.includes(ton)) return;
    try {
      const u = ton.startsWith('media-source://') ? (await this._hass.callWS({ type: 'media_source/resolve_media', media_content_id: ton })).url : this._c.tones + encodeURIComponent(ton) + '.wav';
      const a = new Audio(u); a.volume = clamp(v ?? .8, 0, 1); this._au = a; await a.play();
    } catch (e) { console.warn('raum-panel Klingelton', e); }
  }

  // ---- Fenster (Overlay des Panels): Kamera wählen/hinzufügen, Gerät umbenennen
  _popOpen(kind, arg) {
    const o = this._overlay();
    let p = o.querySelector('#dpop');
    if (!p) {
      o.insertAdjacentHTML('beforeend', `${DOOR_POP_CSS}<div class="ppop dpop" id="dpop" hidden><div class="plate card ppbox" id="dpbox"></div></div>`);
      p = o.querySelector('#dpop');
      p.addEventListener('pointerdown', e => { if (e.target === p) this._popClose(); });
    }
    this._pop = { kind, arg, msg: '', err: false, busy: false };
    const box = p.querySelector('#dpbox'), c = this._c;
    box.classList.toggle('sm', kind === 'rename');
    box.style.width = kind === 'sched' ? '640px' : '';
    box.style.setProperty('--acc', c.color);
    if (kind === 'cam') {
      const d = c.doors[arg], admin = !!(this._hass.user && this._hass.user.is_admin);
      box.innerHTML = `<div class="head"><span class="led" style="--lc:${c.color}"></span><div class="t"><h2 class="eng">Kamera – ${escH(d.name)}</h2><p>Welches Bild im Klingel-Popup erscheint</p></div></div>
        <div class="dpb"><div class="dpc"><div class="cap eng">Auswahl</div><div class="dopts" id="dpcams"></div></div>
        <div class="dpc"><div class="cap eng">Im Netzwerk gefunden</div><div id="dpfound" style="display:flex;flex-direction:column;gap:6px"><div class="dhint">Suche …</div></div>
        ${admin ? `<div class="cap eng" style="margin-top:6px">IP-Kamera hinzufügen</div>
          <div class="dfrm"><label class="w">Name<input id="dfn" placeholder="z. B. Haustür Kamera"></label>
          <label class="w">Stream-URL (RTSP)<input id="dfs" placeholder="rtsp://192.168.1.50:554/stream1"></label>
          <label class="w">Standbild-URL (optional)<input id="dfi" placeholder="http://192.168.1.50/snapshot.jpg"></label>
          <label>Benutzer<input id="dfu" autocomplete="off"></label><label>Passwort<input id="dfp" type="password" autocomplete="new-password"></label></div>
          <div class="dmsg" id="dpmsg"></div>` : '<div class="dhint">Kameras hinzufügen geht nur mit einem Administrator-Konto.</div>'}
        </div></div>
        <div class="dbtn">${admin ? '<div class="hk" data-act="camadd" style="--c:#3ddc84"><i></i>Hinzufügen</div>' : ''}<div class="hk" data-act="popclose">Schließen</div></div>`;
      this._loadFound();
    } else if (kind === 'sched') {
      const sc = this._schOf(arg), DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], DN = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
      const hm = t => t ? String(t).slice(0, 5) : '';
      box.innerHTML = '<div class="head"><span class="led" style="--lc:' + c.color + '"></span><div class="t"><h2 class="eng">' + (arg ? 'Zeitplan Ton' : 'Zeitplan Anzeige') + '</h2><p>' + escH(sc ? sc.name : '') + ' · Zeiten, in denen es erlaubt ist (leer = ganzer Tag aus)</p></div></div>'
        + '<div class="dsch">' + DAYS.map((d, k) => { const r = (sc && sc[d]) || []; return '<b>' + DN[k] + '</b>' + [0, 1].map(j => '<span class="rg"><input type="time" id="dsf' + k + '_' + j + '" value="' + hm(r[j] && r[j].from) + '"><em>–</em><input type="time" id="dst' + k + '_' + j + '" value="' + (r[j] && hm(r[j].to) === '24:00' ? '' : hm(r[j] && r[j].to)) + '" placeholder="24:00"' + (r[j] && hm(r[j].to) === '24:00' ? ' data-end="1"' : '') + '></span>').join('') + '<div class="hk sm" data-act="schclr:' + k + '" title="Tag leeren">✕</div>'; }).join('') + '</div>'
        + '<div class="dhint">Bis-Zeit leer lassen = bis Mitternacht (24:00). Zweiter Zeitraum optional.</div><div class="dmsg" id="dpmsg"></div>'
        + '<div class="dbtn"><div class="hk" data-act="schcopy">Montag auf alle Tage</div><div class="hk" data-act="popclose">Abbrechen</div><div class="hk" data-act="schsave" style="--c:#3ddc84"><i></i>Speichern</div></div>';
    } else if (kind === 'rename') {
      const v = this._devInfo(arg);
      box.innerHTML = `<div class="head"><span class="led" style="--lc:${c.color}"></span><div class="t"><h2 class="eng">Gerät benennen</h2><p>${escH(v.auto || v.id)}</p></div></div>
        <div class="dfrm"><label class="w">Name (z. B. Tablet Büro)<input id="drn" value="${escH(v.named ? v.name : '')}" placeholder="${escH(v.auto || 'Name')}"></label></div>
        <div class="dmsg" id="dpmsg"></div>
        <div class="dbtn"><div class="hk" data-act="popclose">Abbrechen</div><div class="hk" data-act="rensave" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
      setTimeout(() => { const inp = box.querySelector('#drn'); if (inp) inp.focus(); }, 50);
    }
    // Klicks im Fenster laufen über _click → act()
    if (!p._clk) { p._clk = true; }
    p.hidden = false; this._updPop();
  }
  _popClose() { const p = this._ovl && this._ovl.querySelector('#dpop'); if (p) p.hidden = true; this._pop = null; }
  _popMsg(msg, err = false, ok = false) { this._pop && Object.assign(this._pop, { msg, err }); const m = this._ovl && this._ovl.querySelector('#dpmsg'); if (m) { m.textContent = msg; m.className = 'dmsg' + (err ? ' err' : ok ? ' ok' : ''); } }
  _updPop() {
    const P = this._pop; if (!P || P.kind !== 'cam' || !this._ovl) return;
    const d = this._c.doors[P.arg], s = this._st(d.kamera), cv = this._ok(s) ? s.state : 'auto', auto = this._autoCam(d);
    const cams = Object.keys(this._hass.states).filter(e => e.startsWith('camera.')).sort((a, b) => this._name(a).localeCompare(this._name(b)));
    const key = (val, on, label, extra = '', cls = '') => `<div class="hk sm${on ? ' on' : ''}${cls}" data-act="csel:${P.arg}|${escH(val)}" style="--c:var(--acc)"><i></i><span>${escH(label)}</span>${extra}</div>`;
    this._html(this._ovl.querySelector('#dpcams'), [
      key('auto', cv === 'auto' || cv === '', auto ? `Automatisch · ${this._name(auto)}` : 'Automatisch (Integration) · keine erkannt'),
      key('none', cv === 'none', 'Keine Kamera', '', ' off'),
      cams.length ? '<div class="dgr">Kameras in Home Assistant</div>' : '<div class="dhint">Noch keine Kameras in Home Assistant.</div>',
      ...cams.map(e => key(e, cv === e, this._name(e), `<em class="${this._ok(this._st(e)) ? 'live' : ''}"></em>`)),
    ].join(''));
  }
  // laufende Netzwerk-Funde (Discovery) von Kamera-Integrationen
  async _loadFound() {
    const el = () => this._ovl && this._ovl.querySelector('#dpfound');
    let list = [];
    try { list = (await this._hass.callWS({ type: 'config_entries/flow/progress' })) || []; } catch (e) { /* keine Rechte */ }
    const found = list.filter(f => DOOR_CAM_DOMAINS.includes(f.handler) && !['user', 'reconfigure'].includes(f.context && f.context.source));
    const tp = f => { const t = (f.context && f.context.title_placeholders) || {}; return t.name || t.host || t.model || f.handler; };
    const box = el(); if (!box) return;
    box.innerHTML = (found.length ? found.map(f => `<div class="dfound"><span>${escH(tp(f))}<small>${escH(f.handler)}</small></span><div class="hk" data-act="setup:${escH(f.handler)}">Einrichten</div></div>`).join('')
      : '<div class="dhint">Keine neuen Kameras im Netzwerk erkannt. Viele Marken (ONVIF, Reolink, Axis, Hikvision …) meldet Home Assistant hier automatisch, sobald sie im Netz sind.</div>')
      + '<div class="dhint">Eigene Marke einrichten: <span class="hk sm" data-act="setup:" style="display:inline-flex;height:22px;padding:0 10px;font-size:10px;vertical-align:middle">Integrationen öffnen</span></div>';
  }
  _nav(path) {
    const panel = this._panel(); if (panel && panel.closeSettings) panel.closeSettings();
    this._popClose();
    history.pushState(null, '', path); window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }
  // IP-Kamera über die Integration "Generic Camera" anlegen, umbenennen und für die Tür auswählen
  async _camAdd() {
    const P = this._pop; if (!P || P.busy) return;
    const q = id => (this._ovl.querySelector('#' + id) || {}).value || '', d = this._c.doors[P.arg];
    const name = q('dfn').trim(), stream = q('dfs').trim(), still = q('dfi').trim(), user = q('dfu').trim(), pass = q('dfp');
    if (!stream && !still) { this._popMsg('Bitte eine Stream-URL (rtsp://…) oder Standbild-URL eintragen.', true); return; }
    P.busy = true; this._popMsg('Verbinde mit der Kamera … (kann einige Sekunden dauern)');
    const before = new Set(Object.keys(this._hass.states).filter(e => e.startsWith('camera.')));
    const ERR = { unable_still_load: 'Standbild konnte nicht geladen werden', stream_no_route_to_host: 'Kamera nicht erreichbar (Adresse prüfen)', stream_unauthorised: 'Benutzer oder Passwort falsch', stream_io_error: 'Stream konnte nicht geöffnet werden', stream_file_not_found: 'Stream-Pfad nicht gefunden', invalid_still_image: 'Standbild-URL liefert kein Bild', no_still_image_or_stream_url: 'Stream- oder Standbild-URL fehlt', malformed_url: 'URL ungültig', relative_url: 'URL muss vollständig sein (rtsp:// bzw. http://)', template_error: 'Fehler in der URL', timeout: 'Zeitüberschreitung', stream_not_permitted: 'Stream-Zugriff abgelehnt' };
    try {
      let r = await this._hass.callApi('POST', 'config/config_entries/flow', { handler: 'generic', show_advanced_options: false });
      const data = { advanced: { framerate: 2, verify_ssl: false, rtsp_transport: 'tcp', authentication: 'basic' } };
      if (stream) data.stream_source = stream; if (still) data.still_image_url = still; if (user) data.username = user; if (pass) data.password = pass;
      r = await this._hass.callApi('POST', `config/config_entries/flow/${r.flow_id}`, data);
      if (r.type === 'form' && r.step_id === 'user_confirm') r = await this._hass.callApi('POST', `config/config_entries/flow/${r.flow_id}`, { confirmed_ok: true });
      if (r.type === 'form') { const e = Object.values(r.errors || {})[0] || r.step_id; throw new Error(ERR[e] || e); }
      if (r.type === 'abort') throw new Error(r.reason === 'already_configured' ? 'Diese Kamera ist schon eingerichtet' : r.reason);
      const entry = r.result || {};
      if (name && entry.entry_id) { try { await this._hass.callWS({ type: 'config_entries/update', entry_id: entry.entry_id, title: name }); } catch (e) { /* Titel optional */ } }
      // neue Kamera-Entität abwarten (max. 15 s), benennen und auswählen
      let cam = null;
      for (let k = 0; k < 30 && !cam; k++) { await new Promise(res => setTimeout(res, 500)); cam = Object.keys(this._hass.states).find(e => e.startsWith('camera.') && !before.has(e)); }
      if (cam) {
        if (name) { try { await this._hass.callWS({ type: 'config/entity_registry/update', entity_id: cam, name }); } catch (e) { /* Name optional */ } }
        this._call('input_text', 'set_value', { entity_id: d.kamera, value: cam });
        this._popMsg(`Kamera angelegt und ausgewählt: ${name || cam}`, false, true);
      } else this._popMsg('Kamera angelegt – erscheint gleich in der Liste.', false, true);
      ['dfn', 'dfs', 'dfi', 'dfu', 'dfp'].forEach(id => { const inp = this._ovl.querySelector('#' + id); if (inp) inp.value = ''; });
    } catch (e) { this._popMsg('Fehler: ' + ((e && (e.message || e.body && e.body.message)) || e), true); }
    P.busy = false; this._updPop();
  }
  async _renSave() {
    const P = this._pop; if (!P) return;
    const v = this._devInfo(P.arg), inp = this._ovl.querySelector('#drn'), name = inp ? inp.value.trim() : '';
    if (!v.devId) { this._popMsg('Gerät nicht in der Registry gefunden.', true); return; }
    try { await this._hass.callWS({ type: 'config/device_registry/update', device_id: v.devId, name_by_user: name || null }); this._popClose(); this._updDoor(); }
    catch (e) { this._popMsg('Fehler: ' + ((e && e.message) || e), true); }
  }

  act(cmd, arg) {
    if (this._swiped && Date.now() - this._swiped < 300) return; // Klick nach dem Wischen ignorieren
    if (cmd === 'dtab') { this._showTab(Number(arg)); return; }
    const [a, b] = String(arg || '').split(/\|(.*)/s), d = this._c.doors[Number(a)];
    if (cmd === 'zmode' && d) {
      const z = this._ziel(d);
      if (b !== 'sel') this._setZiel(d, b);
      else if (z.mode !== 'sel') { const devs = this._devs(), me = this._me(); this._setZiel(d, 'sel', devs.includes(me) ? [me] : devs.slice(0, 1)); }
    } else if (cmd === 'ztog' && d) {
      const z = this._ziel(d), ids = z.mode === 'sel' ? z.ids.slice() : [];
      const k = ids.indexOf(b); if (k >= 0) ids.splice(k, 1); else ids.push(b);
      this._setZiel(d, 'sel', ids);
    } else if (cmd === 'ltog' && d) {
      const ids = this._lsSel(d), k = ids.indexOf(b); if (k >= 0) ids.splice(k, 1); else ids.push(b);
      this._call('input_text', 'set_value', { entity_id: d.lautsprecher, value: ids.join(',') });
    } else if (cmd === 'lsv' && d) {
      const s = this._st(d.ls_vol); if (!this._ok(s)) return;
      const at = s.attributes, step = Number(at.step) || 5;
      this._call('input_number', 'set_value', { entity_id: d.ls_vol, value: clamp(Number(s.state) + Number(b) * step, Number(at.min ?? 0), Number(at.max ?? 100)) });
    } else if (cmd === 'rename') this._popOpen('rename', arg);
    else if (cmd === 'devdel') {
      const opts = ['–', ...this._devOpts().filter(o => o.split('@')[0] !== arg)];
      this._call('input_select', 'set_options', { entity_id: this._c.devices, options: opts });
      this._c.doors.forEach(dd => { const z = this._ziel(dd); if (z.mode === 'sel' && z.ids.includes(arg)) this._setZiel(dd, 'sel', z.ids.filter(x => x !== arg)); });
    } else if (cmd === 'camdlg' && d) this._popOpen('cam', Number(a));
    else if (cmd === 'csel' && d) this._call('input_text', 'set_value', { entity_id: d.kamera, value: b });
    else if (cmd === 'camadd') this._camAdd();
    else if (cmd === 'rensave') this._renSave();
    else if (cmd === 'popclose') this._popClose();
    else if (cmd === 'rtog') { const ids = roomIds(this._area()); this._call('input_boolean', 'toggle', { entity_id: arg === 'stumm' ? ids.stumm : ids.aus }); }
    else if (cmd === 'mkroom') this._mkRoom();
    else if (cmd === 'schedit') this._schEdit(Number(arg));
    else if (cmd === 'schpre') { const [w, k] = String(arg).split('|').map(Number); this._schPreset(w, k); }
    else if (cmd === 'schclr') { [0, 1].forEach(j => ['dsf', 'dst'].forEach(p => { const el = this._ovl.querySelector('#' + p + arg + '_' + j); if (el) { el.value = ''; delete el.dataset.end; } })); }
    else if (cmd === 'schcopy') { for (let k = 1; k < 7; k++) [0, 1].forEach(j => ['dsf', 'dst'].forEach(p => { const a = this._ovl.querySelector('#' + p + '0_' + j), b = this._ovl.querySelector('#' + p + k + '_' + j); if (a && b) { b.value = a.value; if (a.dataset.end) b.dataset.end = '1'; else delete b.dataset.end; } })); }
    else if (cmd === 'schsave') {
      const P = this._pop; if (!P) return;
      const days = [], q = id => this._ovl.querySelector('#' + id);
      for (let k = 0; k < 7; k++) {
        const r = [];
        for (let j = 0; j < 2; j++) {
          const fe = q('dsf' + k + '_' + j), te = q('dst' + k + '_' + j), from = fe && fe.value, to = (te && te.value) || '';
          if (!from && !to) continue;
          const f2 = from || '00:00', t2 = to || '24:00';
          if (t2 !== '24:00' && t2 <= f2) { this._popMsg(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][k] + ': Bis-Zeit muss nach der Von-Zeit liegen (über Mitternacht: zwei Zeiträume).', true); return; }
          r.push({ from: f2, to: t2 });
        }
        r.sort((x, y) => x.from.localeCompare(y.from));
        if (r.length === 2 && r[1].from < r[0].to) { this._popMsg(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][k] + ': Zeiträume überschneiden sich.', true); return; }
        days.push(r);
      }
      this._schSave(P.arg, days).then(ok => { if (ok) this._popClose(); });
    }
    else if (cmd === 'setup') this._nav(arg ? `/config/integrations/integration/${arg}` : '/config/integrations/dashboard');
    else if (cmd === 'tsel' && d) { this._call('input_text', 'set_value', { entity_id: d.ton, value: b }); this._preview(Number(a), b); }
    else if (cmd === 'play' && d) { const t = this._st(d.ton); this._preview(Number(a), t && t.state); }
    else if (cmd === 'test' && d) this._call('script', 'turn_on', { entity_id: this._c.popup_script, variables: { tuer: d.key, titel: `Test: ${d.name}` } });
    else if (cmd === 'scan') this._call('script', 'turn_on', { entity_id: this._c.scan_script });
    else if (cmd === 'dur' && d) {
      const s = this._st(d.dauer); if (!this._ok(s)) return;
      const at = s.attributes, step = Number(at.step) || 5;
      this._call('input_number', 'set_value', { entity_id: d.dauer, value: clamp(Number(s.state) + Number(b) * step, Number(at.min ?? 10), Number(at.max ?? 300)) });
    } else if (cmd === 'ivol') {
      const s = this._st(this._c.ring.volume); if (!this._ok(s)) return;
      const at = s.attributes, step = Number(at.step) || 1;
      this._call('number', 'set_value', { entity_id: this._c.ring.volume, value: clamp(Number(s.state) + Number(a) * step, Number(at.min ?? 0), Number(at.max ?? 100)) });
    } else if (cmd === 'auto') {
      const s = this._st(this._c.ring.automation); if (!this._ok(s)) return;
      this._call('automation', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: this._c.ring.automation });
    }
  }
}

// ---------------------------------------------------------------- Statusleiste
// ---------------------------------------------------------------------------------
// Statusleiste: Symbole als fotorealistische Renderings echter Miniatur-Modelle (rp-icons/*.png, erzeugt mit
// rp-icons/_render.js: Raymarching mit Hauptlicht, weichen Schatten, Umgebungsverdeckung, Studio-Spiegelungen).
// Je Zustand ein Bild; Schattenwurf + Lichtschein auf dem Display kommen per CSS dazu (s3Fx).
// ---------------------------------------------------------------------------------
const RP_ICON = n => `${RP_BASE}rp-icons/${n}.png?v=${RP_VERSION}`;
// alle Zustandsbilder einmal vorladen (kein Flackern beim Wechsel)
['shield-ok', 'shield-wait', 'shield-alarm', 'shield-off', 'shield-na', 'person-home', 'person-away', 'person-na', 'house-gable-on', 'house-gable-off', 'house-flat-on', 'house-flat-off', 'battery', 'gear', 'tools']
  .forEach(n => { const i = new Image(); i.src = RP_ICON(n); });
const S3_DEFS = `<svg class="s3defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <linearGradient id="s3-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".22" stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
  <linearGradient id="s3-swp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <clipPath id="s3c-bat"><rect x="4.5" y="5.5" width="37" height="15" rx="2.5"/></clipPath>
</defs></svg>`;
// Schattenwurf (Objekt steht aus dem Display hervor) + Lichtschein darunter; pre = vorangestellte Filter (z. B. entsättigt)
const s3Fx = (col, a = .38, pre = '') => `${pre}drop-shadow(0 1.4px .8px rgba(0,0,0,.95)) drop-shadow(0 3px 2.5px rgba(0,0,0,.6))${a ? ` drop-shadow(0 2.5px 5px ${rgba(col, a)})` : ''}`;
// wandernder Lichtreflex über das Akku-Glas (nur beim Laden)
const s3Sweep = (clip, delay, h = 24, dist) => `<g clip-path="url(#${clip})"><g transform="skewX(-18)"><rect class="s3sw" x="-8" y="0" width="4.5" height="${h}" fill="url(#s3-swp)" style="--sd:${delay}s${dist ? `;--sx:${dist}px` : ''}"/></g></g>`;
// Start-Taste: Werkzeug (hinten, leicht unscharf) + silbernes Zahnrad (vorne)
const S3_GEAR = `<span class="g3"><img class="g3t" src="${RP_ICON('tools')}" alt=""><img class="g3r" src="${RP_ICON('gear')}" alt=""></span>`;

class RPStatusbar extends RPModule {
  // freie Anordnung (layout: custom): Start-Taste, linke Einträge, Infobereich (tray, zerlegbar in tray.alarm …) und Uhr als eigene Elemente
  static get KINDS() { return { settings: 'fill' }; }
  // height: am Modul (Fläche fest): Rasterzeilen wachsen mit, Elemente füllen die ganze Höhe des Rahmens
  _fit() {
    const rows = () => {
      const g = this._v === 'custom' && this.$ && this.$('box') && this.$('box').querySelector('.cgrid'); if (!g) return false;
      const c = this._cg(), fx = this.dataset.fixh === '1', t = `repeat(${this._vs().custom.rows}, ${fx ? `minmax(${c.row_height}px, 1fr)` : c.row_height + 'px'})`;
      if (g.dataset.rows === t) return false;
      g.dataset.rows = t; g.style.height = fx ? '100%' : ''; g.style.gridTemplateRows = t; return true;
    };
    rows(); super._fit();
    if (rows()) this._fitCells();   // Variante gerade erst aufgebaut
  }
  edParts() { const it = this._items || []; return [...(it.includes('settings') ? ['settings'] : []), ...it.filter(i => SB_LEFT.includes(i)), ...(it.some(i => SB_TRAY.includes(i)) ? ['tray'] : []), ...(it.includes('clock') ? ['clock'] : [])]; }
  // Startpunkt für den Editor: Lage der Einträge in der normalen Leiste
  _toElements(cols = 24, rowH = 20, gap = 6) {
    const box = this.$('box'), P = parseFloat(box.style.padding) || 0, els = {}, g = n => n && this._gridPos(n, cols, rowH, gap);
    const q = s => box.querySelector(s), it = this._items;
    if (it.includes('settings')) { const e = g(q('.sbstart') || q('.sic')); if (e) els.settings = e; }
    for (const i of it.filter(x => SB_LEFT.includes(x))) { const n = q(`[data-sbp="${i}"]`); const e = n && n.offsetWidth ? g(n) : null; if (e) els[i] = e; }
    const tr = g(q('.stray')), ck = it.includes('clock') ? g(q('.sclk')) : null;
    if (ck) els.clock = ck;
    // Uhr steht in der Leiste im selben Display wie die Symbole → Infobereich endet vor der Uhr
    if (tr && it.some(i => SB_TRAY.includes(i))) { if (ck && ck.col > tr.col) tr.w = ck.col - tr.col; els.tray = tr; }
    return { grid: { columns: cols, row_height: rowH, gap, width: Math.round(box.offsetWidth - 2 * P) }, elements: els };
  }
  // Einstellungs-Taste im Display (voll): Zahnrad dreht sich beim Drücken
  static get CSS() { return '.cst{position:relative;width:100%;height:100%;min-height:54px;border-radius:16px;background:rgba(0,0,0,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 0 0 1px rgba(255,255,255,.05)}.cstat{height:auto;padding:0}.cstat>.it{padding:0}.sbc{height:100%}.sclkd{padding:0 14px}.sbc .stray{justify-content:center}.sdg{position:relative;z-index:1;width:25px;height:40px;margin:0 -6px;border-radius:10px;cursor:pointer}.sdg img{position:absolute;left:-7px;top:-4.9px;width:50px;height:50.2px;max-width:none;pointer-events:none;transform-origin:19.5px 24.9px;transition:transform .35s cubic-bezier(.3,1.4,.5,1),filter .3s;filter:drop-shadow(0 0 3px rgba(255,190,90,.35))}.sdg:active img{transform:scale(.88);filter:drop-shadow(0 0 6px rgba(255,190,90,.7))}.sdg.na{opacity:.35;pointer-events:none}'; }
  get defaultPad() { return 0; }
  get meta() { return this.variants().bar; }
  variants() { const it = this._items || [], n = it.filter(i => !SB_SMALL[i]).length; return { bar: { bw: Math.max(320, n * 205 + it.reduce((s, i) => s + (SB_SMALL[i] || 0), 0)), mh: 66, fw: true, fh: true, maxh: 110 } }; }
  static getStubConfig() { return {}; }
  // items: Auswahl + Reihenfolge der Einträge (Standard: die ersten sechs).
  // clock, battery, settings stehen rechts (in der angegebenen Reihenfolge), alle anderen links.
  norm(c) {
    const ALL = ['alarm', 'persons', 'klingel', 'batterien', 'windows', 'calendar', 'playing', 'clock', 'battery', 'settings'];
    this._items = (Array.isArray(c.items) && c.items.length ? c.items : ALL.slice(0, 6)).filter(i => ALL.includes(i));
    return L({ contacts: [], players: [], doors: NOTIFY_DOORS }, c);
  }
  html() {
    const c = this._c;
    const IT = {
      // alarm + persons: nur Symbole, zusammen in einer Digitalanzeige (siehe unten)
      alarm: `<span class="sdi" id="s-al" ${c.alarm ? `data-act="more:${c.alarm}"` : ''}><img id="s-al-ic" class="s3i" alt=""></span>`,
      persons: '<span class="sdp" id="s-av"></span>',
      // Türklingeln: je Tür ein Haus-Symbol; klein daneben durchgestrichener Lautsprecher (stumm) bzw. Bildschirm (Anzeige aus, grau)
      klingel: `<span class="sdk" data-act="klingel">${(c.doors || []).map((d, i) => `<span class="sdb" id="s-db${i}" data-roof="${d.roof === 'flat' ? 'flat' : 'gable'}"><img class="h" alt="" src="${RP_ICON('house-' + (d.roof === 'flat' ? 'flat' : 'gable') + '-on')}"><i class="bdg" id="s-dbb${i}"></i></span>`).join('')}</span>`,
      windows: '<div class="it"><span class="led" id="s-w-led"></span><div><div class="v" id="s-w">--</div><div class="s">Fenster &amp; Türen</div></div></div>',
      calendar: `<div class="it" ${c.calendar ? `data-act="more:${c.calendar}"` : ''}><span class="led" style="--lc:#6fb2ff"></span><div><div class="v" id="s-cal">--</div><div class="s" id="s-cal-s">Nächster Termin</div></div></div>`,
      playing: `<div class="it" id="s-np" style="display:none"><span class="led" style="--lc:${c.color || '#4dc3ff'}"></span><div><div class="v" id="m-np">--</div><div class="s">Wiedergabe</div></div></div>`,
      clock: '<div class="sclk"><div class="mono sct" id="s-time">--:--</div><div class="mono scd"><span id="s-date">--</span> · <span id="s-kw"></span></div></div>',
      // Tablet-Akku: Füllstand im Symbol + Prozent; lädt = Fluss-Animation, Netzteil/voll = Stecker, fast leer = rot pulsierend
      battery: `<svg class="batic" viewBox="0 0 50 26"><defs><clipPath id="s-bclip"><rect x="4.5" y="5.5" width="37" height="15" rx="2.5"/></clipPath>
        <linearGradient id="s-bshine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
        <image href="${RP_ICON('battery')}" x="0" y="0" width="50" height="26" preserveAspectRatio="none"/>
        <g clip-path="url(#s-bclip)"><rect class="bfill" id="s-bfill" x="4.5" y="5.5" width="0" height="15"/><rect class="bflow" id="s-bflow" x="4.5" y="5.5" width="0" height="15"/><rect class="bshine" x="4.5" y="5.5" width="22" height="15"/>
        <rect x="4.5" y="5.5" width="37" height="15" fill="url(#s3-tube)"/><rect x="6.5" y="6.6" width="33" height="1.8" rx=".9" fill="#fff" opacity=".28"/></g>${s3Sweep('s3c-bat', 2.8, 26, 64)}
        <path class="bsym bolt" d="M25.5 3.5l-8 11h5.5l-2 8.5 8.5-12h-5.8z"/>
        <path class="bsym plug" d="M19.5 7.5v4M26.5 7.5v4M17 11.5h12v2.5a6 6 0 0 1-12 0zM23 20v3" style="fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;filter:drop-shadow(0 0 1.5px #000) drop-shadow(0 0 1px #000)"/></svg>`,
      settings: `<div class="it sic${c.has_settings === false ? ' na' : ''}"><div class="skt"><div class="skey" data-act="settings" title="Einstellungen">${IC.gear}</div></div></div>`,
    };
    // Batterie-Manager: zwei AA-Zellen, Fenster in Statusfarbe (grün ok, gelb bald, rot blinkend = tauschen), Zähler als Abzeichen
    IT.batterien = `<span class="sbm" id="s-bm" data-act="batterien"><svg viewBox="0 0 32 32"><defs>${[10.3, 21.7].map((x, i) => `<clipPath id="s-bmc${i}"><rect x="${x - 2.7}" y="10" width="5.4" height="15.2" rx="1.1"/></clipPath>`).join('')}</defs>
      <image href="${RP_ICON('cells')}" x="0" y="0" width="32" height="32"/>${[10.3, 21.7].map((x, i) => `<g clip-path="url(#s-bmc${i})"><rect class="bmf" id="s-bmf${i}" x="${x - 2.7}" y="25.2" width="5.4" height="0"/><rect x="${x - 2.7}" y="10" width="5.4" height="15.2" fill="url(#s3-tube)"/><rect x="${x - 2}" y="10.6" width="1.1" height="14" rx=".5" fill="#fff" opacity=".25"/></g>`).join('')}</svg><i class="bdg bmn" id="s-bmn"></i></span>`;
    // Akku als Tray-Symbol: Symbol + Prozent; Zustandstext (lädt, Netzteil …) als Tooltip
    IT.battery = `<span class="tbat bat" id="s-bat" data-cls="tbat">${IT.battery}<b id="s-bat-v">--</b><span id="s-bat-s" hidden></span></span>`;
    // rechts ein Display wie der Infobereich der Windows-Taskleiste: Alarm, Anwesenheit, Akku | Uhrzeit + Datum
    // links: Einstellungs-Taste ganz außen (Start-Taste), danach die übrigen Einträge in Reihenfolge von items
    const TRAY = SB_TRAY, has = i => this._items.includes(i);
    const left = this._items.filter(i => SB_LEFT.includes(i));
    // freie Anordnung: jeder Teil ein Element im Modul-Raster, Glas kommt vom Rahmen
    if (this._v === 'custom') {
      const p = {}, tag = (h, a) => h.replace(/^\s*<(\w+)/, `<$1 ${a}`);
      if (has('settings')) p.settings = this.P('settings', `<div class="sbstart cst${c.has_settings === false ? ' na' : ''}" data-act="settings" title="Einstellungen"><div class="sbk">${S3_GEAR}</div></div>`);
      left.forEach(i => { p[i] = this.P(i, `<div class="status cstat">${IT[i]}</div>`); });
      const ti = TRAY.filter(has);
      if (ti.length) p.tray = this.P('tray', `<div class="lcd stray">${ti.map(i => tag(IT[i], `data-sub="tray.${i}"`)).join('')}</div>`);
      if (has('clock')) p.clock = this.P('clock', `<div class="lcd stray sclkd">${IT.clock}</div>`);
      const off = Object.keys(IT).filter(i => !has(i) && i !== 'settings');
      return `${S3_DEFS}<div class="sbc">${this._cgrid(p)}<div style="display:none">${off.map(i => IT[i]).join('')}</div></div>`;
    }
    // voll: Display über die ganze Breite – Symbole links, Akku rechtsbündig
    const full = c.voll === true || c.full === true;
    // voll + settings: Einstellungs-Taste im Display links vom Akku, mit Trenner zu den übrigen Symbolen
    const gear = full && has('settings') ? `<i class="sdsep"></i><span class="sdg${c.has_settings === false ? ' na' : ''}" data-act="settings" title="Einstellungen"><img src="${RP_ICON('gear')}" alt=""></span>${has('battery') ? '<i class="sdsep"></i>' : ''}` : '';
    const icons = full ? TRAY.filter(i => has(i) && i !== 'battery').map(i => IT[i]).join('') + (has('battery') || gear ? '<span style="flex:1"></span>' + gear + (has('battery') ? IT.battery : '') : '') : TRAY.filter(has).map(i => IT[i]).join('');
    const mid = c.mittig === true || c.center === true;   // mittig: alles in die Mitte (z. B. Kopfleiste im Trapez)
    const tray = icons || has('clock') ? `<div class="it ${mid || full ? '' : 'rgt '}trayw"${full ? ' style="flex:1;min-width:0"' : ''}><div class="lcd stray"${full ? ' style="width:100%"' : ''}>${icons}${icons && has('clock') ? '<i class="sdsep"></i>' : ''}${has('clock') ? IT.clock : ''}</div></div>` : '';
    const off = Object.keys(IT).filter(i => !has(i) && i !== 'settings');
    const bar = cls => `<div class="${cls}status" style="display:flex;align-items:center;${mid ? 'justify-content:center;' : ''}height:100%;min-height:66px;padding:0 ${full ? 0 : 18}px">${left.map(i => IT[i].replace(/^\s*<(\w+)/, `<$1 data-sbp="${i}"`)).join('')}${tray}
     <div style="display:none">${off.map(i => IT[i]).join('')}</div></div>`;
    // Rahmen mit freier Form: Start-Taste als Segment in der Leiste, Glas kommt vom Rahmen
    if (has('settings') && !full && c.eigenes_glas === false) { left.unshift('settings'); IT.settings = IT.settings.replace('it sic', 'it sic first'); }
    if (!has('settings') || full || c.eigenes_glas === false) return S3_DEFS + bar('');
    // Start-Taste als eigene Glasplatte, Leiste beginnt erst danach (Panel-Rahmen ist dann ohne Glas)
    return `${S3_DEFS}<div class="sbwrap"><div class="plate sbstart${c.has_settings === false ? ' na' : ''}" data-act="settings" title="Einstellungen"><div class="sbk">${S3_GEAR}</div></div>${bar('plate ')}</div>`;
  }
  // Akku-Quelle: battery: {level, state, charger, plugged} · sonst Browser Mod dieses Browsers · sonst Browser-API
  _batSrc() {
    const pn = this._panel && this._panel(), sd = pn && pn._bgSide && pn._bgSide(), g = sd && WK.snap && WK.snap.hintergrund ? WK.snap.hintergrund[sd] : null;
    if (g && g.akku_level) {
      const st = g.akku_status || '', bin = /^binary_sensor\./.test(st);
      return { level: g.akku_level, state: st && !bin ? st : undefined, plugged: bin ? st : undefined, charger: g.akku_lader || undefined, cfg: true };
    }
    const b = this._c.battery;
    if (typeof b === 'string' && b !== 'auto') return { level: b, cfg: true };
    if (b && typeof b === 'object' && (b.level || b.entity)) return { level: b.level || b.entity, state: b.state, charger: b.charger, plugged: b.plugged || b.charging, cfg: true };
    let id = null; try { id = localStorage.getItem('browser_mod-browser-id'); } catch (e) { /* ohne Speicher */ }
    if (id) { const p = id.replace(/[^a-z0-9]+/gi, '_').toLowerCase(); return { level: `sensor.${p}_browser_battery`, plugged: `binary_sensor.${p}_browser_charging` }; }
    return {};
  }
  onConnect() {
    if (!this._items || !this._items.includes('battery') || this._nbReq || !navigator.getBattery) return;
    this._nbReq = true;
    navigator.getBattery().then(b => { this._nb = b; const f = () => this._built && this._hass && this._updBat(); ['levelchange', 'chargingchange'].forEach(e => b.addEventListener(e, f)); f(); }).catch(() => {});
  }
  _batInfo() {
    const src = this._batSrc(), low = Number((this._c.battery || {}).low ?? 20);
    const ls = this._st(src.level); let lvl = this._ok(ls) ? Number(ls.state) : NaN, plugged = null;
    const st = src.state ? String((this._st(src.state) || {}).state || '').toLowerCase().replace(/[\s-]+/g, '_') : '';
    const chs = src.charger ? String((this._st(src.charger) || {}).state || '').toLowerCase() : '';
    const charger = !!chs && !['none', 'unknown', 'unavailable', 'off', 'false'].includes(chs);
    if (src.plugged) { const ps = this._st(src.plugged); if (this._ok(ps)) plugged = ps.state === 'on' || ps.state === 'true'; }
    if (isNaN(lvl) && this._nb && !src.cfg) { lvl = Math.round(this._nb.level * 100); plugged = this._nb.charging; }
    if (isNaN(lvl)) return { mode: 'na', lvl: NaN, low };
    let mode;
    const CHT = ['ac', 'usb', 'wireless', 'dock', 'plugged', 'on', 'true'];
    if (CHT.includes(st)) { mode = lvl >= 99 ? 'full' : 'charge'; return { mode, lvl: clamp(lvl, 0, 100), low, charger: chs || st }; }   // Ladezustand-Feld meldet nur „am Netz“
    if (['none', 'off', 'false', 'unplugged'].includes(st)) return { mode: 'bat', lvl: clamp(lvl, 0, 100), low, charger: '' };
    if (st === 'charging') mode = 'charge';
    else if (st === 'full') mode = 'full';
    else if (st && !NA.includes(st)) mode = charger ? 'full' : 'bat';   // discharging / not_charging (Android: am Netz, lädt nicht)
    else if (plugged != null) mode = plugged ? (lvl >= 99 ? 'full' : 'charge') : 'bat';
    else mode = charger ? (lvl >= 99 ? 'full' : 'charge') : 'bat';
    return { mode, lvl: clamp(lvl, 0, 100), low, charger: chs };
  }
  _updBat() {
    const el = this.$('s-bat'); if (!el) return;
    const b = this._batInfo(), lowNow = b.mode === 'bat' && b.lvl <= b.low;
    const col = b.mode === 'na' ? '#979ca5' : b.mode === 'charge' ? '#3ddc84' : b.mode === 'full' ? '#4dc3ff' : lowNow ? '#ff5a5a' : b.lvl <= 40 ? '#ffc34d' : '#3ddc84';
    el.className = `${el.dataset.cls || 'it'} bat ${b.mode}${lowNow ? ' low' : ''}`;
    el.style.setProperty('--bc', col); el.style.setProperty('--bg', rgba(col, .7));
    const w = b.mode === 'na' ? 0 : 37 * b.lvl / 100;
    this.$('s-bfill').setAttribute('width', w.toFixed(1));
    // Lade-Fluss: vom aktuellen Stand bis voll
    const fl = this.$('s-bflow'); fl.setAttribute('x', (4.5 + w).toFixed(1)); fl.setAttribute('width', Math.max(0, 37 - w).toFixed(1));
    this.$('s-bat-v').textContent = b.mode === 'na' ? '--' : `${Math.round(b.lvl)} %`;
    const CH = { ac: 'Netzteil', usb: 'USB', wireless: 'Induktiv' };
    const bt = b.mode === 'na' ? 'Tablet n.v.' : b.mode === 'charge' ? `Lädt${CH[b.charger] ? ' · ' + CH[b.charger] : ''}` : b.mode === 'full' ? (b.lvl >= 99 ? 'Netzteil · Voll' : 'Netzteil') : lowNow ? 'Akku fast leer' : '';
    this.$('s-bat-s').textContent = bt; el.title = 'Tablet-Akku' + (b.mode === 'na' ? ' n.v.' : `: ${Math.round(b.lvl)} %${bt ? ' · ' + bt : ''}`);
  }
  // Batterie-Manager: batterien: {offen, schwach, tage, link} – Standard sensor.batterien_zu_tauschen / _schwach, 14 Tage
  _bmCfg() { const b = this._c.batterien || {}; return { offen: b.offen || 'sensor.batterien_zu_tauschen', schwach: b.schwach || 'sensor.batterien_schwach', tage: Number(b.tage ?? 14), link: b.link || '/batterie-manager/0' }; }
  _updBm() {
    const el = this.$('s-bm'); if (!el || !this._items.includes('batterien')) return;
    const b = this._bmCfg(), o = this._st(b.offen), s = this._st(b.schwach);
    let mode = 'na', n = 0, names = [], tip = 'Batterie-Manager n.v.';
    if (this._ok(o)) {
      n = Math.round(Number(o.state)) || 0;
      const low = (s && s.attributes.geraete) || [], soon = (o.attributes.als_naechstes || []).filter(x => x.days != null && x.days <= b.tage);
      if (n > 0) { mode = 'low'; names = low; tip = `${n === 1 ? '1 Batterie' : n + ' Batterien'} tauschen${low.length ? ': ' + low.join(', ') : ''}`; }
      else if (soon.length) { mode = 'mid'; tip = 'Bald fällig: ' + soon.map(x => `${x.name} (${x.days} T)`).join(', '); }
      else { mode = 'ok'; tip = 'Alle Batterien in Ordnung'; }
    }
    const col = { na: '#4a4d53', ok: '#3ddc84', mid: '#ffc34d', low: '#ff4a4a' }[mode], lvl = { na: 0, ok: 1, mid: .5, low: .2 }[mode];
    el.className = 'sbm ' + mode; el.title = tip; el.style.setProperty('--bc', col);
    el.querySelector('svg').style.filter = s3Fx(col, mode === 'na' ? 0 : .45);
    [0, 1].forEach(i => { const r = this.$('s-bmf' + i); r.setAttribute('y', (25.2 - 15.2 * lvl).toFixed(2)); r.setAttribute('height', (15.2 * lvl).toFixed(2)); });
    const bd = this.$('s-bmn'); bd.textContent = n > 0 ? (n > 9 ? '9+' : String(n)) : ''; bd.style.display = n > 0 ? 'grid' : 'none';
  }
  _updKlingel() {
    if (!this._items.includes('klingel') || !this._hass) return;
    const c = this._c, me = bmMe(), raum = raumOf(this, c), an = raum && (RAUM_NAMES[raum] || raum.toUpperCase());
    (c.doors || []).forEach((d, i) => {
      const el = this.$('s-db' + i), b = this.$('s-dbb' + i); if (!el) return;
      // grün = aktiv (Abzeichen: kein Ton / kein Popup), grau = Popup und Ton aus
      const s = doorStatus(this._hass, d, raum, me), on = s.shown || s.sound, col = on ? (c.klingel_color || '#3ddc84') : '#8c919a';
      el.className = 'sdb' + (on ? '' : ' off');
      el.style.color = col;
      const hi = el.querySelector('img.h'), hs = RP_ICON('house-' + el.dataset.roof + (on ? '-on' : '-off')); if (hi.getAttribute('src') !== hs) hi.setAttribute('src', hs);
      hi.style.filter = on ? s3Fx('#ffbf5a', .3) : s3Fx(col, 0, 'grayscale(.35) brightness(.85) ');
      const badge = !on ? '' : !s.sound ? 'mute' : !s.shown ? 'off' : '';
      this._html(b, badge ? notifySvg(badge) : '');
      b.className = 'bdg' + (badge === 'mute' ? ' bmute' : badge === 'off' ? ' boff' : '');
      el.title = d.name + ': ' + (!on ? 'kein Popup, kein Ton – ' + (s.why === s.swhy ? s.why : s.why + ' / ' + s.swhy) : !s.sound ? 'Popup ohne Ton – ' + s.swhy : !s.shown ? 'nur Ton, kein Popup – ' + s.why : 'Popup + Ton') + (an ? ' · Raum ' + an : ' · kein Raum-Kürzel');
    });
  }
  // Start-Taste: Eindrück-Effekt mindestens 220 ms sichtbar (auch bei kurzem Antippen)
  bind() {
    const b = this.$('box') && this.shadowRoot.querySelector('.sbstart'); if (!b) return;
    let t0 = 0;
    const up = () => { const w = Math.max(0, 220 - (Date.now() - t0)); setTimeout(() => b.classList.remove('pr'), w); };
    b.addEventListener('pointerdown', () => { t0 = Date.now(); b.classList.add('pr'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(e => b.addEventListener(e, up));
  }
  act(cmd) {
    if (cmd === 'settings') { const p = this._panel(); if (p && p.openSettings) p.openSettings(); }
    // Klingel-Symbol: Einstellungen → Türklingel → Reiter „Dieser Raum“
    if (cmd === 'klingel') { const p = this._panel(); window.__rpDoorTab = 'room'; if (p && p.openSettings) p.openSettings('tuer'); }
    // Batterie-Symbol: Batterie-Manager öffnen
    if (cmd === 'batterien') {
      const p = this._panel(), b = this._c.batterien || {};
      if (b.fenster !== false && p && p.openBatteries && p.openBatteries(b)) return;
      history.pushState(null, '', this._bmCfg().link); window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    }
  }
  watch(h) {
    const c = this._c, ids = [c.alarm, c.calendar, ...(c.players || [])];
    if (this._items.includes('battery')) { const b = this._batSrc(); ids.push(b.level, b.state, b.charger, b.plugged); }
    if (this._items.includes('batterien')) { const b = this._bmCfg(); ids.push(b.offen, b.schwach); }
    if (this._items.includes('klingel')) {
      const area = raumOf(this, c);
      (c.doors || []).forEach(dr => ids.push(...['ziel', 'ton'].map(x => 'input_text.klingel_' + dr.key + '_' + x), 'input_number.klingel_' + dr.key + '_lautstarke'));
      if (area) ids.push(...Object.values(roomIds(area)));
    }
    c.contacts.forEach(t => ids.push(t.entity, t.tilt));
    if (c.presence) ids.push(c.presence); else (c.persons || Object.keys(h.states).filter(e => e.startsWith('person.'))).forEach(e => ids.push(e));
    return ids;
  }
  tick() {
    if (!this._built) return;
    const d = new Date();
    this.$('s-time').textContent = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    this.$('s-date').textContent = d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase() + ' ' + d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    this.$('s-kw').textContent = 'KW ' + isoWeek(d);
  }
  update() {
    const $ = this.$, c = this._c;
    this._updBat();
    this._updKlingel();
    this._updBm();
    const al = this._st(c.alarm);
    // Alarmanlage als Symbol: Schild mit Haken = scharf, leeres Schild = unscharf, Punkte = Übergang, ! blinkend = Alarm
    const AL = { disarmed: ['off', '#8a8e96', 'Unscharf'], armed_home: ['ok', '#3ddc84', 'Scharf · Zuhause'], armed_away: ['ok', '#3ddc84', 'Scharf · Abwesend'], armed_night: ['ok', '#3ddc84', 'Scharf · Nacht'], armed_vacation: ['ok', '#3ddc84', 'Scharf · Urlaub'], armed_custom_bypass: ['ok', '#3ddc84', 'Scharf · Benutzer'], arming: ['wait', '#ffb347', 'Wird scharf'], pending: ['wait', '#ffb347', 'Verzögerung'], disarming: ['wait', '#ffb347', 'Wird entschärft'], triggered: ['alarm', '#ff5a5a', 'ALARM'] };
    const [ag, ac, at] = !this._ok(al) ? ['off', '#4a4d53', 'n.v.'] : (AL[al.state] || ['off', '#8a8e96', al.state]);
    const ai = $('s-al-ic');
    const src = RP_ICON('shield-' + (!this._ok(al) ? 'na' : ag)); if (ai.getAttribute('src') !== src) ai.setAttribute('src', src); ai.style.filter = s3Fx(ac, ag === 'off' ? 0 : .42);
    $('s-al').className = 'sdi' + (ag === 'alarm' ? ' alarm' : ''); $('s-al').title = 'Alarmanlage: ' + at;
    // Anwesenheit: ein Symbol – grün = zuhause, rot = abwesend, grau = n.v.
    // presence: Entität mit Zuhause/Abwesend (z. B. input_select at_home/away); ohne Angabe: zuhause, sobald eine Person home ist
    const pr = this._st(c.presence);
    let home = null, pid = c.presence;
    if (c.presence) { if (this._ok(pr)) home = /^(at_home|home|on|true|zuhause|anwesend)$/i.test(pr.state) ? true : /^(away|not_home|off|false|abwesend|unterwegs)$/i.test(pr.state) ? false : null; }
    else {
      const ps = (c.persons || Object.keys(this._hass.states).filter(e => e.startsWith('person.'))).map(e => this._st(e)).filter(s => this._ok(s));
      if (ps.length) home = ps.some(p => String(p.state).toLowerCase() === 'home'); pid = ps[0] && ps[0].entity_id;
    }
    const pcol = home === true ? '#3ddc84' : home === false ? '#ff5a5a' : '#4a4d53';
    this._html($('s-av'), `<img class="s3i" alt="" src="${RP_ICON('person-' + (home === true ? 'home' : home === false ? 'away' : 'na'))}" ${pid ? `data-act="more:${pid}"` : ''} title="Anwesenheit: ${home === true ? 'zuhause' : home === false ? 'abwesend' : 'n.v.'}" style="filter:${s3Fx(pcol, home == null ? 0 : .32)}">`);
    // Fenster & Türen: aus den Kontakten (Standard: alle Grundriss-Module des Panels)
    let open = 0, tilt = 0, na = 0;
    c.contacts.forEach(ct => { const st = contactState(this._hass.states, ct); if (st === 'open') open++; else if (st === 'tilt') tilt++; else if (st === 'na') na++; });
    const total = c.contacts.length, wcol = open ? '#ff5a5a' : tilt ? '#ffb347' : !total || na === total ? '#979ca5' : '#3ddc84';
    $('s-w').textContent = !total ? '—' : open || tilt ? [open ? `${open} offen` : '', tilt ? `${tilt} gekippt` : ''].filter(Boolean).join(' · ') : na === total ? 'n.v.' : 'Alles zu';
    $('s-w-led').style.setProperty('--lc', wcol);
    const cal = this._st(c.calendar);
    if (cal && cal.attributes.start_time) {
      const d = new Date(cal.attributes.start_time.replace(' ', 'T'));
      const day = d.toDateString() === new Date().toDateString() ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
      $('s-cal').textContent = `${day} ${cal.attributes.all_day ? '' : hhmm(d)} ${cal.attributes.message || ''}`.replace(/\s+/g, ' ').trim();
    } else $('s-cal').textContent = c.calendar ? 'Keine Termine' : '—';
    // Wiedergabe (Standard: Mediaplayer aller Audio-Module des Panels)
    const pl = (c.players || []).map(e => this._st(e)).filter(s => this._ok(s) && s.state !== 'off' && s.state !== 'standby');
    const p = pl.find(s => s.state === 'playing') || pl.find(s => s.state === 'paused') || pl[0] || null;
    $('s-np').style.display = p ? '' : 'none';
    if (p) $('m-np').textContent = (p.state === 'playing' ? '▶ ' : p.state === 'paused' ? '❚❚ ' : '● ') + mediaTitle(p);
  }
}

// ---------------------------------------------------------------------------------
// Panel: Block-Raster über den ganzen Bildschirm, Glasrahmen mit Modulen
// ---------------------------------------------------------------------------------
const SB_TRAY = ['alarm', 'persons', 'klingel', 'batterien', 'battery'], SB_LEFT = ['windows', 'calendar', 'playing'];
const SB_SMALL = { settings: 100, battery: 60, alarm: 46, persons: 46, klingel: 100, batterien: 46, clock: 190 };
const MODULES = { light: 'rp-light', heating: 'rp-heating', weather: 'rp-weather', air: 'rp-air', floorplan: 'rp-floorplan', audio: 'rp-audio', 'audio-settings': 'rp-audio-settings', 'door-settings': 'rp-door-settings', 'light-settings': 'rp-light-settings', 'house-settings': 'rp-house-settings', 'heating-settings': 'rp-heating-settings', statusbar: 'rp-statusbar', lichter: 'rp-lichter', uhr: 'rp-uhr', wecker: 'rp-wecker', kodi: 'rp-kodi', bett: 'rp-bett', 'bett-settings': 'rp-bett-settings', 'bett-audio': 'rp-bett-audio' };
// Einstellungs-Seiten: Symbol + Farbe nach Titel/Pfad
const SET_KIND = [[/wecker|alarm/i, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.2l2.6 1.8M3.5 5.5 6.5 3M20.5 5.5 17.5 3"/></svg>', '#ffb347'],
  [/(^|\s)uhr|uhrzeit|zeitzone|clock/i, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>', '#9fc3ff'],
  [/gewicht|waage|weight/i, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="17" height="16" rx="3.5"/><path d="M8 10a5 5 0 0 1 8 0M12 10l1.6-2.2"/></svg>', '#3ddc84'],
  [/betttemp|matratze|heizdecke/i, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14.5V5.5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 11v5"/></svg>', '#ff8a4c'],
  [/erschein|aussehen|design|optik/i, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.7 1.6-1.5 0-.5-.2-.8-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>', '#a36bff'],
  [/allg|general|system|übersicht/i, IC.sliders, '#4dc3ff'], [/licht|light|lampe/i, BULB, '#ffc34d'], [/lüft|lueft|luft|vent|fan|klima/i, IC.fan, '#3ddc84'],
  [/audio|musik|sound|ton|z906/i, IC.speaker, '#a36bff'], [/heiz|heat|temp|thermo/i, IC.flame, '#ff8a4c'], [/tür|tuer|klingel|intercom|door/i, IC.bell, '#ff6b8b']];
const escH = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------------
// Rahmen mit freier Form: ecken: [[spalte, reihe], …] auf den Rasterlinien (1 = linker/oberer Rand,
// columns+1 = rechter Rand). Auch als Text "1,1 21,1 16,16 1,16" oder [{col, row}, …].
// ---------------------------------------------------------------------------------
// rand: 20 | "20 40" | [oben, rechts, unten, links] (1–4 Werte wie CSS) | { oben, rechts, unten, links } (auch top/right/bottom/left)
const modRand = (v, u) => {
  if (v == null || v === '') return '';
  const one = x => typeof x === 'string' && /%$/.test(x.trim()) ? x.trim() : ((Number(x) || 0) * u).toFixed(1) + 'px';
  if (typeof v === 'object' && !Array.isArray(v)) return ['oben|top', 'rechts|right', 'unten|bottom', 'links|left'].map(k => one(k.split('|').map(n => v[n]).find(x => x != null) ?? 0)).join(' ');
  const a = (Array.isArray(v) ? v : String(v).trim().split(/[\s,]+/)).slice(0, 4);
  return a.length ? a.map(one).join(' ') : '';
};
const polyPts = f => {
  const e = f && (f.ecken ?? f.corners ?? f.points); if (e == null) return null;
  const a = Array.isArray(e) ? e : String(e).trim().split(/[\s;]+/);
  const pts = a.map(p => Array.isArray(p) ? p : typeof p === 'string' ? p.split(',') : p && typeof p === 'object' ? [p.col ?? p.x, p.row ?? p.y ?? p['true']] : null)
    .filter(Boolean).map(p => [Number(p[0]), Number(p[1])]).filter(p => isFinite(p[0]) && isFinite(p[1]))
    .filter((p, i, A) => i === 0 || p[0] !== A[i - 1][0] || p[1] !== A[i - 1][1]);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  return pts.length >= 3 ? pts : null;
};
const polyTxt = pts => pts.map(p => p.join(',')).join(' ');
const polyArea = P => P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
const polyIn = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
// Kanten um d nach innen versetzen (Abstand zwischen Rahmen an schrägen Fugen gleich breit)
const polyInset = (P, d) => {
  const s = polyArea(P) >= 0 ? 1 : -1, n = P.length;
  const L = P.map((p, i) => { const q = P[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * s, ny = dx / l * s; return { x: p[0] + nx * d, y: p[1] + ny * d, dx, dy, nx, ny }; });
  return P.map((p, i) => {
    const a = L[(i - 1 + n) % n], b = L[i], den = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(den) < 1e-9) return [p[0] + b.nx * d, p[1] + b.ny * d];
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / den;
    return [a.x + a.dx * t, a.y + a.dy * t];
  });
};
// SVG-Pfad mit abgerundeten Ecken (Radius r)
const polyPath = (P, r) => {
  const n = P.length, f = v => v.toFixed(1);
  const seg = P.map((v, i) => {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    const ax = a[0] - v[0], ay = a[1] - v[1], bx = b[0] - v[0], by = b[1] - v[1], la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    const ang = Math.acos(clamp((ax * bx + ay * by) / (la * lb), -1, 1));
    const t = Math.min(ang > 1e-3 ? r / Math.tan(ang / 2) : 0, la / 2, lb / 2);
    return { s: [v[0] + ax / la * t, v[1] + ay / la * t], v, e: [v[0] + bx / lb * t, v[1] + by / lb * t] };
  });
  return `M${f(seg[0].e[0])} ${f(seg[0].e[1])}` + seg.slice(1).concat(seg[0]).map(q => `L${f(q.s[0])} ${f(q.s[1])}Q${f(q.v[0])} ${f(q.v[1])} ${f(q.e[0])} ${f(q.e[1])}`).join('') + 'Z';
};

// ---------------------------------------------------------------------------------
// Visueller Editor (Phase 3): Rahmen ziehen/vergrößern, Module einstellen, YAML ausgeben
// ---------------------------------------------------------------------------------
const ED_NAMES = { lichter: 'Lichter (Liste)', light: 'Licht', heating: 'Heizung', weather: 'Wetter', air: 'Raumklima', floorplan: 'Grundriss', audio: 'Audio', statusbar: 'Statusleiste', uhr: 'Uhr', wecker: 'Wecker', kodi: 'Kodi', bett: 'Bett', card: 'HA-Karte' };
const ED_VARIANTS = { light: ['tall', 'wide', 'compact'], heating: ['tall', 'wide', 'compact'], weather: ['wide', 'tall', 'compact'], air: ['row', 'grid'], floorplan: ['tall', 'wide'], audio: ['full', 'compact'] };
const ED_PARTS = {
  light: ['power', 'tabs', 'subtitle', 'dial', 'display', 'modes', 'ctemp', 'brightness', 'favorites'],
  heating: ['head', 'modes', 'dial', 'stepper'], weather: ['now', 'forecast'], air: ['title', 'tiles'],
  floorplan: ['head', 'plan', 'legend'], audio: ['tabs', 'volume', 'power', 'source', 'display', 'transport', 'presets', 'meters'],
  uhr: ['time', 'date', 'next'], wecker: ['head', 'sel', 'list', 'foot'], kodi: ['head', 'now', 'pad', 'keys', 'transport', 'volume'], bett: ['weight', 'temp'],
};
// Gruppen, die sich in einzelne Bedienelemente zerlegen lassen (Name im YAML: gruppe.teil, z. B. power.alloff)
//   keep = die Gruppe bleibt danach mit ihrem Rest bestehen (z. B. Drehrad ohne Plus/Minus)
const ED_SUBS = {
  light: { power: { subs: ['primary', 'alloff', 'secondary'] }, tabs: { subs: ['primary', 'secondary'] }, modes: { subs: ['white', 'color'] } },
  heating: { modes: { subs: ['heat', 'boost', 'off'] }, dial: { subs: ['ist', 'valve'], keep: true }, stepper: { subs: ['minus', 'display', 'plus'] } },
  audio: { volume: { subs: ['display', 'slider'] }, source: { subs: ['source', 'effect'] }, transport: { subs: ['mute', 'prev', 'play', 'stop', 'next'] }, meters: { subs: ['signal', 'temp'] } },
};
// Vorlagen für neu hinzugefügte Module – Entitäten trägt man danach im YAML ein
const ED_STUB = {
  lichter: { lichter: [{ name: 'Nachtlicht', entity: 'light.' }] }, light: { lights: { primary: { entity: 'light.' } } }, heating: { climate: { entity: 'climate.' } }, weather: { entity: 'weather.forecast_home' },
  air: { sensors: [] }, floorplan: { floorplan: { contacts: [] } }, audio: { media: { players: [] } }, statusbar: {}, card: { card: { type: 'tile', entity: '' } },
};
const ED_ALIGN = [['', 'Mitte'], ['top', 'oben'], ['bottom', 'unten'], ['left', 'links'], ['right', 'rechts'], ['top left', 'oben links'], ['top right', 'oben rechts'], ['bottom left', 'unten links'], ['bottom right', 'unten rechts']];

// Kleiner YAML-Schreiber für die Ausgabe (Objekte, Listen, Texte, Zahlen, Wahrheitswerte)
const Y_BOOL = /^(y|n|yes|no|on|off|true|false|null|~)$/i;
const yKey = k => Y_BOOL.test(k) || !/^[A-Za-z_][\w.-]*$/.test(k) ? `'${k}'` : k;
const yStr = v => (v === '' || Y_BOOL.test(v) || /^[\s\-?:,[\]{}#&*!|>'"%@`]|\s$|: | #|^[+-]?(\d|\.\d)/.test(v)) ? JSON.stringify(v) : v;
const yScal = v => v == null ? 'null' : typeof v === 'string' ? yStr(v) : String(v);
const isScal = v => v == null || typeof v !== 'object';
const toYaml = (v, ind = 0) => {
  const pad = ' '.repeat(ind);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    if (v.every(isScal) && v.map(yScal).join(', ').length < 70) return `[${v.map(yScal).join(', ')}]`;
    return '\n' + v.map(it => isScal(it) ? `${pad}- ${yScal(it)}` : `${pad}- ${toYaml(it, ind + 2).replace(/^\n\s*/, '')}`).join('\n');
  }
  if (v && typeof v === 'object') {
    const ks = Object.keys(v).filter(k => v[k] !== undefined);
    if (!ks.length) return '{}';
    return '\n' + ks.map(k => {
      const x = v[k];
      if (isScal(x)) return `${pad}${yKey(k)}: ${yScal(x)}`;
      // kurze Objekte nur mit einfachen Werten einzeilig: { col: 1, row: 1, w: 12, h: 2 }
      if (!Array.isArray(x) && Object.keys(x).length && Object.keys(x).length <= 6 && Object.values(x).every(isScal)) {
        const fl = `{ ${Object.keys(x).filter(q => x[q] !== undefined).map(q => `${yKey(q)}: ${yScal(x[q])}`).join(', ')} }`;
        if (fl.length <= 64) return `${pad}${yKey(k)}: ${fl}`;
      }
      const sub = toYaml(x, ind + 2);
      return sub.startsWith('\n') ? `${pad}${yKey(k)}:${sub}` : `${pad}${yKey(k)}: ${sub}`;
    }).join('\n');
  }
  return yScal(v);
};
// Schlüssel in fester Reihenfolge (Position/Größe zuerst), Rest danach
const edOrder = (o, first) => { const r = {}; for (const k of first) if (o[k] !== undefined) r[k] = o[k]; for (const k of Object.keys(o)) if (!(k in r)) r[k] = o[k]; return r; };
// r = berechnete Lage (0-basiert): Anker-Texte (right, bottom …) bleiben, sonst Zahlen ab 1
const edFrameOut = (f, r) => {
  const g = JSON.parse(JSON.stringify(f)), cx = f.col ?? f.x ?? f.column, cy = f.row ?? f.y ?? f['true'];
  delete g.x; delete g.y; delete g['true']; delete g.column; delete g.width; delete g.height;
  const pts = polyPts(f);
  if (pts) { delete g.corners; delete g.points; delete g.col; delete g.row; delete g.w; delete g.h; g.ecken = pts; }
  else if (r) { g.col = typeof cx === 'string' && isNaN(cx) ? cx : r.fx + 1; g.row = typeof cy === 'string' && isNaN(cy) ? cy : r.fy + 1; g.w = r.fw; g.h = r.fh; }
  g.modules = (g.modules || []).map(m => edOrder(typeof m === 'string' ? { type: m } : m, ['type', 'size', 'layout', 'show', 'hide', 'align', 'width', 'height', 'rand', 'zoom', 'schriftgroesse', 'padding', 'display_transparenz']));
  return edOrder(g, ['name', 'note', 'col', 'row', 'w', 'h', 'ecken', 'glass', 'transparenz', 'display_transparenz', 'schriftgroesse', 'direction', 'padding', 'gap']);
};
const edIndent = (txt, n) => txt.split('\n').map(l => (l ? ' '.repeat(n) + l : l)).join('\n');
const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';

const RP_EDITOR_HTML = `<button class="edbtn" id="edbtn" hidden title="Layout bearbeiten">${ICON_EDIT}</button>
 <div class="edbar" id="edbar" hidden>
  <b>Layout bearbeiten</b><span class="edhint">Rahmen ziehen = verschieben · Ecke ziehen = Größe · Pfeiltasten = 1 Block (mit Umschalt: Größe)</span>
  <button data-ed="addframe">+ Rahmen</button><button data-ed="deselect">Panel-Einstellungen</button><button data-ed="sideoff" id="edsidebtn" title="Seitenleiste aus-/einblenden (Taste S)">☰ Seitenleiste</button><button data-ed="sideswap" title="Seitenleiste auf die andere Seite">⇆</button><button data-ed="yaml" class="pri">YAML</button><button data-ed="done">Fertig</button>
 </div>
 <div class="edside" id="edside" hidden></div>
 <div class="edmodal" id="edmodal" hidden></div>`;

const RP_EDITOR_CSS = `
.edbtn{position:absolute;right:8px;top:8px;z-index:60;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:rgba(20,21,25,.55);color:#9fd8ff;opacity:.35;cursor:pointer;display:grid;place-items:center;padding:0;transition:opacity .2s}
.edbtn:hover,.editing .edbtn{opacity:1}.edbtn svg{width:17px;height:17px}.edbtn[hidden]{display:none}
.editing .edbtn{display:none}
.edbar{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:61;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:12px;background:rgba(16,17,21,.94);border:1px solid rgba(77,195,255,.35);box-shadow:0 8px 24px rgba(0,0,0,.6);font:600 13px 'Segoe UI',Rajdhani,sans-serif;color:#dfe3ea;white-space:nowrap;max-width:calc(100% - 20px)}
.edbar b{color:#9fd8ff;letter-spacing:.5px}.edhint{color:#8a8e96;font-weight:500;font-size:12px;overflow:hidden;text-overflow:ellipsis}
.edbar[hidden],.edside[hidden],.edmodal[hidden]{display:none}
.ed-b,.edbar button,.edside button,.edmodal button{font:600 12.5px 'Segoe UI',sans-serif;color:#dfe3ea;background:#2a2c33;border:1px solid #3a3d45;border-radius:8px;padding:6px 10px;cursor:pointer}
.edbar button.pri,.edmodal button.pri{background:#1b4f6b;border-color:#2f7fa8;color:#fff}
.edbar button:hover,.edside button:hover,.edmodal button:hover{border-color:#4dc3ff}
.edov{position:absolute;inset:0;z-index:8;border:2px dashed rgba(77,195,255,.55);border-radius:inherit;cursor:move;touch-action:none;background:rgba(77,195,255,.04)}
.edov.sel{border:2px solid #4dc3ff;background:rgba(77,195,255,.10);box-shadow:0 0 0 2px rgba(77,195,255,.25)}
.edrs{position:absolute;right:-2px;bottom:-2px;width:26px;height:26px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,#4dc3ff 50%);border-bottom-right-radius:inherit}
.editing .dbgl{z-index:9}
.edempty{flex:1;display:grid;place-items:center;color:#979ca5;font:600 13px 'Segoe UI',sans-serif}
.edside{position:absolute;right:0;top:0;bottom:0;z-index:62;width:330px;max-width:90%;overflow:auto;padding:58px 14px 18px;background:rgba(14,15,19,.96);border-left:1px solid rgba(77,195,255,.25);box-shadow:-10px 0 30px rgba(0,0,0,.5);font:13px 'Segoe UI',sans-serif;color:#dfe3ea}
.edside h3{margin:14px 0 8px;font-size:13px;color:#9fd8ff;letter-spacing:.5px;text-transform:uppercase}
.edside h3:first-child{margin-top:0}
.edrow{display:grid;grid-template-columns:110px 1fr;align-items:center;gap:8px;margin:5px 0}
.edrow label{color:#9aa0aa;font-size:12px}
.ed4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:5px 0}.ed4 label{display:block;font-size:11px;color:#9aa0aa;margin-bottom:2px}
.edside input,.edside select,.edmodal input{width:100%;box-sizing:border-box;background:#1d1f25;color:#eef1f5;border:1px solid #363941;border-radius:7px;padding:5px 7px;font:13px 'Segoe UI',sans-serif}
.edside input[type=checkbox]{width:auto}
.edbtns{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.edmod{border:1px solid #2c2f37;border-radius:10px;padding:8px 10px;margin:8px 0;background:#16181d}
.edmod .t{display:flex;align-items:center;gap:6px;font-weight:700;color:#eef1f5;margin-bottom:4px}.edmod .t span{flex:1}
.edmod .t button{padding:3px 8px}
.edparts{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;font-size:12px;color:#c9ccd2}
.edparts label{display:flex;align-items:center;gap:6px}
.ednote{font-size:11.5px;color:#8a8e96;line-height:1.4;margin:6px 0}
.edmodal{position:absolute;inset:0;z-index:70;display:grid;place-items:center;background:rgba(0,0,0,.55)}
.edmbox{width:min(760px,92%);max-height:88%;display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:14px;background:#14161b;border:1px solid #2f7fa8;font:13px 'Segoe UI',sans-serif;color:#dfe3ea}
.edmbox textarea{flex:1;min-height:320px;width:100%;box-sizing:border-box;background:#0d0e12;color:#d7f0ff;border:1px solid #2c2f37;border-radius:8px;padding:10px;font:12.5px Consolas,'Share Tech Mono',monospace;white-space:pre;tab-size:2}
.edmbox .r{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.edmbox .r input{width:60px}
.edelov{position:absolute;z-index:20;pointer-events:none}
.edel{position:absolute;border:2px dashed #ffb347;background:rgba(255,179,71,.08);border-radius:6px;pointer-events:auto;cursor:move;touch-action:none;box-sizing:border-box}
.edel.sel{border-style:solid;background:rgba(255,179,71,.18)}
.edel span{position:absolute;left:3px;top:2px;font:600 11px 'Segoe UI',sans-serif;color:#ffd08a;background:rgba(0,0,0,.65);padding:1px 5px;border-radius:4px;pointer-events:none}
.edel .edrs{background:linear-gradient(135deg,transparent 50%,#ffb347 50%);border-bottom-right-radius:4px}
.edel.out{border-color:#ff5a5a;background:rgba(255,90,90,.16)}.edel.out span{color:#ff9a9a}
/* Eckpunkte einer freien Rahmenform: ziehen = verschieben, + auf einer Kante = neue Ecke, Doppelklick = Ecke entfernen */
.edcorn{position:absolute;inset:0;z-index:61;pointer-events:none}
.edpt{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#4dc3ff;border:3px solid #0d1a22;box-shadow:0 0 0 2px #4dc3ff,0 3px 10px rgba(0,0,0,.6);pointer-events:auto;cursor:grab;touch-action:none}
.edpt.drag{cursor:grabbing;background:#fff}
.edpt b{position:absolute;left:18px;top:-20px;font:600 11px 'Segoe UI',sans-serif;color:#9fd8ff;background:rgba(0,0,0,.75);padding:1px 5px;border-radius:4px;white-space:nowrap;pointer-events:none}
.edadd{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(13,26,34,.9);border:2px dashed #4dc3ff;color:#4dc3ff;font:700 14px/14px sans-serif;text-align:center;pointer-events:auto;cursor:copy;opacity:.75}
.edadd:hover{opacity:1;background:#1b4f6b}
.edelmode .edcorn{display:none}
.edelmode .edov{pointer-events:none;opacity:.2}
.edq{position:absolute;z-index:9;padding:5px 11px;border-radius:14px;border:1px solid #ffb347;background:rgba(20,21,25,.88);color:#ffb347;font:600 12px 'Segoe UI',sans-serif;cursor:pointer;pointer-events:auto;white-space:nowrap}
.edq:hover{background:#5a3d12;color:#fff}
.edelmode .edq{display:none}
`;

class RaumPanel extends HTMLElement {
  static getStubConfig() { return { grid: { columns: 50, rows: 30 }, frames: [] }; }
  constructor() { super(); this.attachShadow({ mode: 'open' }); loadFonts(); this._mods = []; }
  getCardSize() { return 14; }

  setConfig(config) {
    if (!config) throw new Error('Keine Konfiguration');
    const c = {
      grid: L({ columns: 50, rows: 30, gap: 14, padding: 14, frame_padding: 14 }, config.grid),
      background: L({ mode: 'sun', animate: true, blur: 18, opacity: .52 }, config.background),
      bottom_offset: config.bottom_offset || 0,
      debug: !!config.debug,
      // zoom: true | { timeout, dauer } – Doppeltipp/Doppelklick auf eine Karte macht sie zum Vollbild
      zoom: config.zoom ? L({ timeout: 60, dauer: 380, doppeltipp: 300 }, config.zoom === true ? {} : config.zoom) : null,
      // schriftgroesse: Faktor für Texte in allen Modulen (Rahmen/Modul/Element überschreiben); wächst nur so weit, wie es in den Platz passt
      schriftgroesse: config.schriftgroesse,
      display_transparenz: config.display_transparenz,
    };
    // Ohne frames: alte Raum-Tablet-Card-Konfiguration automatisch in Rahmen umwandeln
    c.frames = JSON.parse(JSON.stringify(Array.isArray(config.frames) ? config.frames : RaumPanel.convertOld(config, c.grid)));
    c.editor = config.editor !== false;
    this._raw = config; this._c = c; this._dirty = false;
    if (this._built || this.isConnected) this._build();
  }

  // Alte Konfiguration (lights, climate, weather, air, floorplan, media, layout.columns …) → Rahmen im 50×30-Raster
  static convertOld(o, grid) {
    const C = grid.columns, R = grid.rows, sb = !(o.layout && o.layout.statusbar === false);
    const has = { light: !!o.lights, floorplan: true, heating: !!o.climate, weather: !!o.weather, air: !!(o.air && o.air.length), audio: !!o.media };
    const mod = {
      light: () => ({ type: 'light', lights: o.lights, favorites: o.favorites }),
      heating: () => ({ type: 'heating', climate: o.climate }),
      weather: () => ({ type: 'weather', entity: o.weather }),
      air: () => ({ type: 'air', sensors: o.air, history_hours: o.air_history_hours }),
      floorplan: () => ({ type: 'floorplan', floorplan: o.floorplan || {} }),
      audio: () => ({ type: 'audio', media: o.media }),
    };
    const cols = (o.layout && o.layout.columns) || [{ width: 404, modules: ['light', 'weather'] }, { width: 404, modules: ['heating', 'air'] }, { width: 416, modules: ['floorplan', 'audio'] }];
    const ncols = cols.map(x => Array.isArray(x) ? { modules: x } : (x || { modules: [] }));
    // Breiten (Design-px) in Blöcke umrechnen, Rest der letzten Spalte geben
    const wsum = ncols.reduce((s, x) => s + (x.width || 404) + 14, 0);
    let x0 = 0;
    const colW = ncols.map((x, i) => { const w = i === ncols.length - 1 ? C - x0 : Math.round(((x.width || 404) + 14) / wsum * C); x0 += w; return w; });
    const rows = sb ? R - 3 : R, rowPx = 786 / R;   // 800 px Designhöhe
    const DEF = { light: 'fill', weather: 206, heating: 405, air: 108, floorplan: 'fill', audio: 232 };
    const frames = [];
    let cx = 0;
    ncols.forEach((col, ci) => {
      const items = (col.modules || []).map(it => typeof it === 'string' ? { module: it } : it).filter(it => it && (it.card || (mod[it.module] && has[it.module])));
      const size = it => { const hh = it.height ?? (it.card ? 'fill' : DEF[it.module]); return hh === 'fill' || hh == null ? null : hh === 'auto' ? Math.round((DEF[it.module] === 'fill' ? 405 : DEF[it.module] + 14) / rowPx) : Math.max(2, Math.round((hh + 14) / rowPx)); };
      const fixed = items.map(size), nFill = fixed.filter(v => v == null).length, used = fixed.reduce((s, v) => s + (v || 0), 0);
      const fillH = nFill ? Math.max(2, Math.floor((rows - used) / nFill)) : 0;
      let y = nFill ? 0 : rows - used;   // ohne "fill" unten bündig wie bisher
      items.forEach((it, i) => {
        const h = fixed[i] ?? fillH;
        const m = it.card ? { type: 'card', card: it.card } : mod[it.module]();
        frames.push({ x: cx + 1, y: Math.max(0, y) + 1, w: colW[ci], h, modules: [m] });
        y += h;
      });
      cx += colW[ci];
    });
    if (sb) frames.push({ x: 1, y: R - 2, w: C, h: 3, padding: 0, modules: [{ type: 'statusbar', alarm: o.alarm, calendar: o.calendar, persons: o.persons }] });
    return frames;
  }

  connectedCallback() {
    if (!this._built) this._build();
    RP_PANELS.add(this);
    if (!this._wkBg && this._hass && this._bgSide()) this._wkBg = wkSub(this._hass, () => this._bgApply());
    this._ro = new ResizeObserver(() => this._fit()); this._ro.observe(this);
    this._onResize = () => this._fit(); window.addEventListener('resize', this._onResize);
    requestAnimationFrame(() => this._fit());
    this._tick(); clearInterval(this._clock); this._clock = setInterval(() => this._tick(), 10000);
  }
  disconnectedCallback() {
    clearInterval(this._clock); this._ro && this._ro.disconnect(); clearTimeout(this._bgT);
    if (this._wkBg) { this._wkBg(); this._wkBg = null; }
    window.removeEventListener('resize', this._onResize);
  }

  // Raum-Kürzel dieses Dashboards (raum: bu) – sonst aus der Adresse /<kürzel>-wall-panel
  _raum() { return (this._raw && this._raw.raum) ? String(this._raw.raum).toLowerCase() : pathRaum(); }
  // Tablet in der Klingel-Geräteliste als "<browser-id>@<kürzel>" eintragen (höchstens alle 60 s prüfen)
  _regRaum(h) {
    const r = this._raum(), me = bmMe(); if (!r || !me || !h || !h.states[KL_DEVICES] || !h.callService) return;
    if (this._regAt && Date.now() - this._regAt < 60000) return;
    const all = h.states[KL_DEVICES].attributes.options || [], want = me + '@' + r;
    if (all.includes(want)) return;
    this._regAt = Date.now();
    const opts = ['–', ...all.filter(o => o && o !== '–' && o.split('@')[0] !== me), want];
    h.callService('input_select', 'set_options', { entity_id: KL_DEVICES, options: opts }).catch(e => console.warn('raum-panel Raum-Anmeldung', e));
  }
  set hass(h) {
    this._hass = h;
    this._regRaum(h);
    if (!this._wkBg && h && h.connection && this._bgSide()) this._wkBg = wkSub(h, () => this._bgApply());
    for (const m of this._mods) if (m.el) m.el.hass = h;
    for (const e of this._setEls || []) e.hass = h;
    if (this._bmEl) this._bmEl.hass = h;
    const b = this.$ && this.$('edbtn');
    if (b) b.hidden = !(this._c.editor && h && h.user && h.user.is_admin);
    if (this._zoomed != null) this._zoomBar();
  }

  _ovlHost() { return this.shadowRoot.getElementById('ovlhost'); }

  _build() {
    const c = this._c; if (!c) return;
    const bg = c.background, sky = bg.mode !== 'off';
    this.shadowRoot.innerHTML = `<style>${CSS}${PANEL_CSS}${RP_EDITOR_CSS}</style>
<div class="pstage${bg.animate ? '' : ' calm'}" id="stage" style="${sky ? `--pa1:${bg.opacity};--pa2:${Math.min(1, bg.opacity + .1)};--pbf:blur(${bg.blur}px) saturate(1.25)` : 'background:linear-gradient(180deg,#1b1c20,#111215)'}">
 <div class="bgimg" id="bgimg"></div>
 ${sky ? `<div class="sky${bg.animate ? '' : ' still'}" id="sky"><i class="wash" id="wash"></i>${AURORA.map((d, n) => `<i class="au a${n + 1}"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="rp-ag${n}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="currentColor" stop-opacity="0"/><stop offset=".18" stop-color="currentColor" stop-opacity="1"/><stop offset=".45" stop-color="currentColor" stop-opacity=".72"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient><linearGradient id="rp-ah${n}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".28" stop-color="#fff"/><stop offset=".72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="rp-am${n}"><rect width="100" height="100" fill="url(#rp-ah${n})"/></mask></defs><path d="${d}" fill="url(#rp-ag${n})" mask="url(#rp-am${n})"/></svg></i>`).join('')}</div>` : ''}
 <div class="cel" id="cel"><i class="cgr" id="cgr"></i><canvas id="stars"></canvas><i class="sunb" id="sunb"></i>
  <svg class="moonb" id="moonb" viewBox="-50 -50 100 100"><defs><radialGradient id="rp-mg" cx="35%" cy="35%" r="75%"><stop offset="0" stop-color="#fbf8ee"/><stop offset="1" stop-color="#c9c4b4"/></radialGradient><clipPath id="rp-mc"><path id="mlitc"/></clipPath></defs>
   <circle r="46" fill="#1b1f27" opacity=".55"/><g id="mrot"><path id="mlit" fill="url(#rp-mg)"/><g clip-path="url(#rp-mc)" fill="#8f8a7c" opacity=".35"><circle cx="-14" cy="-12" r="9"/><circle cx="12" cy="10" r="12"/><circle cx="-6" cy="18" r="6"/><circle cx="20" cy="-18" r="5"/><circle cx="-24" cy="6" r="5"/></g></g></svg>
  <i class="cdk"></i></div>
 <canvas class="grid-dbg" id="dbg"${c.debug ? '' : ' hidden'}></canvas><canvas class="grid-num" id="dbgn"${c.debug ? '' : ' hidden'}></canvas>
 <div class="frames" id="frames"></div>
 <div class="spop" id="setpop" hidden><div class="swin plate" id="swin">
  <div class="sbar"><div class="snav"><div class="sbtn" data-s="back" title="Zurück">${IC.back}</div><div class="sbtn" data-s="fwd" title="Vor">${IC.fwd}</div></div>
   <div class="scrumb" id="scrumb"></div><div class="sbtn sx" data-s="close" title="Schließen">${IC.close}</div></div>
  <div class="stabs" id="stabs"></div>
  <div class="sbody" id="sbody"></div>
 </div></div>
 <div class="spop" id="bmpop" hidden><div class="swin plate" id="bmwin">
  <div class="sbar"><div class="scrumb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="6.5" height="15" rx="1.6"/><rect x="13.5" y="6" width="6.5" height="15" rx="1.6"/><path d="M6.5 6V4h1.5v2M16 6V4h1.5v2"/></svg><b>Batterien</b><span style="font-weight:600;letter-spacing:1.2px">· niedrigster Stand zuerst</span></div><div class="sbtn sx" data-b="close" title="Schließen">${IC.close}</div></div>
  <div class="sbody"><div class="spage" id="bmbody"></div></div>
 </div></div>
 <div class="ovlhost" id="ovlhost"></div>
 ${RP_EDITOR_HTML}
</div>`;
    this.$ = id => this.shadowRoot.getElementById(id);
    this._setInit();
    this._bmInit();
    this._edInit();
    this._built = true;
    this._skyOn = false; this._bgKey = null;
    this._buildFrames();
    this._bgApply();
    this._tick();
  }

  // Rahmen + Module (neu) aufbauen – auch vom Editor nach Änderungen aufgerufen
  _buildFrames() {
    const c = this._c, host = this.$('frames'); if (!host) return;
    const all = c.frames.flatMap(f => (f.modules || []).map(m => typeof m === 'string' ? { type: m } : m));
    const contacts = all.filter(m => m.type === 'floorplan').flatMap(m => (m.floorplan || m).contacts || []);
    const players = all.filter(m => m.type === 'audio').flatMap(m => (m.media || m).players || []);
    this._zpreClear();
    host.innerHTML = '';
    this._mods = []; this._frames = []; this._zoomed = null;
    if (c.zoom) this._zoomInit(host);
    c.frames.forEach((f, fi) => {
      const fr = document.createElement('div');
      // Statusleiste mit Start-Taste zeichnet ihr Glas selbst (zwei getrennte Platten)
      const fm = (f.modules || []).map(m => typeof m === 'string' ? { type: m } : m || {});
      // freie Form (ecken:) oder freie Anordnung (layout: custom): normales Glas des Rahmens, Leiste ohne eigene Platten
      const sbFree = fm.length === 1 && fm[0].type === 'statusbar' && (!!polyPts(f) || fm[0].layout === 'custom' || !!fm[0].elements);
      const selfGlass = f.glass == null && !sbFree && fm.length === 1 && fm[0].type === 'statusbar' && Array.isArray(fm[0].items) && fm[0].items.includes('settings') && !fm[0].voll && !fm[0].full;
      fr.className = 'frame' + (f.glass === false || selfGlass ? '' : ' plate');
      const body = document.createElement('div'); body.className = 'fb';
      body.style.flexDirection = f.direction === 'row' ? 'row' : 'column';
      fr.appendChild(body);
      (f.modules || []).forEach(m0 => {
        const m = typeof m0 === 'string' ? { type: m0 } : (m0 || {});
        const slot = document.createElement('div'); slot.className = 'pslot';
        body.appendChild(slot);
        const rec = { cfg: m, slot, frame: f };
        this._mods.push(rec);
        try {
          if (m.type === 'card') {
            // Karte mit Bausteinen (rpTeile) → frei anordnbar wie ein eigenes Modul; noch nicht geladen → erst abwarten
            const tag = extTag(m);
            if (extOk(tag)) this._mountExt(rec);
            else if (tag && !customElements.get(tag)) customElements.whenDefined(tag).then(() => { if (!rec.slot.isConnected || rec.el) return; rec.slot.replaceChildren(); if (extOk(tag)) { this._mountExt(rec); this._fit(); if (this._editing) this._edOverlays(); } else this._mountCard(rec); });
            else this._mountCard(rec);
          } else {
            const tag = MODULES[m.type] || (m.type && m.type.startsWith('custom:') ? m.type.slice(7) : null);
            if (!tag) throw new Error(`Unbekanntes Modul: ${m.type}`);
            const el = document.createElement(tag);
            el.dataset.inpanel = '1';
            let cfg = m;
            if (m.type === 'statusbar') cfg = L({ contacts, players, has_settings: this.hasSettings(), battery: this._raw.battery, eigenes_glas: !sbFree }, m);   // battery auch auf Panel-Ebene (Statusleiste als gemeinsame Datei)
            el.setConfig(cfg);
            if (this._hass) el.hass = this._hass;
            slot.appendChild(el); rec.el = el;
          }
        } catch (e) { slot.innerHTML = `<div class="xerr">${String(e.message || e)}</div>`; }
      });
      if (!(f.modules || []).length) body.innerHTML = '<div class="edempty">Leerer Rahmen</div>';
      host.appendChild(fr);
      this._frames.push({ el: fr, cfg: f });
      if (c.zoom && f.zoom !== false && !fm.every(m => m.type === 'statusbar')) this._zoomBind(fr, fi);
    });
    if (this._editing) this._edOverlays();
    this._fit();
    this._zpreSchedule();
  }

  // ---- zoom: Doppeltipp macht eine Karte zum Vollbild ------------------------------------------
  // Form wird zum Bildschirm-Rechteck animiert; Module bekommen den ganzen Platz und ihre
  // Vollbild-Konfiguration (Modul-Schlüssel vollbild: { layout, grid, elements, … }).
  _zoomInit(host) {
    this.$('stage').classList.remove('zoomon');
    const bk = document.createElement('div'); bk.className = 'zback';
    bk.addEventListener('pointerup', ev => { ev.stopPropagation(); if (!this._edEl) this._zoomOff(); });
    host.appendChild(bk); this._zback = bk;
    let bar = this.$('zbar');
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'zbar'; bar.id = 'zbar'; bar.hidden = true;
      bar.innerHTML = '<button data-z="edit" title="Bedienelemente der Vollbild-Ansicht verschieben und vergrößern">✥ Anordnen</button><button data-z="list" title="Liste ein-/ausblenden">☰ Liste</button><button data-z="side" title="Liste auf die andere Seite">⇆</button><button data-z="close" title="Schließen">✕</button>';
      bar.addEventListener('click', e => {
        const b = e.target.closest('button[data-z]'); if (!b) return; const z = b.dataset.z, sd = this.$('edside');
        if (z === 'close') this._zoomOff();
        else if (z === 'edit') this._zoomEdStart();
        else if (z === 'list') { sd.hidden = !sd.hidden; this._zoomBar(); }
        else if (z === 'side') { sd.classList.toggle('zleft'); this._zoomBar(); }
      });
      this.$('stage').appendChild(bar);
    }
    if (!this._zoomKey) { this._zoomKey = e => { if (e.key === 'Escape' && this._zoomed != null && !this._edEl) this._zoomOff(); }; window.addEventListener('keydown', this._zoomKey); }
  }
  // Zeitfenster für den Doppeltipp (ms): Einstellungen → Allgemein → Haus (input_number), sonst YAML zoom.doppeltipp, sonst 300
  _zoomDt() {
    const h = this._hass, s = h && h.states[ZOOM_DT], v = s ? Number(s.state) : NaN;
    return isFinite(v) && v > 0 ? v : Number(this._c.zoom && this._c.zoom.doppeltipp) || 300;
  }
  // Tipp auf ein Bedienelement (Taste, Regler, Schieber, Eingabe …)? – zählt nie als Doppeltipp
  _zoomCtl(ev, fr) {
    // Einstellungen → Allgemein → Haus: „Tasten und Regler ignorieren“ (aus = auch dort vergrößert ein Doppeltipp)
    const ig = this._hass && this._hass.states[ZOOM_IGN]; if (ig && ig.state === 'off') return false;
    for (const n of ev.composedPath()) {
      if (n === fr) return false;
      if (n.nodeType !== 1) continue;
      if (n.hasAttribute('data-act') || n.hasAttribute('data-step') || n.classList.contains('dwrap') || n.classList.contains('pmw') || n.classList.contains('fader') || n.classList.contains('knob')) return true;
      if (/^(BUTTON|INPUT|SELECT|TEXTAREA|A|HA-SLIDER|HA-SWITCH|HA-ICON-BUTTON|MWC-BUTTON|HA-BUTTON)$/.test(n.tagName)) return true;
      const r = n.getAttribute('role'); if (r === 'button' || r === 'slider' || r === 'switch') return true;
    }
    return false;
  }
  // Einfacher Tipp geht normal an das Modul; der zweite Tipp eines Doppeltipps wird abgefangen (schaltet also nichts ein zweites Mal)
  _zoomBind(fr, fi) {
    let last = null, down = null, eat = false, eatT;
    const swallow = ev => { if (eat) { ev.stopPropagation(); if (ev.cancelable) ev.preventDefault(); } };
    fr.addEventListener('pointerdown', ev => {
      if (this._editing || this._edEl || this._zRun || !ev.isPrimary) return;
      if (this._zoomed === fi) this._zoomTouch();
      if (this._zoomCtl(ev, fr)) { last = down = null; eat = false; return; }
      if (last && ev.timeStamp - last.t < this._zoomDt() && Math.hypot(ev.clientX - last.x, ev.clientY - last.y) < 45) {
        last = down = null; eat = true; clearTimeout(eatT); eatT = setTimeout(() => { eat = false; }, 600);
        swallow(ev);
        if (this._zoomed === fi) this._zoomOff(); else this._zoomOn(fi);
        return;
      }
      eat = false; down = { t: ev.timeStamp, x: ev.clientX, y: ev.clientY };
    }, true);
    fr.addEventListener('pointermove', ev => { if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 20) down = last = null; }, true);
    fr.addEventListener('pointerup', ev => {
      if (eat) return swallow(ev);
      // nur kurze Tipps ohne Ziehen zählen als erster Tipp
      last = down && ev.timeStamp - down.t < Math.max(250, this._zoomDt()) ? { t: ev.timeStamp, x: down.x, y: down.y } : null; down = null;
    }, true);
    ['pointercancel', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'dblclick'].forEach(t => fr.addEventListener(t, swallow, true));
  }
  // Modul-Konfiguration für die Vollbild-Ansicht: ohne width/height/align, vollbild: darübergelegt
  _zoomCfg(m) {
    const v = m.vollbild || {}, c = Object.assign({}, m, v);
    delete c.vollbild; delete c.width; delete c.height; delete c.align;
    if (v.layout === 'custom' || v.elements) { delete c.show; delete c.hide; }
    else if (v.layout) { delete c.elements; delete c.grid; }
    return c;
  }
  _zoomMods(fi, on) {
    const f = this._c.frames[fi];
    for (const rec of this._mods) if (rec.frame === f && rec.el && rec.el.setConfig && this._isMod(rec)) {
      // vorbereitete Vollbild-Ansicht einsetzen bzw. zurücktauschen (kein Neuaufbau beim Doppeltipp)
      const pre = on && this._zPre && this._zPre.get(rec);
      if (pre && pre.el.isConnected) { rec._orig = rec.el; rec.slot.replaceChild(pre.el, rec.el); rec.el = pre.el; if (this._hass) pre.el.hass = this._hass; continue; }
      if (!on && rec._orig) { const z = rec.el; rec.slot.replaceChild(rec._orig, z); rec.el = rec._orig; rec._orig = null; if (this._hass) rec.el.hass = this._hass; const w = this._zPre && this._zPre.get(rec); if (w) w.wrap.appendChild(z); continue; }
      try { rec.el.setConfig(on ? this._zoomCfg(rec.cfg) : rec.cfg); } catch (e) { console.warn('raum-panel zoom', e); }
    }
  }
  // Leistungsanzeige (Einstellungen → Erscheinungsbild → Leistung): Bilder/s, längstes Bild, Hänger, blockierte Zeit – je 5 s
  _fpsSet(on) {
    if (!on) { if (this._fps) { cancelAnimationFrame(this._fps.raf); if (this._fps.po) this._fps.po.disconnect(); this._fps.el.remove(); this._fps = null; } return; }
    if (this._fps || !this.$('stage')) return;
    const el = document.createElement('div'); el.className = 'rpfps'; this.$('stage').appendChild(el);
    const F = this._fps = { el, fr: [], lt: [], last: performance.now(), shown: 0 };
    try { F.po = new PerformanceObserver(l => l.getEntries().forEach(e => F.lt.push([performance.now(), e.duration]))); F.po.observe({ type: 'longtask' }); } catch (e) { F.po = null; }
    const loop = now => {
      F.fr.push([now, now - F.last]); F.last = now;
      const t0 = now - 5000; while (F.fr.length && F.fr[0][0] < t0) F.fr.shift(); while (F.lt.length && F.lt[0][0] < t0) F.lt.shift();
      if (now - F.shown > 500) {
        F.shown = now; const d = F.fr.map(x => x[1]), sec = Math.max(.5, (now - F.fr[0][0]) / 1000);
        const fps = Math.round(d.length / sec), mx = Math.round(Math.max(...d)), jank = d.filter(x => x > 50).length, blk = Math.round(F.lt.reduce((s, x) => s + x[1], 0) / sec);
        const col = fps >= 50 ? '#3ddc84' : fps >= 30 ? '#ffc34d' : '#ff5a5a';
        el.innerHTML = `<b style="color:${col}">${fps} B/s</b> · längstes ${mx} ms · Hänger ${jank}${F.po ? ` · blockiert ${blk} ms/s` : ''}<small>letzte 5 s · ${devicePixelRatio}× · ${innerWidth}×${innerHeight}</small>`;
      }
      F.raf = requestAnimationFrame(loop);
    };
    F.raf = requestAnimationFrame(loop);
  }
  _zoomDur() { return Math.max(0, Number(this._c.zoom && this._c.zoom.dauer) || 0); }
  // Vollbild vorbereiten: Module jedes zoombaren Rahmens unsichtbar schon in der Vollbild-Ansicht aufbauen (nacheinander, wenn Zeit ist)
  _zpreOn() { return !!this._c.zoom && (this._bgSide() ? this._bgCfg().perf_vorab !== false : this._c.zoom.vorab !== false); }
  _zpreClear() {
    clearTimeout(this._zpreT);
    if (this._zPre) for (const [rec, w] of this._zPre) { if (rec._orig) continue; w.wrap.remove(); }
    if (this._zPreBox) this._zPreBox.remove();
    this._zPre = null; this._zPreBox = null;
  }
  _zpreSchedule() {
    if (!this._built || !this._frames) return;
    if (!this._zpreOn()) { if (this._zPre && this._zoomed == null) this._zpreClear(); return; }
    if (this._zPre || this._zpreT) return;
    this._zpreT = setTimeout(() => { this._zpreT = null; this._zpreBuild(); }, 1500);
  }
  _zpreBuild() {
    if (this._zPre || !this._zpreOn() || !this._geo) return;
    const st = this.$('stage'); if (!st) return;
    const box = document.createElement('div'); box.className = 'zpre'; st.appendChild(box);
    this._zPre = new Map(); this._zPreBox = box;
    const R = this._zoomRect(), todo = [];
    for (const { cfg: f } of this._frames) {
      if (f.zoom === false) continue;
      const recs = this._mods.filter(rec => rec.frame === f && rec.el && rec.el.setConfig && this._isMod(rec) && rec.cfg.type !== 'statusbar');
      recs.forEach(rec => todo.push([rec, recs.length]));
    }
    const next = () => {
      if (this._zPreBox !== box) return;
      const it = todo.shift(); if (!it) return;
      const [rec, n] = it;
      try {
        const wrap = document.createElement('div'); wrap.className = 'pslot';
        Object.assign(wrap.style, { width: R.W + 'px', height: (R.H / n) + 'px' });
        const el = document.createElement(rec.el.tagName.toLowerCase()); el.dataset.inpanel = '1';
        el.setConfig(this._zoomCfg(rec.cfg)); if (this._hass) el.hass = this._hass;
        wrap.appendChild(el); box.appendChild(wrap); this._zPre.set(rec, { el, wrap });
      } catch (e) { console.warn('raum-panel vorbereiten', e); }
      (window.requestIdleCallback || (f => setTimeout(f, 200)))(next, { timeout: 1500 });
    };
    next();
  }
  // Ziel-Rechteck: ganzer Bildschirm (mit Panel-Rand); beim Anordnen rechts Platz für die Seitenleiste
  _zoomRect() {
    const G = this._geo, m = G.inset + G.gap / 2;
    return { L: m, T: m, W: G.w - 2 * m, H: G.h - 2 * m };
  }
  _zoomOn(fi) {
    if (this._zoomed != null) return;
    const F = this._frames[fi], r = this._rects && this._rects[fi]; if (!F || !r || !r.geo) return;
    this._zoomed = fi;
    F.el.classList.add('zon'); this._zback.classList.add('on'); this.$('stage').classList.add('zoomon');
    this._zoomMods(fi, true);
    const geo = r.geo; this._zRun = true; this._fit();   // Module-Plätze sofort auf ganze Fläche
    this._zoomAnim(fi, geo, this._zoomRect(), () => { this._zoomPlace(); this._zoomBar(); });   // nur der gezoomte Rahmen – kein Neu-Einpassen des ganzen Panels
    this._zoomTouch();
  }
  _zoomOff() {
    const fi = this._zoomed; if (fi == null || this._zRun) return;
    if (this._edEl && this._edEl.vb) this._edElStop();
    clearTimeout(this._zoomT);
    const F = this._frames[fi], r = this._rects && this._rects[fi];
    this._zoomed = null; this._zOut = fi; this._zoomBar();
    this._zback.classList.remove('on');
    this._zoomMods(fi, false);
    const done = () => { this._zOut = null; F.el.classList.remove('zon'); this.$('stage').classList.remove('zoomon'); this._fit(); };
    if (!F || !r || !r.geo) { done(); return; }
    this._zoomAnim(fi, Object.assign({ P: null }, this._zoomRect()), r.geo, done);
  }
  // Nach "timeout" Sekunden ohne Berührung wieder verkleinern (0 = nie; nicht beim Anordnen)
  _zoomTouch() {
    clearTimeout(this._zoomT); const t = Number(this._c.zoom && this._c.zoom.timeout) || 0;
    if (t > 0) this._zoomT = setTimeout(() => { if (!this._edEl) this._zoomOff(); else this._zoomTouch(); }, t * 1000);
  }
  _zoomBar() {
    const bar = this.$('zbar'); if (!bar) return;
    const h = this._hass, admin = this._c.editor && h && h.user && h.user.is_admin;
    bar.hidden = this._zoomed == null || this._zRun;
    const vb = !!(this._edEl && this._edEl.vb), sd = this.$('edside');
    bar.classList.toggle('ed', vb && !sd.hidden && !sd.classList.contains('zleft'));
    bar.querySelector('[data-z=edit]').hidden = !admin || vb;
    bar.querySelector('[data-z=list]').hidden = !vb; bar.querySelector('[data-z=side]').hidden = !vb || sd.hidden;
    if (!vb) sd.classList.remove('zleft');
    if (vb) sd.classList.remove('off', 'left'); else this._edSideState();
  }
  // Vollbild-Lage ohne Animation (nach Größenänderung, Anordnen an/aus)
  _zoomPlace() {
    const fi = this._zoomed, F = this._frames[fi]; if (!F || !this._geo) return;
    const R = this._zoomRect();
    Object.assign(F.el.style, { left: R.L + 'px', top: R.T + 'px', width: R.W + 'px', height: R.H + 'px' });
    this._shape(fi, F.el, null, R.L, R.T, R.W, R.H, this._geo.u);
  }
  // Form von a nach b animieren: Ecken wandern auf die nächstliegenden Ecken des Rechtecks
  // Zoom-Animation. Standard: FLIP – Rahmen sofort in Endlage/Endform, die Bewegung läuft als reine transform-Animation
  // (Web Animations, von der Grafikeinheit abgespielt → flüssig, auch wenn der Prozessor beschäftigt ist). Der Inhalt wird
  // gegenskaliert, damit er nicht verzerrt. zoom: { form: true } = alte Form-Animation (Ecken wandern, je Bild neu berechnet).
  _zoomAnim(fi, a, b, done) {
    const el = this._frames[fi].el, G = this._geo, u = G.u;
    const dur = this._zoomDur();
    if (this._c.zoom && this._c.zoom.form) return this._zoomMorph(fi, a, b, done);
    this._zRun = true; this._zoomBar();
    CD_HOLD++;
    // Endlage + Endform sofort
    Object.assign(el.style, { left: b.L + 'px', top: b.T + 'px', width: b.W + 'px', height: b.H + 'px' });
    this._shape(fi, el, b.P || null, b.L, b.T, b.W, b.H, u);
    // Module des Rahmens jetzt in Endgröße einpassen (nicht erst asynchron) – sonst springt der Inhalt während der Bewegung
    const fr = this._c.frames[fi]; for (const rec of this._mods || []) if (rec.frame === fr && rec.el && rec.el._fit) { try { rec.el._fit(); } catch (e2) { /* Modul ohne Inhalt */ } }
    const body = el.firstElementChild, sh = el._rpSh;
    const fin = () => {
      this._zRun = false; el.classList.remove('zanim'); if (sh) { sh.classList.remove('zanim'); sh.style.zIndex = ''; }
      el.style.willChange = ''; if (body) body.style.willChange = '';
      cdRelease(); done(); this._zoomBar();
    };
    if (!dur || !el.animate) { fin(); return; }
    // Startlage als Transformation der Endlage; Inhalt gleichmäßig (Seitenverhältnis bleibt)
    const sx = a.W / b.W, sy = a.H / b.H, tx = a.L - b.L, ty = a.T - b.T;
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, N = 20, kf = [], kb = [];
    for (let i = 0; i <= N; i++) {
      const k = ease(i / N), X = sx + (1 - sx) * k, Y = sy + (1 - sy) * k, sc = Math.min(X, Y);
      kf.push({ transform: `translate(${(tx * (1 - k)).toFixed(2)}px,${(ty * (1 - k)).toFixed(2)}px) scale(${X.toFixed(5)},${Y.toFixed(5)})` });
      kb.push({ transform: `scale(${(sc / X).toFixed(5)},${(sc / Y).toFixed(5)})` });
    }
    el.classList.add('zanim'); if (sh) { sh.classList.add('zanim'); sh.style.zIndex = 20; }   // Schatten/Kante erst in Endlage zeigen
    el.style.transformOrigin = '0 0'; el.style.willChange = 'transform';
    if (body) { body.style.transformOrigin = '50% 50%'; body.style.willChange = 'transform'; body.animate(kb, { duration: dur, easing: 'linear' }); }
    const an = el.animate(kf, { duration: dur, easing: 'linear' });
    an.onfinish = an.oncancel = fin;
  }
  // alte Form-Animation (zoom.form: true): Ecken wandern je Bild; Inhalt in Endgröße, nur skaliert
  _zoomMorph(fi, a, b, done) {
    const el = this._frames[fi].el, G = this._geo, u = G.u, rp = R => [[0, 0], [R.W, 0], [R.W, R.H], [0, R.H]];
    const poly = a.P || b.P, n = poly ? poly.length : 4;
    const abs = (R, P) => P.map(([x, y]) => [R.L + x, R.T + y]);
    const toRect = (R, src, Rs) => src.map(([x, y]) => { const nx = (x / Rs.W) < .5 ? 0 : 1, ny = (y / Rs.H) < .5 ? 0 : 1; return [R.L + nx * R.W, R.T + ny * R.H]; });
    const A = a.P ? abs(a, a.P) : b.P ? toRect(a, b.P, b) : abs(a, rp(a));
    const B = b.P ? abs(b, b.P) : a.P ? toRect(b, a.P, a) : abs(b, rp(b));
    const dur = this._zoomDur(), t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    if (el._rpSh) el._rpSh.style.zIndex = 20;
    this._zRun = true; this._zoomBar();
    const body = el.firstElementChild, BP = ['width', 'height', 'flex', 'transform', 'transformOrigin', 'willChange'];
    Object.assign(el.style, { left: b.L + 'px', top: b.T + 'px', width: b.W + 'px', height: b.H + 'px' });
    const bw = body ? body.offsetWidth : 0, bh = body ? body.offsetHeight : 0, pad = parseFloat(el.style.padding) || 0;
    if (body && bw && bh) Object.assign(body.style, { width: bw + 'px', height: bh + 'px', flex: 'none', transformOrigin: '0 0', willChange: 'transform' });
    CD_HOLD++; el.classList.add('zanim'); if (el._rpSh) el._rpSh.classList.add('zanim');
    const step = now => {
      const t = dur ? clamp((now - t0) / dur, 0, 1) : 1, k = ease(t), lr = (x, y) => x + (y - x) * k;
      const L0 = lr(a.L, b.L), T0 = lr(a.T, b.T), W0 = lr(a.W, b.W), H0 = lr(a.H, b.H);
      Object.assign(el.style, { left: L0 + 'px', top: T0 + 'px', width: W0 + 'px', height: H0 + 'px' });
      if (body && bw && bh) { const s = Math.min((W0 - 2 * pad) / bw, (H0 - 2 * pad) / bh); body.style.transform = `translate(${((W0 - 2 * pad - bw * s) / 2).toFixed(1)}px,${((H0 - 2 * pad - bh * s) / 2).toFixed(1)}px) scale(${s.toFixed(4)})`; }
      const P = A.map((p, i) => [lr(p[0], B[i][0]) - L0, lr(p[1], B[i][1]) - T0]);
      if (t < 1) el.style.clipPath = n ? `path("${polyPath(P, 20 * u)}")` : '';
      else this._shape(fi, el, n ? P : null, L0, T0, W0, H0, u);
      if (el._rpSh) el._rpSh.style.zIndex = 20;
      if (t < 1) { requestAnimationFrame(step); return; }
      this._zRun = false;
      if (body) BP.forEach(k2 => { body.style[k2] = ''; });
      el.classList.remove('zanim'); if (el._rpSh) el._rpSh.classList.remove('zanim'); cdRelease();
      if (el._rpSh) el._rpSh.style.zIndex = '';
      done(); this._zoomBar();
    };
    requestAnimationFrame(step);
  }
  // Bedienelemente der Vollbild-Ansicht anordnen (Element-Editor, schreibt in vollbild:)
  _zoomEdStart(mi = 0) {
    const fi = this._zoomed; if (fi == null) return;
    const f = this._c.frames[fi], mods = (f.modules || []).map((m, i) => [m, i]).filter(([m, i]) => m && typeof m === 'object' && this._edParts(m, this._edRec(fi, i)));
    if (!mods.length) return;
    mi = mods.some(([, i]) => i === mi) ? mi : mods[0][1];
    this._edEl = { fi, mi, sel: null, vb: true };
    this._zoomPlace();
    const rec = this._edRec(fi, mi), m = this._edMod(fi, mi);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!(m.layout === 'custom' && m.elements) && rec && rec.el && rec.el._toElements) {
        // Startpunkt = jetzige Vollbild-Anordnung, Raster danach auf die ganze Fläche erweitert
        rec.el._fit(); const d = rec.el._toElements();
        Object.assign(m, { layout: 'custom', grid: d.grid, elements: d.elements });
        this._zoomFitGrid(m, rec);
      }
      this.$('stage').classList.add('edelmode');
      this.$('edside').hidden = false; this.$('edside').classList.remove('zleft');
      this._edElApply(); this._edElSide(); this._zoomBar();
    }));
  }
  // Raster des Vollbild-Layouts an die Fläche anpassen: gleiche Spaltenbreite/Zeilenhöhe, mehr Spalten bzw. Reihen
  // A = Seitenverhältnis der Fläche (fehlt = Vollbild-Rechteck)
  _zoomFitGrid(m, rec, A0) {
    const R = this._zoomRect(), G = this._geo, el = rec && rec.el; if (!el || !G) return;
    const P = Number(m.padding ?? (this._c.frames[this._edEl.fi].modules[this._edEl.mi] || {}).padding ?? 8);
    const pad = this._c.frames[this._edEl.fi].padding ?? this._c.grid.frame_padding;
    const A = Math.max(.2, A0 || (R.W - 2 * pad * G.u) / Math.max(1, R.H - 2 * pad * G.u));   // Seitenverhältnis der Fläche
    const g = m.grid = Object.assign({ columns: 12, row_height: 20, gap: 6 }, m.grid);
    const els = Object.values(m.elements || {}), W0 = Number(g.width) || Object.values(el.variants())[0].bw;
    const pitch = (W0 + g.gap) / g.columns, used = Math.max(1, ...els.map(e => (e.row || 1) + (e.h || 1) - 1)), usedC = Math.max(1, ...els.map(e => (e.col || 1) + (e.w || 1) - 1));
    let rows = Math.max(used, Number(g.rows) || 0), H = rows * (g.row_height + g.gap) - g.gap, W = A * (H + 2 * P) - 2 * P;
    let cols = Math.max(usedC, Math.round((W + g.gap) / pitch));
    if (cols * pitch - g.gap < W0 && cols <= g.columns) { cols = g.columns; W = W0; rows = Math.max(used, Math.round(((W + 2 * P) / A - 2 * P + g.gap) / (g.row_height + g.gap))); }
    else W = cols * pitch - g.gap;
    Object.assign(g, { columns: cols, width: Math.round(W), rows });
  }
  _zoomEdStop() {
    this._edElStop();
    this.$('edside').hidden = !this._editing;
    this._zoomPlace(); this._zoomBar(); this._zoomTouch();
  }
  // YAML nur für den vollbild:-Block des Moduls (wird unter "- type: …" eingefügt)
  _zoomYaml() {
    const E = this._edEl; if (!E) return;
    const m0 = this._c.frames[E.fi].modules[E.mi], f = this._c.frames[E.fi];
    const v = E.vb ? { vollbild: m0.vollbild || {} } : { layout: 'custom', ...(m0.grid ? { grid: m0.grid } : {}), elements: m0.elements || {} };
    const ind = this._zInd ?? 16, body = edIndent(toYaml(v, 0).replace(/^\n\s*/, ''), ind);
    const md = this.$('edmodal');
    md.innerHTML = `<div class="edmbox"><b style="color:#9fd8ff">YAML für ${E.vb ? 'die Vollbild-Ansicht' : 'die Anordnung auf dem Dashboard'}</b>
      <div class="r"><span>Rahmen #${E.fi + 1}${f.name ? ' „' + escH(f.name) + '“' : ''} · Modul ${escH(ED_NAMES[m0.type] || m0.type)}</span>
      <label style="margin-left:auto">Einrückung <input type="number" id="zind" min="0" max="30" value="${ind}"></label></div>
      <textarea id="edyaml" readonly spellcheck="false"></textarea>
      <div class="ednote">In deiner Dashboard-Datei unter „- type: ${escH(m0.type)}“ dieses Rahmens einfügen (gleiche Einrückung wie dessen andere Schlüssel, z. B. „width:“). ${E.vb ? 'Einen vorhandenen „vollbild:“-Block dabei ersetzen.' : 'Vorhandene Zeilen „layout:“, „grid:“, „elements:“ dabei ersetzen und „show:“/„hide:“ dieses Moduls löschen.' + (E.full ? ' Außerdem „width:“, „height:“ und „align:“ dieses Moduls löschen (ganzer Rahmen).' : '')}</div>
      <div class="r"><button class="pri" data-ed="copy">In Zwischenablage kopieren</button><button data-ed="close">Schließen</button><span id="edcopied" style="color:#3ddc84"></span></div></div>`;
    md.hidden = false;
    this.$('edyaml').value = body;
    this.$('zind').addEventListener('input', e => { this._zInd = clamp(Number(e.target.value) || 0, 0, 30); this.$('edyaml').value = edIndent(toYaml(v, 0).replace(/^\n\s*/, ''), this._zInd); });
  }

  // Fremde Karte mit Bausteinen (Brücke, siehe RPExtCard)
  _mountExt(rec) {
    const el = document.createElement('rp-extcard'); el.dataset.inpanel = '1';
    el.setConfig(rec.cfg); if (this._hass) el.hass = this._hass;
    rec.slot.appendChild(el); rec.el = el;
  }
  // Bausteine eines Moduls für den Editor: eingebaute Module feste Liste, fremde Karten ihre angemeldeten Teile
  _edParts(m, rec) {
    if (!m) return null;
    if (rec && rec.el && rec.el.edParts) return rec.el.edParts();
    if (ED_PARTS[m.type]) return ED_PARTS[m.type];
    return m.type === 'card' && rec && rec.el && rec.el._ext ? rec.el.partNames() : null;
  }
  // Einstellungen, die eine Brücken-Karte anmeldet (static rpOptionen: { schlüssel: { name, typ: auswahl|zahl|schalter|text,
  //   werte, min, max, schritt, standard, hinweis } }) – Werte landen unter card:, Standardwert = Schlüssel entfernen
  // Grundriss-Modul (Ausschnitt aus haus-grundriss): Ansicht 2D/3D, halbe Wände, Blickrichtung, Werte unten …
  _edFloorOpts(m, mi) {
    const fp = m.floorplan || {}, g = k => m[k] ?? fp[k], a = s => escH(String(s ?? ''));
    const selK = (k, v, opts) => `<select data-k="m.${mi}.${k}">${opts.map(([w, n]) => `<option value="${a(w)}"${String(v ?? '') === String(w) ? ' selected' : ''}>${a(n)}</option>`).join('')}</select>`;
    const chk = (k, on) => `<input type="checkbox" data-k="m.${mi}.${k}"${on ? ' checked' : ''}>`;
    const r = (l, c, tip) => `<div class="edrow"${tip ? ` title="${a(tip)}"` : ''}><label>${l}</label>${c}</div>`;
    return `<div class="ednote" style="margin:6px 0 2px">Grundriss-Ausschnitt:</div>
      ${r('Ausschnitt', `<input type="text" data-k="m.${mi}.ausschnitt" value="${a(g('ausschnitt'))}" placeholder="z. B. bu_sector1">`, 'ID des Ausschnitts aus dem Haus-Grundriss')}
      ${r('Ansicht', selK('ansicht', g('ansicht'), [['', '2D (Grundriss)'], ['3d', '3D']]))}
      ${r('Halbe Wände (3D)', chk('halbe_waende', g('halbe_waende') !== false), 'Wände in halber Höhe – man sieht in den Raum')}
      ${r('Wandschnitt (3D)', selK('wand_schnitt', g('wand_schnitt'), [['', 'hinterste Wände voll, Rest abgeschnitten'], ['halb', 'alle Wände abgeschnitten']]), 'Wie die Wände bei „Halbe Wände“ abgeschnitten werden')}
      ${r('Blickrichtung (3D)', selK('blick3d', g('blick3d'), [['', 'auf das Tablet (Standard)'], ['norden', 'Norden oben'], ['90', 'Osten oben'], ['180', 'Süden oben'], ['270', 'Westen oben']]))}
      ${r('Neigung (3D) °', `<input type="number" data-k="m.${mi}.neigung" value="${a(g('neigung'))}" placeholder="40" min="0" max="80" step="5">`, '0 = senkrecht von oben')}
      <div class="ednote" style="margin:8px 0 2px">Gebäude (Mehrfamilienhaus, 3D):</div>
      ${r('Gebäude', selK('gebaeude', g('gebaeude'), [['', 'aus'], ['etage', 'eure Etage'], ['haus', 'ganzes Haus']]), 'Nachbarwohnungen, Treppenhaus, Nachbarhaus um den Raum – lagegerecht')}
      ${r('Nachbarhaus', selK('nachbarhaus', g('nachbarhaus'), [['', 'wie im Haus-Grundriss'], ['an', 'zeigen'], ['glas', 'als Glasrahmen'], ['aus', 'ausblenden']]))}
      ${r('Andere Wohnungen', selK('nachbarwohnungen', g('nachbarwohnungen'), [['', 'wie im Haus-Grundriss'], ['an', 'zeigen'], ['glas', 'als Glasrahmen'], ['aus', 'ausblenden']]), 'inkl. Treppenhaus und Dächer des eigenen Hauses')}
      ${r('Nur dieser Raum', selK('nur_raum', g('nur_raum'), [['', 'automatisch (mit Gebäude: ja)'], ['true', 'ja – Raum schwebt an seiner Stelle'], ['false', 'nein – ganze Wohnung']]), 'Andere Räume der Wohnung weglassen; der Raum steht in seiner echten Höhe über dem Gelände')}
      ${r('Werte unter dem Grundriss', chk('werte_unten', g('werte_unten') !== false), 'Ist/Soll-Temperatur, Luftfeuchte, Luftqualität des Raums als Leiste unten')}
      ${r('Umschalt-Knöpfe im Grundriss', chk('knopf3d', g('knopf3d') === true), '2D/3D, ½, Zurücksetzen direkt im Grundriss')}
      ${r('Raumnamen im Plan', chk('raumnamen', g('raumnamen') === true))}`;
  }
  _edCardOpts(m, mi) {
    const tag = extTag(m), K = extOk(tag) ? customElements.get(tag) : null, O = (K && K.rpOptionen) || {};
    const ks = Object.keys(O); if (!ks.length) return '';
    const cd = m.card || {}, a = s => escH(String(s ?? ''));
    return `<div class="ednote" style="margin:6px 0 2px">Einstellungen der Karte:</div>` + ks.map(k => {
      const o = O[k] || {}, v = cd[k] ?? o.standard, dk = `data-k="m.${mi}.card.${k}" data-std="${a(o.standard)}"`;
      let ctl;
      if (o.typ === 'auswahl') ctl = `<select ${dk}>${(o.werte || []).map(w => [].concat(w)).map(([w, n]) => `<option value="${a(w)}"${String(v) === String(w) ? ' selected' : ''}>${a(n ?? w)}</option>`).join('')}</select>`;
      else if (o.typ === 'schalter') ctl = `<input type="checkbox" ${dk}${v === false ? '' : ' checked'}>`;
      else if (o.typ === 'zahl') ctl = `<input type="number" ${dk} value="${a(cd[k])}" placeholder="${a(o.standard)}"${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.schritt != null ? ` step="${o.schritt}"` : ''}>`;
      else ctl = `<input type="text" ${dk} value="${a(cd[k])}" placeholder="${a(o.standard)}">`;
      return `<div class="edrow"${o.hinweis ? ` title="${a(o.hinweis)}"` : ''}><label>${a(o.name || k)}</label>${ctl}</div>`;
    }).join('');
  }
  // Modul, das sich per setConfig umbauen lässt (eingebaut oder fremde Karte mit Bausteinen)
  _isMod(rec) { return rec.cfg.type !== 'card' || !!(rec.el && rec.el._ext); }
  // Beliebige HA-Karte als Modul (z. B. Mushroom)
  _mountCard(rec) {
    const host = document.createElement('div'); host.className = 'xcard'; rec.slot.appendChild(host);
    const make = async () => {
      try {
        const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
        if (!helpers) { host.innerHTML = '<div class="xerr">Karten-Helfer nicht verfügbar</div>'; return; }
        const el = await helpers.createCardElement(rec.cfg.card || {});
        if (this._hass) el.hass = this._hass;
        host.replaceChildren(el); rec.el = el;
      } catch (e) { host.innerHTML = `<div class="xerr">${String(e.message || e)}</div>`; }
    };
    host.addEventListener('ll-rebuild', ev => { ev.stopPropagation(); make(); });
    make();
  }

  // Blockgröße aus der Bildschirmgröße, Rahmen positionieren, Module verteilen
  _fit() {
    if (!this.isConnected || !this.$ || !this._c) return;
    const g = this._c.grid;
    const top = this.getBoundingClientRect().top;
    const h = Math.max(320, window.innerHeight - Math.max(0, top) - this._c.bottom_offset);
    this.style.height = h + 'px';
    const w = this.clientWidth || 1280;
    const u = Math.min(w / 1280, h / 800);           // Maßstab für Abstände (Design: 1280×800)
    const st = this.$('stage'); st.style.setProperty('--su', u.toFixed(4));
    setLcda(st, this._c.display_transparenz);
    const gap = g.gap * u, inset = Math.max(0, g.padding * u - gap / 2);
    const bw = (w - 2 * inset) / g.columns, bh = (h - 2 * inset) / g.rows;
    this._geo = { u, gap, inset, bw, bh, w, h };
    // Position: Anker (left/center/right, top/middle/bottom) oder Spalte/Reihe – Zählung ab 1
    const pos = (v, size, n) => v === 'left' || v === 'top' ? 0 : v === 'right' || v === 'bottom' ? n - size : v === 'center' || v === 'middle' ? Math.round((n - size) / 2) : Math.round(Number(v) || 1) - 1;
    const rects = [];
    for (const [fi, { el, cfg: f }] of this._frames.entries()) {
      // ecken: freie Form auf den Rasterlinien → umschließendes Rechteck + Umriss
      const pp = polyPts(f), pts = pp && pp.map(([x, y]) => [clamp(x, 1, g.columns + 1), clamp(y, 1, g.rows + 1)]);
      let fx, fy, fw, fh;
      if (pts) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        fx = Math.min(...xs) - 1; fy = Math.min(...ys) - 1;
        fw = Math.max(1e-3, Math.max(...xs) - 1 - fx); fh = Math.max(1e-3, Math.max(...ys) - 1 - fy);
      } else {
        fw = clamp(Number(f.w ?? f.width) || g.columns, 1, g.columns); fh = clamp(Number(f.h ?? f.height) || g.rows, 1, g.rows);
        // y/row: HAs YAML liest ein einzelnes "y" als true – daher auch der Schlüssel "true"
        const fxv = f.x ?? f.col ?? f.column, fyv = f.y ?? f.row ?? f['true'];
        fx = clamp(pos(fxv, fw, g.columns), 0, g.columns - fw); fy = clamp(pos(fyv, fh, g.rows), 0, g.rows - fh);
      }
      rects.push({ el, fx, fy, fw, fh, pts });
      const L0 = inset + fx * bw + gap / 2, T0 = inset + fy * bh + gap / 2, W0 = fw * bw - gap, H0 = fh * bh - gap;
      const P0 = pts && polyInset(pts.map(([x, y]) => [inset + (x - 1) * bw - L0, inset + (y - 1) * bh - T0]), gap / 2);
      rects[rects.length - 1].geo = { L: L0, T: T0, W: W0, H: H0, P: P0 };
      // gezoomter Rahmen: Lage/Form setzt _zoomPlace bzw. die Animation
      const zf = fi === this._zoomed || fi === this._zOut;
      if (!zf) {
        Object.assign(el.style, { left: L0 + 'px', top: T0 + 'px', width: W0 + 'px', height: H0 + 'px' });
        this._shape(fi, el, P0, L0, T0, W0, H0, u);
      }
      const pad = (f.padding ?? (f.glass === false ? 0 : g.frame_padding)) * u;
      el.style.padding = pad + 'px';
      // transparenz (0–100 %): Hintergrund des Glasrahmens und eigene Flächen der Module (z. B. Statusleiste) durchscheinend;
      // Rahmen-Wert vor Panel-Wert, 0 = wie bisher
      const tp = clamp(Number(f.transparenz ?? f.transparency ?? this._c.transparenz ?? this._c.transparency) || 0, 0, 100);
      el.style.setProperty('--pt', (1 - tp / 100).toFixed(3));
      setLcda(el, f.display_transparenz);
      const body = el.firstChild, row = f.direction === 'row';
      body.style.gap = ((f.gap ?? g.gap) * u) + 'px';
      [...body.children].forEach((slot, i) => {
        const m = (f.modules || [])[i]; const sz = m && typeof m === 'object' ? m.size : null;
        // size: Zahl = Blöcke, "40%" = Anteil, fehlt/"fill" = teilt sich den Rest
        if (typeof sz === 'number') slot.style.flex = `0 0 ${(sz * (row ? bw : bh) - gap).toFixed(1)}px`;
        else if (typeof sz === 'string' && sz.endsWith('%')) slot.style.flex = `0 0 ${sz}`;
        else slot.style.flex = '1 1 0';
        // width/height: Modul kleiner als sein Platz (Zahl = Blöcke, "80%" = Anteil); align legt die Lage fest
        const child = slot.firstElementChild, mo0 = m && typeof m === 'object' ? m : {}, mo = zf ? { rand: mo0.rand, margin: mo0.margin } : mo0;
        // rand: Abstand des Moduls zu den Seiten seines Platzes (Pixel wie padding/gap, auch "5%")
        slot.style.padding = modRand(mo.rand ?? mo.margin, u);
        if (child) {
          const dim = (v, unit) => typeof v === 'number' ? (v * unit - gap).toFixed(1) + 'px' : typeof v === 'string' ? v : '';
          const cw = dim(mo.width, bw), ch = dim(mo.height, bh);
          child.style.flex = cw || ch ? 'none' : '';
          child.style.width = cw || (ch ? '100%' : ''); child.style.height = ch || (cw ? '100%' : '');
          // mit Höhe: Modul füllt seine Fläche frei (siehe RPModule._fit); Wechsel sofort anwenden
          setLcda(child, mo0.display_transparenz);
          const fx = ch ? '1' : '';
          // schriftgroesse: Vorgabe von Rahmen bzw. Panel (Modul-Wert hat Vorrang, liest das Modul selbst); nicht für Statusleiste/fremde Karten
          const sgv = mo0.type === 'statusbar' || mo0.type === 'card' ? '' : String(f.schriftgroesse ?? this._c.schriftgroesse ?? '');
          const sgc = (child.dataset.schrift || '') !== sgv; if (sgc) child.dataset.schrift = sgv;
          if ((child.dataset.fixh || '') !== fx || sgc) { child.dataset.fixh = fx; if (child._fit) child._fit(); }
          const al = String(mo.align || '');
          slot.style.justifyContent = /left/.test(al) ? 'flex-start' : /right/.test(al) ? 'flex-end' : 'center';
          slot.style.alignItems = !(cw || ch) ? 'stretch' : /top/.test(al) ? 'flex-start' : /bottom/.test(al) ? 'flex-end' : 'center';
        }
      });
    }
    this._rects = rects;
    if (this._c.debug || this._editing) {
      // Planungshilfe: jeden Rahmen mit Nummer und Lage beschriften, Überlappungen rot
      // Punkt (in Rasterlinien-Koordinaten) liegt in Rahmen r?
      const inR = (r, x, y) => r.pts ? polyIn(r.pts, x, y) : x > r.fx + 1 && x < r.fx + r.fw + 1 && y > r.fy + 1 && y < r.fy + r.fh + 1;
      const hit = (r, o) => {
        const x0 = Math.max(r.fx, o.fx), x1 = Math.min(r.fx + r.fw, o.fx + o.fw), y0 = Math.max(r.fy, o.fy), y1 = Math.min(r.fy + r.fh, o.fy + o.fh);
        if (x0 >= x1 || y0 >= y1) return false;
        if (!r.pts && !o.pts) return true;
        // freie Formen: gemeinsame Fläche abtasten (4 Proben je Block, leicht versetzt, damit keine Probe auf einer Kante liegt)
        for (let x = x0 + .1371; x < x1; x += .25) for (let y = y0 + .1173; y < y1; y += .25) if (inR(r, x + 1, y + 1) && inR(o, x + 1, y + 1)) return true;
        return false;
      };
      rects.forEach((r, i) => {
        const ov = rects.some((o, j) => j !== i && hit(r, o));
        let lb = r.el.querySelector(':scope>.dbgl');
        if (!lb) { lb = document.createElement('div'); lb.className = 'dbgl'; r.el.appendChild(lb); }
        const nm = this._c.frames[i] && this._c.frames[i].name;
        lb.textContent = `#${i + 1}${nm ? ' ' + nm : ''} · ${r.pts ? `Ecken ${polyTxt(r.pts)}` : `Spalte ${r.fx + 1} · Reihe ${r.fy + 1} · ${r.fw}×${r.fh}`}${ov ? ' · ÜBERLAPPT' : ''}`;
        r.el.classList.toggle('dbgov', ov);
      });
      this._drawGrid();
    }
    if (this._edEl) requestAnimationFrame(() => this._edElDraw());
    if (this._zoomed != null && !this._zRun) this._zoomPlace();
    this._edCorners();
    this._glint();
    if (CD_OBS.has(this.shadowRoot)) requestAnimationFrame(() => this._cdApply());
  }

  // Editor: Ziehpunkte an den Ecken des gewählten Rahmens mit freier Form (rasten auf den Rasterlinien ein)
  _edCorners() {
    const st = this.$('stage'), G = this._geo; if (!st) return;
    let lay = st.querySelector(':scope>.edcorn');
    const i = this._sel, f = this._editing && i != null ? this._c.frames[i] : null, pts = f && polyPts(f);
    if (!pts || !G) { if (lay) lay.remove(); return; }
    if (!lay) { lay = document.createElement('div'); lay.className = 'edcorn'; st.appendChild(lay); }
    const g = this._c.grid, X = c => G.inset + (c - 1) * G.bw, Y = r => G.inset + (r - 1) * G.bh;
    const setPts = np => { f.ecken = np; delete f.corners; delete f.points; this._dirty = true; this._fit(); this._edSync(); };
    const key = i + ':' + pts.length;
    if (lay._key !== key) {
      lay._key = key; lay.innerHTML = '';
      pts.forEach((_, j) => {
        const h = document.createElement('div'); h.className = 'edpt'; h.title = 'Ziehen = Ecke verschieben · Doppelklick = Ecke entfernen'; h.innerHTML = '<b></b>';
        h.addEventListener('pointerdown', ev => {
          ev.preventDefault(); ev.stopPropagation();
          try { h.setPointerCapture(ev.pointerId); } catch (e) { /* synthetische Zeiger */ }
          h.classList.add('drag');
          const mv = e => {
            const sr = st.getBoundingClientRect(), k = sr.width / G.w || 1, cur = polyPts(f) || pts;
            const c = clamp(Math.round(((e.clientX - sr.left) / k - G.inset) / G.bw) + 1, 1, g.columns + 1), r = clamp(Math.round(((e.clientY - sr.top) / k - G.inset) / G.bh) + 1, 1, g.rows + 1);
            if (!cur[j] || (cur[j][0] === c && cur[j][1] === r)) return;
            setPts(cur.map((p, q) => (q === j ? [c, r] : p)));
          };
          const up = () => { h.classList.remove('drag'); h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); this._edSide(); };
          h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
        });
        h.addEventListener('dblclick', ev => { ev.stopPropagation(); const cur = polyPts(f); if (cur && cur.length > 3) { setPts(cur.filter((_, q) => q !== j)); this._edSide(); } });
        lay.appendChild(h);
      });
      pts.forEach((_, j) => {
        const a = document.createElement('div'); a.className = 'edadd'; a.textContent = '+'; a.title = 'Neue Ecke auf dieser Kante';
        a.addEventListener('pointerdown', ev => {
          ev.preventDefault(); ev.stopPropagation();
          const cur = polyPts(f); if (!cur) return;
          const p = cur[j], q = cur[(j + 1) % cur.length], mid = [Math.round((p[0] + q[0]) / 2), Math.round((p[1] + q[1]) / 2)];
          setPts([...cur.slice(0, j + 1), mid, ...cur.slice(j + 1)]); this._edSide();
        });
        lay.appendChild(a);
      });
    }
    const hs = lay.querySelectorAll('.edpt'), as = lay.querySelectorAll('.edadd');
    pts.forEach(([x, y], j) => {
      if (!hs[j]) return;
      Object.assign(hs[j].style, { left: X(x) + 'px', top: Y(y) + 'px' }); hs[j].firstChild.textContent = `${x},${y}`;
      const [x2, y2] = pts[(j + 1) % pts.length];
      Object.assign(as[j].style, { left: X((x + x2) / 2) + 'px', top: Y((y + y2) / 2) + 'px' });
    });
  }

  // Freie Rahmenform: Umriss P (px, relativ zum Rahmen) als clip-path; Glaskante innen + Schatten außen als SVG,
  // weil clip-path box-shadow und border mit abschneidet. P = null → normales Rechteck.
  _shape(fi, el, P, L0, T0, W, H, u) {
    const old = el.querySelector(':scope>.pedge');
    if (!P) {
      if (el.classList.contains('poly')) { el.classList.remove('poly'); el.style.clipPath = ''; }
      if (old) old.remove();
      if (el._rpSh) { el._rpSh.remove(); el._rpSh = null; }
      return;
    }
    const d = polyPath(P, 20 * u), NS = 'http://www.w3.org/2000/svg';
    el.classList.add('poly'); el.style.clipPath = `path("${d}")`; el._poly = P;
    // Rahmen-Schild an die oberste (linke) Ecke
    const tp = P.reduce((a, p) => (p[1] < a[1] - .5 || (Math.abs(p[1] - a[1]) <= .5 && p[0] < a[0]) ? p : a));
    el.style.setProperty('--lbx', Math.max(6, tp[0] + 22 * u) + 'px'); el.style.setProperty('--lby', Math.max(4, tp[1] + 8 * u) + 'px');
    const glass = el.classList.contains('plate');
    const ed = old || el.appendChild(document.createElementNS(NS, 'svg'));
    ed.setAttribute('class', 'pedge'); ed.setAttribute('width', W); ed.setAttribute('height', H); ed.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ed.innerHTML = `<defs><linearGradient id="rpe${fi}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".45" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient></defs>`
      + (glass ? `<path d="${d}" fill="none" stroke="url(#rpe${fi})" stroke-width="2"/>` : '') + `<path class="eo" d="${d}" fill="none"/>`;
    if (!glass) { if (el._rpSh) { el._rpSh.remove(); el._rpSh = null; } return; }
    // Schatten wie .plate (0 20px 36px) + feine schwarze Außenlinie, innen ausgespart (Glas bleibt durchsichtig)
    const m = 70 * u, sw = W + 2 * m, shh = H + 2 * m;
    const sh = el._rpSh || (el._rpSh = document.createElementNS(NS, 'svg'));
    if (!sh.isConnected) el.parentNode.prepend(sh);
    sh.setAttribute('class', 'pshadow'); sh.setAttribute('width', sw); sh.setAttribute('height', shh); sh.setAttribute('viewBox', `0 0 ${sw} ${shh}`);
    Object.assign(sh.style, { left: (L0 - m) + 'px', top: (T0 - m) + 'px' });
    sh.innerHTML = `<defs><mask id="rps${fi}" maskUnits="userSpaceOnUse" x="0" y="0" width="${sw}" height="${shh}"><rect width="${sw}" height="${shh}" fill="#fff"/><path d="${d}" transform="translate(${m} ${m})" fill="#000"/></mask>
      <filter id="rpf${fi}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(18 * u).toFixed(1)}"/></filter></defs>
      <g mask="url(#rps${fi})"><path d="${d}" transform="translate(${m} ${m + 20 * u})" fill="#000" fill-opacity=".55" filter="url(#rpf${fi})"/><path d="${d}" transform="translate(${m} ${m})" fill="none" stroke="#000" stroke-width="2"/></g>`;
  }

  // ====================== Einstellungen: eigenes Dashboard als Fenster ======================
  // settings: <url-pfad>  oder  { dashboard, room, timeout, views }
  //   dashboard = URL-Pfad eines HA-Dashboards; jede Ansicht = eine Kategorie (Titel, Symbol, Karten)
  //   views     = Ansichten direkt hier statt eines eigenen Dashboards
  _setCfg() { const s = this._raw && this._raw.settings; return !s ? null : typeof s === 'string' ? { dashboard: s } : s; }
  hasSettings() { return !!this._setCfg(); }
  _setInit() {
    const pop = this.$('setpop');
    this._setKey = null; this._setEls = [];
    pop.addEventListener('pointerdown', () => this._setArm());
    pop.addEventListener('click', e => {
      if (e.target === pop) { this.closeSettings(); return; }
      const b = e.target.closest('[data-s]'); if (!b) return;
      const [k, a] = b.dataset.s.split(':');
      if (k === 'close') this.closeSettings();
      else if (k === 'go') this._setGo(+a);
      else if (k === 'home') this._setGo(0);
      else if (k === 'back' && this._setHp > 0) this._setGo(this._setHist[--this._setHp], 'hist');
      else if (k === 'fwd' && this._setHp < this._setHist.length - 1) this._setGo(this._setHist[++this._setHp], 'hist');
    });
    if (!this._setKeyH) { this._setKeyH = e => { if (e.key !== 'Escape' || !this.$) return; if (this.$('bmpop') && !this.$('bmpop').hidden) this.closeBatteries(); else if (this.$('setpop') && !this.$('setpop').hidden) this.closeSettings(); }; window.addEventListener('keydown', this._setKeyH); }
  }
  // page: Name/Pfad der Seite (z. B. "audio"); ctx: { media } vom aufrufenden Audio-Modul
  openSettings(page, ctx) {
    const sc = this._setCfg(); if (!sc || !this._built) return false;
    if (ctx) this._setCtx = ctx;
    const pop = this.$('setpop');
    if (pop.hidden) { pop.hidden = false; pop.classList.remove('anim'); void pop.offsetWidth; pop.classList.add('anim'); this._setIdx = null; if (BS_SIDE.v) BS_SIDE.set(null); }
    this._setArm();
    this._setLoad(sc).then(conf => { if (!pop.hidden) this._setShow(conf, page); });
    return true;
  }
  // Batterie-Manager als Fenster über dem Panel (Statusleisten-Symbol „batterien“), sortiert nach Stand
  // cfg = batterien-Optionen der Statusleiste: {ansicht, timeout (s, Standard 60, 0 = nie)}
  _bmInit() {
    const pop = this.$('bmpop');
    pop.addEventListener('click', e => { if (e.target === pop || e.target.closest('[data-b="close"]')) this.closeBatteries(); });
    ['pointerdown', 'wheel', 'touchmove'].forEach(ev => pop.addEventListener(ev, () => this._bmArm(), { passive: true }));
  }
  openBatteries(cfg = {}) {
    if (!this._built || !customElements.get('batterie-manager')) return false;
    const pop = this.$('bmpop'), body = this.$('bmbody');
    this._bmT0 = Number(cfg.timeout ?? 60);
    // jedes Mal neu: Startansicht wieder „nach Stand“, oben beginnend
    const el = document.createElement('batterie-manager');
    el.setConfig({ ansicht: L({ tab: 'geraete', filter: 'alle', gruppe: 'stand' }, cfg.ansicht || {}), raum: this._raum() || undefined, ...(cfg.kompakt != null ? { kompakt: !!cfg.kompakt } : {}) });
    if (this._hass) el.hass = this._hass;
    body.replaceChildren(el); this._bmEl = el; body.scrollTop = 0;
    pop.hidden = false; pop.classList.remove('anim'); void pop.offsetWidth; pop.classList.add('anim');
    this._bmArm();
    return true;
  }
  closeBatteries() {
    const pop = this.$ && this.$('bmpop'); if (!pop) return;
    pop.hidden = true; clearTimeout(this._bmT);
    if (this._bmEl) { this._bmEl.remove(); this._bmEl = null; }   // Abo der Karte beenden
  }
  _bmArm() { clearTimeout(this._bmT); if (this._bmT0 > 0 && !this.$('bmpop').hidden) this._bmT = setTimeout(() => this.closeBatteries(), this._bmT0 * 1000); }
  closeSettings() { const pop = this.$ && this.$('setpop'); if (pop) pop.hidden = true; clearTimeout(this._setT); }
  // ohne Bedienung nach timeout Sekunden schließen (Standard 25, 0 = nie); nicht solange der Preset-Editor offen ist
  _setArm() {
    clearTimeout(this._setT);
    const t = Number((this._setCfg() || {}).timeout ?? 25);
    if (t > 0) this._setT = setTimeout(() => { const ov = this._ovlHost(); if (ov && [...ov.querySelectorAll('.ppop')].some(p => !p.hidden)) this._setArm(); else this.closeSettings(); }, t * 1000);
  }
  async _setLoad(sc) {
    if (Array.isArray(sc.views)) return { title: sc.title, views: sc.views };
    try {
      if (!this._hass || !this._hass.callWS) throw new Error('Keine Verbindung zu Home Assistant');
      // force: YAML-Dashboards nach Änderungen neu einlesen
      return await this._hass.callWS({ type: 'lovelace/config', url_path: sc.dashboard, force: true });
    } catch (e) { return this._setConf && !this._setConf.error ? this._setConf : { error: String((e && (e.message || e.code)) || e) }; }
  }
  _setShow(conf, page) {
    const key = JSON.stringify(conf);
    if (key !== this._setKey) { this._setKey = key; this._setConf = conf; this._setBuild(conf); }
    if (!this._setViews.length) return;
    let i = page != null ? this._setFind(String(page)) : this._setIdx;
    this._setGo(i == null || i < 0 ? 0 : i, this._setIdx == null ? 'reset' : null);
  }
  _setMeta(v, i) {
    const t = `${v.title || ''} ${v.path || ''}`, k = SET_KIND.find(([re]) => re.test(t));
    const ic = k ? k[1] : v.icon && customElements.get('ha-icon') ? `<ha-icon icon="${escH(v.icon)}"></ha-icon>` : IC.sliders;
    return { ic, col: v.color || (k ? k[2] : '#4dc3ff'), title: v.title || `Seite ${i + 1}` };
  }
  _setBuild(conf) {
    const tabs = this.$('stabs'), body = this.$('sbody');
    this._setEls = []; this._setIdx = null;
    const views = this._setViews = conf.error ? [] : (conf.views || []).filter(v => v && v.visible !== false);
    if (!views.length) {
      tabs.innerHTML = ''; tabs.style.display = 'none';
      const sc = this._setCfg() || {};
      body.innerHTML = conf.error ? `<div class="serr"><b>Einstellungen nicht geladen</b><div>Dashboard <code>${escH(sc.dashboard)}</code>: ${escH(conf.error)}</div><div>YAML-Dashboards in configuration.yaml werden erst nach einem Neustart von HA gefunden.</div></div>`
        : '<div class="serr"><b>Keine Seiten</b><div>Das Einstellungs-Dashboard hat noch keine Ansichten.</div></div>';
      this.$('scrumb').innerHTML = `${IC.gear}<span>Einstellungen</span>`;
      return;
    }
    tabs.style.display = '';
    tabs.innerHTML = '<i class="sind noanim" id="sind"></i>' + views.map((v, i) => { const mt = this._setMeta(v, i); return `<div class="stab" data-s="go:${i}" style="--tc:${mt.col}">${mt.ic}<span>${escH(mt.title)}</span></div>`; }).join('');
    body.innerHTML = views.map(() => '<div class="spage" hidden></div>').join('');
  }
  _setFind(p) {
    const q = p.toLowerCase(), V = this._setViews, low = v => [String(v.path || '').toLowerCase(), String(v.title || '').toLowerCase()];
    let i = V.findIndex(v => low(v).includes(q));
    if (i < 0) i = V.findIndex(v => low(v).some(x => x.includes(q)));
    if (i < 0) { const k = SET_KIND.find(([re]) => re.test(q)); if (k) i = V.findIndex(v => k[0].test(`${v.title || ''} ${v.path || ''}`)); }
    if (i < 0 && q === 'audio') i = V.findIndex(v => JSON.stringify(v).includes('audio-settings'));
    return i;
  }
  // Seite wechseln · how: 'reset' = neue Sitzung, 'hist' = über Zurück/Vor
  _setGo(i, how) {
    const V = this._setViews; if (!V || !V[i]) return;
    const prev = this._setIdx;
    if (how === 'reset' || !this._setHist) { this._setHist = [i]; this._setHp = 0; }
    else if (how !== 'hist' && i !== prev) { this._setHist = this._setHist.slice(0, this._setHp + 1).concat(i); this._setHp = this._setHist.length - 1; }
    this._setIdx = i;
    const pages = [...this.$('sbody').children];
    pages.forEach((pg, n) => { pg.hidden = n !== i; pg.classList.remove('in-r', 'in-l'); });
    this._setPage(i);
    if (prev != null && prev !== i) { void pages[i].offsetWidth; pages[i].classList.add(i > prev ? 'in-r' : 'in-l'); }
    const mt = this._setMeta(V[i], i), sc = this._setCfg() || {};
    [...this.$('stabs').querySelectorAll('.stab')].forEach((t, n) => t.classList.toggle('on', n === i));
    this.$('swin').style.setProperty('--tc', mt.col);
    const sep = IC.fwd.replace('<svg', '<svg class="sep"');
    const room = sc.room || (this._setConf && this._setConf.title) || '';
    this.$('scrumb').innerHTML = `${IC.gear}${room ? `<span>${escH(room)}</span>${sep}` : ''}<span data-s="home">Einstellungen</span>${sep}<b>${escH(mt.title)}</b>`;
    this.$('swin').querySelector('[data-s="back"]').classList.toggle('dis', !(this._setHp > 0));
    this.$('swin').querySelector('[data-s="fwd"]').classList.toggle('dis', !(this._setHp < this._setHist.length - 1));
    const ind = this.$('sind'), tab = this.$('stabs').querySelectorAll('.stab')[i];
    const place = () => { if (!tab.offsetWidth) return; ind.style.left = tab.offsetLeft + 'px'; ind.style.width = tab.offsetWidth + 'px'; ind.style.setProperty('--tc', mt.col); if (ind.classList.contains('noanim')) requestAnimationFrame(() => ind.classList.remove('noanim')); };
    place(); requestAnimationFrame(place);
  }
  // Seiteninhalt beim ersten Aufruf aufbauen: Karten der Ansicht (auch aus sections) im Raster
  _setPage(i) {
    const pg = this.$('sbody').children[i]; if (!pg || pg._built) return;
    pg._built = true;
    const v = this._setViews[i], mt = this._setMeta(v, i);
    const cards = [...(v.cards || []), ...(Array.isArray(v.sections) ? v.sections.flatMap(s => (s && s.cards) || []) : [])];
    if (!cards.length) { pg.style.setProperty('--tc', mt.col); pg.innerHTML = `<div class="sempty">${mt.ic}<b>${escH(mt.title)}</b><div>Hier kommen die Einstellungen für diesen Bereich hin.</div></div>`; return; }
    const grid = document.createElement('div'); grid.className = 'sgrid';
    grid.style.setProperty('--sc', Math.max(1, Number(v.columns) || 2));
    pg.appendChild(grid);
    cards.forEach(c0 => { const cell = document.createElement('div'); cell.className = 'scell'; grid.appendChild(cell); this._setMount(cell, c0 || {}); });
  }
  _setMedia() {
    if (this._setCtx && this._setCtx.media) return this._setCtx.media;
    const a = this._c.frames.flatMap(f => f.modules || []).find(m => m && m.type === 'audio');
    return a ? (a.media || a) : null;
  }
  _setMount(cell, c0) {
    // span: Spalten der Karte (Zahl oder full) – wird vor der Übergabe an HA entfernt
    const { span, ...cfg } = c0;
    if (span) cell.style.gridColumn = span === 'full' || span === true ? '1 / -1' : `span ${span}`;
    const t = String(cfg.type || ''), tag = MODULES[t] || (/^custom:rp-/.test(t) && customElements.get(t.slice(7)) ? t.slice(7) : null);
    if (tag) {
      // eigene Module direkt einsetzen (Audio-Module bekommen bei Bedarf die Audio-Konfiguration des Panels)
      let c = cfg;
      if (/^rp-audio/.test(tag) && !cfg.media && !cfg.channels) { const md = this._setMedia(); if (md) c = L(cfg, { media: md }); }
      // Bett-Module in den Einstellungen: Bettseite dieses Panels (aus seinen Wecker-/Uhr-Modulen) übernehmen
      if (['rp-wecker', 'rp-bett-settings', 'rp-uhr'].includes(tag) && !cfg.seite) {
        const sm = this._c.frames.flatMap(f => f.modules || []).find(m => m && m.seite);
        if (sm || this._raw.seite) c = L(cfg, { seite: this._raw.seite || sm.seite });
      }
      if (tag === 'rp-heating-settings' && !cfg.climate && !cfg.entity) {
        const hm = this._c.frames.flatMap(f => f.modules || []).find(m => m && m.type === 'heating');
        if (hm) c = L(cfg, { climate: hm.climate || { entity: hm.entity } });
      }
      if (tag === 'rp-light-settings' && !cfg.light && !cfg.lights) {
        const lm = this._c.frames.flatMap(f => f.modules || []).find(m => m && m.type === 'light');
        if (lm) c = L(cfg, { lights: lm.lights || { primary: lm.primary }, ...(lm.favorites ? { favorites: lm.favorites } : {}) });
      }
      try {
        const el = document.createElement(tag); el.dataset.inpanel = '1'; el.setConfig(c);
        const m = el.meta || {}, P = Number(c.padding ?? 8);
        cell.classList.add('rpm');
        if (c.height) cell.style.height = (Number(c.height) || 300) + 'px'; else cell.style.aspectRatio = `${(m.bw || 368) + 2 * P} / ${(m.mh || 300) + 2 * P}`;
        cell.appendChild(el); if (this._hass) el.hass = this._hass; this._setEls.push(el);
      } catch (e) { cell.innerHTML = `<div class="xerr">${escH(e.message || e)}</div>`; }
      return;
    }
    const make = async () => {
      try {
        const helpers = window.loadCardHelpers ? await window.loadCardHelpers() : null;
        if (!helpers) { cell.innerHTML = '<div class="xerr">Karten-Helfer nicht verfügbar</div>'; return; }
        const el = await helpers.createCardElement(cfg);
        if (this._hass) el.hass = this._hass;
        const old = cell._el; if (old) this._setEls = this._setEls.filter(x => x !== old);
        cell.replaceChildren(el); cell._el = el; this._setEls.push(el);
      } catch (e) { cell.innerHTML = `<div class="xerr">${escH(e.message || e)}</div>`; }
    };
    cell.addEventListener('ll-rebuild', ev => { ev.stopPropagation(); make(); });
    make();
  }

  // =============================== Editor (Phase 3) ===============================
  _edInit() {
    this.$('edbtn').addEventListener('click', () => this._edStart());
    this.$('edbar').addEventListener('click', e => { const b = e.target.closest('button[data-ed]'); if (b) this._edCmd(b.dataset.ed); });
    const side = this.$('edside');
    side.addEventListener('click', e => { const b = e.target.closest('button[data-ed]'); if (b) this._edCmd(b.dataset.ed, b.dataset.i); });
    side.addEventListener('change', e => { if (e.target.dataset.k) this._edField(e.target, true); });
    side.addEventListener('input', e => { if (e.target.dataset.k && /^(text|number)$/.test(e.target.type)) this._edField(e.target, false); });
    const md = this.$('edmodal');
    md.addEventListener('click', e => { const b = e.target.closest('button[data-ed]'); if (b) this._edCmd(b.dataset.ed); });
    md.addEventListener('input', () => this._edYamlRender());
    md.addEventListener('change', () => this._edYamlRender());
    if (this._hass) this.hass = this._hass;
    if (this._editing) this._edShow();
  }

  _edStart() { this._editing = true; this._sel = null; this._edShow(); this._edSideState(); }
  // Seitenleiste des Editors aus-/eingeblendet bzw. links/rechts – bleibt so, bis man es wieder umschaltet
  _edSideState() {
    const sd = this.$('edside'), vb = !!(this._edEl && this._edEl.vb), b = this.$('edsidebtn'); if (!sd) return;
    sd.classList.toggle('off', !vb && !!this._sideOff); sd.classList.toggle('left', !vb && !!this._sideLeft);
    if (b) { b.classList.toggle('on', !!this._sideOff); b.textContent = this._sideOff ? '☰ Seitenleiste zeigen' : '☰ Seitenleiste'; }
  }
  _edShow() {
    this.$('stage').classList.add('editing');
    this.$('edbar').hidden = false; this.$('edside').hidden = false; this.$('dbg').hidden = false; this.$('dbgn').hidden = false;
    if (!this._edKey) { this._edKey = e => this._edKeydown(e); window.addEventListener('keydown', this._edKey); }
    this._edOverlays(); this._edSide(); this._fit();
  }
  _edStop() {
    if (this._edEl) this._edElStop();
    if (this._dirty && !confirm('Die Änderungen wurden noch nicht als YAML kopiert.\nTrotzdem beenden? (Die Vorschau bleibt bis zum Neuladen sichtbar.)')) return;
    this._editing = false; this._sel = null;
    this.$('stage').classList.remove('editing');
    this.$('edbar').hidden = true; this.$('edside').hidden = true; this.$('edmodal').hidden = true; this.$('dbg').hidden = !this._c.debug; this.$('dbgn').hidden = !this._c.debug;
    if (this._edKey) { window.removeEventListener('keydown', this._edKey); this._edKey = null; }
    for (const { el } of this._frames) { el.querySelectorAll(':scope>.edov').forEach(o => o.remove()); if (!this._c.debug) el.querySelectorAll(':scope>.dbgl').forEach(o => o.remove()); el.classList.remove('dbgov'); }
    this._fit();
  }

  // Bedienfläche über jedem Rahmen: ziehen = verschieben, Ecke = Größe, tippen = auswählen
  _edOverlays() {
    this._frames.forEach(({ el }, i) => {
      el.querySelectorAll(':scope>.edov').forEach(o => o.remove());
      const ov = document.createElement('div'); ov.className = 'edov' + (i === this._sel ? ' sel' : ''); el.classList.toggle('psel', i === this._sel);
      ov.innerHTML = '<div class="edrs" title="Größe ändern"></div>';
      ov.addEventListener('pointerdown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (this._sel !== i) this._edSelect(i);
        const G = this._geo, r0 = this._rects[i], k = (this.$('stage').getBoundingClientRect().width / G.w) || 1;
        const mode = ev.target.classList.contains('edrs') ? 'size' : 'move', sx = ev.clientX, sy = ev.clientY;
        try { ov.setPointerCapture(ev.pointerId); } catch (e) { /* synthetische Zeiger */ }
        const mv = e => this._edApply(i, r0, mode, Math.round((e.clientX - sx) / k / G.bw), Math.round((e.clientY - sy) / k / G.bh));
        const up = () => { ov.removeEventListener('pointermove', mv); ov.removeEventListener('pointerup', up); ov.removeEventListener('pointercancel', up); };
        ov.addEventListener('pointermove', mv); ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
      });
      el.appendChild(ov);
      // ✥ Anordnen: direkt in die freie Anordnung der Bedienelemente dieses Moduls
      const f = this._c.frames[i], er = el.getBoundingClientRect(), k = (this.$('stage').getBoundingClientRect().width / (this._geo || {}).w) || 1;
      (f.modules || []).forEach((m0, mi) => {
        const m = typeof m0 === 'string' ? { type: m0 } : m0 || {}, rec = this._edRec(i, mi);
        if (!this._edParts(m, rec) || !rec || !rec.el) return;
        const r = rec.el.getBoundingClientRect(), b = document.createElement('button');
        b.className = 'edq'; b.textContent = '✥ Anordnen'; b.title = 'Bedienelemente dieses Moduls frei verschieben und vergrößern';
        Object.assign(b.style, { left: ((r.left - er.left) / k + 6) + 'px', top: ((r.top - er.top) / k + 6) + 'px' });
        b.addEventListener('pointerdown', ev => ev.stopPropagation());
        b.addEventListener('click', ev => { ev.stopPropagation(); if (this._sel !== i) this._edSelect(i); this._edCmd(m.layout === 'custom' && m.elements ? 'elemedit' : 'elemon', String(mi)); });
        ov.appendChild(b);
      });
    });
  }
  // Rahmen um dx/dy Blöcke verschieben bzw. vergrößern (rastet im Raster ein)
  _edApply(i, r0, mode, dx, dy) {
    const g = this._c.grid, f = this._c.frames[i];
    if (r0.pts) {
      // freie Form: alle Ecken mitverschieben (Größe über die Ecken in der Seitenleiste)
      if (mode !== 'move') return;
      const mx = clamp(dx, -r0.fx, g.columns - r0.fx - r0.fw), my = clamp(dy, -r0.fy, g.rows - r0.fy - r0.fh);
      f.ecken = r0.pts.map(([x, y]) => [x + mx, y + my]); delete f.corners; delete f.points;
      this._dirty = true; this._fit(); this._edSync(); return;
    }
    if (mode === 'move') { f.col = clamp(r0.fx + dx, 0, g.columns - r0.fw) + 1; f.row = clamp(r0.fy + dy, 0, g.rows - r0.fh) + 1; f.w = r0.fw; f.h = r0.fh; }
    else { f.w = clamp(r0.fw + dx, 1, g.columns - r0.fx); f.h = clamp(r0.fh + dy, 1, g.rows - r0.fy); f.col = r0.fx + 1; f.row = r0.fy + 1; }
    delete f.x; delete f.y; delete f['true']; delete f.column; delete f.width; delete f.height;
    this._dirty = true; this._fit(); this._edSync();
  }
  _edKeydown(e) {
    if (this._editing && (e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey && !(this._edEl && this._edEl.vb) && !/INPUT|SELECT|TEXTAREA/.test((e.composedPath()[0] || {}).tagName || '')) { e.preventDefault(); this._edCmd('sideoff'); return; }
    if (this._edEl && this._edEl.sel && !/INPUT|SELECT|TEXTAREA/.test((e.composedPath()[0] || {}).tagName || '')) {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
      e.preventDefault(); const E = this._edEl, el0 = Object.assign({ col: 1, row: 1, w: 1, h: 1 }, this._edMod(E.fi, E.mi).elements[E.sel]);
      this._edElMove(E.sel, el0, e.shiftKey ? 'size' : 'move', d[0], d[1]); this._edElSide(); return;
    }
    if (this._sel == null || !this._editing || /INPUT|SELECT|TEXTAREA/.test((e.composedPath()[0] || {}).tagName || '')) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
    e.preventDefault(); this._edApply(this._sel, this._rects[this._sel], e.shiftKey ? 'size' : 'move', d[0], d[1]);
  }
  _edSelect(i) {
    this._sel = i == null ? null : +i;
    this._frames.forEach(({ el }, j) => { const o = el.querySelector(':scope>.edov'); if (o) o.classList.toggle('sel', j === this._sel); el.classList.toggle('psel', j === this._sel); });
    this._edSide(); this._edCorners();
  }
  // Positionsfelder in der Seitenleiste nachführen (beim Ziehen)
  _edSync() {
    if (this._sel == null) return;
    const f = this._c.frames[this._sel], side = this.$('edside');
    const ek = side.querySelector('[data-k="f.ecken"]'), pp = polyPts(f);
    if (ek && pp && side.ownerDocument.activeElement !== ek) ek.value = polyTxt(pp);
    for (const k of ['col', 'row', 'w', 'h']) { const inp = side.querySelector(`[data-k="f.${k}"]`); if (inp && side.ownerDocument.activeElement !== inp) inp.value = f[k]; }
  }

  // Seitenleiste: Panel-Einstellungen oder gewählter Rahmen mit seinen Modulen
  _edSide() {
    const side = this.$('edside'), c = this._c, esc = v => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const num = (k, v, ph = '', ex = '') => `<input type="number" data-k="${k}" value="${v ?? ''}" placeholder="${ph}" ${ex}>`;
    const txt = (k, v, ph = '') => `<input type="text" data-k="${k}" value="${esc(v)}" placeholder="${esc(ph)}">`;
    const sel = (k, v, opts) => `<select data-k="${k}">${opts.map(([o, n]) => `<option value="${o}"${String(v ?? '') === o ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    const row = (l, h) => `<div class="edrow"><label>${l}</label>${h}</div>`;
    if (this._sel == null) {
      side.innerHTML = `<h3>Panel</h3>
        <div class="ed4"><div><label>Spalten</label>${num('g.columns', c.grid.columns, 50, 'min="4" max="200"')}</div><div><label>Reihen</label>${num('g.rows', c.grid.rows, 30, 'min="4" max="200"')}</div>
        <div><label>Abstand</label>${num('g.gap', c.grid.gap, 14)}</div><div><label>Rand</label>${num('g.padding', c.grid.padding, 14)}</div></div>
        ${row('Rahmen-Innenabst.', num('g.frame_padding', c.grid.frame_padding, 14))}
        ${row('Schriftgröße ×', num('sg', c.schriftgroesse, 1, 'step="0.05" min="0.5" max="3" title="Faktor für die Schrift: 1 = wie bisher, 1.3 = größer. Wächst nur so weit, wie der Inhalt noch in seinen Platz passt."'))}
        ${row('Display-Transparenz %', num('dt', c.display_transparenz, 0, 'min="0" max="100" step="5" title="0 = wie bisher, 100 = schwarzer Display-Hintergrund ganz durchsichtig (Schrift bleibt)"'))}
        ${row('Hintergrund', sel('bg.mode', c.background.mode, [['sun', 'Aurora (Sonnenstand)'], ['off', 'dunkel']]))}
        ${row('Raster immer zeigen', `<input type="checkbox" data-k="debug"${c.debug ? ' checked' : ''}>`)}
        <h3>Rahmen</h3>
        ${c.frames.map((f, i) => `<button data-ed="select" data-i="${i}" style="display:block;width:100%;text-align:left;margin:4px 0">#${i + 1} ${esc(f.name || '')} · ${(f.modules || []).map(m => ED_NAMES[(m && m.type) || m] || (m && m.type) || m).join(', ') || 'leer'}</button>`).join('')}
        <div class="ednote">Rahmen anklicken oder auf der Fläche antippen, um ihn zu bearbeiten. Mit „YAML“ bekommst du den Text für deine Datei.</div>`;
      return;
    }
    const f = c.frames[this._sel], i = this._sel;
    const mods = (f.modules || []).map((m0, mi) => {
      const m = typeof m0 === 'string' ? { type: m0 } : m0, t = m.type, parts = this._edParts(m, this._edRec(i, mi)) || [], vars = ED_VARIANTS[t] || [];
      const hid = new Set(m.hide || []);
      return `<div class="edmod"><div class="t"><span>${ED_NAMES[t] || esc(t)}</span><button data-ed="modup" data-i="${mi}" title="nach oben">↑</button><button data-ed="moddown" data-i="${mi}" title="nach unten">↓</button><button data-ed="moddel" data-i="${mi}" title="entfernen">✕</button></div>
        ${row('Typ', sel(`m.${mi}.type`, t, Object.entries(ED_NAMES)))}
        ${row('Größe im Rahmen', txt(`m.${mi}.size`, m.size, 'Rest · Zahl = Blöcke · 40%'))}
        ${vars.length ? row('Variante', sel(`m.${mi}.layout`, m.layout, [['', 'automatisch'], ...vars.map(v => [v, v]), ...(m.layout === 'custom' ? [['custom', 'frei angeordnet']] : [])])) : ''}
        ${parts.length && t !== 'audio' ? `<div class="edbtns">${m.layout === 'custom' ? `<button data-ed="elemedit" data-i="${mi}" class="pri" style="background:#5a3d12;border-color:#ffb347">✥ Elemente anordnen</button><button data-ed="elemoff" data-i="${mi}">Zurück zu automatisch</button>` : `<button data-ed="elemon" data-i="${mi}">✥ Elemente frei anordnen</button>`}</div>` : ''}
        ${row('Ausrichtung', sel(`m.${mi}.align`, m.align, ED_ALIGN))}
        <div class="ed4"><div><label>Breite</label>${txt(`m.${mi}.width`, m.width, 'voll')}</div><div><label>Höhe</label>${txt(`m.${mi}.height`, m.height, 'voll')}</div>
        <div><label>Zoom</label>${num(`m.${mi}.zoom`, m.zoom, '1', 'step="0.05" min="0.2" max="3"')}</div><div><label>Innenabst.</label>${num(`m.${mi}.padding`, m.padding, t === 'statusbar' ? 0 : 8)}</div></div>
        <div class="ed4"><div><label>Display-Transp. %</label>${num(`m.${mi}.display_transparenz`, m.display_transparenz, f.display_transparenz ?? c.display_transparenz ?? 0, 'min="0" max="100" step="5" title="0 = wie bisher, 100 = schwarzer Display-Hintergrund ganz durchsichtig (Schrift bleibt)"')}</div><div><label>Schrift ×</label>${num(`m.${mi}.schriftgroesse`, m.schriftgroesse, f.schriftgroesse ?? c.schriftgroesse ?? 1, 'step="0.05" min="0.5" max="3" title="Faktor für die Schrift: 1 = wie bisher, 1.3 = größer. Wächst nur so weit, wie der Inhalt noch in seinen Platz passt."')}</div></div>
        ${row('Rand außen', txt(`m.${mi}.rand`, Array.isArray(m.rand) ? m.rand.join(' ') : m.rand && typeof m.rand === 'object' ? ['oben', 'rechts', 'unten', 'links'].map(k => m.rand[k] ?? 0).join(' ') : m.rand, 'px · 20 · oben rechts unten links'))}
        ${parts.length && m.layout !== 'custom' ? `<div class="ednote" style="margin-bottom:2px">Elemente (Haken = sichtbar):</div><div class="edparts">${parts.map(p => `<label><input type="checkbox" data-k="m.${mi}.part.${p}"${hid.has(p) ? '' : ' checked'}>${p}</label>`).join('')}</div>` : ''}
        ${t === 'floorplan' ? this._edFloorOpts(m, mi) : ''}
        ${t === 'card' ? row('Karten-Typ', txt(`m.${mi}.card.type`, (m.card || {}).type, 'tile / custom:mushroom-…')) + row('Entität', txt(`m.${mi}.card.entity`, (m.card || {}).entity, 'light.…')) + this._edCardOpts(m, mi) : ''}
      </div>`;
    }).join('');
    side.innerHTML = `<h3>Rahmen #${i + 1}</h3>
      ${row('Name', txt('f.name', f.name, 'z. B. Licht links'))}
      ${polyPts(f) ? `${row('Ecken', txt('f.ecken', polyTxt(polyPts(f)), '1,1 21,1 16,16 1,16'))}
      <div class="ednote">Blaue Punkte ziehen = Ecke verschieben · <b>+</b> auf einer Kante = neue Ecke · Doppelklick auf Punkt = Ecke entfernen.<br>Oder hier eintippen: Spalte,Reihe je Ecke auf den Rasterlinien (1 = linker/oberer Rand). Leer = wieder Rechteck.</div>`
      : `<div class="ed4"><div><label>Spalte</label>${num('f.col', this._rects[i].fx + 1, '', 'min="1"')}</div><div><label>Reihe</label>${num('f.row', this._rects[i].fy + 1, '', 'min="1"')}</div>
      <div><label>Breite</label>${num('f.w', this._rects[i].fw, '', 'min="1"')}</div><div><label>Höhe</label>${num('f.h', this._rects[i].fh, '', 'min="1"')}</div></div>
      <div class="edbtns"><button data-ed="toPoly">◇ Freie Form (Ecken)</button></div>`}
      ${row('Glasrahmen', `<input type="checkbox" data-k="f.glass"${f.glass === false ? '' : ' checked'}>`)}
      ${row('Schriftgröße ×', num('f.schriftgroesse', f.schriftgroesse, c.schriftgroesse ?? 1, 'step="0.05" min="0.5" max="3" title="Faktor für die Schrift: 1 = wie bisher, 1.3 = größer. Wächst nur so weit, wie der Inhalt noch in seinen Platz passt."'))}
      ${row('Display-Transparenz %', num('f.display_transparenz', f.display_transparenz, c.display_transparenz ?? 0, 'min="0" max="100" step="5" title="0 = wie bisher, 100 = schwarzer Display-Hintergrund ganz durchsichtig (Schrift bleibt)"'))}
      ${row('Transparenz %', num('f.transparenz', f.transparenz, c.transparenz ?? 0, 'min="0" max="100" step="5" title="0 = wie bisher, 100 = Hintergrund ganz durchsichtig (Glas und eigene Flächen der Module)"'))}
      ${row('Module', sel('f.direction', f.direction, [['', 'untereinander'], ['row', 'nebeneinander']]))}
      <div class="ed4"><div><label>Innenabst.</label>${num('f.padding', f.padding, f.glass === false ? 0 : c.grid.frame_padding)}</div><div><label>Abstand</label>${num('f.gap', f.gap, c.grid.gap)}</div></div>
      <div class="edbtns"><button data-ed="dup">⧉ Duplizieren</button><button data-ed="front">Nach vorn</button><button data-ed="back">Nach hinten</button><button data-ed="del">🗑 Löschen</button></div>
      <h3>Module</h3>${mods || '<div class="ednote">Noch kein Modul.</div>'}
      <div class="edbtns">${sel('newmod', 'light', Object.entries(ED_NAMES))}<button data-ed="modadd">+ Modul</button></div>
      <div class="ednote">Neue Module haben Platzhalter-Entitäten – die trägst du danach im YAML ein.</div>`;
    side.querySelector('[data-k="newmod"]').removeAttribute('data-k');
    side.querySelector('select:not([data-k])').id = 'ednew';
  }

  // Ein Feld der Seitenleiste wurde geändert
  _edField(el, final) {
    if (this._edEl && /^e[lg]./.test(el.dataset.k)) { this._edElField(el); return; }
    const k = el.dataset.k, c = this._c, f = this._sel != null ? c.frames[this._sel] : null;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = v === '' ? undefined : Number(v);
    else if (el.type !== 'checkbox' && v === '') v = undefined;
    const set = (o, key, val) => { if (val === undefined) delete o[key]; else o[key] = val; };
    this._dirty = true;
    if (k.startsWith('g.')) { set(c.grid, k.slice(2), v ?? { columns: 50, rows: 30, gap: 14, padding: 14, frame_padding: 14 }[k.slice(2)]); this._fit(); return; }
    if (k === 'bg.mode') { c.background.mode = v || 'sun'; this._build(); return; }
    if (k === 'debug') { c.debug = v; return; }
    if (k === 'dt') { set(c, 'display_transparenz', v); this._fit(); return; }
    if (k === 'sg') { set(c, 'schriftgroesse', v); this._fit(); return; }
    if (!f) return;
    if (k.startsWith('f.')) {
      const key = k.slice(2);
      if (key === 'glass') { set(f, 'glass', v ? undefined : false); this._frames[this._sel].el.classList.toggle('plate', !!v); }
      else if (key === 'ecken') {
        // Text "1,1 21,1 …" → Liste; leer = zurück zum Rechteck (umschließendes Rechteck der letzten Form)
        const r = this._rects[this._sel], pts = v ? polyPts({ ecken: v }) : null;
        if (pts) f.ecken = pts;
        else if (!v) { delete f.ecken; Object.assign(f, { col: Math.round(r.fx) + 1, row: Math.round(r.fy) + 1, w: Math.max(1, Math.round(r.fw)), h: Math.max(1, Math.round(r.fh)) }); if (final) { this._fit(); this._edSide(); return; } }
        delete f.corners; delete f.points;
      }
      else set(f, key, v);
      if (['col', 'row', 'w', 'h'].includes(key)) { delete f.x; delete f.y; delete f['true']; delete f.column; }
      if (key === 'direction') this._frames[this._sel].el.firstChild.style.flexDirection = v === 'row' ? 'row' : 'column';
      this._fit(); return;
    }
    const [, mi, key, sub] = k.match(/^m\.(\d+)\.(\w+)(?:\.(.+))?$/) || [];
    if (mi == null) return;
    let m = f.modules[+mi]; if (typeof m === 'string') m = f.modules[+mi] = { type: m };
    if (key === 'type') { if (!final) return; f.modules[+mi] = Object.assign({ type: v }, JSON.parse(JSON.stringify(ED_STUB[v] || {})), m.size != null ? { size: m.size } : {}); this._buildFrames(); this._edSide(); return; }
    if (key === 'part') { const h = new Set(m.hide || []); if (v) h.delete(sub); else h.add(sub); if (h.size) m.hide = [...h]; else delete m.hide; delete m.show; }
    else if (key === 'card') { m.card = m.card || {}; if (el.dataset.std != null && el.dataset.std !== '' && String(v) === el.dataset.std) v = undefined; set(m.card, sub, v); if (!final) return; }
    else {
      if (['size', 'width', 'height'].includes(key) && typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)) v = Number(v);
      // Breite ändern ohne Höhe: aktuelle Höhe des Inhalts als Höhe eintragen, damit sie bleibt (sonst wächst sie mit)
      if (key === 'width' && v !== undefined && m.height == null) {
        const rec = this._edRec(this._sel, +mi), box = rec && rec.el && rec.el.$ && rec.el.$('box'), G = this._geo;
        if (box && G) {
          const k = this.getBoundingClientRect().width / (this.offsetWidth || 1) || 1, H = box.getBoundingClientRect().height / k;
          if (H > 0) { m.height = Math.max(1, Math.round((H + G.gap) / G.bh * 10) / 10); this._edHAuto = true; }
        }
      }
      set(m, key, v);
      if (key === 'width' && final && this._edHAuto) { this._edHAuto = false; this._fit(); this._edSide(); return; }
      if (key === 'rand' && typeof v === 'string') { const a = v.trim().split(/[\s,]+/).filter(Boolean).map(x => /%$/.test(x) ? x : Number(x)); v = !a.length ? undefined : a.length === 1 ? a[0] : a; if (v === undefined) delete m[key]; else m[key] = v; }
      if (['size', 'width', 'height', 'align', 'rand', 'display_transparenz', 'schriftgroesse'].includes(key)) { this._fit(); const ch = this._edRec(this._sel, +mi); if (ch && ch.el && ch.el._fit) ch.el._fit(); return; }
      if (!final && key !== 'zoom') return;
    }
    // Modul mit neuer Einstellung neu aufbauen
    clearTimeout(this._edT); this._edT = setTimeout(() => this._buildFrames(), final ? 0 : 300);
  }

  _edCmd(cmd, a) {
    const c = this._c, i = this._sel, fr = i != null ? c.frames[i] : null;
    const rebuild = sel => { this._dirty = true; this._buildFrames(); this._edSelect(sel); };
    switch (cmd) {
      case 'done': this._edStop(); break;
      case 'deselect': this._edSelect(null); break;
      case 'sideoff': this._sideOff = !this._sideOff; this._edSideState(); break;
      case 'sideswap': this._sideLeft = !this._sideLeft; if (this._sideOff) this._sideOff = false; this._edSideState(); break;
      case 'select': this._edSelect(+a); break;
      case 'addframe': c.frames.push({ name: 'Neu', col: 1, row: 1, w: 10, h: 8, modules: [] }); rebuild(c.frames.length - 1); break;
      case 'toPoly': if (fr) { const r = this._rects[i], x0 = r.fx + 1, y0 = r.fy + 1, x1 = x0 + r.fw, y1 = y0 + r.fh; fr.ecken = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; for (const k of ['col', 'row', 'w', 'h', 'x', 'y', 'true', 'column', 'width', 'height']) delete fr[k]; this._dirty = true; this._fit(); this._edSide(); } break;
      case 'dup': if (fr && polyPts(fr)) { const n = JSON.parse(JSON.stringify(fr)), r = this._rects[i], mx = Math.min(1, c.grid.columns - r.fx - r.fw), my = Math.min(1, c.grid.rows - r.fy - r.fh); n.ecken = polyPts(fr).map(([x, y]) => [x + mx, y + my]); c.frames.push(n); rebuild(c.frames.length - 1); break; }
        if (fr) { const n = JSON.parse(JSON.stringify(fr)), r = this._rects[i]; n.col = Math.min(r.fx + 2, c.grid.columns - r.fw + 1); n.row = Math.min(r.fy + 2, c.grid.rows - r.fh + 1); delete n.x; delete n.y; delete n['true']; c.frames.push(n); rebuild(c.frames.length - 1); } break;
      case 'del': if (fr && confirm(`Rahmen #${i + 1} löschen?`)) { c.frames.splice(i, 1); rebuild(null); } break;
      case 'front': if (fr) { c.frames.splice(i, 1); c.frames.push(fr); rebuild(c.frames.length - 1); } break;
      case 'back': if (fr) { c.frames.splice(i, 1); c.frames.unshift(fr); rebuild(0); } break;
      case 'modadd': if (fr) { const t = this.$('ednew').value; (fr.modules = fr.modules || []).push(Object.assign({ type: t }, JSON.parse(JSON.stringify(ED_STUB[t] || {})))); rebuild(i); } break;
      case 'modup': case 'moddown': if (fr) { const j = +a, k = cmd === 'modup' ? j - 1 : j + 1; if (k >= 0 && k < fr.modules.length) { [fr.modules[j], fr.modules[k]] = [fr.modules[k], fr.modules[j]]; rebuild(i); } } break;
      case 'moddel': if (fr) { fr.modules.splice(+a, 1); rebuild(i); } break;
      case 'elemon': { const rec = this._edRec(i, +a), m = this._edMod(i, +a); if (!rec || !rec.el || !rec.el._toElements) break; rec.el._fit(); const d = rec.el._toElements(); Object.assign(m, { layout: 'custom', grid: d.grid, elements: d.elements }); delete m.show; delete m.hide; rebuild(i); this._edElStart(i, +a); break; }
      case 'elemedit': this._edElStart(i, +a); break;
      // Dashboard: Modul auf den ganzen Rahmen erweitern (width/height/align weg) und Raster mitwachsen lassen
      case 'elfull': {
        const E = this._edEl; if (!E || E.vb) break;
        const m = this._edMod(E.fi, E.mi), rec = this._edRec(E.fi, E.mi); if (!rec || !rec.el) break;
        delete m.width; delete m.height; delete m.align; E.full = true; this._dirty = true; this._fit();
        setTimeout(() => {
          const r = rec.el.getBoundingClientRect(), c0 = (m.grid || {}).columns || 12;
          if (r.width && r.height) this._zoomFitGrid(m, rec, r.width / r.height);
          // bisherige Anordnung waagerecht mittig setzen (Mitte des Rahmens = gerader Teil bei schrägen Kanten)
          const els = Object.values(m.elements || {}), used = Math.max(1, ...els.map(e => (e.col || 1) + (e.w || 1) - 1)), dx = Math.max(0, Math.floor((m.grid.columns - Math.max(used, c0)) / 2));
          if (dx) els.forEach(e => { e.col = (e.col || 1) + dx; });
          this._edElApply(); this._edElSide();
        }, 30);
        break;
      }
      case 'eloff': { const mi = this._edEl && this._edEl.mi; this._edElStop(); if (mi != null) this._edCmd('elemoff', String(mi)); break; }
      case 'elemoff': { const m = this._edMod(i, +a); delete m.layout; delete m.grid; delete m.elements; rebuild(i); break; }
      case 'eldone': if (this._edEl && this._edEl.vb) this._zoomEdStop(); else this._edElStop(); break;
      case 'zyaml': this._zoomYaml(); break;
      case 'zfit': if (this._edEl && this._edEl.vb) { const E = this._edEl; this._zoomFitGrid(this._edMod(E.fi, E.mi), this._edRec(E.fi, E.mi)); this._edElApply(); this._edElSide(); } break;
      case 'zmod': this._zoomEdStop(); this._zoomEdStart(+a); break;
      case 'zauto': if (this._edEl && this._edEl.vb) { const E = this._edEl; delete this._c.frames[E.fi].modules[E.mi].vollbild; this._zoomEdStop(); this._zoomMods(E.fi, true); } break;
      case 'elsplit': this._edElSplit(a, true); break;
      case 'elmerge': this._edElSplit(a, false); break;
      case 'yaml': this._edYamlOpen(); break;
      case 'close': this.$('edmodal').hidden = true; break;
      case 'copy': this._edCopy(); break;
    }
  }

  // YAML-Ausgabe: ganzes Panel oder nur der gewählte Rahmen, mit wählbarer Einrückung
  _edYamlOpen() {
    const md = this.$('edmodal'), i = this._sel, ind = this._edInd || (this._edInd = { all: 6, frame: 10 });
    md.innerHTML = `<div class="edmbox"><b style="color:#9fd8ff">YAML für deine Dashboard-Datei</b>
      <div class="r"><label><input type="radio" name="scope" value="all" checked> Ganzes Panel</label>
      <label><input type="radio" name="scope" value="frame"${i == null ? ' disabled' : ''}> Nur Rahmen ${i == null ? '(keiner gewählt)' : '#' + (i + 1)}</label>
      <label style="margin-left:auto">Einrückung <input type="number" id="edind" min="0" max="30" value="${ind.all}"></label></div>
      <textarea id="edyaml" readonly spellcheck="false"></textarea>
      <div class="ednote" id="ednote"></div>
      <div class="r"><button class="pri" data-ed="copy">In Zwischenablage kopieren</button><button data-ed="close">Schließen</button><span id="edcopied" style="color:#3ddc84"></span></div></div>`;
    md.hidden = false; this._edScope = 'all'; this._edYamlRender();
  }
  _edYamlRender() {
    const md = this.$('edmodal'); if (md.hidden || !this.$('edyaml')) return;
    const scope = (md.querySelector('input[name=scope]:checked') || {}).value || 'all', indEl = this.$('edind');
    if (scope !== this._edScope) { this._edScope = scope; indEl.value = this._edInd[scope]; }
    const ind = this._edInd[scope] = clamp(Number(indEl.value) || 0, 0, 30);
    let body, note;
    if (scope === 'frame' && this._sel != null) {
      body = '- ' + toYaml(edFrameOut(this._c.frames[this._sel], this._rects[this._sel]), 2).replace(/^\n\s*/, '');
      note = `Ersetzt in deiner Datei nur den Block von Rahmen #${this._sel + 1} (ab „- col:“ bzw. „- name:“). Kommentare der anderen Rahmen bleiben erhalten.`;
    } else {
      const OLD = ['lights', 'favorites', 'climate', 'weather', 'air', 'air_history_hours', 'floorplan', 'media', 'alarm', 'calendar', 'persons', 'layout', 'frames', 'type', 'grid', 'background', 'debug'];
      const D = { columns: 50, rows: 30, gap: 14, padding: 14, frame_padding: 14 }, g = {};
      for (const k of Object.keys(this._c.grid)) if (this._c.grid[k] !== D[k] || k === 'columns' || k === 'rows') g[k] = this._c.grid[k];
      const o = { type: 'custom:raum-panel' };
      if (this._c.debug) o.debug = true;
      o.grid = g;
      const bg = Object.assign({}, this._raw.background || {}, { mode: this._c.background.mode }); o.background = bg;
      for (const k of Object.keys(this._raw)) if (!OLD.includes(k)) o[k] = this._raw[k];
      // im Editor geänderte Panel-Werte (liegen in _c)
      for (const k of ['schriftgroesse', 'display_transparenz']) { if (this._c[k] != null) o[k] = this._c[k]; else delete o[k]; }
      o.frames = this._c.frames.map((f, i) => edFrameOut(f, this._rects[i]));
      body = '- ' + toYaml(o, 2).replace(/^\n\s*/, '');
      note = 'Ersetzt die komplette Karte (ab „- type: custom:raum-panel“). Achtung: Kommentare in diesem Bereich gehen dabei verloren, eingebundene Dateien (!include) werden als Text übernommen.';
    }
    this.$('edyaml').value = edIndent(body, ind);
    this.$('ednote').textContent = note;
  }
  _edCopy() {
    const ta = this.$('edyaml'), msg = this.$('edcopied'), txt = ta.value;
    const ok = () => { msg.textContent = '✓ kopiert – jetzt in Studio Code Server einfügen'; this._dirty = false; };
    const fallback = () => { ta.removeAttribute('readonly'); ta.focus(); ta.select(); let r = false; try { r = document.execCommand('copy'); } catch (e) { r = false; } ta.setAttribute('readonly', ''); if (r) ok(); else msg.textContent = 'Bitte Text markieren und mit Strg+C kopieren'; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
  }

  // ===================== Editor: Elemente frei im Modul anordnen (Phase 4) =====================
  _edRec(fi, mi) { const f = this._c.frames[fi]; return this._mods.filter(r => r.frame === f)[mi]; }
  _edMod(fi, mi) {
    const f = this._c.frames[fi]; let m = f.modules[mi]; if (typeof m === 'string') m = f.modules[mi] = { type: m };
    // Vollbild-Ansicht: Änderungen gehen in m.vollbild (type nur lesbar, wird nicht ausgegeben)
    const E = this._edEl;
    if (E && E.vb && E.fi === fi && E.mi === mi) { const v = m.vollbild || (m.vollbild = {}); if (!('type' in v)) Object.defineProperty(v, 'type', { value: m.type, enumerable: false, configurable: true }); return v; }
    return m;
  }
  _edElStart(fi, mi) {
    this._edEl = { fi, mi, sel: null };
    this.$('stage').classList.add('edelmode');
    requestAnimationFrame(() => { this._edElDraw(); this._edElSide(); });
  }
  _edElStop() {
    const vb = this._edEl && this._edEl.vb;
    this._edEl = null;
    this.$('stage').classList.remove('edelmode');
    const o = this.shadowRoot.querySelector('.edelov'); if (o) o.remove();
    if (vb) { this.$('edside').hidden = !this._editing; if (!this._editing) return; }
    this._edSide();
  }
  // Modul nach Änderung neu aufbauen und Element-Rahmen nachziehen
  _edElApply() {
    const E = this._edEl; if (!E) return;
    const rec = this._edRec(E.fi, E.mi); if (!rec || !rec.el) return;
    rec.el.setConfig(E.vb ? this._zoomCfg(this._c.frames[E.fi].modules[E.mi]) : this._edMod(E.fi, E.mi));
    this._dirty = true;
    requestAnimationFrame(() => requestAnimationFrame(() => this._edElDraw()));
  }
  // Bedienrahmen über den Elementen (Zellen) des Moduls
  _edElDraw() {
    const E = this._edEl; if (!E) return;
    const rec = this._edRec(E.fi, E.mi); if (!rec || !rec.el || !rec.el.shadowRoot) return;
    const st = this.$('stage'), sr = st.getBoundingClientRect(), k = sr.width / st.offsetWidth || 1, hr = rec.el.getBoundingClientRect();
    let ov = this.shadowRoot.querySelector('.edelov');
    if (!ov) { ov = document.createElement('div'); ov.className = 'edelov'; st.appendChild(ov); }
    Object.assign(ov.style, { left: (hr.left - sr.left) / k + 'px', top: (hr.top - sr.top) / k + 'px', width: hr.width / k + 'px', height: hr.height / k + 'px' });
    const seen = new Set();
    // freie Rahmenform: Elemente, die über die Kante ragen, rot markieren
    const fel = (this._frames[E.fi] || {}).el, PP = fel && fel.classList.contains('poly') ? fel._poly : null, fr = PP && fel.getBoundingClientRect();
    rec.el.shadowRoot.querySelectorAll('#box .cell').forEach(cell => {
      if (cell.style.display === 'none') return;
      const n = cell.dataset.part, r = cell.getBoundingClientRect(); seen.add(n);
      const out = !!PP && [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]].some(([x, y]) => !polyIn(PP, (x - fr.left) / k, (y - fr.top) / k));
      let b = ov.querySelector(`.edel[data-part="${n}"]`);
      if (!b) {
        b = document.createElement('div'); b.className = 'edel'; b.dataset.part = n;
        b.innerHTML = `<span>${n}</span><div class="edrs" title="Größe ändern"></div>`;
        b.addEventListener('pointerdown', ev => this._edElDrag(ev, n, b));
        ov.appendChild(b);
      }
      b.classList.toggle('sel', E.sel === n); b.classList.toggle('out', out); b.title = out ? 'Ragt über die Kante des Rahmens' : '';
      // eingepasste Elemente (Drehregler): Rahmen eng um den sichtbaren Inhalt statt um die ganze Zelle
      const v = cell._vis, ck = r.width / (cell.offsetWidth || 1) || 1;
      const L0 = (r.left - hr.left) / k + (v ? v.x * ck / k : 0), T0 = (r.top - hr.top) / k + (v ? v.y * ck / k : 0);
      Object.assign(b.style, { left: L0 + 'px', top: T0 + 'px', width: (v ? v.w * ck : r.width) / k + 'px', height: (v ? v.h * ck : r.height) / k + 'px' });
    });
    ov.querySelectorAll('.edel').forEach(b => { if (!seen.has(b.dataset.part)) b.remove(); });
  }
  // Element ziehen (verschieben) bzw. an der Ecke ziehen (Größe) – rastet im Modul-Raster ein
  _edElDrag(ev, n, b) {
    ev.preventDefault(); ev.stopPropagation();
    const E = this._edEl, rec = this._edRec(E.fi, E.mi), m = this._edMod(E.fi, E.mi), g = rec.el._cg();
    if (E.sel !== n) { E.sel = n; this._edElDraw(); this._edElSide(); }
    const box = rec.el.$('box'), bk = box.getBoundingClientRect().width / box.offsetWidth || 1, P = parseFloat(box.style.padding) || 0;
    const W = box.offsetWidth - 2 * P, stepX = ((W - (g.columns - 1) * g.gap) / g.columns + g.gap) * bk, stepY = (g.row_height + g.gap) * bk;
    const e0 = Object.assign({ col: 1, row: 1, w: 1, h: 1 }, m.elements[n]), mode = ev.target.classList.contains('edrs') ? 'size' : 'move', sx = ev.clientX, sy = ev.clientY;
    try { b.setPointerCapture(ev.pointerId); } catch (e) { /* synthetische Zeiger */ }
    let last = '';
    const mv = e2 => {
      const dx = Math.round((e2.clientX - sx) / stepX), dy = Math.round((e2.clientY - sy) / stepY), key = dx + ',' + dy;
      if (key === last) return; last = key;
      this._edElMove(n, e0, mode, dx, dy);
    };
    const up = () => { b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); this._edElSide(); };
    b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  _edElMove(n, e0, mode, dx, dy) {
    const E = this._edEl, m = this._edMod(E.fi, E.mi), C = this._edRec(E.fi, E.mi).el._cg().columns, e = m.elements[n];
    if (mode === 'move') { e.col = clamp(e0.col + dx, 1, C - e0.w + 1); e.row = Math.max(1, e0.row + dy); }
    else { e.w = clamp(e0.w + dx, 1, C - e0.col + 1); e.h = Math.max(1, e0.h + dy); }
    this._edElApply();
  }
  // Seitenleiste im Element-Modus: Modul-Raster + Liste aller Elemente
  _edElSide() {
    const E = this._edEl; if (!E) return;
    const side = this.$('edside'), m = this._edMod(E.fi, E.mi), rec = this._edRec(E.fi, E.mi), g = rec && rec.el ? rec.el._cg() : { columns: 12, row_height: 20, gap: 6 };
    const els = m.elements || {};
    // alle Gruppen des Moduls: feste Liste + was im Modul tatsächlich vorkommt (z. B. automatik)
    const domParts = rec && rec.el && rec.el.shadowRoot ? [...rec.el.shadowRoot.querySelectorAll('#box [data-part]')].map(x => x.dataset.part).filter(x => !x.includes('.')) : [];
    const groups = [...new Set([...(this._edParts(m, rec) || []), ...domParts, ...Object.keys(els).filter(x => !x.includes('.'))])];
    const parts = groups.flatMap(n => [n, ...Object.keys(els).filter(x => x.startsWith(n + '.'))]);
    const num = (k, v, ph = '', ex = '') => `<input type="number" data-k="${k}" value="${v ?? ''}" placeholder="${ph}" ${ex}>`;
    const fm = E.vb ? (this._c.frames[E.fi].modules || []).map((x, i) => [x, i]).filter(([x, i]) => x && typeof x === 'object' && this._edParts(x, this._edRec(E.fi, i))) : [];
    side.innerHTML = `<h3>${E.vb ? 'Vollbild · ' : 'Elemente · '}${ED_NAMES[m.type] || m.type} (Rahmen #${E.fi + 1})</h3>
      ${E.vb ? `<div class="ednote">Gilt nur für die vergrößerte Ansicht (Schlüssel <b>vollbild:</b> im Modul). Danach „YAML“ kopieren und in die Dashboard-Datei einfügen – sonst ist es nach dem Neuladen weg.</div>
      ${fm.length > 1 ? `<div class="edbtns">${fm.map(([x, i]) => `<button data-ed="zmod" data-i="${i}"${i === E.mi ? ' class="pri"' : ''}>${ED_NAMES[x.type] || x.type}</button>`).join('')}</div>` : ''}
      <div class="edbtns"><button data-ed="zyaml" class="pri">YAML</button><button data-ed="zfit" title="Raster so erweitern, dass es den ganzen Bildschirm füllt">An Bildschirm anpassen</button><button data-ed="zauto" title="vollbild: entfernen – Modul ordnet sich wieder selbst an">Zurück zu automatisch</button></div>`
      : `<div class="ednote">Gilt für die Karte auf dem Dashboard. Danach „YAML“ kopieren und unter dem Modul in die Dashboard-Datei einfügen – sonst ist es nach dem Neuladen weg.</div>
      <div class="edbtns"><button data-ed="zyaml" class="pri">YAML (nur Anordnung)</button><button data-ed="elfull" title="Modul auf die ganze Breite/Höhe des Rahmens erweitern – Elemente über einer Schräge werden rot markiert">Ganzen Rahmen nutzen</button><button data-ed="eloff">Zurück zu automatisch</button></div>`}
      <div class="ednote">Elemente im Modul ziehen = verschieben, Ecke = Größe, Pfeiltasten = 1 Feld (mit Umschalt: Größe).</div>
      <div class="ed4"><div><label>Spalten</label>${num('eg.columns', (m.grid || {}).columns, 12, 'min="1" max="48"')}</div><div><label>Zeilenhöhe</label>${num('eg.row_height', (m.grid || {}).row_height, 20, 'min="4"')}</div>
      <div><label>Abstand</label>${num('eg.gap', (m.grid || {}).gap, 6, 'min="0"')}</div><div><label>Breite</label>${num('eg.width', (m.grid || {}).width, rec && rec.el ? Object.values(rec.el.variants())[0].bw : '', 'min="100"')}</div></div>
      <div class="ednote">„Breite“ = Design-Breite des Moduls in px: größer = mehr Platz, alles wirkt kleiner.</div>
      ${parts.map(n => {
        const e = els[n], on = !!e, isSub = n.includes('.'), sp = !isSub && (this._edSubs(rec, m.type, n) || (Object.keys(els).some(x => x.startsWith(n + '.')) ? { subs: [] } : null)), split = sp && Object.keys(els).some(x => x.startsWith(n + '.'));
        const btn = sp ? (split ? `<button data-ed="elmerge" data-i="${n}" title="Einzelteile wieder zur Gruppe zusammenfassen">⇱ zusammen</button>` : `<button data-ed="elsplit" data-i="${n}" title="Gruppe in einzelne Bedienelemente zerlegen">⇲ zerlegen</button>`) : '';
        if (!on && isSub) return '';
        const tx = isSub && rec && rec.el && rec.el.shadowRoot ? ((rec.el.shadowRoot.querySelector(`#box [data-sub="${n}"]`) || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18) : '';
        return `<div class="edmod" style="${E.sel === n ? 'border-color:#ffb347;' : ''}${isSub ? 'margin-left:14px' : ''}"><div class="t"><label style="display:flex;gap:6px;align-items:center;flex:1"><input type="checkbox" data-k="el.${n}.on"${on ? ' checked' : ''}><span>${n}${tx ? ` <small style="color:#8a93a3">${escH(tx)}</small>` : ''}</span></label>${btn}</div>
          ${on ? `<div class="ed4"><div><label>Spalte</label>${num(`el.${n}.col`, e.col, 1, 'min="1"')}</div><div><label>Reihe</label>${num(`el.${n}.row`, e.row, 1, 'min="1"')}</div>
          <div><label>Breite</label>${num(`el.${n}.w`, e.w, 1, 'min="1"')}</div><div><label>Höhe</label>${num(`el.${n}.h`, e.h, 1, 'min="1"')}</div></div>
          <div class="ed4" style="grid-template-columns:2fr 1fr"><div><label>Ausrichtung</label><select data-k="el.${n}.align">${ED_ALIGN.map(([o, t]) => `<option value="${o}"${String(e.align || '') === o ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
          <div><label>Zoom</label>${num(`el.${n}.zoom`, e.zoom, 1, 'step="0.05" min="0.2" max="3"')}</div></div>
          <div class="ed4"><div><label>Schrift ×</label>${num(`el.${n}.schriftgroesse`, e.schriftgroesse, m.schriftgroesse ?? 1, 'step="0.05" min="0.5" max="3" title="Faktor für die Schrift: 1 = wie bisher, 1.3 = größer. Wächst nur so weit, wie der Inhalt noch in seinen Platz passt."')}</div></div>
          ${rec && rec.el && rec.el.shadowRoot && rec.el.shadowRoot.querySelector(`[data-part="${n}"] .lcd, [data-part="${n}"].lcd`) ? `<div class="ed4"><div><label>Display-Transp. %</label>${num(`el.${n}.transparenz`, e.transparenz, m.display_transparenz ?? '', 'min="0" max="100" step="5" title="0 = wie bisher, 100 = schwarzer Display-Hintergrund ganz durchsichtig (Schrift bleibt)"')}</div></div>` : ''}` : ''}</div>`;
      }).join('')}
      <div class="edbtns"><button data-ed="eldone" class="pri" style="background:#1b4f6b;border-color:#2f7fa8">${E.vb ? 'Fertig' : 'Fertig (zurück zum Rahmen)'}</button></div>`;
  }
  // Gruppe n in Einzelteile zerlegen (an ihrer jetzigen Stelle) bzw. wieder zusammenfassen
  _edSubs(rec, type, n) {
    const st = (ED_SUBS[type] || {})[n]; if (st) return st;
    const sr = rec && rec.el && rec.el.shadowRoot; if (!sr) return null;
    const subs = [...sr.querySelectorAll(`#box [data-sub^="${n}."]`)].map(x => x.dataset.sub.slice(n.length + 1)).filter(x => !x.includes('.'));
    return subs.length > 1 ? { subs, auto: true } : null;
  }
  _edElSplit(n, on) {
    const E = this._edEl; if (!E) return;
    const m = this._edMod(E.fi, E.mi), rec = this._edRec(E.fi, E.mi), sp = this._edSubs(rec, m.type, n); if (!sp || !rec || !rec.el) return;
    const g = rec.el._cg(), els = m.elements = m.elements || {}, pre = n + '.';
    if (on) {
      for (const t of sp.subs) {
        const node = rec.el.shadowRoot.querySelector(`#box [data-sub="${pre + t}"]`); if (!node) continue;
        const e = rec.el._gridPos(node, g.columns, g.row_height, g.gap); if (e) els[pre + t] = e;
      }
      if (!sp.keep) delete els[n];
      E.sel = Object.keys(els).find(x => x.startsWith(pre)) || null;
    } else {
      // umschließende Fläche der Teile = neue Gruppe
      const ps = Object.keys(els).filter(x => x.startsWith(pre)).map(x => els[x]);
      if (ps.length && !els[n]) { const c0 = Math.min(...ps.map(e => e.col)), r0 = Math.min(...ps.map(e => e.row)); els[n] = { col: c0, row: r0, w: Math.max(...ps.map(e => e.col + e.w)) - c0, h: Math.max(...ps.map(e => e.row + e.h)) - r0 }; }
      for (const x of Object.keys(els)) if (x.startsWith(pre)) delete els[x];
      E.sel = n;
    }
    this._edElApply(); this._edElSide();
  }
  _edElField(el) {
    const E = this._edEl, m = this._edMod(E.fi, E.mi), k = el.dataset.k;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = v === '' ? undefined : Number(v); else if (el.type !== 'checkbox' && v === '') v = undefined;
    if (k.startsWith('eg.')) { m.grid = m.grid || {}; if (v === undefined) delete m.grid[k.slice(3)]; else m.grid[k.slice(3)] = v; if (!Object.keys(m.grid).length) delete m.grid; this._edElApply(); return; }
    const ks = k.split('.'), key = ks.pop(), n = ks.slice(1).join('.');
    m.elements = m.elements || {};
    if (key === 'on') {
      if (v) { const g = this._edRec(E.fi, E.mi).el._cg(), maxR = Math.max(0, ...Object.values(m.elements).map(e => (e.row || 1) + (e.h || 1) - 1)); m.elements[n] = { col: 1, row: maxR + 1, w: g.columns, h: 3 }; E.sel = n; }
      else { delete m.elements[n]; if (E.sel === n) E.sel = null; }
      this._edElApply(); this._edElSide(); return;
    }
    const e = m.elements[n]; if (!e) return;
    if (v === undefined) delete e[key]; else e[key] = v;
    E.sel = n; this._edElApply();
  }

  _drawGrid() {
    const cv = this.$('dbg'), G = this._geo; if (!cv || !G) return;
    cv.width = G.w; cv.height = G.h; const x = cv.getContext('2d'); x.strokeStyle = '#4dc3ff'; x.lineWidth = 1;
    for (let i = 0; i <= this._c.grid.columns; i++) { x.beginPath(); x.moveTo(G.inset + i * G.bw, G.inset); x.lineTo(G.inset + i * G.bw, G.h - G.inset); x.stroke(); }
    for (let j = 0; j <= this._c.grid.rows; j++) { x.beginPath(); x.moveTo(G.inset, G.inset + j * G.bh); x.lineTo(G.w - G.inset, G.inset + j * G.bh); x.stroke(); }
    // Linien-Nummern (ab 1 = Rand) – genau die Zahlen für ecken:, Spalte/Reihe; über den Rahmen an allen vier Rändern
    const nv = this.$('dbgn'); if (!nv) return; nv.width = G.w; nv.height = G.h; const n = nv.getContext('2d');
    const fs = Math.max(8, Math.min(12, G.bw * .42)), tag = (t, cx, cy) => { const w = n.measureText(t).width + 4, h = fs + 2; n.fillStyle = 'rgba(4,10,20,.78)'; n.fillRect(cx - w / 2, cy - h / 2, w, h); n.fillStyle = '#9fd8ff'; n.fillText(t, cx, cy + .5); };
    n.font = `${fs.toFixed(0)}px sans-serif`; n.textAlign = 'center'; n.textBaseline = 'middle';
    const C = this._c.grid.columns, R = this._c.grid.rows, yT = G.inset + fs * .7, yB = G.h - G.inset - fs * .7, xL = G.inset + fs, xR = G.w - G.inset - fs;
    for (let i = 0; i <= C; i++) { const xx = clamp(G.inset + i * G.bw, fs, G.w - fs); tag(String(i + 1), xx, yT); tag(String(i + 1), xx, yB); }
    for (let j = 1; j < R; j++) { const yy = G.inset + j * G.bh; tag(String(j + 1), xL, yy); tag(String(j + 1), xR, yy); }
  }

  _tick() { if (!this._built) return; this._sky(new Date()); this._auroraMove(); this._cdApply(); }
  // Bettseite dieses Panels (aus seinen Modulen) – für die Hintergrund-Einstellung aus der Wecker-Integration
  _bgSide() { if (this._raw && this._raw.seite) return this._raw.seite; const m = ((this._c && this._c.frames) || []).flatMap(f => f.modules || []).find(x => x && x.seite); return m ? m.seite : null; }
  // wirksame Einstellung: background: in YAML, überschrieben von den Einstellungen der Bettseite (MariaDB)
  _bgCfg() {
    const y = this._c.background, sd = this._bgSide(), s = sd && WK.snap && WK.snap.hintergrund ? WK.snap.hintergrund[sd] : null;
    return L({ art: y.art || 'aurora', farbe: y.farbe || '#101a2c', bild: y.bild || '', diashow_min: y.diashow_min || 10, abdunkeln: y.abdunkeln ?? 25, blick: y.blick ?? 180, glas_blur: y.blur, glas_deckkraft: Math.round(y.opacity * 100) }, s || {});
  }
  // Deckkraft der Glasrahmen (0–1) aus den Einstellungen, sonst background.opacity
  _bgOp() { const g = this._bgCfg(); return g.glas_deckkraft != null ? clamp(g.glas_deckkraft / 100, .05, .95) : this._c.background.opacity;
  }
  // Schrift: Bett-Tablets = Einstellung „Erscheinungsbild“ (Wecker-Integration), sonst YAML schrift:, sonst global (charlie)
  _cdMode() {
    const s = this._bgSide() && WK.snap && WK.snap.hintergrund && WK.snap.hintergrund[this._bgSide()];
    if (s && s.schrift) return s.schrift;
    if (this._raw && this._raw.schrift) return this._raw.schrift;
    return cdDefault() ? 'charlie' : 'standard';
  }
  // Schrift auf das Panel und alle Module (eigene Shadow-Roots) anwenden
  _cdApply() {
    if (!this._built) return;
    const on = this._cdMode() === 'charlie';
    const roots = [this.shadowRoot], walk = r => { for (const e of r.querySelectorAll('*')) if (e.shadowRoot && CD_TAGS.test(e.tagName)) { roots.push(e.shadowRoot); walk(e.shadowRoot); } };
    walk(this.shadowRoot);
    for (const r of roots) cdSet(r, on);
    if (on && document.fonts && !this._cdLoad) { this._cdLoad = true; document.fonts.load("40px 'RP Charlie Punkte'").then(() => document.fonts.load("40px 'RP Charlie Voll'")).then(() => roots.forEach(cdMark)).catch(() => {}); }
  }
  _bgApply() {
    this._cdApply();
    const $ = this.$, st = $ && $('stage'); if (!st || this._c.background.mode === 'off') return;
    const g = this._bgCfg(), art = g.art, key = JSON.stringify(g), sky = $('sky'), cel = $('cel'), img = $('bgimg');
    if (sky) { sky.style.display = art === 'aurora' || art === 'beides' ? '' : 'none'; sky.classList.toggle('still', !this._c.background.animate || g.perf_aurora === false); }
    cel.classList.toggle('on', art === 'himmel' || art === 'beides'); cel.classList.toggle('nograd', art === 'beides');
    st.style.setProperty('--dk', art === 'aurora' || art === 'beides' ? 0 : clamp((g.abdunkeln || 0) / 100, 0, .9));
    this._fpsSet(g.perf_anzeige === true);
    st.style.setProperty('--pbf', g.perf_blur === false ? 'none' : `blur(${clamp(Number(g.glas_blur ?? this._c.background.blur), 0, 30)}px) saturate(1.25)`);
    this._zpreSchedule();
    if (art === 'farbe') { st.style.backgroundColor = g.farbe; st.style.setProperty('--pa1', this._bgOp()); st.style.setProperty('--pa2', Math.min(1, this._bgOp() + .1)); }
    img.classList.toggle('on', art === 'bild');
    if (art !== 'bild') { clearTimeout(this._bgT); this._bgList = null; }
    if (this._bgKey !== key) { this._bgKey = key; this._skyOn = false; if (art === 'bild') this._bgImg(true); this._tick(); }
  }
  // Bild aus /media/wallpaper (eins oder alle als Diashow, Wechsel alle diashow_min Minuten)
  async _bgImg(fresh) {
    clearTimeout(this._bgT);
    const g = this._bgCfg(), h = this._hass, el = this.$ && this.$('bgimg'); if (!h || !el || g.art !== 'bild') return;
    try {
      if (fresh || !this._bgList) {
        const r = await h.callWS({ type: 'media_source/browse_media', media_content_id: 'media-source://media_source/local/wallpaper' });
        const all = (r.children || []).filter(x => x.media_class === 'image' || /\.(jpe?g|png|webp|gif|avif)$/i.test(x.media_content_id)).map(x => x.media_content_id);
        this._bgList = g.bild && all.includes(g.bild) ? [g.bild] : all; this._bgIdx = -1;
      }
      if (!this._bgList.length) { el.style.backgroundImage = ''; return; }
      this._bgIdx = (this._bgIdx + 1) % this._bgList.length;
      const { url } = await h.callWS({ type: 'media_source/resolve_media', media_content_id: this._bgList[this._bgIdx] });
      await new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = url; });
      el.style.backgroundImage = `url("${url}")`;
      if (this._bgList.length > 1) this._bgT = setTimeout(() => this._bgImg(false), Math.max(1, g.diashow_min) * 60000);
    } catch (e) { console.warn('raum-panel Hintergrundbild', e); }
  }
  // Himmel: Farbverlauf nach Sonnenhöhe, Sterne bei Nacht, Sonne und Mond (mit Phase) an ihrer echten Position.
  // Über die ganze Breite: Aufgang links, höchster Stand mittig oben (bezogen auf den Höchststand des Tages), Untergang rechts.
  _celDraw(d) {
    const $ = this.$, cel = $ && $('cel'); if (!cel || !cel.classList.contains('on')) return;
    const bg = this._c.background, hc = (this._hass && this._hass.config) || {}, g = this._bgCfg();
    const a = AST(d, bg.latitude ?? hc.latitude ?? 51, bg.longitude ?? hc.longitude ?? 10), W = cel.clientWidth, H = cel.clientHeight; if (!W || !H) return;
    if (bg.fixed && bg.fixed.elevation != null) { a.sun.el = bg.fixed.elevation; if (bg.fixed.azimuth != null) a.sun.az = bg.fixed.azimuth; }
    const py = o => .9 - clamp(o.el / Math.max(15, o.top), -.15, 1) * .8;
    const [top, hor] = celSky(a.sun.el);
    $('cgr').style.background = `linear-gradient(180deg,${top},${hor} 92%)`;
    // Sterne einmal je Größe zeichnen, Deckkraft nach Dunkelheit
    const cv = $('stars');
    if (cv.width !== W || cv.height !== H) {
      cv.width = W; cv.height = H; const x = cv.getContext('2d'); let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < Math.round(W * H / 5200); i++) { const yy = rnd() * H * .88; x.globalAlpha = .25 + rnd() * .75 * (1 - yy / H * .6); x.fillStyle = rnd() < .12 ? '#ffe6c8' : '#e8eeff'; x.beginPath(); x.arc(rnd() * W, yy, .4 + rnd() * rnd() * 1.4, 0, 7); x.fill(); }
    }
    cv.style.opacity = clamp((-a.sun.el - 3) / 9, 0, 1).toFixed(2);
    const U = Math.min(W, H), vis = (o, h) => clamp((o.el + h) / 4, 0, 1);
    // Sonne
    const sb = $('sunb'), sr = U * .07, sl = clamp(a.sun.el / 25, 0, 1);
    sb.style.cssText = `left:${(a.sun.x * W - sr / 2).toFixed(1)}px;top:${(py(a.sun) * H - sr / 2).toFixed(1)}px;width:${sr.toFixed(1)}px;height:${sr.toFixed(1)}px;opacity:${vis(a.sun, 2).toFixed(2)};--sr:${sr.toFixed(1)}px;--sc:${mixHex('#ff9a3c', '#ffe9a8', sl)};--sg:${sl < .5 ? 'rgba(255,150,70,.5)' : 'rgba(255,225,150,.45)'}`;
    // Mond: beleuchteter Teil (Phase), helle Seite zur Sonne gedreht; tagsüber blasser
    const mb = $('moonb'), mr = U * .085, k = a.moon.frac, R = 46, rx = (R * Math.abs(1 - 2 * k)).toFixed(2);
    const lit = k < .005 ? '' : `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx} ${R} 0 0 ${k < .5 ? 0 : 1} 0 ${-R}Z`;
    $('mlit').setAttribute('d', lit); $('mlitc').setAttribute('d', lit);
    const dx = (a.sun.x - a.moon.x) * W, dy = (py(a.sun) - py(a.moon)) * H;   // helle Seite zur Sonne
    $('mrot').setAttribute('transform', `rotate(${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1)})`);
    const day = clamp((a.sun.el + 4) / 10, 0, 1);
    mb.style.cssText = `left:${(a.moon.x * W - mr / 2).toFixed(1)}px;top:${(py(a.moon) * H - mr / 2).toFixed(1)}px;width:${mr.toFixed(1)}px;height:${mr.toFixed(1)}px;opacity:${(vis(a.moon, 2) * (1 - day * .45)).toFixed(2)};--mr:${mr.toFixed(1)}px;--mg:${(.5 * (1 - day)).toFixed(2)}`;
    this._astro = a;
    if (!cel.classList.contains("live")) requestAnimationFrame(() => cel.classList.add("live"));
  }
  _auroraMove() {
    const sk = this.$('sky'); if (!sk || sk.classList.contains('still')) return;
    const now = Date.now(), rnd = (a, b) => a + Math.random() * (b - a), BASE = [-7, 6, -3, 11];
    const tf = this._bgSide() ? clamp(Number(this._bgCfg().aurora_tempo) || 1, .25, 4) : 1;   // Einstellungen → Erscheinungsbild → Aurora-Tempo
    sk.querySelectorAll('.au').forEach((e, n) => {
      if (e._next && now < e._next) return;
      const td = rnd(20, 34) * tf;
      e.style.setProperty('--td', `${td.toFixed(1)}s`);
      e.style.transform = `translate(${rnd(-16, 16).toFixed(1)}%,${rnd(-12, 12).toFixed(1)}%) rotate(${(BASE[n] + rnd(-16, 16)).toFixed(1)}deg) scale(${rnd(.82, 1.22).toFixed(2)},${rnd(.8, 1.3).toFixed(2)})`;
      e._next = now + td * rnd(600, 850);
    });
  }
  _sky(d) {
    const bg = this._c.background; if (!bg || bg.mode === 'off') return;
    const art = this._bgCfg().art;
    if (art !== 'aurora' && art !== 'beides') {
      const hc = (this._hass && this._hass.config) || {}, s = AST(d, bg.latitude ?? hc.latitude ?? 51, bg.longitude ?? hc.longitude ?? 10).sun;
      if (art !== 'farbe') { this.$('stage').style.backgroundColor = '#0b0d12'; this.$('stage').style.setProperty('--pa1', this._bgOp()); this.$('stage').style.setProperty('--pa2', Math.min(1, this._bgOp() + .1)); }
      this._sun = { el: s.el, az: s.az }; this._glint(); this._celDraw(d); return;
    }
    this._skyAurora(d); this._celDraw(d);
  }
  _skyAurora(d) {
    const bg = this._c.background;
    const hc = (this._hass && this._hass.config) || {};
    let { elevation: el, rising } = bg.fixed || {};
    if (el == null) {
      const sun = bg.sun && this._hass ? this._hass.states[bg.sun] : null;
      if (sun && sun.attributes.elevation != null) { el = sun.attributes.elevation; rising = sun.attributes.rising; }
      else ({ el, rising } = sunPos(d, bg.latitude ?? hc.latitude ?? 51, bg.longitude ?? hc.longitude ?? 10));
    }
    const p = skyAt(el, rising), $ = this.$, sk = $('sky'); if (!sk) return;
    const all = [$('stage'), sk, ...sk.children];
    if (!this._skyOn) all.forEach(e => { e.style.transition = 'none'; });
    $('stage').style.backgroundColor = p.base;
    sk.style.opacity = p.i;
    const lum = p.c.reduce((s, c) => s + c.match(/\d+/g).reduce((a, v) => a + +v, 0) / 765, 0) / 4 * p.i;
    const pa = clamp(this._bgOp() + Math.max(0, lum - .35) * .5, 0, .95);
    $('stage').style.setProperty('--pa1', pa.toFixed(3)); $('stage').style.setProperty('--pa2', Math.min(1, pa + .1).toFixed(3));
    sk.querySelectorAll('.au').forEach((e, n) => { e.style.color = p.c[n]; });
    $('wash').style.backgroundColor = p.c[1];
    if (!this._skyOn) { sk.offsetWidth; all.forEach(e => { e.style.transition = ''; }); this._skyOn = true; }
    // Azimut für den Sonnen-Schimmer: fest (Test), aus sun.sun oder berechnet
    let az = (bg.fixed || {}).azimuth;
    if (az == null) { const sun = bg.sun && this._hass ? this._hass.states[bg.sun] : null; az = sun && sun.attributes.azimuth != null ? sun.attributes.azimuth : sunPos(d, bg.latitude ?? hc.latitude ?? 51, bg.longitude ?? hc.longitude ?? 10).az; }
    this._sun = { el, az }; this._glint();
  }
  // glint: false = aus · glint_flip: true = Ost rechts (Tablet schaut nach Süden statt Norden)
  _glint() {
    const bg = this._c.background, st = this.$ && this.$('stage'), s = this._sun;
    if (!st || !s || !this._geo || !this._frames) return;
    const on = bg.glint !== false && bg.mode !== 'off';
    let x = clamp((s.az - 90) / 180, 0, 1); if (bg.glint_flip) x = 1 - x;
    const a = on ? clamp((s.el + 1) / 9, 0, 1) : 0, t = clamp(s.el / 30, 0, 1);
    const col = [255, Math.round(170 + 74 * t), Math.round(90 + 130 * t)];
    st.style.setProperty('--ga', a.toFixed(3)); st.style.setProperty('--gc', col.join(','));
    const sx = x * this._geo.w;
    for (const { el, cfg } of this._frames) {
      const sb = (cfg.modules || []).some(m => (typeof m === 'string' ? m : m && m.type) === 'statusbar');
      el.classList.toggle('nosun', sb);
      el.style.setProperty('--gx', (sx - el.offsetLeft).toFixed(1) + 'px');
    }
  }
}


// ================================================================ Bett-Tablets: Uhr, Wecker, Kodi-Fernbedienung, Bett-Anzeige
// Wecker-Daten kommen aus der Integration "wecker" (MariaDB) über ein gemeinsames WebSocket-Abo.
// Robust gegen hängende Verbindungen (Tablet nachts): eigenes Neu-Anmelden nach jedem Reconnect,
// Lebenszeichen an den Server (wecker/alive) mit Zeitlimit; Antwort rev zeigt verpasste Snapshots → neu abonnieren;
// keine Antwort → Verbindung hart neu aufbauen, in Fully nach ~3 min Seite neu laden. Der Server-Wächter
// (Integration ≥ 1.4.0) lädt das Dashboard zusätzlich per Fully neu und weckt notfalls selbst.
const WK = { subs: new Set(), snap: null, unsub: null, conn: null, err: null, skew: 0, tok: null, mods: new Set(), fail: 0, beatAt: 0, busy: false, last: 0, wd: null, rdy: null };
function wkOpen() {
  const conn = WK.conn; if (!conn) return;
  if (WK.unsub) { WK.unsub.then(u => u && u()).catch(() => {}); WK.unsub = null; }
  const tok = WK.tok = {}; WK.err = null;
  WK.unsub = conn.subscribeMessage(s => {
    if (WK.tok !== tok) return;
    WK.snap = s; WK.err = null; WK.last = Date.now(); WK.skew = Date.parse(s.now) - Date.now(); WK.subs.forEach(f => f(s));
  }, { type: 'wecker/subscribe' }, { resubscribe: false })
    .catch(e => { if (WK.tok !== tok) return null; WK.err = (e && (e.message || e.code)) || 'Fehler'; WK.unsub = null; WK.subs.forEach(f => f(WK.snap)); return null; });
}
const wkTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ timeout: true }), ms))]);
async function wkBeat(force) {
  const conn = WK.conn; if (!conn || !WK.subs.size || WK.busy) return;
  const now = Date.now(), ring = [...WK.mods].some(m => m._r && m._r.state === 'ringing');
  if (!force && now - WK.beatAt < (ring ? 4000 : 30000)) return;
  WK.beatAt = now; WK.busy = true;
  // Kiosk-Tablet: Fully-JS-Schnittstelle oder Android-WebView (Fully ohne JS-Schnittstelle), nicht die HA-App
  const ua = navigator.userAgent, F = !!window.fully || (/; wv\)/.test(ua) && !/Home ?Assistant/i.test(ua)), vis = document.visibilityState !== 'hidden', sides = new Map();
  WK.mods.forEach(m => { const a = m._wkAlive(); const o = sides.get(a.seite); if (!o || a.playing) sides.set(a.seite, a); });
  if (!sides.size) sides.set('-', { seite: '-' });
  try {
    let rev = null;
    for (const a of sides.values()) {
      try {
        const r = await wkTimeout(conn.sendMessagePromise({ type: 'wecker/alive', seite: a.seite, playing: !!a.playing, ring: a.ring || null, visible: vis, fully: F, ua: navigator.userAgent.slice(0, 120) }), 10000);
        if (r && r.rev != null) rev = r.rev;
      } catch (e) { if (e && e.timeout) throw e; /* Server antwortet (z. B. alte Integration) → Verbindung lebt */ }
    }
    WK.fail = 0;
    if (WK.err || !WK.snap || (rev != null && WK.snap.rev != null && WK.snap.rev < rev && Date.now() - WK.last > 3000)) {
      console.warn('wecker: Abo veraltet oder fehlgeschlagen – neu anmelden', { rev, snap: WK.snap && WK.snap.rev, err: WK.err });
      wkOpen();
    }
  } catch (e) {
    WK.fail++;
    console.warn('wecker: Server antwortet nicht', WK.fail);
    if (WK.fail === 2) { try { conn.reconnect(true); } catch (x) { /* ältere Frontend-Version */ } }
    if (WK.fail >= 6 && F) location.reload();
  } finally { WK.busy = false; }
}
function wkSub(hass, cb) {
  WK.subs.add(cb);
  if (WK.snap || WK.err) cb(WK.snap);
  if (hass && hass.connection && (!WK.unsub || WK.conn !== hass.connection)) {
    WK.conn = hass.connection;
    if (WK.rdy !== WK.conn) {
      WK.rdy = WK.conn;
      // nach jedem Wiederverbinden selbst neu abonnieren (verlässlicher als das automatische Resubscribe)
      WK.conn.addEventListener('ready', () => setTimeout(() => { if (WK.subs.size) { wkOpen(); wkBeat(true); } }, 800));
    }
    wkOpen();
  }
  if (!WK.wd) {
    WK.wd = setInterval(() => wkBeat(false), 2000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wkBeat(true); });
  }
  return () => {
    WK.subs.delete(cb);
    if (!WK.subs.size && WK.unsub) { WK.unsub.then(u => u && u()).catch(() => {}); WK.unsub = null; WK.tok = null; WK.snap = null; WK.conn = null; }
  };
}
const wkNow = () => Date.now() + (WK.skew || 0);
// Weckton laden: HA liefert .wav als "audio/vnd.wave", das Firefox nicht abspielt → als Blob mit passendem Typ
const WK_MIME = { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac' };
const WK_BLOB = new Map();
const wkSrc = url => {
  if (!WK_BLOB.has(url)) {
    const ext = (decodeURIComponent(url).split('?')[0].split('.').pop() || '').toLowerCase();
    WK_BLOB.set(url, fetch(url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(b => URL.createObjectURL(new Blob([b], { type: WK_MIME[ext] || 'audio/wav' })))
      .catch(e => { WK_BLOB.delete(url); throw e; }));
  }
  return WK_BLOB.get(url);
};
const WK_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const wkDaysTxt = d => { const s = [...(d || [])].sort().join(''); return !s ? 'Einmalig' : s === '0123456' ? 'Täglich' : s === '01234' ? 'Werktags' : s === '56' ? 'Wochenende' : [...d].sort().map(i => WK_DAYS[i]).join(' '); };
const wkIn = iso => {
  const ms = Date.parse(iso) - wkNow(); if (!(ms > 0)) return '';
  const m = Math.ceil(ms / 60000), h = Math.floor(m / 60);
  return h >= 24 ? `in ${Math.floor(h / 24)} T ${h % 24} Std` : h ? `in ${h} Std ${m % 60} Min` : `in ${m} Min`;
};
const wkDay = iso => {
  const d = new Date(iso), t = new Date(), tm = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
  if (d.toDateString() === t.toDateString()) return 'Heute';
  if (d.toDateString() === tm.toDateString()) return 'Morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
};
const wkDate = d => d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const wkLocalDate = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const wkGlow = (c, a) => { try { return /^#[0-9a-f]{3,6}$/i.test(c) ? rgba(c, a) : c; } catch (e) { return c; } };
const wkHm = t => { const [h, m] = String(t || '07:00').split(':').map(Number); return [h || 0, m || 0]; };
// Uhr-Zeitzone: Einstellung "server" = Zeitzone von Home Assistant, sonst die des Tablets
const wkTz = h => (WK.snap && WK.snap.uhr && WK.snap.uhr.zeitzone === 'server' && h && h.config && h.config.time_zone) || null;
const wkParts = (d, tz) => {
  if (!tz) return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), date: wkDate(d) };
  const f = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d), g = t => Number((f.find(x => x.type === t) || {}).value);
  return { h: g('hour') % 24, m: g('minute'), s: g('second'), date: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }) };
};
const wkHHMM = (iso, tz) => { const d = new Date(iso); return isNaN(d) ? '--:--' : d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) }); };
const wkInTime = (now, von, bis) => { const n = now.h != null ? now.h * 60 + now.m : now.getHours() * 60 + now.getMinutes(), [a, b] = [wkHm(von), wkHm(bis)].map(([h, m]) => h * 60 + m); return a <= b ? n >= a && n < b : n >= a || n < b; };

// Strich-Symbole (24er-Raster)
const SI = (p, w = 2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const BI = {
  alarm: SI('<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.2l2.6 1.8M3.5 5.5 6.5 3M20.5 5.5 17.5 3"/>'),
  snooze: SI('<path d="M5 9h6l-6 7h6M14 4h5l-5 6h5"/>'),
  plus: SI('<path d="M12 5v14M5 12h14"/>', 2.6),
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 5.5v13l8-6.5zM14 6h2.6v12H14zM18.4 6H21v12h-2.6z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2.4v12H6zM19 6v12l-9-6z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 6H18v12h-2.4zM5 6v12l9-6z"/></svg>',
  rew: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 6v12L3 12zM21 6v12l-8.5-6z"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 6v12L21 12zM3 6v12l8.5-6z"/></svg>',
  back: SI('<path d="M9 15 4 10l5-5"/><path d="M4 10h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  home: SI('<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
  menu: SI('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  info: SI('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.2"/>'),
  osd: SI('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h6M15 15h2"/>'),
  vup: SI('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>'),
  vdn: SI('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/>'),
  mute: SI('<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  up: SI('<path d="m5 15 7-7 7 7"/>', 3), down: SI('<path d="m5 9 7 7 7-7"/>', 3), left: SI('<path d="m15 5-7 7 7 7"/>', 3), right: SI('<path d="m9 5 7 7-7 7"/>', 3),
  bed: SI('<path d="M3 19V7M3 15h18v4M21 15v-2.5a3 3 0 0 0-3-3h-7V15"/><circle cx="7" cy="12" r="1.8"/>'),
  scale: SI('<rect x="3.5" y="4" width="17" height="16" rx="3.5"/><path d="M8 10a5 5 0 0 1 8 0M12 10l1.6-2.2"/>'),
  thermo: SI('<path d="M10 14.5V5.5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 11v5"/>'),
  heat: SI('<path d="M7 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M17 20c-2-3 2-5 0-8s2-5 0-8"/>'),
  note: SI('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  trash: SI('<path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13"/>'),
  x: SI('<path d="M6 6l12 12M18 6 6 18"/>', 2.6),
};

// Kippschalter (Liste + Editor)
const WK_SW_CSS = `
.wksw{width:58px;height:32px;border-radius:16px;position:relative;flex:none;background:#141518;box-shadow:inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.06);transition:background .2s,box-shadow .2s;cursor:pointer}
.wksw::after{content:"";position:absolute;left:3px;top:3px;width:26px;height:26px;border-radius:50%;background:linear-gradient(180deg,#4a4d53,#26272b);box-shadow:0 2px 4px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.15);transition:transform .2s,background .2s}
.wksw.on{background:linear-gradient(180deg,var(--accd,rgba(255,179,71,.3)),rgba(0,0,0,.2));box-shadow:inset 0 2px 5px #000,0 0 12px var(--accg)}
.wksw.on::after{transform:translateX(26px);background:radial-gradient(circle,var(--acc) 0 22%,transparent 27%),linear-gradient(180deg,#5a5d64,#2a2b2f)}
`;

// ---- Uhr
const UHR_CSS = `
.uk{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px 28px 18px;border-radius:22px}
.uk.ukc{display:block}.uk.ukc>.cgrid{width:100%;height:100%}
.uk-t{position:relative;font-size:156px;line-height:.9;letter-spacing:2px;z-index:1}
.uk-g,.uk-v{white-space:nowrap}
.uk-t i{display:inline-block;width:1ch;text-align:right;font-style:normal}
.uk.noghost .uk-g{display:none}
.uk-g{position:absolute;left:0;top:0;color:var(--uc);opacity:.05}
.uk-v{position:relative;color:var(--uc);text-shadow:0 0 22px var(--ug),0 0 4px var(--ug);transition:filter 2s,opacity 2s}
.uk-t small{font-size:.3em;margin-left:.12em;letter-spacing:1px}
/* eigene, dauerhafte Grafikebene: beim Blinken wird nichts umgebaut (sonst verschwindet auf manchen Tablets kurz der Display-Hintergrund) */
.uk-c{display:inline-block;transition:opacity .3s;will-change:opacity;transform:translateZ(0)}.uk-c.off{opacity:.12}
.uk-d{position:relative;z-index:1;font:600 23px Rajdhani,sans-serif;letter-spacing:4px;text-transform:uppercase;color:var(--uc);opacity:.72;transition:opacity 2s}
.uk-n{position:relative;z-index:1;display:flex;align-items:center;gap:10px;margin-top:4px;padding:7px 18px;border-radius:11px;background:rgba(255,255,255,.035);
  font:600 19px Rajdhani,sans-serif;letter-spacing:1.5px;color:#a4a8b0;white-space:nowrap;transition:opacity 2s}
.uk-n svg{width:24px;height:24px;flex:none;color:var(--uc);filter:drop-shadow(0 0 4px var(--ug))}
.uk-n b{font:400 24px 'Share Tech Mono',monospace;color:#eceef1}
.uk-n em{font-style:normal;color:#979ca5}
.uk-n.off{color:#8c919a}.uk-n.off svg{color:#8c919a;filter:none}
.uk-n.ring{color:#ffcf8a;animation:ukp .8s ease-in-out infinite alternate}.uk-n.snz{color:#9fc3ff}
@keyframes ukp{from{background:rgba(255,170,60,.08)}to{background:rgba(255,170,60,.3)}}
.uk.night .uk-v{filter:brightness(var(--nd,.5))}.uk.night .uk-d,.uk.night .uk-n{opacity:calc(var(--nd,.5) * .8)}
`;
class RPUhr extends RPModule {
  // freie Anordnung (layout: custom) möglich; Einpass-Art je Element
  static get KINDS() { return { time: 'fit' }; }
  static get CSS() { return UHR_CSS; }
  get meta() { return this.variants().wide; }
  // breit = Uhr + Datum + nächster Wecker · kompakt = nur die Uhr
  variants() { return { wide: { bw: 560, mh: 300 }, compact: { bw: 440, mh: 170, weight: .8, hide: ['date', 'next'] } }; }
  static getStubConfig() { return { seite: 'links' }; }
  // seite: Bettseite für "nächster Wecker" · sekunden · farbe · nacht: {von, bis, helligkeit} oder false
  norm(c) {
    const n = c.nacht ?? c.night;
    return { seite: c.seite || c.side || null, sec: !!(c.sekunden ?? c.seconds), color: c.farbe || c.color || '#ffb347',
      night: n === false ? null : L({ von: '22:00', bis: '06:30', helligkeit: .45 }, n || {}) };
  }
  html() {
    const c = this._c, g8 = '<i>8</i><i>8</i>', s = c.sec ? `<small>${g8}</small>` : '';
    const t = `<div class="uk-t mono"><div class="uk-g">${g8}<span class="uk-gc">:</span>${g8}${s}</div><div class="uk-v"><span id="uh">--</span><span class="uk-c" id="uc">:</span><span id="um">--</span>${c.sec ? '<small id="us">--</small>' : ''}</div></div>`;
    const p = { time: this.P('time', t), date: this.P('date', '<div class="uk-d" id="ud"></div>'), next: this.P('next', '<div class="uk-n off" id="un"></div>') };
    // freie Anordnung: Teile im Raster, das LCD bleibt die gemeinsame Fläche
    const cu = this._v === 'custom';
    return `<div class="uk lcd fill${cu ? ' ukc' : ''}" id="uk" style="--uc:${c.color};--ug:${wkGlow(c.color, .65)};--nd:${c.night ? c.night.helligkeit : 1}">${cu ? this._cgrid(p) : Object.values(p).join('')}</div>`;
  }
  onHass() { if (this._c.seite && !this._wkU) this._wkU = wkSub(this._hass, () => this._ukTick()); }
  onConnect() { clearInterval(this._ukI); this._ukI = setInterval(() => this._ukTick(), 1000); this._ukTick(); if (this._hass) this.onHass(); }
  onDisconnect() { clearInterval(this._ukI); if (this._wkU) { this._wkU(); this._wkU = null; } }
  update() { this._ukTick(); }
  _ukTick() {
    const $ = this.$; if (!$ || !$('uh')) return;
    const c = this._c, d = wkParts(new Date(), wkTz(this._hass));
    // nur schreiben, wenn sich etwas ändert (weniger Arbeit je Sekunde); jede Ziffer in eigener Zelle
    const dg = v => [...String(v).padStart(2, '0')].map(x => `<i>${x}</i>`).join('');
    this._html($('uh'), dg(d.h)); this._html($('um'), dg(d.m));
    if ($('us')) this._html($('us'), dg(d.s));
    // unbeleuchtete LEDs (88:88) ein/aus: Einstellungen → Erscheinungsbild
    const gs = c.seite && WK.snap && WK.snap.hintergrund ? WK.snap.hintergrund[c.seite] : null;
    $('uk').classList.toggle('noghost', !!gs && gs.led_geist === false);
    $('uc').classList.toggle('off', !c.sec && d.s % 2 === 1);
    if ($('ud').textContent !== d.date) $('ud').textContent = d.date;
    const nt = this._ukNight();
    $('uk').classList.toggle('night', !!nt && wkInTime(d, nt.von, nt.bis));
    if (nt) $('uk').style.setProperty('--nd', nt.helligkeit);
    if (c.seite) this._ukNext();
    else this._html($('un'), '');
  }
  // Nachtmodus: Einstellungen → Erscheinungsbild (je Bettseite), sonst YAML nacht:
  _ukNight() {
    const sd = this._c.seite, g = sd && WK.snap && WK.snap.hintergrund ? WK.snap.hintergrund[sd] : null;
    if (g && g.nacht_an != null) return g.nacht_an ? { von: g.nacht_von || '22:00', bis: g.nacht_bis || '06:30', helligkeit: clamp((g.nacht_hell ?? 45) / 100, .05, 1) } : null;
    return this._c.night;
  }
  _ukNext() {
    const s = WK.snap, el = this.$('un'), sd = this._c.seite;
    let cls = 'off', h;
    if (!s) h = `${BI.alarm}<span>${WK.err ? 'Wecker-Integration fehlt' : 'Wecker …'}</span>`;
    else if (s.seiten && !s.seiten[sd]) h = `${BI.alarm}<span>Bettseite „${escH(sd)}“ unbekannt (${Object.keys(s.seiten).map(escH).join(' | ')})</span>`;
    else {
      const rs = Object.values(s.rings || {}).filter(r => r.seite === sd), r = rs.find(x => x.state === 'ringing') || rs[0];
      const nx = (s.next || {})[sd];
      if (r && r.state === 'ringing') { cls = 'ring'; h = `${BI.alarm}<b>${escH(r.time || '')}</b><span>${escH(r.name || 'Wecker')} klingelt</span>`; }
      else if (r) { cls = 'snz'; h = `${BI.snooze}<span>Schlummert bis</span><b>${wkHHMM(r.until, wkTz(this._hass))}</b>`; }
      else if (nx) { cls = ''; h = `${BI.alarm}<span>${wkDay(nx.at)}</span><b>${escH(nx.time)}</b><span>${escH(nx.name)}</span><em>· ${wkIn(nx.at)}</em>`; }
      else h = `${BI.alarm}<span>Kein Wecker aktiv</span>`;
    }
    el.className = 'uk-n ' + cls; this._html(el, h);
  }
}

// ---- Wecker: Liste (Modul), Editor + Klingel-Fenster (Overlay des Panels)
const WK_CSS = WK_SW_CSS + `
.wkm .head .hk{width:54px;height:44px;flex:none;color:var(--acc)}.wkm .head .hk svg{width:22px;height:22px;filter:drop-shadow(0 0 4px var(--accg))}
.wkl{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;margin:14px -4px 0;padding:2px 4px 8px;display:flex;flex-direction:column;gap:10px;scrollbar-width:none}
.wkl::-webkit-scrollbar{display:none}
.wkr{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:4px 12px;align-items:center;padding:11px 13px 12px;border-radius:14px;cursor:pointer;
  background:rgba(0,0,0,.25);box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.05)}
.wkr .wkt{font-size:42px;line-height:1;color:#8c919a}
.wkr .wkx{grid-column:1/-1;min-width:0}
.wkr.on .wkt{color:var(--acc);text-shadow:0 0 14px var(--accg)}
.wkr .wkn{font-size:16px;font-weight:700;letter-spacing:1.5px;color:#8a8e96;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wkr.on .wkn{color:#e2e4e8}
.wkdy{display:flex;gap:4px;margin-top:4px}
.wkdy i{font:700 12px Rajdhani,sans-serif;font-style:normal;flex:1;max-width:38px;text-align:center;padding:2px 0;border-radius:4px;color:#9a9fa8;background:rgba(255,255,255,.035)}
.wkdy i.on{color:#16120b;background:#6f737c}.wkr.on .wkdy i.on{background:var(--acc);box-shadow:0 0 6px var(--accg)}
.wkdy b{font:700 11px Rajdhani,sans-serif;letter-spacing:1.5px;color:#8a8e96;text-transform:uppercase}
.wkr .wks{font-size:12.5px;font-weight:600;color:#979ca5;letter-spacing:.5px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wkr .wks b{color:var(--acc);font-weight:700}
.wkr.ring{box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 0 0 2px var(--acc),0 0 22px var(--accg);animation:wkrb 1s ease-in-out infinite alternate}
@keyframes wkrb{to{box-shadow:inset 0 2px 5px rgba(0,0,0,.5),0 0 0 2px var(--acc),0 0 4px var(--accg)}}
.wkempty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#8c919a;text-align:center;font-size:14px;letter-spacing:1px;line-height:1.4}
.wkempty svg{width:70px;height:70px;opacity:.35}
.wkempty b{font-size:19px;letter-spacing:3px;text-transform:uppercase;color:#8a8e96}
.wksel{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:12px;padding:3px;border-radius:10px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 5px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05)}
.wksel span{height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center;font:700 12.5px Rajdhani,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#9a9fa8;cursor:pointer}
.wksel span.on{color:var(--acc);background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12);text-shadow:0 0 8px var(--accg)}
.wkf{font-size:11.5px;font-weight:600;color:#8c919a;letter-spacing:.6px;margin-top:8px;min-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wkf.err{color:#ff8a8a}
`;
const WK_POP_CSS = `<style>${WK_SW_CSS}
.wkpop{position:absolute;inset:0;z-index:42;display:grid;place-items:center;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.wkpop[hidden],.wkring[hidden],.wkr-ch[hidden],.wkr-main[hidden]{display:none}
.wkbox{width:1260px;padding:18px 22px 20px;transform:scale(var(--su,1));display:flex;flex-direction:column;gap:14px;color:#c9ccd2;font-family:Rajdhani,'Segoe UI',sans-serif;line-height:1.2;-webkit-user-select:none;user-select:none}
.wkbox .head .sbtn{margin-left:auto}
.wke{display:grid;grid-template-columns:380px minmax(0,1fr) 330px;gap:22px}
.wkseg.wrap{flex-wrap:wrap;row-gap:6px}
.wkc{display:flex;flex-direction:column;gap:10px;min-width:0}
.wkc+.wkc{padding-left:24px;border-left:1px solid rgba(0,0,0,.55);box-shadow:inset 1px 0 0 rgba(255,255,255,.05)}
.wkc .cap{font-size:11px;margin-top:4px}
.wktime{display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 16px;border-radius:16px}
.wkts{display:flex;flex-direction:column;align-items:center;gap:10px;position:relative;z-index:1}
.wkts .hk{width:120px;height:44px}.wkts .hk svg{width:22px;height:22px}
.wkts b{font:400 104px 'Share Tech Mono',monospace;line-height:.95;color:var(--acc);text-shadow:0 0 18px var(--accg)}
.wkcol{font:400 84px 'Share Tech Mono',monospace;color:var(--acc);opacity:.75;position:relative;z-index:1}
.wkq{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.wkq .hk{height:30px;font-size:12px;letter-spacing:1px}
.wkbox input[type=text]{box-sizing:border-box;width:100%;height:38px;border:0;outline:0;border-radius:9px;padding:0 12px;font:600 16px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.6px;color:#e2e4e8;
  background:linear-gradient(180deg,#111214,#1a1b1e);box-shadow:inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.07);-webkit-user-select:text;user-select:text}
.wkbox input[type=text]:focus{box-shadow:inset 0 2px 5px #000,0 0 0 1px var(--acc)}
.wkdays{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.wkdays .hk{height:42px;font-size:14px;letter-spacing:1px;flex-direction:column;gap:4px}
.wkpre{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.wkpre .hk{height:30px;font-size:11.5px;letter-spacing:1px}
.wkbox .hk{--c:var(--acc)}
.wksnd{display:grid;grid-template-columns:1fr 1fr;gap:7px;max-height:170px;overflow-y:auto;padding:3px;margin:-3px;scrollbar-width:none}
.wkso{display:flex;align-items:center;gap:8px;height:36px;padding:0 5px 0 12px;border-radius:9px;font-size:13.5px;font-weight:600;letter-spacing:.5px;color:#9a9ea6;cursor:pointer;
  background:linear-gradient(180deg,#2a2c31,#202125);box-shadow:0 2px 0 #0b0b0c}
.wkso span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wkso.on{color:#f0f1f3;box-shadow:0 0 0 1px var(--acc),0 0 12px var(--accg)}
.wkso em{width:30px;height:28px;border-radius:7px;display:grid;place-items:center;flex:none;background:rgba(0,0,0,.35);color:var(--acc)}
.wkso em svg{width:15px;height:15px}.wkso em.pl{background:var(--acc);color:#141518}
.wkrow{display:flex;align-items:center;gap:12px;min-height:38px}
.wkrow .lb{flex:1;min-width:0;font:700 12.5px Rajdhani,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#a4a8b0}
.wkrow .lb small{display:block;font-size:11px;letter-spacing:.4px;color:#8c919a;text-transform:none;font-weight:600;margin-top:1px}
.wkst{display:flex;align-items:center;gap:6px}.wkst .hk{width:40px;height:34px;font-size:20px;letter-spacing:0}
.wkst b{min-width:76px;text-align:center;font:400 19px 'Share Tech Mono',monospace;color:#e2e4e8}
.wkseg{display:flex;gap:4px;padding:3px;border-radius:10px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 5px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05)}
.wkseg span{height:32px;padding:0 13px;border-radius:7px;display:flex;align-items:center;font:700 12px Rajdhani,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#9a9fa8;cursor:pointer}
.wkseg span.on{color:var(--acc);background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12);text-shadow:0 0 8px var(--accg)}
.wkvol{display:grid;grid-template-columns:56px 1fr 56px;align-items:center;gap:12px}
.wkvol span{font:700 11px Rajdhani,sans-serif;letter-spacing:1.5px;color:#9a9fa8;text-transform:uppercase}
.wkvol b{font:400 18px 'Share Tech Mono',monospace;color:#e2e4e8;text-align:right}
.wkrg{-webkit-appearance:none;appearance:none;width:100%;height:32px;margin:0;background:transparent;--p:50%}
.wkrg::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--acc) var(--p),#141518 var(--p));box-shadow:inset 0 2px 4px #000}
.wkrg::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:32px;margin-top:-12px;border-radius:7px;background:conic-gradient(from 110deg,#5a5d64,#1c1d20,#4a4d53,#16171a,#5a5d64);box-shadow:0 3px 6px rgba(0,0,0,.8),0 0 0 1px #000}
.wkrg::-moz-range-track{height:8px;border-radius:4px;background:#141518;box-shadow:inset 0 2px 4px #000}
.wkrg::-moz-range-progress{height:8px;border-radius:4px;background:var(--acc)}
.wkrg::-moz-range-thumb{width:24px;height:32px;border:0;border-radius:7px;background:#4a4d53;box-shadow:0 3px 6px rgba(0,0,0,.8),0 0 0 1px #000}
.wkdis{opacity:.32;pointer-events:none}
.wkbtn{display:flex;gap:10px;align-items:center}.wkbtn .hk{padding:0 18px;height:44px}.wkbtn .hk svg{width:18px;height:18px}.wkbtn .sp{flex:1}
.wkbtn .hk.red{color:#ff8a8a}.wkbtn .hk.red.on{background:linear-gradient(180deg,#5a2626,#3a1818);color:#ffd0d0}
.wkmsg{font-size:13px;font-weight:600;color:#ff8a8a;min-height:16px;letter-spacing:.4px}
/* Klingel-Fenster */
.wkring{position:absolute;inset:0;z-index:48;display:grid;place-items:center;background:radial-gradient(circle at 50% 38%,rgba(48,30,8,.94),rgba(4,4,6,.97) 72%);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.wkring.snz{background:radial-gradient(circle at 50% 38%,rgba(10,18,34,.95),rgba(3,4,7,.97) 72%)}
.wkrb{width:1200px;transform:scale(var(--su,1));display:flex;flex-direction:column;align-items:center;gap:8px;color:#c9ccd2;font-family:Rajdhani,'Segoe UI',sans-serif;line-height:1.1;-webkit-user-select:none;user-select:none}
.wkr-now{font:400 250px 'Share Tech Mono',monospace;line-height:.88;color:var(--acc);text-shadow:0 0 30px var(--accg),0 0 6px var(--accg);transition:font-size .3s}
.wkring:not(.snz) .wkr-now{animation:wkglow 1.1s ease-in-out infinite alternate}
.wkring.snz .wkr-now{color:#9fc3ff;text-shadow:0 0 24px rgba(120,170,255,.5)}
@keyframes wkglow{from{text-shadow:0 0 14px var(--accg)}to{text-shadow:0 0 54px var(--acc),0 0 10px var(--acc)}}
.wkr-c{animation:wkcol 1s steps(1) infinite}@keyframes wkcol{50%{opacity:.15}}
.wkr-date{font:600 24px Rajdhani,sans-serif;letter-spacing:5px;text-transform:uppercase;color:var(--acc);opacity:.7}
.wkring.snz .wkr-date{color:#9fc3ff}
.wkr-al{display:flex;align-items:center;gap:14px;margin-top:12px;padding:10px 24px;border-radius:14px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 6px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.05);
  font:600 22px Rajdhani,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#aeb2b9}
.wkr-al svg{width:32px;height:32px;color:var(--acc);filter:drop-shadow(0 0 6px var(--accg))}
.wkr-al b{font:400 40px 'Share Tech Mono',monospace;color:#eceef1;letter-spacing:1px}
.wkring:not(.snz) .wkr-al svg{animation:wkshake .45s ease-in-out infinite}
@keyframes wkshake{0%,100%{transform:rotate(0)}25%{transform:rotate(-15deg)}75%{transform:rotate(15deg)}}
.wkr-st{font:600 21px Rajdhani,sans-serif;letter-spacing:2.5px;color:#9fc3ff;min-height:26px;text-transform:uppercase;margin-top:4px}
.wkr-st b{font:400 26px 'Share Tech Mono',monospace;letter-spacing:1px;color:#d8e6ff}
.wkr-main{display:flex;align-items:center;gap:46px;margin-top:20px}
.wkr-snz{width:580px;height:176px;border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;
  font:700 42px Rajdhani,sans-serif;letter-spacing:9px;color:#1c1306;background:linear-gradient(180deg,#ffc770,#ff9a2a);
  box-shadow:0 8px 0 #7a4a10,0 14px 30px rgba(0,0,0,.6),0 0 70px rgba(255,170,60,.45),inset 0 2px 0 rgba(255,255,255,.5);transition:transform .08s}
.wkr-snz svg{width:46px;height:46px}
.wkr-snz small{font:700 18px Rajdhani,sans-serif;letter-spacing:3px;opacity:.7}
.wkr-snz:active{transform:translateY(6px);box-shadow:0 2px 0 #7a4a10,0 4px 12px rgba(0,0,0,.6),0 0 40px rgba(255,170,60,.4),inset 0 2px 0 rgba(255,255,255,.5)}
.wkr-snz.dis{display:none}
.wkr-off{position:relative;overflow:hidden;width:240px;height:88px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;touch-action:none;
  font:700 27px Rajdhani,sans-serif;letter-spacing:7px;color:#9a9ea6;background:linear-gradient(180deg,#34363b,#222327);box-shadow:0 5px 0 #0b0b0c,0 8px 14px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)}
.wkr-off small{font:700 11.5px Rajdhani,sans-serif;letter-spacing:1.5px;color:#979ca5}
.wkr-off::before{content:"";position:absolute;left:0;top:0;bottom:0;width:calc(var(--p,0) * 100%);background:linear-gradient(90deg,rgba(255,90,90,.12),rgba(255,90,90,.5))}
.wkr-off>*{position:relative}
.wkr-off.big{width:420px;height:110px;font-size:32px}
.wkr-ch{display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:10px}
.wkr-q{display:flex;gap:18px;align-items:center;padding:10px 32px;border-radius:16px;font:400 66px 'Share Tech Mono',monospace;color:#eceef1}
.wkr-q>*{position:relative;z-index:1}
.wkr-q u{text-decoration:none;min-width:2.4ch;padding:0 6px;border-bottom:4px solid var(--acc);color:var(--acc);text-align:center;text-shadow:0 0 12px var(--accg)}
.wkr-q.bad{animation:wkbad .4s}
@keyframes wkbad{20%,60%{transform:translateX(-14px)}40%,80%{transform:translateX(14px)}}
.wkr-pad{display:grid;grid-template-columns:repeat(3,124px);gap:12px}
.wkr-pad .hk{height:70px;font:700 34px Rajdhani,sans-serif;letter-spacing:0}.wkr-pad .hk svg{width:28px;height:28px}
.wkr-pad .hk.ok{color:#3ddc84}
.wkr-cb{display:flex;gap:12px}.wkr-cb .hk{height:40px;padding:0 20px}
.wkring.chal .wkr-now{font-size:96px}.wkring.chal .wkr-al{margin-top:2px;padding:6px 20px}.wkring.chal .wkr-al b{font-size:30px}.wkring.chal .wkr-st{display:none}.wkring.chal .wkr-pad .hk{height:62px}
.wkr-hint{font-size:17px;font-weight:600;color:#ff9a9a;letter-spacing:1px;min-height:20px;margin-top:6px}
</style>`;
const WK_LOCK = { rechnen: 'Rechenaufgabe', halten: '3 Sek. halten', keine: 'Sofort' };
const WK_RAMP = [[30, '30 s'], [60, '1 min'], [120, '2 min'], [300, '5 min'], [600, '10 min']];
// Vibrationsmuster (= Optionen des ESP32 „Bett Vibration“) und Klangregler des Soundsystems
const WK_VIB = [['puls', 'Puls'], ['welle', 'Welle'], ['herzschlag', 'Herzschlag'], ['sos', 'SOS'], ['steigend', 'Steigend'], ['dauer', 'Dauer']];
const WK_VDLY = [0, 10, 20, 30, 60, 120, 300];
const wkSec = s => !s ? 'sofort' : s < 60 ? s + ' s' : (s / 60) + ' min';
const WK_EQ = [['bass', 'Bass'], ['tiefen', 'Tiefen'], ['mitten', 'Mitten'], ['hoehen', 'Höhen']];

class RPWecker extends RPModule {
  // freie Anordnung (layout: custom) möglich; Einpass-Art je Element
  static get KINDS() { return { list: 'fill' }; }
  static get CSS() { return WK_CSS; }
  get meta() { return this.variants().tall; }
  variants() { return { tall: { bw: 330, mh: 480, fh: true }, wide: { bw: 600, mh: 340, fh: true } }; }
  static getStubConfig() { return { seite: 'links' }; }
  // seite: Bettseite (Wecker dieser Seite) · popup: Klingel-Fenster auf diesem Tablet · ton: Weckton hier abspielen
  norm(c) {
    const col = c.farbe || c.color || '#ffb347';
    return { seite: c.seite || c.side || 'links', title: c.titel || c.title || 'Wecker', color: col, glow: wkGlow(col, .6), dark: wkGlow(col, .28),
      popup: c.popup !== false, sound: (c.ton ?? c.sound) !== false, pick: (c.seitenwahl ?? c.side_select) === true };
  }
  html() {
    const c = this._c;
    const p = {
      head: this.P('head', `<div class="head"><span class="led" id="wk-led"></span><div class="t"><h2 class="eng">${escH(c.title)}</h2><p id="wk-sub">…</p></div><div class="hk" data-act="add">${BI.plus}</div></div>`),
      sel: c.pick ? this.P('sel', `<div class="wksel" id="wk-sel">${BETT_SEITEN.map(s => `<span data-act="side:${s}" data-s="${s}">${s === 'links' ? 'Links' : 'Rechts'}</span>`).join('')}</div>`) : '',
      // Liste füllt den Rest (die Hülle übernimmt flex:1, sonst würde sie nicht mitwachsen)
      list: this.P('list', '<div class="wkl" id="wk-list"></div>', 'flex:1;min-height:0;display:flex;flex-direction:column'),
      foot: this.P('foot', '<div class="wkf" id="wk-foot"></div>'),
    };
    return `<div class="vcol fill wkm" style="--acc:${c.color};--accg:${c.glow};--accd:${c.dark}">${this._v === 'custom' ? this._cgrid(p) : Object.values(p).join('')}</div>`;
  }
  onHass() { if (!this._wkU) this._wkU = wkSub(this._hass, s => this._wk(s)); }
  onConnect() {
    if (this._hass) this.onHass(); clearInterval(this._wkI); this._wkI = setInterval(() => this._wkTick(), 500);
    if (this._c.popup || this._c.sound) WK.mods.add(this);   // Einstellungs-Liste: popup/ton aus → zählt nicht
  }
  onDisconnect() { WK.mods.delete(this); clearInterval(this._wkI); if (this._wkU) { this._wkU(); this._wkU = null; } this._audStop(); this._pvStop(); this._hellBack(); }
  // Lebenszeichen für den Server-Wächter: läuft der Weckton hier wirklich?
  _wkAlive() {
    const r = this._r, a = this._aud, on = !!(r && r.state === 'ringing' && a && !a.paused && a.currentTime > 0 && !this._blocked);
    return { seite: this._c.seite, playing: on, ring: r && r.state === 'ringing' ? r.id : null };
  }
  bind() { this._wkList(); }
  _al(id) { return ((WK.snap && WK.snap.alarms) || []).find(a => a.id === id); }
  // angezeigte Bettseite (mit seitenwahl umschaltbar) – Klingeln/Ton nutzen weiter this._c.seite
  _sv() { return this._vside || this._c.seite; }
  _seiteName() { const s = WK.snap && WK.snap.seiten && WK.snap.seiten[this._sv()]; return (s && s.name) || this._sv(); }
  _ws(msg) { return this._hass.callWS(msg); }

  _wk(s) { this._wkList(); this._ring(); }
  _wkTick() {
    if (this._ringOn) this._ringTick();
    this._tc = (this._tc || 0) + 1;
    if (this._tc % 60 === 1) this._wkList();   // „in … Min“ alle 30 s auffrischen
  }
  _wkList() {
    const $ = this.$; if (!$ || !$('wk-list')) return;
    const s = WK.snap, sd = this._sv();
    this.shadowRoot.querySelectorAll('#wk-sel span').forEach(e => e.classList.toggle('on', e.dataset.s === sd));
    $('wk-sub').textContent = 'Bettseite ' + this._seiteName();
    if (!s) {
      this._html($('wk-list'), `<div class="wkempty">${BI.alarm}<b>${WK.err ? 'Nicht verfügbar' : 'Lade …'}</b>${WK.err ? 'Integration „wecker“ ist nicht geladen' : ''}</div>`);
      $('wk-foot').className = 'wkf' + (WK.err ? ' err' : ''); $('wk-foot').textContent = WK.err ? String(WK.err) : '';
      return;
    }
    const list = s.alarms.filter(a => a.seite === sd).sort((a, b) => a.time.localeCompare(b.time));
    const ring = Object.values(s.rings || {}).filter(r => r.seite === sd).map(r => r.id);
    $('wk-led').style.setProperty('--lc', list.some(a => a.enabled) ? this._c.color : '#3a3c41');
    const snd = u => { const f = (s.sounds || []).find(x => x.url === u); return f ? f.name : '–'; };
    this._html($('wk-list'), list.length ? list.map(a => {
      const days = a.days.length ? WK_DAYS.map((d, i) => `<i class="${a.days.includes(i) ? 'on' : ''}">${d}</i>`).join('') : `<b>${wkDaysTxt(a.days)}</b>`;
      const next = a.enabled && a.next ? `<b>${wkDay(a.next)}</b> ${wkIn(a.next)} · ` : a.skip_date ? '<b>einmal ausgelassen</b> · ' : '';
      return `<div class="wkr${a.enabled ? ' on' : ''}${ring.includes(a.id) ? ' ring' : ''}" data-act="edit:${a.id}">
        <div class="wkt mono">${a.time}</div>
        <div class="wkn">${escH(a.name)}</div><div class="wksw${a.enabled ? ' on' : ''}" data-act="toggle:${a.id}"></div>
        <div class="wkx"><div class="wkdy">${days}</div><div class="wks">${next}♪ ${escH(snd(a.sound_url))}${a.snooze ? ` · ${a.snooze_min} min` : ''}</div></div></div>`;
    }).join('') : `<div class="wkempty" data-act="add">${BI.alarm}<b>Kein Wecker</b>Mit ＋ einen Wecker anlegen</div>`);
    const nx = (s.next || {})[sd];
    $('wk-foot').className = 'wkf' + (s.db.connected ? '' : ' err');
    $('wk-foot').textContent = s.db.connected ? (nx ? `Nächster: ${wkDay(nx.at)} ${nx.time} · ${nx.name}` : 'Kein Wecker aktiv') : 'Datenbank nicht erreichbar – lokal gespeichert';
  }

  async act(cmd, arg, t) {
    if (cmd === 'side') { this._vside = arg; return this._wkList(); }
    if (cmd === 'add') return this._edOpen(null);
    if (cmd === 'edit') return this._edOpen(arg);
    if (cmd === 'toggle') { const a = this._al(arg); if (a) this._ws({ type: 'wecker/alarm/save', alarm: { id: a.id, enabled: !a.enabled } }).catch(e => console.warn('wecker', e)); return; }
    if (cmd === 'ed') return this._edAct(arg, t);
    if (cmd === 'r') return this._ringAct(arg, t);
  }

  // ---------------------------------------------------------------- Editor
  _pop() {
    const o = this._overlay();
    if (!o.querySelector('#wkcss')) {
      o.insertAdjacentHTML('beforeend', `<div id="wkcss" hidden></div>${WK_POP_CSS}<div class="wkpop" id="wkpop" hidden><div class="plate card wkbox" id="wkbox"></div></div><div class="wkring" id="wkring" hidden><div class="wkrb" id="wkrb"></div></div>`);
      const p = o.querySelector('#wkpop');
      p.addEventListener('pointerdown', e => { if (e.target === p) this._edClose(); });
      // Halten-Tasten (▲▼ der Uhrzeit, Schritte): sofort + wiederholt solange gedrückt
      o.addEventListener('pointerdown', e => {
        const t = e.target.closest('[data-rep]'); if (!t || !this._hass) return;
        e.preventDefault();
        const [c0, a0] = t.dataset.rep.split(/:(.*)/s), go = () => this.act(c0, a0, t);
        go(); let iv = null;
        const to = setTimeout(() => { iv = setInterval(go, 95); }, 420);
        const end = () => { clearTimeout(to); clearInterval(iv); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
        window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
      });
      o.addEventListener('input', e => {
        const t = e.target; if (!this._ed) return;
        if (t.id === 'ed-name') this._ed.name = t.value;
        if (t.dataset.rg) { this._ed[t.dataset.rg] = Number(t.value); if (t.dataset.rg === 'vol_min' && this._ed.vol_max < this._ed.vol_min) this._ed.vol_max = this._ed.vol_min; if (t.dataset.rg === 'vol_max' && this._ed.vol_min > this._ed.vol_max) this._ed.vol_min = this._ed.vol_max; this._edVol(); if (this._pv) this._pv.volume = this._ed.vol_max / 100; }
      });
    }
    return o;
  }
  _edOpen(id) {
    const s = WK.snap; if (!s) return;
    const a = id ? this._al(id) : null;
    const def = { name: 'Wecker', seite: this._sv(), enabled: true, time: '07:00', days: [0, 1, 2, 3, 4], sound: (s.sounds[0] || {}).file || '', snooze: true, snooze_min: 9, snooze_max: 0, ramp: true, vol_min: 10, vol_max: 80, ramp_s: 120, lock: 'rechnen', auto_stop_min: 30, skip_date: null,
      zufall: false, vib: false, vib_muster: 'puls', vib_staerke: 70, vib_verz_s: 0, eq: { bass: null, tiefen: null, mitten: null, hoehen: null } };
    this._ed = JSON.parse(JSON.stringify(a ? { ...def, ...a } : def));
    this._ed.eq = { ...def.eq, ...(this._ed.eq || {}) };
    if (a && !s.sounds.some(x => x.file === a.sound)) this._ed.sound = (s.sounds[0] || {}).file || '';
    this._edDel = false; this._edMsg = '';
    const o = this._pop(), p = o.querySelector('#wkpop'), box = o.querySelector('#wkbox');
    box.style.cssText = `--acc:${this._c.color};--accg:${this._c.glow};--accd:${this._c.dark}`;
    this._edRender();
    p.hidden = false;
  }
  _edClose() { const o = this._ovl; if (o) o.querySelector('#wkpop').hidden = true; this._ed = null; this._pvStop(); }
  _edRender() {
    const e = this._ed, s = WK.snap, box = this._ovl.querySelector('#wkbox');
    const [h, m] = wkHm(e.time), on = c => c ? ' on' : '';
    const st = (k, v) => `<div class="wkst"><div class="hk" data-rep="ed:${k}:-1">−</div><b id="ed-${k}">${v}</b><div class="hk" data-rep="ed:${k}:1">+</div></div>`;
    box.innerHTML = `<div class="head"><span class="led" style="--lc:${this._c.color}"></span><div class="t"><h2 class="eng">${e.id ? 'Wecker bearbeiten' : 'Neuer Wecker'}</h2><p>Bettseite ${escH(this._seiteName())}</p></div><div class="sbtn sx" data-act="ed:close">${BI.x}</div></div>
      <div class="wke"><div class="wkc">
        <div class="wktime lcd"><div class="wkts"><div class="hk" data-rep="ed:h:1">${BI.up}</div><b id="ed-hh">${String(h).padStart(2, '0')}</b><div class="hk" data-rep="ed:h:-1">${BI.down}</div></div>
          <span class="wkcol">:</span><div class="wkts"><div class="hk" data-rep="ed:m:1">${BI.up}</div><b id="ed-mm">${String(m).padStart(2, '0')}</b><div class="hk" data-rep="ed:m:-1">${BI.down}</div></div></div>
        <div class="wkq"><div class="hk" data-rep="ed:m:-15">−15</div><div class="hk" data-rep="ed:m:-5">−5</div><div class="hk" data-rep="ed:m:5">+5</div><div class="hk" data-rep="ed:m:15">+15</div></div>
        <div class="cap eng">Name</div><input type="text" id="ed-name" maxlength="40" value="${escH(e.name)}" placeholder="z. B. Arbeit">
        <div class="cap eng">Wochentage <span id="ed-dtxt" style="color:var(--acc);margin-left:6px">${wkDaysTxt(e.days)}</span></div>
        <div class="wkdays">${WK_DAYS.map((d, i) => `<div class="hk${on(e.days.includes(i))}" data-act="ed:day:${i}" id="ed-d${i}"><i></i>${d}</div>`).join('')}</div>
        <div class="wkpre"><div class="hk" data-act="ed:pre:01234">Werktags</div><div class="hk" data-act="ed:pre:56">Wochenende</div><div class="hk" data-act="ed:pre:0123456">Täglich</div><div class="hk" data-act="ed:pre:">Einmalig</div></div>
      </div><div class="wkc">
        <div class="cap eng">Weckton</div>
        <div class="wksnd" id="ed-snd">${(s.sounds || []).map(x => `<div class="wkso${on(x.file === e.sound)}" data-act="ed:snd:${escH(x.file)}"><span>${escH(x.name)}</span><em data-act="ed:pv:${escH(x.file)}" id="pv-${escH(x.file).replace(/\W/g, '_')}">${BI.play}</em></div>`).join('') || '<div class="wkmsg">Keine Töne in /config/www/wecker/toene</div>'}</div>
        <div class="wkrow"><div class="lb">Zufälliger Ton<small>bei jedem Wecken ein anderer aus der Liste</small></div><div class="wksw${on(e.zufall)}" data-act="ed:zuf" id="ed-zuf"></div></div>
        <div class="wkrow"><div class="lb">Lautstärke ansteigend<small>leise beginnen, dann lauter werden</small></div><div class="wksw${on(e.ramp)}" data-act="ed:ramp" id="ed-ramp"></div></div>
        <div id="ed-vol"></div>
        <div class="wkrow" id="ed-rs"><div class="lb">Anstieg über</div><div class="wkseg">${WK_RAMP.map(([v, l]) => `<span class="${on(e.ramp_s === v)}" data-act="ed:rs:${v}">${l}</span>`).join('')}</div></div>
        <div class="wkrow"><div class="lb">Schlummern<small>Schlummer-Taste im Klingel-Fenster</small></div><div class="wksw${on(e.snooze)}" data-act="ed:snz" id="ed-snz"></div></div>
        <div class="wkrow" id="ed-snzo"><div class="lb">Dauer · höchstens</div>${st('sm', e.snooze_min + ' min')}${st('sx', e.snooze_max ? e.snooze_max + '×' : '∞')}</div>
        <div class="wkrow"><div class="lb">Aus-Taste<small>schützt vor versehentlichem Ausschalten</small></div><div class="wkseg">${Object.entries(WK_LOCK).map(([k, l]) => `<span class="${on(e.lock === k)}" data-act="ed:lock:${k}">${l}</span>`).join('')}</div></div>
        <div class="wkrow"><div class="lb">Automatisch aus nach<small>wenn niemand reagiert</small></div>${st('as', e.auto_stop_min ? e.auto_stop_min + ' min' : 'nie')}</div>
      </div><div class="wkc">
        <div class="cap eng">Vibration</div>
        <div class="wkrow"><div class="lb">Vibrationsalarm<small>${escH(this._vibDev())}</small></div><div class="wksw${on(e.vib)}" data-act="ed:vib" id="ed-vib"></div></div>
        <div id="ed-vibo">
          <div class="wkseg wrap" style="margin:4px 0 8px">${WK_VIB.map(([k, l]) => `<span class="${on(e.vib_muster === k)}" data-act="ed:vm:${k}">${l}</span>`).join('')}</div>
          <div class="wkrow"><div class="lb">Stärke</div>${st('vs', e.vib_staerke + ' %')}</div>
          <div class="wkrow"><div class="lb">Erst nach<small>Ton zuerst, dann vibrieren</small></div>${st('vd', wkSec(e.vib_verz_s))}</div>
          <div class="wkrow"><div class="lb">Probieren<small>5 Sekunden mit Muster und Stärke</small></div><div class="hk" data-act="ed:vt"><i></i>Testen</div></div>
        </div>
        <div class="cap eng" style="margin-top:6px">Klang des Soundsystems</div>
        ${WK_EQ.map(([k, l]) => `<div class="wkrow${this._eqEnt(k) ? '' : ' wkdis'}" title="${this._eqEnt(k) ? escH(this._eqEnt(k)) : 'Regler in den Einstellungen → Wecker → Soundsystem wählen'}"><div class="lb">${l}<small>${this._eqEnt(k) ? 'beim Wecken setzen' : 'kein Regler gewählt'}</small></div>${st('eq' + k, e.eq[k] == null ? 'gleich' : e.eq[k] + ' %')}</div>`).join('')}
      </div></div>
      <div class="wkmsg" id="ed-msg"></div>
      <div class="wkbtn">${e.id ? `<div class="hk red${on(this._edDel)}" data-act="ed:del">${BI.trash}${this._edDel ? 'Wirklich löschen?' : 'Löschen'}</div><div class="hk" data-act="ed:test">${BI.alarm}Testen</div>` : ''}
        ${e.id && e.days.length && e.enabled ? `<div class="hk${on(e.skip_date)}" data-act="ed:skip"><i></i>${e.skip_date ? 'Auslassen aufheben' : 'Nächsten auslassen'}</div>` : ''}
        <span class="sp"></span><div class="hk" data-act="ed:close">Abbrechen</div><div class="hk" data-act="ed:save" style="--c:#3ddc84"><i></i>Speichern</div></div>`;
    this._edVol(); this._edDis();
  }
  _edVol() {
    const e = this._ed, el = this._ovl && this._ovl.querySelector('#ed-vol'); if (!el) return;
    const rg = (k, l) => `<div class="wkvol"><span>${l}</span><input type="range" class="wkrg" min="0" max="100" step="1" value="${e[k]}" data-rg="${k}" style="--p:${e[k]}%"><b>${e[k]} %</b></div>`;
    if (!el.firstChild || el.dataset.r !== String(e.ramp)) { el.dataset.r = String(e.ramp); el.innerHTML = (e.ramp ? rg('vol_min', 'Start') : '') + rg('vol_max', e.ramp ? 'Ende' : 'Laut'); return; }
    el.querySelectorAll('input').forEach(i => { const k = i.dataset.rg; if (document.activeElement !== i && Number(i.value) !== e[k]) i.value = e[k]; i.style.setProperty('--p', e[k] + '%'); i.nextElementSibling.textContent = e[k] + ' %'; });
  }
  _edDis() {
    const o = this._ovl, e = this._ed; if (!o) return;
    o.querySelector('#ed-rs').classList.toggle('wkdis', !e.ramp);
    o.querySelector('#ed-snzo').classList.toggle('wkdis', !e.snooze);
    o.querySelector('#ed-snd').classList.toggle('wkdis', !!e.zufall);
    o.querySelector('#ed-vibo').classList.toggle('wkdis', !e.vib);
  }
  // Einstellungen dieser Bettseite aus dem Wecker-Snapshot
  _wkCfg(k) { const s = WK.snap || {}; return ((s[k] || {})[this._sv()] || {}); }
  _vibDev() { const v = this._wkCfg('vibration'); return v.schalter ? 'Gerät: ' + ((this._st(v.schalter) || { attributes: {} }).attributes.friendly_name || v.schalter) : 'Gerät in den Einstellungen → Wecker wählen'; }
  _eqEnt(k) { return (this._wkCfg('ausgabe').eq || {})[k] || ''; }
  async _edAct(arg, t) {
    const e = this._ed; if (!e) return;
    const [k, v] = arg.split(/:(.*)/s), o = this._ovl, $ = id => o.querySelector('#' + id);
    const setT = (h, m) => { e.time = `${String((h + 24) % 24).padStart(2, '0')}:${String((m + 60) % 60).padStart(2, '0')}`; const [hh, mm] = wkHm(e.time); $('ed-hh').textContent = String(hh).padStart(2, '0'); $('ed-mm').textContent = String(mm).padStart(2, '0'); };
    const [h, m] = wkHm(e.time);
    switch (k) {
      case 'close': return this._edClose();
      case 'h': return setT(h + Number(v), m);
      case 'm': { const tot = (h * 60 + m + Number(v) + 1440) % 1440; return setT(Math.floor(tot / 60), tot % 60); }
      case 'day': { const i = Number(v); e.days = e.days.includes(i) ? e.days.filter(x => x !== i) : [...e.days, i].sort(); $('ed-d' + i).classList.toggle('on', e.days.includes(i)); $('ed-dtxt').textContent = wkDaysTxt(e.days); return; }
      case 'pre': e.days = v.split('').map(Number); WK_DAYS.forEach((_, i) => $('ed-d' + i).classList.toggle('on', e.days.includes(i))); $('ed-dtxt').textContent = wkDaysTxt(e.days); return;
      case 'snd': e.sound = v; o.querySelectorAll('#ed-snd .wkso').forEach(x => x.classList.toggle('on', x.dataset.act === 'ed:snd:' + v)); return;
      case 'pv': return this._pvPlay(v);
      case 'ramp': e.ramp = !e.ramp; t.classList.toggle('on', e.ramp); this._edVol(); return this._edDis();
      case 'rs': e.ramp_s = Number(v); t.parentElement.querySelectorAll('span').forEach(x => x.classList.toggle('on', x === t)); return;
      case 'snz': e.snooze = !e.snooze; t.classList.toggle('on', e.snooze); return this._edDis();
      case 'sm': e.snooze_min = clamp(e.snooze_min + Number(v), 1, 30); $('ed-sm').textContent = e.snooze_min + ' min'; return;
      case 'sx': e.snooze_max = clamp(e.snooze_max + Number(v), 0, 10); $('ed-sx').textContent = e.snooze_max ? e.snooze_max + '×' : '∞'; return;
      case 'as': { const st = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120], i = clamp(st.findIndex(x => x >= e.auto_stop_min) + Number(v), 0, st.length - 1); e.auto_stop_min = st[i]; $('ed-as').textContent = e.auto_stop_min ? e.auto_stop_min + ' min' : 'nie'; return; }
      case 'lock': e.lock = v; t.parentElement.querySelectorAll('span').forEach(x => x.classList.toggle('on', x === t)); return;
      case 'zuf': e.zufall = !e.zufall; t.classList.toggle('on', e.zufall); return this._edDis();
      case 'vib': e.vib = !e.vib; t.classList.toggle('on', e.vib); return this._edDis();
      case 'vm': e.vib_muster = v; t.parentElement.querySelectorAll('span').forEach(x => x.classList.toggle('on', x === t)); return;
      case 'vs': e.vib_staerke = clamp(e.vib_staerke + Number(v) * 5, 5, 100); $('ed-vs').textContent = e.vib_staerke + ' %'; return;
      case 'vd': { const i = clamp(WK_VDLY.findIndex(x => x >= e.vib_verz_s) + Number(v), 0, WK_VDLY.length - 1); e.vib_verz_s = WK_VDLY[i]; $('ed-vd').textContent = wkSec(e.vib_verz_s); return; }
      case 'vt': this._ws({ type: 'wecker/vib_test', seite: e.seite, muster: e.vib_muster, staerke: e.vib_staerke, dauer_s: 5 }).then(() => { $('ed-msg').textContent = 'Vibration läuft 5 Sekunden …'; }).catch(err => this._edErr(err)); return;
      case 'eqbass': case 'eqtiefen': case 'eqmitten': case 'eqhoehen': {
        const b = k.slice(2), cur = e.eq[b], d = Number(v);
        e.eq[b] = cur == null ? (d > 0 ? 50 : null) : (cur + d * 5 < 0 ? null : clamp(cur + d * 5, 0, 100));
        $('ed-' + k).textContent = e.eq[b] == null ? 'gleich' : e.eq[b] + ' %'; return;
      }
      case 'skip': { const a = this._al(e.id); e.skip_date = e.skip_date ? null : (a && a.next ? wkLocalDate(a.next) : null); return this._edSave(false); }
      case 'del':
        if (!this._edDel) { this._edDel = true; t.classList.add('on'); t.lastChild.textContent = 'Wirklich löschen?'; return; }
        try { await this._ws({ type: 'wecker/alarm/delete', alarm_id: e.id }); this._edClose(); } catch (err) { this._edErr(err); }
        return;
      case 'test': { const id = await this._edSave(false); if (id) { this._edClose(); this._ws({ type: 'wecker/test', alarm_id: id }).catch(err => console.warn('wecker', err)); } return; }
      case 'save': return this._edSave(true);
    }
  }
  _edErr(err) { const m = this._ovl && this._ovl.querySelector('#ed-msg'); if (m) m.textContent = 'Fehler: ' + ((err && (err.message || err.code)) || err); }
  async _edSave(close) {
    const e = this._ed; if (!e) return null;
    if (!e.days.length && !e.id) e.enabled = true;
    try {
      const r = await this._ws({ type: 'wecker/alarm/save', alarm: { ...e, name: (e.name || '').trim() || 'Wecker', enabled: close ? true : e.enabled } });
      e.id = r.result;
      if (close) this._edClose(); else this._edRender();
      return r.result;
    } catch (err) { this._edErr(err); return null; }
  }
  // Probehören (Name ≠ RPModule._prev = Zustands-Zwischenspeicher!) (max. 8 s, Lautstärke = Ende/Laut)
  _pvPlay(file) {
    const was = this._pvf; this._pvStop();
    if (was === file) return;
    const snd = ((WK.snap && WK.snap.sounds) || []).find(x => x.file === file); if (!snd) return;
    const a = new Audio(); a.loop = true; a.volume = clamp((this._ed ? this._ed.vol_max : 70) / 100, 0, 1);
    this._pv = a; this._pvf = file;
    const fail = e => { if (this._pv !== a) return; this._pvStop(); const m = this._ovl && this._ovl.querySelector('#ed-msg'); if (m) m.textContent = 'Ton kann nicht abgespielt werden: ' + ((e && e.message) || e); console.warn('wecker Vorschau', e); };
    wkSrc(snd.url).then(u => { if (this._pv !== a) return; a.src = u; return a.play(); }).catch(fail);
    const em = this._ovl && this._ovl.querySelector('#pv-' + file.replace(/\W/g, '_')); if (em) { em.classList.add('pl'); em.innerHTML = BI.stop; }
    this._pvT = setTimeout(() => this._pvStop(), 8000);
  }
  _pvStop() {
    clearTimeout(this._pvT);
    if (this._pv) { this._pv.pause(); this._pv = null; }
    if (this._pvf && this._ovl) { const em = this._ovl.querySelector('#pv-' + this._pvf.replace(/\W/g, '_')); if (em) { em.classList.remove('pl'); em.innerHTML = BI.play; } }
    this._pvf = null;
  }

  // ---------------------------------------------------------------- Klingeln
  _curRing() {
    const rs = Object.values((WK.snap && WK.snap.rings) || {}).filter(r => r.seite === this._c.seite);
    return rs.find(r => r.state === 'ringing') || rs[0] || null;
  }
  _ring() {
    const r = this._curRing();
    if (r && r.state === 'ringing' && (!this._r || this._r.state !== 'ringing' || this._r.id !== r.id || this._r.since !== r.since)) this._wake();
    const changed = !this._r !== !r || (r && (r.id !== this._r.id || r.state !== this._r.state || r.count !== this._r.count));
    this._r = r;
    this._ringAudio(r);
    if (!this._c.popup) return;
    if (!r || r.state !== 'ringing') this._hellBack();
    if (!r) { this._ringOn = false; if (this._ovl) { const w = this._ovl.querySelector('#wkring'); if (w) w.hidden = true; } this._ch = null; return; }
    if (this._ed) this._edClose();
    if (changed || !this._ringOn) this._ringRender();
  }
  // Bildschirm einschalten (Fully Kiosk Browser)
  _wake() {
    const F = window.fully; if (!F) return;
    try { F.turnScreenOn(); if (F.bringToForeground) F.bringToForeground(); } catch (e) { /* ältere Fully-Version */ }
    // nachts oft Helligkeit 0 → Klingel-Fenster wäre unsichtbar
    try { if (F.getScreenBrightness && F.setScreenBrightness) { const b = Number(F.getScreenBrightness()); if (b < 60 && this._hellAlt == null) { this._hellAlt = b; F.setScreenBrightness(160); } } } catch (e) { /* ohne Helligkeit */ }
  }
  _hellBack() { const F = window.fully; if (this._hellAlt != null) { try { F && F.setScreenBrightness && F.setScreenBrightness(this._hellAlt); } catch (e) { /* egal */ } this._hellAlt = null; } }
  _ringRender() {
    const r = this._r, o = this._pop(), w = o.querySelector('#wkring'), b = o.querySelector('#wkrb');
    w.style.cssText = `--acc:${this._c.color};--accg:${this._c.glow};--accd:${this._c.dark}`;
    const snz = r.state === 'snoozed', lock = r.lock || 'rechnen';
    w.classList.toggle('snz', snz); w.classList.remove('chal');
    b.innerHTML = `<div class="wkr-now mono"><span id="rn-h">--</span><span class="wkr-c">:</span><span id="rn-m">--</span></div>
      <div class="wkr-date" id="rn-d"></div>
      <div class="wkr-al">${snz ? BI.snooze : BI.alarm}<b>${escH(r.time || '')}</b><span>${escH(r.name || 'Wecker')}${r.test ? ' · Test' : ''}</span></div>
      <div class="wkr-st" id="rn-st"></div>
      <div class="wkr-main" id="rn-main">
        ${!snz ? `<div class="wkr-snz${r.can_snooze ? '' : ' dis'}" data-act="r:snz">${BI.snooze}Schlummern<small>${r.snooze_min || 9} Minuten${r.count ? ` · ${r.count}× geschlummert` : ''}</small></div>` : ''}
        <div class="wkr-off${!r.can_snooze || snz ? ' big' : ''}" id="rn-off" ${lock === 'halten' ? '' : 'data-act="r:off"'}>Aus<small>${lock === 'halten' ? 'gedrückt halten' : lock === 'rechnen' ? 'mit Rechenaufgabe' : ''}</small></div>
      </div>
      <div class="wkr-ch" id="rn-ch" hidden></div>
      <div class="wkr-hint" id="rn-hint"></div>`;
    if (lock === 'halten') this._bindHold(b.querySelector('#rn-off'));
    this._ch = null; this._ringOn = true; w.hidden = false;
    this._ringTick();
  }
  _bindHold(el) {
    let t0 = 0, iv = 0;
    const end = () => { clearInterval(iv); iv = 0; if (t0) { t0 = 0; el.style.setProperty('--p', 0); } };
    const step = () => { const p = clamp((Date.now() - t0) / 3000, 0, 1); el.style.setProperty('--p', p.toFixed(3)); if (p >= 1) { clearInterval(iv); iv = 0; t0 = 0; this._ringStop(); } };
    el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ohne Capture: pointerup/cancel beenden trotzdem */ } t0 = Date.now(); this._audRetry(); clearInterval(iv); iv = setInterval(step, 40); });
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  }
  _ringTick() {
    const o = this._ovl, r = this._r; if (!o || !r) return;
    const tz = wkTz(this._hass), $ = id => o.querySelector('#' + id), d = wkParts(new Date(), tz);
    if (!$('rn-h')) return;
    $('rn-h').textContent = String(d.h).padStart(2, '0'); $('rn-m').textContent = String(d.m).padStart(2, '0');
    $('rn-d').textContent = d.date;
    if (r.state === 'snoozed' && r.until) {
      const ms = Math.max(0, Date.parse(r.until) - wkNow()), mm = Math.floor(ms / 60000), ss = Math.floor(ms / 1000) % 60;
      this._html($('rn-st'), `Schlummert bis <b>${wkHHMM(r.until, tz)}</b> · noch <b>${mm}:${String(ss).padStart(2, '0')}</b>`);
    } else this._html($('rn-st'), r.count ? `${r.count}× geschlummert` : '');
    if (this._aud) this._audVol(r);
    if (this._ch && Date.now() - this._ch.t > 45000) this._chalEnd();
    $('rn-hint').textContent = this._blocked ? 'Ton blockiert – einmal auf den Bildschirm tippen (Fully: „Autoplay“ erlauben)' : '';
  }
  async _ringAct(arg, t) {
    const [k, v] = arg.split(/:(.*)/s), r = this._r; if (!r) return;
    this._audRetry();
    if (k === 'snz') { try { await this._ws({ type: 'wecker/snooze', alarm_id: r.id }); } catch (e) { console.warn('wecker', e); } return; }
    if (k === 'off') { if ((r.lock || 'rechnen') === 'rechnen') return this._chalStart(); return this._ringStop(); }
    if (k === 'back') return this._chalEnd();
    if (k === 'k') return this._chalKey(v);
  }
  async _ringStop() {
    const r = this._r; if (!r) return;
    this._audStop();
    try { await this._ws({ type: 'wecker/stop', alarm_id: r.id }); } catch (e) { console.warn('wecker', e); }
  }
  // Rechenaufgabe: zwei zweistellige Zahlen addieren
  _chalNew() { const a = 12 + Math.floor(Math.random() * 48), b = 11 + Math.floor(Math.random() * 38); return { a, b, sum: a + b, inp: '', t: Date.now() }; }
  _chalStart() {
    const o = this._ovl, w = o.querySelector('#wkring');
    this._ch = this._chalNew();
    w.classList.add('chal'); o.querySelector('#rn-main').hidden = true;
    const ch = o.querySelector('#rn-ch'); ch.hidden = false;
    ch.innerHTML = `<div class="wkr-q lcd" id="rn-q"><span id="rn-qt"></span><span>=</span><u id="rn-a"></u></div>
      <div class="wkr-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<div class="hk" data-act="r:k:${n}">${n}</div>`).join('')}<div class="hk" data-act="r:k:del">${BI.back}</div><div class="hk" data-act="r:k:0">0</div><div class="hk ok" data-act="r:k:ok">OK</div></div>
      <div class="wkr-cb"><div class="hk" data-act="r:back">Zurück</div></div>`;
    this._chalShow();
  }
  _chalShow() { const o = this._ovl, c = this._ch; o.querySelector('#rn-qt').textContent = `${c.a} + ${c.b}`; o.querySelector('#rn-a').textContent = c.inp || ' '; }
  _chalKey(k) {
    const c = this._ch; if (!c) return;
    c.t = Date.now();
    if (k === 'del') c.inp = c.inp.slice(0, -1);
    else if (k === 'ok') {
      if (Number(c.inp) === c.sum) { this._ch = null; return this._ringStop(); }
      const q = this._ovl.querySelector('#rn-q'); q.classList.remove('bad'); void q.offsetWidth; q.classList.add('bad');
      this._ch = this._chalNew();
    } else if (c.inp.length < 3) c.inp += k;
    this._chalShow();
  }
  _chalEnd() {
    this._ch = null; const o = this._ovl; if (!o) return;
    o.querySelector('#wkring').classList.remove('chal');
    const ch = o.querySelector('#rn-ch'); if (ch) { ch.hidden = true; ch.innerHTML = ''; }
    const m = o.querySelector('#rn-main'); if (m) m.hidden = false;
  }
  // Weckton im Browser: Schleife, Lautstärke steigt von Start bis Ende (Fully: Systemlautstärke)
  _ringAudio(r) {
    const want = r && r.state === 'ringing' && this._c.sound && r.browser !== false && r.sound_url;
    if (!want) { this._audStop(); return; }
    if (!this._aud || this._aud._src !== r.sound_url) {
      this._audStop();
      const a = new Audio(); a.loop = true; a._src = r.sound_url; a.volume = 0; this._aud = a;
      this._audVol(r);
      // erst als Blob laden (richtiger Typ für Firefox), bei Fehler direkt die URL versuchen
      wkSrc(r.sound_url).catch(() => r.sound_url).then(u => { if (this._aud !== a) return; a.src = u; this._audRetry(); });
    }
  }
  _audRetry() {
    const a = this._aud; if (!a || !a.paused || !a.src) return;
    const p = a.play(); if (p) p.then(() => { this._blocked = false; setTimeout(() => wkBeat(true), 300); }).catch(() => { this._blocked = true; wkBeat(true); });
  }
  _audVol(r) {
    const el = Math.max(0, (wkNow() - Date.parse(r.since)) / 1000), f = r.ramp ? clamp(el / Math.max(1, r.ramp_s || 1), 0, 1) : 1;
    const v = clamp((r.ramp ? r.vol_min + (r.vol_max - r.vol_min) * f : r.vol_max) / 100, 0, 1), F = window.fully;
    if (F && F.setAudioVolume) {
      this._aud.volume = 1;
      const lv = Math.round(v * 100); if (lv !== this._fv) { this._fv = lv; try { F.setAudioVolume(lv, 3); } catch (e) { /* ältere Fully-Version */ } }
    } else this._aud.volume = v;
  }
  _audStop() { if (this._aud) { this._aud.pause(); this._aud = null; } this._fv = null; this._blocked = false; }
}

// ---- Kodi-Fernbedienung
const KODI_CSS = `
.kd .head .st{font-family:'Share Tech Mono',monospace;font-size:13px;color:#8a8e96;white-space:nowrap}
.know{margin-top:12px;padding:10px 14px 12px;border-radius:12px;min-height:74px}
.know>*{position:relative;z-index:1}
.know .kt{font:600 18px Rajdhani,sans-serif;letter-spacing:.8px;color:var(--acc);text-shadow:0 0 10px var(--accg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.know .ks{font-size:12.5px;font-weight:600;color:#8a8e96;letter-spacing:.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.know .kp{display:flex;align-items:center;gap:8px;margin-top:7px;font:400 12px 'Share Tech Mono',monospace;color:#8a8e96}
.know .kp .bar{flex:1;margin:0}.know .kp .bar i{background:var(--acc);box-shadow:0 0 6px var(--acc)}
.kpad{position:relative;width:310px;height:310px;max-width:100%;margin:20px auto 4px;border-radius:50%;flex:none;
  background:conic-gradient(from 20deg,#3c3e44,#141518,#4b4e55,#101113,#37393f,#131417,#45484e,#111214,#3c3e44);box-shadow:0 14px 24px rgba(0,0,0,.7),0 0 0 2px #050506,inset 0 2px 2px rgba(255,255,255,.2)}
.kpad::before{content:"";position:absolute;inset:13px;border-radius:50%;background:radial-gradient(circle at 50% 30%,#2b2d32,#141518 75%);box-shadow:inset 0 4px 12px #000,0 1px 0 rgba(255,255,255,.08)}
.karr{position:absolute;display:grid;place-items:center;color:#8a8e96;z-index:1;cursor:pointer;touch-action:none;border-radius:50%}
.karr svg{width:46px;height:46px;transition:color .1s,filter .1s,transform .1s}
.karr.u{left:100px;top:22px;width:110px;height:84px}.karr.d{left:100px;bottom:22px;width:110px;height:84px}
.karr.l{left:22px;top:100px;width:84px;height:110px}.karr.r{right:22px;top:100px;width:84px;height:110px}
.karr:active svg{color:var(--acc);filter:drop-shadow(0 0 8px var(--acc));transform:scale(.92)}
.kok{position:absolute;left:50%;top:50%;width:122px;height:122px;margin:-61px 0 0 -61px;border-radius:50%;z-index:2;display:grid;place-items:center;cursor:pointer;
  background:conic-gradient(from 20deg,#44464c,#141518,#50535a,#111214,#3e4046,#131417,#44464c);box-shadow:0 6px 14px rgba(0,0,0,.8),0 0 0 2px #000,inset 0 1px 1px rgba(255,255,255,.25)}
.kok span{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;font:700 26px Rajdhani,sans-serif;letter-spacing:3px;color:#d7d9de;
  background:radial-gradient(circle at 50% 30%,#3a3c42,#1d1e22);box-shadow:inset 0 2px 4px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.12)}
.kok:active span{box-shadow:inset 0 3px 8px #000,0 0 18px var(--acc);color:var(--acc)}
.kkeys{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}
.kkeys .hk{height:50px}.kkeys .hk svg{width:23px;height:23px}
.kkeys.k6{grid-template-columns:repeat(6,1fr)}.kkeys.k3{grid-template-columns:1fr 1fr 1fr}
.kd.na .kpad,.kd.na .kkeys{opacity:.4;pointer-events:none;filter:grayscale(.6)}
`;
// ---------------------------------------------------------------- Bett-Sound (wie das Audio-Modul, Geräte aus den Bett-Einstellungen)
// Lautsprecher (seiten.<seite>.player), Lautstärke-/Klangregler, Einschalter und Quelle kommen aus
// Einstellungen → Wecker → Soundsystem der Bettseite. Mit media: { … } in YAML wie beim Audio-Modul selbst festlegen.
class RPBettAudio extends RPAudio {
  static getStubConfig() { return { seite: "links" }; }
  norm(c0) {
    if (c0.media || c0.channels || c0.players) return super.norm(c0);
    const s = c0.seite || "links", sn = WK.snap || {}, au = (sn.ausgabe || {})[s] || {}, pl = ((sn.seiten || {})[s] || {}).player || "";
    const ch = [];
    if (au.laut) ch.push({ name: "Laut", entity: au.laut }); else if (pl) ch.push({ name: "Laut", player: true });
    for (const [k, l] of WK_EQ) if ((au.eq || {})[k] && ch.length < 4) ch.push({ name: l, entity: au.eq[k] });
    return super.norm({ title: c0.title || "Sound", subtitle: c0.subtitle || ("Bett " + s), players: pl ? [pl] : [], channels: ch.length ? ch : undefined,
      power: au.ein || undefined, source: au.quelle || undefined, preset_count: c0.preset_count ?? 6, presets: c0.presets });
  }
  // Geräte aus den Wecker-Einstellungen: bei Änderung neu aufbauen
  onHass() {
    if (this._wkU) return;
    this._wkU = wkSub(this._hass, sn => {
      if (!sn || this._raw.media) return;
      const s = this._raw.seite || "links", k = JSON.stringify([(sn.ausgabe || {})[s], ((sn.seiten || {})[s] || {}).player]);
      if (k !== this._wkK) { this._wkK = k; this.setConfig(this._raw); }
    });
  }
  onDisconnect() { super.onDisconnect(); if (this._wkU) { this._wkU(); this._wkU = null; this._wkK = null; } }
}

class RPKodi extends RPModule {
  // freie Anordnung (layout: custom) möglich; Einpass-Art je Element
  static get KINDS() { return { now: 'shrink' }; }
  static get CSS() { return KODI_CSS; }
  get meta() { return this.variants().tall; }
  // hoch = alles · kompakt = ohne „Läuft gerade“
  variants() { return { tall: { bw: 340, mh: 660, fh: true, maxh: 760 }, compact: { bw: 340, mh: 520, weight: .8, hide: ['now'] } }; }
  static getStubConfig() { return { entity: 'media_player.kodi' }; }
  norm(c) { const col = c.farbe || c.color || '#4dc3ff'; return { entity: c.entity || c.kodi || null, title: c.titel || c.title || 'Kodi', sub: c.untertitel || c.subtitle || 'Fernseher', color: col, glow: wkGlow(col, .6) }; }
  html() {
    const c = this._c, ar = (cl, k, ic) => `<div class="karr ${cl}" data-rep="k:${k}">${BI[ic]}</div>`, hk = (a, ic, rep) => `<div class="hk" ${rep ? 'data-rep' : 'data-act'}="${a}">${BI[ic]}</div>`;
    const p = {
      head: this.P('head', `<div class="head"><span class="led" id="kd-led"></span><div class="t"><h2 class="eng">${escH(c.title)}</h2><p>${escH(c.sub)}</p></div><span class="st" id="kd-st"></span></div>`),
      now: this.P('now', '<div class="know lcd"><div class="kt" id="kd-t">–</div><div class="ks" id="kd-s"></div><div class="kp" id="kd-p"></div></div>'),
      pad: this.P('pad', `<div class="kpad">${ar('u', 'Input.Up', 'up')}${ar('d', 'Input.Down', 'down')}${ar('l', 'Input.Left', 'left')}${ar('r', 'Input.Right', 'right')}<div class="kok" data-act="k:Input.Select"><span>OK</span></div></div>`),
      keys: this.P('keys', `<div class="kkeys">${hk('k:Input.Back', 'back')}${hk('k:Input.Home', 'home')}${hk('k:Input.ContextMenu', 'menu')}${hk('k:Input.Info', 'info')}</div>`),
      transport: this.P('transport', `<div class="kkeys k6">${hk('m:media_previous_track', 'prev')}${hk('seek:smallbackward', 'rew', 1)}${hk('m:media_play_pause', 'pp')}${hk('m:media_stop', 'stop')}${hk('seek:smallforward', 'fwd', 1)}${hk('m:media_next_track', 'next')}</div>`),
      volume: this.P('volume', `<div class="kkeys k3">${hk('m:volume_down', 'vdn', 1)}${hk('mute:', 'mute')}${hk('m:volume_up', 'vup', 1)}</div>`),
    };
    return `<div class="vcol fill kd" id="kd" style="--acc:${c.color};--accg:${c.glow}">${this._v === 'custom' ? this._cgrid(p) : Object.values(p).join('')}</div>`;
  }
  bind() {
    // Halten = wiederholen (Pfeile, Spulen, Lautstärke)
    if (this._repB) return; this._repB = true;
    this.shadowRoot.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-rep]'); if (!t || !this._hass) return;
      e.preventDefault();
      const [c0, a0] = t.dataset.rep.split(/:(.*)/s), go = () => this.act(c0, a0, t);
      go(); let iv = null;
      const to = setTimeout(() => { iv = setInterval(go, 160); }, 450);
      const end = () => { clearTimeout(to); clearInterval(iv); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
      window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
    });
  }
  watch() { return [this._c.entity]; }
  onConnect() { clearInterval(this._kdI); this._kdI = setInterval(() => this._kdPos(), 1000); }
  onDisconnect() { clearInterval(this._kdI); }
  act(cmd, arg) {
    const e = this._c.entity; if (!e || !this._ok(this._st(e))) return;
    if (cmd === 'k') return this._call('kodi', 'call_method', { entity_id: e, method: arg });
    if (cmd === 'seek') return this._call('kodi', 'call_method', { entity_id: e, method: 'Player.Seek', playerid: 1, value: { step: arg } });
    if (cmd === 'mute') return this._call('media_player', 'volume_mute', { entity_id: e, is_volume_muted: !this._st(e).attributes.is_volume_muted });
    if (cmd === 'm') return this._call('media_player', arg, { entity_id: e });
  }
  update() {
    const $ = this.$, e = this._c.entity, s = this._st(e), ok = this._ok(s);
    $('kd').classList.toggle('na', !ok);
    const on = ok && s.state !== 'off';
    $('kd-led').style.setProperty('--lc', on ? this._c.color : ok ? '#3a3c41' : '#ff5a5a');
    $('kd-st').textContent = !e ? 'nicht eingerichtet' : !ok ? 'nicht verbunden' : { playing: 'spielt', paused: 'pausiert', idle: 'bereit', on: 'an', off: 'aus' }[s.state] || s.state;
    if (!$('kd-t')) return;
    const a = (s && s.attributes) || {};
    let t = a.media_title || '', sub = '';
    if (a.media_series_title) { sub = a.media_series_title + (a.media_season != null ? ` · S${String(a.media_season).padStart(2, '0')}E${String(a.media_episode || 0).padStart(2, '0')}` : ''); }
    else if (a.media_artist) sub = a.media_artist + (a.media_album_name ? ' · ' + a.media_album_name : '');
    else if (a.media_channel) sub = a.media_channel;
    $('kd-t').textContent = !e ? 'Kodi noch nicht eingerichtet' : !ok ? 'Kodi nicht erreichbar' : t || (s.state === 'off' ? 'Ausgeschaltet' : 'Nichts läuft');
    $('kd-s').textContent = !e ? 'Im Panel: entity: media_player.…' : sub;
    this._kdPos();
  }
  _kdPos() {
    const el = this.$ && this.$('kd-p'), s = this._st(this._c.entity); if (!el) return;
    const a = (s && s.attributes) || {}, dur = a.media_duration;
    if (!dur || a.media_position == null) { this._html(el, ''); return; }
    let pos = a.media_position;
    if (s.state === 'playing' && a.media_position_updated_at) pos += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
    pos = clamp(pos, 0, dur);
    const f = t => { t = Math.round(t); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
    this._html(el, `<span>${f(pos)}</span><div class="bar"><i style="width:${(pos / dur * 100).toFixed(1)}%"></i></div><span>${f(dur)}</span>`);
  }
}

// ---- Lichter: einzelne Lampen im Haus schalten (z. B. Nachtlicht, Flur, Bad minimal)
// Tippen = an/aus (an mit voreingestellter Helligkeit/Farbtemperatur/Effekt) · waagerecht wischen = Helligkeit
const LX_CSS = `
.lx .head .st{font-family:'Share Tech Mono',monospace;font-size:13px;color:#8a8e96;white-space:nowrap}
.lxl{display:flex;flex-direction:column;gap:12px;margin-top:14px;flex:1;min-height:0}
.lxr{flex:1;min-height:52px;max-height:74px;height:auto;touch-action:pan-y;cursor:pointer;user-select:none;-webkit-user-select:none}
.lxr::after{display:none}
.lxr .lxt{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.lxr .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lxr .st{font-size:15px;letter-spacing:1.5px;white-space:nowrap}
.lxr .pc{margin-left:auto;font:400 20px 'Share Tech Mono',monospace;color:#979ca5;flex:none}
.lxr.on .pc{color:var(--t);text-shadow:0 0 10px var(--g)}
.lxr .lxb{position:absolute;left:18px;right:18px;bottom:6px;height:3px;border-radius:2px;background:#3a3c41;box-shadow:inset 0 1px 2px #000;overflow:hidden}
.lxr .lxb i{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--c);box-shadow:0 0 8px var(--c);transition:width .15s}
.lxr.drag .lxb{height:5px;bottom:5px}.lxr.drag .lxb i{transition:none}
.lxr.na{opacity:.45;filter:grayscale(.8)}
.lxoff{height:46px;margin-top:14px;flex:none}
`;
class RPLichter extends RPModule {
  static get NO_CUSTOM() { return true; }
  static get CSS() { return LX_CSS; }
  get meta() { return this.variants().default; }
  variants() {
    const n = Math.max(1, this._c ? this._c.lichter.length : 3), off = this._c && this._c.aus ? 60 : 0;
    return { default: { bw: 400, mh: 70 + n * 64 + off, fh: true, maxh: 70 + n * 86 + off } };
  }
  static getStubConfig() { return { lichter: [{ name: 'Nachtlicht', entity: '' }] }; }
  norm(c) {
    const col = c.farbe || c.color || '#ffb347';
    const lichter = (c.lichter || c.lights || []).map(x => typeof x === 'string' ? { entity: x } : x || {}).map(x => ({
      entity: x.entity || '', name: x.name || '', farbe: x.farbe || x.color || col, helligkeit: x.helligkeit ?? x.brightness ?? null,
      kelvin: x.kelvin ?? null, effekt: x.effekt || x.effect || null }));
    return { title: c.titel || c.title || 'Licht', sub: c.untertitel || c.subtitle || 'Lichter im Haus', color: col, glow: wkGlow(col, .6), lichter, aus: c.alles_aus !== false && lichter.length > 1 };
  }
  html() {
    const c = this._c;
    const rows = c.lichter.map((l, i) => `<div class="rk lxr" id="lx-${i}" data-act="t:${i}" data-i="${i}" style="--c:${l.farbe};--t:${l.farbe};--g:${wkGlow(l.farbe, .55)}">${BULB}
      <div class="lxt"><div class="nm" id="lx-${i}-n"></div><div class="st" id="lx-${i}-s">--</div></div><span class="pc" id="lx-${i}-p"></span><div class="lxb"><i id="lx-${i}-b"></i></div></div>`).join('');
    return `<div class="vcol fill lx" id="lx" style="--acc:${c.color};--accg:${c.glow}">
      <div class="head"><span class="led" id="lx-led"></span><div class="t"><h2 class="eng">${escH(c.title)}</h2><p>${escH(c.sub)}</p></div><span class="st" id="lx-st"></span></div>
      ${this.P('list', `<div class="lxl">${rows || '<div class="lhint">Keine Lichter eingetragen (lichter: …)</div>'}</div>`, 'flex:1;display:flex;flex-direction:column;min-height:0')}
      ${c.aus ? this.P('alloff', `<div class="rk off lxoff" data-act="alloff">${PWR}<div class="nm">Alles aus</div></div>`) : ''}
    </div>`;
  }
  bind() {
    // waagerecht wischen = Helligkeit (0 % = aus); Tippen bleibt Schalten
    if (this._lxB) return; this._lxB = true;
    this.shadowRoot.addEventListener('pointerdown', e => {
      const row = e.target.closest('.lxr'); if (!row || !this._hass) return;
      const i = +row.dataset.i, l = this._c.lichter[i]; if (!l || !/^light\./.test(l.entity) || row.classList.contains('na')) return;
      const x0 = e.clientX, y0 = e.clientY; let on = false, v = null;
      const pct = ev => { const b = row.querySelector('.lxb').getBoundingClientRect(); return Math.round(clamp((ev.clientX - b.left) / b.width, 0, 1) * 100); };
      const mv = ev => {
        if (!on && Math.abs(ev.clientX - x0) > 14 && Math.abs(ev.clientX - x0) > Math.abs(ev.clientY - y0)) { on = true; row.classList.add('drag'); }
        if (!on) return; v = pct(ev); this._lxDrag = { i, v };
        this.$(`lx-${i}-b`).style.width = v + '%'; this.$(`lx-${i}-p`).textContent = v + ' %';
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        row.classList.remove('drag'); if (!on) return;
        this._lxSkip = Date.now() + 400;   // das folgende click nicht als Schalten werten
        if (v != null) { if (v <= 0) this._call('light', 'turn_off', { entity_id: l.entity }); else this._call('light', 'turn_on', { entity_id: l.entity, brightness_pct: v }); }
        setTimeout(() => { this._lxDrag = null; this.update(); }, 1500);
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    });
  }
  watch() { return this._c.lichter.map(l => l.entity).filter(Boolean); }
  _isOn(s) { return !!s && s.state === 'on'; }
  act(cmd, arg) {
    if (this._lxSkip && Date.now() < this._lxSkip) return;
    if (cmd === 'alloff') { for (const l of this._c.lichter) if (this._isOn(this._st(l.entity))) { if (l.entity.startsWith('light.')) this._call('light', 'turn_off', withFade(this._hass, raumOf(this, this._c), 'primary', 'off', { entity_id: l.entity })); else this._call('homeassistant', 'turn_off', { entity_id: l.entity }); } return; }
    if (cmd !== 't') return;
    const l = this._c.lichter[+arg]; if (!l || !l.entity) return;
    const s = this._st(l.entity), dom = l.entity.split('.')[0];
    if (!s || s.state === 'unavailable') return;
    if (dom === 'script' || dom === 'scene') return this._call(dom, 'turn_on', { entity_id: l.entity });
    if (this._isOn(s)) return dom === 'light' ? this._call('light', 'turn_off', withFade(this._hass, raumOf(this, this._c), 'primary', 'off', { entity_id: l.entity })) : this._call('homeassistant', 'turn_off', { entity_id: l.entity });
    if (dom !== 'light') return this._call('homeassistant', 'turn_on', { entity_id: l.entity });
    const d = { entity_id: l.entity };
    if (l.helligkeit != null) d.brightness_pct = clamp(Number(l.helligkeit), 1, 100);
    if (l.kelvin != null) d.color_temp_kelvin = Number(l.kelvin);
    if (l.effekt) d.effect = l.effekt;
    this._call('light', 'turn_on', withFade(this._hass, raumOf(this, this._c), 'primary', 'on', d));
  }
  update() {
    const $ = this.$, c = this._c; let n = 0;
    c.lichter.forEach((l, i) => {
      const row = $(`lx-${i}`); if (!row) return;
      // MiLight & Co. melden oft "unknown" (ohne Rückmeldung) – zählt als aus, nicht als fehlend
      const s = this._st(l.entity), na = !l.entity || !s || s.state === 'unavailable', on = !na && this._isOn(s), a = (s && s.attributes) || {};
      const dom = l.entity.split('.')[0], br = on && a.brightness != null ? Math.round(a.brightness / 2.55) : on ? 100 : 0;
      if (on) n++;
      row.classList.toggle('on', on); row.classList.toggle('na', na);
      $(`lx-${i}-n`).textContent = l.name || a.friendly_name || l.entity || 'Licht';
      const eff = on && a.effect && a.effect !== 'none' ? ({ night_mode: 'Nachtmodus', white_mode: 'Weiß' }[a.effect] || '') : '';
      $(`lx-${i}-s`).textContent = !l.entity ? 'nicht eingerichtet' : na ? 'N.A.' : dom === 'script' || dom === 'scene' ? 'starten' : on ? (eff ? 'An · ' + eff : 'An') : 'Aus';
      if (this._lxDrag && this._lxDrag.i === i) return;
      $(`lx-${i}-p`).textContent = dom === 'light' && on && a.brightness != null ? br + ' %' : '';
      $(`lx-${i}-b`).style.width = (dom === 'light' ? br : on ? 100 : 0) + '%';
    });
    $('lx-led').style.setProperty('--lc', n ? c.color : '#3a3c41');
    $('lx-st').textContent = n ? `${n} an` : 'alle aus';
  }
}

// ---- Bett: zwei LED-Halbkreise (Gewicht + Temperatur), je Viertelkreis eine Bettseite
// Daten: Integration "wecker" (Bett-Teil) – Einstellungen/Heizdecke aus WK.snap.bett, Gewicht/Belegung aus sensor.bett_<seite>_*
const BETT_SEITEN = ['links', 'rechts'];
// LED-Bogen: θ in Grad (0 = rechts, 90 = oben), Punkte auf Radius r um (cx, cy)
const ledArc = (cx, cy, r, a0, a1, n, cls, w = 6, h = 17) => {
  let s = '';
  for (let i = 0; i < n; i++) {
    const t = a0 + (a1 - a0) * (i / (n - 1)), rad = t * Math.PI / 180;
    s += `<rect class="${cls}" data-i="${i}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="1.6" transform="translate(${(cx + r * Math.cos(rad)).toFixed(1)} ${(cy - r * Math.sin(rad)).toFixed(1)}) rotate(${(90 - t).toFixed(1)})"/>`;
  }
  return s;
};
// Temperatur-Farbe: blau (kalt) → grün → gelb → orange → rot
const tCol = f => `hsl(${Math.round(210 - 210 * clamp(f, 0, 1))},95%,${Math.round(58 + 4 * clamp(f, 0, 1))}%)`;
// Bett von vorn (Fußende): Kopfteil, zwei Kissen, Matratze, Rahmen – je Seite Person liegend/sitzend/leer
// Bett schräg von vorne oben (Anthrazit/Grau): Liegefläche verjüngt sich zum Kopfteil, vorne Matratzenkante + Rahmen.
// Eine Hälfte wird gezeichnet, die rechte gespiegelt. Person je Seite: liegt / sitzt / frei (data-p am .bp)
const bedSvg = () => {
  // Liegefläche: hinten y 116 (x 138–262), vorne y 166 (x 108–292) → linke Kante x(y) = 138 − (y − 116)·0,6
  const sheet = y => { const x = 138 - (y - 116) * .6; return `<path d="M${x.toFixed(1)} ${y}h${(200 - x).toFixed(1)}v5h${(-(200 - x) + 3).toFixed(1)}z" fill="#d7dbe1" stroke="#1d1e21" stroke-width="1"/>`; };
  const cover = (y, bl) => { const x = 138 - (y - 116) * .6; return `<path d="M${x.toFixed(1)} ${y}H199V166H108z" fill="${bl}" stroke="#1d1e21" stroke-width="1.3" stroke-linejoin="round"/>`; };
  const half = (s, bl, bl2) => `<g class="bp" data-s="${s}"${s === 'rechts' ? ' transform="translate(400 0) scale(-1 1)"' : ''}>
      <g class="p-liegt">
        <circle cx="168" cy="124" r="8" fill="#d9b494" stroke="#1d1e21" stroke-width="1.3"/><path d="M160 122.6a8 8 0 0 1 16 0c-2.4-2.4-5-3.5-8-3.5s-5.6 1.1-8 3.5z" fill="#3b3d42"/>
        ${cover(132, bl)}<path d="M147 139q21-4 42 0q7 13-2 27h-38q-9-14-2-27z" fill="${bl2}" stroke="#1d1e21" stroke-width=".8" stroke-opacity=".5"/>${sheet(132)}
        <path d="M108 166h91v7h-91z" fill="${bl}" stroke="#1d1e21" stroke-width="1.1"/></g>
      <g class="p-sitzt">
        ${cover(150, bl)}<path d="M${(138 - 37 * .6).toFixed(1)} 153H199" stroke="${bl2}" stroke-width="2"/>
        <path d="M108 166h91v5h-91z" fill="${bl}" stroke="#1d1e21" stroke-width="1"/>
        <path d="M125 146L104 149" stroke="#1d1e21" stroke-width="9.6" stroke-linecap="round"/><path d="M125 146L104 149" stroke="#4a4e55" stroke-width="7" stroke-linecap="round"/>
        <path d="M103 149L98 180" stroke="#1d1e21" stroke-width="8.6" stroke-linecap="round"/><path d="M103 149L98 180" stroke="#4a4e55" stroke-width="6" stroke-linecap="round"/>
        <path d="M100 179.5h-10.5a3 3 0 0 0 0 5H101z" fill="#2b2d31" stroke="#1d1e21" stroke-width="1"/>
        <path d="M118 147v-28q0-8 8-8h2q8 0 8 8v28z" fill="#8d949e" stroke="#1d1e21" stroke-width="1.3"/>
        <path d="M122 120l-5 13 8 9" fill="none" stroke="#1d1e21" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M122 120l-5 13 8 9" fill="none" stroke="#8d949e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="126" cy="103" r="8.5" fill="#d9b494" stroke="#1d1e21" stroke-width="1.3"/><path d="M118 102a8.5 8.5 0 0 1 16-3.5c-1 2.5-3.5 2.5-5 1.5-2.5 2-7 3-11 2z" fill="#3b3d42"/>
        <circle cx="119" cy="104" r="1.1" fill="#1d1e21"/></g>
      <g class="p-frei">
        ${cover(150, bl)}<path d="M${(138 - 37 * .6).toFixed(1)} 153H199" stroke="${bl2}" stroke-width="2"/>
        <path d="M108 166h91v5h-91z" fill="${bl}" stroke="#1d1e21" stroke-width="1"/></g>
    </g>`;
  return `<g class="bed" transform="translate(200 196) scale(.74) translate(-200 -196)">
    <defs><linearGradient id="bt-hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b4f56"/><stop offset="1" stop-color="#2a2c31"/></linearGradient>
      <linearGradient id="bt-mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9afb7"/><stop offset="1" stop-color="#cbd0d7"/></linearGradient>
      <linearGradient id="bt-mf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa0a8"/><stop offset="1" stop-color="#787e86"/></linearGradient>
      <linearGradient id="bt-fr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3c3f45"/><stop offset="1" stop-color="#25272b"/></linearGradient></defs>
    <ellipse class="gsh" cx="200" cy="193" rx="112" ry="6"/>
    <path d="M134 118V88q0-8 8-8h116q8 0 8 8v30z" fill="url(#bt-hb)" stroke="#16171a" stroke-width="1.6"/>
    <path d="M141 114V89q0-3 3-3h112q3 0 3 3v25z" fill="#373a40" stroke="#4d5158" stroke-width="1"/><path d="M143 84h114" stroke="#5c6168" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M131 118h138l31 52H100z" fill="#2e3035" stroke="#16171a" stroke-width="1.4"/>
    <path d="M138 116h124l30 50H108z" fill="url(#bt-mt)" stroke="#16171a" stroke-width="1.3"/>
    <path d="M108 166h184v12H108z" fill="url(#bt-mf)" stroke="#16171a" stroke-width="1.3"/>
    <rect x="146" y="118" width="46" height="13" rx="6" fill="#d3d7dd" stroke="#7d838b" stroke-width="1.1"/><rect x="208" y="118" width="46" height="13" rx="6" fill="#d3d7dd" stroke="#7d838b" stroke-width="1.1"/>
    ${half('links', '#5d636c', '#6e747d')}${half('rechts', '#686e77', '#7a8089')}
    <line x1="200" y1="117" x2="200" y2="177" stroke="#6f757d" stroke-width="1.1" stroke-dasharray="2 2"/>
    <path d="M100 170h200v12H100z" fill="url(#bt-fr)" stroke="#16171a" stroke-width="1.5"/><path d="M103 172h194" stroke="#4a4e55" stroke-width="1"/>
    <rect x="104" y="181" width="9" height="12" rx="2" fill="#202226"/><rect x="287" y="181" width="9" height="12" rx="2" fill="#202226"/></g>`;
};
// Feine Skala im selben Bogen: Teilstriche (lang = Hauptstrich mit Zahl) von v0 (Winkel a0) bis v1 (a1)
const sclArc = (r, a0, a1, v0, v1, step, major, lbl, skipEnd, sd = '') => {
  let s = '';
  const n = Math.round((v1 - v0) / step);
  for (let i = 0; i <= n; i++) {
    const v = v0 + i * step, t = (a0 + (a1 - a0) * (i / n)) * Math.PI / 180, mj = Math.abs(v / major - Math.round(v / major)) < 1e-6, L = mj ? 8 : 4;
    const c = Math.cos(t), sn = Math.sin(t);
    s += `<line x1="${(200 + r * c).toFixed(1)}" y1="${(200 - r * sn).toFixed(1)}" x2="${(200 + (r + L) * c).toFixed(1)}" y2="${(200 - (r + L) * sn).toFixed(1)}" class="${mj ? 'tk mj' : 'tk'}" data-s="${sd}" data-v="${v}"/>`;
    if (mj && lbl && !(skipEnd && i === n)) s += `<text x="${(200 + (r + 13) * c).toFixed(1)}" y="${(200 - (r + 13) * sn).toFixed(1)}" class="sl" data-s="${sd}" data-v="${v}">${lbl(v)}</text>`;
  }
  return s;
};
const niceStep = (span, n) => { const raw = span / n, e = 10 ** Math.floor(Math.log10(raw)), f = raw / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
const BETT_CSS = `
.btw{display:flex;gap:6px;justify-content:center;align-items:flex-end;height:100%}
.btw.btc{display:block}
.btg{position:relative;width:400px;flex:none}
.btg svg{display:block;width:400px;height:212px;overflow:visible}
.btg .base{fill:url(#bt-base);stroke:rgba(255,255,255,.07);stroke-width:1}
.btg .sh{filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.95)) drop-shadow(0 0 4px rgba(0,0,0,.75))}
.btg .tk{stroke:#34373c;stroke-width:1;transition:stroke .3s}.btg .tk.mj{stroke:#3c3f45;stroke-width:1.4}
.btg .sl{font:9px 'Share Tech Mono',monospace;fill:#3e4147;text-anchor:middle;dominant-baseline:middle;transition:fill .3s}
.btg .tk.on{stroke:var(--c)}.btg .sl.on{fill:var(--c)}.btg .tk.on,.btg .sl.on{filter:drop-shadow(0 0 2px var(--c))}
.btg .unit{font:9px 'Share Tech Mono',monospace;fill:#3e4147;text-anchor:middle;dominant-baseline:middle;transition:fill .3s}.btg .unit.on{fill:var(--c);filter:drop-shadow(0 0 2px var(--c))}
.btg .lb{fill:#202227;stroke:#0b0c0e;stroke-width:.5;transition:fill .25s}
.btg .lb.on{fill:var(--c);filter:drop-shadow(0 0 2px var(--c))}
.btg .lb.tg{fill:#2a2420}.btg .lb.tg.on{fill:var(--c);filter:drop-shadow(0 0 2px var(--c));opacity:.75}.btg .lb.tg.tmk{fill:#ffe2c8;opacity:1;filter:none;stroke:#ff8a4c;stroke-width:1}
.btg .cap{position:absolute;left:0;right:0;bottom:-4px;text-align:center;font-size:10.5px}
.btv{position:absolute;top:62px;width:90px;text-align:center;font-family:'Share Tech Mono',monospace;color:#e8e9ec;line-height:1;pointer-events:none}
.btv.l{left:106px}.btv.r{right:106px}
.btv b{font-size:27px;font-weight:400;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 6px rgba(0,0,0,.8),0 0 12px var(--g,transparent)}.btv b small{font-size:13px;color:#8a8e96;margin-left:2px}
.btv i{display:block;font:700 10px Rajdhani,sans-serif;font-style:normal;letter-spacing:2px;color:#9a9fa8;text-transform:uppercase;margin-bottom:5px}
.btv em{display:block;font:600 12px Rajdhani,sans-serif;font-style:normal;letter-spacing:.6px;color:#8a8e96;margin-top:5px;line-height:1.25;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 5px rgba(0,0,0,.8)}
#bt-w .btv em{display:none}
#bt-w .btv{top:76px;width:72px}#bt-w .btv.l{left:128px}#bt-w .btv.r{right:128px}#bt-w .btv b{font-size:23px}
#bt-t .btv{top:100px;width:66px}#bt-t .btv.l{left:134px}#bt-t .btv.r{right:134px}#bt-t .btv b{font-size:20px}#bt-t .btv b small{font-size:11px}
.btv em.on{color:#ff8a4c;text-shadow:0 0 8px rgba(255,138,76,.6)}.btv em.warn{color:#ff6b6b}
.btv.na b{color:#868a93;font-size:20px}
.bth{position:absolute;top:0;bottom:0;width:50%;cursor:pointer;border-radius:200px 0 0 0}.bth.r{right:0;border-radius:0 200px 0 0}.bth.l{left:0}
.bth:active{background:radial-gradient(circle at 100% 100%,rgba(255,138,76,.12),transparent 70%)}.bth.r:active{background:radial-gradient(circle at 0 100%,rgba(255,138,76,.12),transparent 70%)}
.btg .bed{filter:drop-shadow(0 2px 2px rgba(0,0,0,.9)) drop-shadow(0 0 6px rgba(0,0,0,.65))}
.btg .bed .gsh{fill:rgba(0,0,0,.55);filter:blur(4px)}
.bed .bp>g{display:none}.bed .bp[data-p="liegt"] .p-liegt,.bed .bp[data-p="sitzt"] .p-sitzt,.bed .bp[data-p="frei"] .p-frei{display:inline}
.bed .bp[data-p="unbekannt"]{opacity:.35}.bed .bp[data-p="unbekannt"] .p-frei{display:inline}
.bth .flame{position:absolute}
.btmid{position:absolute;left:50%;top:164px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
.btmid svg{width:34px;height:34px;color:#9a9fa8;transition:color .3s,filter .3s}.btmid.on svg{color:#ff8a4c;filter:drop-shadow(0 0 6px rgba(255,138,76,.7))}
`;
const HEAT_POP_CSS = `<style>
.htpop{position:absolute;inset:0;z-index:44;display:grid;place-items:center;background:rgba(0,0,0,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.htpop[hidden]{display:none}
.htbox{width:640px;padding:18px 22px 20px;transform:scale(var(--su,1));display:flex;flex-direction:column;gap:14px;color:#c9ccd2;font-family:Rajdhani,'Segoe UI',sans-serif;line-height:1.2;-webkit-user-select:none;user-select:none;--acc:#ff8a4c;--accg:rgba(255,138,76,.55)}
.htbox .head .sbtn{margin-left:auto}
.htst{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.htst .tile .val{font-size:24px}
.htrow{display:flex;align-items:center;gap:14px;min-height:46px}
.htrow .lb{flex:1;font:700 12.5px Rajdhani,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#a4a8b0}
.htrow .lb small{display:block;font-size:11px;letter-spacing:.4px;color:#8c919a;text-transform:none;font-weight:600;margin-top:2px}
.htst2{display:flex;align-items:center;gap:8px}.htst2 .hk{width:52px;height:46px;font-size:24px;letter-spacing:0}
.htst2 b{min-width:120px;text-align:center;font:400 34px 'Share Tech Mono',monospace;color:var(--acc);text-shadow:0 0 12px var(--accg)}
.htseg{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:3px;border-radius:10px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 5px rgba(0,0,0,.6)}
.htseg span{height:36px;border-radius:7px;display:flex;align-items:center;justify-content:center;font:700 12.5px Rajdhani,sans-serif;letter-spacing:1px;text-transform:uppercase;color:#9a9fa8;cursor:pointer}
.htseg span.on{color:var(--acc);background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12);text-shadow:0 0 8px var(--accg)}
.htbtn{display:flex;gap:10px}.htbtn .hk{flex:1;height:52px;font-size:15px}.htbtn .hk svg{width:22px;height:22px}
.htbtn .hk.go{color:#ffb98a;--c:#ff8a4c}.htbtn .hk.off{color:#9fc3ff;--c:#4dc3ff}
.htmsg{font-size:13px;font-weight:600;color:#ff8a8a;min-height:16px;letter-spacing:.4px}
.htdis{opacity:.32;pointer-events:none}
</style>`;
const HT_DUR = [[30, '30 min'], [60, '1 h'], [120, '2 h'], [240, '4 h'], [480, '8 h'], [0, 'Dauerhaft']];
const fmtDur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h` : `${m} min`; };

class RPBett extends RPModule {
  // freie Anordnung (layout: custom) möglich; Einpass-Art je Element
  static get KINDS() { return { weight: 'fit', temp: 'fit' }; }
  static get CSS() { return BETT_CSS; }
  get meta() { return this.variants().wide; }
  variants() { return { wide: { bw: 900, mh: 316, fw: true } }; }
  static getStubConfig() { return {}; }
  // gewicht: false / temperatur: false blendet einen Halbkreis aus
  norm(c) { return { weight: c.gewicht !== false, temp: c.temperatur !== false }; }
  html() {
    const c = this._c, defs = `<defs><radialGradient id="bt-base" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#1a1c20"/><stop offset=".75" stop-color="#101114"/><stop offset="1" stop-color="#0b0c0e"/></radialGradient></defs>`;
    const base = '';
    const wg = c.weight ? `<div class="btg" id="bt-w"><svg viewBox="0 0 400 212">${defs}${base}
        <g class="sh">${ledArc(200, 200, 150, 178, 94, 40, 'lb wl', 2.6, 12)}${ledArc(200, 200, 150, 2, 86, 40, 'lb wr', 2.6, 12)}
        <g id="bt-wsc"></g><text x="200" y="28" class="unit" id="bt-wmax">200 kg</text></g>
        ${bedSvg()}</svg>
        <div class="btv l" id="bt-wl"><b>--</b><em></em></div><div class="btv r" id="bt-wr"><b>--</b><em></em></div>
        <div class="cap eng">Gewicht</div></div>` : '';
    const tg = c.temp ? `<div class="btg" id="bt-t"><svg viewBox="0 0 400 212">${defs}${base}
        <g class="sh">${ledArc(200, 200, 150, 178, 94, 40, 'lb tml', 2.6, 12)}${ledArc(200, 200, 150, 2, 86, 40, 'lb tmr', 2.6, 12)}
        ${ledArc(200, 200, 130, 177, 95, 34, 'lb tg gl', 2.2, 9)}${ledArc(200, 200, 130, 3, 85, 34, 'lb tg gr', 2.2, 9)}
        <g id="bt-tsc"></g><text x="200" y="28" class="unit" id="bt-tmax">45 °C</text></g></svg>
        <div class="btmid" id="bt-mid">${BI.heat}</div>
        <div class="btv l" id="bt-tl"><b>--</b><em></em></div><div class="btv r" id="bt-tr"><b>--</b><em></em></div>
        <div class="bth l" data-act="heat:links"></div><div class="bth r" data-act="heat:rechts"></div>
        <div class="cap eng">Matratze · Heizdecke</div></div>` : '';
    const p = { weight: wg ? this.P('weight', wg) : '', temp: tg ? this.P('temp', tg) : '' };
    return this._v === 'custom' ? `<div class="btw btc">${this._cgrid(p)}</div>` : `<div class="btw">${p.weight}${p.temp}</div>`;
  }
  onHass() { if (!this._wkU) this._wkU = wkSub(this._hass, () => { this.update(); this._htRender(); }); }
  onConnect() { if (this._hass) this.onHass(); clearInterval(this._btI); this._btI = setInterval(() => this._htTick(), 15000); }
  onDisconnect() { clearInterval(this._btI); if (this._wkU) { this._wkU(); this._wkU = null; } }
  _cfg() { return (WK.snap && WK.snap.bett && WK.snap.bett.config) || {}; }
  _heat(s) { return ((WK.snap && WK.snap.bett && WK.snap.bett.heat) || {})[s] || {}; }
  watch() { const c = this._cfg(); return BETT_SEITEN.flatMap(s => [`sensor.bett_${s}_gewicht`, `sensor.bett_${s}_belegung`, (c[s] || {}).temperatur]); }
  _val(id) { const s = this._st(id); return this._ok(s) && isFinite(Number(s.state)) ? Number(s.state) : null; }
  // Striche + Zahlen der Skala (Seite s) bis zum Wert v in der Farbe der LEDs leuchten lassen
  _scl(box, s, v, col) {
    this.shadowRoot.querySelectorAll(`#${box} [data-s="${s}"]`).forEach(e => {
      const on = v != null && Number(e.dataset.v) <= v + 1e-9;
      e.classList.toggle('on', on); e.style.setProperty('--c', on ? col(Number(e.dataset.v)) : '');
    });
  }
  _leds(sel, f, col, mark) {
    const r = this.shadowRoot.querySelectorAll(sel), n = r.length, k = f == null ? 0 : Math.round(clamp(f, 0, 1) * n);
    r.forEach((e, i) => { const on = i < k; e.classList.toggle('on', on); e.classList.toggle('tmk', mark != null && i === mark); e.style.setProperty('--c', on ? col(i / Math.max(1, n - 1)) : ''); });
  }
  update() {
    const $ = this.$, c = this._cfg(); if (!$) return;
    const mx = Number(c.max_kg) || 200, t0 = c.temp_min != null && isFinite(+c.temp_min) ? +c.temp_min : 15, t1 = Number(c.temp_max) || 45;
    if ($('bt-w')) {
      $('bt-wmax').textContent = mx + ' kg';
      { const top = Math.max(...BETT_SEITEN.map(s => this._val(`sensor.bett_${s}_gewicht`) ?? -1)); $('bt-wmax').classList.toggle('on', top >= mx); $('bt-wmax').style.setProperty('--c', volCol(1)); }
      const wk = 'w' + mx; if (this._wsk !== wk) { this._wsk = wk; const st = niceStep(mx, 20), mj = niceStep(mx, 4), f = v => Math.round(v); $('bt-wsc').innerHTML = sclArc(159, 178, 94, 0, mx, st, mj, f, true, 'links') + sclArc(159, 2, 86, 0, mx, st, mj, f, true, 'rechts'); }
      BETT_SEITEN.forEach(s => {
        const kg = this._val(`sensor.bett_${s}_gewicht`), bs = this._st(`sensor.bett_${s}_belegung`), bel = bs ? bs.state : 'unbekannt';
        this._leds('.wl'.replace('l', s === 'links' ? 'l' : 'r'), kg == null ? null : kg / mx, f => volCol(f));
        this._scl('bt-wsc', s, kg, v => volCol(v / mx));
        const el = $(s === 'links' ? 'bt-wl' : 'bt-wr');
        el.classList.toggle('na', kg == null);
        this._html(el.querySelector('b'), kg == null ? 'N.A.' : `${de(kg, 1)}<small>kg</small>`);
        const bp = this.shadowRoot.querySelector(`.bp[data-s="${s}"]`); if (bp) bp.dataset.p = bel === 'belegt' ? 'liegt' : bel;
      });
    }
    if ($('bt-t')) {
      $('bt-tmax').textContent = t1 + ' °C';
      { const top = Math.max(...BETT_SEITEN.map(s => this._val((c[s] || {}).temperatur) ?? -99)); $('bt-tmax').classList.toggle('on', top >= t1); $('bt-tmax').style.setProperty('--c', tCol(1)); }
      const tk = t0 + '-' + t1; if (this._tsk !== tk) { this._tsk = tk; const st = niceStep(t1 - t0, 30), mj = niceStep(t1 - t0, 6), f = v => Math.round(v); $('bt-tsc').innerHTML = sclArc(159, 178, 94, t0, t1, st, mj, f, true, 'links') + sclArc(159, 2, 86, t0, t1, st, mj, f, true, 'rechts'); }
      let any = false;
      BETT_SEITEN.forEach(s => {
        const L = s === 'links', tv = this._val((c[s] || {}).temperatur), h = this._heat(s), fr = v => (v - t0) / (t1 - t0);
        this._leds(L ? '.tml' : '.tmr', tv == null ? null : fr(tv), f => tCol(f));
        this._scl('bt-tsc', s, tv, v => tCol(fr(v)));
        const tgt = h.target != null ? h.target : Number(c.standard_temp) || 30, n = 34, mk = Math.round(clamp(fr(tgt), 0, 1) * n) - 1;
        this._leds(L ? '.gl' : '.gr', h.on ? fr(tgt) : 0, () => '#ff8a4c', h.on ? mk : null);
        const el = $(L ? 'bt-tl' : 'bt-tr'), em = el.querySelector('em');
        el.classList.toggle('na', tv == null);
        el.style.setProperty('--g', tv == null ? 'transparent' : tCol(fr(tv)));
        this._html(el.querySelector('b'), tv == null ? 'N.A.' : `${de(tv, 1)}<small>°C</small>`);
        const st = h.status || 'aus';
        em.className = st === 'heizt' || st === 'haelt' ? 'on' : st === 'schutz' || st === 'fehler' ? 'warn' : '';
        this._html(em, st === 'schutz' ? 'Übertemperatur!' : st === 'fehler' ? 'Sensor fehlt' : h.on ? `Ziel ${de(h.target, 1)}°<br>${h.dauerhaft ? 'max. ' : 'noch '}${fmtDur(Date.parse(h.until) - wkNow())}` : (c[s] || {}).heizung ? 'aus' : 'keine Decke');
        any = any || !!h.on;
      });
      $('bt-mid').classList.toggle('on', any);
    }
  }
  _htTick() { if (this._built && this._hass) { this._rendered = false; this.update(); } }
  act(cmd, arg) { if (cmd === 'heat') this._htOpen(arg); else if (cmd === 'ht') this._htAct(arg); }

  // ---- Heizdecken-Fenster
  _htOpen(s) {
    const c = this._cfg(), h = this._heat(s), o = this._overlay();
    if (!o.querySelector('#htpop')) {
      o.insertAdjacentHTML('beforeend', `${HEAT_POP_CSS}<div class="htpop" id="htpop" hidden><div class="plate card htbox" id="htbox"></div></div>`);
      const p = o.querySelector('#htpop'); p.addEventListener('pointerdown', e => { if (e.target === p) this._htClose(); });
      o.addEventListener('pointerdown', e => {
        const t = e.target.closest('[data-rep]'); if (!t || !this._hass) return;
        e.preventDefault(); const go = () => this._htAct(t.dataset.rep.replace(/^ht:/, '')); go(); let iv = null;
        const to = setTimeout(() => { iv = setInterval(go, 110); }, 420);
        const end = () => { clearTimeout(to); clearInterval(iv); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
        window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
      });
    }
    const mxd = Number(c.max_dauer_min) || 600;
    this._ht = { s, target: h.on && h.target != null ? h.target : Number(c.standard_temp) || 30, dur: h.on ? (h.dauerhaft ? 0 : null) : (Number(c.standard_dauer_min) || 60), maxd: mxd, msg: '' };
    if (this._ht.dur === null) this._ht.dur = 60;
    o.querySelector('#htpop').hidden = false;
    this._htRender();
  }
  _htClose() { const o = this._ovl; if (o && o.querySelector('#htpop')) o.querySelector('#htpop').hidden = true; this._ht = null; }
  _htRender() {
    const H = this._ht, o = this._ovl; if (!H || !o) return;
    const c = this._cfg(), h = this._heat(H.s), sc = c[H.s] || {}, tv = this._val(sc.temperatur), mx = Number(c.max_temp) || 38, mxd = Number(c.max_dauer_min) || 600;
    const st = h.status || 'aus', on = !!h.on;
    const stTxt = { aus: 'aus', heizt: 'heizt', haelt: 'hält Temperatur', schutz: 'Übertemperatur-Schutz', fehler: 'Sensor fehlt' }[st] || st;
    o.querySelector('#htbox').innerHTML = `<div class="head"><span class="led" style="--lc:${on ? '#ff8a4c' : '#3a3c41'}"></span><div class="t"><h2 class="eng">Heizdecke · ${H.s === 'links' ? 'Links' : 'Rechts'}</h2><p>${sc.heizung ? escH(sc.heizung) : 'Keine Heizdecke eingestellt'}</p></div><div class="sbtn sx" data-act="ht:close">${BI.x}</div></div>
      <div class="htst"><div class="tile"><div class="n">Matratze</div><div class="val">${tv == null ? '--' : de(tv, 1)}<small> °C</small></div></div>
        <div class="tile"><div class="n">Status</div><div class="val" style="font-size:18px;color:${on ? '#ff8a4c' : st === 'schutz' || st === 'fehler' ? '#ff6b6b' : '#8a8e96'}">${stTxt}</div></div>
        <div class="tile"><div class="n">Restzeit</div><div class="val">${on && h.until ? fmtDur(Date.parse(h.until) - wkNow()) : '--'}</div></div></div>
      <div class="htrow"><div class="lb">Zieltemperatur<small>höchstens ${de(mx, 1)} °C · Schutz bei ${de(c.schutz_temp, 0)} °C</small></div>
        <div class="htst2"><div class="hk" data-rep="ht:t:-0.5">−</div><b id="ht-t">${de(H.target, 1)}°</b><div class="hk" data-rep="ht:t:0.5">+</div></div></div>
      <div class="htrow" style="flex-direction:column;align-items:stretch;gap:8px"><div class="lb">Dauer</div>
        <div class="htseg">${HT_DUR.map(([v, l]) => `<span class="${H.dur === v ? 'on' : ''}${v && v > mxd ? ' htdis' : ''}" data-act="ht:d:${v}">${l}</span>`).join('')}</div></div>
      <div class="htrow${H.dur === 0 ? '' : ' htdis'}" id="ht-mxr"><div class="lb">Dauerhaft höchstens<small>Grenze aus den Einstellungen: ${fmtDur(mxd * 60000)}</small></div>
        <div class="htst2"><div class="hk" data-rep="ht:m:-30">−</div><b id="ht-m" style="font-size:26px">${fmtDur(Math.min(H.maxd, mxd) * 60000)}</b><div class="hk" data-rep="ht:m:30">+</div></div></div>
      <div class="htmsg" id="ht-msg">${escH(H.msg || '')}</div>
      <div class="htbtn"><div class="hk go" data-act="ht:on"><i></i>${BI.heat}${on ? 'Übernehmen' : 'Einschalten'}</div><div class="hk off${on ? '' : ' htdis'}" data-act="ht:off"><i></i>Ausschalten</div></div>`;
  }
  async _htAct(arg) {
    const H = this._ht; if (!H) return;
    const [k, v] = arg.split(':'), c = this._cfg(), o = this._ovl;
    if (k === 'close') return this._htClose();
    if (k === 't') { H.target = clamp(Math.round((H.target + Number(v)) * 2) / 2, 15, Number(c.max_temp) || 38); o.querySelector('#ht-t').textContent = de(H.target, 1) + '°'; return; }
    if (k === 'm') { H.maxd = clamp(H.maxd + Number(v), 30, Number(c.max_dauer_min) || 600); o.querySelector('#ht-m').textContent = fmtDur(H.maxd * 60000); return; }
    if (k === 'd') { H.dur = Number(v); return this._htRender(); }
    try {
      if (k === 'on') await this._hass.callWS({ type: 'wecker/bett/heat', seite: H.s, on: true, temperatur: H.target, dauer_min: H.dur || H.maxd, dauerhaft: H.dur === 0 });
      if (k === 'off') await this._hass.callWS({ type: 'wecker/bett/heat', seite: H.s, on: false });
      H.msg = ''; this._htRender();
    } catch (e) { H.msg = (e && (e.message || e.code)) || String(e); this._htRender(); }
  }
}

// ---- Einstellungen fürs Bett-Fenster: bereich = wecker | uhr | gewicht | temperatur
const BSET_FIELDS = {
  gewicht: [['gesamt', 'Gesamtgewicht', 'ein Sensor für die ganze Seite (kg)'], ['zellen.kopf_aussen', 'Wägezelle Kopf außen', 'kg'], ['zellen.kopf_innen', 'Wägezelle Kopf innen', 'kg'],
    ['zellen.fuss_aussen', 'Wägezelle Fuß außen', 'kg'], ['zellen.fuss_innen', 'Wägezelle Fuß innen', 'kg']],
  temperatur: [['heizung', 'Heizdecke (Steuerung)', 'Schalter, Licht, Lüfter oder Thermostat (climate)'], ['temperatur', 'Matratzentemperatur', 'Sensor in °C']],
};
const BSET_NUM = {
  gewicht: [['belegt_kg', 'Belegt ab', 'kg', 1, 1, 150], ['max_kg', 'Anzeige bis', 'kg', 10, 20, 500]],
  temperatur: [['max_temp', 'Max. Zieltemperatur', '°C', .5, 20, 50], ['schutz_temp', 'Übertemperatur-Schutz', '°C', .5, 25, 70], ['max_dauer_min', 'Max. Dauer (auch dauerhaft)', 'min', 30, 30, 1440],
    ['standard_temp', 'Standard-Temperatur', '°C', .5, 15, 50], ['standard_dauer_min', 'Standard-Dauer', 'min', 15, 15, 1440], ['hysterese', 'Schalt-Hysterese', '°C', .1, .2, 5]],
};
const BSET_CSS = `<style>${WK_SW_CSS}
.bsx{display:flex;flex-direction:column;gap:12px;height:100%;--acc:var(--tc,#4dc3ff)}
.bsx .lpg{gap:22px}
.bsn{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px 12px;padding:8px 12px;border-radius:11px;background:rgba(0,0,0,.25);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.bsn .t{font-size:11.5px;letter-spacing:2px;font-weight:700;color:#8a8e96;text-transform:uppercase}
.bsn .st{display:flex;align-items:center;gap:5px}.bsn .st .hk{width:30px;height:30px;font-size:18px;letter-spacing:0}
.bsn .st b{min-width:74px;text-align:center;font:400 15px 'Share Tech Mono',monospace;color:#e8e9ec;white-space:nowrap}
.bsn .t{font-size:10.5px;letter-spacing:1.4px;line-height:1.3}
.bsg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bsl{font-size:11px;letter-spacing:2px;color:#8a8e96;text-transform:uppercase;margin-top:4px}
.bsv{font:400 14px 'Share Tech Mono',monospace;color:var(--acc)}
.bsx .hsr.on{box-shadow:0 0 0 2px var(--acc),inset 0 1px 3px rgba(0,0,0,.5)}.bsx .hsr .t i{color:var(--acc)}
.bsx .hsl .hpi.on{box-shadow:0 0 0 2px var(--acc),inset 0 1px 3px rgba(0,0,0,.5)}
.bsseg{display:flex;gap:4px;padding:3px;border-radius:10px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 5px rgba(0,0,0,.6)}
.bsseg span{flex:1;height:40px;border-radius:7px;display:flex;align-items:center;justify-content:center;font:700 13px Rajdhani,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#9a9fa8;cursor:pointer}
.bsseg span.on{color:var(--acc);background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12)}
.bsart{display:grid;grid-template-columns:1fr;gap:6px}
.bsart .hsr{padding:8px 12px}.bsart .hsr b{font-size:13.5px}
.bsdir{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:3px;border-radius:10px;background:rgba(0,0,0,.35);box-shadow:inset 0 2px 5px rgba(0,0,0,.6)}
.bsdir span{height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font:700 12px Rajdhani,sans-serif;letter-spacing:1.4px;color:#9a9fa8;cursor:pointer}
.bsdir span.on{color:var(--acc);background:linear-gradient(180deg,#3a3c42,#26272b);box-shadow:0 2px 0 #0b0b0c,inset 0 1px 0 rgba(255,255,255,.12)}
.bsrg{display:grid;grid-template-columns:1fr 54px;align-items:center;gap:10px}.bsrg input{width:100%;accent-color:var(--acc)}.bsrg b{font:400 15px 'Share Tech Mono',monospace;color:#e8e9ec;text-align:right}
.bscol{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.bscol i{width:28px;height:28px;border-radius:7px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 2px 0 #0b0b0c}
.bscol i.on{box-shadow:0 0 0 2px var(--acc),0 0 10px var(--acc)}.bscol input{width:40px;height:30px;border:0;padding:0;background:none;cursor:pointer}
.bsimg{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;overflow-y:auto;max-height:228px;padding:2px;scrollbar-width:thin}
.bsimg .im{position:relative;aspect-ratio:16/10;border-radius:8px;background:#1b1d21 center/cover no-repeat;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.bsimg .im.on{box-shadow:0 0 0 2px var(--acc),0 0 12px var(--acc)}
.bsimg .im em{position:absolute;right:3px;top:3px;width:20px;height:20px;border-radius:5px;display:grid;place-items:center;font-style:normal;font-size:13px;color:#ffb0b0;background:rgba(0,0,0,.65)}
.bsimg .im.all{display:grid;place-items:center;font:700 11px Rajdhani,sans-serif;letter-spacing:1.4px;color:#9a9ea6;text-transform:uppercase;text-align:center;background:rgba(0,0,0,.3)}
.bsmoon{display:flex;gap:14px;align-items:center}.bsmoon svg{width:64px;height:64px;flex:none;filter:drop-shadow(0 0 8px rgba(215,225,255,.35))}
.bsclk{display:grid;grid-template-columns:1fr 1fr;gap:12px}.bsclk .lcd{text-align:center;padding:14px 10px}
.bsclk .lcd b{display:block;font-size:44px;color:#ffb347;text-shadow:0 0 12px rgba(255,170,60,.7);position:relative;z-index:1}
.bsclk .lcd span{display:block;font:700 11px Rajdhani,sans-serif;letter-spacing:2px;color:#8a8e96;text-transform:uppercase;position:relative;z-index:1;margin-top:4px}
.bsclk .lcd.sel{box-shadow:inset 0 4px 10px #000,0 0 0 2px var(--acc)}
</style>`;
// Gewählte Bettseite im Einstellungs-Fenster – gilt für Wecker, Gewicht und Temperatur gemeinsam.
// null = Seite des Panels (beim Öffnen des Fensters zurückgesetzt)
const BS_SIDE = { v: null, subs: new Set(), set(s) { this.v = s; this.subs.forEach(f => f()); } };
class RPBettSettings extends RPModule {
  static get NO_CUSTOM() { return true; }
  get meta() { return this.variants().full; }
  // Wecker-Seite steht neben der Wecker-Liste (schmaler), die anderen Seiten über die volle Breite
  variants() { return { full: { bw: 1040, mh: 430, fw: false, fh: false } }; }
  // HA-Zustand auch an die eingebettete Wecker-Liste weitergeben
  set hass(h) { super.hass = h; if (this._wkEl) this._wkEl.hass = h; }
  get hass() { return super.hass; }
  static getStubConfig() { return { bereich: 'gewicht' }; }
  norm(c) { return { area: c.bereich || c.area || 'gewicht', seite: c.seite || 'links', col: c.farbe || { wecker: '#ffb347', uhr: '#9fc3ff', gewicht: '#3ddc84', temperatur: '#ff8a4c', allgemein: '#4dc3ff', erscheinung: '#a36bff' }[c.bereich || 'gewicht'] }; }
  html() {
    const a = this._c.area;
    const sideTabs = a === 'gewicht' || a === 'temperatur' || a === 'wecker' || a === 'allgemein' || a === 'erscheinung' ? `<div class="lseg" style="grid-template-columns:repeat(2,minmax(0,240px))">${BETT_SEITEN.map(s => `<div class="lsg" data-act="side:${s}" id="bs-t-${s}">Bettseite ${s === 'links' ? 'Links' : 'Rechts'}</div>`).join('')}</div>` : '';
    return `${LSET_CSS}${HSET_CSS}${BSET_CSS}<div class="bsx" style="--tc:${this._c.col}">${sideTabs}
      <div class="lpg" style="flex:none;height:${sideTabs ? 370 : 410}px"><div class="lcol" style="width:${a === 'wecker' ? 330 : a === 'uhr' ? 520 : 310}px;flex:none;${a === 'wecker' ? 'position:relative' : 'overflow-y:auto;overflow-x:hidden'}" id="bs-left">${a === 'wecker' ? '<div id="bs-wk" style="position:absolute;inset:0"></div>' : ''}</div>
      <div class="lcol" style="width:340px;flex:none;overflow-y:auto;overflow-x:hidden;${sideTabs ? '' : 'display:none'}" id="bs-mid"></div>
      <div class="lcol" style="flex:1;min-width:0" id="bs-right"></div></div></div>`;
  }
  onHass() { if (!this._wkU) this._wkU = wkSub(this._hass, () => this._paint()); }
  onConnect() {
    if (this._hass) this.onHass(); clearInterval(this._bsI); if (this._c.area === 'uhr') this._bsI = setInterval(() => this._paint(), 1000);
    if (!this._bsF) this._bsF = () => { this._prev = {}; this._rendered = false; this._f = ''; const q = this.$ && this.$('bs-q'); if (q) q.value = ''; this._paint(); };
    BS_SIDE.subs.add(this._bsF);
  }
  onDisconnect() { clearInterval(this._bsI); if (this._wkU) { this._wkU(); this._wkU = null; } BS_SIDE.subs.delete(this._bsF); }
  watch() { const c = this._bc(), s = c[this._side()] || {}; return [s.gesamt, s.heizung, s.temperatur, ...Object.values(s.zellen || {}), `sensor.bett_${this._side()}_gewicht`, `sensor.bett_${this._side()}_heizdecke`]; }
  update() { this._paint(); }
  bind() { const q = this.$('bs-q'); if (q) q.addEventListener('input', () => { this._f = q.value.trim().toLowerCase(); this._list(); }); }
  _bc() { return (WK.snap && WK.snap.bett && WK.snap.bett.config) || {}; }
  _side() { return BS_SIDE.v || this._c.seite || 'links'; }
  _admin() { return !!(this._hass && this._hass.user && this._hass.user.is_admin); }
  async _save(patch, ok = 'Gespeichert') {
    if (!this._admin()) { this._msg('Ändern nur mit einem Administrator-Konto möglich', false); return; }
    try { await this._hass.callWS({ type: 'wecker/settings/save', settings: patch }); this._msg(ok); } catch (e) { this._msg('Fehler: ' + ((e && (e.message || e.code)) || e), false); }
  }
  _msg(t, ok = true) { this._m = { t, ok }; const m = this.$('bs-msg'); if (m) { m.textContent = t; m.style.color = ok ? '#3ddc84' : '#ff8a8a'; } clearTimeout(this._mt); this._mt = setTimeout(() => { this._m = null; const m2 = this.$('bs-msg'); if (m2) m2.textContent = ''; }, 4000); }
  _get(path) { const s = this._bc()[this._side()] || {}; return path.split('.').reduce((o, k) => (o || {})[k], s) || ''; }
  _ename(id) { const st = id && this._hass.states[id]; return st ? (st.attributes.friendly_name || id) : id; }
  _eval(id) { const st = id && this._hass.states[id]; return !id ? '' : st ? `${st.state} ${st.attributes.unit_of_measurement || ''}` : 'nicht gefunden'; }
  _paint() {
    if (!this._built || !this._hass || !this.$('bs-left')) return;
    const a = this._c.area, $ = this.$, snap = WK.snap;
    BETT_SEITEN.forEach(s => { const t = $('bs-t-' + s); if (t) t.classList.toggle('on', s === this._side()); });
    if (!snap) { this._html($('bs-left'), `<div class="lhint">${WK.err ? 'Integration „wecker“ nicht geladen: ' + escH(WK.err) : 'Lade …'}</div>`); return; }
    const msg = `<div class="lmsg" id="bs-msg" style="color:${this._m && !this._m.ok ? '#ff8a8a' : '#3ddc84'}">${escH(this._m ? this._m.t : '')}</div>`;
    if (a === 'uhr') return this._paintUhr(msg);
    if (a === 'erscheinung') return this._paintBg(msg);
    if (a === 'allgemein') return this._paintAllg(msg);
    if (a === 'wecker') return this._paintWecker(msg);
    const sel = this._sel || BSET_FIELDS[a][0][0], c = this._bc();
    const rows = BSET_FIELDS[a].map(([k, t, d]) => { const id = this._get(k); return `<div class="hsr${k === sel ? ' on' : ''}" data-act="sel:${k}"><div class="t">${t}<i>${escH(this._eval(id))}</i></div><b>${id ? escH(this._ename(id)) : '– nicht gesetzt –'}</b><small>${id ? escH(id) : escH(d)}</small></div>`; }).join('');
    const nums = BSET_NUM[a].map(([k, t, u, st]) => `<div class="bsn"><div class="t">${t}</div><div class="st"><div class="hk" data-act="num:${k}:${-st}">−</div><b>${de(c[k], st < 1 ? 1 : 0)} ${u}</b><div class="hk" data-act="num:${k}:${st}">+</div></div></div>`).join('');
    let live = '';
    if (a === 'gewicht') {
      const g = this._hass.states[`sensor.bett_${this._side()}_gewicht`], sc = c[this._side()] || {};
      live = `<div class="bsn"><div class="t">Leergewicht (Tara)<br><span class="bsv">${de(sc.tara || 0, 1)} kg</span> · jetzt <span class="bsv">${g && this._ok(g) ? de(Number(g.state), 1) + ' kg' : '--'}</span> · ${escH((this._hass.states[`sensor.bett_${this._side()}_belegung`] || {}).state || '')}</div><div class="hk" data-act="tara" style="padding:0 14px">Jetzt tarieren</div></div>`;
    } else {
      const h = (snap.bett.heat || {})[this._side()] || {};
      live = `<div class="bsn"><div class="t">Heizdecke jetzt</div><b class="bsv">${escH({ aus: 'aus', heizt: 'heizt', haelt: 'hält', schutz: 'Schutz!', fehler: 'Sensor fehlt' }[h.status] || 'aus')}${h.on ? ` · ${de(h.target, 1)} °C` : ''}</b></div>`;
    }
    this._html($('bs-left'), `<div class="bsl">Entitäten · Bettseite ${this._side()}</div>${rows}${msg}`);
    this._html($('bs-mid'), `<div class="bsl">${a === 'gewicht' ? 'Gewicht · Bettseite ' + this._side() : 'Status · Bettseite ' + this._side()}</div>${live}<div class="bsl">${a === 'gewicht' ? 'Anzeige (beide Seiten)' : 'Grenzen (beide Seiten)'}</div><div style="display:flex;flex-direction:column;gap:8px">${nums}</div>${a === 'temperatur' ? '<div class="lhint">Die Regelung läuft in Home Assistant: Laufzeit immer begrenzt, bei Übertemperatur sofort aus und gesperrt, bis die Matratze 5 °C kühler ist; ohne Temperaturwert bleibt die Decke aus.</div>' : '<div class="lhint">Mit 4 Wägezellen erkennt das Bett zusätzlich, ob jemand sitzt oder liegt (Verteilung Kopf/Fuß und Kante/Mitte).</div>'}`);
    if (!this.$('bs-q')) { this._html($('bs-right'), `<div class="cap eng" id="bs-head"></div><input class="hsq" id="bs-q" placeholder="Suchen …" autocomplete="off"><div class="hsl" id="bs-l"></div>`); this.bind(); }
    this._list();
  }
  _fit_(k, id) {
    const st = this._hass.states[id], u = (st.attributes || {}).unit_of_measurement || '', dc = (st.attributes || {}).device_class || '', dom = id.split('.')[0];
    if (k === 'heizung') return ['switch', 'light', 'fan', 'input_boolean', 'climate'].includes(dom) ? 2 : 0;
    if (k === 'temperatur') return dom === 'sensor' ? (/°/.test(u) || dc === 'temperature' ? 2 : 0) : 0;
    if (k === 'player') return dom === 'media_player' ? 2 : 0;
    if (k === 'akku_level') return dom === 'sensor' && u === '%' ? (dc === 'battery' || /batter|akku/i.test(id) ? 2 : 1) : 0;
    if (k === 'akku_lader') return dom === 'sensor' && !u ? (/charger|lader|plug|power_source/i.test(id) ? 2 : 0) : 0;
    if (k === 'akku_status') {
      if (dom === 'binary_sensor') return dc === 'battery_charging' || dc === 'plug' || /charg|lade|plug|netz|power/i.test(id) ? 2 : 0;
      return dom === 'sensor' && !u ? (/battery_state|batterie_status|akku_status|charging/i.test(id) ? 2 : /charg|lade|power_source|plug/i.test(id) ? 1 : 0) : 0;
    }
    if (k === 'au.laut' || k.startsWith('au.eq.') || k === 'vb.staerke') return ['number', 'input_number'].includes(dom) ? (/vol|laut|bass|sub|treble|hoehe|mitte|stark|starke|stärke/i.test(id) ? 2 : 1) : 0;
    if (k === 'au.ein' || k === 'vb.schalter') return ['switch', 'input_boolean'].includes(dom) ? (/power|vib|ein/i.test(id) ? 2 : 1) : ['light', 'media_player'].includes(dom) ? 1 : 0;
    if (k === 'au.quelle' || k === 'vb.muster') return ['select', 'input_select'].includes(dom) ? (/input|source|quelle|muster/i.test(id) ? 2 : 1) : 0;
    return dom === 'sensor' ? (/^(kg|g|lb)$/i.test(u) || dc === 'weight' ? 2 : /^sensor\.bett_/.test(id) ? 0 : 1) : 0;
  }
  _list() {
    const L = this.$('bs-l'); if (!L || !this._hass) return;
    const a = this._c.area, sel = this._sel || (a === 'wecker' ? 'player' : a === 'allgemein' ? 'akku_level' : BSET_FIELDS[a][0][0]);
    const wkv = k => { const s0 = this._side(), au = (WK.snap.ausgabe || {})[s0] || {}, vb = (WK.snap.vibration || {})[s0] || {}; return k === 'player' ? ((WK.snap.seiten || {})[s0] || {}).player || '' : k.startsWith('au.eq.') ? (au.eq || {})[k.slice(6)] || '' : k.startsWith('au.') ? au[k.slice(3)] || '' : k.startsWith('vb.') ? vb[k.slice(3)] || '' : ''; };
    const WKT = { player: 'Lautsprecher', 'au.laut': 'Lautstärke-Regler', 'au.ein': 'Einschalten', 'au.quelle': 'Quelle', 'vb.schalter': 'Vibration Ein/Aus', 'vb.staerke': 'Vibration Stärke', 'vb.muster': 'Vibration Muster', ...Object.fromEntries(WK_EQ.map(([k, l]) => ['au.eq.' + k, 'Klang ' + l])) };
    const cur = a === 'wecker' ? wkv(sel) : a === 'allgemein' ? this._bg()[sel] || '' : this._get(sel), f = this._f || '';
    const t = a === 'wecker' ? `${WKT[sel] || sel} · ${this._side()}` : a === 'allgemein' ? `${(AKKU_F[sel] || [sel])[0]} · ${this._side()}` : (BSET_FIELDS[a].find(x => x[0] === sel) || [])[1];
    this.$('bs-head').textContent = 'Auswahl · ' + t;
    const ids = Object.keys(this._hass.states).map(id => [id, this._fit_(sel, id)]).filter(([id, r]) => r > 0 && (!f || id.toLowerCase().includes(f) || String(this._hass.states[id].attributes.friendly_name || '').toLowerCase().includes(f)));
    ids.sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
    const row = id => `<div class="hpi${id === cur ? ' on' : ''}" data-act="set:${id}"><b>${escH(this._ename(id))}</b><small>${id} · ${escH(this._eval(id))}</small></div>`;
    this._html(L, `<div class="hpi${cur ? '' : ' on'}" data-act="set:"><b>– keine –</b><small>Feld leeren</small></div>` + (ids.length ? ids.slice(0, 150).map(([id]) => row(id)).join('') : '<div class="hpg">Keine passenden Einträge</div>'));
  }
  _paintUhr(msg) {
    const tz = ((WK.snap.uhr || {}).zeitzone) || 'tablet', d = new Date(), stz = (this._hass.config || {}).time_zone || '?', btz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const f = z => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', ...(z ? { timeZone: z } : {}) });
    this._html(this.$('bs-left'), `<div class="bsl">Zeitzone der Uhr</div><div class="bsseg"><span class="${tz === 'tablet' ? 'on' : ''}" data-act="tz:tablet">Tablet</span><span class="${tz === 'server' ? 'on' : ''}" data-act="tz:server">Server (Home Assistant)</span></div>
      <div class="bsclk"><div class="lcd${tz === 'tablet' ? ' sel' : ''}"><b class="mono">${f()}</b><span>Tablet · ${escH(btz)}</span></div><div class="lcd${tz === 'server' ? ' sel' : ''}"><b class="mono">${f(stz)}</b><span>Server · ${escH(stz)}</span></div></div>${msg}`);
    this._html(this.$('bs-right'), `<div class="lhint" style="font-size:13px;line-height:1.6"><b>Tablet</b>: die Uhr zeigt die Zeit und Zeitzone, die im Tablet eingestellt ist.<br><b>Server</b>: die Uhr rechnet immer in der Zeitzone von Home Assistant (${escH(stz)}) – sinnvoll, wenn die Zeitzone des Tablets falsch eingestellt ist.<br><br>Die Weckzeiten selbst gelten immer in der Zeitzone von Home Assistant, weil Home Assistant die Wecker auslöst.</div>`);
  }
  _bg() { return ((WK.snap && WK.snap.hintergrund) || {})[this._side()] || { art: 'aurora', farbe: '#101a2c', bild: '', diashow_min: 10, abdunkeln: 25, blick: 180 }; }
  _paintBg(msg) {
    cdFaces();
    const g = this._bg(), s = this._side(), on = c => c ? ' on' : '';
    const ARTS = [['aurora', 'Aurora', 'Farbspiel nach Sonnenstand (wie bisher)'], ['himmel', 'Himmel', 'echter Sonnen- und Mondstand mit Mondphase, Sterne bei Nacht'],
      ['beides', 'Aurora + Himmel', 'Aurora mit Sonne, Mond und Sternen darüber'], ['farbe', 'Farbe', 'eine feste Hintergrundfarbe'], ['bild', 'Bild', 'Bild aus media/wallpaper, auch als Diashow']];
    const COLS = ['#101a2c', '#0b0d12', '#1a1024', '#0e1f1a', '#241510', '#1c1c1c', '#06223a', '#2a0f18'];
    const DIRS = [[0, 'N'], [90, 'O'], [180, 'S'], [270, 'W']];
    this._html(this.$('bs-left'), `<div class="bsl">Hintergrund · Bettseite ${s === 'links' ? 'Links' : 'Rechts'}</div>
      <div class="bsart">${ARTS.map(([k, t, d]) => `<div class="hsr${on(g.art === k)}" data-act="bg:art:${k}"><div class="t">${t}</div><small>${d}</small></div>`).join('')}</div>${msg}`);
    const sel = g.art;
    const mid = [];
    if (sel === 'farbe') mid.push(`<div class="bsl">Farbe</div><div class="bscol">${COLS.map(c => `<i class="${g.farbe === c ? 'on' : ''}" style="background:${c}" data-act="bg:farbe:${c}"></i>`).join('')}<input type="color" id="bg-col" value="${escH(g.farbe)}" title="eigene Farbe"></div>`);
    if (sel === 'bild') {
      const ims = this._bgIms || [];
      mid.push(`<div class="bsl">Bilder in media/wallpaper${this._admin() ? ' · <span style="color:var(--acc);cursor:pointer" data-act="bg:up">＋ hochladen</span>' : ''}</div>
        <div class="bsimg"><div class="im all${on(!g.bild)}" data-act="bg:bild:">Alle<br>(Diashow)</div>${ims.map(m => `<div class="im${on(g.bild === m.id)}" data-act="bg:bild:${escH(m.id)}" title="${escH(m.title)}" style="background-image:${m.url ? `url('${m.url}')` : 'none'}">${this._admin() ? `<em data-act="bg:del:${escH(m.id)}">×</em>` : ''}</div>`).join('')}</div>
        ${ims.length ? '' : '<div class="lhint">Noch keine Bilder – mit „＋ hochladen“ oder per Samba in den Ordner media/wallpaper legen.</div>'}
        <div class="bsn"><div class="t">Wechsel der Diashow</div><div class="st"><div class="hk" data-act="bg:dia:-5">−</div><b>${g.diashow_min} min</b><div class="hk" data-act="bg:dia:5">+</div></div></div>
        <input type="file" id="bg-file" accept="image/*" multiple hidden>`);
      if (!this._bgImsLoading && (!this._bgIms || this._bgImsFresh)) this._loadBgIms();
    }
    if (sel === 'himmel' || sel === 'beides') mid.push('<div class="lhint">Sonne und Mond laufen über die ganze Breite: links Aufgang, oben in der Mitte der höchste Stand des Tages, rechts Untergang – nach ihrem echten Stand und der echten Mondphase.</div>');
    if (sel !== 'aurora' && sel !== 'beides') mid.push(`<div class="bsl">Abdunkeln</div><div class="bsrg"><input type="range" id="bg-dk" min="0" max="90" step="5" value="${g.abdunkeln}"><b id="bg-dkv">${g.abdunkeln} %</b></div>`);
    if (sel === 'aurora') mid.push('<div class="lhint">Die Aurora wechselt ihre Farben mit dem Sonnenstand (Nacht, Dämmerung, Tag).</div>');
    const gb = g.glas_blur ?? 10, gd = g.glas_deckkraft ?? 50;
    mid.push(`<div class="bsl">Glasrahmen</div><div class="bsrg"><span class="lhint" style="grid-column:1/-1;margin:0">Unschärfe – wenig = Sonne, Mond und Sterne klar durch das Glas</span><input type="range" id="bg-gb" min="0" max="30" step="1" value="${gb}"><b id="bg-gbv">${gb} px</b>
      <span class="lhint" style="grid-column:1/-1;margin:0">Deckkraft – wenig = durchsichtiger</span><input type="range" id="bg-gd" min="5" max="95" step="5" value="${gd}"><b id="bg-gdv">${gd} %</b></div>`);
    const nOn = g.nacht_an !== false, nv = g.nacht_von || '22:00', nb = g.nacht_bis || '06:30', nh = g.nacht_hell ?? 45;
    mid.push(`<div class="bsl" style="margin-top:14px">Uhr</div><div class="bsn"><div class="t">Unbeleuchtete LEDs (88:88)</div><div class="bsseg" style="flex:none;width:170px"><span class="${g.led_geist !== false ? 'on' : ''}" data-act="bg:lg:1">An</span><span class="${g.led_geist === false ? 'on' : ''}" data-act="bg:lg:0">Aus</span></div></div>`);
    mid.push(`<div class="bsl" style="margin-top:14px">Uhr nachts dimmen</div><div class="bsseg"><span class="${nOn ? 'on' : ''}" data-act="bg:nacht:1">An</span><span class="${nOn ? '' : 'on'}" data-act="bg:nacht:0">Aus</span></div>
      ${nOn ? [['nv', 'Gedimmt ab', nv], ['nb', 'Gedimmt bis', nb]].map(([k, t, v]) => `<div class="bsn"><div class="t">${t}</div><div class="st"><div class="hk" data-act="bg:${k}:-15">−</div><b>${v} Uhr</b><div class="hk" data-act="bg:${k}:15">+</div></div></div>`).join('')
        + `<div class="bsn"><div class="t">Helligkeit gedimmt</div><div class="st"><div class="hk" data-act="bg:nh:-5">−</div><b>${nh} %</b><div class="hk" data-act="bg:nh:5">+</div></div></div>` : '<div class="lhint">Die Uhr leuchtet rund um die Uhr gleich hell.</div>'}`);
    const pa = g.perf_aurora !== false, pb = g.perf_blur !== false, pv = g.perf_vorab !== false, at = Number(g.aurora_tempo) || 1;
    const AT = [[.5, 'schnell'], [1, 'normal'], [2, 'langsam'], [4, 'sehr langsam']], atn = (AT.find(x => x[0] === at) || [at, '×' + at])[1];
    const pm = pa && pb && pv ? 'optik' : !pa && !pb && !pv ? 'leistung' : 'eigen';
    const sw = (k, v) => `<div class="bsseg" style="flex:none;width:170px"><span class="${v ? 'on' : ''}" data-act="bg:${k}:1">An</span><span class="${v ? '' : 'on'}" data-act="bg:${k}:0">Aus</span></div>`;
    mid.push(`<div class="bsl" style="margin-top:14px">Leistung</div><div class="bsseg"><span class="${pm === 'optik' ? 'on' : ''}" data-act="bg:perf:optik">Optik</span><span class="${pm === 'leistung' ? 'on' : ''}" data-act="bg:perf:leistung">Leistung</span><span class="${pm === 'eigen' ? 'on' : ''}" style="pointer-events:none">Eigene</span></div>
      <div class="bsn"><div class="t">Aurora bewegt</div>${sw('pa', pa)}</div>
      <div class="bsn"><div class="t">Rahmen-Weichzeichner</div>${sw('pb', pb)}</div>
      <div class="bsn"><div class="t">Vollbild vorbereiten</div>${sw('pv', pv)}</div>
      <div class="bsn"><div class="t">Leistungsanzeige</div>${sw('pz', g.perf_anzeige === true)}</div>
      ${pa ? `<div class="bsn"><div class="t">Aurora-Tempo</div><div class="st"><div class="hk" data-act="bg:at:-1">−</div><b>${atn}</b><div class="hk" data-act="bg:at:1">+</div></div></div>` : ''}
      <div class="lhint">„Leistung“ schaltet die drei Effekte aus, danach lässt sich jeder einzeln wieder einschalten. Das Aurora-Tempo ist Geschmack – Rechenleistung spart nur „Aurora bewegt: Aus“.</div>`);
    this._html(this.$('bs-mid'), mid.join(''));
    // rechts: was gerade am Himmel steht
    const hc = this._hass.config || {}, A = AST(new Date(), hc.latitude ?? 51, hc.longitude ?? 10), m = A.moon, k = m.frac, R = 46, rx = (R * Math.abs(1 - 2 * k)).toFixed(2);
    const lit = k < .005 ? '' : `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx} ${R} 0 0 ${k < .5 ? 0 : 1} 0 ${-R}Z`;
    const pos = o => o.el > 0 ? `${de(o.el, 0)}° über dem Horizont, ${dirName(o.az)}` : `unter dem Horizont (${dirName(o.az)})`;
    const sf = g.schrift || 'standard';
    this._html(this.$('bs-right'), `<div class="bsl">Schrift</div><div class="bsart" style="margin-bottom:16px;min-width:0">${[['standard', 'Standard', 'Rajdhani + Share Tech Mono', "font-family:Rajdhani,sans-serif;font-weight:700"], ['charlie', 'Charlie Dotted', 'LED-Punktschrift – große Anzeigen aus Leuchtpunkten', "font-family:'RP Charlie Punkte',monospace;font-size:22px;letter-spacing:1px"]].map(([k, t, d, fs]) => `<div class="hsr${on(sf === k)}" data-act="bg:schrift:${k}"><div class="t" style="${fs}">${t}</div><small style="white-space:normal">${d}</small></div>`).join('')}</div>
      <div class="bsl">Jetzt am Himmel</div>
      <div class="bsmoon"><svg viewBox="-50 -50 100 100"><circle r="46" fill="#1b1f27"/><path d="${lit}" fill="#f1ede2" transform="rotate(${m.phase < .5 ? 0 : 180})"/></svg>
        <div><b style="font-size:17px;color:#e8e9ec">${moonName(m.phase)}</b><div class="lhint">${Math.round(k * 100)} % beleuchtet<br>Mond ${pos(m)}<br>Sonne ${pos(A.sun)}</div></div></div>
      <div class="lhint" style="margin-top:8px">Die Einstellung gilt für das Tablet der gewählten Bettseite und wird in MariaDB gespeichert.</div>`);
    if (!this._bgEv) {
      this._bgEv = true;
      const R0 = this.shadowRoot;
      R0.addEventListener('input', e => { const u = { 'bg-dk': ['bg-dkv', ' %'], 'bg-gb': ['bg-gbv', ' px'], 'bg-gd': ['bg-gdv', ' %'] }[e.target.id]; if (u) { const v = this.$(u[0]); if (v) v.textContent = e.target.value + u[1]; } });
      R0.addEventListener('change', e => {
        if (e.target.id === 'bg-dk') this._saveBg({ abdunkeln: Number(e.target.value) });
        if (e.target.id === 'bg-gb') this._saveBg({ glas_blur: Number(e.target.value) });
        if (e.target.id === 'bg-gd') this._saveBg({ glas_deckkraft: Number(e.target.value) });
        if (e.target.id === 'bg-col') this._saveBg({ farbe: e.target.value });
        if (e.target.id === 'bg-file') this._uploadBg(e.target.files);
      });
    }
  }
  _paintAllg(msg) {
    const g = this._bg(), s = this._side(), sel = this._sel && AKKU_F[this._sel] ? this._sel : 'akku_level';
    const rows = Object.entries(AKKU_F).map(([k, [t]]) => { const id = g[k] || ''; return `<div class="hsr${k === sel ? ' on' : ''}" data-act="sel:${k}"><div class="t">${t}<i>${escH(this._eval(id))}</i></div><b>${id ? escH(this._ename(id)) : '– automatisch –'}</b></div>`; }).join('');
    this._html(this.$('bs-left'), `<div class="bsl">Tablet-Akku · Bettseite ${s === 'links' ? 'Links' : 'Rechts'}</div>${rows}
      <div class="lhint">Leer = automatisch (Browser Mod dieses Tablets bzw. <code>battery:</code> im Dashboard).</div>
      <div class="bsl" style="margin-top:4px">Batterie-Meldungen auf diesem Tablet</div><div class="bsseg"><span class="${g.batterie_meldungen !== false ? 'on' : ''}" data-act="bg:bat:1">Anzeigen</span><span class="${g.batterie_meldungen === false ? 'on' : ''}" data-act="bg:bat:0">Ausblenden</span></div>
      <div class="lhint">Hinweise des Batterie-Managers (z. B. „Batterie fast leer“) erscheinen dann nicht mehr auf dem Bett-Tablet – Handy, E-Mail und die HA-Glocke bleiben.</div>${msg}`);
    const lv = g.akku_level && this._st(g.akku_level), stE = g.akku_status && this._st(g.akku_status);
    this._html(this.$('bs-mid'), `<div class="bsl">Akku jetzt · Bettseite ${s === 'links' ? 'Links' : 'Rechts'}</div>
      <div class="bsn"><div class="t">Akkustand</div><b class="bsv">${lv && this._ok(lv) ? escH(lv.state) + ' %' : '--'}</b></div>
      <div class="bsn"><div class="t">Ladezustand</div><b class="bsv">${stE ? escH(AKKU_TXT[String(stE.state).toLowerCase()] || stE.state) : '--'}</b></div>
      ${g.akku_lader && this._st(g.akku_lader) ? `<div class="bsn"><div class="t">Ladegerät</div><b class="bsv">${escH(AKKU_TXT[String(this._st(g.akku_lader).state).toLowerCase()] || this._st(g.akku_lader).state)}</b></div>` : ''}
      <div class="lhint">Hintergrund und Schrift: Reiter „Erscheinungsbild“. Alle Einstellungen gelten für das Tablet der gewählten Bettseite und werden in MariaDB gespeichert.</div>`);
    if (!this.$('bs-q')) { this._html(this.$('bs-right'), `<div class="cap eng" id="bs-head"></div><input class="hsq" id="bs-q" placeholder="Suchen …" autocomplete="off"><div class="hsl" id="bs-l"></div>`); this.bind(); }
    this._sel = sel; this._list();
  }
  _saveBg(patch) { return this._save({ hintergrund: { [this._side()]: patch } }); }
  async _loadBgIms() {
    this._bgImsLoading = true; this._bgImsFresh = false;
    try {
      const r = await this._hass.callWS({ type: 'media_source/browse_media', media_content_id: 'media-source://media_source/local/wallpaper' });
      const list = (r.children || []).filter(x => x.media_class === 'image' || /\.(jpe?g|png|webp|gif|avif)$/i.test(x.media_content_id)).map(x => ({ id: x.media_content_id, title: x.title, url: null }));
      this._bgIms = list; this._paint();
      for (const m of list) { try { m.url = (await this._hass.callWS({ type: 'media_source/resolve_media', media_content_id: m.id })).url; } catch (e) { /* Vorschau fehlt */ } }
    } catch (e) { this._bgIms = []; this._msg('Ordner media/wallpaper nicht lesbar: ' + ((e && e.message) || e), false); }
    this._bgImsLoading = false; this._paint();
  }
  // Hochladen über die Medien-Upload-Funktion von Home Assistant (nur Admin)
  async _uploadBg(files) {
    if (!files || !files.length) return;
    if (!this._admin()) return this._msg('Hochladen nur mit Administrator-Konto', false);
    let n = 0;
    for (const f of files) {
      const fd = new FormData(); fd.append('media_content_id', 'media-source://media_source/local/wallpaper'); fd.append('file', f);
      try { const res = await this._hass.fetchWithAuth('/api/media_source/local_source/upload', { method: 'POST', body: fd }); if (!res.ok) throw new Error('HTTP ' + res.status); n++; } catch (e) { this._msg(`${f.name}: ${(e && e.message) || e}`, false); }
    }
    if (n) this._msg(`${n} Bild${n > 1 ? 'er' : ''} hochgeladen`);
    this._bgImsFresh = true; this._loadBgIms();
  }
  _paintWecker(msg) {
    const se = WK.snap.seiten || {}, s = this._side(), x = se[s] || {};
    if (!/^(player|au\.|vb\.)/.test(this._sel || '')) this._sel = 'player';
    const au = (WK.snap.ausgabe || {})[s] || {}, vb = (WK.snap.vibration || {})[s] || {};
    const pick = (k, t, id, hint) => `<div class="hsr${this._sel === k ? ' on' : ''}" data-act="sel:${k}"><div class="t">${t}<i>${escH(this._eval(id))}</i></div><b>${id ? escH(this._ename(id)) : '– keiner –'}</b><small>${id ? escH(id) : hint}</small></div>`;
    const qst = au.quelle && this._hass.states[au.quelle], qopts = (qst && qst.attributes.options) || [];
    // Wecker-Liste der gewählten Seite: rp-wecker ohne eigenes Klingel-Fenster und ohne Ton (das macht das Panel)
    const box = this.$('bs-wk');
    if (box && !this._wkEl) {
      const el = document.createElement('rp-wecker'); el.dataset.inpanel = '1';
      el.setConfig({ seite: this._c.seite, popup: false, ton: false, padding: 4 });
      el.style.cssText = 'display:block;width:100%;height:100%';
      box.appendChild(el); this._wkEl = el; if (this._hass) el.hass = this._hass;
    }
    if (this._wkEl && this._wkEl._vside !== s) { this._wkEl._vside = s; this._wkEl._wkList(); }
    this._html(this.$('bs-mid'), `<div class="bsl">Ausgabe des Wecktons · Bettseite ${escH(x.name || s)}</div>
      <div class="bsn"><div class="t">Ton auf dem Tablet</div><div class="wksw${x.browser !== false ? ' on' : ''}" data-act="br:${s}" style="--acc:var(--tc);--accg:rgba(255,179,71,.5)"></div></div>
      <div class="hsr on" data-act="sel:player"><div class="t">Lautsprecher<i>${escH(this._eval(x.player))}</i></div><b>${x.player ? escH(this._ename(x.player)) : '– keiner –'}</b><small>${x.player ? escH(x.player) : 'zusätzlich ein media_player (z. B. Bett-Lautsprecher, Z906)'}</small></div>
      <div class="bsl" style="margin-top:12px">Soundsystem beim Wecken</div>
      ${pick('au.laut', 'Lautstärke-Regler', au.laut, 'number, z. B. Z906 Main – folgt der Wecker-Lautstärke')}
      ${pick('au.ein', 'Einschalten', au.ein, 'switch, z. B. Z906 Power')}
      ${pick('au.quelle', 'Quelle', au.quelle, 'select, z. B. Z906 Eingang')}
      ${au.quelle && qopts.length ? `<div class="bsseg" style="flex-wrap:wrap;row-gap:6px">${qopts.map(o => `<span class="${au.quelle_opt === o ? 'on' : ''}" data-act="qo:${escH(o)}">${escH(o)}</span>`).join('')}</div>` : ''}
      ${WK_EQ.map(([k, l]) => pick('au.eq.' + k, 'Klang · ' + l, (au.eq || {})[k], 'number, z. B. Z906 Sub für Bass')).join('')}
      <div class="bsn"><div class="t">Nach dem Wecken alte Werte zurück</div><div class="wksw${au.zurueck !== false ? ' on' : ''}" data-act="auz" style="--acc:var(--tc);--accg:rgba(255,179,71,.5)"></div></div>
      <div class="bsl" style="margin-top:12px">Vibration (ESP32 „Bett Vibration“)</div>
      ${pick('vb.schalter', 'Ein/Aus', vb.schalter, 'switch …_vibration')}
      ${pick('vb.staerke', 'Stärke', vb.staerke, 'number …_starke')}
      ${pick('vb.muster', 'Muster', vb.muster, 'select …_muster')}
      <div class="bsn"><div class="t">Vibration 5 s testen<br><span class="bsv">Muster Puls · 70 %</span></div><div class="hk" data-act="vt"><i></i>Testen</div></div>
      <div class="lhint">Links die Wecker dieser Bettseite – Tippen öffnet einen Wecker, ＋ legt einen neuen an. Lautstärke, Klang und Vibration stellst du je Wecker ein. Die Auswahl der Bettseite oben gilt auch für Bettgewichtung und Betttemperatur.</div>${msg}`);
    if (!this.$('bs-q')) { this._html(this.$('bs-right'), `<div class="cap eng" id="bs-head"></div><input class="hsq" id="bs-q" placeholder="Suchen …" autocomplete="off"><div class="hsl" id="bs-l"></div>`); this.bind(); }
    this._list();
  }
  async act(cmd, arg) {
    const a = this._c.area, c = this._bc();
    if (cmd === 'side') { BS_SIDE.set(arg); return; }
    if (cmd === 'bg') {
      const [k, v] = arg.split(/:(.*)/s), g = this._bg();
      if (k === 'art') { if (v === 'bild') this._bgImsFresh = true; return this._saveBg({ art: v }); }
      if (k === 'farbe') return this._saveBg({ farbe: v });
      if (k === 'bat') return this._saveBg({ batterie_meldungen: v === '1' });
      if (k === 'lg') return this._saveBg({ led_geist: v === '1' });
      if (k === 'perf') { const on = v === 'optik'; return this._saveBg({ perf_aurora: on, perf_blur: on, perf_vorab: on }); }
      if (k === 'pa' || k === 'pb' || k === 'pv' || k === 'pz') return this._saveBg({ [{ pa: 'perf_aurora', pb: 'perf_blur', pv: 'perf_vorab', pz: 'perf_anzeige' }[k]]: v === '1' });
      if (k === 'at') { const L = [.5, 1, 2, 4], i = clamp(L.indexOf(Number(g.aurora_tempo) || 1) + Number(v), 0, L.length - 1); return this._saveBg({ aurora_tempo: L[i] }); }
      if (k === 'schrift') return this._saveBg({ schrift: v });
      if (k === 'nacht') return this._saveBg({ nacht_an: v === '1', nacht_von: g.nacht_von || '22:00', nacht_bis: g.nacht_bis || '06:30', nacht_hell: g.nacht_hell ?? 45 });
      if (k === 'nv' || k === 'nb') {
        const key = k === 'nv' ? 'nacht_von' : 'nacht_bis', [hh, mm] = String(g[key] || (k === 'nv' ? '22:00' : '06:30')).split(':').map(Number), t = ((hh * 60 + mm + Number(v)) % 1440 + 1440) % 1440;
        return this._saveBg({ nacht_an: true, [key]: String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0') });
      }
      if (k === 'nh') return this._saveBg({ nacht_an: true, nacht_hell: clamp((g.nacht_hell ?? 45) + Number(v), 5, 100) });
      if (k === 'bild') return this._saveBg({ bild: v });
      if (k === 'blick') return this._saveBg({ blick: Number(v) });
      if (k === 'dia') return this._saveBg({ diashow_min: clamp((g.diashow_min || 10) + Number(v), 1, 240) });
      if (k === 'up') { const f = this.$('bg-file'); if (f) f.click(); return; }
      if (k === 'del') {
        if (!this._admin()) return this._msg('Löschen nur mit Administrator-Konto', false);
        if (this._bgDel !== v) { this._bgDel = v; return this._msg('Zum Löschen nochmals auf × tippen', false); }
        this._bgDel = null;
        try { await this._hass.callWS({ type: 'media_source/local_source/remove', media_content_id: v }); if (g.bild === v) await this._saveBg({ bild: '' }); this._msg('Bild gelöscht'); } catch (e) { this._msg('Fehler: ' + ((e && e.message) || e), false); }
        this._bgImsFresh = true; return this._loadBgIms();
      }
      return;
    }
    if (cmd === 'sel') { this._sel = arg; this._f = ''; const q = this.$('bs-q'); if (q) q.value = ''; this._paint(); return; }
    if (cmd === 'ws') { this._wsSide = arg; this._paint(); return; }
    if (cmd === 'tz') return this._save({ uhr: { zeitzone: arg } });
    if (cmd === 'qo') return this._save({ ausgabe: { [this._side()]: { quelle_opt: arg } } });
    if (cmd === 'auz') { const au = (WK.snap.ausgabe || {})[this._side()] || {}; return this._save({ ausgabe: { [this._side()]: { zurueck: au.zurueck === false } } }); }
    if (cmd === 'vt') { try { await this._hass.callWS({ type: 'wecker/vib_test', seite: this._side(), muster: 'puls', staerke: 70, dauer_s: 5 }); this._msg('Vibration läuft 5 Sekunden …'); } catch (e) { this._msg('Fehler: ' + ((e && (e.message || e.code)) || e), false); } return; }
    if (cmd === 'br') { const se = JSON.parse(JSON.stringify(WK.snap.seiten || {})); se[arg].browser = se[arg].browser === false; return this._save({ seiten: se }); }
    if (cmd === 'tara') { if (!this._admin()) return this._msg('Nur mit Administrator-Konto', false); try { const r = await this._hass.callWS({ type: 'wecker/bett/tara', seite: this._side() }); this._msg(`Leergewicht ${de(r.result, 1)} kg gespeichert`); } catch (e) { this._msg('Fehler: ' + ((e && e.message) || e), false); } return; }
    if (cmd === 'num') { const [k, st] = arg.split(':'), d = BSET_NUM[a].find(x => x[0] === k); const v = clamp(Math.round(((Number(c[k]) || 0) + Number(st)) * 10) / 10, d[4], d[5]); return this._save({ bett: { [k]: v } }); }
    if (cmd === 'set') {
      if (a === 'allgemein') return this._saveBg({ [this._sel || 'akku_level']: arg });
      if (a === 'wecker') {
        const s = this._side(), sel = this._sel || 'player';
        if (sel.startsWith('au.eq.')) return this._save({ ausgabe: { [s]: { eq: { [sel.slice(6)]: arg } } } });
        if (sel.startsWith('au.')) return this._save({ ausgabe: { [s]: { [sel.slice(3)]: arg, ...(sel === 'au.quelle' ? { quelle_opt: '' } : {}) } } });
        if (sel.startsWith('vb.')) return this._save({ vibration: { [s]: { [sel.slice(3)]: arg } } });
        const se = JSON.parse(JSON.stringify(WK.snap.seiten || {})); se[s].player = arg; return this._save({ seiten: se });
      }
      const sel = this._sel || BSET_FIELDS[a][0][0], p = { [this._side()]: {} };
      if (sel.startsWith('zellen.')) p[this._side()].zellen = { [sel.slice(7)]: arg }; else p[this._side()][sel] = arg;
      return this._save({ bett: p });
    }
  }
}

// Tablet-Akku in Bett-Einstellungen → Allgemein: [Titel]
const AKKU_F = { akku_level: ['Akkustand (%)'], akku_status: ['Ladezustand'], akku_lader: ['Ladegerät (optional)'] };
const AKKU_TXT = { charging: 'lädt', discharging: 'entlädt', not_charging: 'lädt nicht', full: 'voll', on: 'lädt / am Netz', off: 'nicht am Netz', ac: 'Netzteil', usb: 'USB', wireless: 'induktiv', none: 'kein Ladegerät' };

// ---------------------------------------------------------------- Brücke: fremde Karten mit Bausteinen
// Eine eigenständige Karte (z. B. flur-wetter-card) kann im Panel wie ein eigenes Modul frei angeordnet werden
// (✥ Anordnen, Vollbild-Anordnen, layout: custom + grid + elements unter dem  type: card).
// Die Karte meldet dafür ihre Bausteine an und kann einzelne davon allein zeigen:
//   static get rpTeile() { return { jetzt: { art: 'fill', h: 120 }, hinweise: { h: 60 }, … } }
//       art = fill (Karte füllt die Zelle, Standard) | fit (gleichmäßig einpassen) | shrink (Originalgröße, nur verkleinern)
//       h   = Höhe in Design-px für die Start-Anordnung (Bausteine untereinander)
//   static get rpDesign() { return { breite: 340, hoehe: 300 } }         (optional: Design-Fläche des Moduls)
//   static get rpHintergrund() { return true }                           (optional: Instanz mit teil: '_hintergrund' hinter dem Raster)
//   static get rpStart() { return { grid: {…}, elements: {…} } }         (optional: eigene Start-Anordnung)
//   setConfig({ …, teil: 'jetzt' })  → Karte zeigt nur diesen Baustein, randlos und füllend
// Ohne layout: custom zeigt das Modul die ganze Karte wie bisher (füllt den Platz, keine Skalierung durch das Panel).
const extTag = m => { const t = m && m.card && m.card.type; return typeof t === 'string' && t.startsWith('custom:') ? t.slice(7) : null; };
const extOk = tag => { const K = tag && customElements.get(tag); return !!(K && K.rpTeile); };
class RPExtCard extends RPModule {
  static get CSS() { return `.xfull,.xt,.xbg{width:100%;height:100%}.xfull>*,.xt>*,.xbg>*{display:block;width:100%;height:100%}
    .box.v-voll{transform:none!important;padding:0!important;width:100%!important;height:100%!important}
    .xbg{position:absolute;inset:0;z-index:0;pointer-events:none}.cgrid{position:relative;z-index:1}`; }
  get _ext() { return true; }
  get _K() { return customElements.get(this._tag) || {}; }
  _teile() { return this._K.rpTeile || {}; }
  partNames() { return Object.keys(this._teile()); }
  setConfig(cfg) {
    this._tag = extTag(cfg);
    const T = this._teile();
    this._kinds = Object.fromEntries(Object.entries(T).map(([n, t]) => [n, (t && t.art) || 'fill']));
    super.setConfig(cfg);
  }
  variants() { const D = this._K.rpDesign || {}; return { voll: { bw: Number(D.breite) || 360, mh: Number(D.hoehe) || 300, fw: true, fh: true } }; }
  html(vn) {
    if (vn !== 'custom') return '<div class="xfull" data-teil=""></div>';
    const names = [...new Set([...this.partNames(), ...Object.keys(this._raw.elements || {}).filter(n => !n.includes('.'))])];
    return this._cgrid(Object.fromEntries(names.map(n => [n, this.P(n, `<div class="xt" data-teil="${n}"></div>`)])));
  }
  // je Platzhalter eine eigene Instanz der Karte (Baustein allein bzw. ganze Karte)
  bind() {
    this._inst = [];
    const box = this.$('box'); if (!box || !this._tag) return;
    // Hintergrund-Ebene außerhalb der skalierten, gepolsterten Box: füllt das ganze Modul bis an den Rand
    const sr = this.shadowRoot;
    [...sr.children].filter(x => x.classList.contains('xbg')).forEach(x => x.remove());
    const slots = [...box.querySelectorAll('[data-teil]')];
    if (this._v === 'custom' && this._K.rpHintergrund) {
      const bg = document.createElement('div'); bg.className = 'xbg'; bg.dataset.teil = '_hintergrund';
      sr.insertBefore(bg, box); slots.unshift(bg);
    }
    slots.forEach(slot => {
      const n = slot.dataset.teil, cell = slot.closest('.cell');
      if (cell && cell.style.display === 'none') return;
      try {
        const el = document.createElement(this._tag), c = Object.assign({}, this._raw.card || {});
        if (n) c.teil = n;
        el.setConfig(c);
        if (this._hass) el.hass = this._hass;
        slot.appendChild(el); this._inst.push(el);
      } catch (e) { slot.innerHTML = `<div class="xerr">${String(e.message || e)}</div>`; }
    });
  }
  set hass(h) {
    this._hass = h;
    for (const el of this._inst || []) el.hass = h;
    if (this._built && !this._measured) { this._measured = true; requestAnimationFrame(() => this._fit()); }
  }
  get hass() { return this._hass; }
  _fit() {
    if (this._v === 'voll') { const box = this.$ && this.$('box'); if (box) box.style.transform = ''; return; }
    super._fit();
  }
  // Startpunkt für „✥ Anordnen“: eigene Vorgabe der Karte, sonst Bausteine untereinander über die ganze Breite
  _toElements(cols = 12, rowH = 20, gap = 6) {
    const S = this._K.rpStart;
    if (S && S.elements) return { grid: Object.assign({ columns: cols, row_height: rowH, gap, width: this.variants().voll.bw }, S.grid), elements: JSON.parse(JSON.stringify(S.elements)) };
    const els = {}; let row = 1;
    for (const [n, t] of Object.entries(this._teile())) {
      const h = Math.max(1, Math.round(((Number(t && t.h) || 80) + gap) / (rowH + gap)));
      els[n] = { col: 1, row, w: cols, h }; row += h;
    }
    return { grid: { columns: cols, row_height: rowH, gap, width: this.variants().voll.bw }, elements: els };
  }
}

// Batterie-Manager-Meldungen (browser_mod.notification) auf Bett-Tablets ausblenden, wenn in den Einstellungen abgeschaltet.
// Fängt das Ereignis in der Capture-Phase ab, bevor HA den Hinweis zeigt – nur solange ein solches Panel angezeigt wird.
const RP_PANELS = new Set();
const BATT_MSG = /Batterie|Batterien/;
window.addEventListener('hass-notification', e => {
  const msg = String((e.detail && e.detail.message) || '');
  if (!BATT_MSG.test(msg)) return;
  for (const pn of RP_PANELS) if (pn.isConnected && pn._c && pn._bgSide() && pn._bgCfg().batterie_meldungen === false) { e.stopImmediatePropagation(); return; }
}, true);

const DEFS = [['rp-lichter', RPLichter, 'Lichter'], ['rp-light', RPLight, 'Licht'], ['rp-heating', RPHeating, 'Heizung'], ['rp-weather', RPWeather, 'Wetter'], ['rp-air', RPAir, 'Raumklima'],
  ['rp-floorplan', RPFloorplan, 'Grundriss'], ['rp-audio', RPAudio, 'Audio'], ['rp-audio-settings', RPAudioSettings, 'Audio-Einstellungen'], ['rp-door-settings', RPDoorSettings, 'Türklingel-Einstellungen'], ['rp-light-settings', RPLightSettings, 'Licht-Einstellungen'], ['rp-house-settings', RPHouseSettings, 'Haus-Einstellungen'], ['rp-heating-settings', RPHeatingSettings, 'Heizungs-Einstellungen'], ['rp-vent-settings', RPVentSettings, 'Lüftungs-Einstellungen'], ['rp-statusbar', RPStatusbar, 'Statusleiste'], ['rp-uhr', RPUhr, 'Uhr'], ['rp-wecker', RPWecker, 'Wecker'], ['rp-kodi', RPKodi, 'Kodi-Fernbedienung'], ['rp-bett', RPBett, 'Bett'], ['rp-bett-settings', RPBettSettings, 'Bett-Einstellungen'], ['rp-bett-audio', RPBettAudio, 'Bett-Sound'], ['rp-extcard', RPExtCard, 'Fremde Karte (Bausteine)'], ['raum-panel', RaumPanel, 'Raum-Panel']];
window.customCards = window.customCards || [];
for (const [tag, cls, name] of DEFS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  window.customCards.push({ type: tag, name: tag === 'raum-panel' ? 'Raum-Panel (v2)' : `Raum-Panel Modul: ${name}`, description: tag === 'raum-panel' ? 'Wandtablet-Dashboard im Block-Raster mit Glasrahmen und Modulen' : `Eigenständiges Modul „${name}“ für das Raum-Panel` });
}
console.info(`%c RAUM-PANEL %c ${RP_VERSION} `, 'background:#4dc3ff;color:#000;font-weight:700', 'background:#222;color:#4dc3ff');
