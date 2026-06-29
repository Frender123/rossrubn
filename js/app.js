/* ===================================================
   app.js — Ajustador de presupuesto de obra civil
   v4.0 — unidades enteras, diferencia cero exacto,
          recomendaciones, botón limpiar
   =================================================== */

/* ── Unidades que NO admiten decimales (cantidades enteras) ── */
const UNIDADES_ENTERAS = [
  'glb','glb.','global',
  'pza','pza.','pieza','piezas',
  'und','und.','unid','unid.','unidad','unidades',
  'u','un',
  'jgo','jgo.','juego','juegos',
  'lot','lot.','lote','lotes',
  'mes','meses',
  'dia','dia.','días','dias',
  'semana','semanas',
  'viaje','viajes',
  'pto','pto.','punto','puntos',
];

function esUnidadEntera(unit) {
  return UNIDADES_ENTERAS.includes(String(unit).trim().toLowerCase());
}

/** Aplica decimales según la unidad del ítem:
    - unidad entera → Math.round (0 decimales)
    - otras        → decimals globales           */
function redondearSegunUnidad(item, qty) {
  if (esUnidadEntera(item.unit)) return Math.round(qty);
  return rawNum(qty, decimals);
}

/* ── Datos de ejemplo ── */
const DEFAULT_ITEMS = [
  { desc:'INSTALACIÓN DE FAENAS (OBRAS MENORES) HASTA 500.000 BS.', unit:'glb.', qty:1,      price:3850.32, locked:false, minQty:'', maxQty:'' },
  { desc:'REPLANTEO Y CONTROL TOPOGRÁFICO (LINEAL)',                  unit:'m',    qty:264.59, price:7.33,    locked:false, minQty:'', maxQty:'' },
  { desc:'PERFILADO DE SUBRASANTE',                                   unit:'m²',   qty:2360,   price:8.74,    locked:false, minQty:'', maxQty:'' },
  { desc:'EMPEDRADO DE VIAS',                                         unit:'m²',   qty:2360,   price:46.73,   locked:false, minQty:'', maxQty:'' },
  { desc:'COMPACTADO DE EMPEDRADO CON EQUIPO',                        unit:'m²',   qty:2360,   price:4.15,    locked:false, minQty:'', maxQty:'' },
  { desc:'CORDON DE REMATE DE HºCº 50% P.D.',                        unit:'m',    qty:34.3,   price:176.37,  locked:false, minQty:'', maxQty:'' },
  { desc:'CONFORMACION DE TERRAPLEN PROV. Y COLOC.',                  unit:'m³',   qty:342.07, price:97.49,   locked:false, minQty:'', maxQty:'' },
  { desc:'LIMPIEZA GENERAL',                                          unit:'glb.', qty:1,      price:1799.15, locked:false, minQty:'', maxQty:'' },
];

/* ── Estado ── */
let items    = [];
let origQtys = [];
let checked  = [];
let history  = [];
let decimals = 2;

/* ── Estado importación ── */
let fileHeaders = [];
let fileRows    = [];
let fileWb      = null;

/* ═══════════════════════════════════════════════════
   UTILIDADES NUMÉRICAS
═══════════════════════════════════════════════════ */
function rawNum(n, d) {
  return parseFloat((+n).toFixed(d != null ? d : 4));
}

function fmtDisp(n) {
  return (+n).toLocaleString('es-BO', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function detectarFormato(texto) {
  const tokens = texto.match(/\d[\d.,]+\d/g) || [];
  let votoComa = 0, votoPunto = 0;
  for (const t of tokens) {
    const hasDot = t.includes('.'), hasComma = t.includes(',');
    if (!hasDot && !hasComma) continue;
    if (hasDot && hasComma) { t.lastIndexOf(',') > t.lastIndexOf('.') ? votoComa++ : votoPunto++; }
    else if (hasComma) { /,\d{1,2}$/.test(t) ? votoComa++ : votoPunto++; }
    else               { /\.\d{1,2}$/.test(t) ? votoPunto++ : votoComa++; }
  }
  return votoComa >= votoPunto ? 'coma' : 'punto';
}

function parsearNum(s, fmt) {
  if (typeof s === 'number') return isFinite(s) ? s : 0;
  s = String(s).trim(); if (!s) return 0;
  return fmt === 'coma'
    ? parseFloat(s.replace(/\./g,'').replace(',','.')) || 0
    : parseFloat(s.replace(/,/g,''))                  || 0;
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
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 3500);
}

/* ═══════════════════════════════════════════════════
   MODAL DE RECOMENDACIONES
═══════════════════════════════════════════════════ */
function mostrarRecomendacion(diff, target, total, method) {
  // Eliminar modal anterior si existe
  const old = document.getElementById('recomModal');
  if (old) old.remove();

  const absDiff = Math.abs(diff);
  const pct     = total > 0 ? (absDiff / total * 100).toFixed(2) : 0;
  const esMas   = diff > 0; // total > target → hay que bajar

  // Generar recomendaciones según situación
  const recs = [];

  // ¿Hay ítems bloqueados?
  const bloqueados = items.filter(i => i.locked);
  if (bloqueados.length > 0) {
    recs.push({
      icon: 'ti-lock-open',
      color: '#185FA5',
      bg: '#E6F1FB',
      titulo: 'Desbloquear ítems',
      texto: `Tienes ${bloqueados.length} ítem(s) bloqueados. Desbloquearlos permitiría distribuir mejor la diferencia de ${fmtDisp(absDiff)} Bs.`
    });
  }

  // ¿Hay ítems con condiciones muy restrictivas?
  const conConds = items.filter(i => !i.locked && (i.minQty !== '' || i.maxQty !== ''));
  if (conConds.length > 0) {
    recs.push({
      icon: 'ti-adjustments-off',
      color: '#854F0B',
      bg: '#FAEEDA',
      titulo: 'Revisar condiciones mínimas/máximas',
      texto: `${conConds.length} ítem(s) tienen condiciones que limitan el ajuste. Ampliar esos rangos puede ayudar a llegar a cero.`
    });
  }

  // ¿Hay ítems con unidad entera que absorbieron el redondeo?
  const enterosAjustables = items.filter(i => !i.locked && esUnidadEntera(i.unit) && i.price > 0);
  if (enterosAjustables.length > 0) {
    recs.push({
      icon: 'ti-number',
      color: '#534AB7',
      bg: '#EEEDFE',
      titulo: 'Ítems con unidad entera',
      texto: `${enterosAjustables.length} ítem(s) usan unidades enteras (glb., pza., etc.) y no pueden fraccionarse. La diferencia de ${fmtDisp(absDiff)} Bs puede venir del redondeo.`
    });
  }

  // Recomendar método alternativo
  if (method === 'prop') {
    recs.push({
      icon: 'ti-target',
      color: '#0F6E56',
      bg: '#E1F5EE',
      titulo: 'Prueba "Mayor peso absorbe"',
      texto: 'Este método concentra toda la diferencia en el ítem de mayor valor, logrando diferencia cero si ese ítem no tiene restricciones.'
    });
  }
  if (method === 'big' || method === 'sel') {
    recs.push({
      icon: 'ti-percentage',
      color: '#0F6E56',
      bg: '#E1F5EE',
      titulo: 'Prueba el método Proporcional',
      texto: 'El ajuste proporcional distribuye la diferencia entre todos los ítems desbloqueados, reduciendo el impacto individual.'
    });
  }

  // Recomendar ajustar precio unitario
  recs.push({
    icon: 'ti-coin',
    color: '#993C1D',
    bg: '#FAECE7',
    titulo: 'Ajustar precio unitario',
    texto: `Si las cantidades no pueden moverse más, considera revisar el precio unitario del ítem de mayor peso para absorber los ${fmtDisp(absDiff)} Bs restantes.`
  });

  const modal = document.createElement('div');
  modal.id = 'recomModal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.22);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <div style="width:36px;height:36px;background:#FAEEDA;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="ti ti-bulb" style="font-size:20px;color:#854F0B;"></i>
        </div>
        <div>
          <div style="font-size:14px;font-weight:600;color:#1a1a1a;">Diferencia residual: ${fmtDisp(absDiff)} Bs (${pct}%)</div>
          <div style="font-size:12px;color:#6B7280;">No se pudo llegar a cero exacto — aquí te explicamos por qué y qué puedes hacer</div>
        </div>
        <button onclick="cerrarModal()" style="margin-left:auto;background:transparent;border:none;cursor:pointer;font-size:20px;color:#6B7280;padding:4px;">
          <i class="ti ti-x"></i>
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${recs.map(r => `
          <div style="background:${r.bg};border-radius:10px;padding:12px;display:flex;gap:10px;align-items:flex-start;">
            <div style="width:28px;height:28px;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <i class="ti ${r.icon}" style="font-size:16px;color:${r.color};"></i>
            </div>
            <div>
              <div style="font-size:13px;font-weight:600;color:${r.color};margin-bottom:3px;">${r.titulo}</div>
              <div style="font-size:12px;color:#374151;line-height:1.5;">${r.texto}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <button onclick="cerrarModal()" style="width:100%;margin-top:14px;height:40px;background:#085041;color:#9FE1CB;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">
        <i class="ti ti-check"></i> Entendido
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) cerrarModal(); });
}

function cerrarModal() {
  const m = document.getElementById('recomModal');
  if (m) m.remove();
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
═══════════════════════════════════════════════════ */
const fileDrop = document.getElementById('fileDrop');
fileDrop.addEventListener('dragover',  e => { e.preventDefault(); fileDrop.classList.add('drag'); });
fileDrop.addEventListener('dragleave', ()  => fileDrop.classList.remove('drag'));
fileDrop.addEventListener('drop', e => {
  e.preventDefault(); fileDrop.classList.remove('drag');
  const f = e.dataTransfer.files[0]; if (f) handleFile(f);
});

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      fileWb = XLSX.read(data, { type:'array', cellDates:true });
      const ws   = fileWb.Sheets[fileWb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });
      if (!json.length) { showToast('El archivo está vacío.', 'err'); return; }

      let headerRow = 0;
      for (let i = 0; i < Math.min(10, json.length); i++) {
        if (json[i].filter(c => typeof c === 'string' && c.trim().length > 1).length >= 2) {
          headerRow = i; break;
        }
      }
      fileHeaders = json[headerRow].map((h, i) => ({ label: String(h || 'Col '+(i+1)), idx: i }));
      fileRows    = json.slice(headerRow + 1).filter(r => r.some(c => c !== ''));

      document.getElementById('fileNameText').textContent =
        file.name + ' · ' + fileRows.length + ' filas · Hoja: ' + fileWb.SheetNames[0];
      document.getElementById('fileName').classList.add('show');
      populateColMap();
      document.getElementById('colMap').classList.add('show');
    } catch(err) { showToast('Error al leer: ' + err.message, 'err'); }
  };
  reader.readAsArrayBuffer(file);
}

function populateColMap() {
  const keywords = [
    ['desc','descrip','item','nombre','actividad','obra','detalle'],
    ['unid','unidad','ud','um','medida','unit'],
    ['cant','cantidad','qty','volumen'],
    ['precio','unitario','p.u','pu','costo','tarifa'],
  ];
  ['mapDesc','mapUnit','mapQty','mapPrice'].forEach((id, si) => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="-1">— No usar —</option>';
    fileHeaders.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.idx; opt.textContent = h.label;
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
    showToast('Asigna al menos Descripción, Cantidad y Precio.', 'err'); return;
  }
  const newItems = [];
  for (const row of fileRows) {
    const desc = String(row[iDesc] || '').trim(); if (!desc) continue;
    const qty   = parseFloat(row[iQty])  || 0;
    const price = parseFloat(row[iPrc])  || 0;
    const unit  = iUnit >= 0 ? String(row[iUnit] || 'glb.').trim() : 'glb.';
    const qtyFinal = esUnidadEntera(unit) ? Math.round(qty || 1) : (qty || 1);
    newItems.push({ desc, unit, qty: qtyFinal, price, locked:false, minQty:'', maxQty:'' });
  }
  if (!newItems.length) { showToast('No se encontraron datos.', 'err'); return; }
  items    = [...items, ...newItems];
  origQtys = items.map(i => i.qty);
  checked  = items.map(() => true);
  render();
  showToast(newItems.length + ' ítem(s) importados.');
  cancelFile();
}

function cancelFile() {
  document.getElementById('colMap').classList.remove('show');
  document.getElementById('fileName').classList.remove('show');
  document.getElementById('fileInput').value = '';
  fileHeaders = []; fileRows = []; fileWb = null;
}

/* ═══════════════════════════════════════════════════
   PEGAR DESDE EXCEL
═══════════════════════════════════════════════════ */
const pasteZone = document.getElementById('pasteZone');
pasteZone.addEventListener('click',  () => pasteZone.focus());
pasteZone.addEventListener('focus',  () => pasteZone.style.background = 'var(--g100)');
pasteZone.addEventListener('blur',   () => pasteZone.style.background = '');
pasteZone.addEventListener('paste', e => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  if (!text) { showToast('No se detectó contenido.', 'err'); return; }
  const fmt    = detectarFormato(text);
  actualizarBadgeFmt(fmt);
  const parsed = parsePastedText(text, fmt);
  if (!parsed.length) { showToast('No se pudo interpretar la tabla.', 'err'); return; }
  items    = [...items, ...parsed];
  origQtys = items.map(i => i.qty);
  checked  = items.map(() => true);
  render();
  showToast(parsed.length + ' ítem(s) importados · Formato: ' + (fmt === 'coma' ? 'decimal=coma' : 'decimal=punto'));
  pasteZone.blur();
});

function actualizarBadgeFmt(fmt) {
  const badge = document.getElementById('fmtBadge');
  if (!badge) return;
  badge.className = 'fmt-badge ' + (fmt === 'coma' ? 'bo' : 'en');
  badge.textContent = fmt === 'coma' ? 'Decimal = coma  (Ej: 2.360,59)' : 'Decimal = punto (Ej: 2,360.59)';
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
    else { desc = cols[0]; unit = cols[1]; qty = parsearNum(cols[2], fmt); price = parsearNum(cols[3], fmt); }
    if (!desc) continue;
    const qtyFinal = esUnidadEntera(unit) ? Math.round(qty || 1) : (qty || 1);
    out.push({ desc, unit, qty: qtyFinal, price: price || 0, locked:false, minQty:'', maxQty:'' });
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
  document.getElementById('mActual').textContent  = fmtDisp(total)  + ' Bs';
  document.getElementById('mTarget').textContent  = fmtDisp(target) + ' Bs';
  document.getElementById('mFactor').textContent  = factor.toFixed(5);
  document.getElementById('totalVal').textContent = fmtDisp(total)  + ' Bs';
  const de = document.getElementById('mDiff');
  de.textContent = (diff >= 0 ? '+' : '') + fmtDisp(diff) + ' Bs';
  de.className   = 'hm-value ' + (Math.abs(diff) < 0.01 ? 'ok' : diff > 0 ? 'bad' : 'warn');
}

/* ═══════════════════════════════════════════════════
   DECIMALES
═══════════════════════════════════════════════════ */
function setDec(d) {
  decimals = d;
  document.querySelectorAll('.dec-pill').forEach((p, i) => p.classList.toggle('act', i === d));
}

/* ═══════════════════════════════════════════════════
   CONDICIONES
═══════════════════════════════════════════════════ */
function applyConditions(item, newQty) {
  let q = newQty;
  const mn = parseFloat(item.minQty);
  const mx = parseFloat(item.maxQty);
  if (!isNaN(mn) && q < mn) q = mn;
  if (!isNaN(mx) && q > mx) q = mx;
  return redondearSegunUnidad(item, q);
}

/* ═══════════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════════ */
function render() {
  const list = document.getElementById('itemsList');
  list.innerHTML = '';
  items.forEach((item, idx) => {
    const p     = item.qty * item.price;
    const col   = idx % 5;
    const isChk = checked[idx] !== false;
    const isInt = esUnidadEntera(item.unit);

    const card = document.createElement('div');
    card.className     = 'item-card';
    card.dataset.color = col;

    card.innerHTML = `
      <div class="item-header">
        <input type="checkbox" ${isChk ? 'checked' : ''}
          onchange="toggleItem(${idx}, this.checked)" aria-label="Ítem ${idx+1}">
        <div class="item-num">${idx+1}</div>
        <input class="item-desc" type="text"
          value="${item.desc.replace(/"/g,'&quot;')}"
          onchange="updField(${idx},'desc',this.value)"
          placeholder="Descripción del ítem">
        <div class="item-badges">
          ${item.locked ? '<span class="badge-lock"><i class="ti ti-lock"></i> Bloqueado</span>' : ''}
          ${isInt       ? '<span class="badge-int" title="Unidad entera — sin decimales">N°</span>' : ''}
          ${item.price === 0 ? '<span class="badge-warn">⚠ precio 0</span>' : ''}
        </div>
        <div class="item-icons">
          <button class="icon-btn ${item.locked ? 'active' : ''}"
            onclick="toggleLock(${idx})"
            title="${item.locked ? 'Desbloquear' : 'Bloquear'}">
            <i class="ti ti-${item.locked ? 'lock' : 'lock-open'}"></i>
          </button>
          <button class="icon-btn del" onclick="delRow(${idx})" aria-label="Eliminar">
            <i class="ti ti-x"></i>
          </button>
        </div>
      </div>
      <div class="item-body">
        <div class="ifield">
          <label>Unidad</label>
          <input type="text" value="${item.unit}"
            onchange="updUnit(${idx}, this.value)"
            style="text-align:center;"
            ${item.locked ? 'readonly' : ''}>
        </div>
        <div class="ifield">
          <label>Cantidad ${isInt ? '<span style="color:#534AB7;font-size:9px;">(entero)</span>' : ''}</label>
          <input type="number" class="r" id="qty${idx}"
            value="${rawNum(item.qty, isInt ? 0 : 4)}"
            step="${isInt ? '1' : 'any'}"
            ${isInt ? 'min="1"' : ''}
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
          <input type="number" value="${item.minQty}" step="${isInt?'1':'any'}"
            placeholder="Sin mín." onchange="updField(${idx},'minQty',this.value)">
        </div>
        <div class="cond-field">
          <label>≤ Cantidad máxima</label>
          <input type="number" value="${item.maxQty}" step="${isInt?'1':'any'}"
            placeholder="Sin máx." onchange="updField(${idx},'maxQty',this.value)">
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
   CRUD
═══════════════════════════════════════════════════ */
function updField(idx, key, val) {
  items[idx][key] = val;
  if (key === 'price') refreshParcial(idx);
  updateMetrics();
}

function updUnit(idx, val) {
  items[idx].unit = val;
  // Si cambia a unidad entera, redondear cantidad actual
  if (esUnidadEntera(val)) {
    items[idx].qty = Math.round(items[idx].qty);
    const inp = document.getElementById('qty' + idx);
    if (inp) { inp.value = items[idx].qty; inp.step = '1'; }
  } else {
    const inp = document.getElementById('qty' + idx);
    if (inp) inp.step = 'any';
  }
  refreshParcial(idx);
  updateMetrics();
}

function updQty(idx, val) {
  let q = parseFloat(val) || 0;
  if (esUnidadEntera(items[idx].unit)) q = Math.round(q);
  items[idx].qty = q;
  // Corregir el input si se escribió decimal en unidad entera
  const inp = document.getElementById('qty' + idx);
  if (inp && esUnidadEntera(items[idx].unit)) inp.value = q;
  refreshParcial(idx);
  updateMetrics();
}

function toggleItem(idx, val) { checked[idx] = val; }
function toggleAll(chk) { checked = items.map(() => chk.checked); render(); }
function toggleLock(idx) { items[idx].locked = !items[idx].locked; render(); }

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

/* ── NUEVO: Limpiar todos los ítems ── */
function limpiarItems() {
  if (!items.length) { showToast('No hay ítems que limpiar.', 'warn'); return; }
  if (!confirm('¿Limpiar todos los ítems? Esta acción no se puede deshacer.')) return;
  items    = [];
  origQtys = [];
  checked  = [];
  render();
  showToast('Lista limpiada. Puedes importar o agregar ítems nuevos.');
}

/* ═══════════════════════════════════════════════════
   AJUSTE
═══════════════════════════════════════════════════ */
function calcAjuste() {
  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const method = document.getElementById('method').value;
  const total  = getTotal();

  if (!items.length)               { showToast('Agrega ítems primero.', 'err'); return; }
  if (!target && method !== 'pct') { showToast('Ingresa un monto objetivo.', 'err'); return; }

  const zeros = items.filter(i => i.price === 0 && !i.locked);
  if (zeros.length) showToast(zeros.length + ' ítem(s) con precio cero.', 'warn');

  const snapBefore  = items.map(it => ({ ...it }));
  const totalBefore = total;

  /* ── PASO 1: Ajuste principal ── */
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
      showToast('Sin margen con los ítems seleccionados.', 'err'); return;
    }

  } else if (method === 'big') {
    const idxs = items
      .map((it, i) => (!it.locked && checked[i] !== false) ? i : -1)
      .filter(i => i >= 0)
      .sort((a, b) => items[b].qty * items[b].price - items[a].qty * items[a].price);
    let rem = target - total;
    for (const i of idxs) {
      if (Math.abs(rem) < 0.01) break;
      const it = items[i]; if (it.price === 0) continue;
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

  /* ── PASO 2: Garantizar diferencia CERO ──────────────────────────────
     Después del ajuste principal puede quedar residuo por:
       - redondeo a entero en unidades glb./pza./etc.
       - condiciones min/max que limitan el movimiento
     
     Estrategia en orden de prioridad:
     1. Distribuir residuo en ítems decimales (los que admiten fracción)
     2. Si no hay decimales disponibles, absorber en precio unitario del mayor peso
     3. Siempre se llega a cero exacto
  ──────────────────────────────────────────────────────────────────── */
  if (method !== 'pct') {
    let residuo = rawNum(target - getTotal(), 2);

    if (Math.abs(residuo) >= 0.01) {

      /* Candidatos: no bloqueados, precio > 0, participan en el ajuste */
      const candidatos = items
        .map((it, i) => i)
        .filter(i => !items[i].locked && items[i].price > 0 &&
                     (method === 'prop' || checked[i] !== false));

      /* Intento 1 — ítems que admiten decimales, ordenados por mayor peso */
      const decimales = candidatos
        .filter(i => !esUnidadEntera(items[i].unit))
        .sort((a, b) => items[b].qty * items[b].price - items[a].qty * items[a].price);

      for (const i of decimales) {
        if (Math.abs(residuo) < 0.005) break;
        const it     = items[i];
        const maxMov = it.qty * it.price + residuo; // parcial nuevo
        if (maxMov > 0) {
          const qNueva = rawNum(maxMov / it.price, decimals);
          /* Verificar condiciones */
          const mn = parseFloat(it.minQty), mx = parseFloat(it.maxQty);
          let qFinal = qNueva;
          if (!isNaN(mn) && qFinal < mn) qFinal = mn;
          if (!isNaN(mx) && qFinal > mx) qFinal = mx;
          residuo = rawNum(residuo - (qFinal - it.qty) * it.price, 2);
          it.qty  = qFinal;
        }
      }

      /* Intento 2 — si aún queda residuo, ajustar precio unitario del ítem de mayor peso */
      if (Math.abs(residuo) >= 0.01) {
        const porPeso = candidatos
          .sort((a, b) => items[b].qty * items[b].price - items[a].qty * items[a].price);

        for (const i of porPeso) {
          if (Math.abs(residuo) < 0.005) break;
          const it = items[i];
          if (it.qty === 0) continue;
          const pNuevo = rawNum((it.qty * it.price + residuo) / it.qty, 4);
          if (pNuevo > 0) {
            residuo     = rawNum(residuo - (pNuevo - it.price) * it.qty, 2);
            it.price    = pNuevo;
            it._precioAjustado = true; // marcar para avisar al usuario
          }
        }
      }
    }
  }

  /* ── Guardar historial y renderizar ── */
  history.unshift({ ts: new Date(), method, total: getTotal(), before: totalBefore, snap: snapBefore });
  if (history.length > 10) history.pop();
  renderHistory();

  origQtys = items.map(i => i.qty);
  render();

  /* ── Mensaje final ── */
  const diffFinal = Math.abs(getTotal() - target);
  const preciosAjustados = items.filter(i => i._precioAjustado);
  // Limpiar flags
  items.forEach(i => delete i._precioAjustado);

  if (method === 'pct') {
    showToast('Ajuste por porcentaje aplicado. Total: ' + fmtDisp(getTotal()) + ' Bs');
  } else if (diffFinal < 0.01) {
    if (preciosAjustados.length > 0) {
      showToast(
        '¡Monto objetivo logrado! Se ajustó el precio unitario de "' +
        preciosAjustados[0].desc.substring(0, 30) + '..." para cuadrar exactamente.',
        'ok'
      );
    } else {
      showToast('¡Diferencia cero! Monto objetivo logrado exactamente.');
    }
  } else {
    /* Caso extremo: todos bloqueados o condiciones imposibles */
    showToast('No fue posible llegar al objetivo — revisa bloqueos y condiciones.', 'err');
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
  if (!history.length) { el.innerHTML = '<div class="hist-empty">Sin ajustes aún</div>'; return; }
  el.innerHTML = history.map((h, i) => `
    <div class="hist-item">
      <div>
        <div class="hist-meta">${h.ts.toLocaleTimeString('es-BO')} · ${METHOD_LABELS[h.method] || h.method}</div>
        <div class="hist-prev">Antes: ${fmtDisp(h.before)} Bs</div>
      </div>
      <div class="hist-right">
        <div class="hist-total">${fmtDisp(h.total)} Bs</div>
        <button class="btn btn-sm btn-ghost" onclick="restoreHistory(${i})" title="Restaurar">
          <i class="ti ti-arrow-back-up"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function restoreHistory(i) {
  const h = history[i]; if (!h || !h.snap) return;
  items    = h.snap.map(it => ({ ...it }));
  origQtys = items.map(it => it.qty);
  checked  = items.map(() => true);
  render();
  showToast('Estado restaurado desde el historial.');
}

function clearHistory() { history = []; renderHistory(); }

/* ═══════════════════════════════════════════════════
   EXPORTAR EXCEL
═══════════════════════════════════════════════════ */
function exportXlsx() {
  if (!items.length) { showToast('No hay ítems para exportar.', 'err'); return; }
  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const total  = getTotal();
  const proy   = document.getElementById('proyNombre').value;
  const data = [
    ['GOBIERNO AUTÓNOMO MUNICIPAL DE COCHABAMBA'],
    ['SECRETARIA DE PLANIFICACIÓN — DIRECCIÓN DE PROYECTOS'],
    ['PROYECTO: ' + proy],
    ['FECHA: ' + new Date().toLocaleDateString('es-BO') + '   |   Decimales: ' + decimals],
    [],
    ['N°','Descripción','Unid.','Cantidad','Precio Unit. (Bs)','Parcial (Bs)','Mín.','Máx.','Bloqueado'],
    ...items.map((it, i) => [
      i+1, it.desc, it.unit,
      esUnidadEntera(it.unit) ? Math.round(it.qty) : rawNum(it.qty, decimals),
      rawNum(it.price, 4),
      rawNum(it.qty * it.price, 2),
      it.minQty || '—', it.maxQty || '—',
      it.locked ? 'Sí' : 'No',
    ]),
    [],
    ['','','','','TOTAL',         rawNum(total,          2)],
    ['','','','','Monto objetivo', rawNum(target,         2)],
    ['','','','','Diferencia',     rawNum(total - target, 2)],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{wch:4},{wch:50},{wch:7},{wch:12},{wch:18},{wch:14},{wch:8},{wch:8},{wch:9}];
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
  XLSX.writeFile(wb, 'presupuesto_ajustado.xlsx');
  showToast('Excel generado y descargado.');
}

/* ═══════════════════════════════════════════════════
   EVENTOS
═══════════════════════════════════════════════════ */
document.getElementById('method').addEventListener('change', function() {
  document.getElementById('pctWrap').style.display = this.value === 'pct' ? 'block' : 'none';
});
document.getElementById('targetAmt').addEventListener('input', updateMetrics);

loadDefault();
renderHistory();
