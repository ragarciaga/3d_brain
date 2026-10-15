import { beforeEach, describe, expect, it } from 'vitest';
import { marcarUnaVez } from '../src/components/metricas';

const NOMBRE = 'prueba:una-vez';

describe('marcarUnaVez (issue 85)', () => {
  beforeEach(() => {
    performance.clearMarks(NOMBRE);
  });

  it('crea la marca solo la primera vez', () => {
    marcarUnaVez(NOMBRE);
    const primera = performance.getEntriesByName(NOMBRE, 'mark')[0]!.startTime;
    marcarUnaVez(NOMBRE);
    const marcas = performance.getEntriesByName(NOMBRE, 'mark');
    expect(marcas).toHaveLength(1);
    expect(marcas[0]!.startTime).toBe(primera);
  });
});
