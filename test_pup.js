const puppeteer = require('puppeteer');

(async () => {
    console.log("Starting Chrome...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Set a realistic User-Agent
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    
    console.log("Going to URL...");
    await page.goto('https://www.flightradar24.com/airport-disruptions', { waitUntil: 'networkidle2' });
    
    console.log("Waiting for data...");
    // The data might be inside a list or a table. Let's get all texts.
    // Disruptions page has a table with classes or we can just grab HTML inside body to see if Cloudflare blocked us.
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    if (bodyText.includes("Just a moment") || bodyText.includes("Cloudflare")) {
        console.log("BLOCKED BY CLOUDFLARE!");
    } else {
        console.log("SUCCESS! Extracting data...");
        // Usually it has elements like 'Global Delay Index' or rows with airport names
        console.log(bodyText.substring(0, 500));
        
        // Let's print out if there's any JSON state embedded in script tags
        const jsonMatch = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            for(let s of scripts) {
                if (s.innerText.includes('disruptions')) return s.innerText.substring(0, 200);
            }
            return "No script found";
        });
        console.log("Script state:", jsonMatch);
    }
    
    await browser.close();
})();
