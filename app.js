// Aviation Tracker - Dynamic Data Fetch

let flights = [];
let lastSyncTime = null;
let latestGlobalAirplanesCount = "0"; // Store global stats state
let latestEmergencies = []; // Store active emergencies (7700/7600)
let latestTopModels = []; // Store top aircraft models
let latestTopAirlines = []; // Store top airlines
let latestTopBrands = []; // Store top manufacturers
let latestTopTracked = []; // Store top tracked flights
let latestGlobalStats = { last24h: 0, avg7d: 0, trend: 0 }; // Store global stats
let latestPopularRoutes = { origins: [], destinations: [] }; // Store route stats
let isGlobalStatsUpdating = false; // Track update state for UI
let isFleetExpanded = false; // Track fleet list state (collapsed/expanded)

// Helper to format airline names from ICAO codes
function formatAirlineName(code) {
    const airlines = {
        'GIA': 'Garuda Indonesia',
        'AAL': 'American Airlines',
        'UAL': 'United Airlines',
        'DAL': 'Delta Air Lines',
        'DLH': 'Lufthansa',
        'AFR': 'Air France',
        'BAW': 'British Airways',
        'SIA': 'Singapore Airlines',
        'UAE': 'Emirates',
        'QFA': 'Qantas',
        'THY': 'Turkish Airlines',
        'ANA': 'All Nippon Airways',
        'KAL': 'Korean Air',
        'CAL': 'China Airlines',
        'CES': 'China Eastern',
        'CSN': 'China Southern',
        'CPA': 'Cathay Pacific',
        'ETH': 'Ethiopian Airlines',
        'SWR': 'Swiss',
        'KLM': 'KLM',
        'RYR': 'Ryanair',
        'EZY': 'easyJet',
        'WZZ': 'Wizz Air',
        'IBE': 'Iberia',
        'QTR': 'Qatar Airways',
        'ETD': 'Etihad Airways',
        'JAL': 'Japan Airlines',
        'SVA': 'Saudia',
        'IRA': 'Iran Air',
        'AIQ': 'AirAsia',
        'AXM': 'AirAsia',
        'LNI': 'Lion Air',
        'AWQ': 'Indonesia AirAsia',
        'BTK': 'Batik Air',
        'CTV': 'Citilink',
        'THJ': 'Thai AirAsia',
        'FDX': 'FedEx',
        'UPS': 'UPS',
        'BOX': 'AeroLogic'
    };
    return airlines[code] || `${code} Airways`;
}


// Helper to format aircraft models from ICAO codes
function formatAircraftModel(code) {
    const models = {
        'A319': 'Airbus A319',
        'A320': 'Airbus A320',
        'A321': 'Airbus A321',
        'A20N': 'Airbus A320neo',
        'A21N': 'Airbus A321neo',
        'A332': 'Airbus A330-200',
        'A333': 'Airbus A330-300',
        'A339': 'Airbus A330-900',
        'A343': 'Airbus A340-300',
        'A346': 'Airbus A340-600',
        'A359': 'Airbus A350-900',
        'A35K': 'Airbus A350-1000',
        'A388': 'Airbus A380-800',
        'B737': 'Boeing 737',
        'B738': 'Boeing 737-800',
        'B739': 'Boeing 737-900',
        'B38M': 'Boeing 737 MAX 8',
        'B39M': 'Boeing 737 MAX 9',
        'B744': 'Boeing 747-400',
        'B748': 'Boeing 747-8',
        'B752': 'Boeing 757-200',
        'B763': 'Boeing 767-300',
        'B772': 'Boeing 777-200',
        'B77L': 'Boeing 777-200LR',
        'B77W': 'Boeing 777-300ER',
        'B788': 'Boeing 787-8',
        'B789': 'Boeing 787-9',
        'B78X': 'Boeing 787-10',
        'BCS3': 'Airbus A220-300',
        'BCS1': 'Airbus A220-100',
        'E190': 'Embraer 190',
        'E195': 'Embraer 195',
        'E290': 'Embraer E190-E2',
        'E295': 'Embraer E195-E2',
        'CRJ9': 'Bombardier CRJ-900',
        'CRJX': 'Bombardier CRJ-1000',
        'DH8D': 'Dash 8 Q400',
        'AT76': 'ATR 72-600',
        'MD11': 'McDonnell Douglas MD-11',
        'B11F': 'Boeing 737-400SF',
        'B12F': 'Boeing 737-800BCF'
    };
    return models[code] || code;
}


function formatLastSync() {
    if (!lastSyncTime) return "Belum disinkron";
    return `Update: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

// Global Statistics (Airplanes in Air)
async function loadGlobalStats(isManual = false) {
    if (isManual) {
        isGlobalStatsUpdating = true;
        const btn = document.getElementById('hubRefreshStatsBtn');
        if (btn) btn.classList.add('pulse-dot');
    }

    try {
        const url = isManual ? 'api_global_stats.php?force=1' : 'api_global_stats.php';
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success) {
            latestGlobalAirplanesCount = json.total_raw || "0";
            latestEmergencies = json.emergencies || [];
            latestTopModels = json.topModels || [];
            latestTopTracked = json.topTracked || [];
            latestGlobalStats = json.stats || { last24h: 0, avg7d: 0, trend: 0 };
            latestTopAirlines = json.topAirlines || [];
            latestTopBrands = json.topBrands || [];
            latestPopularRoutes = json.popularRoutes || { origins: [], destinations: [] };
            
            const el = document.getElementById('hubGlobalStats');
            if (el) {
                el.innerText = `${latestGlobalAirplanesCount} Global Airborne Traffic`;
                if (navigator.vibrate) navigator.vibrate(5);
            }
            
            // If we are currently in the Hub view, re-render to show new data
            if (document.getElementById('navHub').classList.contains('active')) {
                renderGlobalHub(currentHubTab);
            }
        }
    } catch (e) {
        console.error("Failed to load global stats:", e);
    } finally {
        if (isManual) {
            isGlobalStatsUpdating = false;
            const btn = document.getElementById('hubRefreshStatsBtn');
            if (btn) btn.classList.remove('pulse-dot');
        }
    }
}

// Initial load for global stats
loadGlobalStats();
setInterval(loadGlobalStats, 15000); // Live update every 15 seconds


const flightListEl = document.getElementById("flightList");
let searchInput = null; // Defined dynamically when Search tab is active
let searchDropdown = null; 
const modal = document.getElementById("detailsModal");
const closeModalBtn = document.getElementById("closeModal");
const modalBody = document.getElementById("modalBody");
const containerTitle = document.querySelector('.header-title h1');

// Fetch data dynamically from PHP Puppeteer Scraper (pulling live from FR24)
// Fetch data dynamically from PHP Puppeteer Scraper (pulling live from FR24)
async function loadRealData(isManual = false) {
    if (isManual) {
        // Keep existing flights data visible during refresh
        renderFlights(flights, true);
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
            showToast("Gagal memuat data live. Mencoba lagi dalam 5 menit.", "error");
            renderFlights(flights, false); // Keep existing data
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

    if (isLoading && data.length === 0) {
        // Show skeleton cards if we have no data yet
        for (let i = 0; i < 5; i++) {
            const skel = document.createElement('div');
            skel.className = "intelligence-widget animated-in";
            skel.style.marginBottom = "14px";
            skel.style.padding = "14px";
            skel.style.border = "1px solid rgba(255,255,255,0.05)";
            skel.innerHTML = `
                <div style="height: 16px; width: 40%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 12px;" class="skeleton"></div>
                <div style="height: 48px; background: rgba(255,255,255,0.02); border-radius: 12px;" class="skeleton"></div>
            `;
            container.appendChild(skel);
        }
        return;
    }
    
    if (data.length === 0 && !isLoading) {
        const empty = document.createElement('p');
        empty.style = "text-align:center; color: var(--text-muted); margin-top:40px;";
        empty.innerText = "No flights found. Tap 'Tarik Live' to start.";
        container.appendChild(empty);
        return;
    }
    
    data.forEach((flight, index) => {
        const card = document.createElement("div");
        card.className = "intelligence-widget animated-in";
        card.style.cursor = "pointer";
        card.style.marginBottom = "14px";
        card.style.padding = "14px";
        card.style.border = "1px solid rgba(14, 165, 233, 0.15)"; // Soft blue border
        card.onclick = () => openModal(flight);
        
        const displayRank = flight.rank || `${index + 1}`;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 24px; height: 24px; border-radius: 6px; background: rgba(14, 165, 233, 0.15); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; color: var(--accent-blue-light); font-family: var(--code-font);">${displayRank}</div>
                    <div>
                        <div style="font-size: 14px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">${flight.flightNo}</div>
                        <div style="font-size: 10px; color: var(--text-muted);">${flight.airline}</div>
                    </div>
                </div>
                <span class="status-badge ${flight.statusCode}" style="font-size: 9px; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; font-weight: 800;">${flight.status}</span>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 12px; position: relative;">
                <div style="text-align: left;">
                    <div style="font-size: 16px; font-weight: 800; color: #fff; font-family: var(--code-font);">${flight.origin}</div>
                    <div style="font-size: 9px; color: var(--text-muted);">${flight.originCity}</div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative;">
                    <!-- Vertical Speed Indicator -->
                    ${flight.verticalSpeed ? `
                        <div style="position: absolute; top: -18px; display: flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 800; color: ${flight.verticalSpeed > 0 ? '#4ade80' : flight.verticalSpeed < 0 ? '#f87171' : 'var(--text-muted)'}; background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 4px;">
                            <ion-icon name="${flight.verticalSpeed > 0 ? 'arrow-up' : flight.verticalSpeed < 0 ? 'arrow-down' : 'remove'}" style="font-size: 10px;"></ion-icon>
                            <span>${Math.abs(flight.verticalSpeed)} fpm</span>
                        </div>
                    ` : ''}
                    <ion-icon name="airplane" style="font-size: 14px; color: var(--accent-blue-light);"></ion-icon>
                    <div style="width: 100%; height: 1px; background: linear-gradient(90deg, transparent, var(--accent-blue-light), transparent); margin-top: 4px;"></div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 16px; font-weight: 800; color: #fff; font-family: var(--code-font);">${flight.dest}</div>
                    <div style="font-size: 9px; color: var(--text-muted);">${flight.destCity}</div>
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

    if (isLoading && disruptions.length === 0) {
        // Show skeleton cards for disruptions
        for (let i = 0; i < 3; i++) {
            const skel = document.createElement('div');
            skel.className = "intelligence-widget animated-in";
            skel.style.marginBottom = "14px";
            skel.style.padding = "20px";
            skel.style.border = "1px solid rgba(255,255,255,0.05)";
            skel.innerHTML = `<div style="height: 48px; background: rgba(255,255,255,0.03); border-radius: 12px;" class="skeleton"></div>`;
            container.appendChild(skel);
        }
        return;
    }

    const listToRender = disruptions;
    
    if (listToRender.length === 0 && !isLoading) {
        const empty = document.createElement('p');
        empty.style = "text-align:center; color: var(--text-muted); margin-top:40px; font-size: 13px;";
        empty.innerText = "Data tidak tersedia. Tekan 'Tarik Live' untuk menganalisis.";
        container.appendChild(empty);
        return;
    }
    
    listToRender.forEach(d => {
        const dCard = document.createElement("div");
        dCard.className = "intelligence-widget animated-in";
        dCard.style.cursor = "pointer";
        dCard.style.marginBottom = "14px";
        dCard.style.padding = "14px";
        dCard.style.border = "1px solid rgba(245, 158, 11, 0.15)"; // Soft amber border for health/alerts
        dCard.onclick = () => openModal(d);
        
        dCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(245, 158, 11, 0.08); display: flex; align-items: center; justify-content: center; font-family: var(--code-font); font-weight: 900; color: #f59e0b; font-size: 14px; border: 1px solid rgba(245, 158, 11, 0.2);">${d.iata}</div>
                    <div>
                        <h4 style="font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.2px;">${d.airport}</h4>
                        <div style="display: flex; gap: 10px; margin-top: 4px; color: var(--text-muted); font-size: 10px; font-weight: 600;">
                            <span style="display: flex; align-items: center; gap: 4px;"><ion-icon name="thermometer-outline" style="color: #f59e0b;"></ion-icon> ${d.temp || "N/A"}</span>
                            <span style="display: flex; align-items: center; gap: 4px;"><ion-icon name="swap-horizontal-outline" style="color: #f59e0b;"></ion-icon> ${d.wind || "N/A"}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: rgba(0,0,0,0.25); padding: 12px; border-radius: 12px;">
                <div style="border-right: 1px solid rgba(255,255,255,0.05); padding-right: 5px;">
                    <p style="font-size: 9px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; font-weight: 700;">Arrivals Index</p>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 18px; font-weight: 900; color: #fff; font-family: var(--code-font);">${d.arrIdx || "0.0"}</span>
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${parseFloat(d.arrIdx) > 5 ? '#f87171' : '#4ade80'}; box-shadow: 0 0 8px ${parseFloat(d.arrIdx) > 5 ? '#ef4444' : '#22c55e'};"></div>
                    </div>
                </div>
                <div style="padding-left: 8px;">
                    <p style="font-size: 9px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; font-weight: 700;">Departure Index</p>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 18px; font-weight: 900; color: #fff; font-family: var(--code-font);">${d.depIdx || "0.0"}</span>
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${parseFloat(d.depIdx) > 5 ? '#f87171' : '#4ade80'}; box-shadow: 0 0 8px ${parseFloat(d.depIdx) > 5 ? '#ef4444' : '#22c55e'};"></div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(dCard);
    });
}
// ─── In-App Toast Notification ───────────────────────────────────────────────
function showToast(message, type = 'error', duration = 3500) {
    let existing = document.getElementById('skytrack-toast');
    if (existing) existing.remove();
    const colors = {
        error:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',   icon: 'alert-circle-outline',     text: '#fca5a5' },
        warning: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.4)',  icon: 'warning-outline',          text: '#fcd34d' },
        success: { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.4)',  icon: 'checkmark-circle-outline', text: '#6ee7b7' },
        info:    { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.4)',  icon: 'information-circle-outline',text: '#a5b4fc' },
    };
    const c = colors[type] || colors.error;
    const toast = document.createElement('div');
    toast.id = 'skytrack-toast';
    toast.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);
        background:${c.bg};border:1px solid ${c.border};border-radius:12px;
        padding:12px 18px;display:flex;align-items:center;gap:10px;
        font-size:13px;color:${c.text};z-index:9999;
        backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.4);
        opacity:0;transition:opacity 0.25s ease,transform 0.25s ease;
        max-width:320px;width:calc(100vw - 40px);
    `;
    toast.innerHTML = `<ion-icon name="${c.icon}" style="font-size:18px;flex-shrink:0;"></ion-icon><span>${message}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function updateDateDisplay() {
    const val = document.getElementById('ticketDate').value;
    const display = document.getElementById('ticketDateDisplay');
    if (!val || !display) return;
    const dt = new Date(val + 'T00:00:00');
    const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    display.textContent = dt.toLocaleDateString('en-US', opts);
    display.style.color = 'var(--text-primary)';
}

function renderTickets() {
    containerTitle.innerText = "Search Tickets";
    flightListEl.innerHTML = `
        <div style="padding: 20px;">
            <div class="ticket-form-card">
                <h2 style="font-size: 18px; margin-bottom: 20px; color: var(--accent-blue-light); display:flex; align-items:center; gap:8px;">
                    <ion-icon name="airplane" style="font-size:20px;"></ion-icon> Find Cheap Flights
                </h2>
                <div style="display: flex; flex-direction: column; gap: 14px;">
                    <div class="input-group" style="position: relative;">
                        <label class="field-label">From (City / Airport)</label>
                        <div class="ticket-input-wrapper">
                            <ion-icon name="airplane-outline" class="input-icon"></ion-icon>
                            <input type="text" id="ticketFrom" placeholder="e.g. Jakarta, CGK, Solo"
                                value="CGK" autocomplete="off"
                                oninput="showSuggestions(this,'from')"
                                onfocus="showSuggestions(this,'from')"
                                class="ticket-input">
                        </div>
                        <div id="suggestions-from" class="autocomplete-list"></div>
                    </div>
                    <div class="input-group" style="position: relative;">
                        <label class="field-label">To (City / Airport)</label>
                        <div class="ticket-input-wrapper">
                            <ion-icon name="location-outline" class="input-icon"></ion-icon>
                            <input type="text" id="ticketTo" placeholder="e.g. Singapore, SIN"
                                value="SIN" autocomplete="off"
                                oninput="showSuggestions(this,'to')"
                                onfocus="showSuggestions(this,'to')"
                                class="ticket-input">
                        </div>
                        <div id="suggestions-to" class="autocomplete-list"></div>
                    </div>
                    <div class="input-group">
                        <label class="field-label">Departure Date</label>
                        <div class="ticket-input-wrapper date-display-wrapper"
                            onclick="document.getElementById('ticketDate').showPicker ? document.getElementById('ticketDate').showPicker() : document.getElementById('ticketDate').focus()">
                            <ion-icon name="calendar-outline" class="input-icon"></ion-icon>
                            <span id="ticketDateDisplay" class="ticket-input" style="cursor:pointer; color:var(--text-muted);">Select date</span>
                            <ion-icon name="chevron-down-outline" style="font-size:14px;color:var(--text-muted);flex-shrink:0;"></ion-icon>
                            <input type="date" id="ticketDate" class="hidden-date-input" onchange="updateDateDisplay()">
                        </div>
                    </div>
                    <button onclick="searchTickets()" id="btnSearchTickets" class="search-flight-btn">
                        <ion-icon name="search-outline"></ion-icon> Search Flights
                    </button>
                </div>
            </div>
            <div id="ticketResults"></div>
        </div>
    `;

    // Set default date to tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split('T')[0];
    const dateEl = document.getElementById('ticketDate');
    dateEl.min = new Date().toISOString().split('T')[0];
    dateEl.value = tomorrow;
    updateDateDisplay();
}


async function searchTickets(isRefresh = false) {
    const from = document.getElementById('ticketFrom').value.toUpperCase();
    const to = document.getElementById('ticketTo').value.toUpperCase();
    const dateInput = document.getElementById('ticketDate');
    const date = dateInput.value;
    const btn = document.getElementById('btnSearchTickets');
    const resultsDiv = document.getElementById('ticketResults');
    
    if (!from || !to || !date) {
        showToast('Please fill in all fields: departure, destination, and date.', 'warning');
        return;
    }

    // Past date validation
    if (date < dateInput.min) {
        showToast('Cannot search for flights on past dates.', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = `<ion-icon name="sync" class="pulse-dot"></ion-icon> Searching flights...`;
    resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loader-pulse" style="margin: 0 auto; margin-bottom: 15px;"></div>
            <p style="color: var(--accent-blue-light); font-size: 14px; margin-bottom: 4px;">Fetching data from Google Flights...</p>
            <p style="color: var(--text-muted); font-size: 11px;">This process usually takes 15–20 seconds.</p>
        </div>
    `;
    
    try {
        const url = `api_tickets.php?origin=${from}&dest=${to}&date=${date}${isRefresh ? '&force=1' : ''}`;
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success && json.data && json.data.length > 0) {
            resultsDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin:0;">Cheapest Flight Results</h3>
                    <button onclick="searchTickets(true)" class="btn-refresh-results" title="Search again without cache">
                        <ion-icon name="sync-outline"></ion-icon> Refresh
                    </button>
                </div>
            `;
            
            json.data.forEach((flight, idx) => {
                const cardId = `flight-card-${idx}`;
                const detailsId = `flight-details-${idx}`;
                const bookingUrl = flight.tfs
                    ? `https://www.google.com/travel/flights/booking?tfs=${flight.tfs}${flight.tfu ? `&tfu=${flight.tfu}` : ''}&hl=en`
                    : `https://www.google.com/travel/flights?q=Flights+from+${from}+to+${to}+on+${date}+one+way+${encodeURIComponent(flight.airline)}&hl=en`;

                // Build route timeline (segment-by-segment)
                const buildRouteTimeline = () => {
                    if (flight.segments && flight.segments.length > 0) {
                        // Multi-segment rich timeline
                        let html = '';
                        flight.segments.forEach((seg, si) => {
                            const isLastSeg = si === flight.segments.length - 1;
                            const segmentAirline = seg.airline || flight.airline;
                            const segmentFlightNo = seg.flightNo || (flight.flightNos ? flight.flightNos[si] : null) || '–';
                            
                            html += `
                                <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:${isLastSeg ? '0' : '4px'};">
                                    <div style="display:flex; flex-direction:column; align-items:center; flex-shrink:0; padding-top:4px;">
                                        <div style="width:8px;height:8px;border-radius:50%;background:${si === 0 ? 'var(--accent-blue)' : 'var(--text-muted)'}; border: 2px solid rgba(255,255,255,0.1);"></div>
                                        <div style="width:1.5px;flex:1;background:linear-gradient(to bottom, rgba(255,255,255,0.15), rgba(255,255,255,0.05));min-height:50px;"></div>
                                        <div style="width:8px;height:8px;border-radius:50%;background:${isLastSeg ? '#10b981' : 'var(--text-muted)'}; border: 2px solid rgba(255,255,255,0.1);"></div>
                                    </div>
                                    <div style="flex:1; padding-bottom: 12px;">
                                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                            <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${seg.depTime} · ${seg.from || from}</div>
                                        </div>
                                        
                                        <div style="margin:6px 0; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
                                            <!-- Airline & flight number header -->
                                            <div style="font-size:10px; font-weight:600; color:var(--accent-blue-light); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                                                <span>${segmentAirline} <span style="font-family:var(--code-font); opacity:0.85;">· ${segmentFlightNo}</span></span>
                                                ${seg.duration ? `<span style="font-size:9px; color:var(--text-muted); font-weight:400;">${seg.duration}</span>` : ''}
                                            </div>
                                            <!-- Aircraft & cabin -->
                                            <div style="font-size:9px; color:var(--text-muted); display:flex; gap:10px; flex-wrap:wrap; margin-bottom:${(seg.legroom || (seg.amenities && seg.amenities.length > 0)) ? '8px' : '0'};">
                                                ${seg.aircraft ? `<span style="display:flex;align-items:center;gap:3px;"><ion-icon name="airplane-outline" style="font-size:11px;"></ion-icon> ${seg.aircraft}</span>` : ''}
                                                ${seg.cabinClass ? `<span style="display:flex;align-items:center;gap:3px;"><ion-icon name="ribbon-outline" style="font-size:11px;"></ion-icon> ${seg.cabinClass}</span>` : ''}
                                            </div>
                                            <!-- Per-segment amenities & legroom -->
                                            ${(seg.legroom || (seg.amenities && seg.amenities.length > 0)) ? `
                                            <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:4px;">
                                                ${seg.legroom ? `<span style="font-size:9px; padding:2px 7px; border-radius:4px; background:rgba(99,102,241,0.12); color:var(--accent-blue-light); display:flex;align-items:center;gap:3px;"><ion-icon name="resize-outline" style="font-size:10px;"></ion-icon>${seg.legroom}</span>` : ''}
                                                ${(seg.amenities || []).includes('USB') ? `<span style="font-size:9px; padding:2px 7px; border-radius:4px; background:rgba(99,102,241,0.12); color:var(--accent-blue-light);">USB</span>` : ''}
                                                ${(seg.amenities || []).includes('Wi-Fi') ? `<span style="font-size:9px; padding:2px 7px; border-radius:4px; background:rgba(99,102,241,0.12); color:var(--accent-blue-light);">Wi-Fi</span>` : ''}
                                                ${(seg.amenities || []).includes('Power') ? `<span style="font-size:9px; padding:2px 7px; border-radius:4px; background:rgba(99,102,241,0.12); color:var(--accent-blue-light);">Power</span>` : ''}
                                                ${(seg.amenities || []).includes('Entertainment') ? `<span style="font-size:9px; padding:2px 7px; border-radius:4px; background:rgba(99,102,241,0.12); color:var(--accent-blue-light);">Entertainment</span>` : ''}
                                                ${(seg.amenities || []).includes('Meals') ? `<span style="font-size:9px; padding:2px 7px; border-radius:4px; background:rgba(99,102,241,0.12); color:var(--accent-blue-light);">Meals</span>` : ''}
                                            </div>` : ''}
                                        </div>

                                        <div style="font-size:12px; font-weight:700; color:var(--text-primary);">${seg.arrTime} · ${seg.to || (isLastSeg ? to : '–')}</div>
                                        
                                        ${!isLastSeg && flight.layovers && flight.layovers[si] ? `
                                        <div style="display:flex; align-items:center; gap:8px; margin:12px 0 8px 0; padding:10px; background:rgba(245,158,11,0.08); border:1px dashed rgba(245,158,11,0.3); border-radius:10px;">
                                            <div style="width:24px; height:24px; border-radius:50%; background:rgba(245,158,11,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                                <ion-icon name="hourglass-outline" style="color:#f59e0b; font-size:12px;"></ion-icon>
                                            </div>
                                            <div style="font-size:10px; color:#f59e0b; line-height:1.4;">
                                                <strong style="display:block; font-size:11px;">${flight.layovers[si].duration} layover</strong>
                                                <span style="opacity:0.9;">${flight.layovers[si].airport || 'Connection'}</span>
                                            </div>
                                        </div>` : ''}
                                    </div>
                                </div>`;
                        });
                        return html;
                    } else {
                        // Fallback: simple 2-point timeline
                        const layoverRow = flight.layovers && flight.layovers.length > 0
                            ? flight.layovers.map(lv => `
                                <div style="display:flex; align-items:center; gap:8px; margin:12px 0; padding:10px; background:rgba(245,158,11,0.08); border:1px dashed rgba(245,158,11,0.3); border-radius:10px;">
                                    <div style="width:24px; height:24px; border-radius:50%; background:rgba(245,158,11,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                        <ion-icon name="hourglass-outline" style="color:#f59e0b; font-size:12px;"></ion-icon>
                                    </div>
                                    <div style="font-size:10px; color:#f59e0b; line-height:1.4;">
                                        <strong style="display:block; font-size:11px;">${lv.duration} layover</strong>
                                        <span style="opacity:0.9;">${lv.airport || 'Connection'}</span>
                                    </div>
                                </div>`).join('')
                            : (flight.stopsCount > 0 ? `<div style="display:flex;align-items:center;gap:6px;margin:10px 0;font-size:10px;color:#f59e0b;background:rgba(245,158,11,0.05);padding:8px;border-radius:6px;"><ion-icon name="information-circle-outline"></ion-icon> Transit details available on Google Flights</div>` : '');

                        return `
                            <div style="display:flex; align-items:flex-start; gap:10px;">
                                <div style="display:flex; flex-direction:column; align-items:center; flex-shrink:0; padding-top:2px;">
                                    <div style="width:7px;height:7px;border-radius:50%;background:var(--accent-blue);"></div>
                                    <div style="width:1px;flex:1;background:rgba(255,255,255,0.1);min-height:35px;"></div>
                                    <div style="width:7px;height:7px;border-radius:50%;background:#10b981;"></div>
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:11px;font-weight:600;">${flight.depTime} · ${from}</div>
                                    <div style="font-size:9px;color:var(--text-muted);margin:2px 0;">${flight.airline} ${flight.flightNos && flight.flightNos.length > 0 ? '· ' + flight.flightNos.join(' / ') : ''} ${flight.aircraft ? '· ' + flight.aircraft : ''} ${flight.cabinClass ? '· ' + flight.cabinClass : ''}</div>
                                    ${layoverRow}
                                    <div style="font-size:11px;font-weight:600;margin-top:4px;">${flight.arrTime} · ${to}</div>
                                </div>
                            </div>`;
                    }
                };

                // Stops indicator dots
                const stopsDots = flight.stopsCount > 0
                    ? Array.from({length: flight.stopsCount}, () => `<span style="width:4px;height:4px;border-radius:50%;background:#f59e0b;display:inline-block;"></span>`).join('')
                    : '';

                const card = document.createElement('div');
                card.className = 'ticket-card-expandable';
                card.id = cardId;
                card.innerHTML = `
                    <!-- Collapsed Header (always visible) -->
                    <div class="ticket-card-header" onclick="toggleFlightDetail('${detailsId}', this)" style="cursor:pointer;">
                        <div style="flex:1; min-width:0;">
                            <!-- Flight Info in One Line -->
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap; font-size:11px; color:var(--text-secondary);">
                                <span style="font-weight:600; color:var(--text-primary);">${flight.airline}</span>
                                ${flight.flightNos && flight.flightNos.length > 0 ? `<span style="color:var(--accent-blue); font-weight:600; font-family:var(--code-font);">${flight.flightNos[0]}</span>` : ''}
                                ${flight.aircraft ? `<span>•</span><span>${flight.aircraft}</span>` : ''}
                                ${flight.cabinClass ? `<span>•</span><span>${flight.cabinClass}</span>` : ''}
                                ${flight.legroom ? `<span>•</span><span>${flight.legroom}</span>` : ''}
                            </div>
                            
                            <!-- Travel Time & Delay Info -->
                            <div style="display:flex; gap:12px; margin-bottom:8px; font-size:10px; color:var(--text-muted);">
                                ${flight.duration ? `<div><ion-icon name="timer-outline" style="font-size:11px;vertical-align:baseline;"></ion-icon> ${flight.duration}</div>` : ''}
                                ${flight.delayInfo ? `<div style="color:#f59e0b;"><ion-icon name="alert-circle-outline" style="font-size:11px;vertical-align:baseline;"></ion-icon> ${flight.delayInfo}</div>` : ''}
                            </div>
                            
                            <!-- Time & Route -->
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="text-align:center;">
                                    <span style="display:block; font-size:16px; font-weight:bold;">${flight.depTime}</span>
                                    <span style="font-size:9px; color:var(--text-muted);">${from}</span>
                                </div>
                                <div style="flex:1; position:relative; min-width:40px;">
                                    <div style="height:1px; background:rgba(255,255,255,0.12); position:relative;">
                                        ${flight.stopsCount === 0
                                            ? `<ion-icon name="airplane" style="font-size:11px;position:absolute;top:-5px;left:50%;transform:translateX(-50%);color:var(--accent-blue);"></ion-icon>`
                                            : `<div style="position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:8px;height:8px;border-radius:50%;background:#f59e0b;border:2px solid rgba(0,0,0,0.5);"></div>`
                                        }
                                    </div>
                                    <div style="text-align:center;font-size:8px;color:var(--text-muted);margin-top:5px;white-space:nowrap;">${flight.duration}</div>
                                </div>
                                <div style="text-align:center;">
                                    <span style="display:block; font-size:16px; font-weight:bold;">${flight.arrTime}</span>
                                    <span style="font-size:9px; color:var(--text-muted);">${to}</span>
                                </div>
                            </div>
                            
                            <!-- Badges -->
                            <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                                ${flight.stopsCount === 0 ? `
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                                        <span style="font-size:10px; font-weight:600; color:var(--accent-blue); background:rgba(99,102,241,0.15); padding:4px 10px; border-radius:6px; white-space:nowrap;">Non-stop</span>
                                    </div>
                                </div>` : `
                                <span class="stops-badge badge-transit">${flight.stops}</span>`}
                                ${flight.emissions ? `<div class="detail-badge badge-emissions ${flight.emissionsDiff && flight.emissionsDiff.includes('-') ? 'low' : ''}"><ion-icon name="leaf-outline"></ion-icon>${flight.emissions}</div>` : ''}
                            </div>
                        </div>
                        <div style="text-align:right; margin-left:15px; flex-shrink:0;">
                            <span style="display:block; font-size:17px; font-weight:bold; color:#10b981;">${flight.price}</span>
                            <span style="font-size:9px; color:var(--text-muted);">per person</span>
                            <div style="margin-top:6px;">
                                <ion-icon name="chevron-down-outline" class="expand-chevron" style="font-size:16px;color:var(--text-muted);transition:transform 0.3s;"></ion-icon>
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Details Panel -->
                    <div id="${detailsId}" class="ticket-detail-panel" style="display:none; border-top:1px solid rgba(255,255,255,0.06); margin-top:12px; padding-top:12px;">
                        
                        <!-- Route Timeline -->
                        <div style="padding:12px; background:rgba(14, 165, 233, 0.06); border:1px dashed rgba(14, 165, 233, 0.2); border-radius:10px; margin-bottom:12px;">
                            <div style="font-size:9px; text-transform:uppercase; color:var(--accent-blue-light); letter-spacing:1px; margin-bottom:10px; display:flex; align-items:center; gap:5px; font-weight:600;">
                                <ion-icon name="map-outline"></ion-icon> Flight Route
                            </div>
                            ${buildRouteTimeline()}
                        </div>

                        <!-- Delay Info Section -->
                        ${flight.delayInfo ? `
                        <div style="padding:12px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:10px; margin-bottom:12px;">
                            <div style="font-size:9px; text-transform:uppercase; color:#f59e0b; letter-spacing:1px; margin-bottom:8px; display:flex; align-items:center; gap:5px; font-weight:600;">
                                <ion-icon name="alert-circle-outline"></ion-icon> On-Time Performance
                            </div>
                            <div style="font-size:10px; color:var(--text-secondary);">
                                ${flight.delayInfo}
                            </div>
                        </div>` : ''}

                        <!-- Amenities Section -->
                        ${(flight.amenities && flight.amenities.length > 0) || flight.legroom ? `
                        <div style="padding:12px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); border-radius:10px; margin-bottom:12px;">
                            <div style="font-size:9px; text-transform:uppercase; color:var(--accent-blue-light); letter-spacing:1px; margin-bottom:10px; display:flex; align-items:center; gap:5px; font-weight:600;">
                                <ion-icon name="sparkles-outline"></ion-icon> Amenities & Features
                            </div>
                            <ul style="list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; font-size:10px; color:var(--text-secondary);">
                                ${flight.legroom ? `
                                <li style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(255,255,255,0.02); border-radius:6px;">
                                    <ion-icon name="resize-outline" style="flex-shrink:0; color:var(--accent-blue); font-size:14px;"></ion-icon>
                                    <span><strong>Generous legroom</strong> <span style="color:var(--text-muted);">${flight.legroom}</span></span>
                                </li>` : ''}
                                ${(flight.amenities || []).includes('USB') ? `
                                <li style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(255,255,255,0.02); border-radius:6px;">
                                    <ion-icon name="usb-outline" style="flex-shrink:0; color:var(--accent-blue); font-size:14px;"></ion-icon>
                                    <span><strong>In-seat USB outlet</strong></span>
                                </li>` : ''}
                                ${(flight.amenities || []).includes('Power') ? `
                                <li style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(255,255,255,0.02); border-radius:6px;">
                                    <ion-icon name="battery-charging-outline" style="flex-shrink:0; color:var(--accent-blue); font-size:14px;"></ion-icon>
                                    <span><strong>Power outlet</strong> available</span>
                                </li>` : ''}
                                ${(flight.amenities || []).includes('Entertainment') ? `
                                <li style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(255,255,255,0.02); border-radius:6px;">
                                    <ion-icon name="tv-outline" style="flex-shrink:0; color:var(--accent-blue); font-size:14px;"></ion-icon>
                                    <span><strong>In-flight entertainment</strong> system</span>
                                </li>` : ''}
                                ${(flight.amenities || []).includes('Meals') ? `
                                <li style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(255,255,255,0.02); border-radius:6px;">
                                    <ion-icon name="fast-food-outline" style="flex-shrink:0; color:var(--accent-blue); font-size:14px;"></ion-icon>
                                    <span><strong>Meals & beverages</strong> included</span>
                                </li>` : ''}
                                ${(flight.amenities || []).includes('Wi-Fi') ? `
                                <li style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(255,255,255,0.02); border-radius:6px;">
                                    <ion-icon name="wifi-outline" style="flex-shrink:0; color:var(--accent-blue); font-size:14px;"></ion-icon>
                                    <span><strong>Wi-Fi connectivity</strong> on board</span>
                                </li>` : ''}
                            </ul>
                        </div>` : ''}

                        <!-- Emissions Section -->
                        ${flight.emissions ? `
                        <div style="padding:12px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:10px; margin-bottom:12px;">
                            <div style="font-size:9px; text-transform:uppercase; color:#10b981; letter-spacing:1px; margin-bottom:8px; display:flex; align-items:center; gap:5px; font-weight:600;">
                                <ion-icon name="leaf-outline"></ion-icon> Carbon Impact
                            </div>
                            <div style="font-size:10px; color:var(--text-secondary);">
                                CO₂ Emissions: <strong style="color:#10b981;">${flight.emissions}</strong>
                                ${flight.emissionsDiff ? `<span style="margin-left:8px; color:${flight.emissionsDiff.includes('-') ? '#10b981' : '#f59e0b'};">${flight.emissionsDiff}</span>` : ''}
                            </div>
                        </div>` : ''}

                        <!-- Book Button -->
                        <a href="${bookingUrl}" target="_blank" style="display:flex; align-items:center; justify-content:center; width:100%; padding:12px; background:linear-gradient(135deg, var(--accent-blue), var(--accent-blue-light)); color:white; border-radius:10px; font-size:12px; font-weight:600; border:none; cursor:pointer; gap:6px; transition:all 0.2s; text-decoration:none;">
                            <ion-icon name="open-outline" style="font-size:14px;"></ion-icon>
                            Open on Google Flights
                        </a>
                    </div>
                `;
                resultsDiv.appendChild(card);
            });
        } else {
            resultsDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <ion-icon name="alert-circle-outline" style="font-size: 40px; color: var(--text-muted); margin-bottom: 10px;"></ion-icon>
                    <p style="color: var(--text-muted);">Tidak ada tiket ditemukan atau permintaan habis waktu. Silakan coba lagi atau ganti tanggal.</p>
                </div>
            `;
        }
    } catch (e) {
        console.error("Search failed:", e);
        showToast("Search failed. An error occurred on the server.", "error");
        resultsDiv.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><ion-icon name="cloud-offline-outline" style="font-size:32px;"></ion-icon><p>Server sedang sibuk atau koneksi terputus.</p></div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<ion-icon name="search-outline"></ion-icon> Search Flights`;
    }
}

// Toggle expand/collapse for flight detail cards
function toggleFlightDetail(detailsId, headerEl) {
    const panel = document.getElementById(detailsId);
    const chevron = headerEl.querySelector('.expand-chevron');
    if (!panel) return;

    const isOpen = panel.style.display !== 'none';
    if (isOpen) {
        panel.style.display = 'none';
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        headerEl.closest('.ticket-card-expandable').style.borderColor = 'rgba(255,255,255,0.05)';
    } else {
        panel.style.display = 'block';
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        headerEl.closest('.ticket-card-expandable').style.borderColor = 'rgba(99,102,241,0.3)';
    }
}

// ─── Airport Database (Indonesia + Major World Airports) ─────────────────────
const ALL_AIRPORTS = [
    // ── Indonesia ──
    { code:'CGK', name:'Soekarno-Hatta International', city:'Jakarta', country:'Indonesia', keywords:['jakarta','soeta','cengkareng','soekarno','hatta'] },
    { code:'HLP', name:'Halim Perdanakusuma', city:'Jakarta', country:'Indonesia', keywords:['halim','perdanakusuma'] },
    { code:'SOC', name:'Adi Soemarmo International', city:'Solo / Surakarta', country:'Indonesia', keywords:['solo','surakarta','soemarmo'] },
    { code:'JOG', name:'Adisutjipto', city:'Yogyakarta', country:'Indonesia', keywords:['jogja','yogyakarta','adisutjipto','djogja'] },
    { code:'YIA', name:'Yogyakarta International', city:'Yogyakarta', country:'Indonesia', keywords:['yia','kulon progo','yogyakarta international'] },
    { code:'SUB', name:'Juanda International', city:'Surabaya', country:'Indonesia', keywords:['surabaya','juanda','sby'] },
    { code:'DPS', name:'I Gusti Ngurah Rai International', city:'Bali / Denpasar', country:'Indonesia', keywords:['bali','denpasar','ngurah rai','kuta'] },
    { code:'BDO', name:'Husein Sastranegara', city:'Bandung', country:'Indonesia', keywords:['bandung','husein','sastranegara'] },
    { code:'SRG', name:'Ahmad Yani', city:'Semarang', country:'Indonesia', keywords:['semarang','ahmad yani'] },
    { code:'MDC', name:'Sam Ratulangi', city:'Manado', country:'Indonesia', keywords:['manado','sam ratulangi'] },
    { code:'UPG', name:'Sultan Hasanuddin', city:'Makassar', country:'Indonesia', keywords:['makassar','hasanuddin','ujung pandang'] },
    { code:'PLM', name:'Sultan Mahmud Badaruddin II', city:'Palembang', country:'Indonesia', keywords:['palembang','mahmud badaruddin'] },
    { code:'PKU', name:'Sultan Syarif Kasim II', city:'Pekanbaru', country:'Indonesia', keywords:['pekanbaru','syarif kasim','riau'] },
    { code:'BTH', name:'Hang Nadim', city:'Batam', country:'Indonesia', keywords:['batam','hang nadim','kepri'] },
    { code:'PNK', name:'Supadio International', city:'Pontianak', country:'Indonesia', keywords:['pontianak','supadio','kalbar'] },
    { code:'BPN', name:'Sultan Aji Muhammad Sulaiman Sepinggan', city:'Balikpapan', country:'Indonesia', keywords:['balikpapan','sepinggan','kaltim'] },
    { code:'LOP', name:'Lombok International', city:'Lombok / Mataram', country:'Indonesia', keywords:['lombok','mataram','ntb'] },
    { code:'AMQ', name:'Pattimura', city:'Ambon', country:'Indonesia', keywords:['ambon','pattimura','maluku'] },
    { code:'MLG', name:'Abdul Rachman Saleh', city:'Malang', country:'Indonesia', keywords:['malang','rachman saleh'] },
    { code:'TKG', name:'Radin Inten II', city:'Bandar Lampung', country:'Indonesia', keywords:['lampung','bandar lampung','radin inten'] },
    { code:'PDG', name:'Minangkabau International', city:'Padang', country:'Indonesia', keywords:['padang','minangkabau','sumbar'] },
    { code:'BDJ', name:'Syamsudin Noor', city:'Banjarmasin', country:'Indonesia', keywords:['banjarmasin','syamsudin noor','kalsel'] },
    { code:'GTO', name:'Djalaluddin', city:'Gorontalo', country:'Indonesia', keywords:['gorontalo','djalaluddin'] },
    { code:'TTE', name:'Sultan Babullah', city:'Ternate', country:'Indonesia', keywords:['ternate','babullah'] },
    { code:'KOE', name:'El Tari', city:'Kupang', country:'Indonesia', keywords:['kupang','el tari','ntt','timor'] },
    { code:'DJJ', name:'Sentani', city:'Jayapura', country:'Indonesia', keywords:['jayapura','sentani','papua'] },
    { code:'TIM', name:'Moses Kilangin', city:'Timika', country:'Indonesia', keywords:['timika','freeport'] },
    { code:'MKQ', name:'Mopah', city:'Merauke', country:'Indonesia', keywords:['merauke','mopah'] },
    { code:'MKW', name:'Rendani', city:'Manokwari', country:'Indonesia', keywords:['manokwari','rendani','papua barat'] },
    { code:'TRK', name:'Juwata International', city:'Tarakan', country:'Indonesia', keywords:['tarakan','juwata','kaltara'] },
    { code:'PGK', name:'Depati Amir', city:'Pangkal Pinang', country:'Indonesia', keywords:['pangkal pinang','depati amir','bangka'] },
    { code:'TNJ', name:'Raja Haji Fisabilillah', city:'Tanjung Pinang', country:'Indonesia', keywords:['tanjung pinang','fisabilillah','kepri'] },
    // ── Southeast Asia ──
    { code:'SIN', name:'Changi International', city:'Singapore', country:'Singapore', keywords:['singapore','changi','sgp'] },
    { code:'KUL', name:'Kuala Lumpur International', city:'Kuala Lumpur', country:'Malaysia', keywords:['kuala lumpur','klia','malaysia','kl'] },
    { code:'BKK', name:'Suvarnabhumi International', city:'Bangkok', country:'Thailand', keywords:['bangkok','suvarnabhumi','thailand'] },
    { code:'DMK', name:'Don Mueang International', city:'Bangkok', country:'Thailand', keywords:['don mueang','dmk','bangkok low cost'] },
    { code:'MNL', name:'Ninoy Aquino International', city:'Manila', country:'Philippines', keywords:['manila','ninoy aquino','philippines'] },
    { code:'HAN', name:'Noi Bai International', city:'Hanoi', country:'Vietnam', keywords:['hanoi','noi bai','vietnam'] },
    { code:'SGN', name:'Tan Son Nhat International', city:'Ho Chi Minh City', country:'Vietnam', keywords:['ho chi minh','saigon','tan son nhat','hcmc'] },
    { code:'RGN', name:'Yangon International', city:'Yangon', country:'Myanmar', keywords:['yangon','rangoon','myanmar'] },
    { code:'PNH', name:'Phnom Penh International', city:'Phnom Penh', country:'Cambodia', keywords:['phnom penh','cambodia','kampuchea'] },
    { code:'VTE', name:'Wattay International', city:'Vientiane', country:'Laos', keywords:['vientiane','wattay','laos'] },
    { code:'BWN', name:'Brunei International', city:'Bandar Seri Begawan', country:'Brunei', keywords:['brunei','bandar seri begawan','bsb'] },
    { code:'KNO', name:'Kualanamu International', city:'Medan', country:'Indonesia', keywords:['medan','kualanamu','sumut','north sumatra'] },
    { code:'PEN', name:'Penang International', city:'Penang', country:'Malaysia', keywords:['penang','pulau pinang'] },
    { code:'LGK', name:'Langkawi International', city:'Langkawi', country:'Malaysia', keywords:['langkawi','kedah'] },
    // ── East Asia ──
    { code:'NRT', name:'Narita International', city:'Tokyo', country:'Japan', keywords:['tokyo','narita','japan'] },
    { code:'HND', name:'Haneda', city:'Tokyo', country:'Japan', keywords:['haneda','tokyo','羽田'] },
    { code:'KIX', name:'Kansai International', city:'Osaka', country:'Japan', keywords:['osaka','kansai','japan'] },
    { code:'ICN', name:'Incheon International', city:'Seoul', country:'South Korea', keywords:['seoul','incheon','korea'] },
    { code:'GMP', name:'Gimpo International', city:'Seoul', country:'South Korea', keywords:['gimpo','korea domestic','gmp'] },
    { code:'PEK', name:'Beijing Capital International', city:'Beijing', country:'China', keywords:['beijing','peking','capital','china'] },
    { code:'PKX', name:'Beijing Daxing International', city:'Beijing', country:'China', keywords:['daxing','beijing new'] },
    { code:'PVG', name:'Shanghai Pudong International', city:'Shanghai', country:'China', keywords:['shanghai','pudong','china'] },
    { code:'SHA', name:'Shanghai Hongqiao International', city:'Shanghai', country:'China', keywords:['hongqiao','shanghai domestic'] },
    { code:'CAN', name:'Guangzhou Baiyun International', city:'Guangzhou', country:'China', keywords:['guangzhou','baiyun','canton','china'] },
    { code:'HKG', name:'Hong Kong International', city:'Hong Kong', country:'Hong Kong', keywords:['hong kong','chek lap kok','hkg'] },
    { code:'TPE', name:'Taiwan Taoyuan International', city:'Taipei', country:'Taiwan', keywords:['taipei','taoyuan','taiwan'] },
    { code:'MFM', name:'Macau International', city:'Macau', country:'Macau', keywords:['macau','macao'] },
    { code:'CTU', name:'Chengdu Tianfu International', city:'Chengdu', country:'China', keywords:['chengdu','sichuan','tianfu'] },
    // ── South Asia ──
    { code:'DEL', name:'Indira Gandhi International', city:'New Delhi', country:'India', keywords:['delhi','indira gandhi','new delhi','india'] },
    { code:'BOM', name:'Chhatrapati Shivaji Maharaj International', city:'Mumbai', country:'India', keywords:['mumbai','bombay','chhatrapati','india'] },
    { code:'MAA', name:'Chennai International', city:'Chennai', country:'India', keywords:['chennai','madras','india'] },
    { code:'BLR', name:'Kempegowda International', city:'Bangalore', country:'India', keywords:['bangalore','bengaluru','kempegowda','india'] },
    { code:'HYD', name:'Rajiv Gandhi International', city:'Hyderabad', country:'India', keywords:['hyderabad','rajiv gandhi','india'] },
    { code:'CCU', name:'Netaji Subhas Chandra Bose International', city:'Kolkata', country:'India', keywords:['kolkata','calcutta','netaji','india'] },
    { code:'KTM', name:'Tribhuvan International', city:'Kathmandu', country:'Nepal', keywords:['kathmandu','tribhuvan','nepal'] },
    { code:'CMB', name:'Bandaranaike International', city:'Colombo', country:'Sri Lanka', keywords:['colombo','bandaranaike','sri lanka','ceylon'] },
    { code:'DAC', name:'Hazrat Shahjalal International', city:'Dhaka', country:'Bangladesh', keywords:['dhaka','shahjalal','bangladesh'] },
    // ── Middle East ──
    { code:'DXB', name:'Dubai International', city:'Dubai', country:'UAE', keywords:['dubai','dxb','uae','emirates'] },
    { code:'AUH', name:'Abu Dhabi International', city:'Abu Dhabi', country:'UAE', keywords:['abu dhabi','uae','etihad'] },
    { code:'DOH', name:'Hamad International', city:'Doha', country:'Qatar', keywords:['doha','hamad','qatar','qatari'] },
    { code:'BAH', name:'Bahrain International', city:'Manama', country:'Bahrain', keywords:['bahrain','manama','gulf air'] },
    { code:'KWI', name:'Kuwait International', city:'Kuwait City', country:'Kuwait', keywords:['kuwait','kuwait city'] },
    { code:'MCT', name:'Muscat International', city:'Muscat', country:'Oman', keywords:['muscat','oman','oman air'] },
    { code:'AMM', name:'Queen Alia International', city:'Amman', country:'Jordan', keywords:['amman','queen alia','jordan'] },
    { code:'BEY', name:'Rafic Hariri International', city:'Beirut', country:'Lebanon', keywords:['beirut','rafic hariri','lebanon'] },
    { code:'TLV', name:'Ben Gurion International', city:'Tel Aviv', country:'Israel', keywords:['tel aviv','ben gurion','israel'] },
    { code:'RUH', name:'King Khalid International', city:'Riyadh', country:'Saudi Arabia', keywords:['riyadh','king khalid','saudi','ksa'] },
    { code:'JED', name:'King Abdulaziz International', city:'Jeddah', country:'Saudi Arabia', keywords:['jeddah','king abdulaziz','saudi','ksa','mecca'] },
    { code:'DMM', name:'King Fahd International', city:'Dammam', country:'Saudi Arabia', keywords:['dammam','king fahd','saudi','ksa'] },
    // ── Europe ──
    { code:'LHR', name:'Heathrow', city:'London', country:'UK', keywords:['london','heathrow','england','uk','britain'] },
    { code:'LGW', name:'Gatwick', city:'London', country:'UK', keywords:['gatwick','london','england','uk'] },
    { code:'STN', name:'Stansted', city:'London', country:'UK', keywords:['stansted','london','england','uk'] },
    { code:'CDG', name:'Charles de Gaulle', city:'Paris', country:'France', keywords:['paris','charles de gaulle','france','cdg'] },
    { code:'ORY', name:'Orly', city:'Paris', country:'France', keywords:['paris','orly','france'] },
    { code:'AMS', name:'Amsterdam Schiphol', city:'Amsterdam', country:'Netherlands', keywords:['amsterdam','schiphol','netherlands','holland'] },
    { code:'FRA', name:'Frankfurt', city:'Frankfurt', country:'Germany', keywords:['frankfurt','germany','fraport'] },
    { code:'MUC', name:'Munich International', city:'Munich', country:'Germany', keywords:['munich','münchen','germany'] },
    { code:'BCN', name:'Josep Tarradellas Barcelona-El Prat', city:'Barcelona', country:'Spain', keywords:['barcelona','spain','catalonia'] },
    { code:'MAD', name:'Adolfo Suárez Madrid-Barajas', city:'Madrid', country:'Spain', keywords:['madrid','barajas','spain'] },
    { code:'FCO', name:'Leonardo da Vinci International', city:'Rome', country:'Italy', keywords:['rome','roma','fiumicino','italy','da vinci'] },
    { code:'MXP', name:'Malpensa International', city:'Milan', country:'Italy', keywords:['milan','malpensa','italy'] },
    { code:'VIE', name:'Vienna International', city:'Vienna', country:'Austria', keywords:['vienna','wien','austria'] },
    { code:'ZUR', name:'Zürich', city:'Zürich', country:'Switzerland', keywords:['zurich','zürich','switzerland'] },
    { code:'GVA', name:'Geneva', city:'Geneva', country:'Switzerland', keywords:['geneva','genève','switzerland'] },
    { code:'BRU', name:'Brussels', city:'Brussels', country:'Belgium', keywords:['brussels','bruxelles','belgium'] },
    { code:'ARN', name:'Stockholm Arlanda', city:'Stockholm', country:'Sweden', keywords:['stockholm','arlanda','sweden'] },
    { code:'CPH', name:'Copenhagen', city:'Copenhagen', country:'Denmark', keywords:['copenhagen','kastrup','denmark'] },
    { code:'OSL', name:'Oslo Gardermoen', city:'Oslo', country:'Norway', keywords:['oslo','gardermoen','norway'] },
    { code:'HEL', name:'Helsinki-Vantaa', city:'Helsinki', country:'Finland', keywords:['helsinki','vantaa','finland'] },
    { code:'IST', name:'Istanbul', city:'Istanbul', country:'Turkey', keywords:['istanbul','turkey','turkish airlines'] },
    { code:'SAW', name:'Istanbul Sabiha Gökçen', city:'Istanbul', country:'Turkey', keywords:['sabiha','istanbul','turkey'] },
    { code:'ATH', name:'Athens Eleftherios Venizelos', city:'Athens', country:'Greece', keywords:['athens','eleftherios','greece'] },
    { code:'WAW', name:'Warsaw Chopin', city:'Warsaw', country:'Poland', keywords:['warsaw','chopin','poland','polska'] },
    { code:'PRG', name:'Václav Havel Prague', city:'Prague', country:'Czech Republic', keywords:['prague','václav havel','czech','bohemia'] },
    { code:'BUD', name:'Budapest Ferenc Liszt', city:'Budapest', country:'Hungary', keywords:['budapest','liszt','hungary','magyar'] },
    // ── Australia & Pacific ──
    { code:'SYD', name:'Sydney Kingsford Smith', city:'Sydney', country:'Australia', keywords:['sydney','kingsford','australia','nsw'] },
    { code:'MEL', name:'Melbourne Tullamarine', city:'Melbourne', country:'Australia', keywords:['melbourne','tullamarine','australia','vic'] },
    { code:'BNE', name:'Brisbane', city:'Brisbane', country:'Australia', keywords:['brisbane','australia','qld'] },
    { code:'PER', name:'Perth', city:'Perth', country:'Australia', keywords:['perth','australia','wa'] },
    { code:'ADL', name:'Adelaide', city:'Adelaide', country:'Australia', keywords:['adelaide','australia','sa'] },
    { code:'AKL', name:'Auckland', city:'Auckland', country:'New Zealand', keywords:['auckland','new zealand','nz'] },
    { code:'CHC', name:'Christchurch', city:'Christchurch', country:'New Zealand', keywords:['christchurch','new zealand','nz'] },
    { code:'NAN', name:'Nadi International', city:'Nadi', country:'Fiji', keywords:['nadi','fiji','fj'] },
    // ── Americas ──
    { code:'JFK', name:'John F. Kennedy International', city:'New York', country:'USA', keywords:['new york','jfk','kennedy','nyc'] },
    { code:'LGA', name:'LaGuardia', city:'New York', country:'USA', keywords:['laguardia','new york','nyc'] },
    { code:'EWR', name:'Newark Liberty International', city:'Newark / New York', country:'USA', keywords:['newark','new york','njc','usa'] },
    { code:'LAX', name:'Los Angeles International', city:'Los Angeles', country:'USA', keywords:['los angeles','lax','la','california'] },
    { code:'ORD', name:"O'Hare International", city:'Chicago', country:'USA', keywords:["o'hare",'chicago','illinois','usa'] },
    { code:'ATL', name:'Hartsfield-Jackson Atlanta', city:'Atlanta', country:'USA', keywords:['atlanta','hartsfield','georgia','usa'] },
    { code:'SFO', name:'San Francisco International', city:'San Francisco', country:'USA', keywords:['san francisco','sfo','california','bay area'] },
    { code:'MIA', name:'Miami International', city:'Miami', country:'USA', keywords:['miami','florida','usa'] },
    { code:'DFW', name:'Dallas/Fort Worth International', city:'Dallas', country:'USA', keywords:['dallas','fort worth','texas','usa'] },
    { code:'YYZ', name:'Toronto Pearson International', city:'Toronto', country:'Canada', keywords:['toronto','pearson','canada','ontario'] },
    { code:'YVR', name:'Vancouver International', city:'Vancouver', country:'Canada', keywords:['vancouver','canada','british columbia'] },
    { code:'YUL', name:'Montréal-Trudeau International', city:'Montreal', country:'Canada', keywords:['montreal','trudeau','canada','quebec'] },
    { code:'GRU', name:'São Paulo-Guarulhos International', city:'São Paulo', country:'Brazil', keywords:['sao paulo','guarulhos','brazil','brasil'] },
    { code:'GIG', name:'Galeão International', city:'Rio de Janeiro', country:'Brazil', keywords:['rio de janeiro','galeao','brazil','brasil'] },
    { code:'EZE', name:'Ministro Pistarini International', city:'Buenos Aires', country:'Argentina', keywords:['buenos aires','pistarini','argentina','ezeiza'] },
    { code:'BOG', name:'El Dorado International', city:'Bogotá', country:'Colombia', keywords:['bogota','el dorado','colombia'] },
    { code:'MEX', name:'Benito Juárez International', city:'Mexico City', country:'Mexico', keywords:['mexico city','ciudad de mexico','benito juarez','cdmx'] },
    { code:'LIM', name:'Jorge Chávez International', city:'Lima', country:'Peru', keywords:['lima','jorge chavez','peru'] },
    // ── Africa ──
    { code:'JNB', name:'O.R. Tambo International', city:'Johannesburg', country:'South Africa', keywords:['johannesburg','tambo','south africa','joburg'] },
    { code:'CPT', name:'Cape Town International', city:'Cape Town', country:'South Africa', keywords:['cape town','kaapstad','south africa'] },
    { code:'CAI', name:'Cairo International', city:'Cairo', country:'Egypt', keywords:['cairo','egypt','egyptair'] },
    { code:'NBO', name:'Jomo Kenyatta International', city:'Nairobi', country:'Kenya', keywords:['nairobi','kenya','jomo kenyatta'] },
    { code:'LOS', name:'Murtala Muhammed International', city:'Lagos', country:'Nigeria', keywords:['lagos','nigeria','murtala'] },
    { code:'CMN', name:'Mohammed V International', city:'Casablanca', country:'Morocco', keywords:['casablanca','morocco','maroc','mohammed v'] },
    { code:'ADD', name:'Addis Ababa Bole International', city:'Addis Ababa', country:'Ethiopia', keywords:['addis ababa','bole','ethiopia','ethiopian airlines'] },
    { code:'SVO', name:'Sheremetyevo International', city:'Moscow', country:'Russia', keywords:['moscow','svo','sheremetyevo','russia'] },
    { code:'SEA', name:'Seattle-Tacoma International', city:'Seattle', country:'USA', keywords:['seattle','tacoma','sea-tac','washington','usa'] },
    { code:'IAD', name:'Washington Dulles International', city:'Washington, D.C.', country:'USA', keywords:['washington','dulles','iad','virginia','dc'] },
    { code:'BOS', name:'Logan International', city:'Boston', country:'USA', keywords:['boston','logan','massachusetts','usa'] }
];

// Score a single airport entry against query. Higher = better match.
function scoreAirport(a, q) {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    if (code === q) return 100;                             // exact code
    if (code.startsWith(q)) return 90;                     // code prefix
    if (city === q) return 80;                             // exact city
    if (city.startsWith(q)) return 70;                    // city prefix
    if (a.keywords.some(k => k === q)) return 65;         // exact keyword
    if (a.keywords.some(k => k.startsWith(q))) return 55; // keyword prefix
    if (name.startsWith(q)) return 50;                    // name prefix
    if (city.includes(q)) return 40;                      // city contains
    if (a.keywords.some(k => k.includes(q))) return 30;  // keyword contains
    if (name.includes(q)) return 20;                      // name contains
    return 0;
}

// Global Autocomplete — scored local database, remote fallback
async function showSuggestions(input, type) {
    const val = input.value.trim();
    const list = document.getElementById(`suggestions-${type}`);
    if (!list) return;

    if (val.length < 2) {
        list.innerHTML = '';
        return;
    }

    const q = val.toLowerCase();

    // Score and sort all local airports
    const scored = ALL_AIRPORTS
        .map(a => ({ a, score: scoreAirport(a, q) }))
        .filter(x => x.score > 0)
        .sort((x, y) => y.score - x.score)
        .slice(0, 6);

    const shown = new Set();
    list.innerHTML = '';

    scored.forEach(({ a }) => {
        shown.add(a.code);
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<strong class="sug-code">${a.code}</strong><span class="sug-info">${a.name} <span class="sug-city">· ${a.city}, ${a.country}</span></span>`;
        div.onclick = () => { input.value = a.code; list.innerHTML = ''; };
        list.appendChild(div);
    });

    // Remote fallback only if we got fewer than 3 local results
    if (scored.length < 3) {
        try {
            const response = await fetch(`https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(val)}&locale=en&types[]=airport`);
            const data = await response.json();
            if (data && data.length > 0) {
                data.slice(0, 5).forEach(item => {
                    if (!item.code || shown.has(item.code)) return;
                    shown.add(item.code);
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `<strong class="sug-code">${item.code}</strong><span class="sug-info">${item.name} <span class="sug-city">· ${item.country_name || ''}</span></span>`;
                    div.onclick = () => { input.value = item.code; list.innerHTML = ''; };
                    list.appendChild(div);
                });
            }
        } catch (e) { /* remote failed, local shown */ }
    }
}


// NEW: Global Hub View Controller
function renderGlobalHub(activeTab = 'flights') {
    currentHubTab = activeTab;
    document.querySelector('.header-title h1').innerText = "Global Hub";
    
    flightListEl.innerHTML = `
        <div class="hero-instrument animated-in">
            <div class="instrument-label">
                <span class="pulse-dot" style="width: 8px; height: 8px;"></span>
                <span>Active Global Airborne Traffic</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 12px;">
                <h1 class="instrument-value" id="hubHeroValue">${latestGlobalAirplanesCount}</h1>
            </div>
            <div class="instrument-sub">
                <ion-icon name="radio-outline" style="color: var(--accent-blue-light);"></ion-icon>
                <span>Live Movements</span>
                <span class="instrument-badge" style="margin-left: auto;">REAL-TIME SAMPLING</span>
            </div>
        </div>

        <!-- 🚨 CRITICAL ALERTS & EMERGENCIES -->
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
            ${latestEmergencies.length > 0 ? latestEmergencies.map(e => `
                <div class="emergency-card" style="background: rgba(239, 68, 68, 0.08); border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 14px; padding: 14px; display: flex; justify-content: space-between; align-items: center; animation: pulse-red 2.5s infinite; backdrop-filter: blur(8px);">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <span style="font-size: 15px; font-weight: 900; color: #fff; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);">${e.flightNo}</span>
                            <span style="font-size: 9px; padding: 2px 8px; background: #ef4444; border-radius: 4px; color: white; font-weight: 800; letter-spacing: 0.5px;">${e.status}</span>
                        </div>
                        <div style="font-size: 11px; color: #fca5a5; font-weight: 500;">
                            ${e.type} · ${e.origin} <ion-icon name="arrow-forward" style="vertical-align: middle;"></ion-icon> ${e.dest}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 13px; font-weight: 800; color: #fff;">${new Intl.NumberFormat().format(e.alt)} ft</div>
                        <div style="font-size: 10px; color: #fca5a5; opacity: 0.8;">${e.speed} kts · ${e.verticalSpeed >= 0 ? '+' : ''}${e.verticalSpeed} fpm</div>
                    </div>
                </div>
            `).join('') : `
                <div style="padding: 14px; background: rgba(34, 197, 94, 0.04); border: 1px dashed rgba(34, 197, 94, 0.2); border-radius: 12px; display: flex; align-items: center; gap: 10px; justify-content: center;">
                    <ion-icon name="shield-checkmark" style="color: #4ade80; font-size: 20px;"></ion-icon>
                    <span style="font-size: 11px; color: #4ade80; font-weight: 600;">SkyWatch: No active global emergencies detected.</span>
                </div>
            `}
        </div>

        <!-- 📈 GLOBAL TRAFFIC TRENDS (24h vs 7d) -->
        <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <ion-icon name="trending-up" style="color: var(--accent-blue-light); font-size: 18px;"></ion-icon>
                <h3 style="font-size: 13px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px;">Global Traffic Trends</h3>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; position: relative; overflow: hidden;">
                <div style="border-right: 1px solid rgba(255,255,255,0.05); padding-right: 5px;">
                    <p style="font-size: 9px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Past 24 Hours</p>
                    <div style="font-size: 20px; font-weight: 800; font-family: var(--code-font); color: #fff;">${new Intl.NumberFormat().format(latestGlobalStats.last24h)}</div>
                    <p style="font-size: 9px; color: var(--text-muted); margin-top: 4px;">Total Flights</p>
                </div>
                <div>
                    <p style="font-size: 9px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">7-Day Average</p>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px; font-weight: 700; color: var(--text-secondary); opacity: 0.7;">${new Intl.NumberFormat().format(latestGlobalStats.avg7d)}</span>
                        <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px; background: ${latestGlobalStats.trend >= 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${latestGlobalStats.trend >= 0 ? '#4ade80' : '#f87171'}; border: 1px solid ${latestGlobalStats.trend >= 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'};">
                            ${latestGlobalStats.trend >= 0 ? '+' : ''}${latestGlobalStats.trend}%
                        </span>
                    </div>
                    <p style="font-size: 9px; color: var(--text-muted); margin-top: 8px;">Growth Trend</p>
                </div>
                ${latestGlobalStats.last24h === 0 ? '<div style="position:absolute; inset:0; background:rgba(6,13,27,0.8); display:flex; align-items:center; justify-content:center; font-size:10px; color:var(--text-muted); font-weight:600;">Syncing intelligence data...</div>' : ''}
            </div>
        </div>


        <!-- ✈️ FLEET & AIRPORT INTELLIGENCE -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 24px;">
            <!-- Fleet Distribution Section (Split Grid) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <!-- Specific Model Distribution -->
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 18px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
                        <ion-icon name="stats-chart" style="color: var(--accent-blue-light); font-size: 16px;"></ion-icon>
                        <h3 style="font-size: 11px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px;">Active Fleet Distribution</h3>
                    </div>
                    <div id="fleetContainer">
                        ${(isFleetExpanded ? latestTopModels : latestTopModels.slice(0, 10)).map((m, idx, arr) => `
                            <div style="margin-bottom: ${idx === arr.length - 1 ? '0' : '15px'};">
                                <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 6px;">
                                    <span style="font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">${formatAircraftModel(m.model)}</span>
                                    <span style="font-weight: 800; color: var(--accent-blue-light);">${m.count}</span>
                                </div>
                                <div style="height: 4px; background: rgba(255,255,255,0.04); border-radius: 2px; overflow: hidden;">
                                    <div style="height: 100%; width: ${idx === 0 ? '100' : Math.min(100, (m.count / latestTopModels[0].count) * 100)}%; background: linear-gradient(90deg, var(--accent-blue), var(--accent-blue-light)); border-radius: 2px;"></div>
                                </div>
                            </div>
                        `).join('') || '<p style="font-size: 11px; color: var(--text-muted); text-align: center;">Analyzing fleet...</p>'}
                    </div>
                    
                    ${latestTopModels.length > 10 ? `
                        <button onclick="window.toggleFleetExpansion()" style="margin-top: 15px; width: 100%; padding: 8px; background: rgba(14, 165, 233, 0.05); border: 1px dashed rgba(14, 165, 233, 0.3); border-radius: 8px; color: var(--accent-blue-light); font-size: 10px; font-weight: 800; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;">
                            ${isFleetExpanded ? 'See Less (Top 10)' : `See All Models (${latestTopModels.length})`}
                        </button>
                    ` : ''}
                </div>

                <!-- Manufacturer Global Breakdown -->
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 18px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
                        <ion-icon name="business" style="color: #60a5fa; font-size: 16px;"></ion-icon>
                        <h3 style="font-size: 11px; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px;">Manufacturer Power Breakdown</h3>
                    </div>
                    ${latestTopBrands.map((b, idx) => {
                        const brandColors = {
                            'Airbus': '#3b82f6',
                            'Boeing': '#f59e0b',
                            'Embraer': '#10b981',
                            'ATR': '#ef4444',
                            'Bombardier': '#8b5cf6',
                            'Gulfstream': '#6366f1',
                            'Cessna': '#0ea5e9',
                            'Dassault Falcon': '#f43f5e',
                            'Beechcraft': '#b91c1c',
                            'Piper': '#f97316',
                            'Cirrus': '#06b6d4',
                            'Diamond': '#2563eb',
                            'Pilatus': '#15803d',
                            'Learjet': '#a855f7',
                            'HondaJet': '#be123c',
                            'Baykar': '#1e293b',
                            'Ilyushin': '#475569',
                            'Antonov': '#5b21b6',
                            'Tupolev': '#334155',
                            'Sukhoi': '#0f172a',
                            'Airbus Helicopters': '#22d3ee',
                            'Robinson': '#84cc16',
                            'Leonardo / Agusta': '#fb7185',
                            'De Havilland': '#0891b2',
                            'Saab': '#1e40af',
                            'Fokker': '#7c3aed',
                            'Dornier': '#4d7c0f',
                            'Lockheed': '#312e81'
                        };
                        
                        // Treat aggregated list (containing comma) as neutral
                        const isAggregated = b.brand.includes(',');
                        const color = isAggregated ? '#4b5563' : (brandColors[b.brand] || '#94a3b8');
                        
                        return `
                            <div style="margin-bottom: ${idx === latestTopBrands.length - 1 ? '0' : '15px'};">
                                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px;">
                                    <span style="font-weight: 800; color: #fff; text-transform: uppercase;">${b.brand}</span>
                                    <span style="font-weight: 900; color: ${color};">${b.count}</span>
                                </div>
                                <div style="height: 6px; background: rgba(255,255,255,0.04); border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${idx === 0 ? '100' : Math.min(100, (b.count / latestTopBrands[0].count) * 100)}%; background: ${color}; border-radius: 3px; box-shadow: 0 0 10px ${color}44;"></div>
                                </div>
                            </div>
                        `;
                    }).join('') || '<p style="font-size: 11px; color: var(--text-muted); text-align: center;">Ranking manufacturers...</p>'}
                </div>
            </div>

            <!-- Hub Statistics Grid (Two Columns forced) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;">
                <!-- Top Departure Hubs -->
                <div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                        <ion-icon name="airplane" style="color: #6366f1; font-size: 16px;"></ion-icon>
                        <h3 style="font-size: 11px; font-weight: 800; color: var(--text-primary); text-transform: uppercase;">Departures</h3>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 2px; overflow: hidden;">
                        ${(latestPopularRoutes.origins || []).map((d, idx) => `
                            <div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 8px; border-bottom: ${idx === (latestPopularRoutes.origins || []).length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)'};">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 6px; background: rgba(99, 102, 241, 0.1); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: #818cf8; font-family: var(--code-font);">${d.iata}</div>
                                    <span style="font-size: 10px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${formatAirportName(d.iata)}</span>
                                </div>
                                <span style="font-size: 9px; color: var(--text-muted); padding-left: 34px;">${d.count} departures</span>
                            </div>
                        `).join('') || '<p style="padding: 20px; font-size: 10px; color: var(--text-muted); text-align: center;">Analyzing...</p>'}
                    </div>
                </div>

                <!-- Top Hub Destinations -->
                <div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                        <ion-icon name="navigate" style="color: #10b981; font-size: 16px;"></ion-icon>
                        <h3 style="font-size: 11px; font-weight: 800; color: var(--text-primary); text-transform: uppercase;">Arrivals</h3>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 2px; overflow: hidden;">
                        ${(latestPopularRoutes.destinations || []).map((d, idx) => `
                            <div style="display: flex; flex-direction: column; gap: 4px; padding: 10px 8px; border-bottom: ${idx === (latestPopularRoutes.destinations || []).length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)'};">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 26px; height: 26px; flex-shrink: 0; border-radius: 6px; background: rgba(16, 185, 129, 0.1); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: #10b981; font-family: var(--code-font);">${d.iata}</div>
                                    <span style="font-size: 10px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${formatAirportName(d.iata)}</span>
                                </div>
                                <span style="font-size: 9px; color: var(--text-muted); padding-left: 34px;">${d.count} arrivals</span>
                            </div>
                        `).join('') || '<p style="padding: 20px; font-size: 10px; color: var(--text-muted); text-align: center;">Analyzing...</p>'}
                    </div>
                </div>
            </div>

            <!-- Global Carrier Power Rankings -->
            <div style="margin-top: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <ion-icon name="ribbon" style="color: #f59e0b; font-size: 18px;"></ion-icon>
                    <h3 style="font-size: 13px; font-weight: 800; color: var(--text-primary); text-transform: uppercase;">Global Carrier Power Rankings</h3>
                </div>
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 18px; position: relative; overflow: hidden;">
                    <!-- Decorate with a subtle globe icon in the background -->
                    <ion-icon name="globe-outline" style="position: absolute; right: -20px; bottom: -20px; font-size: 120px; color: rgba(255,255,255,0.02); transform: rotate(-15deg);"></ion-icon>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        ${latestTopAirlines.map((a, idx) => `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                                    <div style="width: 28px; height: 28px; background: ${idx < 3 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.1)'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; color: ${idx < 3 ? '#000' : '#fff'}; flex-shrink: 0;">${idx + 1}</div>
                                    <div style="overflow: hidden;">
                                        <p style="font-size: 10px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${formatAirlineName(a.code)}</p>
                                        <p style="font-size: 8px; color: var(--text-muted); font-family: var(--code-font);">${a.code}</p>
                                    </div>
                                </div>
                                <div style="text-align: right; flex-shrink: 0;">
                                    <span style="font-size: 11px; font-weight: 900; color: #f59e0b;">${a.count}</span>
                                    <p style="font-size: 7px; color: var(--text-muted); text-transform: uppercase;">Active</p>
                                </div>
                            </div>
                        `).join('') || '<p style="padding: 20px; font-size: 11px; color: var(--text-muted); text-align: center;">Ranking global carriers...</p>'}
                    </div>
                </div>
            </div>
        </div>

        <!-- ORIGINAL TAB NAVIGATION -->
        <div class="segmented-control" style="margin-top: 10px; margin-bottom: 15px;">
            <button class="tab-btn ${activeTab === 'flights' ? 'active' : ''}" id="tabFlights">
                <ion-icon name="airplane-outline"></ion-icon>
                <span>Live Tracker</span>
            </button>
            <button class="tab-btn ${activeTab === 'airports' ? 'active' : ''}" id="tabAirports">
                <ion-icon name="business-outline"></ion-icon>
                <span>Airport Health</span>
            </button>
        </div>
        
        <div id="hubContent"></div>
    `;

    // Helper to find airport name locally or just show code
    function formatAirportName(iata) {
        const a = ALL_AIRPORTS.find(x => x.code === iata);
        return a ? a.name : iata; // Show full airport name instead of city
    }

    // Add tab event listeners
    document.getElementById('tabFlights').addEventListener('click', () => renderGlobalHub('flights'));
    document.getElementById('tabAirports').addEventListener('click', () => renderGlobalHub('airports'));
    
    if (activeTab === 'flights') {
        renderFlights(flights, false);
        loadRealData(true);
    } else {
        renderDisruptions(disruptions, false);
        triggerScrape(true);
    }
}

window.toggleFleetExpansion = function() {
    isFleetExpanded = !isFleetExpanded;
    renderGlobalHub(currentHubTab);
    if (navigator.vibrate) navigator.vibrate(5);
};

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
            renderTickets();
        } else if (item.id === "navSearch") {
             renderSearchView();
        } else if (item.id === "navAccount") {
             flightListEl.innerHTML = `<div style="text-align:center; padding-top:100px; color:var(--text-muted);"><ion-icon name="person-circle-outline" style="font-size:48px;"></ion-icon><p>Account settings coming soon</p></div>`;
        }
    });
});

// Final App Initialization
let disruptions = [];
renderTickets();
// Do NOT automatically load live flight data; it will be loaded when the user clicks the Ticket (formerly Radar) tab if needed.


// Auto-Sync Logic (Every 5 minutes)
setInterval(() => {
    console.log("Auto-syncing data in background...");
    loadRealData(false); // Background update for flights
    triggerScrape(false); // Background update for disruptions
}, 300000); 

// Function to call PHP Puppeteer trigger
async function triggerScrape(isManual = true) {
    if (isManual) {
        // Keep existing disruptions data visible during sync
        renderDisruptions(disruptions, true);
    }
    
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
            if (isManual) showToast("Scraper Error: " + (json.error || "Unknown"), "warning");
            renderDisruptions(disruptions, false); // Keep existing data if possible
        }
        
        if (isManual && navigator.vibrate) navigator.vibrate([20, 50, 20]);
    } catch (e) {
        console.error(e);
        if (isManual) showToast("Gagal menyambung ke Puppeteer Server!", "error");
        renderDisruptions(disruptions, false); // Keep existing data
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
                    <div style="display: flex; align-items: baseline; gap: 8px;">
                        <h3 style="font-size:32px; color: var(--accent-blue-light); font-family: var(--code-font); line-height: 1;" id="extFlightNo">${item.flightNo}</h3>
                        <span id="extCallsign" style="font-size: 14px; color: var(--text-muted); font-family: var(--code-font); border: 1px solid rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; display: none;"></span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <span style="background: var(--status-enroute); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">LIVE</span>
                        <p style="color:var(--text-secondary); font-size: 14px;">${item.airline} • <span id="extReg" class="skeleton">A6-XXX</span></p>
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <button onclick="refreshFlightDetails('${item.flightNo}', this)" style="background: rgba(14, 165, 233, 0.1); border: 1px solid var(--accent-blue); color: var(--accent-blue-light); padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: bold;">
                        <ion-icon name="sync-outline"></ion-icon> <span>Refresh</span>
                    </button>
                    <span class="flight-last-sync" style="font-size: 9px; color: var(--text-muted);"><ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: --:--</span>
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
                <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; color: var(--text-primary); margin-top: 8px;">
                    <div style="display: flex; flex-direction: column;">
                        <span style="color: var(--text-muted); font-size: 8px; text-transform: uppercase;">Elapsed</span>
                        <span id="extElapsed" class="skeleton">00 km, 00:00 ago</span>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-end;">
                        <span style="color: var(--text-muted); font-size: 8px; text-transform: uppercase;">Remaining</span>
                        <span id="extRemaining" class="skeleton">000 km, in 00:00</span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase; margin-bottom: 5px;">Vertical Speed</p>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <ion-icon name="${item.verticalSpeed > 0 ? 'arrow-up-circle' : item.verticalSpeed < 0 ? 'arrow-down-circle' : 'remove-circle-outline'}" 
                                  style="font-size: 18px; color: ${item.verticalSpeed > 0 ? '#4ade80' : item.verticalSpeed < 0 ? '#f87171' : 'var(--text-muted)'};"></ion-icon>
                        <div>
                            <p style="font-size: 16px; font-weight: bold; font-family: var(--code-font); color: #fff; line-height: 1;">
                                ${item.verticalSpeed ? (item.verticalSpeed > 0 ? '+' : '') + item.verticalSpeed : '0'}
                            </p>
                            <p style="font-size: 7px; color: var(--text-muted); text-transform: uppercase;">fpm</p>
                        </div>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase; margin-bottom: 5px;">Barometric Alt.</p>
                    <div>
                        <p style="font-size: 16px; font-weight: bold; font-family: var(--code-font); color: var(--accent-blue-light); line-height: 1;" id="extBaroAlt" class="skeleton">
                            ${item.alt} ft
                        </p>
                        <p style="font-size: 7px; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">Pressure Alt.</p>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase; margin-bottom: 5px;">Ground Speed</p>
                    <div>
                        <p style="font-size: 16px; font-weight: bold; font-family: var(--code-font); color: #fff; line-height: 1;" id="extGroundSpeed" class="skeleton">
                            ${item.speed} kts
                        </p>
                        <p style="font-size: 7px; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">Velocity / GND</p>
                    </div>
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
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                    <button onclick="refreshAirportDetails('${item.iata}', this)" style="background: rgba(14, 165, 233, 0.1); border: 1px solid var(--accent-blue); color: var(--accent-blue-light); padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-weight: bold;">
                        <ion-icon name="sync-outline"></ion-icon> <span>Refresh</span>
                    </button>
                    <span class="modal-last-sync" style="font-size: 9px; color: var(--text-muted);"><ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: --:--</span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase;">Disruption Index</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #eab308;"></div>
                        <p style="font-size: 18px; font-weight: bold;"><span id="extDisruption" class="skeleton">-</span></p>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase;">Average Delay</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #f97316;"></div>
                        <p style="font-size: 18px; font-weight: bold;"><span id="extAvgDelay" class="skeleton">00</span> min</p>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase;">Canceled Today</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></div>
                        <p style="font-size: 16px; font-weight: bold;"><span id="extCancel" class="skeleton">00</span></p>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="color:var(--text-muted); font-size: 9px; text-transform: uppercase;">Delayed Today</p>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></div>
                        <p style="font-size: 16px; font-weight: bold;"><span id="extDelay" class="skeleton">00</span></p>
                    </div>
                </div>
            </div>

            <div style="margin-top: 24px;">
                <h4 style="font-size: 14px; color: var(--text-primary); margin-bottom: 8px;">Airport movements (Last 7 Days)</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
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
                <h4 style="font-size: 14px; color: var(--text-primary); margin-bottom: 8px;">Airport statistics (Last 7 Days)</h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                    <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
                        <p style="color:var(--text-muted); font-size: 10px; text-transform: uppercase;">Airports Served</p>
                        <p style="font-size: 14px; font-weight: bold; color: var(--accent-blue-light);"><span id="extServed" class="skeleton">000</span></p>
                    </div>
                    <div style="background: rgba(255,255,255,0.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between;">
                        <p style="color:var(--text-muted); font-size: 10px; text-transform: uppercase;">Countries</p>
                        <p style="font-size: 14px; font-weight: bold; color: var(--accent-blue-light);"><span id="extCountries" class="skeleton">00</span></p>
                    </div>
                </div>

                <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">Busiest Routes</p>
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

window.refreshAirportDetails = async function(iata, btn) {
    const icon = btn.querySelector('ion-icon');
    const span = btn.querySelector('span');
    const syncText = btn.parentElement.querySelector('.modal-last-sync');
    
    icon.classList.add('pulse-dot');
    span.innerText = "Syncing...";
    
    try {
        await fetchAirportExtendedDetails(iata, true);
        const now = new Date();
        syncText.innerHTML = `<ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    } catch (e) {
        console.error("Failed to refresh:", e);
    } finally {
        icon.classList.remove('pulse-dot');
        span.innerText = "Refresh Live";
    }
}

window.refreshFlightDetails = async function(callsign, btn) {
    const icon = btn.querySelector('ion-icon');
    const span = btn.querySelector('span');
    const syncText = btn.parentElement.querySelector('.flight-last-sync');
    
    icon.classList.add('pulse-dot');
    span.innerText = "Syncing...";
    
    try {
        await fetchExtendedDetails(callsign, true);
    } catch (e) {
        console.error("Failed to refresh:", e);
    } finally {
        icon.classList.remove('pulse-dot');
        span.innerText = "Refresh";
    }
}

async function fetchExtendedDetails(callsign, force = false) {
    if (callsign === "N/A") return;
    
    try {
        const url = force ? `api_details.php?callsign=${callsign}&force=1` : `api_details.php?callsign=${callsign}`;
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success && json.data) {
            const d = json.data;
            
            // Update UI elements
            document.getElementById('extReg').innerText = d.registration || "N/A";
            document.getElementById('extReg').classList.remove('skeleton');
            
            if (d.flightNumber && d.callsign) {
                document.getElementById('extFlightNo').innerText = d.flightNumber;
                const csEl = document.getElementById('extCallsign');
                csEl.innerText = d.callsign;
                csEl.style.display = "inline-block";
            }
            
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
            
            if (document.getElementById('extElapsed')) {
                document.getElementById('extElapsed').innerText = d.elapsed && d.elapsed !== "-" ? d.elapsed : "";
                document.getElementById('extElapsed').classList.remove('skeleton');
            }
            if (document.getElementById('extRemaining')) {
                document.getElementById('extRemaining').innerText = d.remaining && d.remaining !== "-" ? d.remaining : "";
                document.getElementById('extRemaining').classList.remove('skeleton');
            }
            
            document.getElementById('extTermGate').innerText = `${d.terminal || "-"} / ${d.gate || "-"}`;
            document.getElementById('extTermGate').classList.remove('skeleton');
            
            document.getElementById('extAgeMsn').innerText = `${d.age || "-"} / ${d.serialNumber || "-"}`;
            document.getElementById('extAgeMsn').classList.remove('skeleton');

            if (document.getElementById('extBaroAlt')) {
                document.getElementById('extBaroAlt').innerText = d.barometricAlt || "N/A";
                document.getElementById('extBaroAlt').classList.remove('skeleton');
            }
            
            if (document.getElementById('extGroundSpeed')) {
                document.getElementById('extGroundSpeed').innerText = d.groundSpeed || "N/A";
                document.getElementById('extGroundSpeed').classList.remove('skeleton');
            }
            
            const syncEl = document.querySelector('.flight-last-sync');
            if (syncEl) {
                const now = new Date();
                syncEl.innerHTML = `<ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            }
        }
    } catch (e) {
        console.error("Deep scrape failed:", e);
    }
}

async function fetchAirportExtendedDetails(iata, force = false) {
    if (!iata) return;
    
    try {
        const url = force ? `api_airport_details.php?iata=${iata}&force=1` : `api_airport_details.php?iata=${iata}`;
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success && json.data) {
            const d = json.data;
            
            // Update UI elements
            if (document.getElementById('extDisruption')) {
                document.getElementById('extDisruption').innerText = d.disruptionIndex || "-";
                document.getElementById('extDisruption').classList.remove('skeleton');
            }
            if (document.getElementById('extAvgDelay')) {
                document.getElementById('extAvgDelay').innerText = d.avgDelay || "0";
                document.getElementById('extAvgDelay').classList.remove('skeleton');
            }
            if (document.getElementById('extCancel')) {
                document.getElementById('extCancel').innerText = d.cancellations || "0";
                document.getElementById('extCancel').classList.remove('skeleton');
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
                document.getElementById('extServed').innerText = d.airportsServed || "0";
                document.getElementById('extServed').classList.remove('skeleton');
            }
            if (document.getElementById('extCountries')) {
                document.getElementById('extCountries').innerText = d.countriesServed || "0";
                document.getElementById('extCountries').classList.remove('skeleton');
            }
            
            const syncEl = document.querySelector('.modal-last-sync');
            if (syncEl) {
                const now = new Date();
                syncEl.innerHTML = `<ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
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

// ─── Flightradar24 Style Search Logic (Relocated to dedicated Tab) ───────────
function renderSearchView() {
    containerTitle.innerText = "Search Flights & Airports";
    document.querySelector('.live-indicator-wrapper').style.display = "none";
    
    flightListEl.innerHTML = `
        <div style="padding: 24px 20px;">
            <p style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 700;">Direct Search</p>
            <div class="search-container" style="margin-bottom: 24px;">
                <div class="search-input-wrapper" style="height: 48px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                    <ion-icon name="search-outline" class="search-icon-left" style="font-size: 20px; color: var(--text-muted); left: 16px;"></ion-icon>
                    <input id="searchBox" autocomplete="off" type="text" placeholder="Find flights, airports and more..." class="fr24-search-input" style="color: white; font-size: 15px; padding-left: 48px;">
                </div>
                <div id="searchDropdown" class="search-dropdown shadow-xl" style="background: var(--bg-surface-light); border: 1px solid rgba(255,255,255,0.1); color: white; top: calc(100% + 4px);"></div>
            </div>
            
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; text-align: center;">
                <ion-icon name="stats-chart-outline" style="font-size: 32px; color: var(--accent-blue-light); margin-bottom: 12px;"></ion-icon>
                <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Global Data Access</h3>
                <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">Search results include live aircraft targets and airport databases across the globe.</p>
            </div>
        </div>
    `;

    searchInput = document.getElementById("searchBox");
    searchDropdown = document.getElementById("searchDropdown");

    searchInput.addEventListener("input", (e) => updateSearchDropdown(e.target.value));
    searchInput.addEventListener("focus", (e) => updateSearchDropdown(e.target.value));
    searchInput.focus();
}

function updateSearchDropdown(query) {
    if (!query || query.length < 2) {
        searchDropdown.classList.remove('active');
        return;
    }

    const q = query.toLowerCase();
    
    // 1. Filter Live Flights
    const filteredFlights = flights.filter(f => 
        f.flightNo.toLowerCase().includes(q) || 
        f.airline.toLowerCase().includes(q) ||
        f.origin.toLowerCase().includes(q) ||
        f.dest.toLowerCase().includes(q)
    ).slice(0, 5);

    // 2. Filter Airport Database
    const filteredAirports = ALL_AIRPORTS.filter(a => 
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        (a.keywords && a.keywords.some(k => k.includes(q)))
    ).slice(0, 5);

    if (filteredFlights.length === 0 && filteredAirports.length === 0) {
        searchDropdown.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">No results found for "${query}"</div>`;
        searchDropdown.classList.add('active');
        return;
    }

    let html = '';

    // Render Flights
    if (filteredFlights.length > 0) {
        html += `<div class="search-category" style="color: var(--accent-blue-light); border-color: rgba(255,255,255,0.05);">Live Flights</div>`;
        filteredFlights.forEach(f => {
            html += `
                <div class="search-result-item" onclick="selectSearchFlight('${f.flightNo}')" style="background: transparent; color: white; border-color: rgba(255,255,255,0.05);">
                    <div class="search-result-main">
                        <span class="search-result-title" style="color: white;">${f.flightNo}</span>
                        <span class="search-result-sub" style="color: var(--text-secondary);">${f.airline} • ${f.origin} → ${f.dest}</span>
                    </div>
                    <span class="search-result-meta">${f.status}</span>
                </div>
            `;
        });
    }

    // Render Airports
    if (filteredAirports.length > 0) {
        html += `<div class="search-category" style="color: var(--accent-blue-light); border-color: rgba(255,255,255,0.05);">Airports</div>`;
        filteredAirports.forEach(a => {
            html += `
                <div class="search-result-item" onclick="selectSearchAirport('${a.code}')" style="background: transparent; color: white; border-color: rgba(255,255,255,0.05);">
                    <div class="search-result-main">
                        <span class="search-result-title" style="color: white;">${a.name}</span>
                        <span class="search-result-sub" style="color: var(--text-secondary);">${a.city}, ${a.country}</span>
                    </div>
                    <span class="search-result-meta" style="color: var(--text-muted); background: rgba(255,255,255,0.05);">${a.code}</span>
                </div>
            `;
        });
    }

    searchDropdown.innerHTML = html;
    searchDropdown.classList.add('active');
}

window.selectSearchFlight = (flightNo) => {
    const flight = flights.find(f => f.flightNo === flightNo);
    if (flight) {
        openModal(flight);
        searchDropdown.classList.remove('active');
        searchInput.value = '';
    }
};

window.selectSearchAirport = (code) => {
    searchInput.value = code;
    searchDropdown.classList.remove('active');
    
    // Switch to Radar/Home view and filter
    const navRadar = document.getElementById('navRadar');
    if (navRadar) navRadar.click();
    
    // The previous click handler might clear this, so we delay or re-filter
    setTimeout(() => {
        const filtered = flights.filter(f => 
            f.origin === code || f.dest === code
        );
        renderFlights(filtered);
    }, 100);
};

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
    if (searchInput && searchDropdown && !searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.remove('active');
    }
});

