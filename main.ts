// Neon Coast Cover Studio — the program that hands the app in.
//
// Node 22, standard library only. It copies the app/ folder and the
// screenshots/ folder from beside this file into the output directory and
// writes /output/dossier.json with the kit's vendored buildDossier library,
// using the scorer's caps for this competition. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The entry is deterministic: the same repository always produces the same
// output bytes, because it copies files as they are and the dossier is a
// canonical summary of those files.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });

  const shotsDir = join(out, 'screenshots');
  mkdirSync(shotsDir, { recursive: true });
  const localShots = join(here, 'screenshots');
  if (existsSync(localShots)) {
    cpSync(localShots, shotsDir, { recursive: true });
  }

  const dossier = buildDossier(out, caps);
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log(`handed in app/ + screenshots/ + dossier.json to ${out}`);
}

handIn();
