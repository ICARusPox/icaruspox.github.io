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

function init() {
    try {
        // Instant synchronous dataset load
        dataset = getParsedDataset();

        // Setup Refinement Mode Dropdown
        if (refinementSelect) {
            refinementSelect.addEventListener('change', (e) => {
                refinementMode = e.target.value;
                currentPage = 1;
                updateView();
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

        // Event Listeners
        if (searchInput) searchInput.addEventListener('input', () => { currentPage = 1; updateView(); });
        if (earlyDirectionSelect) earlyDirectionSelect.addEventListener('change', () => { currentPage = 1; updateView(); });
        if (lateDirectionSelect) lateDirectionSelect.addEventListener('change', () => { currentPage = 1; updateView(); });
        if (categorySelect) categorySelect.addEventListener('change', () => { currentPage = 1; updateView(); });

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
                updateView();
            });
        });

        // Setup Pagination Controls
        if (pagePrevBtn) {
            pagePrevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    updateTableAndPaginationOnly();
                }
            });
        }

        if (pageNextBtn) {
            pageNextBtn.addEventListener('click', () => {
                const totalPages = getTotalPages();
                if (currentPage < totalPages) {
                    currentPage++;
                    updateTableAndPaginationOnly();
                }
            });
        }

        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                pageSize = val === 'all' ? 'all' : parseInt(val, 10);
                currentPage = 1;
                updateTableAndPaginationOnly();
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

    // 1. Early Intensities plot (Pro = Amber #f59e0b, Anti = Teal #10b981)
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

    // 2. Late Intensities plot (Pro = Crimson #ea580c, Anti = Royal Blue #2563eb)
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

// Run init on DOMContentLoaded or immediately if already loaded
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
