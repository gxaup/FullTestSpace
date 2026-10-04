const { webkit } = require('playwright');
(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  
  // Try things that throw SyntaxError DOMException
  await page.evaluate(() => {
    try { document.querySelector('123'); } catch(e) { console.log("querySelector:", e.message); }
    try { atob('a'); } catch(e) { console.log("atob:", e.message); }
    try { new URL('http://'); } catch(e) { console.log("URL:", e.message); }
    try { fetch('http://'); } catch(e) { console.log("fetch:", e.message); }
    try { new XMLHttpRequest().open('GET', 'http://\n'); } catch(e) { console.log("XHR:", e.message); }
  });
  
  await browser.close();
})();
