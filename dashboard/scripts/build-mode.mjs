import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const mode = process.argv[2];
if (!['local', 'cloud'].includes(mode)) throw new Error('Expected local or cloud mode');
const root = fileURLToPath(new URL('../', import.meta.url));
for (const [script, args] of [['typescript/bin/tsc', ['--noEmit']], ['vite/bin/vite.js', ['build']]]) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../node_modules/${script}`, import.meta.url)), ...args], {cwd: root, stdio: 'inherit', env: {...process.env, VITE_SOC_MODE: mode}});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
