// Prueba mínima del canal de retorno (T1, #87). No es el canal definitivo (ese es Codigo.js, T2).
// Va pegado en el editor de Apps Script de una hoja de prueba del editor. No lleva datos.
/* global ContentService, SpreadsheetApp */
/* exported doGet, doPost */

const HOJA_PRUEBA = 'Prueba';
const MARCA_VALIDA = /^prueba-[a-z0-9]{4,32}$/;

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function hojaPrueba(crear) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA_PRUEBA);
  if (!hoja && crear) {
    hoja = libro.insertSheet(HOJA_PRUEBA);
  }
  return hoja;
}

function doPost(e) {
  let datos;
  try {
    datos = JSON.parse(e && e.postData && e.postData.contents);
  } catch {
    return responder({ ok: false, error: 'formato' });
  }
  if (
    datos === null ||
    typeof datos !== 'object' ||
    datos.accion !== 'probar' ||
    typeof datos.marca !== 'string' ||
    !MARCA_VALIDA.test(datos.marca)
  ) {
    return responder({ ok: false, error: 'formato' });
  }
  hojaPrueba(true).appendRow([new Date(), datos.marca]);
  return responder({ ok: true, marca: datos.marca });
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion !== 'leer' || typeof p.marca !== 'string' || !MARCA_VALIDA.test(p.marca)) {
    return responder({ ok: false, error: 'formato' });
  }
  const hoja = hojaPrueba(false);
  const encontrada = hoja
    ? hoja
        .getDataRange()
        .getValues()
        .some((fila) => fila[1] === p.marca)
    : false;
  return responder({ ok: true, encontrada });
}
