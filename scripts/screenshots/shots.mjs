import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'fs';

const OUT='/sessions/stoic-inspiring-wozniak/mnt/outputs/shots2';
fs.mkdirSync(OUT,{recursive:true});
const W=414,H=896,DSF=3;

const TENANTS=[
 {id:1,name:'Froth Coffee',subdomain:'froth',logo:null,primary_color:'#F1F1F4',store_count:1,categories:['cafe']},
 {id:2,name:'Galaxy',subdomain:'galaxy',logo:null,primary_color:'#111111',store_count:1,categories:['bakery']},
 {id:3,name:'Mamasako',subdomain:'mamasako',logo:null,primary_color:'#F5C542',store_count:2,categories:['cafe']},
 {id:4,name:'The Sunny Side',subdomain:'sunny',logo:null,primary_color:'#E9DCA0',store_count:1,categories:['restaurant']},
 {id:5,name:'Bake House',subdomain:'bakehouse',logo:null,primary_color:'#FFFFFF',store_count:3,categories:['bakery']},
];

const FONT_CSS = [400,500,600,700,800,900].map(w=>
 `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};font-display:block;src:url('/fonts/inter-latin-${w}-normal.woff2') format('woff2');}`
).join('\n') + `
html,body,#root{font-family:'Inter',-apple-system,system-ui,sans-serif;}
div[dir],span,p,h1,h2,h3{font-family:inherit;}
[style*="ionicons"],[class*="ionicon"]{font-family:ionicons !important;}
*{-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{display:none;width:0 !important;}
#root{padding-top:47px;padding-bottom:34px;box-sizing:border-box;}`;

const srv = await serve(8090);
const b = await chromium.launch({
  executablePath: process.env.HOME+'/.cache/ms-playwright/chromium-1148/chrome-linux/chrome',
  args:['--no-sandbox','--disable-dev-shm-usage','--force-device-scale-factor=3','--font-render-hinting=none','--disable-lcd-text','--hide-scrollbars']
});
const ctx = await b.newContext({ viewport:{width:W,height:H}, deviceScaleFactor:DSF, isMobile:true, hasTouch:true, locale:'en-GB', colorScheme:'light' });

await ctx.route('**/api/**', r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await ctx.route('**/api/public/tenants*', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(TENANTS)}));
await ctx.route(/posthog|i\.posthog\.com/, r=>r.abort());
await ctx.addInitScript(()=>{ try{ window.__DEV__=false; }catch(e){} });

const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8090/',{waitUntil:'load',timeout:25000});
await p.addStyleTag({content:FONT_CSS});
await p.waitForTimeout(5000);

const paintSafeAreas = async ()=> p.evaluate(()=>{
  const at=(x,y)=>{ let el=document.elementFromPoint(x,y);
    while(el){ const c=getComputedStyle(el).backgroundColor;
      if(c && c!=='rgba(0, 0, 0, 0)' && c!=='transparent') return c; el=el.parentElement; }
    return null; };
  const top = at(207, 60) || at(207, 120);
  const bot = at(207, window.innerHeight-60) || top;
  const root=document.getElementById('root');
  root.style.background = `linear-gradient(to bottom, ${top} 0 47px, transparent 47px calc(100% - 34px), ${bot} calc(100% - 34px) 100%)`;
  document.body.style.background = top || '#FF5C00';
});
const freeze = async ()=> p.evaluate(()=>{
  window.requestAnimationFrame = ()=>0;
  document.querySelectorAll('div').forEach(el=>{
    const t=el.style.transform||'';
    if(/translateX\(-?\d/.test(t) && !/translateX\(0/.test(t)) el.style.transform='translateX(0px)';
  });
});
const shot = async (name)=>{ await p.waitForTimeout(900); await freeze(); await paintSafeAreas(); await p.waitForTimeout(250); await p.screenshot({path:`${OUT}/${name}.png`}); console.log('shot',name); };

await p.addStyleTag({content:'div[style*="translateX"]{transform:translateX(0px) !important;}'});
await shot('01-landing');

// go to intro
const explore = p.getByText('Explore ➔').first();
if(await explore.count()){ await explore.click(); await p.waitForTimeout(2500); }
console.log('after-explore:', (await p.locator('#root').innerText()).slice(0,120).replace(/\n/g,' | '));
await shot('02-intro-1');
for(let i=2;i<=4;i++){
  const nx = p.getByText(/^(Next|Get Started|Continue)$/).first();
  if(await nx.count()){ await nx.click(); await p.waitForTimeout(1600); await shot(`0${i+1}-intro-${i}`); }
}
console.log('final-text:', (await p.locator('#root').innerText()).slice(0,200).replace(/\n/g,' | '));
await b.close(); srv.close();
