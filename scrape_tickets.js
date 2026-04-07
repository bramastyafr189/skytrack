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

                    // --- Segment and Layover Parsing using tvtJdb anchor elements ---
                    // tvtJdb divs always appear between segments in a transit flight.
                    // Strategy: split item innerText at each tvtJdb's text to isolate leg chunks.

                    const segments = [];
                    let mainCabinClass = "";
                    let mainAircraft = "";
                    let mainLegroom = "";
                    let mainAmenities = [];

                    // Helper: parse a single leg's text chunk into structured data
                    function parseLegText(legText, fallbackAirline) {
                        const legTimes = legText.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi) || [];
                        if (legTimes.length < 2) return null;

                        const airportMatch = legText.match(/([A-Z]{3})\s*[–\-]\s*([A-Z]{3})/);
                        const aircraftMatch = legText.match(/(Boeing|Airbus|ATR|Embraer|CRJ|Bombardier)\s*[A-Z0-9-]*\s*\d{2,4}[^\n]*/i);
                        // Flight number: 2-letter IATA code + 1-4 digits (e.g. EK 357, ID 7159)
                        const fnMatch = legText.match(/\b([A-Z]{2})\s?(\d{1,4})\b/);
                        const durationList = legText.match(/\d+\s*hr(?:s)?\s*\d*\s*min(?:s)?|\d+\s*hr(?:s)?/gi) || [];

                        const cabin = (() => {
                            const tl = legText.toLowerCase();
                            if (tl.includes('economy')) return 'Economy';
                            if (tl.includes('business')) return 'Business';
                            if (tl.includes('premium')) return 'Premium Economy';
                            if (tl.includes('first')) return 'First Class';
                            return '';
                        })();

                        const legAmenities = [];
                        if (/wi[\-\s]?fi|wifi/i.test(legText)) legAmenities.push('Wi-Fi');
                        if (/\busb\b/i.test(legText)) legAmenities.push('USB');
                        if (/power outlet|in-seat power/i.test(legText)) legAmenities.push('Power');
                        if (/entertainment|stream\s+media/i.test(legText)) legAmenities.push('Entertainment');
                        if (/meal|food|beverage/i.test(legText)) legAmenities.push('Meals');

                        const cmMatch = legText.match(/(\d+)\s*cm(?:\s*legroom|\s*\))/i);
                        const inMatch = legText.match(/(\d+)\s*in\s+legroom/i);
                        const legroom = cmMatch ? cmMatch[1] + ' cm' : (inMatch ? inMatch[1] + ' in' : '');

                        // Duration: skip the first match in leg 0 since it may be total journey duration.
                        // Use the LAST duration found per leg chunk (most specific).
                        const legDuration = durationList.length > 0 ? durationList[durationList.length - 1] : '';

                        return {
                            depTime: legTimes[0].replace(/\s+/g, ' '),
                            arrTime: legTimes[legTimes.length - 1].replace(/\s+/g, ' '),
                            airline: fallbackAirline,
                            aircraft: aircraftMatch ? aircraftMatch[0].replace(/\s+/g, ' ').trim() : '',
                            flightNo: fnMatch ? (fnMatch[1] + ' ' + fnMatch[2]) : '',
                            from: airportMatch ? airportMatch[1] : '',
                            to: airportMatch ? airportMatch[2] : '',
                            cabinClass: cabin,
                            legroom,
                            amenities: legAmenities,
                            duration: legDuration
                        };
                    }

                    // Step 1: Find all tvtJdb layover divs in this flight item
                    const tvtJdbEls = Array.from(item.querySelectorAll('[class*="tvtJdb"]'));

                    // Step 2: Build layoverMatches from tvtJdb elements
                    const layoverMatches = [];
                    tvtJdbEls.forEach(ld => {
                        // Normalize non-breaking spaces
                        const rawText = ld.innerText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                        const durMatch = rawText.match(/(\d+\s*hr(?:s)?\s*\d*\s*min(?:s)?|\d+\s*hr(?:s)?)/i);
                        // IATA code is in <span dir="ltr">(DXB)</span>
                        const iataSpan = ld.querySelector('span[dir="ltr"]');
                        const iataCode = iataSpan ? iataSpan.innerText.replace(/[()]/g, '').trim() : '';
                        // City name is text before the IATA span (after "layover")
                        const afterLayover = rawText.replace(/.*?layover\s*/i, '');
                        const cityName = afterLayover.replace(iataCode, '').replace(/[()]/g, '').trim();
                        const airportLabel = iataCode
                            ? (cityName ? `${cityName} (${iataCode})` : `(${iataCode})`)
                            : cityName;
                        layoverMatches.push({
                            duration: durMatch ? durMatch[0].toLowerCase().replace(/\s+/g, ' ') : rawText,
                            airport: airportLabel
                        });
                    });

                    // Step 3: If we have tvtJdb layover elements, split text for segments
                    if (tvtJdbEls.length > 0) {
                        let fullText = text.replace(/\u00a0/g, ' ');
                        const legTexts = [];
                        let remaining = fullText;

                        for (const ld of tvtJdbEls) {
                            const ldText = ld.innerText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                            const splitAt = remaining.indexOf(ldText);
                            if (splitAt !== -1) {
                                legTexts.push(remaining.substring(0, splitAt).trim());
                                remaining = remaining.substring(splitAt + ldText.length).trim();
                            } else {
                                legTexts.push(remaining.trim());
                                remaining = '';
                            }
                        }
                        legTexts.push(remaining.trim());

                        legTexts.forEach((legText) => {
                            if (!legText) return;
                            const seg = parseLegText(legText, airline);
                            if (seg) {
                                if (seg.cabinClass && !mainCabinClass) mainCabinClass = seg.cabinClass;
                                if (seg.aircraft && !mainAircraft) mainAircraft = seg.aircraft;
                                if (seg.legroom && !mainLegroom) mainLegroom = seg.legroom;
                                seg.amenities.forEach(a => { if (!mainAmenities.includes(a)) mainAmenities.push(a); });
                                segments.push(seg);
                            }
                        });
                    }

                    // Fallback: parse flat text for cabin/aircraft if no segments found
                    if (!mainCabinClass) {
                        const tl = text.toLowerCase();
                        if (tl.includes('economy')) mainCabinClass = "Economy";
                        else if (tl.includes('business')) mainCabinClass = "Business";
                        else if (tl.includes('premium')) mainCabinClass = "Premium Economy";
                    }

                    // --- Token & Detail Extraction ---
                    let tfu = null;
                    let tfs = null;
                    let aircraft = "";
                    let legroom = "";
                    let amenities = [];
                    let cabin = "";
                    let flightNoMain = "";
                    let airlineMain = "";

                    // Parse main item level if no segments were found
                    // This handles cases where Google Flights doesn't expand flight details
                    if (segments.length === 0) {
                        const mainDetailNodes = item.querySelectorAll('span.Xsgmwe');
                        mainDetailNodes.forEach((node, idx) => {
                            const txtString = node.innerText.replace(/\s+/g, ' ').trim();
                            const txtLow = txtString.toLowerCase();
                            if (!txtString) return;

                            // Cabin class from jsname="Pvlywd"
                            if (node.getAttribute('jsname') === 'Pvlywd') {
                                if (txtLow.includes('ekonomi') || txtLow.includes('economy')) cabin = "Economy";
                                else if (txtLow.includes('bisnis') || txtLow.includes('business')) cabin = "Business";
                                else if (txtLow.includes('premium')) cabin = "Premium Economy";
                                else if (txtLow.includes('first')) cabin = "First Class";
                                else cabin = txtString;
                                return;
                            }

                            // Flight number
                            const nodeClasses = node.className || "";
                            const fnMatch = txtString.match(/\b[A-Z0-9]{2}\s?\d{1,4}\b/i);
                            if ((nodeClasses.includes('sI2Nye') || nodeClasses.includes('QS0io')) && fnMatch && !flightNoMain) {
                                flightNoMain = fnMatch[0];
                                return;
                            }

                            // Aircraft
                            const aircraftMatch = txtString.match(/(Boeing|Airbus|ATR|Embraer|CRJ|Bombardier)[^\d]*(\d{2,4})/i);
                            if (aircraftMatch && !aircraft) {
                                aircraft = txtString.trim();
                                return;
                            }

                            // Airline name (first valid span)
                            if (idx === 0 && !airlineMain && !cabin && !aircraft && txtString.length > 2) {
                                airlineMain = txtString;
                            }
                        });
                    }

                    // ALSO parse main item for amenities & legroom even if segments exist
                    // This ensures we get all details from the main flight card
                    const mainAmenityNodes = item.querySelectorAll('li.WtSsrd');
                    mainAmenityNodes.forEach(node => {
                        const txt = node.innerText.replace(/\s+/g, ' ').trim();
                        const txtLow = txt.toLowerCase();
                        
                        // Legroom parsing - multiple formats
                        if (txtLow.includes('legroom') || txtLow.includes('ruang kaki') || txtLow.includes('above-average')) {
                            // Format: "Above-average legroom (81 cm)" or "30 in legroom"
                            const cmMatch = txt.match(/(\d+)\s*cm/i);
                            const inMatch = txt.match(/(\d+)\s*in/i);
                            if (cmMatch && !legroom) legroom = cmMatch[0];
                            else if (inMatch && !legroom) legroom = inMatch[0];
                            else if (!legroom) legroom = txt.replace(/above-average\s*/i, '').trim();
                        } else {
                            // Amenities
                            if (txtLow.includes('wi-fi') || txtLow.includes('wifi') || txtLow.includes('wi fi')) {
                                if (!amenities.includes('Wi-Fi')) amenities.push('Wi-Fi');
                            }
                            if (txtLow.includes('usb') && !amenities.includes('USB')) amenities.push('USB');
                            if ((txtLow.includes('outlet') || txtLow.includes('power') || txtLow.includes('daya')) && !amenities.includes('Power')) amenities.push('Power');
                            if ((txtLow.includes('entertainment') || txtLow.includes('stream') || txtLow.includes('media')) && !amenities.includes('Entertainment')) amenities.push('Entertainment');
                            if ((txtLow.includes('meal') || txtLow.includes('food') || txtLow.includes('makan')) && !amenities.includes('Meals')) amenities.push('Meals');
                        }
                    });

                    if (dataId) {
                        dataChunks.forEach(chunk => {
                            if (!tfu) tfu = findInJSON(chunk, dataId, ['CjR', 'Cmx'], 70);
                            if (!tfs) tfs = findInJSON(chunk, dataId, ['CAAS', 'CBwQ'], 50);
                        });

                        const idIndex = pageSource.indexOf(dataId);
                        if (idIndex !== -1) {
                            const searchWindow = pageSource.substring(Math.max(0, idIndex - 8000), Math.min(pageSource.length, idIndex + 4000));
                            const acMatch = searchWindow.match(/(Boeing|Airbus|ATR|Embraer|CRJ|Bombardier)\s*[A-Z]?\d{2,4}/i);
                            if (acMatch && !aircraft) aircraft = acMatch[0];

                            // Enhanced legroom parsing from search window
                            const lrMatch = searchWindow.match(/(\d+)\s*cm\s*legroom/i) ||
                                searchWindow.match(/(\d+\s*in)\s*legroom/i) ||
                                searchWindow.match(/legroom\s*\((\d+\s*(?:in|cm))\)/i) ||
                                searchWindow.match(/pitch\s*of\s*(\d+\s*in)/i) ||
                                searchWindow.match(/(\d+)\s*cm/i);
                            if (lrMatch && !legroom) legroom = lrMatch[1] || lrMatch[0];

                            // Amenities from search window
                            if ((/wi[\-\s]?fi/i.test(searchWindow) || /wifi/i.test(searchWindow)) && !amenities.includes('Wi-Fi')) amenities.push('Wi-Fi');
                            if (/\bUSB\b/i.test(searchWindow) && !amenities.includes('USB')) amenities.push('USB');
                            if (/(power|outlet|daya)/i.test(searchWindow) && !amenities.includes('Power')) amenities.push('Power');
                            if (/(stream|entertainment|hiburan)/i.test(searchWindow) && !amenities.includes('Entertainment')) amenities.push('Entertainment');

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
                    const finalCabinClass = mainCabinClass || cabin;
                    const finalLegroom = mainLegroom || legroom;
                    const finalAmenities = mainAmenities.length > 0 ? mainAmenities : amenities;
                    
                    // Aggregate flight numbers from segments or fallback to main or text regex
                    let finalFlightNos = segments.map(s => s.flightNo).filter(f => f);
                    if (finalFlightNos.length === 0 && flightNoMain) {
                        finalFlightNos = [flightNoMain];
                    }
                    if (finalFlightNos.length === 0) {
                        finalFlightNos = text.match(/\b[A-Z0-9]{2}\s?\d{1,4}\b/g) || [];
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
                        cabinClass: finalCabinClass,
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
