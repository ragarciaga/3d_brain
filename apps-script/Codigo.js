/** @OnlyCurrentDoc */
// Canal de retorno del modo revisión docente (F24, docs/adr/0012, spec 03). Se pega en el editor de
// Apps Script de la hoja del editor y se publica como aplicación web. Este archivo no lleva datos: ni
// ids de hoja, ni más dirección que la del sitio público (SITIO), ni códigos del padrón; el padrón vive solo en la
// pestaña `Padrón`.
//
// Contrato (lo cumple src/lib/canal.ts):
// - POST (cuerpo text/plain con JSON) {accion: 'leer', r}: {ok, canal, respuestas: {v: 2, r, e}, retiradas:
//   {v: 2, r, e}, autorizacion: {version, vago} | null}. Es la forma de la app: el código no viaja en la URL
//   (S4, #162). `canal` es VERSION_CANAL: dice a la app que este script entiende los retiros (#217).
//   `respuestas` no trae las claves cuya última fila es un retiro; `retiradas` trae esos retiros.
// - GET: siempre {ok: false, error: 'formato'}, sin leer nada ni mirar los parámetros (S4, #169). Se
//   deja para que todo GET reciba JSON.
// - POST {accion: 'guardar', carga}: {ok, recibidas: [...]}. Exige que la última fila del código en
//   `Autorizaciones` tenga la versión VERSION_AUTORIZACION (S1, #157). Si esa fila no tiene el vago en
//   `sí`, rechaza con `formato` la carga entera cuando alguna respuesta es del vago (S2, #166). Un retiro
//   (#217) es un elemento {c, i?, d: "", f} que quita la marca de esa clave: la hoja solo agrega filas y la
//   última por clave manda. No lleva propuesta ni comentario (solo la clave y la fecha) y no cuenta para la
//   casilla del vago. Una carga con la misma clave como retiro y como veredicto da `formato`.
// - POST {accion: 'autorizar', r, version, vago}: {ok}. `version` debe ser VERSION_AUTORIZACION; otra
//   da `formato` y no escribe (#169).
// - Un error siempre es {ok: false, error} con error en codigo_no_activo, demasiado_grande, formato,
//   demasiadas_peticiones, sin_autorizacion o interno. Nunca lleva el mensaje de una excepción.
// - El padrón se guarda en CacheService 60 s (S3, #162): un código que pasa a `no`, o uno nuevo escrito a
//   mano, cambia como mucho en un minuto. Los que crea el menú vacían esa caché al escribir.
// Orden de las comprobaciones: tamaño, JSON, acción, código en el padrón, ritmo, autorización (solo
// guardar), forma de la carga, casilla del vago (solo guardar), tamaño de la celda; en autorizar, forma
// y versión. Leer pasa por las del código, sin tomar el bloqueo.
// Menú "Maysa Brain" de la hoja (#257): "Crear revisor" y "Crear revisores…" agregan filas a la pestaña
// `Padrón` con un código nuevo, el alias siguiente y Activo `sí`, bajo el mismo bloqueo que `escribir`, y
// muestran el enlace personal en un aviso. Según la documentación de Google corren con el código guardado, no con la
// versión implementada (lo confirma a mano el editor, prueba manual de #257).
// El código solo sale en la fila y en ese aviso: nunca en un registro ni en el texto de un error.
/* global SpreadsheetApp, CacheService, LockService, ContentService, Utilities */
/* exported doGet, doPost, onOpen, crearRevisor, crearRevisores */

// Reglas de validación: copia, regla por regla, de src/lib/revision.ts (REVISOR_VALIDO, CAMPO_VALIDO,
// VERSION_VALIDA, topes, respuestaValida, retiroValido, fechaValida, CLAVES_V2) y de expandirV2 en
// scripts/lib/revisiones.ts (ID_VALIDO), y esRespuestaDelVago es copia de la del mismo archivo. Una
// prueba pasa los mismos casos a las dos y exige el mismo veredicto; si cambias una, cambia la otra.
const REVISOR_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
const CAMPO_VALIDO = /^([a-z_]+(\.\d+)?|trazo:[^\r\n`|<>]{1,120})$/;
const VERSION_VALIDA = /^(\d+\.\d+\.\d+|sin-ficha)$/;
const ID_VALIDO = /^[a-z0-9-]+$/;
const VERSION_AUTORIZACION_VALIDA = /^[A-Za-z0-9._-]{1,40}$/;
// Copia de VERSION_AUTORIZACION de src/config/revision.ts: se cambian juntas, y una prueba de
// tests/apps-script.test.ts falla si difieren. `guardar` exige esta versión en la hoja Autorizaciones (3 desde #168).
const VERSION_AUTORIZACION = '3';
// Copia de VERSION_CANAL de src/config/revision.ts (el protocolo con retiros, #217): se cambian juntas, y una
// prueba de tests/apps-script.test.ts falla si difieren. `leer` la responde en `canal`.
const VERSION_CANAL = 2;
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

// Revisores nuevos (#257). El sitio es público (ADR 0014); es el único URL de este archivo.
const SITIO = 'https://brain.maysasp.com';
// Letras y dígitos sin los que se confunden al dictar o copiar (0/O, 1/I/L): 31 símbolos, unos 49,5 bits en 10.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO_CODIGO = 10;
const MAX_INTENTOS_CODIGO = 100;
const MAX_ALIAS = 999;
const MAX_REVISORES_POR_VEZ = 30;
const ALIAS_PADRON = /^D(\d{2,3})$/;

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

// Campos de una respuesta que un retiro no admite: ni propuesta ni comentario, ni posición, ni datos del trazo, ni versión.
const CAMPOS_PROHIBIDOS_EN_RETIRO = ['propuesta', 'comentario', 'posicion', 'malla', 'ramo', 'version'];

// Un retiro (#217) solo vale con estructura conocida, veredicto '', campo con la forma de la app, idioma es o en
// (o ausente), fecha válida y obligatoria, y ninguno de los campos prohibidos.
function retiroValido(r, idOk) {
  if (!esObjeto(r) || !idOk(r['estructura'])) return false;
  if (r['veredicto'] !== '') return false;
  if (r['idioma'] !== undefined && !IDIOMAS.includes(r['idioma'])) return false;
  if (typeof r['campo'] !== 'string' || !CAMPO_VALIDO.test(r['campo'])) return false;
  if (!fechaValida(r['fecha'])) return false;
  for (const k of CAMPOS_PROHIBIDOS_EN_RETIRO) if (r[k] !== undefined) return false;
  return true;
}

const idForma = (id) => typeof id === 'string' && ID_VALIDO.test(id);

// Un elemento con claves cortas es un retiro si su veredicto (d) es el texto vacío.
const esRetiro = (el) => hasOwn(el, CLAVES_V2.veredicto) && el[CLAVES_V2.veredicto] === '';

// Una respuesta es del vago si su campo empieza por `trazo:` o `trazado_`, o si trae malla o ramo. Recibe
// un elemento con claves cortas (c, m, a).
function esRespuestaDelVago(el) {
  if (typeof el.c === 'string' && (el.c.indexOf('trazo:') === 0 || el.c.indexOf('trazado_') === 0)) return true;
  return hasOwn(el, 'm') || hasOwn(el, 'a');
}

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
    // Clave `c|i` de cada elemento a si es retiro: la misma clave como retiro y como veredicto invalida la carga.
    const tipos = new Map();
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
      const retiro = esRetiro(el);
      if (!(retiro ? retiroValido(largo, idForma) : respuestaValida(largo, idForma))) return null;
      const clave = largo.campo + '|' + (largo.idioma === undefined ? '' : largo.idioma);
      if (tipos.has(clave) && tipos.get(clave) !== retiro) return null;
      tipos.set(clave, retiro);
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

// Agrega las filas al final de la hoja, con formato de texto simple ('@') antes de escribir para que
// nada de lo recibido se interprete como fórmula. El llamador ya tiene el bloqueo.
function agregarFilas(hoja, filas) {
  const rango = hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, filas[0].length);
  rango.setNumberFormat('@');
  rango.setValues(filas);
}

// Agrega las filas al final de la pestaña. Un escritor a la vez. Devuelve false si no obtiene el
// bloqueo; si falla la escritura lanza, y el bloqueo se libera igual.
function escribir(nombre, filas) {
  const bloqueo = LockService.getScriptLock();
  if (!bloqueo.tryLock(ESPERA_BLOQUEO_MS)) return false;
  try {
    agregarFilas(pestana(nombre), filas);
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
  // Un retiro no lleva contenido (#217): no cuenta para la casilla del vago, aunque su campo sea un trazo.
  if (!aut.vago && Object.keys(limpia.e).some((id) => limpia.e[id].some((el) => !esRetiro(el) && esRespuestaDelVago(el)))) return fallo('formato');
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
  if (version !== VERSION_AUTORIZACION) return fallo('formato');
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

// Agrupa los elementos por estructura en la forma `e` de la carga.
function agrupar(elementos) {
  const e = {};
  for (const { id, el } of elementos.values()) {
    if (!hasOwn(e, id)) e[id] = [];
    e[id].push(el);
  }
  return e;
}

// Última fila por estructura, campo e idioma de ese código; las filas posteriores pisan a las anteriores. Si la
// última es un retiro (#217), la clave sale en `retiradas` y no en `respuestas`; un veredicto posterior al retiro
// vuelve a `respuestas`. Solo cuentan las filas cuya columna B es el código y cuya carga declara el mismo código.
function respuestasDe(codigo) {
  const ultimas = new Map();
  const retiradas = new Map();
  for (const fila of filasDe(PESTANA_RESPUESTAS)) {
    if (String(fila[1]) !== codigo) continue;
    const limpia = validarCarga(fila[3]);
    if (!limpia || limpia.r !== codigo) continue;
    for (const id of Object.keys(limpia.e)) {
      for (const el of limpia.e[id]) {
        const clave = id + '|' + el.c + '|' + (el.i === undefined ? '' : el.i);
        if (esRetiro(el)) {
          ultimas.delete(clave);
          retiradas.set(clave, { id: id, el: el });
        } else {
          retiradas.delete(clave);
          ultimas.set(clave, { id: id, el: el });
        }
      }
    }
  }
  return { respuestas: { v: 2, r: codigo, e: agrupar(ultimas) }, retiradas: { v: 2, r: codigo, e: agrupar(retiradas) } };
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

// Lo que el canal guarda de un código. Solo lee: no toma el bloqueo ni escribe. Lo usa doPost, después de
// rechazoDeCodigo.
function accionLeer(codigo) {
  const guardado = respuestasDe(codigo);
  return json({ ok: true, canal: VERSION_CANAL, respuestas: guardado.respuestas, retiradas: guardado.retiradas, autorizacion: autorizacionDe(codigo) });
}

// El GET ya no lee (S4, #169): responde el error del contrato sin mirar parámetros, padrón, caché ni
// hojas. Se deja para que todo GET reciba JSON.
function doGet() {
  return fallo('formato');
}

// ---------------------------------------------------------------------------------------------
// Revisores nuevos desde el menú (#257).
// ---------------------------------------------------------------------------------------------

// Entero en [0, max) con max entre 1 y 256, de los bytes de un SHA-256 de dos UUID aleatorios. Cada
// llamada pide un resumen nuevo y usa un solo byte (nunca reutiliza los de otra llamada). Un byte
// de 256 - (256 % max) en adelante se rechaza para no sesgar el resultado. No se usa el generador del motor de JavaScript.
function azarSeguro(max) {
  if (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > 256) throw new Error('azar_invalido');
  const limite = 256 - (256 % max);
  for (let vuelta = 0; vuelta < MAX_INTENTOS_CODIGO; vuelta++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i] & 0xff; // computeDigest devuelve bytes con signo
      if (b < limite) return b % max;
    }
  }
  throw new Error('azar_agotado');
}

// Un código de LARGO_CODIGO símbolos que no está en `existentes` (toda la columna A del padrón, activos o
// no). `azar(max)` da un entero en [0, max). Lanza tras MAX_INTENTOS_CODIGO intentos repetidos. Compara con
// indexOf en un arreglo, nunca con una búsqueda de propiedad.
function crearCodigo(azar, existentes) {
  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento++) {
    let codigo = '';
    for (let i = 0; i < LARGO_CODIGO; i++) {
      const k = azar(ALFABETO_CODIGO.length);
      if (typeof k !== 'number' || !Number.isInteger(k) || k < 0 || k >= ALFABETO_CODIGO.length) throw new Error('azar_invalido');
      codigo += ALFABETO_CODIGO.charAt(k);
    }
    if (existentes.indexOf(codigo) === -1) return codigo;
  }
  throw new Error('sin_codigo');
}

// El alias que sigue al mayor de `aliases`: dos dígitos hasta 99 y tres desde 100. Ignora lo que no tenga
// la forma de un alias. Lanza si pasaría del tope.
function aliasSiguiente(aliases) {
  let mayor = 0;
  for (let i = 0; i < aliases.length; i++) {
    const m = ALIAS_PADRON.exec(String(aliases[i]).trim());
    if (m && Number(m[1]) > mayor) mayor = Number(m[1]);
  }
  const n = mayor + 1;
  if (n > MAX_ALIAS) throw new Error('sin_alias');
  return 'D' + (n < 10 ? '0' + n : String(n));
}

const AVISO_FALLO = 'No se creó ningún revisor. Revisa que la pestaña Padrón exista y vuelve a intentarlo; si sigue igual, agrega la fila a mano.';
const AVISO_SIN_ALIAS = 'No se creó ningún revisor: ya no quedan alias libres (el tope es el 999). Avísalo por chat antes de seguir.';
const AVISO_SIN_CODIGO = 'No se creó ningún revisor: no se pudo generar un código nuevo. Vuelve a intentarlo; si sigue igual, avísalo por chat.';
const AVISO_OCUPADO = 'No se creó ningún revisor: la hoja está ocupada. Espera unos segundos y vuelve a intentarlo.';
const AVISO_REVISAR = 'La fila se escribió, pero algo falló después. Revisa la última fila de la pestaña Padrón antes de volver a intentarlo.';
const AVISO_PRIVADO =
  'Este enlace es personal: mándalo solo por un canal privado, a una persona. No lo pegues en un issue, un chat público ni un documento compartido.';

// Crea `cantidad` filas [código, alias, Activo] al final de la pestaña Padrón con el bloqueo tomado,
// escribe, vacía la caché del padrón (para que el código nuevo sirva de inmediato) y libera el bloqueo.
// Devuelve {nuevos: [{codigo, alias}]} o {aviso} con un texto fijo: nunca el mensaje de una excepción ni un código.
function crearEnPadron(cantidad) {
  const bloqueo = LockService.getScriptLock();
  let tomado = false;
  let escrito = false;
  try {
    tomado = bloqueo.tryLock(ESPERA_BLOQUEO_MS);
    if (!tomado) return { aviso: AVISO_OCUPADO };
    const hoja = pestana(PESTANA_PADRON);
    const filas = hoja.getDataRange().getValues().slice(1);
    const codigos = filas.map((fila) => String(fila[0]).trim());
    const aliases = filas.map((fila) => String(fila[1]).trim());
    const nuevos = [];
    for (let i = 0; i < cantidad; i++) {
      const codigo = crearCodigo(azarSeguro, codigos);
      const alias = aliasSiguiente(aliases);
      codigos.push(codigo);
      aliases.push(alias);
      nuevos.push({ codigo: codigo, alias: alias });
    }
    agregarFilas(hoja, nuevos.map((n) => [n.codigo, n.alias, ACTIVO]));
    escrito = true;
    SpreadsheetApp.flush();
    try {
      CacheService.getScriptCache().remove(CLAVE_PADRON);
    } catch {
      // sin caché que vaciar: el código nuevo sirve al vencer los VIDA_PADRON_S segundos
    }
    return { nuevos: nuevos };
  } catch (e) {
    // El mensaje de la excepción solo escoge entre textos fijos: nunca se muestra.
    const causa = e && typeof e.message === 'string' ? e.message : '';
    if (escrito) return { aviso: AVISO_REVISAR };
    if (causa === 'sin_alias') return { aviso: AVISO_SIN_ALIAS };
    if (causa === 'sin_codigo' || causa === 'azar_agotado' || causa === 'azar_invalido') return { aviso: AVISO_SIN_CODIGO };
    return { aviso: AVISO_FALLO };
  } finally {
    if (tomado) bloqueo.releaseLock();
  }
}

function enlaceDe(codigo) {
  return SITIO + '/es/revision?r=' + codigo;
}

// Un revisor: crea la fila y muestra su enlace. El bloqueo ya se liberó cuando sale el aviso.
function crearRevisor() {
  const ui = SpreadsheetApp.getUi();
  const res = crearEnPadron(1);
  if (res.aviso) {
    ui.alert('Crear revisor', res.aviso, ui.ButtonSet.OK);
    return;
  }
  const nuevo = res.nuevos[0];
  ui.alert('Revisor ' + nuevo.alias, enlaceDe(nuevo.codigo) + '\n\n' + AVISO_PRIVADO, ui.ButtonSet.OK);
}

// Varios a la vez: pregunta cuántos (1 a MAX_REVISORES_POR_VEZ). Cancelar o un valor inválido no escribe nada.
function crearRevisores() {
  const ui = SpreadsheetApp.getUi();
  const pregunta = ui.prompt('Crear revisores', '¿Cuántos revisores quieres crear? (de 1 a ' + MAX_REVISORES_POR_VEZ + ')', ui.ButtonSet.OK_CANCEL);
  if (pregunta.getSelectedButton() !== ui.Button.OK) return;
  const texto = String(pregunta.getResponseText()).trim();
  const n = /^\d{1,2}$/.test(texto) ? Number(texto) : 0;
  if (n < 1 || n > MAX_REVISORES_POR_VEZ) {
    ui.alert('Crear revisores', 'No se creó ningún revisor: escribe un número entero de 1 a ' + MAX_REVISORES_POR_VEZ + '.', ui.ButtonSet.OK);
    return;
  }
  const res = crearEnPadron(n);
  if (res.aviso) {
    ui.alert('Crear revisores', res.aviso, ui.ButtonSet.OK);
    return;
  }
  const lineas = res.nuevos.map((x) => x.alias + ': ' + enlaceDe(x.codigo));
  ui.alert('Revisores creados', lineas.join('\n') + '\n\n' + AVISO_PRIVADO, ui.ButtonSet.OK);
}

// Se ejecuta al abrir la hoja. Crea el menú con los dos manejadores.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Maysa Brain').addItem('Crear revisor', 'crearRevisor').addItem('Crear revisores…', 'crearRevisores').addToUi();
}
