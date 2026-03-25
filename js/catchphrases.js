// js/catchphrases.js
// Requires Chart.js loaded globally from CDN

export function initCatchphrases(stats) {
  const { catchphrases } = stats;
  const el = document.getElementById('catchphrases');

  const sorted = [...catchphrases].sort((a, b) => b.total - a.total);

  el.innerHTML = `
    <h2>Catchphrases &amp; Keywords</h2>
    <p class="subtitle">How often iconic words appear across 7 seasons</p>
    <div class="chart-wrap" style="height:${Math.max(200, sorted.length * 44)}px">
      <canvas id="catchphrases-canvas"></canvas>
    </div>
  `;

  new Chart(document.getElementById('catchphrases-canvas'), {
    type: 'bar',
    data: {
      labels: sorted.map(p => `${p.label}  (${p.total})`),
      datasets: [{
        data: sorted.map(p => p.total),
        backgroundColor: '#C8860A',
        borderRadius: 2,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const phrase = sorted[ctx.dataIndex];
              // Top 3 speakers (sorted alphabetically for tie-breaking)
              const top3 = Object.entries(phrase.by_character)
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .slice(0, 3)
                .map(([name, count]) => `${name}: ${count}`)
                .join(' · ');
              return top3 || `Total: ${phrase.total}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#3D3D55', font: { size: 13 } },
          grid: { color: '#2A2A38' },
        },
        y: {
          ticks: { color: '#B8B0A8', font: { size: 13 } },
          grid: { display: false },
        }
      }
    }
  });
}
