import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for (const role of ['client','admin']) await build({entryPoints:['apps/main.ts'],outfile:`dist/${role}.cjs`,bundle:true,platform:'node',external:['electron','electron-updater'],define:{APP_ROLE:JSON.stringify(role)}});
await build({entryPoints:['apps/preload.ts'],outfile:'dist/preload.cjs',bundle:true,platform:'node',external:['electron']});
await build({entryPoints:['apps/ui.tsx'],outfile:'dist/ui.js',bundle:true,platform:'browser'});
await copyFile('apps/index.html','dist/index.html');
await copyFile('packages/detect.ps1','dist/detect.ps1');
