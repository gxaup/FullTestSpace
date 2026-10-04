const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173');
  console.log("Navigated to localhost:5173");
  
  // Wait for the app to load
  await page.waitForTimeout(2000);
  
  // We can't fully test Samsara API without an API key, but we can check if the proxy is accessible.
  const res = await page.evaluate(async () => {
    try {
      const resp = await fetch('/samsara-api/fleet/vehicles?_cb=123', {
        headers: { 'Authorization': 'Bearer fake-key', 'Accept': 'application/json' }
      });
      return { status: resp.status, ok: resp.ok };
    } catch (e) {
      return { error: e.message };
    }
  });
  
  console.log("Proxy test result:", res);
  
  await browser.close();
})();
