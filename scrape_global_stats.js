const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--window-size=1920,1080'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const results = {
            success: false,
            total: 0,
            total_raw: "0",
            emergencies: [],
            topModels: [],
            topTracked: [],
            stats: {
                last24h: 0,
                avg7d: 0,
                trend: 0
            },
            popularRoutes: {
                origins: [],
                destinations: []
            }
        };

        // 1. Get Top Tracked (Improved DOM Scraping for Desktop View)
        try {
            await page.goto('https://www.flightradar24.com/', { waitUntil: 'networkidle2', timeout: 35000 });
            
            // Wait for the 'Most tracked flights' label to be present in the document
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('h2, h3, div, span'))
                    .some(el => el.innerText.includes('Most tracked flights'));
            }, { timeout: 15000 }).catch(() => {});

            results.topTracked = await page.evaluate(() => {
                // Find all list wrappers or containers likely holding flight lists
                const listWrappers = document.querySelectorAll('[data-testid="list-wrapper"], .most-tracked-flights, [class*="most-tracked"]');
                let targetContainer = null;
                
                for (const wrapper of listWrappers) {
                    if (wrapper.innerText.includes('1.') || wrapper.children.length > 3) {
                        targetContainer = wrapper;
                        break;
                    }
                }

                if (!targetContainer) {
                    // Final fallback: look for any container with numbered lists like "1. ABC123"
                    const candidates = Array.from(document.querySelectorAll('div')).filter(d => 
                        d.children.length >= 5 && d.innerText.match(/1\.\s+[A-Z0-9]+/)
                    );
                    targetContainer = candidates[0];
                }

                if (targetContainer) {
                    const items = Array.from(targetContainer.querySelectorAll(':scope > div, li')).slice(0, 5);
                    return items.map(el => {
                        const text = el.innerText.split('\n');
                        const flightNo = text.find(t => t.match(/^[A-Z0-9]{3,8}$/)) || text[0] || "???";
                        const count = text.find(t => t.match(/[0-9,]{3,}/)) || "0";
                        const route = text.find(t => t.includes('–')) || "Active Flight";
                        
                        return { 
                            flightNo: flightNo.replace(/^[0-9]+\.\s+/, ''), 
                            count: count.replace(/[^0-9,]/g, ''), 
                            route 
                        };
                    }).filter(f => f.flightNo !== "???");
                }
                return [];
            });
        } catch (e) {
            console.error("Top Tracked process failed:", e.message);
        }

        // 2. Scrape Statistics from Highcharts
        try {
            await page.goto('https://www.flightradar24.com/data/statistics', { waitUntil: 'networkidle2', timeout: 30000 });
            const stats = await page.evaluate(() => {
                if (typeof Highcharts === 'undefined' || !Highcharts.charts || Highcharts.charts.length === 0) {
                    return null;
                }
                const chart = Highcharts.charts[0];
                const flightSeries = chart.series.find(s => s.name.toLowerCase().includes("number of flights"));
                const avgSeries = chart.series.find(s => s.name.toLowerCase().includes("moving average"));
                
                if (!flightSeries || !avgSeries) return null;
                
                const last24h = flightSeries.data[flightSeries.data.length - 1].y;
                const avg7d = avgSeries.data[avgSeries.data.length - 1].y;
                
                return { last24h, avg7d };
            });

            if (stats) {
                results.stats.last24h = Math.round(stats.last24h);
                results.stats.avg7d = Math.round(stats.avg7d);
                if (results.stats.avg7d > 0) {
                    results.stats.trend = parseFloat(((results.stats.last24h - results.stats.avg7d) / results.stats.avg7d * 100).toFixed(1));
                }
            }
        } catch (e) {
            console.error("Stats process failed:", e.message);
        }

        // 3. Fetch Feed.js
        const feedUrl = 'https://data-cloud.flightradar24.com/zones/fcgi/feed.js';
        await page.goto(feedUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const feedResults = await page.evaluate(() => {
            try {
                const pre = document.querySelector('pre');
                const content = pre ? pre.innerText : document.body.innerText;
                const json = JSON.parse(content);
                
                if (json && json.full_count !== undefined) {
                    const count = json.full_count;
                    const formattedCount = new Intl.NumberFormat().format(count);
                    const emergencies = [];
                    const modelCounts = {};
                    const originCounts = {};
                    const destCounts = {};
                    const airlineCounts = {};
                    const brandCounts = {};
                    
                    const getBrand = (m) => {
                        if (!m) return null;
                        const u = m.toUpperCase();
                        // Commercial Giants
                        if (u.startsWith('A3') || u.startsWith('A2') || u.startsWith('BCS')) return 'Airbus';
                        if (u.startsWith('B7') || u.startsWith('B3') || u.startsWith('MD') || u.startsWith('B1')) return 'Boeing';
                        if (u.startsWith('E1') || u.startsWith('E2') || u.startsWith('ERJ') || u.startsWith('E5')) return 'Embraer';
                        
                        // Regional & Business Jets
                        if (u.startsWith('CRJ') || u.startsWith('CL3') || u.startsWith('CL6') || u === 'GLEX' || u.startsWith('GL5') || u.startsWith('GL6') || u.startsWith('GL7') || u.startsWith('BD')) return 'Bombardier';
                        if (u.startsWith('G1') || u.startsWith('G2') || u.startsWith('G4') || u.startsWith('G5') || u.startsWith('G6') || u.startsWith('GLF')) return 'Gulfstream';
                        if (u.startsWith('FA') || u.startsWith('F2T') || u.startsWith('F90')) return 'Dassault Falcon';
                        if (u.startsWith('PC')) return 'Pilatus';
                        if (u.startsWith('LJ')) return 'Learjet';
                        if (u.startsWith('HA4')) return 'HondaJet';
                        if (u.startsWith('H25') || u.startsWith('HS1')) return 'Hawker';
                        if (u === 'BTB2') return 'Baykar';
                        
                        // General Aviation
                        if (u.startsWith('C1') || u.startsWith('C2') || u.startsWith('C3') || u.startsWith('C4') || u.startsWith('C5') || u.startsWith('C6') || u.startsWith('C7') || u.startsWith('C8')) return 'Cessna';
                        if (u.startsWith('BE') || u.startsWith('B20') || u.startsWith('B35') || u.startsWith('C90') || u === 'E55') return 'Beechcraft';
                        if (u.startsWith('PA') || u.startsWith('P28') || u.startsWith('P32') || u.startsWith('P44') || u.startsWith('P46')) return 'Piper';
                        if (u.startsWith('DA')) return 'Diamond';
                        if (u.startsWith('SR') || u.startsWith('SF5')) return 'Cirrus';
                        if (u.startsWith('M20')) return 'Mooney';
                        if (u.startsWith('TBM')) return 'Socata';
                        if (u === 'PIVI') return 'Pipistrel';
                        
                        // Russian & Eastern Manufacturers
                        if (u.startsWith('IL')) return 'Ilyushin';
                        if (u.startsWith('AN')) return 'Antonov';
                        if (u.startsWith('TU')) return 'Tupolev';
                        if (u.startsWith('YK') || u.startsWith('MC2')) return 'Yakovlev';
                        if (u.startsWith('SU') || u.startsWith('SSJ')) return 'Sukhoi';
                        
                        // Other Major Manufacturers
                        if (u.startsWith('AT')) return 'ATR';
                        if (u.startsWith('DH') || u.startsWith('DHC')) return 'De Havilland';
                        if (u.startsWith('C9') || u.startsWith('ARJ')) return 'COMAC';
                        if (u.startsWith('SF') || u.startsWith('SAAB')) return 'Saab';
                        if (u.startsWith('F7') || u.startsWith('F1') || u.startsWith('F2')) return 'Fokker';
                        if (u.startsWith('PC')) return 'Pilatus';
                        if (u.startsWith('D22') || u.startsWith('D32') || u.startsWith('DO')) return 'Dornier';
                        if (u.startsWith('C13') || u.startsWith('L10') || u.startsWith('L18') || u.startsWith('P3') || u.startsWith('P8')) return 'Lockheed';
                        
                        // Boeing Military (Special cases not starting with B)
                        if (u.startsWith('E3') || u.startsWith('E6') || u.startsWith('C17')) return 'Boeing';
                        
                        // Helicopters
                        if (u.startsWith('B4') || u.startsWith('B20')) return 'Bell';
                        if (u.startsWith('EC') || u.startsWith('AS') || u.startsWith('H1') || u.startsWith('H2')) return 'Airbus Helicopters';
                        if (u.startsWith('R2') || u.startsWith('R4') || u.startsWith('R6')) return 'Robinson';
                        if (u.startsWith('S7') || u.startsWith('S9') || u.startsWith('UH6')) return 'Sikorsky';
                        if (u.startsWith('A1') || u.startsWith('A13') || u.startsWith('AW1')) return 'Leonardo / Agusta';
                        
                        return null; // Return null to trigger unbranded aggregation
                    };
                    
                    const unbrandedCodes = new Set();
                    let unbrandedTotal = 0;
                    
                    const flightMap = {};
                    Object.keys(json).forEach(key => {
                        if (['full_count', 'version', 'stats'].includes(key)) return;
                        const i = json[key];
                        if (!Array.isArray(i)) return;
                        
                        const fn = i[13] || i[16];
                        if (fn) flightMap[fn] = { vs: i[15] || 0, alt: i[4] || 0, speed: i[5] || 0 };
                        
                        if (i[6] === '7700' || i[6] === '7600') {
                            emergencies.push({
                                flightNo: i[13] || i[16] || "Unknown",
                                callsign: i[16] || "",
                                squawk: i[6],
                                status: i[6] === '7700' ? 'EMERGENCY' : 'RADIO FAILURE',
                                type: i[8] || "UNK",
                                origin: i[11] || "???",
                                dest: i[12] || "???",
                                alt: i[4] || 0,
                                speed: i[5] || 0,
                                verticalSpeed: i[15] || 0
                            });
                        }
                        
                        const model = i[8];
                        if (model && model.length > 1) {
                            modelCounts[model] = (modelCounts[model] || 0) + 1;
                            const brand = getBrand(model);
                            if (brand && brand !== 'Unknown') {
                                brandCounts[brand] = (brandCounts[brand] || 0) + 1;
                            } else {
                                unbrandedCodes.add(model.toUpperCase());
                                unbrandedTotal++;
                            }
                        }
                        
                        if (i[11] && i[11].length === 3) originCounts[i[11]] = (originCounts[i[11]] || 0) + 1;
                        if (i[12] && i[12].length === 3) destCounts[i[12]] = (destCounts[i[12]] || 0) + 1;

                        // Airline Extraction (ICAO 3-letter prefix from callsign)
                        const callsign = i[16];
                        if (callsign && callsign.length >= 3) {
                            const airlineCode = callsign.substring(0, 3);
                            if (airlineCode.match(/^[A-Z]{3}$/)) {
                                airlineCounts[airlineCode] = (airlineCounts[airlineCode] || 0) + 1;
                            }
                        }
                    });

                    // Aggregate unbranded codes into one category
                    if (unbrandedTotal > 0) {
                        const codesArray = Array.from(unbrandedCodes);
                        const label = codesArray.slice(0, 5).join(', ') + (codesArray.length > 5 ? ', ...' : '');
                        brandCounts[label] = unbrandedTotal;
                    }
                    
                    const topModels = Object.entries(modelCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).map(x=>({model:x[0], count:x[1]}));
                    const topOrigins = Object.entries(originCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).map(x=>({iata:x[0], count:x[1]}));
                    const topDests = Object.entries(destCounts).sort((a,b)=>b[1]-a[1]).slice(0,15).map(x=>({iata:x[0], count:x[1]}));
                    const topAirlines = Object.entries(airlineCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>({code:x[0], count:x[1]}));
                    const topBrands = Object.entries(brandCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>({brand:x[0], count:x[1]}));

                    return { 
                        success: true, 
                        total: count, 
                        total_raw: formattedCount, 
                        emergencies, 
                        topModels, 
                        topAirlines,
                        topBrands,
                        popularRoutes: { origins: topOrigins, destinations: topDests },
                        telemetryMap: flightMap 
                    };
;
                }
            } catch (e) { return { success: false, error: e.message }; }
            return { success: false };
        });

        if (feedResults.success) {
            results.success = true;
            results.total = feedResults.total;
            results.total_raw = feedResults.total_raw;
            results.emergencies = feedResults.emergencies;
            results.topModels = feedResults.topModels;
            results.topAirlines = feedResults.topAirlines;
            results.topBrands = feedResults.topBrands;
            results.popularRoutes = feedResults.popularRoutes;

            // Enrich Top Tracked with real telemetry from the feed
            if (feedResults.telemetryMap) {
                results.topTracked.forEach(f => {
                    const tel = feedResults.telemetryMap[f.flightNo];
                    if (tel) {
                        f.verticalSpeed = tel.vs;
                        f.alt = tel.alt;
                        f.speed = tel.speed;
                    }
                });
            }
        }

        console.log(JSON.stringify(results));

    } catch (error) {
        console.log(JSON.stringify({ success: false, error: error.message }));
    } finally {
        await browser.close();
    }
})();
