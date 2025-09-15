#!/usr/bin/env deno run --allow-all

import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

console.log('📸 Taking screenshot of FXD...');

try {
  await page.goto('http://localhost:3000/app');
  await page.waitForTimeout(3000);

  // Create screenshots directory
  await Deno.mkdir('docs/screenshots', { recursive: true });

  await page.screenshot({
    path: 'docs/screenshots/fxd-current-state.png',
    fullPage: true
  });

  console.log('✅ Screenshot saved to docs/screenshots/fxd-current-state.png');

} catch (error) {
  console.error('❌ Screenshot failed:', error);
}

await browser.close();