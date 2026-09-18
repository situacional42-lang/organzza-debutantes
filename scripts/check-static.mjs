import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './build-static.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public');
const config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));
assert.equal(config.framework,null);
assert.equal(config.outputDirectory,'public');
assert.ok(config.functions['api/index.mjs']);
await assert.rejects(stat(path.join(root,'app.js')),{code:'ENOENT'});
for(const name of ['index.html','admin.html','catalog-store.js','storefront.js'])await stat(path.join(output,name));
for(const entry of await readdir(output,{withFileTypes:true})) {
  if(entry.isFile()) {
    assert.match(entry.name,/\.(html|css|js)$/);
    assert.notEqual(entry.name,'proposta-comercial.html');
    assert.deepEqual(await readFile(path.join(output,entry.name)),await readFile(path.join(root,entry.name)));
    if(entry.name.endsWith('.html')) {
      const html=await readFile(path.join(output,entry.name),'utf8');
      for(const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
        const target=match[1];
        if(!/^(https?:|data:|tel:|mailto:|#)/.test(target))await stat(path.join(output,target));
      }
    }
  }
}
for(const name of ['server.mjs','booking-storage.mjs','package.json','firebase.json','.env','data','api','docs'])await assert.rejects(stat(path.join(output,name)),{code:'ENOENT'});
console.log('OK: vitrine completa, referências de arquivos válidas, entrada API explícita e somente arquivos públicos no build.');
