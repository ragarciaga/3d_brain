/** @OnlyCurrentDoc */
// Canal de retorno del modo revisión docente (F24, docs/adr/0012, spec 03). Se pega en el editor de
// Apps Script de la hoja del editor y se publica como aplicación web. Este archivo no lleva datos: ni
// ids de hoja, ni direcciones, ni códigos del padrón; el padrón vive solo en la pestaña `Padrón`.
//
// Contrato (lo cumple src/lib/canal.ts):
// - POST (cuerpo text/plain con JSON) {accion: 'leer', r}: {ok, respuestas: {v: 2, r, e}, autorizacion:
//   {version, vago} | null}. Es la forma de la app: el código no viaja en la URL (S4, #162).
// - GET ?accion=leer&r=<código>: la misma respuesta. Se acepta por compatibilidad (pestañas abiertas con
//   la app anterior y la prueba rápida del editor) y se retirará en otro cambio.
// - POST {accion: 'guardar', carga}: {ok, recibidas: [...]}. Exige que la última fila del código en
//   `Autorizaciones` tenga la versión VERSION_AUTORIZACION (S1, #157).
// - POST {accion: 'autorizar', r, version, vago}: {ok}.
// - Un error siempre es {ok: false, error} con error en codigo_no_activo, demasiado_grande, formato,
//   demasiadas_peticiones, sin_autorizacion o interno. Nunca lleva el mensaje de una excepción.
// - El padrón se guarda en CacheService 60 s (S3, #162): un código que pasa a `no`, o uno nuevo, cambia
//   como mucho en un minuto.
// Orden de las comprobaciones: tamaño, JSON, acción, código en el padrón, ritmo, autorización (solo
// guardar), forma de la carga. Leer por POST pasa por las mismas que el GET, sin tomar el bloqueo.
/* global SpreadsheetApp, CacheService, LockService, ContentService */
/* exported doGet, doPost */

// Reglas de validación: copia, regla por regla, de src/lib/revision.ts (REVISOR_VALIDO, CAMPO_VALIDO,
// VERSION_VALIDA, topes, respuestaValida, fechaValida, CLAVES_V2) y de expandirV2 en
// scripts/lib/revisiones.ts (ID_VALIDO). Una prueba pasa los mismos casos a las dos y exige el mismo
// veredicto; si cambias una, cambia la otra.
const REVISOR_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
const CAMPO_VALIDO = /^([a-z_]+(\.\d+)?|trazo:[^\r\n`|<>]{1,120})$/;
const VERSION_VALIDA = /^(\d+\.\d+\.\d+|sin-ficha)$/;
const ID_VALIDO = /^[a-z0-9-]+$/;
const VERSION_AUTORIZACION_VALIDA = /^[A-Za-z0-9._-]{1,40}$/;
// Copia de VERSION_AUTORIZACION de src/config/revision.ts: se cambian juntas, y una prueba de
// tests/apps-script.test.ts falla si difieren. `guardar` exige esta versión en la hoja Autorizaciones (3 desde #168).
const VERSION_AUTORIZACION = '3';
const MAX_TEXTO_LARGO = 4000;
const MAX_TEXTO_CORTO = 200;
const MAX_FECHA = 40;
const VEREDICTOS = ['correcto', 'corregir', 'no_es_mi_area'];
const IDIOMAS = ['es', 'en'];
const CAMPOS_TEXTO = ['campo', 'propuesta', 'comentario', 'version', 'malla', 'ramo'];
const TOPES = { propuesta: MAX_TEXTO_LARGO, comentario: MAX_TEXTO_LARGO, malla: MAX_TEXTO_CORTO, ramo: MAX_TEXTO_CORTO };
const CLAVES_V2 = {
  campo: 'c',
  idioma: 'i',
  veredicto: 'd',
  propuesta: 'p',
  comentario: 'k',
  posicion: 'x',
  malla: 'm',
  ramo: 'a',
  version: 's',
  fecha: 'f',
};
const CLAVES_CORTAS = Object.values(CLAVES_V2);

// Límites del canal.
const MAX_BYTES = 65536;
const MAX_CELDA = 50000; // tope de caracteres de una celda de Sheets
const MAX_PETICIONES_POR_MINUTO = 120;
const ESPERA_BLOQUEO_MS = 10000;
const CLAVE_PADRON = 'padron';
const VIDA_PADRON_S = 60;

const PESTANA_RESPUESTAS = 'Respuestas';
const PESTANA_AUTORIZACIONES = 'Autorizaciones';
const PESTANA_PADRON = 'Padrón';
const ACTIVO = 'sí';

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const esObjeto = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);

function fechaValida(f) {
  return typeof f === 'string' && f.length <= MAX_FECHA && Number.isFinite(Date.parse(f));
}

function respuestaValida(r, idOk) {
  if (!esObjeto(r) || !idOk(r['estructura'])) return false;
  if (!VEREDICTOS.includes(r['veredicto'])) return false;
  if (r['idioma'] !== undefined && !IDIOMAS.includes(r['idioma'])) return false;
  if (typeof r['campo'] !== 'string' || !CAMPO_VALIDO.test(r['campo'])) return false;
  if (typeof r['version'] !== 'string' || !VERSION_VALIDA.test(r['version'])) return false;
  for (const k of CAMPOS_TEXTO) if (r[k] !== undefined && typeof r[k] !== 'string') return false;
  for (const [k, tope] of Object.entries(TOPES)) {
    const v = r[k];
    if (typeof v === 'string' && v.length > tope) return false;
  }
  const p = r['posicion'];
  if (p !== undefined && !(Array.isArray(p) && p.length === 3 && p.every((n) => typeof n === 'number' && Number.isFinite(n)))) return false;
  return true;
}

const idForma = (id) => typeof id === 'string' && ID_VALIDO.test(id);

// Bytes de un texto en UTF-8: 1, 2 o 3 por unidad de código y 4 por par sustituto.
function bytesUtf8(texto) {
  let total = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 0x80) total += 1;
    else if (c < 0x800) total += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < texto.length && texto.charCodeAt(i + 1) >= 0xdc00 && texto.charCodeAt(i + 1) <= 0xdfff) {
      total += 4;
      i++;
    } else total += 3;
  }
  return total;
}

// El objeto que hay en un texto JSON, o null si no es JSON o no es un objeto simple.
function parsearObjeto(texto) {
  if (typeof texto !== 'string') return null;
  try {
    const d = JSON.parse(texto);
    return esObjeto(d) ? d : null;
  } catch {
    return null;
  }
}

// Carga v:2 {"v":2,"r":<código>,"e":{<id>:[{<claves cortas>}]}}. Devuelve {r, e} con cada elemento
// reducido a las claves cortas conocidas (en el orden en que vienen), o null si algo está mal. El
// código se compara aparte, contra el padrón. Una respuesta mala invalida toda la carga.
function validarCarga(texto) {
  const d = parsearObjeto(texto);
  if (!d || d['v'] !== 2) return null;
  const e = d['e'];
  if (!esObjeto(e)) return null;
  const ids = Object.keys(e);
  if (ids.length === 0) return null;
  const limpio = {};
  for (const id of ids) {
    const lista = e[id];
    if (!idForma(id) || !Array.isArray(lista) || lista.length === 0) return null;
    const elementos = [];
    for (const el of lista) {
      if (!esObjeto(el)) return null;
      const corto = {};
      const largo = { estructura: id, fecha: '' };
      for (const [nombre, clave] of Object.entries(CLAVES_V2)) {
        if (hasOwn(el, clave)) largo[nombre] = el[clave];
      }
      for (const clave of Object.keys(el)) {
        if (CLAVES_CORTAS.includes(clave)) corto[clave] = el[clave];
      }
      if (hasOwn(el, CLAVES_V2.fecha) && !fechaValida(el[CLAVES_V2.fecha])) return null;
      if (!respuestaValida(largo, idForma)) return null;
      elementos.push(corto);
    }
    limpio[id] = elementos;
  }
  return { r: d['r'], e: limpio };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fallo(error) {
  return json({ ok: false, error: error });
}

function ahoraIso() {
  return new Date(Date.now()).toISOString();
}

function pestana(nombre) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!hoja) throw new Error('sin_pestana');
  return hoja;
}

// Datos de una pestaña sin la fila de cabecera.
function filasDe(nombre) {
  return pestana(nombre).getDataRange().getValues().slice(1);
}

// Los códigos activos del padrón, en un arreglo de textos. Se guardan en CacheService VIDA_PADRON_S
// segundos (S3, #162) para no leer la hoja en cada petición: un código que pasa a `no`, o uno nuevo,
// cambia como mucho al vencer la caché. Un valor guardado que no sea un arreglo de textos se ignora y se
// lee la hoja; un `put` que falla no rompe la petición. La lista nunca sale en una respuesta ni en un error.
function codigosActivos() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get(CLAVE_PADRON);
  if (typeof guardado === 'string') {
    try {
      const lista = JSON.parse(guardado);
      if (Array.isArray(lista) && lista.every((c) => typeof c === 'string')) return lista;
    } catch {
      // valor dañado: se lee la hoja
    }
  }
  const lista = filasDe(PESTANA_PADRON)
    .filter((fila) => String(fila[2]).trim() === ACTIVO)
    .map((fila) => String(fila[0]).trim());
  try {
    cache.put(CLAVE_PADRON, JSON.stringify(lista), VIDA_PADRON_S);
  } catch {
    // sin caché: la próxima petición lee la hoja otra vez
  }
  return lista;
}

// Activo solo con `sí` exacto (sin espacios sobrantes) en la tercera columna. Igualdad de texto en un
// arreglo, nunca búsqueda de propiedad en un objeto.
function codigoActivo(codigo) {
  return codigosActivos().indexOf(codigo) !== -1;
}

// Cuenta aproximada (CacheService no es atómico): hasta 120 peticiones por código y minuto.
function ritmoPermitido(codigo) {
  const cache = CacheService.getScriptCache();
  const clave = 'ritmo|' + codigo + '|' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(clave)) || 0;
  if (n >= MAX_PETICIONES_POR_MINUTO) return false;
  cache.put(clave, String(n + 1), 60);
  return true;
}

// Error del código (no activo o demasiado ritmo) o null si puede seguir.
function rechazoDeCodigo(codigo) {
  if (typeof codigo !== 'string' || !REVISOR_VALIDO.test(codigo)) return 'codigo_no_activo';
  if (!codigoActivo(codigo)) return 'codigo_no_activo';
  if (!ritmoPermitido(codigo)) return 'demasiadas_peticiones';
  return null;
}

// Agrega las filas al final de la pestaña, con formato de texto simple ('@') antes de escribir para que
// nada de lo recibido se interprete como fórmula. Un escritor a la vez. Devuelve false si no obtiene el
// bloqueo; si falla la escritura lanza, y el bloqueo se libera igual.
function escribir(nombre, filas) {
  const bloqueo = LockService.getScriptLock();
  if (!bloqueo.tryLock(ESPERA_BLOQUEO_MS)) return false;
  try {
    const hoja = pestana(nombre);
    const rango = hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, filas[0].length);
    rango.setNumberFormat('@');
    rango.setValues(filas);
    SpreadsheetApp.flush();
    return true;
  } finally {
    bloqueo.releaseLock();
  }
}

// Una clave `estructura|campo|idioma|fecha` por respuesta recibida.
function clavesRecibidas(e) {
  const claves = [];
  for (const id of Object.keys(e)) {
    for (const el of e[id]) {
      claves.push([id, el.c, el.i === undefined ? '' : el.i, el.f === undefined ? '' : el.f].join('|'));
    }
  }
  return claves;
}

function accionGuardar(codigo, carga) {
  const aut = autorizacionDe(codigo);
  if (!aut || aut.version !== VERSION_AUTORIZACION) return fallo('sin_autorizacion');
  const limpia = validarCarga(carga);
  if (!limpia || limpia.r !== codigo) return fallo('formato');
  const texto = JSON.stringify({ v: 2, r: codigo, e: limpia.e });
  if (texto.length > MAX_CELDA) return fallo('demasiado_grande');
  const fila = [ahoraIso(), codigo, Object.keys(limpia.e).join(','), texto];
  if (!escribir(PESTANA_RESPUESTAS, [fila])) return fallo('interno');
  return json({ ok: true, recibidas: clavesRecibidas(limpia.e) });
}

function accionAutorizar(codigo, cuerpo) {
  const version = cuerpo.version;
  if (typeof version !== 'string' || !VERSION_AUTORIZACION_VALIDA.test(version)) return fallo('formato');
  if (typeof cuerpo.vago !== 'boolean') return fallo('formato');
  const fila = [codigo, ahoraIso(), version, cuerpo.vago ? 'sí' : 'no'];
  if (!escribir(PESTANA_AUTORIZACIONES, [fila])) return fallo('interno');
  return json({ ok: true });
}

function doPost(e) {
  try {
    const contenido = e && e.postData && e.postData.contents;
    if (typeof contenido !== 'string' || contenido === '') return fallo('formato');
    if (bytesUtf8(contenido) > MAX_BYTES) return fallo('demasiado_grande');
    const cuerpo = parsearObjeto(contenido);
    if (!cuerpo) return fallo('formato');
    let codigo;
    if (cuerpo.accion === 'guardar') {
      const cruda = parsearObjeto(cuerpo.carga);
      if (!cruda) return fallo('formato');
      codigo = cruda.r;
    } else if (cuerpo.accion === 'autorizar' || cuerpo.accion === 'leer') {
      codigo = cuerpo.r;
    } else {
      return fallo('formato');
    }
    const rechazo = rechazoDeCodigo(codigo);
    if (rechazo) return fallo(rechazo);
    if (cuerpo.accion === 'guardar') return accionGuardar(codigo, cuerpo.carga);
    if (cuerpo.accion === 'autorizar') return accionAutorizar(codigo, cuerpo);
    return accionLeer(codigo);
  } catch {
    return fallo('interno');
  }
}

// Última respuesta por estructura, campo e idioma de ese código; las filas posteriores pisan a las
// anteriores. Solo cuentan las filas cuya columna B es el código y cuya carga declara el mismo código.
function respuestasDe(codigo) {
  const ultimas = new Map();
  for (const fila of filasDe(PESTANA_RESPUESTAS)) {
    if (String(fila[1]) !== codigo) continue;
    const limpia = validarCarga(fila[3]);
    if (!limpia || limpia.r !== codigo) continue;
    for (const id of Object.keys(limpia.e)) {
      for (const el of limpia.e[id]) {
        ultimas.set(id + '|' + el.c + '|' + (el.i === undefined ? '' : el.i), { id: id, el: el });
      }
    }
  }
  const e = {};
  for (const { id, el } of ultimas.values()) {
    if (!hasOwn(e, id)) e[id] = [];
    e[id].push(el);
  }
  return { v: 2, r: codigo, e: e };
}

// La última fila de Autorizaciones de ese código, o null si no tiene.
function autorizacionDe(codigo) {
  const filas = filasDe(PESTANA_AUTORIZACIONES);
  for (let i = filas.length - 1; i >= 0; i--) {
    if (String(filas[i][0]).trim() === codigo) {
      return { version: String(filas[i][2]), vago: String(filas[i][3]).trim() === ACTIVO };
    }
  }
  return null;
}

// Lo que el canal guarda de un código. Solo lee: no toma el bloqueo ni escribe. Lo usan doPost (forma de
// la app) y doGet (compatibilidad), después de rechazoDeCodigo.
function accionLeer(codigo) {
  return json({ ok: true, respuestas: respuestasDe(codigo), autorizacion: autorizacionDe(codigo) });
}

function doGet(e) {
  try {
    const p = e && e.parameter;
    if (!p || p.accion !== 'leer') return fallo('formato');
    const codigo = p.r;
    const rechazo = rechazoDeCodigo(codigo);
    if (rechazo) return fallo(rechazo);
    return accionLeer(codigo);
  } catch {
    return fallo('interno');
  }
}
