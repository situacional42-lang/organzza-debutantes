import {readdir,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public');
await mkdir(path.join(output,'assets'),{recursive:true});
let count=0;
for(const entry of await readdir(root,{withFileTypes:true})) {
  if(entry.isFile()&&/\.(html|css|js)$/.test(entry.name)&&entry.name!=='proposta-comercial.html') {
    await copyFile(path.join(root,entry.name),path.join(output,entry.name));count++;
  }
}
for(const entry of await readdir(path.join(root,'assets'),{withFileTypes:true})) {
  if(entry.isFile()&&/\.(webp|svg)$/.test(entry.name)&&!entry.name.startsWith('proposal-')) {
    await copyFile(path.join(root,'assets',entry.name),path.join(output,'assets',entry.name));count++;
  }
}
console.log(`Vitrine preparada: ${count} arquivos públicos.`);
