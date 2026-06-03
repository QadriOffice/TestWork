/* Jadwal App v2 | Build:20250603 | (c) All Rights Reserved
 * Proprietary & confidential. Protected under Indian Copyright Act 1957 & IT Act 2000.
 * Unauthorized copying or modification strictly prohibited.
 */
!function(w,d){
'use strict';
(function(){
  const p = ['pk','eyJ1IjoiamFkd2FsLWFwcCIsImEiOiJjbHh4eHh4eHgwMDAwMnF5eHh4eHh4eHgifQ','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'];
  window.__mbk = p.join('.');
})();

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

let _ce = 'OSRM';

function _ueb(eng) {
  _ce = eng;
  const badge = document.getElementById('engineBadge');
  const name  = document.getElementById('engineName');
  if (eng === 'OSRM') {
    badge.className = 'engine-badge ors';
    name.textContent = 'OSRM + India Correction';
  } else {
    badge.className = 'engine-badge hvs';
    name.textContent = 'Haversine Estimate';
  }
}

function _h(lat1,lon1,lat2,lon2) {
  const R=6371, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function _if2(osrmKm, straightKm) {
  
  const _tort = straightKm > 0 ? osrmKm / straightKm : 1;

  
  if (_tort > 1.35) return 1.08;

  
  if (osrmKm < 30)  return 1.15;  
  if (osrmKm < 100) return 1.22;  
  if (osrmKm < 300) return 1.28;  
  return 1.20;                     
}

async function _dvo(lat1,lon1,lat2,lon2) {
  const url = `${OSRM_BASE}/${lon1},${lat1};${lon2},${lat2}?overview=false`;
  const res  = await fetch(url, { headers:{ Accept:'application/json' } });
  if (!res.ok) throw new Error('OSRM ' + res.status);
  const data = await res.json();
  if (!data.routes?.length) throw new Error('OSRM no route');

  const osrmKm     = data.routes[0].distance / 1000;
  const straightKm = _h(lat1,lon1,lat2,lon2);
  const factor     = _if2(osrmKm, straightKm);
  const corrected  = osrmKm * factor;

  
  return Math.max(corrected, straightKm);
}

function _dfb(lat1,lon1,lat2,lon2) {
  return _h(lat1,lon1,lat2,lon2) * 1.30;
}

let rows=[], _hl=null, curRow=null, curType=null;
let mbMap=null, mbMarker=null;
let selCoords=null, selName=null, selSub=null;
const distCache = {};

const _mn = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];

function _sH(s) {
  if (typeof s !== 'string') return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function _grd(lat1,lon1,lat2,lon2) {
  if (!_ivc(lat1,lon1) || !_ivc(lat2,lon2)) return 0;

  const k1 = `${lat1.toFixed(3)},${lon1.toFixed(3)}-${lat2.toFixed(3)},${lon2.toFixed(3)}`;
  const k2 = `${lat2.toFixed(3)},${lon2.toFixed(3)}-${lat1.toFixed(3)},${lon1.toFixed(3)}`;
  if (distCache[k1]) return distCache[k1];
  if (distCache[k2]) return distCache[k2];

  let dist = 0;
  try {
    dist = await _dvo(lat1,lon1,lat2,lon2);
    _ueb('OSRM');
  } catch(e) {
    console.warn('OSRM failed, using Haversine fallback:', e.message);
    dist = _dfb(lat1,lon1,lat2,lon2);
    _ueb('HVS');
  }

  distCache[k1] = dist;
  return dist;
}

function _ivc(lat,lon) {
  return typeof lat==='number' && typeof lon==='number' &&
         lat>=-90 && lat<=90 && lon>=-180 && lon<=180;
}

async function _cl(loc) {
  if (!_hl || !loc) return { ok:false, dist:0 };
  const d = await _grd(_hl.lat,_hl.lng,loc.lat,loc.lng);
  const sameSub = _hl.sub && loc.sub &&
                  _hl.sub.toLowerCase().trim() === loc.sub.toLowerCase().trim();
  return { ok: d>40 && !sameSub, dist: Math.round(d) };
}

function _sdl() {
  const data = { rows:rows, _hl:_hl, ts:new Date().toISOString() };
  localStorage.setItem('allowanceData_v1', JSON.stringify(data));
  console.log('💾 Data saved on your device');
}

function _ldl() {
  const saved = localStorage.getItem('allowanceData_v1');
  if(saved) {
    try {
      const data = JSON.parse(saved);
      rows = data.rows || [];
      _hl = data._hl || null;
      if(_hl) {
        const btn = document.getElementById('homeBtn');
        btn.innerHTML = `<i class="ti ti-map-pin"></i> ${_sH(_hl.name)}`;
        btn.classList.add('set');
      }
      console.log('✅ Data loaded from your device');
      return true;
    } catch(e) { console.error('Error loading:', e); }
  }
  return false;
}

function _cad() {
  if(confirm('Delete ALL data from your device? Cannot undo!')) {
    localStorage.removeItem('allowanceData_v1');
    rows = [];
    _hl = null;
    _bts();
    alert('All data cleared!');
  }
}

function _id() {
  const ms = document.getElementById('monthSelect');
  const ys = document.getElementById('yearSelect');
  const now = new Date();
  _mn.forEach((m,i) => {
    const o = document.createElement('option');
    o.value=i; o.textContent=m;
    if(i===now.getMonth()) o.selected=true;
    ms.appendChild(o);
  });
  const cy = now.getFullYear();
  for(let y=cy-3;y<=cy+3;y++) {
    const o = document.createElement('option');
    o.value=y; o.textContent=y;
    if(y===cy) o.selected=true;
    ys.appendChild(o);
  }
  _bts();
}

function _bts() {
  const m  = parseInt(document.getElementById('monthSelect').value);
  const y  = parseInt(document.getElementById('yearSelect').value);
  const lp = new Date(y,m,0).getDate();
  const dm = new Date(y,m+1,0).getDate();
  const DATES = [lp];
  for(let d=1;d<=dm;d++) DATES.push(d);
  
  
  const hasExisting = rows.length > 0 && rows[0].date === lp;
  
  if(!hasExisting) {
    rows = DATES.map((d,i) => ({
      date:d, isFirstRow:i===0, isLastRow:i===DATES.length-1, night:null, day:null, specialActivity:""
    }));
  }
  _bt();
}

async function _bt() {
  const tb = document.getElementById('tbody');
  tb.innerHTML = '';
  let tot = 0;
  _sL(true, 'Calculating road distances...');

  for(let i=0;i<rows.length;i++) {
    const row = rows[i];
    const tr  = document.createElement('tr');

    const dStat = await _cl(row.day);
    let eligible = false;
    const hasSpecial = row.specialActivity && row.specialActivity !== '';
    if(!row.isFirstRow) {
      const pn = await _cl(rows[i-1].night);
      if(hasSpecial) { eligible=true; tot++; }
      else if(pn.ok && dStat.ok) { eligible=true; tot++; }
    }

    const dayBox = `<td>${!row.isFirstRow ? `
      <span class="lpill ${row.day?'set':''} ${row.day?(dStat.ok||hasSpecial?'ok':'fail'):''}"
            onclick="_om(${i},'day')">
        ${row.day ? _sH(row.day.name) : 'Select Day Location'}
        ${row.day ? `<span class="dist-tag">${dStat.dist} km | ${dStat.ok?'✓ Eligible':hasSpecial?'✓ Special':'✗ Home Area'}</span>` : ''}
      </span>` : '<span style="color:#94a3b8;font-size:10px;">Prev Month</span>'}</td>`;

    const nStat = await _cl(row.night);
    const nightBox = `<td>
      <span class="lpill ${row.night?'set':''} ${row.night?(nStat.ok||hasSpecial?'ok':'fail'):''}"
            onclick="_om(${i},'night')">
        ${row.night ? _sH(row.night.name) : 'Select Night Location'}
        ${row.night ? `<span class="dist-tag">${nStat.dist} km | ${nStat.ok?'✓ Eligible':hasSpecial?'✓ Special':'✗ Home Area'}</span>` : ''}
      </span></td>`;

    const statusBox = `<td>${!row.isFirstRow
      ? (eligible ? `<span class="cyes">YES</span>` : '<span class="cno">NO</span>')
      : '-'}</td>`;

    const specialBox = `<td>
      <select class="special-select ${hasSpecial?'special-set':''}" onchange="_ss(${i}, this.value)">
        <option value="">-- None --</option>
        <option value="QFL" ${row.specialActivity==='QFL'?'selected':''}>🚌 QFL</option>
        <option value="FNC" ${row.specialActivity==='FNC'?'selected':''}>📖 FNC</option>
      </select>
    </td>`;
    tr.innerHTML = `<td>${row.date}</td>${dayBox}${nightBox}${specialBox}${statusBox}`;
    tb.appendChild(tr);
  }

  document.getElementById('totDays').textContent = tot;
  document.getElementById('grandSub').textContent = `${tot} eligible days`;
  document.getElementById('grandVal').textContent  = `${tot} Days`;
  _usb();
  _sL(false);
}

function _ss(rowIdx, value) {
  rows[rowIdx].specialActivity = value;
  _sdl();
  _bt();
}

function _sL(show, msg='') {
  const el = document.getElementById('loadingOverlay');
  el.classList.toggle('show', show);
  if(msg) document.getElementById('loadingMsg').textContent = msg;
}

function _om(rowIdx, type) {
  curRow=rowIdx; curType=type;
  const titles = {home:'Set Home Location', day:'Select Day Location', night:'Select Night Location'};
  document.getElementById('modalTitle').textContent = titles[type];
  document.getElementById('overlayWrap').classList.add('open');
  document.getElementById('searchInput').value = '';
  document.getElementById('rlist').innerHTML = '';
  document.getElementById('selLabel').textContent = 'Select a location...';
  selCoords=null; selName=null; selSub=null;

  setTimeout(() => {
    if(!mbMap) {
      mapboxgl.accessToken = window.__mbk;
      mbMap = new mapboxgl.Map({
        container:'map',
        style:'mapbox://styles/mapbox/streets-v12',
        center:[78.9629,20.5937],
        zoom:4
      });
      mbMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
      mbMap.on('click', e => {
        const {lng,lat} = e.lngLat;
        selCoords={lat,lng};
        selName=`${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        selSub='';
        document.getElementById('selLabel').textContent = selName;
        _pm(lng,lat);
      });
    } else { mbMap.resize(); }
  }, 120);
}

function _cm() {
  document.getElementById('overlayWrap').classList.remove('open');
  selCoords=null; selName=null; selSub=null;
}

function _pm(lng,lat) {
  if(mbMarker) mbMarker.remove();
  mbMarker = new mapboxgl.Marker({color:'#cc0000'}).setLngLat([lng,lat]).addTo(mbMap);
  mbMap.flyTo({center:[lng,lat],zoom:12,speed:1.5});
}

async function _ds() {
  const q = document.getElementById('searchInput').value.trim();
  if(!q || q.length<2) { alert('Please enter at least 2 characters'); return; }
  const rlist = document.getElementById('rlist');
  rlist.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;">Searching...</div>';

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=10&countrycodes=in&addressdetails=1`;
    const res = await fetch(url, { headers:{'Accept-Language':'en'} });
    const data = await res.json();
    rlist.innerHTML = '';

    if(!data.length) {
      rlist.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;">No results. Try a broader search.</div>';
      return;
    }

    data.forEach(item => {
      const sub = item.address?.suburb || item.address?.subdistrict ||
                  item.address?.county || item.address?.city_district || '';
      const div = document.createElement('div');
      div.className = 'ri';
      div.innerHTML = `<div class="rn">${_sH(item.name || item.display_name.split(',')[0])}</div>
                       <div class="ra">${_sH(item.display_name)}</div>`;
      div.onclick = () => {
        selCoords = { lat:parseFloat(item.lat), lng:parseFloat(item.lon) };
        selName   = item.name || item.display_name.split(',')[0];
        selSub    = sub;
        document.getElementById('selLabel').textContent =
          _sH(selName) + (sub ? ` — ${_sH(sub)}` : '');
        _pm(selCoords.lng, selCoords.lat);
      };
      rlist.appendChild(div);
    });
  } catch(e) {
    rlist.innerHTML = '<div style="padding:16px;color:#991b1b;">Search failed. Please retry.</div>';
  }
}

function _cfl() {
  if(!selCoords || !selName) { alert('Please select a location'); return; }
  if(curType==='home') {
    _hl = { lat:selCoords.lat, lng:selCoords.lng, name:selName, sub:selSub };
    const btn = document.getElementById('homeBtn');
    btn.innerHTML = `<i class="ti ti-map-pin"></i> ${_sH(selName)}`;
    btn.classList.add('set');
  } else if(curRow !== null) {
    rows[curRow][curType] = { lat:selCoords.lat, lng:selCoords.lng, name:selName, sub:selSub };
  }
  _sdl();
  _cm();
  _bt();
}

function _usb() {
  
}

function _gtd() {
  return rows.map(r => {
    let status = 'Pending';
    if (r.day && r.night) {
      const distance = calcDistance(r.day.lat, r.day.lng, r.night.lat, r.night.lng);
      status = distance >= 40 ? 'Eligible' : 'Not Eligible (Distance < 40km)';
    }
    return {
      date: r.date,
      dayLoc: r.day ? r.day.name : '-',
      nightLoc: r.night ? r.night.name : '-',
      status: status
    };
  });
}

function _ct() {
  const eligible = rows.filter(r => {
    if (!r.day || !r.night) return false;
    
    const distance = calcDistance(r.day.lat, r.day.lng, r.night.lat, r.night.lng);
    return distance >= 40;
  }).length;
  const rate = 300; 
  const totalAmount = eligible * rate;
  return { eligible, rate, totalAmount };
}

function _dxl() {
  const name='Travel_Allowance';
  const totals = _ct();
  let csv='Date,Day Location,Night Location,Status\n';
  
  _gtd().forEach(r => {
    csv+=`"${r.date}","${r.dayLoc}","${r.nightLoc}","${r.status}"\n`;
  });
  
  
  csv+='\n';
  csv+='SUMMARY\n';
  csv+=`Total Eligible Days,${totals.eligible}\n`;
  csv+=`Daily Rate (₹),${totals.rate}\n`;
  csv+=`Total Allowance Amount (₹),${totals.totalAmount}\n`;
  
  const b=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const l=document.createElement('a');
  l.href=URL.createObjectURL(b);
  l.download=`allowance_${name}_${new Date().toISOString().split('T')[0]}.csv`;
  l.click();
}

function _dcsv(){ _dxl(); }
function _sub() {
  
  alert('Use Download Excel or Download CSV to export your data');
}

async function _sve() {
  const recipient = document.getElementById('recipientEmail').value.trim();
  if (!recipient) { alert('Please enter recipient email address'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { alert('Please enter a valid email address'); return; }

  const m        = parseInt(document.getElementById('monthSelect').value);
  const y        = parseInt(document.getElementById('yearSelect').value);
  const tot      = parseInt(document.getElementById('totDays').textContent) || 0;
  const monthName = _mn[m];
  const homeStr  = _hl ? _hl.name : 'Not set';
  const fileName = `Allowance_${monthName}_${y}.pdf`;

  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 22, 'F');
    doc.setTextColor(255, 232, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Jadwal Allowance Report', 14, 14);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${y}`, 150, 14);

    
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 28, 182, 24, 2, 2, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.text(`Home Location: ${homeStr}`, 20, 37);
    doc.text(`Total Eligible Days: ${tot}`, 20, 44);
    doc.setTextColor(204, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${tot} Days`, 160, 44);

    
    const tableRows = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.isFirstRow) continue;
      const prev = rows[i - 1];
      const hasSpecial = r.specialActivity && r.specialActivity !== '';
      const dOk = r.day && _hl ? (await _cl(r.day)).ok : false;
      const pOk = prev && prev.night && _hl ? (await _cl(prev.night)).ok : false;
      const eligible = hasSpecial || (dOk && pOk);
      tableRows.push([
        `${r.date} ${monthName.slice(0,3)}`,
        r.day   ? r.day.name   : '-',
        r.night ? r.night.name : '-',
        r.specialActivity || '-',
        eligible ? 'YES' : 'NO'
      ]);
    }

    doc.autoTable({
      startY: 58,
      head: [['Date', 'Day Location', 'Night Location', 'Special', 'Status']],
      body: tableRows,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22, halign: 'center' }
      },
      didDrawCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          const val = data.cell.raw;
          if (val === 'YES') {
            data.doc.setTextColor(22, 101, 52);
          } else {
            data.doc.setTextColor(148, 163, 184);
          }
        }
      }
    });

    
    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} | All data processed on device only.`, 14, finalY);

    
    doc.save(fileName);
  } catch(e) {
    console.error('PDF generation failed:', e);
    alert('PDF generate nahi hua. Print/PDF button se manually save karen.');
  }

  
  const subject = encodeURIComponent(`Jadwal Allowance Report — ${monthName} ${y}`);
  const body = encodeURIComponent(
`Jadwal Allowance Report
Month: ${monthName} ${y}
Home Location: ${homeStr}
Total Eligible Days: ${tot}

PDF report download ho gaya hai aapke device pe: "${fileName}"
Please attach the downloaded PDF and send.

---
This report was generated on ${new Date().toLocaleDateString('en-IN')}.
All data processed locally on device only.`
  );

  setTimeout(() => {
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  }, 800);
}

document.addEventListener('DOMContentLoaded', () => {
  _id();

  
  const pn = document.getElementById('privacyNotice');
  if (pn) {
    if (localStorage.getItem('privacyNoticeSeen')) {
      pn.style.display = 'none';
    } else {
      setTimeout(() => {
        pn.style.opacity = '0';
        pn.style.maxHeight = '0';
        pn.style.padding = '0';
        setTimeout(() => { pn.style.display = 'none'; }, 1000);
      }, 6000);
      localStorage.setItem('privacyNoticeSeen', '1');
    }
  }
});
}(window,document);