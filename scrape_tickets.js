const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const origin = process.argv[2] || 'CGK';
    const destination = process.argv[3] || 'SIN';
    const date = process.argv[4] || '2026-06-10';

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Build the search URL with hl=en to ensure consistent language/labels
        const url = `https://www.google.com/travel/flights?q=Flights%20from%20${origin}%20to%20${destination}%20on%20${date}%20one%20way&hl=en`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for results
        await page.waitForSelector('[role="listitem"], li', { timeout: 30000 }).catch(() => {
            console.error("Timeout waiting for listitems");
        });

        // Small wait for JS hydration
        await new Promise(r => setTimeout(r, 4000));

        // Expand all flight cards to get detailed segment info
        try {
            const expandButtons = await page.$$('[jsname="sTmpVd"], .VfPpkd-LgbsSe[aria-label*="details"], button[aria-label*="details"]');
            for (const btn of expandButtons.slice(0, 10)) {
                await btn.click().catch(() => {});
                await new Promise(r => setTimeout(r, 300));
            }
        } catch(_) {}

        await new Promise(r => setTimeout(r, 1500));

        const flights = await page.evaluate(() => {
            // Recursive helper to find tokens in deeply nested objects/arrays
            function findInJSON(obj, targetId, prefixes, lengthMin = 50) {
                let found = null;
                const prefixesArr = Array.isArray(prefixes) ? prefixes : [prefixes];
                function walk(curr) {
                    if (found) return;
                    if (Array.isArray(curr)) {
                        const hasId = curr.some(x => typeof x === 'string' && x === targetId);
                        if (hasId) {
                            found = curr.find(x => typeof x === 'string' && prefixesArr.some(p => x.startsWith(p)) && x.length >= lengthMin);
                            if (found) return;
                        }
                        for (const item of curr) walk(item);
                    } else if (curr && typeof curr === 'object') {
                        for (const k in curr) walk(curr[k]);
                    }
                }
                walk(obj);
                return found;
            }

            const dataChunks = (window.AF_initDataChunkQueue || []).map(q => q.data);
            const pageSource = document.documentElement.innerHTML;

            // Find valid flight item containers
            // Google Flights uses different classes for 'Best flights' and 'Other flights'
            const flightItems = Array.from(document.querySelectorAll('li.pIav2d, [role="listitem"], .mxvQLc, .JMc57')).filter(el => {
                const text = el.innerText;
                // Basic validation: must have times and a price-like string
                return text.includes(':') && (text.includes('IDR') || text.includes('$') || text.includes('Rp') || text.includes('Rp ') || text.includes('SGD'));
            });

            return flightItems.map((item) => {
                try {
                    const text = item.innerText;

                    const dataId = item.getAttribute('data-id') ||
                        (item.querySelector('[data-id]') ? item.querySelector('[data-id]').getAttribute('data-id') : null) ||
                        (item.querySelector('[jslog]') ? (item.querySelector('[jslog]').getAttribute('jslog').match(/\w+/) || [])[0] : null);

                    // --- Basic Info ---
                    const airlineImg = item.querySelector('img');
                    let airline = airlineImg ? airlineImg.getAttribute('alt') : "Multiple Airlines";
                    if (!airline || airline === "Multiple Airlines") {
                        const spans = Array.from(item.querySelectorAll('span')).filter(s => s.innerText.length > 3 && !s.innerText.includes(':') && !s.innerText.includes('hr'));
                        if (spans.length > 0) airline = spans[0].innerText;
                    }

                    const timeMatches = text.match(/\d{1,2}:\d{2}\s*(?:AM|PM| AM| PM)/gi);
                    const depTime = timeMatches ? timeMatches[0].replace(/\s+/g, ' ') : null;
                    const arrTime = timeMatches && timeMatches.length > 1 ? timeMatches[timeMatches.length - 1].replace(/\s+/g, ' ') : null;
                    const durationMatch = text.match(/\d+\s*hr\s*\d*\s*min|\d+\s*hr|\d+\s*min/gi);
                    const duration = durationMatch ? durationMatch[0] : "N/A";
                    
                    // Improved price regex to handle Rp and other currencies
                    const priceMatch = text.match(/(?:IDR|Rp|[\$€£])\s*\d+(?:[\.,]\d+)*/gi);
                    const price = priceMatch ? priceMatch[0] : "Check price";
                    const stopsText = text.includes('Nonstop') ? 'Nonstop' : (text.match(/\d+\s*stop/i) || ["-"])[0];

                    // --- Segment / Leg Details (for transit flights) ---
                    const segments = [];
                    const segSelectors = ['.twE3dc', '.Ak5kof', '.OgQvJf', '[data-ved] .sSHqwe', '.d9P2I'];
                    let legContainers = [];
                    for (const sel of segSelectors) {
                        const found = item.querySelectorAll(sel);
                        if (found.length > 0) { legContainers = Array.from(found); break; }
                    }

                    let mainCabinClass = "";
                    let mainAircraft = "";
                    let mainLegroom = "";
                    let mainAmenities = [];

                    legContainers.forEach(leg => {
                        const legText = leg.innerText.trim();
                        if (!legText || legText.length < 10) return;
                        const legTimes = legText.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi);
                        if (legTimes && legTimes.length >= 2) {
                            const airportMatch = legText.match(/([A-Z]{3})\s*[–\-]\s*([A-Z]{3})/);
                            
                            let cabin = "";
                            let aircraft = "";
                            let flightNo = "";
                            let legAirline = "";
                            let legroom = "";
                            let legAmenities = [];

                            // 1. Parse dot-separated info from .Xsgmwe with more specificity
                            const detailNodes = leg.querySelectorAll('span.Xsgmwe');
                            detailNodes.forEach((node, idx) => {
                                // Sanitize text: remove &nbsp; and trim
                                const txtString = node.innerText.replace(/\s+/g, ' ').trim();
                                const txtLow = txtString.toLowerCase();
                                if (!txtString) return;

                                // A. Cabin check via jsname="Pvlywd"
                                if (node.getAttribute('jsname') === 'Pvlywd') {
                                    if (txtLow.includes('ekonomi') || txtLow.includes('economy')) cabin = "Ekonomi";
                                    else if (txtLow.includes('bisnis') || txtLow.includes('business')) cabin = "Bisnis";
                                    else if (txtLow.includes('premium')) cabin = "Premium Ekonomi";
                                    else if (txtLow.includes('first') || txtLow.includes('utama')) cabin = "First Class";
                                    return;
                                }

                                // B. Flight number check via class .sI2Nye or .QS0io
                                const nodeClasses = node.className || "";
                                const isFlightNoNode = nodeClasses.includes('sI2Nye') || nodeClasses.includes('QS0io');
                                const fnMatch = txtString.match(/\b[A-Z0-9]{2}\s?\d{3,4}\b/i);
                                
                                if (isFlightNoNode || fnMatch) {
                                    if (!flightNo && fnMatch) flightNo = fnMatch[0];
                                    return;
                                }

                                // C. Aircraft check
                                if (txtLow.includes('airbus') || txtLow.includes('boeing') || txtLow.includes('atr') || txtLow.includes('embraer') || /^[A-Z]\d{2,3}/.test(txtString)) {
                                    aircraft = txtString;
                                    return;
                                }
                                
                                // D. If it's the first node and not anything else, it's likely the airline name for this leg
                                if (idx === 0 && !cabin && !aircraft && !flightNo) {
                                    legAirline = txtString;
                                }
                            });

                            // Fallback for cabin if jsname wasn't present
                            if (!cabin) {
                                detailNodes.forEach(node => {
                                    const txtLow = node.innerText.toLowerCase();
                                    if (txtLow.includes('ekonomi') || txtLow.includes('economy')) cabin = "Ekonomi";
                                    else if (txtLow.includes('bisnis') || txtLow.includes('business')) cabin = "Bisnis";
                                });
                            }

                            // 2. Parse amenities & legroom from .WtSsrd
                            const amenityNodes = leg.querySelectorAll('li.WtSsrd');
                            amenityNodes.forEach(node => {
                                const txt = node.innerText.replace(/\s+/g, ' ').trim();
                                const txtLow = txt.toLowerCase();
                                
                                // Legroom (English: "30 in legroom", ID: "Ruang kaki ... (71 cm)")
                                if (txtLow.includes('legroom') || txtLow.includes('ruang kaki')) {
                                    const match = txt.match(/(\d+\s*in|\d+\s*cm|lebih\s*sempit|lebih\s*lega)/i);
                                    legroom = match ? match[0] : txt;
                                } else {
                                    // Amenities
                                    if (txtLow.includes('wi-fi')) legAmenities.push('Wi-Fi');
                                    else if (txtLow.includes('daya') || txtLow.includes('power') || txtLow.includes('usb')) legAmenities.push('Power');
                                    else if (txtLow.includes('hiburan') || txtLow.includes('entertainment')) legAmenities.push('Entertainment');
                                    else if (txtLow.includes('makan') || txtLow.includes('food') || txtLow.includes('meal')) legAmenities.push('Meals');
                                }
                            });

                            if (cabin && !mainCabinClass) mainCabinClass = cabin;
                            if (aircraft && !mainAircraft) mainAircraft = aircraft;
                            if (legroom && !mainLegroom) mainLegroom = legroom;
                            if (legAirline && !mainAirline) mainAirline = legAirline;
                            legAmenities.forEach(a => { if (!mainAmenities.includes(a)) mainAmenities.push(a); });

                            segments.push({
                                depTime: legTimes[0],
                                arrTime: legTimes[legTimes.length - 1],
                                airline: legAirline || airline,
                                aircraft: aircraft,
                                flightNo: flightNo,
                                from: airportMatch ? airportMatch[1] : '',
                                to: airportMatch ? airportMatch[2] : '',
                                cabinClass: cabin,
                                legroom: legroom,
                                amenities: legAmenities
                            });
                        }
                    });

                    // Search for cabin class in main item if not found in legs
                    if (!mainCabinClass) {
                        if (text.toLowerCase().includes('ekonomi') || text.toLowerCase().includes('economy')) mainCabinClass = "Ekonomi";
                        else if (text.toLowerCase().includes('bisnis') || text.toLowerCase().includes('business')) mainCabinClass = "Bisnis";
                    }

                    // Parse layover info from the raw text
                    const layoverMatches = [];
                    const layoverRaw = text.match(/(\d+\s*hr\s*\d*\s*min|\d+\s*hr)\s+layover(?:\s+in\s+([^\n]+))?/gi) || [];
                    layoverRaw.forEach(m => {
                        const dur = m.match(/(\d+\s*hr\s*\d*\s*min|\d+\s*hr)/i);
                        const loc = m.match(/layover\s+in\s+(.+)/i);
                        layoverMatches.push({
                            duration: dur ? dur[0] : m,
                            airport: loc ? loc[1].trim() : ''
                        });
                    });

                    // --- Tokens & Detail Extraction ---
                    let tfu = null;
                    let tfs = null;
                    let aircraft = "";
                    let legroom = "";
                    let amenities = [];

                    if (dataId) {
                        dataChunks.forEach(chunk => {
                            if (!tfu) tfu = findInJSON(chunk, dataId, ['CjR', 'Cmx'], 70);
                            if (!tfs) tfs = findInJSON(chunk, dataId, ['CAAS', 'CBwQ'], 50);
                        });

                        const idIndex = pageSource.indexOf(dataId);
                        if (idIndex !== -1) {
                            const searchWindow = pageSource.substring(Math.max(0, idIndex - 8000), Math.min(pageSource.length, idIndex + 4000));
                            const acMatch = searchWindow.match(/(Airbus\s*A\d{3}|Boeing\s*\d{3}|ATR\s*\d{2}|Embraer\s*\d{3}|CRJ\s*\d{3})/i);
                            if (acMatch) aircraft = acMatch[0];

                            const lrMatch = searchWindow.match(/(\d+\s*in)\s*legroom/i) ||
                                searchWindow.match(/legroom\s*\((\d+\s*in)\)/i) ||
                                searchWindow.match(/pitch\s*of\s*(\d+\s*in)/i);
                            if (lrMatch) legroom = lrMatch[1] || lrMatch[0];

                            // Amenities
                            if (/wi[\-\s]?fi/i.test(searchWindow)) amenities.push('Wi-Fi');
                            if (/USB/i.test(searchWindow)) amenities.push('USB');
                            if (/power|outlet/i.test(searchWindow)) amenities.push('Power');
                            if (/stream|entertainment/i.test(searchWindow)) amenities.push('Entertainment');

                            if (!tfu) {
                                const tfuWinMatch = searchWindow.match(/"(CjR[A-Za-z0-9\+\/\-_]{70,}=*|Cmx[A-Za-z0-9\+\/\-_]{70,}=*)"/);
                                if (tfuWinMatch) tfu = tfuWinMatch[1];
                            }
                            if (!tfs) {
                                const tfsWinMatch = searchWindow.match(/"(CAAS[A-Za-z0-9\+\/\-_]{50,}=*|CBwQ[A-Za-z0-9\+\/\-_]{50,}=*)"/);
                                if (tfsWinMatch) tfs = tfsWinMatch[1];
                            }
                        }
                    }

                    // --- Emissions ---
                    const emissionsMatch = text.match(/(\d+\s*kg\s*CO2e)/i);
                    const emissionsToken = emissionsMatch ? emissionsMatch[0] : "";
                    const emissionsDiffMatch = text.match(/([+-]\d+%\s*emissions)/i) || text.match(/(Avg\s*emissions)/i);
                    const emissionsDiffToken = emissionsDiffMatch ? emissionsDiffMatch[0] : "";

                    // --- Final Data Merging ---
                    // Prefer aircraft/legroom/amenities from domestic segments if available
                    const finalAircraft = mainAircraft || aircraft;
                    const finalLegroom = mainLegroom || legroom;
                    const finalAmenities = mainAmenities.length > 0 ? mainAmenities : amenities;
                    
                    // Aggregate flight numbers from segments or fallback to text regex
                    let finalFlightNos = segments.map(s => s.flightNo).filter(f => f);
                    if (finalFlightNos.length === 0) {
                        finalFlightNos = text.match(/\b[A-Z0-9]{2}\s?\d{3,4}\b/g) || [];
                    }

                    const stopsCountNum = stopsText === 'Nonstop' ? 0 : parseInt(stopsText) || 0;

                    return {
                        airline, depTime, arrTime, duration, price,
                        stops: stopsText, stopsCount: stopsCountNum,
                        tfs, tfu,
                        emissions: emissionsToken, emissionsDiff: emissionsDiffToken,
                        aircraft: finalAircraft, 
                        legroom: finalLegroom, 
                        amenities: finalAmenities,
                        flightNos: [...new Set(finalFlightNos)],
                        cabinClass: mainCabinClass,
                        segments,
                        layovers: layoverMatches
                    };
                } catch (e) {
                    return null;
                }
            }).filter(f => f && f.depTime);
        });

        console.log(JSON.stringify({
            success: true,
            data: flights.slice(0, 10),
            query: { origin, destination, date },
            url: url
        }));

    } catch (err) {
        console.log(JSON.stringify({ success: false, error: err.toString() }));
    } finally {
        await browser.close();
    }
})();
