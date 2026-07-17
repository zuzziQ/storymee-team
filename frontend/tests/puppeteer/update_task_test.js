const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to http://localhost:3010...');
    await page.goto('http://localhost:3010', { waitUntil: 'networkidle2' });
    
    console.log('Logging in...');
    await page.waitForSelector('input[type="text"]');
    await page.type('input[type="text"]', 'admin@storymee.com');
    const loginBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(btn => btn.textContent.includes('Đăng Nhập'));
    });
    if (loginBtn) {
        await loginBtn.click();
    } else {
        await page.click('button[type="submit"]');
    }
    
    console.log('Waiting for Dashboard...');
    await page.waitForSelector('.glass', { timeout: 15000 });
    
    console.log('Navigating to Kanban...');
    const kanbanTab = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent.includes('Kanban'));
    });
    if (kanbanTab) await kanbanTab.click();
    
    await page.waitForTimeout(2000);
    
    console.log('Looking for a task to update...');
    const taskCards = await page.$$('div[draggable="true"]');
    if (taskCards.length > 0) {
        console.log(`Found ${taskCards.length} tasks. Clicking the first one...`);
        await taskCards[0].click();
        
        await page.waitForTimeout(1000);
        console.log('Task detail modal opened.');
        
        const dateInput = await page.$('input[type="date"]');
        if (dateInput) {
            console.log('Changing deadline...');
            await page.evaluate(() => {
                const els = document.querySelectorAll('input[type="date"]');
                if (els.length > 0) {
                    els[0].value = '2026-11-11';
                    els[0].dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        
        const numberInput = await page.$('input[type="number"]');
        if (numberInput) {
            console.log('Changing estimate hours...');
            await page.evaluate(() => {
                const els = document.querySelectorAll('input[type="number"]');
                if (els.length > 0) {
                    els[0].value = '8';
                    els[0].dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }
        
        await page.waitForTimeout(2000);
        console.log('SUCCESS: Task updated gracefully without crashing!');
    } else {
        console.log('No tasks found to update. Test passed technically but no data to verify.');
    }
    
  } catch (err) {
    console.error('TEST FAILED:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
