/* =========================================================
   app.js — Lógica del ajustador de presupuesto
   ========================================================= */

const DEFAULT_ITEMS = [
  { desc: 'INSTALACIÓN DE FAENAS (OBRAS MENORES) HASTA 500.000 BS.', unit: 'glb.', qty: 1.0000,   price: 3850.320 },
  { desc: 'REPLANTEO Y CONTROL TOPOGRÁFICO (LINEAL)',                  unit: 'm',    qty: 264.5900,  price: 7.330    },
  { desc: 'PERFILADO DE SUBRASANTE',                                   unit: 'm²',   qty: 2360.0000, price: 8.740    },
  { desc: 'EMPEDRADO DE VIAS',                                         unit: 'm²',   qty: 2360.0000, price: 46.730   },
  { desc: 'COMPACTADO DE EMPEDRADO CON EQUIPO',                        unit: 'm²',   qty: 2360.0000, price: 4.150    },
  { desc: 'CORDON DE REMATE DE HºCº 50% P.D.',                        unit: 'm',    qty: 34.3000,   price: 176.370  },
  { desc: 'CONFORMACION DE TERRAPLEN PROV. Y COLOC.',                  unit: 'm³',   qty: 342.0700,  price: 97.490   },
  { desc: 'LIMPIEZA GENERAL',                                          unit: 'glb.', qty: 1.0000,    price: 1799.150 },
];

let items    = [];
let origQtys = [];
let checked  = [];

/* ─── Formateo ─── */
function fmt2(n) {
  return (+n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt4(n) {
  return (+n).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

/* ─── Toast ─── */
function showToast(msg, ok = true) {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + (ok ? 'ok' : 'err');
  t.innerHTML = `<i class="ti ${ok ? 'ti-check' : 'ti-alert-circle'}"></i> ${msg}`;
  container.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
}

/* ─── Total ─── */
function getTotal() {
  return items.reduce((s, i) => s + i.qty * i.price, 0);
}

/* ─── Métricas ─── */
function updateMetrics() {
  const total  = getTotal();
  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const diff   = total - target;
  const factor = total > 0 ? target / total : 1;

  document.getElementById('mActual').textContent  = fmt2(total) + ' Bs';
  document.getElementById('mTarget').textContent  = fmt2(target) + ' Bs';
  document.getElementById('mFactor').textContent  = factor.toFixed(5);
  document.getElementById('totalVal').textContent = fmt2(total) + ' Bs';

  const de = document.getElementById('mDiff');
  de.textContent = (diff >= 0 ? '+' : '') + fmt2(diff) + ' Bs';
  de.className   = 'hm-value ' + (Math.abs(diff) < 0.5 ? 'ok' : diff > 0 ? 'bad' : 'warn');
}

/* ─── Render ─── */
function render() {
  const list = document.getElementById('itemsList');
  list.innerHTML = '';

  items.forEach((item, idx) => {
    const p    = item.qty * item.price;
    const col  = idx % 5;
    const isChk = checked[idx] !== false;

    const card = document.createElement('div');
    card.className    = 'item-card';
    card.dataset.color = col;

    card.innerHTML = `
      <div class="item-header">
        <input type="checkbox" ${isChk ? 'checked' : ''} onchange="toggleItem(${idx}, this.checked)"
          aria-label="Seleccionar ítem ${idx + 1}">
        <div class="item-num">${idx + 1}</div>
        <input class="item-desc" type="text"
          value="${item.desc.replace(/"/g, '&quot;')}"
          onchange="upd(${idx}, 'desc', this.value)"
          placeholder="Descripción del ítem">
        <button class="item-del" onclick="delRow(${idx})" aria-label="Eliminar ítem ${idx + 1}">
          <i class="ti ti-x"></i>
        </button>
      </div>
      <div class="item-body">
        <div class="item-field">
          <label>Unidad</label>
          <input type="text" value="${item.unit}" onchange="upd(${idx}, 'unit', this.value)"
            style="text-align:center;">
        </div>
        <div class="item-field">
          <label>Cantidad</label>
          <input type="number" class="r" id="qty${idx}" value="${fmt4(item.qty)}" step="any"
            onchange="upd(${idx}, 'qty', parseFloat(this.value) || 0)">
        </div>
        <div class="item-field full">
          <label>Precio unitario (Bs)</label>
          <input type="number" class="r" value="${item.price}" step="any"
            onchange="upd(${idx}, 'price', parseFloat(this.value) || 0)">
        </div>
        <div class="item-parcial">
          <span class="parcial-lbl">Parcial</span>
          <span class="parcial-val" id="pc${idx}">${fmt2(p)} Bs</span>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  updateMetrics();
}

/* ─── Actualizar campo ─── */
function upd(idx, key, val) {
  items[idx][key] = val;
  const p  = items[idx].qty * items[idx].price;
  const el = document.getElementById('pc' + idx);
  if (el) el.textContent = fmt2(p) + ' Bs';
  updateMetrics();
}

/* ─── Checkbox ─── */
function toggleItem(idx, val) {
  checked[idx] = val;
}
function toggleAll(chk) {
  checked = items.map(() => chk.checked);
  render();
}

/* ─── CRUD ─── */
function addRow() {
  items.push({ desc: 'Nuevo ítem', unit: 'glb.', qty: 1, price: 0 });
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

/* ─── Ajuste ─── */
function calcAjuste() {
  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const method = document.getElementById('method').value;
  const total  = getTotal();

  if (!total || !target) { showToast('Ingresa ítems y monto objetivo.', false); return; }

  if (method === 'prop') {
    const f = target / total;
    items.forEach(i => { i.qty = i.qty * f; });

  } else if (method === 'sel') {
    const fixedT = items.reduce((s, i, idx) => s + (checked[idx] === false ? i.qty * i.price : 0), 0);
    const selT   = items.reduce((s, i, idx) => s + (checked[idx] !== false  ? i.qty * i.price : 0), 0);
    const need   = target - fixedT;
    if (selT > 0 && need > 0) {
      const f = need / selT;
      items.forEach((i, idx) => { if (checked[idx] !== false) i.qty *= f; });
    } else {
      showToast('Sin margen suficiente con los ítems seleccionados.', false);
      return;
    }

  } else { /* big */
    const idxs = checked
      .map((c, i) => c !== false ? i : -1)
      .filter(i => i >= 0)
      .sort((a, b) => items[b].qty * items[b].price - items[a].qty * items[a].price);
    let rem = target - total;
    for (const idx of idxs) {
      if (Math.abs(rem) < 0.01) break;
      const it = items[idx];
      if (it.price === 0) continue;
      const np = it.qty * it.price + rem;
      if (np > 0) { it.qty = np / it.price; rem = 0; break; }
    }
  }

  origQtys = items.map(i => i.qty);
  render();
  const diff = Math.abs(getTotal() - target);
  showToast(diff < 1 ? 'Ajuste aplicado — total cuadrado correctamente.' : `Ajuste aplicado (residual: ${fmt2(diff)} Bs)`, diff < 1);
}

/* ─── Restablecer ─── */
function resetQtys() {
  if (origQtys.length === items.length) {
    items.forEach((i, idx) => { i.qty = origQtys[idx]; });
    render();
    showToast('Cantidades restablecidas.');
  }
}

/* ─── Parsear pegado ─── */
function parseNum(s) {
  if (typeof s === 'number') return s;
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
}

function parsePasted(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const out   = [];
  for (const line of lines) {
    const cols = line.split('\t').map(c => c.trim());
    if (!cols.length) continue;
    let desc = '', unit = 'glb.', qty = 1, price = 0;
    if (cols.length === 1) { desc = cols[0]; }
    else if (cols.length === 2) { desc = cols[0]; qty = parseNum(cols[1]); }
    else if (cols.length === 3) { desc = cols[0]; unit = cols[1]; qty = parseNum(cols[2]); }
    else if (cols.length === 4) { desc = cols[0]; unit = cols[1]; qty = parseNum(cols[2]); price = parseNum(cols[3]); }
    else { desc = cols[0]; unit = cols[1]; qty = parseNum(cols[2]); price = parseNum(cols[3]); }
    if (desc) out.push({ desc, unit, qty: qty || 1, price: price || 0 });
  }
  return out;
}

/* ─── Zona de pegado ─── */
const pasteZone = document.getElementById('pasteZone');
pasteZone.addEventListener('paste', e => {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  if (!text) { showToast('No se detectó contenido para pegar.', false); return; }
  const parsed = parsePasted(text);
  if (!parsed.length) { showToast('No se pudo interpretar la tabla. Verifica el formato.', false); return; }
  items    = [...items, ...parsed];
  origQtys = items.map(i => i.qty);
  checked  = items.map(() => true);
  render();
  showToast(`${parsed.length} ítem(s) importados desde Excel.`);
  pasteZone.blur();
});

/* ─── Exportar Excel ─── */
function exportXlsx() {
  if (!items.length) { showToast('No hay ítems para exportar.', false); return; }
  const target = parseFloat(document.getElementById('targetAmt').value) || 0;
  const total  = getTotal();
  const proy   = document.getElementById('proyNombre').value;

  const data = [
    ['GOBIERNO AUTÓNOMO MUNICIPAL DE COCHABAMBA'],
    ['SECRETARIA DE PLANIFICACIÓN — DIRECCIÓN DE PROYECTOS'],
    [`PROYECTO: ${proy}`],
    [`FECHA: ${new Date().toLocaleDateString('es-BO')}`],
    [],
    ['N°', 'Descripción', 'Unid.', 'Cantidad', 'Precio Unitario (Bs)', 'Parcial (Bs)'],
    ...items.map((i, idx) => [
      idx + 1,
      i.desc,
      i.unit,
      +i.qty.toFixed(4),
      +i.price.toFixed(4),
      +(i.qty * i.price).toFixed(2),
    ]),
    [],
    ['', '', '', '', 'TOTAL',          +total.toFixed(2)],
    ['', '', '', '', 'Monto objetivo',  +target.toFixed(2)],
    ['', '', '', '', 'Diferencia',      +(total - target).toFixed(2)],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 5 }, { wch: 52 }, { wch: 8 }, { wch: 12 }, { wch: 22 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
  XLSX.writeFile(wb, 'presupuesto_ajustado.xlsx');
  showToast('Archivo Excel generado y descargado.');
}

/* ─── Listener monto objetivo ─── */
document.getElementById('targetAmt').addEventListener('input', updateMetrics);

/* ─── Iniciar ─── */
loadDefault();
