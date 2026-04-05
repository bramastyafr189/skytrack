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
                if (valSpan) {
                    let val = valSpan.innerText.trim();
                    const nextSib = valSpan.nextElementSibling;
                    if (nextSib && nextSib.innerText.includes('%')) {
                        val += ` ${nextSib.innerText.trim()}`;
                    }
                    return val;
                }

                // For "Airports served" structure
                const dd = parent.querySelector('dd');
                if (dd) return dd.innerText.trim();

                // If label was dt, parent is div typically, and dd is a sibling of dt
                if (labelNode.tagName === 'DT') {
                    const nextDD = labelNode.nextElementSibling;
                    if (nextDD && nextDD.tagName === 'DD') {
                        return nextDD.innerText.trim();
                    }
                }

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

            const getMovements = () => {
                const ret = { total: "0", takeoffs: "0", landings: "0" };
                const headers = Array.from(document.querySelectorAll('h2, div'));
                const movHeader = headers.find(h => h.innerText.toLowerCase().includes('airport movements'));
                if (movHeader) {
                    const section = movHeader.closest('section') || movHeader.parentElement.parentElement;
                    if (section) {
                        const dts = Array.from(section.querySelectorAll('dt'));
                        dts.forEach(dt => {
                            const lbl = dt.innerText.trim().toUpperCase();
                            const dd = dt.nextElementSibling || dt.parentElement.querySelector('dd');
                            if (dd) {
                                if (lbl === 'TOTAL') ret.total = dd.innerText.trim();
                                if (lbl === 'TAKEOFFS') ret.takeoffs = dd.innerText.trim();
                                if (lbl === 'LANDINGS') ret.landings = dd.innerText.trim();
                            }
                        });
                    }
                }
                return ret;
            };

            results.avgDelay = findValueByLabel('AVERAGE DELAY') || "0";
            results.delays = findValueByLabel('FLIGHTS DELAYED') || "0";
            results.cancellations = findValueByLabel('FLIGHTS CANCELED') || "0";
            results.airportsServed = findValueByLabel('AIRPORTS SERVED') || "Unknown";
            results.countriesServed = findValueByLabel('COUNTRIES SERVED') || "Unknown";
            results.routes = getBusiestRoutes();
            
            // Add Total, Takeoffs, Landings
            const movements = getMovements();
            results.totalFlights = movements.total !== "0" ? movements.total : (findValueByLabel('TOTAL') || "0");
            results.takeoffs = movements.takeoffs !== "0" ? movements.takeoffs : (findValueByLabel('TAKEOFFS') || "0");
            results.landings = movements.landings !== "0" ? movements.landings : (findValueByLabel('LANDINGS') || "0");
            
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

            // Regex for: Flights delayed ... <span ...>100</span><span ...>(35%)</span>
            const delayedMatch = html.match(/Flights delayed.*?text-1\.5xl.*?">([\d,]+)<\/span>(?:.*?<span.*?>(\([\d.]+%[^\)]*\))<\/span>)?/s);
            if (delayedMatch) {
                details.delays = delayedMatch[1];
                if (delayedMatch[2]) details.delays += ` ${delayedMatch[2]}`;
            }

            // Regex for: Flights canceled ... <span ...>100</span><span ...>(35%)</span>
            const canceledMatch = html.match(/Flights canceled.*?text-1\.5xl.*?">([\d,]+)<\/span>(?:.*?<span.*?>(\([\d.]+%[^\)]*\))<\/span>)?/s);
            if (canceledMatch) {
                details.cancellations = canceledMatch[1];
                if (canceledMatch[2]) details.cancellations += ` ${canceledMatch[2]}`;
            }
            
            // Regex for: Disruption index ... <span ...>3.3</span>
            const disruptionMatch = html.match(/Disruption index.*?text-1\.5xl.*?">([\d.]+)</s);
            if (disruptionMatch) details.disruptionIndex = disruptionMatch[1];

            // Regex for: Airports served ... <dd ...>119</dd>
            const servedMatch = html.match(/Airports served.*?text-gray-1300">([\d,]+)</s);
            if (servedMatch) details.airportsServed = servedMatch[1];
            
            const countriesMatch = html.match(/Countries served.*?text-gray-1300">([\d,]+)</s);
            if (countriesMatch) details.countriesServed = countriesMatch[1];

            // Regex for: Total, Takeoffs, Landings Movements
            const movementsMatch = html.match(/Airport movements.*?Total.*?<dd[^>]*>([\d,]+)<\/dd>.*?Takeoffs.*?<dd[^>]*>([\d,]+)<\/dd>.*?Landings.*?<dd[^>]*>([\d,]+)<\/dd>/s);
            if (movementsMatch) {
                details.totalFlights = movementsMatch[1];
                details.takeoffs = movementsMatch[2];
                details.landings = movementsMatch[3];
            } else {
                // Fallback for just labels if not grouped perfectly
                const totalMatch = html.match(/Total.*?text-gray-1300">([\d,]+)</s);
                if (totalMatch && details.totalFlights === "0") details.totalFlights = totalMatch[1];
                
                const takeoffMatch = html.match(/Takeoffs.*?text-gray-1300">([\d,]+)</s);
                if (takeoffMatch && details.takeoffs === "0") details.takeoffs = takeoffMatch[1];
                
                const landingMatch = html.match(/Landings.*?text-gray-1300">([\d,]+)</s);
                if (landingMatch && details.landings === "0") details.landings = landingMatch[1];
            }

            // Regex for Routes
            if (details.routes.length === 0) {
                // Handle nested spans like <span><span>BEG<...
                const routeRegex = /<span><span>([A-Z]{3})<.*?–.*?<span><span>([A-Z]{3})<.*?text-xs">([\d,]+) flights/gs;
                let m;
                while ((m = routeRegex.exec(html)) !== null) {
                    details.routes.push({ route: `${m[1]} – ${m[2]}`, count: m[3] });
                    if (details.routes.length >= 5) break;
                }
                
                // Fallback simpler regex for routes if the nested one fails
                if (details.routes.length === 0) {
                    const simpleRouteRegex = /([A-Z]{3})\s*[–-]\s*([A-Z]{3}).*?([\d,]+)\s*flights/gs;
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
