const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    console.log("Navigating to http://127.0.0.1:5176/editorv2/ ...");
    await page.goto('http://127.0.0.1:5176/editorv2/', { waitUntil: 'networkidle2' });

    console.log("Waiting for auth gate to be visible...");
    await page.waitForSelector('#auth-gate-modal');

    // Attempt to login as designer_alex
    console.log("Logging in as editor (designer_alex)...");
    await page.type('#login-username', 'editor');
    await page.type('#login-password', 'Canvas@Collab2026#Design!');
    await page.click('#auth-tabs-container .is-active'); // ensure login tab is active
    
    // There isn't an explicit "submit" button ID easily identifiable in the snippet, we'll try to find it or press Enter
    await page.keyboard.press('Enter');

    console.log("Waiting for login to complete (network idle)...");
    await page.waitForTimeout(1000); // Wait for transition

    const uiState = await page.evaluate(() => {
        const dashboard = document.getElementById('dashboard-view');
        const authGate = document.getElementById('auth-gate-modal');
        const editorHeader = document.querySelector('header.z-40');
        
        return {
            dashboard: dashboard ? {
                classes: dashboard.className,
                display: dashboard.style.display,
                opacity: window.getComputedStyle(dashboard).opacity,
                zIndex: window.getComputedStyle(dashboard).zIndex
            } : 'Not found',
            authGate: authGate ? {
                classes: authGate.className,
                display: authGate.style.display
            } : 'Not found',
            url: window.location.href,
            bodyClasses: document.body.className
        };
    });

    console.log("UI State After Login:", JSON.stringify(uiState, null, 2));

    await browser.close();
})();
