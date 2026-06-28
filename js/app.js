/* ===================================================
   app.js — Ajustador de presupuesto de obra civil
   v3.0 — importación directa Excel, separadores
          inteligentes, decimales, condiciones,
          bloqueo de ítems, historial con restaurar
   =================================================== */

/* ── Datos de ejemplo ── */
const DEFAULT_ITEMS = [
  { desc:'INSTALACIÓN DE FAENAS (OBRAS MENORES) HASTA 500.000 BS.', unit:'glb.', qty:1.0,    price:3850.32, locked:false, minQty:'', maxQty:'' },
  { desc:'REPLANTEO Y CONTROL TOPOGRÁFICO (LINEAL)',                  unit:'m',    qty:264.59, price:7.33,    locked:false, minQty:'', maxQty:'' },
  { desc:'PERFILADO DE SUBRASANTE',                                   unit:'m²',   qty:2360.0, price:8.74,    locked:false, minQty:'', maxQty:'' },
  { desc:'EMPEDRADO DE VIAS',                                         unit:'m²',   qty:2360.0, price:46.73,   locked:false, minQty:'', maxQty:'' },
  { desc:'COMPACTADO DE EMPEDRADO CON EQUIPO',                        unit:'m²',   qty:2360.0, price:4.15,    locked:false, minQty:'', maxQty:'' },
  { desc:'CORDON DE REMATE DE HºCº 50% P.D.',                        unit:'m',    qty:34.3,   price:176.37,  locked:false, minQty:'', maxQty:'' },
  { desc:'CONFORMACION DE TERRAPLEN PROV. Y COLOC.',                  unit:'m³',   qty:342.07, price:97.49,   locked:false, minQty:'', maxQty:'' },
  { desc:'LIMPIEZA GENERAL',                                          unit:'glb.', qty:1.0,    price:1799.15, locked:false, minQty:'', maxQty:'' },
];

/* ── Estado ── */
let items    = [];
let origQtys = [];
let checked  = [];
let history  = [];
let decimals = 2;

/* ── Estado importación archivo ── */
let fileHeaders = [];
let fileRows    = [];
let fileWb      = null;

/* ═══════════════════════════════════════════════════
   UTILIDADES NUMÉRICAS
═══════════════════════════════════════════════════ */

/** Número puro con N decimales — para inputs type=number (solo acepta punto) */
function rawNum(n, d) {
  return parseFloat((+n).toFixed(d != null ? d : 4));
}

/** Formateo visual para mostrar en pantalla (coma boliviana) */
function fmtDisp(n) {
  return (+n).toLocaleString('es-BO', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

/* ── Detección de formato de separadores ──
   Analiza el texto pegado completo UNA sola vez.
   Cuenta votos: si mayoría de números termina en ,XX → decimal=coma
                 si mayoría termina en .XX  → decimal=punto         */
function detectarFormato(texto) {
  const tokens = texto.match(/\d[\d.,]+\d/g) || [];
  let votoComa = 0, votoPunto = 0;
  for (const t of tokens) {
    const hasDot   = t.includes('.');
    const hasComma = t.includes(',');
    if (!hasDot && !hasComma) continue;
    if (hasDot && hasComma) {
      t.lastIndexOf(',') > t.lastIndexOf('.') ? votoComa++ : votoPunto++;
    } else if (hasComma) {
      /,\d{1,2}$/.test(t) ? votoComa++ : votoPunto++;
    } else {
      /\.\d{1,2}$/.test(t) ? votoPunto++ : votoComa++;
    }
  }
  return votoComa >= votoPunto ? 'coma' : 'punto';
}

/** Parsear un número conociendo el formato del lote */
function parsearNum(s, fmt) {
  if (typeof s === 'number') return isFinite(s) ? s : 0;
  s = String(s).trim();
  if (!s) return 0;
  return fmt === 'coma'
    ? parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
    : parseFloat(s.replace(/,/g, ''))                   || 0;
}

/* ═══════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════ */
function showToast(msg, type = 'ok') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  const icons = { ok:'ti-check', err:'ti-alert-circle', warn:'ti-alert-triangle' };
  t.className = 'toast ' + type;
  t.innerHTML = `<i class="ti ${icons[type] || 'ti-info-circle'}"></i> ${msg}`;
  container.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 3000);
}

/* ═══════════════════════════════════════════════════
   TABS DE IMPORTACIÓN
═══════════════════════════════════════════════════ */
function switchTab(t) {
  document.getElementById('tabFile').classList.toggle('act',  t === 'file');
  document.getElementById('tabPaste').classList.toggle('act', t === 'paste');
  document.getElementById('panelFile').style.display  = t === 'file'  ? 'block' : 'none';
  document.getElementById('panelPaste').style.display = t === 'paste' ? 'block' : 'none';
}

/* ═══════════════════════════════════════════════════
   IMPORTAR DESDE ARCHIVO EXCEL
   SheetJS lee los números como JS numbers puros →
   NO hay problema de separadores de miles/decimales
═══════════════════════════════════════════════════ */
const fileDrop = document.getElementById('fileDrop');
fileDrop.addEventListener('dragover',  e => { e.preventDefault(); fileDrop.classList.add('drag'); });
fileDrop.addEventListener('dragleave', ()  => fileDrop.classList.remove('drag'));
fileDrop.addEventListener('drop', e => {
  e.preventDefault();
  fileDrop.classList.remove('drag');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      fileWb = XLSX.read(data, { type:'array', cellDates:true });
      const sheetName = fileWb.SheetNames[0];
      const ws = fileWb.Sheets[sheetName];
      /* raw:true → números salen como JS numbers, no como texto formateado */
      const json = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });

      if (!json.length) { showToast('El archivo está vacío.', 'err'); return; }

      /* Detectar fila de encabezado: primera con ≥2 celdas de texto */
      let headerRow = 0;
      for (let i = 0; i < Math.min(10, json.length); i++) {
        const textCells = json[i].filter(c => typeof c === 'string' && c.trim().length > 1);
        if (textCells.length >= 2) { headerRow = i; break; }
      }

      fileHeaders = json[headerRow].map((h, i) => ({ label: String(h || 'Col ' + (i+1)), idx: i }));
      fileRows    = json.slice(headerRow + 1).filter(r => r.some(c => c !== ''));

      document.getElementById('fileNameText').textContent =
        file.name + ' · ' + fileRows.length + ' filas · Hoja: ' + fileWb.SheetNames[0];
      document.getElementById('fileName').classList.add('show');

      populateColMap();
      document.getElementById('colMap').classList.add('show');

    } catch(err) {
      showToast('Error al leer el archivo: ' + err.message, 'err');
    }
  };
  reader.readAsArrayBuffer(file);
}

function populateColMap() {
  const keywords = [
    ['desc','descrip','item','nombre','actividad','obra','detalle'],
    ['unid','unidad','ud','um','medida','unit'],
    ['cant','cantidad','qty','volumen','vol'],
    ['precio','unitario','p.u','pu','costo','tarifa'],
  ];
  ['mapDesc','mapUnit','mapQty','mapPrice'].forEach((id, si) => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="-1">— No usar —</option>';
    fileHeaders.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.idx;
      opt.textContent = h.label;
      const hl = String(h.label).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if (keywords[si].some(k => hl.includes(k))) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function importFromFile() {
  const iDesc = parseInt(document.getElementById('mapDesc').value);
  const iUnit = parseInt(document.getElementById('mapUnit').value);
  const iQty  = parseInt(document.getElementById('mapQty').value);
  const iPrc  = parseInt(document.getElementById('mapPrice').value);

  if (iDesc < 0 || iQty < 0 || iPrc < 0) {
    showToast('Asigna al menos Descripción, Cantidad y Precio.', 'err');
    return;
  }

  const newItems = [];
  for (const row of fileRows) {
    const desc = String(row[iDesc] || '').trim();
    if (!desc) continue;
    /* SheetJS ya entrega JS numbers — parseFloat es seguro */
    const qty   = parseFloat(row[iQty])  || 0;
    const price = parseFloat(row[iPrc])  || 0;
    const unit  = iUnit >= 0 ? String(row[iUnit] || 'glb.').trim() : 'glb.';
    newItems.push({ desc, unit, qty: qty || 1, price, locked:false, minQty:'', maxQty:'' });
  }

  if (!newItems.length) { showToast('No se encontraron filas con datos.', 'err'); return; }

  items    = [...items, ...newItems];
  origQtys = items.map(i => i.qty);
  checked  = items.map(() => true);
  render();
  showToast(newItems.length + ' ítem(s) importados desde ' + fileWb.SheetNames[0] + '.');
  cancelFile();
}

function cancelFile() {
  document.getElementById('colMap').classList.remove('show');
  document.getElementById('fileName').classList.remove('show');
  document.getElementById('fileInput').value = '';
  fileHeaders = []; fileRows = []; fileWb = null;
}

/* ═══════════════════════════════════════════════════
   IMPORTAR PEGANDO DESDE EXCEL
   Aquí sí necesitamos detectar el formato
═══════════════════════════════════════════════════ */
const pasteZone = document.getElementById('pasteZone');
pasteZone.addEventListener('click',  () => pasteZone.focus());
pasteZone.addEventListener('focus',  () => pasteZone.style.background = 'var(--g100)');
pasteZone.addEventListener('blur',   () => pasteZone.style.background = '');
pasteZone.addEventListener('paste', e => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  if (!text) { showToast('No se detectó contenido.', 'err'); return; }

  /* Detectar formato UNA VEZ para todo el bloque pegado */
  const fmt = detectarFormato(text);
  actualizarBadgeFmt(fmt);

  const parsed = parsePastedText(text, fmt);
  if (!parsed.length) { showToast('No se pudo interpretar la tabla.', 'err'); return; }

  items    = [...items, ...parsed];
  origQtys = items.map(i => i.qty);
  checked  = items.map(() => true);
  render();
  const fmtLabel = fmt === 'coma' ? 'decimal=coma' : 'decimal=punto';
  showToast(parsed.length + ' ítem(s) importados · Formato: ' + fmtLabel);
  pasteZone.blur();
});

function actualizarBadgeFmt(fmt) {
  const badge = document.getElementById('fmtBadge');
  if (!badge) return;
  if (fmt === 'coma') {
    badge.className = 'fmt-badge bo';
    badge.textContent = 'Decimal = coma  (Ej: 2.360,59)';
  } else {
    badge.className = 'fmt-badge en';
    badge.textContent = 'Decimal = punto (Ej: 2,360.59)';
  }
}

function parsePastedText(text, fmt) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const out = [];
  for (const line of lines) {
    const cols = line.split('\t').map(c => c.trim());
    if (!cols.length) continue;
    let desc = '', unit = 'glb.', qty = 1, price = 0;
    if      (cols.length === 1) { desc = cols[0]; }
    else if (cols.length === 2) { desc = cols[0]; qty = parsearNum(cols[1], fmt); }
    else if (cols.length === 3) { desc = cols[0]; unit = cols[1]; qty = parsearNum(cols[2], fmt); }
    else                        { desc = cols[0]; unit = cols[1]; qty = parsearNum(cols[2], fmt); price = parsearNum(cols[3], fmt); }
    if (desc) out.push({ desc, unit, qty: qty || 1, price: price || 0, locked:false, minQty:'', maxQty:'' });
  }
  return out;
}

/* ═══════════════════════════════════════════════════
   MÉTRICAS
═══════════════════════════════════════════════════ */
function getTotal() { return items.reduce((s, i) => s + i.qty * i.price, 0); }

function updateMetrics() {
  const total  = getTotal();
  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const diff   = total - target;
  const factor = total > 0 ? target / total : 1;

  document.getElementById('mActual').textContent = fmtDisp(total)  + ' Bs';
  document.getElementById('mTarget').textContent = fmtDisp(target) + ' Bs';
  document.getElementById('mFactor').textContent = factor.toFixed(5);
  document.getElementById('totalVal').textContent = fmtDisp(total) + ' Bs';

  const de = document.getElementById('mDiff');
  de.textContent = (diff >= 0 ? '+' : '') + fmtDisp(diff) + ' Bs';
  de.className   = 'hm-value ' + (Math.abs(diff) < 0.5 ? 'ok' : diff > 0 ? 'bad' : 'warn');
}

/* ═══════════════════════════════════════════════════
   DECIMALES
═══════════════════════════════════════════════════ */
function setDec(d) {
  decimals = d;
  document.querySelectorAll('.dec-pill').forEach((p, i) => p.classList.toggle('act', i === d));
}

/* ═══════════════════════════════════════════════════
   CONDICIONES MIN / MAX
═══════════════════════════════════════════════════ */
function applyConditions(item, newQty) {
  let q = newQty;
  const mn = parseFloat(item.minQty);
  const mx = parseFloat(item.maxQty);
  if (!isNaN(mn) && q < mn) q = mn;
  if (!isNaN(mx) && q > mx) q = mx;
  return rawNum(q, decimals);
}

/* ═══════════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════════ */
function render() {
  const list = document.getElementById('itemsList');
  list.innerHTML = '';
  items.forEach((item, idx) => {
    const p      = item.qty * item.price;
    const col    = idx % 5;
    const isChk  = checked[idx] !== false;

    const card = document.createElement('div');
    card.className    = 'item-card';
    card.dataset.color = col;

    card.innerHTML = `
      <div class="item-header">
        <input type="checkbox" ${isChk ? 'checked' : ''}
          onchange="toggleItem(${idx}, this.checked)" aria-label="Ítem ${idx+1}">
        <div class="item-num">${idx+1}</div>
        <input class="item-desc" type="text"
          value="${item.desc.replace(/"/g, '&quot;')}"
          onchange="updField(${idx},'desc',this.value)"
          placeholder="Descripción del ítem">
        <div class="item-badges">
          ${item.locked ? '<span class="badge-lock"><i class="ti ti-lock"></i> Bloqueado</span>' : ''}
          ${item.price === 0 ? '<span class="badge-warn">⚠ precio 0</span>' : ''}
        </div>
        <div class="item-icons">
          <button class="icon-btn ${item.locked ? 'active' : ''}"
            onclick="toggleLock(${idx})"
            title="${item.locked ? 'Desbloquear cantidad' : 'Bloquear cantidad'}">
            <i class="ti ti-${item.locked ? 'lock' : 'lock-open'}"></i>
          </button>
          <button class="icon-btn del" onclick="delRow(${idx})" aria-label="Eliminar ítem ${idx+1}">
            <i class="ti ti-x"></i>
          </button>
        </div>
      </div>
      <div class="item-body">
        <div class="ifield">
          <label>Unidad</label>
          <input type="text" value="${item.unit}"
            onchange="updField(${idx},'unit',this.value)"
            style="text-align:center;"
            ${item.locked ? 'readonly' : ''}>
        </div>
        <div class="ifield">
          <label>Cantidad</label>
          <input type="number" class="r" id="qty${idx}"
            value="${rawNum(item.qty, 4)}" step="any"
            onchange="updQty(${idx}, this.value)"
            ${item.locked ? 'readonly' : ''}>
        </div>
        <div class="ifield full">
          <label>Precio unitario (Bs)</label>
          <input type="number" class="r"
            value="${rawNum(item.price, 4)}" step="any"
            onchange="updField(${idx},'price', parseFloat(this.value)||0)">
        </div>
        <div class="item-parcial">
          <span class="parc-lbl">Parcial</span>
          <span class="parc-val" id="pc${idx}">${fmtDisp(p)} Bs</span>
        </div>
      </div>
      <div class="item-conds">
        <div class="cond-field">
          <label>≥ Cantidad mínima</label>
          <input type="number" value="${item.minQty}" step="any"
            placeholder="Sin mín."
            onchange="updField(${idx},'minQty',this.value)">
        </div>
        <div class="cond-field">
          <label>≤ Cantidad máxima</label>
          <input type="number" value="${item.maxQty}" step="any"
            placeholder="Sin máx."
            onchange="updField(${idx},'maxQty',this.value)">
        </div>
      </div>
    `;
    list.appendChild(card);
  });
  updateMetrics();
}

function refreshParcial(idx) {
  const el = document.getElementById('pc' + idx);
  if (el) el.textContent = fmtDisp(items[idx].qty * items[idx].price) + ' Bs';
}

/* ═══════════════════════════════════════════════════
   CRUD DE ÍTEMS
═══════════════════════════════════════════════════ */
function updField(idx, key, val) {
  items[idx][key] = val;
  if (key === 'price') refreshParcial(idx);
  updateMetrics();
}

function updQty(idx, val) {
  items[idx].qty = parseFloat(val) || 0;
  refreshParcial(idx);
  updateMetrics();
}

function toggleItem(idx, val) { checked[idx] = val; }

function toggleAll(chk) {
  checked = items.map(() => chk.checked);
  render();
}

function toggleLock(idx) {
  items[idx].locked = !items[idx].locked;
  render();
}

function addRow() {
  items.push({ desc:'Nuevo ítem', unit:'glb.', qty:1, price:0, locked:false, minQty:'', maxQty:'' });
  origQtys.push(1);
  checked.push(true);
  render();
  const cards = document.querySelectorAll('.item-card');
  if (cards.length) cards[cards.length - 1].querySelector('.item-desc').focus();
}

function delRow(idx) {
  items.splice(idx, 1);
  origQtys.splice(idx, 1);
  checked.splice(idx, 1);
  render();
}

function loadDefault() {
  items    = DEFAULT_ITEMS.map(i => ({ ...i }));
  origQtys = items.map(i => i.qty);
  checked  = items.map(() => true);
  render();
  showToast('Datos de ejemplo cargados.');
}

/* ═══════════════════════════════════════════════════
   AJUSTE
═══════════════════════════════════════════════════ */
function calcAjuste() {
  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const method = document.getElementById('method').value;
  const total  = getTotal();

  if (!items.length)              { showToast('Agrega ítems primero.', 'err'); return; }
  if (!target && method !== 'pct') { showToast('Ingresa un monto objetivo.', 'err'); return; }

  /* Advertencia precio cero */
  const zeros = items.filter(i => i.price === 0 && !i.locked);
  if (zeros.length) showToast(zeros.length + ' ítem(s) con precio cero — verifica antes de ajustar.', 'warn');

  /* Snapshot para historial */
  const snapBefore   = items.map(it => ({ ...it }));
  const totalBefore  = total;

  /* ── Métodos ── */
  if (method === 'prop') {
    const f = target / total;
    items.forEach(item => {
      if (!item.locked) item.qty = applyConditions(item, item.qty * f);
    });

  } else if (method === 'sel') {
    const selIds = items.map((it, i) => (!it.locked && checked[i] !== false) ? i : -1).filter(i => i >= 0);
    const fixedT = items.reduce((s, it, i) => s + (!selIds.includes(i) ? it.qty * it.price : 0), 0);
    const selT   = items.reduce((s, it, i) => s + ( selIds.includes(i) ? it.qty * it.price : 0), 0);
    const need   = target - fixedT;
    if (selT > 0 && need > 0) {
      const f = need / selT;
      selIds.forEach(i => { items[i].qty = applyConditions(items[i], items[i].qty * f); });
    } else {
      showToast('Sin margen suficiente con los ítems seleccionados.', 'err');
      return;
    }

  } else if (method === 'big') {
    const idxs = items
      .map((it, i) => (!it.locked && checked[i] !== false) ? i : -1)
      .filter(i => i >= 0)
      .sort((a, b) => items[b].qty * items[b].price - items[a].qty * items[a].price);
    let rem = target - total;
    for (const i of idxs) {
      if (Math.abs(rem) < 0.01) break;
      const it = items[i];
      if (it.price === 0) continue;
      const np = it.qty * it.price + rem;
      if (np > 0) { it.qty = applyConditions(it, np / it.price); rem = 0; break; }
    }

  } else if (method === 'pct') {
    const pct = parseFloat(document.getElementById('pctVal').value) || 0;
    const f   = 1 + pct / 100;
    items.forEach((item, i) => {
      if (!item.locked && checked[i] !== false) item.qty = applyConditions(item, item.qty * f);
    });
  }

  /* Guardar en historial */
  history.unshift({ ts: new Date(), method, total: getTotal(), before: totalBefore, snap: snapBefore });
  if (history.length > 10) history.pop();
  renderHistory();

  origQtys = items.map(i => i.qty);
  render();

  const diff = Math.abs(getTotal() - target);
  if (method === 'pct') {
    showToast('Ajuste por porcentaje aplicado.');
  } else {
    showToast(
      diff < 1 ? 'Total cuadrado correctamente.' : 'Ajuste aplicado · Residual: ' + fmtDisp(diff) + ' Bs',
      diff < 1 ? 'ok' : 'warn'
    );
  }
}

function resetQtys() {
  if (origQtys.length === items.length) {
    items.forEach((i, idx) => { i.qty = origQtys[idx]; });
    render();
    showToast('Cantidades restablecidas.');
  }
}

/* ═══════════════════════════════════════════════════
   HISTORIAL
═══════════════════════════════════════════════════ */
const METHOD_LABELS = { prop:'Proporcional', sel:'Seleccionados', big:'Mayor peso', pct:'Porcentaje' };

function renderHistory() {
  const el = document.getElementById('histList');
  if (!history.length) {
    el.innerHTML = '<div class="hist-empty">Sin ajustes aún</div>';
    return;
  }
  el.innerHTML = history.map((h, i) => `
    <div class="hist-item">
      <div>
        <div class="hist-meta">${h.ts.toLocaleTimeString('es-BO')} · ${METHOD_LABELS[h.method] || h.method}</div>
        <div class="hist-prev">Antes: ${fmtDisp(h.before)} Bs</div>
      </div>
      <div class="hist-right">
        <div class="hist-total">${fmtDisp(h.total)} Bs</div>
        <button class="btn btn-sm btn-ghost" onclick="restoreHistory(${i})" title="Restaurar este estado">
          <i class="ti ti-arrow-back-up"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function restoreHistory(i) {
  const h = history[i];
  if (!h || !h.snap) return;
  items    = h.snap.map(it => ({ ...it }));
  origQtys = items.map(it => it.qty);
  checked  = items.map(() => true);
  render();
  showToast('Estado restaurado desde el historial.');
}

function clearHistory() {
  history = [];
  renderHistory();
}

/* ═══════════════════════════════════════════════════
   EXPORTAR EXCEL
═══════════════════════════════════════════════════ */
function exportXlsx() {
  if (!items.length) { showToast('No hay ítems para exportar.', 'err'); return; }

  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const total  = getTotal();
  const proy   = document.getElementById('proyNombre').value;
  const fecha  = new Date().toLocaleDateString('es-BO');

  const data = [
    ['GOBIERNO AUTÓNOMO MUNICIPAL DE COCHABAMBA'],
    ['SECRETARIA DE PLANIFICACIÓN — DIRECCIÓN DE PROYECTOS'],
    ['PROYECTO: ' + proy],
    ['FECHA: ' + fecha + '   |   Decimales: ' + decimals],
    [],
    ['N°', 'Descripción', 'Unid.', 'Cantidad', 'Precio Unit. (Bs)', 'Parcial (Bs)', 'Mín. Cant.', 'Máx. Cant.', 'Bloqueado'],
    ...items.map((it, i) => [
      i + 1,
      it.desc,
      it.unit,
      rawNum(it.qty,   decimals),
      rawNum(it.price, 4),
      rawNum(it.qty * it.price, 2),
      it.minQty  || '—',
      it.maxQty  || '—',
      it.locked  ? 'Sí' : 'No',
    ]),
    [],
    ['', '', '', '', 'TOTAL',          rawNum(total,          2)],
    ['', '', '', '', 'Monto objetivo',  rawNum(target,         2)],
    ['', '', '', '', 'Diferencia',      rawNum(total - target, 2)],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch:4 }, { wch:50 }, { wch:7 }, { wch:12 },
    { wch:18 }, { wch:14 }, { wch:10 }, { wch:10 }, { wch:9 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
  XLSX.writeFile(wb, 'presupuesto_ajustado.xlsx');
  showToast('Archivo Excel generado y descargado.');
}

/* ═══════════════════════════════════════════════════
   EVENTOS GLOBALES
═══════════════════════════════════════════════════ */
document.getElementById('method').addEventListener('change', function() {
  document.getElementById('pctWrap').style.display = this.value === 'pct' ? 'block' : 'none';
});
document.getElementById('targetAmt').addEventListener('input', updateMetrics);

/* ── Iniciar ── */
loadDefault();
renderHistory();
