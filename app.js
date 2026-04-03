// Aviation Tracker - Dynamic Data Fetch

let flights = [];
let lastSyncTime = null;

function formatLastSync() {
    if (!lastSyncTime) return "Belum disinkron";
    return `Update: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const flightListEl = document.getElementById("flightList");
const searchInput = document.getElementById("flightSearch");
const modal = document.getElementById("detailsModal");
const closeModalBtn = document.getElementById("closeModal");
const modalBody = document.getElementById("modalBody");

// Fetch data dynamically from PHP Puppeteer Scraper (pulling live from FR24)
// Fetch data dynamically from PHP Puppeteer Scraper (pulling live from FR24)
async function loadRealData(isManual = false) {
    if (isManual) {
        renderFlights([], true);
    }
    
    try {
        const url = isManual ? 'api_tracked.php?force=1' : 'api_tracked.php';
        const response = await fetch(url);
        if (!response.ok) throw new Error("HTTP error " + response.status);
        const jsonData = await response.json();
        
        if (jsonData.success && jsonData.data) {
            // Map Puppeteer output to our app format
            flights = jsonData.data;
        } else {
            throw new Error(jsonData.error || "Failed to fetch scraper data");
        }
        
        // Only update UI if we are in Radar (home) or in Hub Flights tab
        const isRadar = !document.querySelector('.segmented-control') && document.getElementById('navRadar').classList.contains('active');
        const isHubFlights = document.querySelector('.segmented-control') && currentHubTab === 'flights';
        
        if (isRadar || isHubFlights || isManual) {
            lastSyncTime = new Date();
            renderFlights(flights);
        }
        
        if (isManual && navigator.vibrate) navigator.vibrate(20);
    } catch (error) {
        console.error("Failed to load flight data:", error);
        if (isManual) {
            flightListEl.innerHTML = `<p style="text-align:center; color: var(--status-delayed); margin-top:40px;">Gagal memuat data live. Mencoba lagi dalam 5 menit.</p>`;
        }
    }
}

// Hub State Manager
let currentHubTab = 'flights'; // 'flights' or 'airports'

// Refactored renderFlights to be more flexible
function renderFlights(data, isLoading = false, container = flightListEl) {
    const isHubView = (container === flightListEl && document.querySelector('.segmented-control'));
    
    let headerHtml = `
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(14, 165, 233, 0.1); border-radius: 12px; border: 1px solid rgba(14, 165, 233, 0.2); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="color: var(--accent-blue-light); font-size: 14px; margin-bottom: 4px;">Top Tracked Flights</h3>
                <p style="font-size: 10px; color: var(--text-secondary); opacity: 0.8;">${formatLastSync()}</p>
            </div>
            <button id="refreshLiveBtn" style="background: var(--accent-blue); opacity: ${isLoading ? '0.5' : '1'}; border: none; cursor: ${isLoading ? 'wait' : 'pointer'}; color: white; padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 12px; display: flex; gap: 4px; align-items: center;">
                <ion-icon name="${isLoading ? 'sync' : 'refresh-outline'}" ${isLoading ? 'class="pulse-dot"' : ''}></ion-icon> 
                ${isLoading ? 'Updating...' : 'Tarik Live'}
            </button>
        </div>
    `;

    if (isHubView) {
        // If in Hub, we only replace the content below the tabs
        const contentDiv = document.getElementById('hubContent');
        if (contentDiv) {
            contentDiv.innerHTML = headerHtml;
            setupFlightList(data, isLoading, contentDiv);
        }
    } else {
        container.innerHTML = headerHtml;
        setupFlightList(data, isLoading, container);
    }
}

function setupFlightList(data, isLoading, container) {
    const btn = document.getElementById("refreshLiveBtn");
    if (btn) {
        btn.addEventListener("click", () => {
            if (!isLoading) loadRealData(true);
        });
    }

    if (isLoading) {
        const loader = document.createElement('div');
        loader.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <p style="color: var(--accent-blue-light); font-size: 14px;">Membuka Chrome di Latar Belakang...</p>
                <p style="color: var(--text-muted); font-size: 11px; margin-top: 4px;">Menyinkronkan data visual langsung dari FR24 (15-20s).</p>
            </div>
        `;
        container.appendChild(loader);
        return;
    }
    
    if (data.length === 0) {
        const empty = document.createElement('p');
        empty.style = "text-align:center; color: var(--text-muted); margin-top:40px;";
        empty.innerText = "No flights found.";
        container.appendChild(empty);
        return;
    }
    
    data.forEach((flight, index) => {
        const card = document.createElement("div");
        card.className = "flight-card";
        card.onclick = () => openModal(flight);
        
        const displayRank = flight.rank || `${index + 1}.`;
        
        card.innerHTML = `
            <div class="flight-header">
                <div class="airline-info">
                    <span style="background: var(--accent-blue); color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-right: 8px; font-family: var(--code-font);">${displayRank}</span>
                    <span class="flight-number">${flight.flightNo}</span>
                    <span class="airline-name">${flight.airline}</span>
                </div>
                <span class="status-badge ${flight.statusCode}">${flight.status}</span>
            </div>
            
            <div class="route-container">
                <div class="airport">
                    <span class="iata">${flight.origin}</span>
                    <span class="city">${flight.originCity}</span>
                </div>
                <div class="flight-path">
                    <ion-icon name="airplane" class="airplane-icon"></ion-icon>
                    <div class="path-line"></div>
                </div>
                <div class="airport dest">
                    <span class="iata">${flight.dest}</span>
                    <span class="city">${flight.destCity}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Refactored renderDisruptions
function renderDisruptions(dataList = null, isLoading = false, container = flightListEl) {
    if (dataList) disruptions = dataList;
    const isHubView = (container === flightListEl && document.querySelector('.segmented-control'));

    let headerHtml = `
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.2); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h3 style="color: var(--status-delayed); font-size: 14px; margin-bottom: 4px;">Airport Weather & Delays</h3>
                <p style="font-size: 10px; color: var(--text-secondary); opacity: 0.8;">${formatLastSync()}</p>
            </div>
            <button id="trigBtn" style="background: var(--accent-blue); opacity: ${isLoading ? '0.5' : '1'}; border: none; cursor: ${isLoading ? 'wait' : 'pointer'}; color: white; padding: 8px 12px; border-radius: 8px; font-weight: 600; font-size: 12px; display: flex; gap: 4px; align-items: center;">
                <ion-icon name="${isLoading ? 'sync' : 'cloud-download-outline'}" ${isLoading ? 'class="pulse-dot"' : ''}></ion-icon> 
                ${isLoading ? 'Scraping...' : 'Tarik Live'}
            </button>
        </div>
    `;

    if (isHubView) {
        const contentDiv = document.getElementById('hubContent');
        if (contentDiv) {
            contentDiv.innerHTML = headerHtml;
            setupDisruptionList(isLoading, contentDiv);
        }
    } else {
        container.innerHTML = headerHtml;
        setupDisruptionList(isLoading, container);
    }
}

function setupDisruptionList(isLoading, container) {
    const btn = document.getElementById("trigBtn");
    if (btn) {
        btn.addEventListener("click", () => {
            if (!isLoading) triggerScrape(true);
        });
    }

    if (isLoading) {
        const loader = document.createElement('div');
        loader.innerHTML = `
            <div id="disruptionLoadingMsg" style="text-align: center; padding: 20px;">
                <p style="color: var(--accent-blue-light); font-size: 13px; font-weight: 500;">Menarik data cuaca & index...</p>
            </div>
        `;
        container.appendChild(loader);
        return;
    }

    const listToRender = disruptions;
    
    if (listToRender.length === 0) {
        const empty = document.createElement('p');
        empty.style = "text-align:center; color: var(--text-muted); margin-top:40px; font-size: 13px;";
        empty.innerText = "Data tidak tersedia. Silakan tekan 'Tarik Live'.";
        container.appendChild(empty);
        return;
    }
    
    listToRender.forEach(d => {
        const dCard = document.createElement("div");
        dCard.className = "flight-card";
        dCard.style.padding = "16px";
        dCard.onclick = () => openModal(d);
        
        dCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-family: var(--code-font); font-weight: bold; color: var(--accent-blue-light); font-size: 16px;">
                        ${d.iata}
                    </div>
                    <div>
                        <h4 style="font-size: 17px; font-weight: 600;">${d.airport}</h4>
                        <div style="display: flex; gap: 10px; margin-top: 4px; color: var(--text-muted); font-size: 12px;">
                            <span style="display: flex; align-items: center; gap: 4px;"><ion-icon name="thermometer-outline"></ion-icon> ${d.temp || "N/A"}</span>
                            <span style="display: flex; align-items: center; gap: 4px;"><ion-icon name="swap-horizontal-outline"></ion-icon> ${d.wind || "N/A"}</span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 22px; font-weight: bold; font-family: var(--code-font); color: var(--status-delayed);">${d.cancellations || 0}</span>
                    <p style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: bold;">Canceled</p>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px;">
                <div style="border-right: 1px solid rgba(255,255,255,0.05); padding-right: 8px;">
                    <p style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Arrivals Index</p>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--status-delayed);"></span>
                        <span style="font-size: 18px; font-weight: bold; font-family: var(--code-font);">${d.arrIdx || "0.0"}</span>
                    </div>
                </div>
                <div style="padding-left: 8px;">
                    <p style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Departures Index</p>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: #facc15;"></span>
                        <span style="font-size: 18px; font-weight: bold; font-family: var(--code-font);">${d.depIdx || "0.0"}</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(dCard);
    });
}

// NEW: Global Hub View Controller
function renderGlobalHub(activeTab = 'flights') {
    currentHubTab = activeTab;
    document.querySelector('.header-title h1').innerText = "Global Hub";
    document.querySelector('.live-indicator-wrapper').style.display = "none";
    
    flightListEl.innerHTML = `
        <div class="hub-header">
            <h2>Real-time Stats</h2>
            <p>Monitors global aviation metrics and airport health.</p>
        </div>
        
        <div class="segmented-control">
            <button class="tab-btn ${activeTab === 'flights' ? 'active' : ''}" id="tabFlights">
                <ion-icon name="airplane-outline"></ion-icon>
                <span>Flights</span>
            </button>
            <button class="tab-btn ${activeTab === 'airports' ? 'active' : ''}" id="tabAirports">
                <ion-icon name="business-outline"></ion-icon>
                <span>Airports</span>
            </button>
        </div>
        
        <div id="hubContent"></div>
    `;
    
    // Add tab event listeners
    document.getElementById('tabFlights').addEventListener('click', () => renderGlobalHub('flights'));
    document.getElementById('tabAirports').addEventListener('click', () => renderGlobalHub('airports'));
    
    if (activeTab === 'flights') {
        renderFlights(flights, false);
    } else {
        renderDisruptions(disruptions, false);
    }
}

// Updated navigation state switching
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach((item, index) => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        if (navigator.vibrate) navigator.vibrate(10);
        
        if (item.id === "navHub") {
            renderGlobalHub(currentHubTab);
        } else if (item.id === "navRadar" || index === 0) {
            // Radar menu removed – show tickets placeholder
            document.querySelector('.header-title h1').innerText = "Tickets";
            document.querySelector('.live-indicator-wrapper').style.display = "none";
            flightListEl.innerHTML = `
                <div style="text-align:center; padding-top:100px; color:var(--text-muted);">
                    <ion-icon name="ticket-outline" style="font-size:48px;"></ion-icon>
                    <p>Tickets coming soon</p>
                </div>`;
        } else if (item.id === "navSearch") {
             flightListEl.innerHTML = `<div style="text-align:center; padding-top:100px; color:var(--text-muted);"><ion-icon name="search-outline" style="font-size:48px;"></ion-icon><p>Search interface coming soon</p></div>`;
        } else if (item.id === "navAccount") {
             flightListEl.innerHTML = `<div style="text-align:center; padding-top:100px; color:var(--text-muted);"><ion-icon name="person-circle-outline" style="font-size:48px;"></ion-icon><p>Account settings coming soon</p></div>`;
        }
    });
});

// Final App Initialization
let disruptions = [];
// Show Tickets placeholder on first load
document.querySelector('.header-title h1').innerText = "Tickets";
document.querySelector('.live-indicator-wrapper').style.display = "none";
flightListEl.innerHTML = `
    <div style="text-align:center; padding-top:100px; color:var(--text-muted);">
        <ion-icon name="ticket-outline" style="font-size:48px;"></ion-icon>
        <p>Tickets coming soon</p>
    </div>`;
// Do NOT automatically load live flight data; it will be loaded when the user clicks the Ticket (formerly Radar) tab if needed.


// Auto-Sync Logic (Every 5 minutes)
setInterval(() => {
    console.log("Auto-syncing data in background...");
    loadRealData(false); // Background update for flights
    triggerScrape(false); // Background update for disruptions
}, 300000); 

// Function to call PHP Puppeteer trigger
async function triggerScrape(isManual = true) {
    if (isManual) renderDisruptions(null, true);
    
    try {
        const url = isManual ? "api_disruptions.php?force=1" : "api_disruptions.php";
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success && json.data) {
            disruptions = json.data;
            lastSyncTime = new Date();
            
            // Only update UI if we are in Hub Airports tab
            const isHubAirports = document.querySelector('.segmented-control') && currentHubTab === 'airports';
            if (isHubAirports || isManual) {
                renderDisruptions(disruptions, false);
            }
        } else {
            if (isManual) alert("Scraper Error: " + (json.error || "Unknown"));
            renderDisruptions(json.data || null, false);
        }
        
        if (isManual && navigator.vibrate) navigator.vibrate([20, 50, 20]);
    } catch (e) {
        console.error(e);
        if (isManual) alert("Gagal menyambung ke Puppeteer Server!");
        renderDisruptions(null, false);
    }
}

// Modal Controller for Details overlay - Upgraded to Dashboard style
function openModal(item) {
    if (navigator.vibrate) navigator.vibrate(10);
    
    // Check if it's a flight or an airport based on available fields
    const isFlight = !!item.flightNo;
    
    if (isFlight) {
        modalBody.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <div>
                    <h3 style="font-size:32px; color: var(--accent-blue-light); font-family: var(--code-font); line-height: 1;">${item.flightNo}</h3>
                    <p style="color:var(--text-secondary); font-size: 14px; margin-top: 4px;">${item.airline} • <span id="extReg" class="skeleton">A6-XXX</span></p>
                </div>
                <div style="text-align: right;">
                    <span style="background: var(--status-enroute); color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold;">LIVE</span>
                </div>
            </div>
            
            <div class="schedule-grid">
                <div class="schedule-card">
                    <span class="schedule-label">Departure</span>
                    <div class="schedule-time" id="extSchDep"><span class="skeleton">00:00</span></div>
                    <div class="schedule-sub" id="extActDep"><span class="skeleton">Actual: 00:00</span></div>
                    <p style="font-size: 12px; margin-top:8px;">${item.originCity} (${item.origin})</p>
                </div>
                <div class="schedule-card">
                    <span class="schedule-label">Arrival</span>
                    <div class="schedule-time" id="extSchArr"><span class="skeleton">00:00</span></div>
                    <div class="schedule-sub" id="extEstArr"><span class="skeleton">Estimated: 00:00</span></div>
                    <p style="font-size: 12px; margin-top:8px;">${item.destCity} (${item.dest})</p>
                </div>
            </div>

            <div class="progress-container">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">
                    <span>Flight Progress</span>
                    <span id="extProgLabel">0%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" id="extProgFill" style="width: 0%"></div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color:var(--text-muted); font-size: 10px; text-transform: uppercase; margin-bottom: 5px;">Tracking Population</p>
                    <p style="font-size: 20px; font-weight: bold; font-family: var(--code-font); color: var(--status-delayed);">${item.status ? item.status.split(' ')[0] : 'N/A'}</p>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color:var(--text-muted); font-size: 10px; text-transform: uppercase; margin-bottom: 5px;">Global Rank</p>
                    <p style="font-size: 20px; font-weight: bold; font-family: var(--code-font); color: var(--accent-blue-light);">${item.rank || "N/A"}</p>
                </div>
            </div>

            <div class="details-row">
                <span class="details-label">Terminal / Gate</span>
                <span class="details-val" id="extTermGate"><span class="skeleton">T1 / G12</span></span>
            </div>
            <div class="details-row">
                <span class="details-label">Aircraft Age / MSN</span>
                <span class="details-val" id="extAgeMsn"><span class="skeleton">12 years / 1234</span></span>
            </div>
            
            <div style="margin-top: 20px; padding: 12px; background: rgba(14, 165, 233, 0.05); border-radius: 10px; border: 1px dashed rgba(14, 165, 233, 0.2); text-align: center;">
                <a href="https://www.flightradar24.com/${item.flightNo}" target="_blank" style="display: inline-block; color: var(--accent-blue-light); font-size: 12px; text-decoration: none; font-weight: bold;">VIEW FULL PROFILE ON FR24 ↗</a>
            </div>
        `;
        
        // Trigger Deep Scrape
        fetchExtendedDetails(item.flightNo);

    } else {
        // Airport Detail (Enhanced Dashboard)
        modalBody.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <div>
                    <h3 style="font-size:32px; color: var(--accent-blue-light); font-family: var(--code-font); line-height: 1;">${item.iata}</h3>
                    <p style="color:var(--text-secondary); font-size: 14px; margin-top: 4px;">${item.airport}</p>
                </div>
                <div style="text-align: right;">
                    <span class="stat-badge stat-serve" id="extServed"><span class="skeleton">69 Served</span></span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase;">Average Delay</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--status-delayed);"></div>
                        <p style="font-size: 18px; font-weight: bold;"><span id="extAvgDelay" class="skeleton">00</span> min</p>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase;">Delayed (35%)</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--status-delayed);"></div>
                        <p style="font-size: 18px; font-weight: bold;"><span id="extDelay" class="skeleton">00</span> flt</p>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
                    <p style="color:var(--text-muted); font-size: 8px; text-transform: uppercase;">Total</p>
                    <p style="font-size: 16px; font-weight: bold; margin-top:4px;" id="extTotal" class="skeleton">0,000</p>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
                    <p style="color:var(--text-muted); font-size: 8px; text-transform: uppercase;">Takeoffs</p>
                    <p style="font-size: 16px; font-weight: bold; margin-top:4px;" id="extTakeoffs" class="skeleton">000</p>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); text-align: center;">
                    <p style="color:var(--text-muted); font-size: 8px; text-transform: uppercase;">Landings</p>
                    <p style="font-size: 16px; font-weight: bold; margin-top:4px;" id="extLandings" class="skeleton">000</p>
                </div>
            </div>
            
            <div style="background:var(--bg-main); padding:16px; border-radius:12px; margin-bottom:12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <p style="color:var(--text-muted); font-size: 11px; font-weight:bold;">ARRIVALS DELAY INDEX</p>
                    <span style="font-family: var(--code-font); color: var(--status-delayed); font-weight: bold;">${item.arrIdx}</span>
                </div>
                <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-top: 8px;">
                    <div style="height: 100%; width: ${Math.min(parseFloat(item.arrIdx) * 20, 100)}%; background: var(--status-delayed); border-radius: 3px;"></div>
                </div>
            </div>
            
            <div style="margin-top: 24px;">
                <h4 style="font-size: 14px; color: var(--text-primary); margin-bottom: 4px;">Busiest Routes (7D)</h4>
                <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">Top destinations by flight volume.</p>
                <div id="extRouteList" class="route-list">
                    <div class="route-item"><span class="skeleton">Loading Busiest Routes...</span></div>
                </div>
            </div>

            <div style="margin-top: 20px; padding: 12px; background: rgba(14, 165, 233, 0.05); border-radius: 10px; border: 1px dashed rgba(14, 165, 233, 0.2); text-align: center;">
                <a href="https://www.flightradar24.com/airport/${item.iata.toLowerCase()}" target="_blank" style="display: inline-block; color: var(--accent-blue-light); font-size: 12px; text-decoration: none; font-weight: bold;">VIEW FULL AIRPORT STATS ↗</a>
            </div>
        `;
        
        // Trigger Deep Scrape for Airport
        fetchAirportExtendedDetails(item.iata);
    }
    
    modal.classList.add("active");
}

async function fetchExtendedDetails(callsign) {
    if (callsign === "N/A") return;
    
    try {
        const res = await fetch(`api_details.php?callsign=${callsign}`);
        const json = await res.json();
        
        if (json.success && json.data) {
            const d = json.data;
            
            // Update UI elements
            document.getElementById('extReg').innerText = d.registration || "N/A";
            document.getElementById('extReg').classList.remove('skeleton');
            
            document.getElementById('extSchDep').innerText = d.scheduledDep || "-";
            document.getElementById('extSchDep').classList.remove('skeleton');
            
            document.getElementById('extSchArr').innerText = d.scheduledArr || "-";
            document.getElementById('extSchArr').classList.remove('skeleton');
            
            document.getElementById('extActDep').innerText = `Actual: ${d.actualDep || "-"}`;
            document.getElementById('extActDep').classList.remove('skeleton');
            
            document.getElementById('extEstArr').innerText = `Estimated: ${d.estimatedArr || "-"}`;
            document.getElementById('extEstArr').classList.remove('skeleton');
            
            document.getElementById('extProgLabel').innerText = d.progress || "0%";
            document.getElementById('extProgFill').style.width = d.progress || "0%";
            
            document.getElementById('extTermGate').innerText = `${d.terminal || "-"} / ${d.gate || "-"}`;
            document.getElementById('extTermGate').classList.remove('skeleton');
            
            document.getElementById('extAgeMsn').innerText = `${d.age || "-"} / ${d.serialNumber || "-"}`;
            document.getElementById('extAgeMsn').classList.remove('skeleton');
        }
    } catch (e) {
        console.error("Deep scrape failed:", e);
    }
}

async function fetchAirportExtendedDetails(iata) {
    if (!iata) return;
    
    try {
        const res = await fetch(`api_airport_details.php?iata=${iata}`);
        const json = await res.json();
        
        if (json.success && json.data) {
            const d = json.data;
            
            // Update UI elements
            if (document.getElementById('extAvgDelay')) {
                document.getElementById('extAvgDelay').innerText = d.avgDelay || "0";
                document.getElementById('extAvgDelay').classList.remove('skeleton');
            }
            if (document.getElementById('extDelay')) {
                document.getElementById('extDelay').innerText = d.delays || "0";
                document.getElementById('extDelay').classList.remove('skeleton');
            }
            if (document.getElementById('extTotal')) {
                document.getElementById('extTotal').innerText = d.totalFlights || "0";
                document.getElementById('extTotal').classList.remove('skeleton');
            }
            if (document.getElementById('extTakeoffs')) {
                document.getElementById('extTakeoffs').innerText = d.takeoffs || "0";
                document.getElementById('extTakeoffs').classList.remove('skeleton');
            }
            if (document.getElementById('extLandings')) {
                document.getElementById('extLandings').innerText = d.landings || "0";
                document.getElementById('extLandings').classList.remove('skeleton');
            }
            if (document.getElementById('extServed')) {
                document.getElementById('extServed').innerText = `${d.airportsServed || "0"} Served`;
                document.getElementById('extServed').classList.remove('skeleton');
            }
            
            // Render Routes
            const routeList = document.getElementById('extRouteList');
            if (routeList) {
                if (d.routes && d.routes.length > 0) {
                    routeList.innerHTML = d.routes.map(r => `
                        <div class="route-item">
                            <span class="route-name">${r.route}</span>
                            <span class="route-count">${r.count} flights</span>
                        </div>
                    `).join('');
                } else {
                    routeList.innerHTML = `<div class="route-item" style="font-size:12px; color:var(--text-muted);">No recent route data found.</div>`;
                }
            }
        }
    } catch (e) {
        console.error("Airport deep scrape failed:", e);
    }
}
closeModalBtn.addEventListener('click', () => {
    modal.classList.remove("active");
});

// Setup Search Observer
searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = flights.filter(f => 
        f.flightNo.toLowerCase().includes(query) || 
        f.airline.toLowerCase().includes(query) ||
        f.origin.toLowerCase().includes(query) ||
        f.dest.toLowerCase().includes(query)
    );
    renderFlights(filtered);
});

