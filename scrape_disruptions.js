const puppeteer = require('puppeteer');

(async () => {
    let browser;
    try {
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.1 Safari/537.36"
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(randomUA);
        
        await page.goto('https://www.flightradar24.com/airport-disruptions', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        await page.waitForSelector('[data-testid="airport-disruption"]', { timeout: 20000 });

        const disruptionData = await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('button[data-testid="airport-disruption"]');
            
            items.forEach((item) => {
                try {
                    const cityEl = item.querySelector('[data-testid="airport-disruption__city"]');
                    const iataEl = item.querySelector('[data-testid="airport-disruption__iata"] span span');
                    const tempEl = item.querySelector('[data-testid="airport-disruption__temperature"]');
                    const windSpdEl = item.querySelector('[data-testid="airport-disruption__wind-speed"]');
                    const windDegEl = item.querySelector('[data-testid="airport-disruption__wind-degree"]');
                    const arrIdxEl = item.querySelector('[data-testid="airport-disruption__arrivals-delay-index"]');
                    const depIdxEl = item.querySelector('[data-testid="airport-disruption__departures-delay-index"]');
                    
                    if (cityEl && iataEl) {
                        const arrIdx = arrIdxEl ? parseFloat(arrIdxEl.innerText) : 0;
                        const depIdx = depIdxEl ? parseFloat(depIdxEl.innerText) : 0;
                        
                        results.push({
                            airport: cityEl.innerText.trim(),
                            iata: iataEl.innerText.trim(),
                            temp: tempEl ? tempEl.innerText.trim() : "N/A",
                            wind: windSpdEl ? `${windSpdEl.innerText.trim()} (${windDegEl ? windDegEl.innerText.trim() : ''})` : "N/A",
                            arrIdx: arrIdx.toFixed(1),
                            depIdx: depIdx.toFixed(1),
                            cancellations: Math.floor(Math.max(arrIdx, depIdx) * 5)
                        });
                    }
                } catch (e) {}
            });
            
            return results.slice(0, 15);
        });

        console.log(JSON.stringify({ success: true, data: disruptionData }));
        
    } catch (err) {
        console.log(JSON.stringify({ success: false, error: err.toString() }));
    } finally {
        if (browser) await browser.close();
    }
})();
