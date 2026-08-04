import http from 'http'; import fs from 'fs'; import path from 'path';
const DIST='/tmp/webdist', PROJ='/sessions/stoic-inspiring-wozniak/mnt/GoodtoGo/mobile-app', FONTS='/tmp/fonts/node_modules/@fontsource/inter/files';
const MIME={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
const dehash = (f) => { const e=path.extname(f); const b=f.slice(0,-e.length); const m=b.match(/^(.*)\.[0-9a-f]{32}$/); return m? m[1]+e : null; };
export function serve(port){
  const s=http.createServer((req,res)=>{
    const u=decodeURIComponent(req.url.split('?')[0]);
    let f = u.startsWith('/fonts/') ? path.join(FONTS,u.slice(7))
          : u.startsWith('/assets/') ? path.join(PROJ,u.slice(8))
          : path.join(DIST, u==='/'?'index.html':u);
    if(!fs.existsSync(f)){ const alt=dehash(f); if(alt&&fs.existsSync(alt)) f=alt; }
    if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404).end('nf');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r=>s.listen(port,()=>r(s)));
}
