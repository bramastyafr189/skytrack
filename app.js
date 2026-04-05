// Aviation Tracker - Dynamic Data Fetch

let flights = [];
let lastSyncTime = null;

function formatLastSync() {
    if (!lastSyncTime) return "Belum disinkron";
    return `Update: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Global Statistics (Airplanes in Air)
async function loadGlobalStats() {
    try {
        const res = await fetch('api_global_stats.php');
        const json = await res.json();
        if (json.success && json.total_raw) {
            const el = document.getElementById('globalAirplanesCount');
            if (el) {
                el.innerText = `${json.total_raw} Airplanes In Air`;
                if (navigator.vibrate) navigator.vibrate(5);
            }
        }
    } catch (e) {
        console.error("Failed to load global stats:", e);
    }
}

// Initial load for global stats
loadGlobalStats();
setInterval(loadGlobalStats, 300000); // Update every 5 minutes

const flightListEl = document.getElementById("flightList");
const searchInput = document.getElementById("flightSearch");
const modal = document.getElementById("detailsModal");
const closeModalBtn = document.getElementById("closeModal");
const modalBody = document.getElementById("modalBody");
const containerTitle = document.querySelector('.header-title h1');

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
    display.textContent = dt.toLocaleDateString('id-ID', opts);
    display.style.color = 'var(--text-primary)';
}

function renderTickets() {
    containerTitle.innerText = "Search Tickets";
    flightListEl.innerHTML = `
        <div style="padding: 20px;">
            <div class="ticket-form-card">
                <h2 style="font-size: 18px; margin-bottom: 20px; color: var(--accent-blue-light); display:flex; align-items:center; gap:8px;">
                    <ion-icon name="airplane" style="font-size:20px;"></ion-icon> Cari Tiket Murah
                </h2>
                <div style="display: flex; flex-direction: column; gap: 14px;">
                    <div class="input-group" style="position: relative;">
                        <label class="field-label">Dari (Kota / Bandara)</label>
                        <div class="ticket-input-wrapper">
                            <ion-icon name="airplane-outline" class="input-icon"></ion-icon>
                            <input type="text" id="ticketFrom" placeholder="Contoh: Jakarta, CGK, Solo"
                                value="CGK" autocomplete="off"
                                oninput="showSuggestions(this,'from')"
                                onfocus="showSuggestions(this,'from')"
                                class="ticket-input">
                        </div>
                        <div id="suggestions-from" class="autocomplete-list"></div>
                    </div>
                    <div class="input-group" style="position: relative;">
                        <label class="field-label">Ke (Kota / Bandara)</label>
                        <div class="ticket-input-wrapper">
                            <ion-icon name="location-outline" class="input-icon"></ion-icon>
                            <input type="text" id="ticketTo" placeholder="Contoh: Singapura, SIN"
                                value="SIN" autocomplete="off"
                                oninput="showSuggestions(this,'to')"
                                onfocus="showSuggestions(this,'to')"
                                class="ticket-input">
                        </div>
                        <div id="suggestions-to" class="autocomplete-list"></div>
                    </div>
                    <div class="input-group">
                        <label class="field-label">Tanggal Keberangkatan</label>
                        <div class="ticket-input-wrapper date-display-wrapper"
                            onclick="document.getElementById('ticketDate').showPicker ? document.getElementById('ticketDate').showPicker() : document.getElementById('ticketDate').focus()">
                            <ion-icon name="calendar-outline" class="input-icon"></ion-icon>
                            <span id="ticketDateDisplay" class="ticket-input" style="cursor:pointer; color:var(--text-muted);">Pilih tanggal</span>
                            <ion-icon name="chevron-down-outline" style="font-size:14px;color:var(--text-muted);flex-shrink:0;"></ion-icon>
                            <input type="date" id="ticketDate" class="hidden-date-input" onchange="updateDateDisplay()">
                        </div>
                    </div>
                    <button onclick="searchTickets()" id="btnSearchTickets" class="search-flight-btn">
                        <ion-icon name="search-outline"></ion-icon> Cari Penerbangan
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
        showToast('Lengkapi semua field: asal, tujuan, dan tanggal.', 'warning');
        return;
    }

    // Past date validation
    if (date < dateInput.min) {
        showToast('Tidak dapat mencari penerbangan untuk tanggal yang sudah lewat.', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = `<ion-icon name="sync" class="pulse-dot"></ion-icon> Mencari penerbangan...`;
    resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loader-pulse" style="margin: 0 auto; margin-bottom: 15px;"></div>
            <p style="color: var(--accent-blue-light); font-size: 14px; margin-bottom: 4px;">Mengambil data dari Google Flights...</p>
            <p style="color: var(--text-muted); font-size: 11px;">Proses ini memakan waktu sekitar 15–20 detik.</p>
        </div>
    `;
    
    try {
        const url = `api_tickets.php?origin=${from}&dest=${to}&date=${date}${isRefresh ? '&force=1' : ''}`;
        const res = await fetch(url);
        const json = await res.json();
        
        if (json.success && json.data && json.data.length > 0) {
            resultsDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin:0;">Hasil Tiket Termurah</h3>
                    <button onclick="searchTickets(true)" class="btn-refresh-results" title="Cari ulang tanpa cache">
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
                            html += `
                                <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:${si < flight.segments.length - 1 ? '8px' : '0'};">
                                    <div style="display:flex; flex-direction:column; align-items:center; flex-shrink:0; padding-top:2px;">
                                        <div style="width:7px;height:7px;border-radius:50%;background:${si === 0 ? 'var(--accent-blue)' : '#f59e0b'};"></div>
                                        <div style="width:1px;flex:1;background:rgba(255,255,255,0.1);min-height:35px;"></div>
                                        <div style="width:7px;height:7px;border-radius:50%;background:${si === flight.segments.length - 1 ? '#10b981' : '#f59e0b'};"></div>
                                    </div>
                                    <div style="flex:1;">
                                        <div style="font-size:11px;font-weight:600;">${seg.depTime} · ${seg.from || from}</div>
                                        <div style="font-size:9px;color:var(--text-muted);margin:2px 0;">${flight.airline} · ${seg.flightNo || '–'} · ${seg.aircraft || '–'} ${seg.cabinClass ? '· ' + seg.cabinClass : ''}</div>
                                        <div style="font-size:11px;font-weight:600;margin-top:4px;">${seg.arrTime} · ${seg.to || (si === flight.segments.length - 1 ? to : '–')}</div>
                                        ${si < flight.segments.length - 1 && flight.layovers && flight.layovers[si] ? `
                                        <div style="display:flex;align-items:center;gap:6px;margin:6px 0;padding:6px;background:rgba(245,158,11,0.08);border:1px dashed rgba(245,158,11,0.3);border-radius:6px;">
                                            <ion-icon name="time-outline" style="color:#f59e0b;font-size:11px;flex-shrink:0;"></ion-icon>
                                            <span style="font-size:10px;color:#f59e0b;">Transit: ${flight.layovers[si].duration}${flight.layovers[si].airport ? ' di ' + flight.layovers[si].airport : ''}</span>
                                        </div>` : ''}
                                    </div>
                                </div>`;
                        });
                        return html;
                    } else {
                        // Fallback: simple 2-point timeline
                        const layoverRow = flight.layovers && flight.layovers.length > 0
                            ? flight.layovers.map(lv => `
                                <div style="display:flex;align-items:center;gap:6px;margin:6px 0;padding:6px;background:rgba(245,158,11,0.08);border:1px dashed rgba(245,158,11,0.3);border-radius:6px;">
                                    <ion-icon name="time-outline" style="color:#f59e0b;font-size:11px;flex-shrink:0;"></ion-icon>
                                    <span style="font-size:10px;color:#f59e0b;">Transit: ${lv.duration}${lv.airport ? ' di ' + lv.airport : ''}</span>
                                </div>`).join('')
                            : (flight.stopsCount > 0 ? `<div style="display:flex;align-items:center;gap:6px;margin:6px 0;font-size:10px;color:#f59e0b;"><ion-icon name="information-circle-outline"></ion-icon> Detail transit tersedia di Google Flights</div>` : '');

                        return `
                            <div style="display:flex; align-items:flex-start; gap:10px;">
                                <div style="display:flex; flex-direction:column; align-items:center; flex-shrink:0; padding-top:2px;">
                                    <div style="width:7px;height:7px;border-radius:50%;background:var(--accent-blue);"></div>
                                    <div style="width:1px;flex:1;background:rgba(255,255,255,0.1);min-height:35px;"></div>
                                    <div style="width:7px;height:7px;border-radius:50%;background:#10b981;"></div>
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:11px;font-weight:600;">${flight.depTime} · ${from}</div>
                                    <div style="font-size:9px;color:var(--text-muted);margin:2px 0;">${flight.airline} ${flight.flightNos && flight.flightNos[0] ? '· ' + flight.flightNos[0] : ''} ${flight.aircraft ? '· ' + flight.aircraft : ''} ${flight.cabinClass ? '· ' + flight.cabinClass : ''}</div>
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
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                                <span style="font-size:13px; font-weight:700; color:var(--text-primary);">${flight.airline}</span>
                                <span class="stops-badge ${flight.stopsCount === 0 ? 'badge-nonstop' : 'badge-transit'}">${flight.stops}</span>
                                ${flight.stopsCount > 0 ? `<span style="display:flex;gap:3px;align-items:center;">${stopsDots}</span>` : ''}
                                ${flight.flightNos && flight.flightNos.length > 0 ? `<div style="font-size:9px; color:var(--text-dim);">${[...new Set(flight.flightNos)].slice(0,3).join(' · ')}</div>` : ''}
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="text-align:center;">
                                    <span style="display:block; font-size:16px; font-weight:bold;">${flight.depTime}</span>
                                    <span style="font-size:10px; color:var(--text-muted);">${from}</span>
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
                                    <span style="font-size:10px; color:var(--text-muted);">${to}</span>
                                </div>
                            </div>
                            <!-- Badges Row -->
                            <div class="flight-details-extra" style="margin-top:8px;">
                                ${flight.aircraft ? `<div class="detail-badge badge-aircraft"><ion-icon name="airplane-outline"></ion-icon>${flight.aircraft}</div>` : ''}
                                ${flight.emissions ? `<div class="detail-badge badge-emissions ${flight.emissionsDiff && flight.emissionsDiff.includes('-') ? 'low' : ''}"><ion-icon name="leaf-outline"></ion-icon>${flight.emissions}</div>` : ''}
                                ${flight.legroom ? `<div class="detail-badge badge-legroom"><ion-icon name="resize-outline"></ion-icon>${flight.legroom}</div>` : ''}
                            </div>
                        </div>
                        <div style="text-align:right; margin-left:15px; flex-shrink:0;">
                            <span style="display:block; font-size:17px; font-weight:bold; color:#10b981;">${flight.price}</span>
                            <span style="font-size:10px; color:var(--text-muted);">per pax</span>
                            <div style="margin-top:6px;">
                                <ion-icon name="chevron-down-outline" class="expand-chevron" style="font-size:16px;color:var(--text-muted);transition:transform 0.3s;"></ion-icon>
                            </div>
                        </div>
                    </div>

                    <!-- Expandable Details Panel -->
                    <div id="${detailsId}" class="ticket-detail-panel" style="display:none; border-top:1px solid rgba(255,255,255,0.06); margin-top:12px; padding-top:12px;">
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:15px;">
                            <!-- Route Timeline -->
                            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                                <div style="font-size:9px; text-transform:uppercase; color:var(--text-muted); letter-spacing:1px; margin-bottom:10px; display:flex; align-items:center; gap:5px;"><ion-icon name="map"></ion-icon> Rute & Timeline</div>
                                ${buildRouteTimeline()}
                            </div>

                            <!-- Specs & Amenities -->
                            <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                                <div style="font-size:9px; text-transform:uppercase; color:var(--text-muted); letter-spacing:1px; margin-bottom:10px; display:flex; align-items:center; gap:5px;"><ion-icon name="list"></ion-icon> Spesifikasi & Fasilitas</div>
                                
                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                                    <div class="spec-item">
                                        <span class="spec-label">Kelas</span>
                                        <span class="spec-value">${flight.cabinClass || 'Ekonomi'}</span>
                                    </div>
                                    <div class="spec-item">
                                        <span class="spec-label">Pesawat</span>
                                        <span class="spec-value">${flight.aircraft || '–'}</span>
                                    </div>
                                    <div class="spec-item">
                                        <span class="spec-label">Legroom</span>
                                        <span class="spec-value">${flight.legroom || '–'}</span>
                                    </div>
                                    <div class="spec-item">
                                        <span class="spec-label">No. Penerbangan</span>
                                        <span class="spec-value" style="font-family:var(--code-font);">${flight.flightNos && flight.flightNos.length > 0 ? flight.flightNos[0] : '–'}</span>
                                    </div>
                                </div>

                                <!-- Amenities Icons -->
                                <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:8px;">
                                    ${(flight.amenities || []).map(a => {
                                        let icon = 'help-circle-outline';
                                        if (a.toLowerCase().includes('wi-fi')) icon = 'wifi-outline';
                                        if (a.toLowerCase().includes('power')) icon = 'battery-charging-outline';
                                        if (a.toLowerCase().includes('usb')) icon = 'usb-outline';
                                        if (a.toLowerCase().includes('entertainment')) icon = 'tv-outline';
                                        return `<div class="amenity-icon-wrapper" title="${a}"><ion-icon name="${icon}"></ion-icon><span style="font-size:8px;">${a}</span></div>`;
                                    }).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Emissions Detail -->
                        ${flight.emissions ? `
                        <div style="padding:8px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.15); border-radius:8px;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <ion-icon name="leaf-outline" style="color:#10b981;font-size:12px;"></ion-icon>
                                    <span style="font-size:10px;color:var(--text-secondary);">Estimasi emisi karbon: <b>${flight.emissions}</b></span>
                                </div>
                                ${flight.emissionsDiff ? `<span style="font-size:9px; color:${flight.emissionsDiff.includes('-') ? '#10b981' : '#f59e0b'}; background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:4px;">${flight.emissionsDiff}</span>` : ''}
                            </div>
                        </div>` : ''}

                        <!-- CTA Button -->
                        <div style="margin-top:14px;">
                            <a href="${bookingUrl}" target="_blank" class="booking-cta-btn">
                                <ion-icon name="open-outline"></ion-icon>
                                Buka Detail di Google Flights
                            </a>
                        </div>
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
        resultsDiv.innerHTML = `<p style="color:#fca5a5; text-align:center;">Pencarian gagal. Terjadi kesalahan pada server.</p>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<ion-icon name="search-outline"></ion-icon> Cari Penerbangan`;
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

// ─── Indonesian Airport Local Database ───────────────────────────────────────
const ID_AIRPORTS = [
    { code:'CGK', name:'Soekarno-Hatta Internasional', city:'Jakarta', keywords:['jakarta','soekarno','hatta','soeta','cengkareng'] },
    { code:'HLP', name:'Halim Perdanakusuma', city:'Jakarta Timur', keywords:['halim','jakarta timur','perdanakusuma'] },
    { code:'SOC', name:'Adi Soemarmo Internasional', city:'Surakarta / Solo', keywords:['solo','surakarta','soemarmo','adi soemarmo','soc','soerakarta'] },
    { code:'JOG', name:'Adisutjipto', city:'Yogyakarta', keywords:['jogja','yogyakarta','adisutjipto','djogja','yk'] },
    { code:'YIA', name:'Yogyakarta Internasional Airport', city:'Kulon Progo', keywords:['yia','yogyakarta internasional','kulon progo','yia airport'] },
    { code:'SUB', name:'Juanda Internasional', city:'Surabaya', keywords:['surabaya','juanda','sby'] },
    { code:'DPS', name:'I Gusti Ngurah Rai', city:'Bali / Denpasar', keywords:['bali','denpasar','ngurah rai','dps','kuta'] },
    { code:'BDO', name:'Husein Sastranegara', city:'Bandung', keywords:['bandung','husein','sastranegara'] },
    { code:'SRG', name:'Ahmad Yani', city:'Semarang', keywords:['semarang','ahmad yani','jateng'] },
    { code:'MDC', name:'Sam Ratulangi', city:'Manado', keywords:['manado','sam ratulangi','sulut'] },
    { code:'UPG', name:'Sultan Hasanuddin', city:'Makassar', keywords:['makassar','hasanuddin','ujung pandang','sulsel'] },
    { code:'PLM', name:'Sultan Mahmud Badaruddin II', city:'Palembang', keywords:['palembang','mahmud badaruddin','sumsel'] },
    { code:'PKU', name:'Sultan Syarif Kasim II', city:'Pekanbaru', keywords:['pekanbaru','syarif kasim','riau'] },
    { code:'BTH', name:'Hang Nadim', city:'Batam', keywords:['batam','hang nadim','kepri'] },
    { code:'PNK', name:'Supadio Internasional', city:'Pontianak', keywords:['pontianak','supadio','kalbar'] },
    { code:'BPN', name:'Sultan Aji Muhammad Sulaiman Sepinggan', city:'Balikpapan', keywords:['balikpapan','sepinggan','sulaiman','kaltim'] },
    { code:'LOP', name:'Lombok Internasional', city:'Lombok', keywords:['lombok','lop','mataram','ntb'] },
    { code:'AMQ', name:'Pattimura', city:'Ambon', keywords:['ambon','pattimura','maluku'] },
    { code:'MLG', name:'Abdul Rachman Saleh', city:'Malang', keywords:['malang','rachman saleh','jatim'] },
    { code:'TKG', name:'Radin Inten II', city:'Bandar Lampung', keywords:['lampung','bandar lampung','radin inten'] },
    { code:'PDG', name:'Minangkabau Internasional', city:'Padang', keywords:['padang','minangkabau','sumbar'] },
    { code:'BJM', name:'Syamsudin Noor', city:'Banjarmasin', keywords:['banjarmasin','syamsudin noor','kalsel'] },
    { code:'GTO', name:'Djalaluddin', city:'Gorontalo', keywords:['gorontalo','djalaluddin'] },
    { code:'TTE', name:'Sultan Babullah', city:'Ternate', keywords:['ternate','babullah','maluku utara'] },
    { code:'KOE', name:'El Tari', city:'Kupang', keywords:['kupang','el tari','ntt','timor'] },
    { code:'DJJ', name:'Sentani', city:'Jayapura', keywords:['jayapura','sentani','papua'] },
    { code:'TIM', name:'Moses Kilangin', city:'Timika', keywords:['timika','freeport','grasberg'] },
    { code:'MKQ', name:'Mopah', city:'Merauke', keywords:['merauke','mopah'] },
    { code:'JBB', name:'Notohadinegoro', city:'Jember', keywords:['jember','notohadinegoro'] },
    { code:'MKW', name:'Rendani', city:'Manokwari', keywords:['manokwari','rendani','papua barat'] },
];

// Global Autocomplete — dual API with Indonesian local fallback
async function showSuggestions(input, type) {
    const val = input.value.trim();
    const list = document.getElementById(`suggestions-${type}`);
    if (!list) return;

    if (val.length < 2) {
        list.innerHTML = '';
        return;
    }

    const valLower = val.toLowerCase();

    // 1. Instantly show local Indonesian matches
    const localMatches = ID_AIRPORTS.filter(a =>
        a.code.toLowerCase().startsWith(valLower) ||
        a.city.toLowerCase().includes(valLower) ||
        a.name.toLowerCase().includes(valLower) ||
        a.keywords.some(k => k.includes(valLower))
    ).slice(0, 5);

    list.innerHTML = '';
    const shown = new Set();
    localMatches.forEach(item => {
        shown.add(item.code);
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<strong class="sug-code">${item.code}</strong><span class="sug-info">${item.name} <span class="sug-city">· ${item.city}</span></span>`;
        div.onclick = () => { input.value = item.code; list.innerHTML = ''; };
        list.appendChild(div);
    });

    // 2. Fetch remote results and merge
    try {
        const response = await fetch(`https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(val)}&locale=id&types[]=airport&types[]=city`);
        const data = await response.json();
        if (data && data.length > 0) {
            data.forEach(item => {
                if (!item.code || shown.has(item.code)) return;
                shown.add(item.code);
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `<strong class="sug-code">${item.code}</strong><span class="sug-info">${item.name} <span class="sug-city">· ${item.country_name || ''}</span></span>`;
                div.onclick = () => { input.value = item.code; list.innerHTML = ''; };
                list.appendChild(div);
            });
        }
    } catch (e) {
        // Remote failed, local results already shown
    }
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
            renderTickets();
        } else if (item.id === "navSearch") {
             flightListEl.innerHTML = `<div style="text-align:center; padding-top:100px; color:var(--text-muted);"><ion-icon name="search-outline" style="font-size:48px;"></ion-icon><p>Search interface coming soon</p></div>`;
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
        syncText.innerHTML = `<ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
            
            const syncEl = document.querySelector('.flight-last-sync');
            if (syncEl) {
                const now = new Date();
                syncEl.innerHTML = `<ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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
                syncEl.innerHTML = `<ion-icon name="time-outline" style="vertical-align: middle;"></ion-icon> Update: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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

