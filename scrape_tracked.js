const puppeteer = require('puppeteer');

(async () => {
    let browser;
    try {
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(randomUA);
        
        await page.goto('https://www.flightradar24.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait 10s for sidebar
        await new Promise(r => setTimeout(r, 10000));
        
        // Tunggu widget utama muncul
        await page.waitForSelector('[data-testid="most-tracked-flights-widget"]', { timeout: 10000 });

        const trackedFlights = await page.evaluate(() => {
            const flights = [];
            // Batasi pencarian hanya di dalam widget most-tracked agar tidak nyasar ke elemen lain
            const widget = document.querySelector('[data-testid="most-tracked-flights-widget"]');
            if (!widget) return [];
            
            const items = widget.querySelectorAll('.cursor-pointer.rounded-md');
            
            items.forEach((item) => {
                try {
                    const rankEl = item.querySelector('span.font-semibold');
                    
                    // Specific Call Sign / Flight Number
                    const callsignEl = item.querySelector('.font-semibold.uppercase.ml-1');
                    const flightNoEl = item.querySelector('[data-testid="aircraft-panel__header__flight-number"]');
                    
                    // Aircraft Model (e.g., K35R, B762)
                    const modelEl = item.querySelector('[data-testid="aircraft-panel__header__model"]');
                    
                    // Tracking count
                    const clicksEl = item.querySelector('.text-sm.font-semibold');
                    
                    // Route Info: IATA codes have specific border classes, cities have .truncate
                    // Filter out the model element from IATA list
                    const allSmallBadges = Array.from(item.querySelectorAll('.font-alt-regular.text-2xs'));
                    const iataElements = allSmallBadges.filter(el => !el.hasAttribute('data-testid') && el.classList.contains('border-gray-900'));
                    
                    // Cities are usually the only .truncate elements that aren't the title
                    const cityElements = Array.from(item.querySelectorAll('.truncate')).filter(el => {
                        // Avoid picking up the callsign if it happens to be truncated
                        return !el.classList.contains('font-semibold');
                    });
                    
                    if (rankEl) {
                        const isEmergency = !!item.querySelector('.bg-red-500, .bg-red-600');
                        
                        // Priority: Callsign > Flight Number > "N/A"
                        let displayFlightNo = "N/A";
                        if (callsignEl && callsignEl.innerText.trim() !== "N/A") {
                            displayFlightNo = callsignEl.innerText.trim();
                        } else if (flightNoEl) {
                            displayFlightNo = flightNoEl.innerText.trim();
                        }

                        flights.push({
                            flightNo: displayFlightNo,
                            airline: modelEl ? modelEl.innerText.trim() : "Private",
                            origin: iataElements[0] ? iataElements[0].innerText.trim() : "-",
                            originCity: cityElements[0] ? cityElements[0].innerText.trim() : "Unknown",
                            dest: iataElements[1] ? iataElements[1].innerText.trim() : "-",
                            destCity: cityElements[1] ? cityElements[1].innerText.trim() : "Unknown",
                            status: clicksEl ? `${clicksEl.innerText.trim()} Tracking` : "Tracking",
                            statusCode: isEmergency ? "status-delayed" : "status-enroute",
                            altitude: "Live",
                            speed: "Live",
                            aircraft: modelEl ? modelEl.innerText.trim() : "-",
                            rank: rankEl.innerText.trim().replace('.', '')
                        });
                    }
                } catch (e) {}
            });
            
            return flights.sort((a,b) => parseInt(a.rank) - parseInt(b.rank)).slice(0, 10);
        });

        if (trackedFlights.length === 0) {
            console.log("DEBUG: No items found in widget. List may be hidden or layout changed.");
        }

        console.log(JSON.stringify({ success: true, data: trackedFlights }));
        
    } catch (err) {
        console.log(JSON.stringify({ success: false, error: err.toString() }));
    } finally {
        if (browser) await browser.close();
    }
})();
