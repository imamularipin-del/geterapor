/**
 * Backend e-Rapor: simpan & baca nilai di Google Sheet.
 * Tempel di Ekstensi > Apps Script pada Google Sheet Anda,
 * lalu Deploy > Deployment baru > Aplikasi web (Jalankan sebagai: Saya, Akses: Siapa saja).
 */
const KB = [20,25,30,40,45,50,55,60,65,70,75,80,85,90,95];
const KJ = [74,75,76,77,78,79,80,81,82,83,84,86,88,92,96];
const H_S = ['NIPD','Nama'];
const H_N = ['Key','Mapel','NIPD','Nama','TP1','TP2','TP3','TP4','TP5','TP6','TP7','TP8','TP9','TP10','NA Real','Nilai Rapor','Diubah'];
const H_P = ['NIPD','Nama','Tri/Dwi Satya','Dasa/Dwi Darma','Keterampilan','Jumlah','Predikat','Diubah'];

function conv(v){ for (var i = 0; i < 15; i++) if (v <= KB[i]) return KJ[i]; return 100; }

function sh(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(head);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#0e3b3c').setFontColor('#ffffff');
  }
  return s;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Tambah/perbarui baris berdasarkan kolom pertama (kunci), ditulis sekaligus agar cepat.
function upsert(s, rows, w) {
  const last = s.getLastRow();
  const data = last > 1 ? s.getRange(2, 1, last - 1, w).getValues() : [];
  const idx = {};
  data.forEach((r, i) => idx[String(r[0])] = i);
  rows.forEach(r => {
    const i = idx[String(r[0])];
    if (i >= 0) data[i] = r;
    else { idx[String(r[0])] = data.length; data.push(r); }
  });
  if (data.length) s.getRange(2, 1, data.length, w).setValues(data);
}

function rowN(m, id, nama, tp) {
  tp = (tp || []).concat(Array(10).fill('')).slice(0, 10);
  const t = tp.filter(v => v !== '' && v !== null && !isNaN(v)).map(Number);
  const na = t.length ? t.reduce((a, b) => a + b, 0) / t.length : '';
  const nr = t.length ? Math.round(t.map(conv).reduce((a, b) => a + b, 0) / t.length) : '';
  return [m + '|' + id, m, id, nama, ...tp, na === '' ? '' : Math.round(na * 100) / 100, nr, new Date()];
}

function rowP(id, nama, v) {
  v = v || ['', '', ''];
  const z = v.reduce((a, b) => a + (Number(b) || 0), 0);
  return [id, nama, v[0], v[1], v[2], z, z <= 3 ? 'D' : z <= 6 ? 'C' : z <= 9 ? 'B' : 'A', new Date()];
}

function doGet() {
  const siswa = sh('Siswa', H_S).getDataRange().getValues().slice(1)
    .filter(r => r[0] !== '').map(r => ({ id: String(r[0]), n: String(r[1]) }));
  const sc = {};
  sh('Nilai', H_N).getDataRange().getValues().slice(1).forEach(r => {
    if (!r[0]) return;
    (sc[r[1]] = sc[r[1]] || {})[String(r[2])] = r.slice(4, 14);
  });
  const pr = {};
  sh('Pramuka', H_P).getDataRange().getValues().slice(1).forEach(r => {
    if (r[0] !== '') pr[String(r[0])] = [r[2], r[3], r[4]];
  });
  return out({ ok: 1, siswa, sc, pr });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action == 'nilai') {
      upsert(sh('Nilai', H_N), [rowN(d.mapel, d.nipd, d.nama, d.tp)], 17);
    } else if (d.action == 'pramuka') {
      upsert(sh('Pramuka', H_P), [rowP(d.nipd, d.nama, d.v)], 8);
    } else if (d.action == 'sync') {
      const nm = {};
      d.siswa.forEach(x => nm[x.id] = x.n);
      if (d.siswa.length) upsert(sh('Siswa', H_S), d.siswa.map(x => [x.id, x.n]), 2);
      const rn = [];
      for (const m in d.sc) for (const id in d.sc[m]) rn.push(rowN(m, id, nm[id] || '', d.sc[m][id]));
      if (rn.length) upsert(sh('Nilai', H_N), rn, 17);
      const rp = Object.keys(d.pr).map(id => rowP(id, nm[id] || '', d.pr[id]));
      if (rp.length) upsert(sh('Pramuka', H_P), rp, 8);
    }
    return out({ ok: 1 });
  } catch (err) {
    return out({ ok: 0, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
