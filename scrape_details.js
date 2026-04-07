const puppeteer = require('puppeteer');

(async () => {
    let browser;
    const callsign = process.argv[2];
    if (!callsign) {
        console.log(JSON.stringify({ success: false, error: "Callsign required" }));
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
        await page.setUserAgent(randomUA);
        await page.setViewport({ width: 1280, height: 800 });
        
        // Go to specific flight page
        const url = `https://www.flightradar24.com/${callsign}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
        
        // Wait for the aircraft panel to be definitely present
        await page.waitForSelector('[data-testid="aircraft-panel"]', { timeout: 20000 }).catch(() => {
             console.error("Timeout waiting for aircraft-panel");
        });
        
        // Final settle time
        await new Promise(r => setTimeout(r, 2000));
        
        const details = await page.evaluate(async () => {
            const getTid = (tid) => {
                const el = document.querySelector(`[data-testid="${tid}"]`);
                if (el && el.innerText.trim() !== "") {
                    return el.innerText.trim();
                }
                return null;
            };

            // Recursive wait for specific elements if they aren't there yet
            const waitForData = async (tid, retries = 5) => {
                for (let i = 0; i < retries; i++) {
                   const val = getTid(tid);
                   if (val) return val;
                   await new Promise(r => setTimeout(r, 500));
                }
                return null;
            };

            const registration = await waitForData("aircraft-panel__registration");
            const model = getTid("aircraft-panel__model");
            
            const callsign = getTid("aircraft-panel__header__callsign");
            const flightNumber = getTid("aircraft-panel__header__flight-number");
            
            // Labels for MSN and Age are more varied, keep generic lookup
            const getByLabel = (labelStr) => {
                const labels = Array.from(document.querySelectorAll('label, p.text-xs.uppercase'));
                const target = labels.find(l => l.innerText.includes(labelStr));
                if (target && target.parentElement) {
                    const val = target.parentElement.querySelector('p, div.font-semibold, span');
                    return val ? val.innerText.trim() : null;
                }
                return null;
            };

            const serialNumber = getByLabel("MSN") || getByLabel("SERIAL NUMBER");
            const age = getByLabel("AGE");
            
            // Times using stable testids
            const scheduledDep = getTid("aircraft-panel__scheduled-departure") || "-";
            const scheduledArr = getTid("aircraft-panel__scheduled-arrival") || "-";
            const actualDep = getTid("aircraft-panel__actual-departure") || "-";
            const estimatedArr = getTid("aircraft-panel__estimated-arrival") || "-";
            
            // Wait for 2.5s for React progress bar animation to complete locally via headless paint
            await new Promise(r => setTimeout(r, 2500));
            
            // Progress Bar (can be blue or yellow depending on status)
            const progressEl = document.querySelector('.bg-blue-500.h-1, .bg-yellow-500.h-1, .h-1[style*="width"]');
            const progress = progressEl ? progressEl.style.width : "0%";
            
            const elapsed = getTid("aircraft-panel__flight-time-elapsed") || "-";
            const remaining = (getTid("aircraft-panel__flight-time-remaining") || "").replace(/\n/g, ' ').trim() || "-";

            const barometricAlt = getTid("aircraft-panel__calibrated-altitude") || getByLabel("Barometric alt.") || "-";
            const groundSpeed = getTid("aircraft-panel__ground-speed") || getByLabel("Ground speed") || "-";

            return {
                registration,
                model,
                serialNumber,
                age,
                scheduledDep,
                scheduledArr,
                actualDep,
                estimatedArr,
                progress,
                elapsed,
                remaining,
                callsign,
                flightNumber,
                barometricAlt,
                groundSpeed
            };
        });

        // Click "More info" to get Terminal/Gate if available
        try {
            const moreInfoBtn = await page.$('.cursor-pointer.text-blue-500');
            if (moreInfoBtn) {
                await moreInfoBtn.click();
                await new Promise(r => setTimeout(r, 1000));
                
                const extraData = await page.evaluate(() => {
                    const labels = Array.from(document.querySelectorAll('label'));
                    const gateLabel = labels.find(l => l.innerText.includes("Gate"));
                    const terminalLabel = labels.find(l => l.innerText.includes("Terminal"));
                    
                    return {
                        gate: gateLabel && gateLabel.nextElementSibling ? gateLabel.nextElementSibling.innerText.trim() : "-",
                        terminal: terminalLabel && terminalLabel.nextElementSibling ? terminalLabel.nextElementSibling.innerText.trim() : "-"
                    };
                });
                Object.assign(details, extraData);
            }
        } catch (e) {}

        console.log(JSON.stringify({ success: true, data: details }));
        
    } catch (err) {
        console.log(JSON.stringify({ success: false, error: err.toString() }));
    } finally {
        if (browser) await browser.close();
    }
})();
