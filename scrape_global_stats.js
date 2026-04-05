const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Navigate to FR24
        await page.goto('https://www.flightradar24.com/', { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for potential dynamic content
        await new Promise(r => setTimeout(r, 5000));

        // Function to extract stats from the current page state
        const getStatsData = async () => {
            return await page.evaluate(() => {
                const spans = Array.from(document.querySelectorAll('.font-normal'));
                for (const span of spans) {
                    const txt = span.innerText.trim();
                    if (/\d+[\.\,]?\d*\/\d+[\.\,]?\d*/.test(txt)) {
                        const parts = txt.split('/');
                        return {
                            raw: txt,
                            total_raw: parts[1],
                            total: parseInt(parts[1].replace(/[\.,]/g, ''), 10)
                        };
                    }
                }
                return null;
            });
        };

        let statsData = await getStatsData();

        // If not found, try to enable the Statistics widget via UI
        if (!statsData) {
            try {
                // Click Widgets button
                const widgetBtn = await page.$('#bottom-panel__widgets-button');
                if (widgetBtn) {
                    await widgetBtn.click();
                    await new Promise(r => setTimeout(r, 2000));

                    // Click Statistics toggle (it's often one of the first few buttons)
                    await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('main button.relative.flex.rounded-sm'));
                        // Find button that contains 'Statistics' text
                        const statsBtn = buttons.find(b => b.innerText.includes('Statistics'));
                        if (statsBtn) statsBtn.click();
                    });
                    
                    await new Promise(r => setTimeout(r, 3000));
                    statsData = await getStatsData();
                }
            } catch (e) {
                console.error("Error toggling widgets:", e.message);
            }
        }

        if (statsData) {
            console.log(JSON.stringify({ success: true, ...statsData }));
        } else {
            console.log(JSON.stringify({ success: false, error: "Statistics not found after retry" }));
        }

    } catch (error) {
        console.log(JSON.stringify({ success: false, error: error.message }));
    } finally {
        await browser.close();
    }
})();
