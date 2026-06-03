// Jadwal Allowance — Logic v3 (Leaflet + OSRM, no token needed)

// ── CONFIG ──────────────────────────────────────────────────────────────────
const THRESHOLD_KM = 40;
const SPECIAL_ACTIVITIES = [
  { value: "QFL", label: "🚌 QFL" },
  { value: "FNC", label: "📖 FNC" },
];
const STORAGE_KEY = 'allowanceData_v1';
const OSRM_BASE   = 'https://router.project-osrm.org/route/v1/driving';
const monthNames  = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];

// ── STATE ────────────────────────────────────────────────────────────────────
let rows = [], homeLoc = null, curRow = null, curType = null;
let leafMap = null, leafMarker = null;
let selCoords = null, selName = null, selSub = null;
const distCache = {};

// ── UTILS ────────────────────────────────────────────────────────────────────
function sanitizeHTML(s) {
  if (typeof s !== 'string') return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function setLoading(show, msg) {
  const el = document.getElementById('loadingOverlay');
  if (!el) return;
  el.classList.toggle('show', show);
  if (msg) {
    const m = document.getElementById('loadingMsg');
    if (m) m.textContent = msg;
  }
}

// ── DISTANCE ─────────────────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, r = x => x * Math.PI / 180;
  const a = Math.sin(r(lat2-lat1)/2)**2 +
            Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2-lon1)/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function indiaFactor(osrmKm, straightKm) {
  const t = straightKm > 0 ? osrmKm / straightKm : 1;
  if (t > 1.35)  return 1.08;
  if (osrmKm < 30)  return 1.15;
  if (osrmKm < 100) return 1.22;
  if (osrmKm < 300) return 1.28;
  return 1.20;
}

async function distanceViaOSRM(lat1, lon1, lat2, lon2) {
  const url = `${OSRM_BASE}/${lon1},${lat1};${lon2},${lat2}?overview=false`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error('OSRM ' + res.status);
  const data = await res.json();
  if (!data.routes?.length) throw new Error('no route');
  const osrmKm = data.routes[0].distance / 1000;
  const sl     = haversineKm(lat1, lon1, lat2, lon2);
  return Math.max(osrmKm * indiaFactor(osrmKm, sl), sl);
}

async function getRoadDistance(lat1, lon1, lat2, lon2) {
  if (!isValidCoord(lat1,lon1) || !isValidCoord(lat2,lon2)) return 0;
  const k = `${lat1.toFixed(3)},${lon1.toFixed(3)}-${lat2.toFixed(3)},${lon2.toFixed(3)}`;
  const k2= `${lat2.toFixed(3)},${lon2.toFixed(3)}-${lat1.toFixed(3)},${lon1.toFixed(3)}`;
  if (distCache[k])  return distCache[k];
  if (distCache[k2]) return distCache[k2];
  let d = 0;
  try {
    d = await distanceViaOSRM(lat1, lon1, lat2, lon2);
    updateEngineBadge('OSRM');
  } catch(e) {
    d = haversineKm(lat1, lon1, lat2, lon2) * 1.30;
    updateEngineBadge('HVS');
  }
  distCache[k] = d;
  return d;
}

function isValidCoord(lat, lon) {
  return typeof lat==='number' && typeof lon==='number' &&
         lat>=-90 && lat<=90 && lon>=-180 && lon<=180;
}

function updateEngineBadge(eng) {
  const badge = document.getElementById('engineBadge');
  const name  = document.getElementById('engineName');
  if (!badge || !name) return;
  if (eng === 'OSRM') {
    badge.className = 'engine-badge ors';
    name.textContent = 'OSRM + India Correction';
  } else {
    badge.className = 'engine-badge hvs';
    name.textContent = 'Haversine Estimate';
  }
}

// ── ELIGIBILITY ───────────────────────────────────────────────────────────────
async function checkLoc(loc) {
  if (!homeLoc || !loc) return { ok: false, dist: 0 };
  const d = await getRoadDistance(homeLoc.lat, homeLoc.lng, loc.lat, loc.lng);
  const sameSub = homeLoc.sub && loc.sub &&
                  homeLoc.sub.toLowerCase().trim() === loc.sub.toLowerCase().trim();
  return { ok: d > THRESHOLD_KM && !sameSub, dist: Math.round(d) };
}

// ── STORAGE ───────────────────────────────────────────────────────────────────
function saveDataLocally() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, homeLoc, ts: new Date().toISOString() }));
}

function loadDataLocally() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;
    const data = JSON.parse(saved);
    rows    = data.rows    || [];
    homeLoc = data.homeLoc || null;
    if (homeLoc) {
      const btn = document.getElementById('homeBtn');
      if (btn) {
        btn.innerHTML = `<i class="ti ti-map-pin"></i> ${sanitizeHTML(homeLoc.name)}`;
        btn.classList.add('set');
      }
    }
    return true;
  } catch(e) { return false; }
}

function clearAllData() {
  if (!confirm('Delete ALL data? Cannot undo!')) return;
  localStorage.removeItem(STORAGE_KEY);
  rows = []; homeLoc = null;
  const btn = document.getElementById('homeBtn');
  if (btn) { btn.innerHTML = '<i class="ti ti-map-pin"></i> Set Home Location'; btn.classList.remove('set'); }
  buildTableStructure();
}

// ── DROPDOWNS + TABLE ─────────────────────────────────────────────────────────
function initDropdowns() {
  const ms  = document.getElementById('monthSelect');
  const ys  = document.getElementById('yearSelect');
  if (!ms || !ys) return;
  const now = new Date();
  monthNames.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = m;
    if (i === now.getMonth()) o.selected = true;
    ms.appendChild(o);
  });
  const cy = now.getFullYear();
  for (let y = cy - 2; y <= cy + 2; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === cy) o.selected = true;
    ys.appendChild(o);
  }
  loadDataLocally();
  buildTableStructure();
}

function buildTableStructure() {
  const ms = document.getElementById('monthSelect');
  const ys = document.getElementById('yearSelect');
  if (!ms || !ys) return;
  const m  = parseInt(ms.value);
  const y  = parseInt(ys.value);
  const lp = new Date(y, m, 0).getDate();
  const dm = new Date(y, m+1, 0).getDate();
  const DATES = [lp];
  for (let d = 1; d <= dm; d++) DATES.push(d);
  // only rebuild if month changed
  if (!rows.length || rows[0].date !== lp) {
    rows = DATES.map((d, i) => ({
      date: d, isFirstRow: i===0, isLastRow: i===DATES.length-1,
      night: null, day: null, specialActivity: ""
    }));
  }
  buildTable();
}

async function buildTable() {
  const tb = document.getElementById('tbody');
  if (!tb) return;
  tb.innerHTML = '';
  let tot = 0;
  setLoading(true, 'Calculating distances...');
  const m = parseInt(document.getElementById('monthSelect').value);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tr  = document.createElement('tr');
    const hasSpecial = !!(row.specialActivity && row.specialActivity !== '');
    const dStat = await checkLoc(row.day);
    let eligible = false;

    if (!row.isFirstRow) {
      const pn = await checkLoc(rows[i-1].night);
      if (hasSpecial || (pn.ok && dStat.ok)) { eligible = true; tot++; }
    }

    // Day cell
    const dayCell = !row.isFirstRow
      ? `<span class="lpill ${row.day?'set':''} ${row.day?(dStat.ok||hasSpecial?'ok':'fail'):''}"
              onclick="openModal(${i},'day')">
           ${row.day ? sanitizeHTML(row.day.name) : 'Select Day Location'}
           ${row.day ? `<span class="dist-tag">${dStat.dist} km | ${dStat.ok?'✓ Eligible':hasSpecial?'✓ Special':'✗ Home Area'}</span>` : ''}
         </span>`
      : '<span style="color:#94a3b8;font-size:10px;">Prev Month</span>';

    // Night cell
    const nStat = await checkLoc(row.night);
    const nightCell = `<span class="lpill ${row.night?'set':''} ${row.night?(nStat.ok||hasSpecial?'ok':'fail'):''}"
            onclick="openModal(${i},'night')">
          ${row.night ? sanitizeHTML(row.night.name) : 'Select Night Location'}
          ${row.night ? `<span class="dist-tag">${nStat.dist} km | ${nStat.ok?'✓ Eligible':hasSpecial?'✓ Special':'✗ Home Area'}</span>` : ''}
        </span>`;

    // Special activity dropdown
    const opts = SPECIAL_ACTIVITIES.map(a =>
      `<option value="${a.value}" ${row.specialActivity===a.value?'selected':''}>${a.label}</option>`
    ).join('');

    // Status
    const statusCell = !row.isFirstRow
      ? (eligible ? '<span class="cyes">YES</span>' : '<span class="cno">NO</span>')
      : '-';

    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${dayCell}</td>
      <td>${nightCell}</td>
      <td>
        <select class="special-select ${hasSpecial?'special-set':''}" onchange="setSpecial(${i},this.value)">
          <option value="">-- None --</option>${opts}
        </select>
      </td>
      <td>${statusCell}</td>`;
    tb.appendChild(tr);
  }

  document.getElementById('totDays').textContent  = tot;
  document.getElementById('grandSub').textContent = `${tot} eligible days`;
  document.getElementById('grandVal').textContent = `${tot} Days`;
  setLoading(false);
}

function setSpecial(rowIdx, value) {
  rows[rowIdx].specialActivity = value;
  saveDataLocally();
  buildTable();
}

// ── MODAL + MAP (Leaflet) ─────────────────────────────────────────────────────
function openModal(rowIdx, type) {
  curRow = rowIdx; curType = type;
  const titles = { home:'Set Home Location', day:'Select Day Location', night:'Select Night Location' };
  document.getElementById('modalTitle').textContent = titles[type];
  document.getElementById('overlayWrap').classList.add('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('rlist').innerHTML   = '';
  document.getElementById('selLabel').textContent = 'Select a location...';
  selCoords = null; selName = null; selSub = null;

  setTimeout(() => {
    if (!leafMap) {
      leafMap = L.map('map').setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
      }).addTo(leafMap);
      leafMap.on('click', e => {
        const { lat, lng } = e.latlng;
        selCoords = { lat, lng };
        selName   = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        selSub    = '';
        document.getElementById('selLabel').textContent = selName;
        pinOnMap(lat, lng);
      });
    } else {
      leafMap.invalidateSize();
    }
  }, 150);
}

function closeModal() {
  document.getElementById('overlayWrap').classList.remove('open');
  selCoords = null; selName = null; selSub = null;
}

function pinOnMap(lat, lng) {
  if (leafMarker) leafMap.removeLayer(leafMarker);
  leafMarker = L.circleMarker([lat, lng], {
    radius: 8, color: '#cc0000', fillColor: '#cc0000', fillOpacity: 1
  }).addTo(leafMap);
  leafMap.flyTo([lat, lng], 13);
}

// ── SEARCH (Nominatim) ────────────────────────────────────────────────────────
async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q || q.length < 2) { alert('Please enter at least 2 characters'); return; }
  const rlist = document.getElementById('rlist');
  rlist.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;">Searching...</div>';
  try {
    const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=10&countrycodes=in&addressdetails=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    rlist.innerHTML = '';
    if (!data.length) {
      rlist.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">No results found.</div>';
      return;
    }
    data.forEach(item => {
      const sub = item.address?.suburb || item.address?.subdistrict ||
                  item.address?.county || item.address?.city_district || '';
      const div = document.createElement('div');
      div.className = 'ri';
      div.innerHTML = `<div class="rn">${sanitizeHTML(item.name || item.display_name.split(',')[0])}</div>
                       <div class="ra">${sanitizeHTML(item.display_name)}</div>`;
      div.onclick = () => {
        selCoords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
        selName   = item.name || item.display_name.split(',')[0];
        selSub    = sub;
        document.getElementById('selLabel').textContent =
          sanitizeHTML(selName) + (sub ? ` — ${sanitizeHTML(sub)}` : '');
        pinOnMap(selCoords.lat, selCoords.lng);
      };
      rlist.appendChild(div);
    });
  } catch(e) {
    rlist.innerHTML = '<div style="padding:16px;color:#991b1b;">Search failed. Please retry.</div>';
  }
}

function confirmLoc() {
  if (!selCoords || !selName) { alert('Please select a location first'); return; }
  if (curType === 'home') {
    homeLoc = { lat: selCoords.lat, lng: selCoords.lng, name: selName, sub: selSub };
    const btn = document.getElementById('homeBtn');
    btn.innerHTML = `<i class="ti ti-map-pin"></i> ${sanitizeHTML(selName)}`;
    btn.classList.add('set');
  } else if (curRow !== null) {
    rows[curRow][curType] = { lat: selCoords.lat, lng: selCoords.lng, name: selName, sub: selSub };
  }
  saveDataLocally();
  closeModal();
  buildTable();
}

// ── PDF + EMAIL ───────────────────────────────────────────────────────────────
async function sendViaEmail() {
  const recipient = document.getElementById('recipientEmail').value.trim();
  if (!recipient) { alert('Please enter recipient email address'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { alert('Invalid email address'); return; }

  const m         = parseInt(document.getElementById('monthSelect').value);
  const y         = parseInt(document.getElementById('yearSelect').value);
  const tot       = parseInt(document.getElementById('totDays').textContent) || 0;
  const monthName = monthNames[m];
  const homeStr   = homeLoc ? homeLoc.name : 'Not set';
  const fileName  = `Allowance_${monthName}_${y}.pdf`;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    doc.setFillColor(30,41,59); doc.rect(0,0,210,22,'F');
    doc.setTextColor(255,232,0); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Jadwal Allowance Report', 14, 14);
    doc.setTextColor(148,163,184); doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`${monthName} ${y}`, 150, 14);
    doc.setFillColor(248,250,252); doc.setDrawColor(226,232,240);
    doc.roundedRect(14,28,182,24,2,2,'FD');
    doc.setTextColor(71,85,105); doc.setFontSize(9);
    doc.text(`Home: ${homeStr}`, 20, 37);
    doc.text(`Eligible Days: ${tot}`, 20, 44);
    doc.setTextColor(204,0,0); doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text(`${tot} Days`, 160, 44);

    const tableRows = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.isFirstRow) continue;
      const hasSpecial = !!(r.specialActivity && r.specialActivity !== '');
      const dOk = r.day   ? (await checkLoc(r.day)).ok   : false;
      const pOk = rows[i-1]?.night ? (await checkLoc(rows[i-1].night)).ok : false;
      tableRows.push([
        `${r.date} ${monthName.slice(0,3)}`,
        r.day   ? r.day.name   : '-',
        r.night ? r.night.name : '-',
        r.specialActivity || '-',
        (hasSpecial || (dOk && pOk)) ? 'YES' : 'NO'
      ]);
    }
    doc.autoTable({
      startY:58, head:[['Date','Day Loc','Night Loc','Special','Status']],
      body: tableRows, styles:{ fontSize:8, cellPadding:3 },
      headStyles:{ fillColor:[30,41,59], textColor:255, fontStyle:'bold' },
      alternateRowStyles:{ fillColor:[248,250,252] },
      columnStyles:{ 0:{cellWidth:20},1:{cellWidth:50},2:{cellWidth:50},3:{cellWidth:30},4:{cellWidth:22,halign:'center'} }
    });
    doc.setFontSize(7); doc.setTextColor(148,163,184); doc.setFont('helvetica','normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | All data on device only.`, 14, doc.lastAutoTable.finalY+8);
    doc.save(fileName);
  } catch(e) {
    alert('PDF error. Use Print/PDF button instead.');
  }

  const subject = encodeURIComponent(`Jadwal Allowance Report — ${monthName} ${y}`);
  const body    = encodeURIComponent(`Jadwal Allowance Report\nMonth: ${monthName} ${y}\nHome: ${homeStr}\nEligible Days: ${tot}\n\nPDF saved as: ${fileName}\nPlease attach and send.\n\nGenerated: ${new Date().toLocaleDateString('en-IN')}`);
  setTimeout(() => { window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`; }, 800);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDropdowns();
  const pn = document.getElementById('privacyNotice');
  if (pn) {
    if (localStorage.getItem('privacyNoticeSeen')) {
      pn.style.display = 'none';
    } else {
      setTimeout(() => {
        pn.style.opacity='0'; pn.style.maxHeight='0'; pn.style.padding='0';
        setTimeout(()=>{ pn.style.display='none'; }, 1000);
      }, 6000);
      localStorage.setItem('privacyNoticeSeen', '1');
    }
  }
});
