const puppeteer = require('puppeteer');

(async () => {
    let browser;
    const iata = process.argv[2];
    if (!iata) {
        console.log(JSON.stringify({ success: false, error: "IATA code required" }));
        process.exit(1);
    }

    try {
        const userAgents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");
        await page.setViewport({ width: 1920, height: 1080 });
        
        const url = `https://www.flightradar24.com/airport/${iata.toLowerCase()}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // 1. "Nuclear" Popup Removal and GDPR Accept
        await page.evaluate(() => {
            const clickByText = (t) => {
                const b = Array.from(document.querySelectorAll('button, span, a')).find(el => el.innerText.includes(t));
                if (b) b.click();
            };
            clickByText('Agree and close');
            clickByText('Accept all');
            document.querySelectorAll('.modal, .modal-backdrop, [id*="cookie"], [class*="overlay"]').forEach(e => e.remove());
        });

        // 2. Wait for content hydration (Dynamic widgets take time)
        await new Promise(r => setTimeout(r, 15000));

        const details = await page.evaluate(() => {
            const results = {
                avgDelay: "0",
                delays: "0",
                cancellations: "0",
                airportsServed: "Unknown",
                routes: []
            };

            // Helper to find value based on user-provided structure
            const findValueByLabel = (labelText) => {
                const els = Array.from(document.querySelectorAll('div, dt, span'));
                const labelNode = els.find(el => el.innerText.trim().toUpperCase() === labelText.toUpperCase());
                if (!labelNode) return null;

                const parent = labelNode.parentElement;
                // For "Average delay" / "Flights delayed" structure
                const valSpan = parent.querySelector('span[class*="text-1.5xl"]');
                if (valSpan) return valSpan.innerText.trim();

                // For "Airports served" structure
                const dd = parent.querySelector('dd');
                if (dd) return dd.innerText.trim();

                // Try sibling
                if (labelNode.nextElementSibling) return labelNode.nextElementSibling.innerText.trim();

                return null;
            };

            const getBusiestRoutes = () => {
                const routes = [];
                const dt = Array.from(document.querySelectorAll('dt')).find(el => el.innerText.trim().toUpperCase() === 'BUSIEST ROUTES');
                const dd = dt?.parentElement.querySelector('dd');
                if (dd) {
                    dd.querySelectorAll('li').forEach(li => {
                        const codes = Array.from(li.querySelectorAll('span')).map(s => s.innerText.trim()).filter(t => t.length === 3);
                        const flightsStr = li.querySelector('div.text-xs')?.innerText || "0";
                        if (codes.length >= 2) {
                            routes.push({
                                route: `${codes[0]} – ${codes[1]}`,
                                count: flightsStr.replace(/ flights/i, '').trim()
                            });
                        }
                    });
                }
                return routes;
            };

            results.avgDelay = findValueByLabel('AVERAGE DELAY') || "0";
            results.delays = findValueByLabel('FLIGHTS DELAYED') || "0";
            results.cancellations = findValueByLabel('FLIGHTS CANCELED') || "0";
            results.airportsServed = findValueByLabel('AIRPORTS SERVED') || "Unknown";
            results.routes = getBusiestRoutes();
            
            // Add Total, Takeoffs, Landings
            results.totalFlights = findValueByLabel('TOTAL') || "0";
            results.takeoffs = findValueByLabel('TAKEOFFS') || "0";
            results.landings = findValueByLabel('LANDINGS') || "0";
            
            // Add Disruption Index
            results.disruptionIndex = findValueByLabel('DISRUPTION INDEX') || "N/A";

            return results;
        });

        // 3. REGEX FALLBACK (If DOM fails to find values)
        if (details.airportsServed === "Unknown" || details.delays === "0") {
            const html = await page.content();
            
            // Regex for: Average delay ... <span ...>41</span>
            const avgMatch = html.match(/Average delay.*?text-1\.5xl.*?">(\d+)</s);
            if (avgMatch) details.avgDelay = avgMatch[1];

            // Regex for: Flights delayed ... <span ...>100</span>
            const delayedMatch = html.match(/Flights delayed.*?text-1\.5xl.*?">(\d+)</s);
            if (delayedMatch) details.delays = delayedMatch[1];
            
            // Regex for: Disruption index ... <span ...>3.3</span>
            const disruptionMatch = html.match(/Disruption index.*?text-1\.5xl.*?">([\d.]+)</s);
            if (disruptionMatch) details.disruptionIndex = disruptionMatch[1];

            // Regex for: Airports served ... <dd ...>119</dd>
            const servedMatch = html.match(/Airports served.*?text-gray-1300">(\d+)</s);
            if (servedMatch) details.airportsServed = servedMatch[1];

            // Regex for: Total, Takeoffs, Landings
            const totalMatch = html.match(/Total.*?text-gray-1300">([\d,]+)</s);
            if (totalMatch) details.totalFlights = totalMatch[1];
            const takeoffMatch = html.match(/Takeoffs.*?text-gray-1300">([\d,]+)</s);
            if (takeoffMatch) details.takeoffs = takeoffMatch[1];
            const landingMatch = html.match(/Landings.*?text-gray-1300">([\d,]+)</s);
            if (landingMatch) details.landings = landingMatch[1];

            // Regex for Routes
            if (details.routes.length === 0) {
                // Handle nested spans like <span><span>BEG<...
                const routeRegex = /<span><span>([A-Z]{3})<.*?–.*?<span><span>([A-Z]{3})<.*?text-xs">(\d+) flights/gs;
                let m;
                while ((m = routeRegex.exec(html)) !== null) {
                    details.routes.push({ route: `${m[1]} – ${m[2]}`, count: m[3] });
                    if (details.routes.length >= 5) break;
                }
                
                // Fallback simpler regex for routes if the nested one fails
                if (details.routes.length === 0) {
                    const simpleRouteRegex = /([A-Z]{3})\s*[–-]\s*([A-Z]{3}).*?(\d+)\s*flights/gs;
                    while ((m = simpleRouteRegex.exec(html)) !== null) {
                        details.routes.push({ route: `${m[1]} – ${m[2]}`, count: m[3] });
                        if (details.routes.length >= 5) break;
                    }
                }
            }
        }

        console.log(JSON.stringify({ success: true, data: details }));
        
    } catch (err) {
        console.log(JSON.stringify({ success: false, error: err.toString() }));
    } finally {
        if (browser) await browser.close();
    }
})();
