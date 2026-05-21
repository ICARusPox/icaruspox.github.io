import { rawData } from './data.js';

// Pre-calculate -log10(p-value) for the plot
const data = rawData.map(d => ({
    ...d,
    negLog10P: -Math.log10(d.pvalue)
}));

// 2. DOM Elements
const searchInput = document.getElementById('search');
const directionSelect = document.getElementById('directionFilter');
const categorySelect = document.getElementById('categoryFilter');
const sigCheckbox = document.getElementById('sigFilter');
const tableBody = document.getElementById('tableBody');

// Stats
const statTotal = document.getElementById('stat-total');
const statSig = document.getElementById('stat-sig');
const statPro = document.getElementById('stat-pro');
const statAnti = document.getElementById('stat-anti');

let chartInstance = null;

// 3. Initialize App
function init() {
    // Populate category dropdown
    const categories = [...new Set(data.map(d => d.category))].sort();
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });

    // Event Listeners
    searchInput.addEventListener('input', updateView);
    directionSelect.addEventListener('change', updateView);
    categorySelect.addEventListener('change', updateView);
    sigCheckbox.addEventListener('change', updateView);

    initChart();
    updateView();
}

// 4. Update Logic
function updateView() {
    const searchTerm = searchInput.value.toLowerCase();
    const directionFilter = directionSelect.value;
    const categoryFilter = categorySelect.value;
    const sigFilter = sigCheckbox.checked;

    // Filter data
    const filteredData = data.filter(d => {
        const matchSearch = d.gene.toLowerCase().includes(searchTerm);
        const matchDir = directionFilter === 'all' || d.direction === directionFilter;
        const matchCat = categoryFilter === 'all' || d.category === categoryFilter;
        const matchSig = !sigFilter || d.fdr < 0.05;
        return matchSearch && matchDir && matchCat && matchSig;
    });

    updateStats(filteredData);
    renderTable(filteredData);
    updateChart(filteredData);
}

function updateStats(filteredData) {
    statTotal.textContent = filteredData.length;
    statSig.textContent = filteredData.filter(d => d.fdr < 0.05).length;
    statPro.textContent = filteredData.filter(d => d.direction === 'pro-viral').length;
    statAnti.textContent = filteredData.filter(d => d.direction === 'anti-viral').length;
}

function formatNumber(num) {
    if (Math.abs(num) < 0.001) return num.toExponential(2);
    return num.toFixed(2);
}

function renderTable(filteredData) {
    tableBody.innerHTML = '';
    filteredData.forEach(d => {
        const tr = document.createElement('tr');

        let logClass = '';
        if (d.log2fc > 1) logClass = 'val-pro';
        if (d.log2fc < -1) logClass = 'val-anti';

        let badgeClass = 'none';
        if (d.direction === 'pro-viral') badgeClass = 'pro';
        if (d.direction === 'anti-viral') badgeClass = 'anti';

        tr.innerHTML = `
  <td style="font-weight: 600;">${d.gene}</td>
  <td class="${logClass}">${d.log2fc.toFixed(2)}</td>
  <td>${formatNumber(d.pvalue)}</td>
  <td>${formatNumber(d.fdr)}</td>
  <td><span class="badge ${badgeClass}">${d.direction}</span></td>
  <td>${d.category}</td>
`;
        tableBody.appendChild(tr);
    });
}

// 5. Chart.js Setup
function initChart() {
    const ctx = document.getElementById('volcanoPlot').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const point = ctx.raw.raw;
                            return `${point.gene}: Log2FC ${point.log2fc.toFixed(2)}, FDR ${formatNumber(point.fdr)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Log2 Fold Change' },
                    grid: { borderDash: [4, 4] }
                },
                y: {
                    title: { display: true, text: '-Log10 (p-value)' },
                    grid: { borderDash: [4, 4] }
                }
            }
        }
    });
}

function updateChart(filteredData) {
    // Group points for coloring
    const pro = filteredData.filter(d => d.direction === 'pro-viral' && d.fdr < 0.05);
    const anti = filteredData.filter(d => d.direction === 'anti-viral' && d.fdr < 0.05);
    const none = filteredData.filter(d => d.direction === 'none' || d.fdr >= 0.05);

    const mapToPoint = (d) => ({ x: d.log2fc, y: d.negLog10P, raw: d });

    chartInstance.data.datasets = [
        {
            label: 'Pro-viral',
            data: pro.map(mapToPoint),
            backgroundColor: '#ff922b',
            pointRadius: 5,
            pointHoverRadius: 7
        },
        {
            label: 'Anti-viral',
            data: anti.map(mapToPoint),
            backgroundColor: '#4dabf7',
            pointRadius: 5,
            pointHoverRadius: 7
        },
        {
            label: 'Non-significant',
            data: none.map(mapToPoint),
            backgroundColor: 'rgba(206, 212, 218, 0.5)',
            pointRadius: 4,
            pointHoverRadius: 5
        }
    ];

    chartInstance.update();
}

// Run on load
window.addEventListener('DOMContentLoaded', init);
