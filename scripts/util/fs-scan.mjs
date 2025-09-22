import fs from 'fs'; import path from 'path';
export function readText(p){ try { return fs.readFileSync(p,'utf-8'); } catch { return ''; } }
export function walk(dir, exts = ['.ts','.tsx','.js','.mjs','.cjs','.json'], out=[]){
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for(const e of ents){
    if(e.name.startsWith('.')) continue;
    const fp = path.join(dir, e.name);
    if(e.isDirectory()) walk(fp, exts, out);
    else if(exts.includes(path.extname(e.name))) out.push(fp);
  }
  return out;
}
export function rel(p){ return p.replace(process.cwd()+path.sep,''); }