// Comprime pipeline/salida/atlas-crudo.glb a public/modelos/atlas.glb con meshopt.
// No simplifica: los nervios son tubos de 1 mm y se deformarían (SPEC sección 9).
// Uso: node scripts/comprimir-modelo.ts [entrada] [salida]
import { dedup, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { statSync } from 'node:fs';
import { io } from './lib/glb.ts';

const entrada = process.argv[2] ?? 'pipeline/salida/atlas-crudo.glb';
const salida = process.argv[3] ?? 'public/modelos/atlas.glb';

const lector = await io();
const doc = await lector.read(entrada);
await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await lector.write(salida, doc);
const mb = (statSync(salida).size / 1024 / 1024).toFixed(2);
console.log(`${salida}: ${doc.getRoot().listNodes().length} nodos, ${mb} MB`);
