import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
await page.goto('https://www.grabengo.store/', { waitUntil: 'networkidle0', timeout: 45000 });
await page.waitForTimeout(3000);
const snap = await page.evaluate(() => ({
  logoMark: document.querySelector('.grabengo-logo-mark')?.outerHTML?.slice(0, 200),
  logoText: document.querySelector('.landing-logo-text')?.textContent,
  logoImg: document.querySelector('.landing-logo-pill img')?.src,
  navHtml: document.querySelector('.landing-nav-floating')?.innerHTML?.slice(0, 400),
  faviconImg: [...document.querySelectorAll('img')].map(i => ({ src: i.src, alt: i.alt, w: i.offsetWidth, h: i.offsetHeight })).slice(0, 8),
}));
console.log(JSON.stringify({ snap, errors }, null, 2));
await browser.close();
