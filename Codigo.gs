// NEGOCIOS DE HACIENDA — página web compartida (Google Apps Script)
// Muestra la página guardada en tu Google Drive y guarda todo en una Planilla de Google:
// pestaña "negocios", pestaña "historial" (quién cambió qué y cuándo) y pestaña "versiones".
// Todos los que abren el link ven y editan lo mismo, sin necesidad de cuenta.

const ARCHIVO = 'negocios-hacienda.html'; // nombre del archivo de la página
// La página se toma de GitHub: cada cambio que haga Claude aparece solo en este mismo link.
const BASE = 'https://raw.githubusercontent.com/MjU2007/negocios-hacienda/main/';
const FUENTE = BASE + ARCHIVO;
const ICONO = BASE + 'icono.png'; // ícono de la pestaña del navegador

// Columnas que se ven en cada pestaña. La última columna ("datos") guarda todo el detalle.
const HOJAS = {
  negocios:  ['id', 'nombre', 'datos', 'creado'],
  historial: ['id', 'fecha', 'quién', 'negocio', 'qué hizo', 'datos'],
  versiones: ['id', 'fecha', 'quién', 'negocio', 'versión', 'datos']
};

function doGet() {
  let html = null;
  try {
    const r = UrlFetchApp.fetch(FUENTE + '?v=' + Math.floor(Date.now() / 60000), { muteHttpExceptions: true });
    if (r.getResponseCode() === 200) html = r.getContentText('UTF-8');
  } catch (e) {}
  if (!html) { // si GitHub no responde, usa la copia de tu Drive (si hay)
    try {
      const it = DriveApp.getFilesByName(ARCHIVO);
      let f = null;
      while (it.hasNext()) {
        const x = it.next();
        if (!x.isTrashed() && (!f || x.getLastUpdated() > f.getLastUpdated())) f = x;
      }
      if (f) html = f.getBlob().getDataAsString('UTF-8');
    } catch (e) {}
  }
  if (!html) {
    return HtmlService.createHtmlOutput('<p style="font:18px sans-serif;padding:24px">No se pudo cargar la página. Probá de nuevo en un rato.</p>');
  }
  libro_(); // crea la planilla de datos la primera vez
  return HtmlService.createHtmlOutput(html)
    .setTitle('Negocios de hacienda')
    .setFaviconUrl(ICONO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// La planilla "Negocios de hacienda (datos)" se crea sola en tu Drive.
function libro_() {
  const p = PropertiesService.getScriptProperties();
  let ss = abrir_(p.getProperty('hoja'));
  if (!ss) {
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      ss = abrir_(p.getProperty('hoja'));
      if (!ss) {
        ss = SpreadsheetApp.create('Negocios de hacienda (datos)');
        ss.getSheets()[0].setName('negocios');
        p.setProperty('hoja', ss.getId());
      }
    } finally {
      lock.releaseLock();
    }
  }
  return ss;
}

// Si la página pide guardar algo nuevo, se crea su pestaña sola (no hace falta tocar este código).
function cols_(nombre) {
  if (!/^[a-z]{1,30}$/.test(String(nombre))) throw new Error('Nombre de pestaña inválido');
  return HOJAS[nombre] || ['id', 'fecha', 'quién', 'negocio', 'detalle', 'datos'];
}

function hoja_(nombre) {
  const ss = libro_();
  let sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  if (sh.getLastRow() === 0) {
    sh.appendRow(cols_(nombre));
    sh.setFrozenRows(1);
  }
  return sh;
}

function abrir_(id) {
  if (!id) return null;
  try { return SpreadsheetApp.openById(id); } catch (e) { return null; }
}

function filas_(sh, n) {
  const last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, n).getValues();
}

function texto_(s, max) {
  s = String(s == null ? '' : s).slice(0, max || 60);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function leer_(nombre) {
  const n = cols_(nombre).length;
  return filas_(hoja_(nombre), n).filter(function (f) { return f[0]; }).map(function (f) {
    let d = {};
    try { d = JSON.parse(f[nombre === 'negocios' ? 2 : n - 1]); } catch (e) {}
    if (nombre === 'negocios') return { id: String(f[0]), name: String(f[1]), st: d, created: Number(f[3]) || 0 };
    d.id = String(f[0]);
    return d;
  });
}

function fila_(nombre, id, b) {
  if (nombre === 'negocios') return [id, texto_(b.name), JSON.stringify(b.st || {}), Number(b.created) || Date.now()];
  const fecha = new Date(Number(b.ultima || b.fecha) || Date.now());
  if (nombre === 'historial') {
    const que = (b.cambios || []).map(function (c) { return c.l + ': ' + c.de + ' → ' + c.a; }).join(' · ') || b.tipo || '';
    return [id, fecha, texto_(b.quien, 30), texto_(b.negName), texto_(que, 500), JSON.stringify(b)];
  }
  if (nombre === 'versiones') return [id, fecha, texto_(b.quien, 30), texto_(b.negName), texto_(b.nombre), JSON.stringify(b)];
  return [id, fecha, texto_(b.quien, 30), texto_(b.negName), texto_(b.texto || b.nombre || '', 500), JSON.stringify(b)];
}

// La página pregunta cada pocos segundos si hubo cambios.
function cambios(rev) {
  const r = PropertiesService.getScriptProperties().getProperty('rev') || '0';
  if (rev === r) return null;
  const data = {};
  const nombres = Object.keys(HOJAS);
  libro_().getSheets().forEach(function (s) { const k = s.getName(); if (/^[a-z]{1,30}$/.test(k) && nombres.indexOf(k) < 0) nombres.push(k); });
  nombres.forEach(function (k) { data[k] = leer_(k); });
  return { rev: r, data: data };
}

function guardar(nombre, id, json) {
  id = String(id).slice(0, 40);
  const fila = fila_(nombre, id, JSON.parse(json));
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja_(nombre);
    const ids = filas_(sh, 1);
    const i = ids.findIndex(function (f) { return String(f[0]) === id; });
    if (i >= 0) sh.getRange(i + 2, 1, 1, fila.length).setValues([fila]);
    else sh.appendRow(fila);
    sube_();
  } finally {
    lock.releaseLock();
  }
  return true;
}

function borrar(nombre, id) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = hoja_(nombre);
    const ids = filas_(sh, 1);
    const i = ids.findIndex(function (f) { return String(f[0]) === String(id); });
    if (i >= 0) sh.deleteRow(i + 2);
    sube_();
  } finally {
    lock.releaseLock();
  }
  return true;
}

function sube_() {
  PropertiesService.getScriptProperties().setProperty('rev', Date.now() + '-' + Math.random().toString(36).slice(2, 6));
}
