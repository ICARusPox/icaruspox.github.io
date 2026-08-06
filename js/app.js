import { getParsedDataset } from './data.js';

// Application State
let dataset = null;
let refinementMode = 'refined'; // 'refined' or 'unrefined'
let sortColumn = 'lateIntensity';
let sortDirection = 'asc';
let currentPage = 1;
let pageSize = 'all';

let earlyChartInstance = null;
let lateChartInstance = null;

// DOM Elements
const refinementSelect = document.getElementById('refinementFilter');
const searchInput = document.getElementById('search');
const earlyDirectionSelect = document.getElementById('earlyDirectionFilter');
const lateDirectionSelect = document.getElementById('lateDirectionFilter');
const categorySelect = document.getElementById('categoryFilter');
const btnExportSVG = document.getElementById('btnExportSVG');
const tableBody = document.getElementById('tableBody');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statEarlyPro = document.getElementById('stat-early-pro');
const statEarlyAnti = document.getElementById('stat-early-anti');
const statLatePro = document.getElementById('stat-late-pro');
const statLateAnti = document.getElementById('stat-late-anti');

// Pagination Elements
const pagePrevBtn = document.getElementById('pagePrev');
const pageNextBtn = document.getElementById('pageNext');
const pageInfo = document.getElementById('pageInfo');
const pageSizeSelect = document.getElementById('pageSizeSelect');

// Loading Indicator Helpers
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

function showLoading(msg = 'Processing 17,672 genes...') {
    if (loadingText) loadingText.textContent = msg;
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    document.body.classList.add('processing');
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    document.body.classList.remove('processing');
}

function scheduleUpdateView(msg = 'Processing dataset...') {
    showLoading(msg);
    setTimeout(() => {
        updateView();
        requestAnimationFrame(() => {
            hideLoading();
        });
    }, 15);
}

function init() {
    try {
        // Instant synchronous dataset load
        dataset = getParsedDataset();

        // Setup Refinement Mode Dropdown
        if (refinementSelect) {
            refinementSelect.addEventListener('change', (e) => {
                refinementMode = e.target.value;
                currentPage = 1;
                scheduleUpdateView('Updating refinement mode...');
            });
        }

        // Populate Category Dropdown
        if (categorySelect && dataset.categories) {
            categorySelect.innerHTML = '<option value="all">All Categories</option>';
            dataset.categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                categorySelect.appendChild(opt);
            });
        }

        // Debounced Search Event Handler
        let searchTimeout = null;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                currentPage = 1;
                showLoading('Searching genes...');
                if (searchTimeout) clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    updateView();
                    requestAnimationFrame(() => hideLoading());
                }, 80);
            });
        }

        if (earlyDirectionSelect) earlyDirectionSelect.addEventListener('change', () => { currentPage = 1; scheduleUpdateView('Filtering early direction...'); });
        if (lateDirectionSelect) lateDirectionSelect.addEventListener('change', () => { currentPage = 1; scheduleUpdateView('Filtering late direction...'); });
        if (categorySelect) categorySelect.addEventListener('change', () => { currentPage = 1; scheduleUpdateView('Filtering category...'); });
        if (btnExportSVG) {
            btnExportSVG.addEventListener('click', () => {
                showLoading('Generating publication vector SVG...');
                setTimeout(() => {
                    exportToSVG();
                    requestAnimationFrame(() => hideLoading());
                }, 20);
            });
        }

        // Setup Table Header Sorting
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (sortColumn === col) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumn = col;
                    sortDirection = (col === 'earlyIntensity' || col === 'lateIntensity') ? 'asc' : 'asc';
                }
                updateHeaderSortIndicators();
                scheduleUpdateView('Sorting 17,672 entries...');
            });
        });

        // Setup Pagination Controls
        if (pagePrevBtn) {
            pagePrevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    scheduleUpdateView('Loading page...');
                }
            });
        }

        if (pageNextBtn) {
            pageNextBtn.addEventListener('click', () => {
                const totalPages = getTotalPages();
                if (currentPage < totalPages) {
                    currentPage++;
                    scheduleUpdateView('Loading page...');
                }
            });
        }

        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                pageSize = val === 'all' ? 'all' : parseInt(val, 10);
                currentPage = 1;
                scheduleUpdateView('Rendering page entries...');
            });
        }

        // Window resize event for canvas redrawing
        window.addEventListener('resize', () => {
            if (lastFilteredData) updateCharts(lastFilteredData);
        });

        updateHeaderSortIndicators();
        updateView();

    } catch (err) {
        console.error('Initialization error:', err);
    }
}

function getProcessedGeneList() {
    if (!dataset || !dataset.genes) return [];

    const isRefined = refinementMode === 'refined';

    return dataset.genes.map(g => {
        const earlyInt = isRefined ? g.earlyRefined : g.earlyUnrefined;
        const lateInt = isRefined ? g.lateRefined : g.lateUnrefined;

        let earlyDirection = 'none';
        if (earlyInt > 0.0001) earlyDirection = 'pro-viral';
        else if (earlyInt < -0.0001) earlyDirection = 'anti-viral';

        let lateDirection = 'none';
        if (lateInt > 0.0001) lateDirection = 'pro-viral';
        else if (lateInt < -0.0001) lateDirection = 'anti-viral';

        return {
            gene: g.gene,
            category: g.category,
            earlyIntensity: earlyInt,
            lateIntensity: lateInt,
            earlyDirection: earlyDirection,
            lateDirection: lateDirection,
            direction: `${earlyDirection === 'pro-viral' ? 'E-Pro' : (earlyDirection === 'anti-viral' ? 'E-Anti' : 'E-None')}_${lateDirection === 'pro-viral' ? 'L-Pro' : (lateDirection === 'anti-viral' ? 'L-Anti' : 'L-None')}`
        };
    });
}

let lastFilteredData = [];

function getFilteredData() {
    const dataList = getProcessedGeneList();
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const earlyDirFilter = earlyDirectionSelect ? earlyDirectionSelect.value : 'all';
    const lateDirFilter = lateDirectionSelect ? lateDirectionSelect.value : 'all';
    const categoryFilter = categorySelect ? categorySelect.value : 'all';

    return dataList.filter(d => {
        const matchSearch = !searchTerm || d.gene.toLowerCase().includes(searchTerm);
        const matchEarlyDir = earlyDirFilter === 'all' || d.earlyDirection === earlyDirFilter;
        const matchLateDir = lateDirFilter === 'all' || d.lateDirection === lateDirFilter;
        const matchCat = categoryFilter === 'all' || d.category === categoryFilter;
        return matchSearch && matchEarlyDir && matchLateDir && matchCat;
    });
}

function getSortedData(filteredData) {
    return [...filteredData].sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function getTotalPages() {
    if (pageSize === 'all' || lastFilteredData.length === 0) return 1;
    return Math.ceil(lastFilteredData.length / pageSize);
}

function updateView() {
    lastFilteredData = getFilteredData();
    updateStats(lastFilteredData);
    updateTableAndPaginationOnly();

    try {
        updateCharts(lastFilteredData);
    } catch (e) {
        console.error('Error updating charts:', e);
    }
}

function updateTableAndPaginationOnly() {
    const sortedData = getSortedData(lastFilteredData);
    const totalCount = sortedData.length;
    const totalPages = getTotalPages();

    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    let displayData = sortedData;
    let startIdx = 0;
    let endIdx = totalCount;

    if (pageSize !== 'all') {
        startIdx = (currentPage - 1) * pageSize;
        endIdx = Math.min(startIdx + pageSize, totalCount);
        displayData = sortedData.slice(startIdx, endIdx);
    }

    renderTable(displayData);
    renderPagination(startIdx, endIdx, totalCount, totalPages);
}

function updateStats(filteredData) {
    if (statTotal) statTotal.textContent = filteredData.length.toLocaleString();
    if (statEarlyPro) statEarlyPro.textContent = filteredData.filter(d => d.earlyDirection === 'pro-viral').length.toLocaleString();
    if (statEarlyAnti) statEarlyAnti.textContent = filteredData.filter(d => d.earlyDirection === 'anti-viral').length.toLocaleString();
    if (statLatePro) statLatePro.textContent = filteredData.filter(d => d.lateDirection === 'pro-viral').length.toLocaleString();
    if (statLateAnti) statLateAnti.textContent = filteredData.filter(d => d.lateDirection === 'anti-viral').length.toLocaleString();
}

function renderTable(displayData) {
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (displayData.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No matching genes found</td>`;
        tableBody.appendChild(tr);
        return;
    }

    const fragment = document.createDocumentFragment();
    displayData.forEach(d => {
        const tr = document.createElement('tr');

        let earlyClass = d.earlyDirection === 'pro-viral' ? 'val-early-pro' : (d.earlyDirection === 'anti-viral' ? 'val-early-anti' : '');
        let lateClass = d.lateDirection === 'pro-viral' ? 'val-late-pro' : (d.lateDirection === 'anti-viral' ? 'val-late-anti' : '');

        let earlyBadgeClass = d.earlyDirection === 'pro-viral' ? 'early-pro' : (d.earlyDirection === 'anti-viral' ? 'early-anti' : 'none');
        let earlyArrow = d.earlyDirection === 'pro-viral' ? '↑' : (d.earlyDirection === 'anti-viral' ? '↓' : '–');

        let lateBadgeClass = d.lateDirection === 'pro-viral' ? 'late-pro' : (d.lateDirection === 'anti-viral' ? 'late-anti' : 'none');
        let lateArrow = d.lateDirection === 'pro-viral' ? '↑' : (d.lateDirection === 'anti-viral' ? '↓' : '–');

        tr.innerHTML = `
            <td style="font-weight: 600;">${d.gene}</td>
            <td class="${earlyClass}">${d.earlyIntensity.toFixed(3)}</td>
            <td class="${lateClass}">${d.lateIntensity.toFixed(3)}</td>
            <td>
                <div class="dir-cell">
                    <span class="dir-badge ${earlyBadgeClass}" title="Early: ${d.earlyDirection} (${earlyArrow})">E ${earlyArrow}</span>
                    <span class="dir-badge ${lateBadgeClass}" title="Late: ${d.lateDirection} (${lateArrow})">L ${lateArrow}</span>
                </div>
            </td>
            <td>${d.category}</td>
        `;
        fragment.appendChild(tr);
    });
    tableBody.appendChild(fragment);
}

function renderPagination(startIdx, endIdx, totalCount, totalPages) {
    if (pageInfo) {
        if (totalCount === 0) {
            pageInfo.textContent = 'Showing 0 entries';
        } else if (pageSize === 'all') {
            pageInfo.textContent = `Showing all ${totalCount.toLocaleString()} entries`;
        } else {
            pageInfo.textContent = `Showing ${(startIdx + 1).toLocaleString()} to ${endIdx.toLocaleString()} of ${totalCount.toLocaleString()} entries (Page ${currentPage} of ${totalPages})`;
        }
    }

    if (pagePrevBtn) pagePrevBtn.disabled = currentPage <= 1 || pageSize === 'all';
    if (pageNextBtn) pageNextBtn.disabled = currentPage >= totalPages || pageSize === 'all';
}

function updateHeaderSortIndicators() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        const col = th.getAttribute('data-sort');
        const iconSpan = th.querySelector('.sort-icon');
        if (col === sortColumn) {
            th.classList.add('sorted');
            if (iconSpan) iconSpan.textContent = sortDirection === 'asc' ? ' ▲' : ' ▼';
        } else {
            th.classList.remove('sorted');
            if (iconSpan) iconSpan.textContent = '';
        }
    });
}

function updateCharts(filteredData) {
    if (typeof Chart !== 'undefined') {
        updateChartJS(filteredData);
    } else {
        drawNativeRankPlot('earlyPlot', [...filteredData].sort((a, b) => a.earlyIntensity - b.earlyIntensity), 'earlyIntensity', '#f59e0b', '#10b981');
        drawNativeRankPlot('latePlot', [...filteredData].sort((a, b) => a.lateIntensity - b.lateIntensity), 'lateIntensity', '#ea580c', '#2563eb');
    }
}

function updateChartJS(filteredData) {
    const earlyCanvas = document.getElementById('earlyPlot');
    const lateCanvas = document.getElementById('latePlot');

    if (!earlyCanvas || !lateCanvas) return;

    if (!earlyChartInstance) {
        earlyChartInstance = new Chart(earlyCanvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets: [] },
            options: createChartJSOptions('Early Intensity', 'Gene Rank')
        });
    }

    if (!lateChartInstance) {
        lateChartInstance = new Chart(lateCanvas.getContext('2d'), {
            type: 'scatter',
            data: { datasets: [] },
            options: createChartJSOptions('Late Intensity', 'Gene Rank')
        });
    }

    // 1. Early Intensities plot
    const sortedEarly = [...filteredData].sort((a, b) => a.earlyIntensity - b.earlyIntensity);
    const earlyDataPoints = sortedEarly.map((d, index) => ({
        x: index + 1,
        y: d.earlyIntensity,
        gene: d.gene,
        category: d.category
    }));
    const earlyColors = earlyDataPoints.map(p => p.y >= 0 ? '#f59e0b' : '#10b981');

    earlyChartInstance.data.datasets = [{
        label: 'Early Intensity',
        data: earlyDataPoints,
        backgroundColor: earlyColors,
        pointRadius: earlyDataPoints.length > 500 ? 2 : 4,
        pointHoverRadius: 6,
        showLine: true,
        borderColor: 'rgba(180, 190, 200, 0.4)',
        borderWidth: 1.5
    }];
    earlyChartInstance.update('none');

    // 2. Late Intensities plot
    const sortedLate = [...filteredData].sort((a, b) => a.lateIntensity - b.lateIntensity);
    const lateDataPoints = sortedLate.map((d, index) => ({
        x: index + 1,
        y: d.lateIntensity,
        gene: d.gene,
        category: d.category
    }));
    const lateColors = lateDataPoints.map(p => p.y >= 0 ? '#ea580c' : '#2563eb');

    lateChartInstance.data.datasets = [{
        label: 'Late Intensity',
        data: lateDataPoints,
        backgroundColor: lateColors,
        pointRadius: lateDataPoints.length > 500 ? 2 : 4,
        pointHoverRadius: 6,
        showLine: true,
        borderColor: 'rgba(180, 190, 200, 0.4)',
        borderWidth: 1.5
    }];
    lateChartInstance.update('none');
}

function createChartJSOptions(yTitle, xTitle) {
    return {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const point = ctx.raw;
                        return `${point.gene}: Intensity ${point.y.toFixed(3)} (Rank ${point.x}, Category: ${point.category})`;
                    }
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: xTitle },
                grid: { borderDash: [4, 4] }
            },
            y: {
                title: { display: true, text: yTitle },
                grid: { borderDash: [4, 4] }
            }
        }
    };
}

// Standalone Native HTML5 Canvas Renderer
function drawNativeRankPlot(canvasId, sortedData, valueKey, proColor, antiColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.parentElement.clientWidth || 500;
    const height = rect.height || canvas.parentElement.clientHeight || 250;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);

    if (!sortedData || sortedData.length === 0) {
        ctx.fillStyle = '#6c757d';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data to display', width / 2, height / 2);
        return;
    }

    const margin = { top: 20, right: 25, bottom: 35, left: 55 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const values = sortedData.map(d => d[valueKey]);
    let yMin = values[0];
    let yMax = values[0];
    for (let i = 1; i < values.length; i++) {
        if (values[i] < yMin) yMin = values[i];
        if (values[i] > yMax) yMax = values[i];
    }

    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPadding = (yMax - yMin) * 0.05;
    yMin -= yPadding;
    yMax += yPadding;

    const xMin = 1;
    const xMax = sortedData.length;

    const getXPixel = (x) => margin.left + ((x - xMin) / Math.max(1, xMax - xMin)) * plotWidth;
    const getYPixel = (y) => margin.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;

    // Grid lines & Y ticks
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6c757d';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    const yTickCount = 4;
    for (let i = 0; i <= yTickCount; i++) {
        const val = yMin + (i / yTickCount) * (yMax - yMin);
        const yPx = getYPixel(val);
        ctx.beginPath();
        ctx.moveTo(margin.left, yPx);
        ctx.lineTo(width - margin.right, yPx);
        ctx.stroke();

        ctx.fillText(val.toFixed(2), margin.left - 8, yPx + 4);
    }

    // Zero Line
    if (yMin <= 0 && yMax >= 0) {
        const zeroY = getYPixel(0);
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(margin.left, zeroY);
        ctx.lineTo(width - margin.right, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // S-curve line
    ctx.strokeStyle = 'rgba(180, 190, 200, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < sortedData.length; i++) {
        const px = getXPixel(i + 1);
        const py = getYPixel(sortedData[i][valueKey]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Data points
    const step = sortedData.length > 2000 ? Math.ceil(sortedData.length / 2000) : 1;
    for (let i = 0; i < sortedData.length; i += step) {
        const val = sortedData[i][valueKey];
        const px = getXPixel(i + 1);
        const py = getYPixel(val);

        ctx.fillStyle = val >= 0 ? proColor : antiColor;
        ctx.beginPath();
        ctx.arc(px, py, sortedData.length > 500 ? 1.5 : 3, 0, 2 * Math.PI);
        ctx.fill();
    }

    // X Axis Label
    ctx.fillStyle = '#6c757d';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gene Rank', margin.left + plotWidth / 2, height - 8);
}

// Standalone Publication-Quality Vector SVG Exporter
function exportToSVG() {
    if (!lastFilteredData) return;

    const width = 1420;
    const height = 920;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
    svg += `  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .brand-title { font-size: 22px; font-weight: bold; fill: #1c7ed6; }
    .brand-sub { font-size: 11px; fill: #6c757d; }
    .stat-label { font-size: 9px; font-weight: 600; fill: #6c757d; text-transform: uppercase; }
    .stat-value { font-size: 16px; font-weight: bold; fill: #212529; }
    .th { font-size: 11px; font-weight: 600; fill: #6c757d; }
    .td { font-size: 11px; fill: #212529; }
    .plot-title { font-size: 14px; font-weight: bold; fill: #212529; }
    .axis-label { font-size: 11px; fill: #6c757d; }
    .tick-label { font-size: 10px; fill: #6c757d; }
  </style>\n`;

    // Background
    svg += `  <rect width="${width}" height="${height}" fill="#ffffff"/>\n`;

    // Header Title
    svg += `  <g transform="translate(30, 35)">\n`;
    svg += `    <text x="0" y="0" class="brand-title">ICARusPox Dashboard</text>\n`;
    svg += `    <text x="0" y="18" class="brand-sub">Genome-wide Vaccinia Virus High-Content Imaging Screen V1.0 (Refined with Interactome-Corrected Analysis of RNAi)</text>\n`;
    svg += `  </g>\n`;

    // Header Stats Cards
    const earlyProCount = lastFilteredData.filter(d => d.earlyDirection === 'pro-viral').length;
    const earlyAntiCount = lastFilteredData.filter(d => d.earlyDirection === 'anti-viral').length;
    const lateProCount = lastFilteredData.filter(d => d.lateDirection === 'pro-viral').length;
    const lateAntiCount = lastFilteredData.filter(d => d.lateDirection === 'anti-viral').length;

    const stats = [
        { label: 'TOTAL GENES', val: lastFilteredData.length.toLocaleString(), color: '#212529' },
        { label: 'EARLY PRO (E ↑)', val: earlyProCount.toLocaleString(), color: '#f59e0b' },
        { label: 'EARLY ANTI (E ↓)', val: earlyAntiCount.toLocaleString(), color: '#10b981' },
        { label: 'LATE PRO (L ↑)', val: lateProCount.toLocaleString(), color: '#ea580c' },
        { label: 'LATE ANTI (L ↓)', val: lateAntiCount.toLocaleString(), color: '#2563eb' }
    ];

    let statStartX = 720;
    stats.forEach((s, i) => {
        const x = statStartX + (i * 132);
        svg += `  <g transform="translate(${x}, 15)">\n`;
        svg += `    <rect width="124" height="46" rx="4" fill="#f8f9fa" stroke="#e9ecef"/>\n`;
        svg += `    <text x="62" y="16" text-anchor="middle" class="stat-label">${s.label}</text>\n`;
        svg += `    <text x="62" y="36" text-anchor="middle" class="stat-value" fill="${s.color}">${s.val}</text>\n`;
        svg += `  </g>\n`;
    });

    // Divider Line
    svg += `  <line x1="30" y1="78" x2="${width - 30}" y2="78" stroke="#e9ecef" stroke-width="1"/>\n`;

    // Filter Summary Text
    const modeText = refinementMode === 'refined' ? 'Refined (ICARus Interactome-Corrected)' : 'Unrefined (Raw Screen)';
    svg += `  <text x="30" y="98" font-size="12" font-weight="500" fill="#495057">Mode: ${escapeXML(modeText)} | Displayed Genes: ${lastFilteredData.length.toLocaleString()}</text>\n`;

    // Table Section (Left Side) - Top 32 entries
    const sortedData = getSortedData(lastFilteredData);
    const tableData = sortedData.slice(0, 32);

    const tableX = 30;
    const tableY = 112;
    const tableWidth = 630;

    svg += `  <!-- Table Section -->\n`;
    svg += `  <g transform="translate(${tableX}, ${tableY})">\n`;
    svg += `    <rect width="${tableWidth}" height="${height - tableY - 30}" fill="#ffffff" stroke="#e9ecef" rx="6"/>\n`;

    // Table Headers
    svg += `    <g transform="translate(0, 0)">\n`;
    svg += `      <rect width="${tableWidth}" height="28" fill="#f8f9fa" rx="6"/>\n`;
    svg += `      <text x="12" y="18" class="th">Gene</text>\n`;
    svg += `      <text x="100" y="18" class="th">Early Int</text>\n`;
    svg += `      <text x="185" y="18" class="th">Late Int</text>\n`;
    svg += `      <text x="270" y="18" class="th">Direction (E / L)</text>\n`;
    svg += `      <text x="400" y="18" class="th">Category</text>\n`;
    svg += `    </g>\n`;

    // Table Rows
    let rowY = 28;
    tableData.forEach((d, idx) => {
        const bg = idx % 2 === 1 ? '#f8f9fa' : '#ffffff';
        svg += `    <g transform="translate(0, ${rowY})">\n`;
        svg += `      <rect width="${tableWidth}" height="23" fill="${bg}"/>\n`;
        svg += `      <text x="12" y="15" class="td" font-weight="bold">${escapeXML(d.gene)}</text>\n`;

        const earlyClass = d.earlyDirection === 'pro-viral' ? '#b45309' : (d.earlyDirection === 'anti-viral' ? '#047857' : '#212529');
        const lateClass = d.lateDirection === 'pro-viral' ? '#c2410c' : (d.lateDirection === 'anti-viral' ? '#1d4ed8' : '#212529');

        svg += `      <text x="100" y="15" font-size="11" font-weight="600" fill="${earlyClass}">${d.earlyIntensity.toFixed(3)}</text>\n`;
        svg += `      <text x="185" y="15" font-size="11" font-weight="600" fill="${lateClass}">${d.lateIntensity.toFixed(3)}</text>\n`;

        // Early Badge
        const earlyArrow = d.earlyDirection === 'pro-viral' ? '↑' : (d.earlyDirection === 'anti-viral' ? '↓' : '–');
        const earlyBg = d.earlyDirection === 'pro-viral' ? '#fef3c7' : (d.earlyDirection === 'anti-viral' ? '#d1fae5' : '#f8f9fa');
        const earlyBorder = d.earlyDirection === 'pro-viral' ? '#fcd34d' : (d.earlyDirection === 'anti-viral' ? '#6ee7b7' : '#e9ecef');
        const earlyTextCol = d.earlyDirection === 'pro-viral' ? '#b45309' : (d.earlyDirection === 'anti-viral' ? '#047857' : '#6c757d');

        svg += `      <rect x="270" y="3" width="40" height="16" rx="3" fill="${earlyBg}" stroke="${earlyBorder}"/>\n`;
        svg += `      <text x="290" y="14" text-anchor="middle" font-size="10" font-weight="bold" fill="${earlyTextCol}">E ${earlyArrow}</text>\n`;

        // Late Badge
        const lateArrow = d.lateDirection === 'pro-viral' ? '↑' : (d.lateDirection === 'anti-viral' ? '↓' : '–');
        const lateBg = d.lateDirection === 'pro-viral' ? '#ffedd5' : (d.lateDirection === 'anti-viral' ? '#dbeafe' : '#f8f9fa');
        const lateBorder = d.lateDirection === 'pro-viral' ? '#fdba74' : (d.lateDirection === 'anti-viral' ? '#93c5fd' : '#e9ecef');
        const lateTextCol = d.lateDirection === 'pro-viral' ? '#c2410c' : (d.lateDirection === 'anti-viral' ? '#1d4ed8' : '#6c757d');

        svg += `      <rect x="318" y="3" width="40" height="16" rx="3" fill="${lateBg}" stroke="${lateBorder}"/>\n`;
        svg += `      <text x="338" y="14" text-anchor="middle" font-size="10" font-weight="bold" fill="${lateTextCol}">L ${lateArrow}</text>\n`;

        // Truncate category if long
        const catText = d.category.length > 30 ? d.category.substring(0, 28) + '...' : d.category;
        svg += `      <text x="400" y="15" font-size="10" fill="#6c757d">${escapeXML(catText)}</text>\n`;
        svg += `    </g>\n`;
        rowY += 23;
    });

    if (sortedData.length > 32) {
        svg += `    <text x="12" y="${rowY + 14}" font-size="11" font-style="italic" fill="#6c757d">... and ${(sortedData.length - 32).toLocaleString()} additional entries in dataset</text>\n`;
    }

    svg += `  </g>\n`;

    // Rank Plots Section (Right Side)
    const chartX = 680;
    const chartY = 112;
    const chartWidth = 710;
    const chartHeight = 360;

    svg += renderSVGRankPlot('Early Intensities', [...lastFilteredData].sort((a, b) => a.earlyIntensity - b.earlyIntensity), 'earlyIntensity', chartX, chartY, chartWidth, chartHeight, '#f59e0b', '#10b981');
    svg += renderSVGRankPlot('Late Intensities', [...lastFilteredData].sort((a, b) => a.lateIntensity - b.lateIntensity), 'lateIntensity', chartX, chartY + chartHeight + 20, chartWidth, chartHeight, '#ea580c', '#2563eb');

    svg += `</svg>`;

    // Download Blob
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ICARusPox_dashboard_${refinementMode}_${new Date().toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function renderSVGRankPlot(title, sortedData, valueKey, originX, originY, width, height, proColor, antiColor) {
    let s = `  <!-- Rank Plot: ${escapeXML(title)} -->\n`;
    s += `  <g transform="translate(${originX}, ${originY})">\n`;
    s += `    <rect width="${width}" height="${height}" fill="#ffffff" stroke="#e9ecef" rx="6"/>\n`;
    s += `    <text x="15" y="22" class="plot-title">${escapeXML(title)}</text>\n`;

    if (!sortedData || sortedData.length === 0) {
        s += `    <text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="axis-label">No data available</text>\n`;
        s += `  </g>\n`;
        return s;
    }

    const margin = { top: 35, right: 25, bottom: 40, left: 60 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const values = sortedData.map(d => d[valueKey]);
    let yMin = values[0];
    let yMax = values[0];
    for (let i = 1; i < values.length; i++) {
        if (values[i] < yMin) yMin = values[i];
        if (values[i] > yMax) yMax = values[i];
    }
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const yPad = (yMax - yMin) * 0.05;
    yMin -= yPad;
    yMax += yPad;

    const getX = (i) => margin.left + (i / Math.max(1, sortedData.length - 1)) * plotW;
    const getY = (v) => margin.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    // Grid lines & Y Ticks
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const val = yMin + (i / yTicks) * (yMax - yMin);
        const yPx = getY(val);
        s += `    <line x1="${margin.left}" y1="${yPx}" x2="${width - margin.right}" y2="${yPx}" stroke="#e9ecef" stroke-width="1" stroke-dasharray="4 4"/>\n`;
        s += `    <text x="${margin.left - 8}" y="${yPx + 4}" text-anchor="end" class="tick-label">${val.toFixed(2)}</text>\n`;
    }

    // Zero Reference Line
    if (yMin <= 0 && yMax >= 0) {
        const zeroY = getY(0);
        s += `    <line x1="${margin.left}" y1="${zeroY}" x2="${width - margin.right}" y2="${zeroY}" stroke="#adb5bd" stroke-width="1.5" stroke-dasharray="4 4"/>\n`;
    }

    // S-Curve Trend Path
    let pathD = '';
    for (let i = 0; i < sortedData.length; i++) {
        const px = getX(i);
        const py = getY(sortedData[i][valueKey]);
        pathD += (i === 0 ? `M ${px.toFixed(1)} ${py.toFixed(1)}` : ` L ${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    s += `    <path d="${pathD}" fill="none" stroke="rgba(180, 190, 200, 0.4)" stroke-width="1.5"/>\n`;

    // Data Points (Step down to prevent huge SVG size on 17k points)
    const step = sortedData.length > 2500 ? Math.ceil(sortedData.length / 2500) : 1;
    for (let i = 0; i < sortedData.length; i += step) {
        const val = sortedData[i][valueKey];
        const px = getX(i);
        const py = getY(val);
        const color = val >= 0 ? proColor : antiColor;
        s += `    <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="${color}"/>\n`;
    }

    // Axis Labels
    s += `    <text x="${margin.left + plotW / 2}" y="${height - 10}" text-anchor="middle" class="axis-label">Gene Rank</text>\n`;
    s += `  </g>\n`;

    return s;
}

function escapeXML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Run init on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
