/* ─────────────────────────────────────────
   CHART.JS GLOBAL DEFAULTS
───────────────────────────────────────── */
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size   = 12;
Chart.defaults.color       = '#94a3b8';

const sharedGrid = { color: 'rgba(0,0,0,0.05)', drawBorder: false };
const sharedTick = { padding: 8, color: '#94a3b8' };
const darkTooltip = {
  backgroundColor: 'rgba(15,23,42,0.92)',
  padding: 12,
  cornerRadius: 10,
  titleColor: '#ffffff',
  bodyColor: '#94a3b8',
};

/* ─────────────────────────────────────────
   PARSE CSV HELPER
───────────────────────────────────────── */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      const v = (vals[i] || '').trim();
      obj[h] = isNaN(v) || v === '' ? v : Number(v);
    });
    return obj;
  });
}

/* ─────────────────────────────────────────
   AGGREGATE BY MONTH
───────────────────────────────────────── */
function aggregateByMonth(rows) {
  const order = ['Jan','Feb','Mar','Apr','May','Jun'];
  const map   = {};

  rows.forEach(r => {
    if (!map[r.month]) {
      map[r.month] = { customers: 0, retained: 0, sla: 0, low: 0, med: 0, high: 0 };
    }
    const m = map[r.month];
    m.customers++;
    if (r.retained   === 'Yes') m.retained++;
    if (r.sla_met    === 'Yes') m.sla++;
    if (r.risk_level === 'Low')    m.low++;
    if (r.risk_level === 'Medium') m.med++;
    if (r.risk_level === 'High')   m.high++;
  });

  return order.filter(m => map[m]).map(m => ({
    month:     m,
    retention: +(map[m].retained / map[m].customers * 100).toFixed(1),
    sla:       +(map[m].sla      / map[m].customers * 100).toFixed(1),
    low:       map[m].low,
    medium:    map[m].med,
    high:      map[m].high,
  }));
}

/* ─────────────────────────────────────────
   UPDATE KPI TILES
───────────────────────────────────────── */
function updateKPIs(rows, monthly) {
  const total    = rows.length;
  const retained = rows.filter(r => r.retained  === 'Yes').length;
  const slaOk    = rows.filter(r => r.sla_met   === 'Yes').length;
  const highRisk = rows.filter(r => r.risk_level === 'High').length;

  const retPct  = (retained / total * 100).toFixed(1);
  const slaPct  = (slaOk    / total * 100).toFixed(1);

  // Animate counter
  function countUp(el, target, suffix='') {
    let start = 0, step = target / 40;
    const tick = () => {
      start = Math.min(start + step, target);
      el.textContent = Math.round(start) + suffix;
      if (start < target) requestAnimationFrame(tick);
    };
    tick();
  }

  const retEl = document.querySelector('#kpi-retention .kpi-value');
  const hrEl  = document.querySelector('#kpi-revenue   .kpi-value');
  const slaEl = document.querySelector('#kpi-sla       .kpi-value');
  const autoEl= document.querySelector('#kpi-automation .kpi-value');

  if (retEl)  retEl.innerHTML  = `<span id="ret-num">0</span><span class="kpi-unit">%</span>`;
  if (hrEl)   hrEl.innerHTML   = `<span id="hr-num">0</span><span class="kpi-unit"> accts</span>`;
  if (slaEl)  slaEl.innerHTML  = `<span id="sla-num">0</span><span class="kpi-unit">%</span>`;
  if (autoEl) autoEl.innerHTML = `<span id="auto-num">0</span><span class="kpi-unit">%</span>`;

  countUp(document.getElementById('ret-num'),  parseFloat(retPct));
  countUp(document.getElementById('hr-num'),   highRisk);
  countUp(document.getElementById('sla-num'),  parseFloat(slaPct));
  countUp(document.getElementById('auto-num'), 70);

  // Update trend text
  const lastRet  = monthly[monthly.length - 1]?.retention || 0;
  const firstRet = monthly[0]?.retention || 0;
  const diff = (lastRet - firstRet).toFixed(1);
  const trendEl = document.querySelector('#kpi-retention .kpi-trend');
  if (trendEl) trendEl.textContent = `↑ ${diff}% vs ${monthly[0]?.month}`;
}

/* ─────────────────────────────────────────
   RETENTION LINE CHART
───────────────────────────────────────── */
function createRetentionChart(months, retention) {
  const ctx = document.getElementById('retentionChart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, 'rgba(8,145,178,0.22)');
  grad.addColorStop(1, 'rgba(8,145,178,0.00)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Retention Rate (%)',
        data: retention,
        borderColor: '#0891b2',
        backgroundColor: grad,
        borderWidth: 2.5,
        pointBackgroundColor: '#0891b2',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...darkTooltip, callbacks: { label: ctx => ` ${ctx.parsed.y}%` } }
      },
      scales: {
        x: { grid: sharedGrid, ticks: sharedTick, border: { display: false } },
        y: {
          grid: sharedGrid,
          ticks: { ...sharedTick, callback: v => v + '%' },
          border: { display: false },
          min: 60, max: 100,
        }
      }
    }
  });
}

/* ─────────────────────────────────────────
   REVENUE RISK BAR CHART
───────────────────────────────────────── */
function createRevenueChart(monthly) {
  const totals = monthly.reduce(
    (acc, m) => { acc.low += m.low; acc.medium += m.medium; acc.high += m.high; return acc; },
    { low: 0, medium: 0, high: 0 }
  );

  new Chart(document.getElementById('revenueChart'), {
    type: 'bar',
    data: {
      labels: ['Low Risk', 'Medium Risk', 'High Risk'],
      datasets: [{
        label: 'Customers',
        data: [totals.low, totals.medium, totals.high],
        backgroundColor: [
          'rgba(16,185,129,0.78)',
          'rgba(245,158,11,0.78)',
          'rgba(244,63,94,0.78)',
        ],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...darkTooltip, callbacks: { label: ctx => ` ${ctx.parsed.y} customers` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: sharedTick, border: { display: false } },
        y: { grid: sharedGrid, ticks: sharedTick, border: { display: false }, beginAtZero: true }
      }
    }
  });
}

/* ─────────────────────────────────────────
   SLA DOUGHNUT CHART
───────────────────────────────────────── */
function createSLAChart(rows) {
  const met    = rows.filter(r => r.sla_met === 'Yes').length;
  const missed = rows.length - met;

  new Chart(document.getElementById('slaChart'), {
    type: 'doughnut',
    data: {
      labels: ['Met SLA', 'Missed SLA'],
      datasets: [{
        data: [met, missed],
        backgroundColor: ['#0891b2', 'rgba(8,145,178,0.10)'],
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '76%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: { ...darkTooltip, callbacks: { label: ctx => ` ${ctx.parsed} customers` } }
      }
    }
  });

  // Update donut center label
  const pct = (met / rows.length * 100).toFixed(0);
  const valEl = document.querySelector('.donut-value');
  if (valEl) valEl.textContent = pct + '%';
}

/* ─────────────────────────────────────────
   MAIN — LOAD CSV & RENDER
───────────────────────────────────────── */
async function loadData() {
  try {
    const res  = await fetch('data/customer_operations.csv');
    const text = await res.text();
    const rows = parseCSV(text);

    const monthly  = aggregateByMonth(rows);
    const months   = monthly.map(m => m.month);
    const retention= monthly.map(m => m.retention);

    updateKPIs(rows, monthly);
    createRetentionChart(months, retention);
    createRevenueChart(monthly);
    createSLAChart(rows);

  } catch (err) {
    console.error('Failed to load CSV — falling back to static data.', err);

    // Static fallback (works when opening file:// without a server)
    const months    = ['Jan','Feb','Mar','Apr','May','Jun'];
    const retention = [78, 80, 82, 85, 88, 90];

    createRetentionChart(months, retention);

    new Chart(document.getElementById('revenueChart'), {
      type: 'bar',
      data: {
        labels: ['Low Risk','Medium Risk','High Risk'],
        datasets: [{ label: 'Customers', data: [120,60,25],
          backgroundColor: ['rgba(16,185,129,0.78)','rgba(245,158,11,0.78)','rgba(244,63,94,0.78)'],
          borderRadius: 8, borderSkipped: false }]
      },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, border: { display: false } },
                  y: { grid: sharedGrid, border: { display: false }, beginAtZero: true } } }
    });

    new Chart(document.getElementById('slaChart'), {
      type: 'doughnut',
      data: { labels: ['Met SLA','Missed SLA'],
        datasets: [{ data: [92,8], backgroundColor: ['#22c55e','rgba(0,0,0,0.07)'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '76%',
        plugins: { legend: { position: 'bottom' } } }
    });
  }
}

/* ─────────────────────────────────────────
   CARD ENTRANCE ANIMATION
───────────────────────────────────────── */
const animStyle = document.createElement('style');
animStyle.textContent = '.visible { opacity: 1 !important; transform: translateY(0) !important; }';
document.head.appendChild(animStyle);

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.kpi-card, .chart-card').forEach((el, i) => {
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(14px)';
  el.style.transition = `opacity 0.45s ease ${i * 55}ms, transform 0.45s ease ${i * 55}ms`;
  observer.observe(el);
});

loadData();

/* ─────────────────────────────────────────
   EXPORT BUTTON — downloads KPI CSV
───────────────────────────────────────── */
document.getElementById('export-btn').addEventListener('click', () => {
  // Collect current KPI values from DOM
  const retVal  = document.getElementById('ret-num')?.textContent  || '—';
  const hrVal   = document.getElementById('hr-num')?.textContent   || '—';
  const slaVal  = document.getElementById('sla-num')?.textContent  || '—';
  const autoVal = document.getElementById('auto-num')?.textContent || '—';

  const rows = [
    ['KPI', 'Value', 'Period'],
    ['Retention Rate (%)', retVal,  'Jan–Jun 2025'],
    ['High-Risk Customers (accounts)', hrVal,  'Jan–Jun 2025'],
    ['SLA Compliance (%)', slaVal, 'Jan–Jun 2025'],
    ['Reporting Efficiency Gain (%)', autoVal, 'Jan–Jun 2025'],
  ];

  const csv     = rows.map(r => r.join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = 'customer_ops_kpi_summary.csv';
  a.click();
  URL.revokeObjectURL(url);
});