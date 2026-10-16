// Panel de medición de carga (issue 6). Solo aparece al abrir la app con ?medir=1 y se mantiene en la
// pestaña hasta cerrarlo. Lee lo que el navegador reporta (Performance API): no envía nada a ningún lado.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  acumularFluidez,
  cargaLenta,
  cuelloDeBotella,
  informe,
  MARCA_PRIMER_CUADRO,
  resumirCarga,
  resumirFluidez,
  seguirLeyendo,
  type Equipo,
  type EstadoFluidez,
  type Fluidez,
  type Recurso,
  type ResumenCarga,
} from '../lib/medicion';
import { useMetricas } from './metricas';

const CLAVE = 'atlas:medir';

function activoAlInicio(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('medir') === '1') sessionStorage.setItem(CLAVE, '1');
    return sessionStorage.getItem(CLAVE) === '1';
  } catch {
    return new URLSearchParams(window.location.search).get('medir') === '1';
  }
}

/** Equipo y navegador en pocas palabras; iPadOS se presenta como Mac, se reconoce por la pantalla táctil. */
function describirNavegador(): string {
  const ua = navigator.userAgent;
  const ipad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const sistema = ipad ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'otro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'otro';
  const version = /(?:Version|Chrome|CriOS|Firefox|FxiOS|Edg)\/(\d+)/.exec(ua)?.[1];
  return `${sistema} · ${nav}${version ? ` ${version}` : ''}`;
}

function equipo(gpu: string, densidad: number, densidadFija: boolean): Equipo {
  const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    navegador: describirNavegador(),
    pantalla: `${window.innerWidth} x ${window.innerHeight} @${window.devicePixelRatio}x`,
    nucleos: navigator.hardwareConcurrency || null,
    memoriaGB: memoria ?? null,
    gpu,
    densidad: densidad > 0 ? { valor: densidad, fija: densidadFija } : null,
  };
}

function leerDatos(): { resumen: ResumenCarga; primerCuadro: number | null } {
  const recursos = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).map<Recurso>((r) => ({
    name: r.name,
    startTime: r.startTime,
    responseEnd: r.responseEnd,
    transferSize: r.transferSize,
    decodedBodySize: r.decodedBodySize,
    encodedBodySize: r.encodedBodySize,
  }));
  const marcas: Record<string, number> = {};
  for (const m of performance.getEntriesByType('mark')) marcas[m.name] = m.startTime;
  return { resumen: resumirCarga({ recursos, marcas }), primerCuadro: marcas[MARCA_PRIMER_CUADRO] ?? null };
}

export default function PanelMedicion() {
  const { t } = useTranslation();
  const [activo, setActivo] = useState(activoAlInicio);
  const [resumen, setResumen] = useState<ResumenCarga | null>(null);
  const [fluidez, setFluidez] = useState<Fluidez | null>(null);
  const [copiado, setCopiado] = useState(false);
  const gpu = useMetricas((s) => s.gpu);
  const densidad = useMetricas((s) => s.densidad);
  const densidadFija = useMetricas((s) => s.densidadFija);
  const muestras = useRef<number[]>([]);

  // Tiempos de carga: se leen cada medio segundo hasta que pasa la ventana de fluidez y el índice de toque está listo.
  useEffect(() => {
    if (!activo) return;
    // Cada lectura de cuadros por segundo es una muestra; cuenta solo si su intervalo (de la lectura
    // anterior a esta) cae entero entre 1 y 10 s después del primer cuadro.
    const estado: EstadoFluidez = { anterior: performance.now(), muestras: muestras.current };
    const quitarFps = useMetricas.subscribe((s, antes) => {
      const primero = performance.getEntriesByName(MARCA_PRIMER_CUADRO)[0]?.startTime;
      acumularFluidez(estado, s, antes, performance.now(), primero);
    });
    const id = setInterval(() => {
      const { resumen: r, primerCuadro } = leerDatos();
      setResumen(r);
      if (primerCuadro !== null) setFluidez(resumirFluidez(muestras.current));
      if (!seguirLeyendo(performance.now(), primerCuadro, r.indiceListoMs)) clearInterval(id);
    }, 500);
    return () => {
      clearInterval(id);
      quitarFps();
    };
  }, [activo]);

  if (!activo) return null;
  const cuello = resumen && cargaLenta(resumen) ? cuelloDeBotella(resumen) : null;
  const ms = (n: number | null | undefined) => (n === null || n === undefined ? t('medicion.esperando') : `${n} ms`);
  const eq = equipo(gpu, densidad, densidadFija);
  const copiar = async () => {
    if (!resumen) return;
    const texto = `${informe(resumen, eq, fluidez, new Date().toISOString())}\n${navigator.userAgent}`;
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      window.prompt(t('medicion.copiaManual'), texto);
    }
    setCopiado(true);
  };

  return (
    <section className="panel-medicion" aria-labelledby="medicion-titulo" data-testid="panel-medicion">
      <h2 id="medicion-titulo">{t('medicion.titulo')}</h2>
      <dl>
        <dt>{t('medicion.equipo')}</dt>
        <dd>{eq.navegador}</dd>
        <dt>{t('medicion.pantalla')}</dt>
        <dd>{eq.pantalla}</dd>
        <dt>{t('medicion.densidad')}</dt>
        <dd data-testid="medicion-densidad">
          {densidad > 0
            ? densidadFija
              ? t('medicion.densidadFija', { valor: densidad })
              : t('medicion.densidadAuto', { valor: densidad })
            : t('medicion.sinDato')}
        </dd>
        <dt>{t('medicion.gpu')}</dt>
        <dd>{eq.gpu || t('medicion.sinDato')}</dd>
        <dt>{t('medicion.codigo')}</dt>
        <dd data-testid="medicion-codigo">
          {ms(resumen?.codigoListoMs)} {resumen?.codigoKB ? `· ${resumen.codigoKB} KB` : ''}
        </dd>
        <dt>{t('medicion.modelo')}</dt>
        <dd data-testid="medicion-modelo">
          {ms(resumen?.modeloDescargaMs)}{' '}
          {resumen?.modeloDesdeCache ? `· ${t('medicion.desdeCache')}` : resumen?.modeloKB ? `· ${resumen.modeloKB} KB` : ''}
        </dd>
        <dt>{t('medicion.preparar')}</dt>
        <dd data-testid="medicion-preparar">{ms(resumen?.procesamientoMs)}</dd>
        <dt className="medicion-parte">{t('medicion.leerModelo')}</dt>
        <dd data-testid="medicion-leer">{ms(resumen?.leerModeloMs)}</dd>
        <dt className="medicion-parte">{t('medicion.armarPiezas')}</dt>
        <dd data-testid="medicion-armar">{ms(resumen?.armarPiezasMs)}</dd>
        <dt>{t('medicion.primerCuadro')}</dt>
        <dd data-testid="medicion-primer-cuadro">{ms(resumen?.primerCuadroMs)}</dd>
        <dt>{t('medicion.indiceToque')}</dt>
        <dd data-testid="medicion-indice">{ms(resumen?.indiceToqueMs)}</dd>
        <dt>{t('medicion.indiceListo')}</dt>
        <dd data-testid="medicion-indice-listo">{ms(resumen?.indiceListoMs)}</dd>
        <dt>{t('medicion.fluidez')}</dt>
        <dd>{fluidez ? t('medicion.fps', { promedio: fluidez.promedio, minimo: fluidez.minimo }) : t('medicion.esperando')}</dd>
      </dl>
      {cuello && (
        <p className="medicion-cuello" data-testid="medicion-cuello">
          {t(`medicion.cuello.${cuello}`)}
        </p>
      )}
      <div className="medicion-botones">
        <button type="button" className="boton-primario" onClick={() => void copiar()} disabled={!resumen}>
          {copiado ? t('medicion.copiado') : t('medicion.copiar')}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.removeItem(CLAVE);
            } catch {
              /* nada que borrar */
            }
            setActivo(false);
          }}
        >
          {t('medicion.cerrar')}
        </button>
      </div>
    </section>
  );
}
