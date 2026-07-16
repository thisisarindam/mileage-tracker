document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return; // Handled by inline script in dashboard.html

  const user = session.user;
  let userSettings = { currency: 'INR', unit_system: 'metric' };

  // Elements
  const recentLogsContainer = document.getElementById('recent-logs-container');
  const addEntryForm = document.getElementById('add-entry-form');
  const addEntryModalEl = document.getElementById('addEntryModal');
  const addEntryModal = new bootstrap.Modal(addEntryModalEl);
  const saveEntryBtn = document.getElementById('save-entry-btn');
  const modalAlertContainer = document.getElementById('modal-alert-container');
  let priceChart = null;
  let runningCostChart = null;
  let efficiencyChart = null;

  // Input Elements
  const entryDateInput = document.getElementById('entry_date');
  const odometerInput = document.getElementById('odometer_km');
  const litresInput = document.getElementById('litres');
  const priceInput = document.getElementById('price_per_litre');
  const totalCostInput = document.getElementById('total_cost');

  // Set default date to today
  entryDateInput.valueAsDate = new Date();

  // Auto-calculate total cost
  const calculateTotalCost = () => {
    const litres = parseFloat(litresInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    totalCostInput.value = (litres * price).toFixed(2);
  };
  litresInput.addEventListener('input', calculateTotalCost);
  priceInput.addEventListener('input', calculateTotalCost);

  const showModalAlert = (message, type = 'danger') => {
    modalAlertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show py-2" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  };

  // Fetch User Settings
  const fetchSettings = async () => {
    const { data, error } = await supabaseClient
      .from('user_settings')
      .select('currency, unit_system')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      userSettings = data;
    } else if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
    }
  };

  // Fetch and display entries
  const fetchEntries = async () => {
    const { data, error } = await supabaseClient
      .from('fuel_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .order('odometer_km', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      recentLogsContainer.innerHTML = `<div class="text-danger text-center py-4">Failed to load logs.</div>`;
      return;
    }

    renderRecentLogs(data);
    updateQuickStats(data);
    renderAnalyticsCarousel(data);
  };

  const createLineChart = (canvasId, label, labels, data, chartInstance) => {
    if (chartInstance) chartInstance.destroy();
    
    Chart.defaults.color = '#6c757d'; 
    Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';

    // Calculate Average for the dashed line
    const avg = data.reduce((a, b) => a + b, 0) / data.length || 0;
    const avgData = new Array(data.length).fill(avg);

    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            data: data,
            borderColor: '#e9ecef', // light line
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointBackgroundColor: '#1a1a1a', // hollow dots effect
            pointBorderColor: '#e9ecef',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3
          },
          {
            label: 'Average',
            data: avgData,
            borderColor: '#6c757d', // dashed average line
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (context) => `${context.parsed.y.toFixed(1)}`
            }
          }
        },
        scales: {
          x: { display: false }, // Hide x axis completely like in screenshots
          y: { 
            border: { display: false },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { maxTicksLimit: 5 }
          }
        }
      }
    });
  };

  const renderAnalyticsCarousel = (entries) => {
    if (!entries || entries.length < 2) return;

    const sorted = [...entries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    const distUnit = userSettings.unit_system === 'imperial' ? 'mi' : 'km';
    const volUnit = userSettings.unit_system === 'imperial' ? 'gal' : 'L';

    // --- Price Trend ---
    const priceLabels = sorted.map(e => e.entry_date);
    const priceData = sorted.map(e => parseFloat(e.price_per_litre));
    
    priceChart = createLineChart('priceTrendChart', 'Price', priceLabels, priceData, priceChart);
    
    const minPrice = Math.min(...priceData);
    const maxPrice = Math.max(...priceData);
    const avgPrice = priceData.reduce((a, b) => a + b, 0) / priceData.length;
    
    document.getElementById('price-lowest').innerText = `${sym}${minPrice.toFixed(1)}`;
    document.getElementById('price-highest').innerText = `${sym}${maxPrice.toFixed(1)}`;
    document.getElementById('price-average').innerText = `${sym}${avgPrice.toFixed(1)}`;
    document.getElementById('price-avg-badge').innerText = `Avg: ${sym}${avgPrice.toFixed(1)}`;

    // --- Running Cost & Efficiency ---
    const runCostLabels = [];
    const runCostData = [];
    const effLabels = [];
    const effData = [];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
      const curr = sorted[i];
      const dist = parseFloat(curr.odometer_km) - parseFloat(prev.odometer_km);
      const litres = parseFloat(curr.litres);
      const cost = parseFloat(curr.total_cost);

      if (dist > 0 && litres > 0) {
        // Running Cost: Total cost / distance
        const runCost = cost / dist;
        runCostLabels.push(curr.entry_date);
        runCostData.push(runCost);

        // Efficiency: Distance / Litres (or miles per gallon)
        let eff = dist / litres;
        if (userSettings.unit_system === 'imperial') {
           eff = dist / (litres * 0.264172); // rough gal
        }
        effLabels.push(curr.entry_date);
        effData.push(eff);
      }
    }

    if (runCostData.length > 0) {
      runningCostChart = createLineChart('runningCostChart', 'Running Cost', runCostLabels, runCostData, runningCostChart);
      
      const minRC = Math.min(...runCostData);
      const maxRC = Math.max(...runCostData);
      const avgRC = runCostData.reduce((a, b) => a + b, 0) / runCostData.length;
      
      document.getElementById('running-cost-lowest').innerText = `${sym}${minRC.toFixed(1)}/${distUnit}`;
      document.getElementById('running-cost-highest').innerText = `${sym}${maxRC.toFixed(1)}/${distUnit}`;
      document.getElementById('running-cost-average').innerText = `${sym}${avgRC.toFixed(1)}/${distUnit}`;
      document.getElementById('running-cost-avg-badge').innerText = `Avg: ${sym}${avgRC.toFixed(1)}/${distUnit}`;
    }

    if (effData.length > 0) {
      efficiencyChart = createLineChart('efficiencyChart', 'Efficiency', effLabels, effData, efficiencyChart);
      // Change eff chart line color to green to match screenshot
      efficiencyChart.data.datasets[0].borderColor = '#28a745';
      efficiencyChart.data.datasets[0].pointBorderColor = '#28a745';
      efficiencyChart.update();

      const minEff = Math.min(...effData);
      const maxEff = Math.max(...effData);
      const avgEff = effData.reduce((a, b) => a + b, 0) / effData.length;
      const effSuffix = userSettings.unit_system === 'imperial' ? 'mpg' : 'km/L';
      
      document.getElementById('efficiency-lowest').innerText = `${minEff.toFixed(1)} ${effSuffix}`;
      document.getElementById('efficiency-highest').innerText = `${maxEff.toFixed(1)} ${effSuffix}`;
      document.getElementById('efficiency-average').innerText = `${avgEff.toFixed(1)} ${effSuffix}`;
      document.getElementById('efficiency-avg-badge').innerText = `Avg: ${avgEff.toFixed(1)} ${effSuffix}`;
    }
  };

  const renderRecentLogs = (entries) => {
    if (!entries || entries.length === 0) {
      recentLogsContainer.innerHTML = `<div class="text-center py-4 text-muted">No fuel entries found. Add one above!</div>`;
      return;
    }

    let html = '';
    const displayLimit = 10;
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    const effSuffix = userSettings.unit_system === 'imperial' ? 'mpg' : 'km/L';
    
    const sorted = [...entries].sort((a, b) => parseFloat(b.odometer_km) - parseFloat(a.odometer_km));
    const recent = sorted.slice(0, displayLimit);

    recent.forEach((entry, index) => {
      const dateObj = new Date(entry.entry_date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const station = entry.station_name || 'Unknown';
      const initial = station.charAt(0).toUpperCase();

      // Calculate efficiency for this specific run if there is a previous entry chronologically
      let effBadgeHtml = '';
      if (index + 1 < sorted.length) {
        const prev = sorted[index + 1];
        const dist = parseFloat(entry.odometer_km) - parseFloat(prev.odometer_km);
        const litres = parseFloat(entry.litres);
        if (dist > 0 && litres > 0) {
          let eff = dist / litres;
          if (userSettings.unit_system === 'imperial') eff = dist / (litres * 0.264172);
          
          effBadgeHtml = `
            <div class="bg-success text-white rounded p-2 text-center" style="min-width: 60px;">
              <div class="fw-bold lh-1">${eff.toFixed(1)}</div>
              <div style="font-size: 0.65rem;" class="opacity-75 mt-1">${effSuffix}</div>
            </div>
          `;
        }
      }

      html += `
        <div class="card app-card mb-3 border-0">
          <div class="card-body p-3 d-flex align-items-center">
            <div class="bg-primary bg-opacity-10 text-primary rounded d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px;">
              <i class="bi bi-fuel-pump-fill fs-4"></i>
            </div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-baseline mb-1">
                  <span class="fw-bold fs-5 me-2">${sym}${Math.round(entry.total_cost)}</span>
                  <span class="text-muted small">${station}</span>
                </div>
                <div class="text-muted small">
                  <i class="bi bi-calendar3 me-1"></i> ${dateStr}
                </div>
              </div>
            ${effBadgeHtml}
          </div>
        </div>
      `;
    });
    
    recentLogsContainer.innerHTML = html;
  };

  const formatCurrency = (val) => {
    // Basic formatting based on settings
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    return `${sym}${parseFloat(val).toFixed(2)}`;
  };

  const updateQuickStats = (entries) => {
    if (!entries || entries.length === 0) {
      document.getElementById('stat-monthly-spent').innerText = formatCurrency(0);
      document.getElementById('stat-monthly-distance').innerText = `0 ${userSettings.unit_system === 'imperial' ? 'mi' : 'km'}`;
      document.getElementById('stat-avg-efficiency').innerText = '--';
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Sort entries by odometer ascending to calculate distances
    const sorted = [...entries].sort((a, b) => parseFloat(a.odometer_km) - parseFloat(b.odometer_km));
    
    let monthlySpent = 0;

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const entryDate = new Date(entry.entry_date);
      
      if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
        monthlySpent += parseFloat(entry.total_cost);
      }
    }

    document.getElementById('stat-monthly-spent').innerText = formatCurrency(monthlySpent);
    
    // Average Monthly Distance (Lifetime calculation)
    if (sorted.length < 2) {
      document.getElementById('stat-monthly-distance').innerText = `0 ${userSettings.unit_system === 'imperial' ? 'mi' : 'km'}`;
    } else {
      const firstEntryDate = new Date(sorted[0].entry_date);
      const lastEntryDate = new Date(sorted[sorted.length - 1].entry_date);
      
      let monthsSpan = (lastEntryDate.getFullYear() - firstEntryDate.getFullYear()) * 12;
      monthsSpan += (lastEntryDate.getMonth() - firstEntryDate.getMonth());
      monthsSpan = Math.max(1, monthsSpan + 1); // at least 1 month
      
      const minOdoDist = parseFloat(sorted[0].odometer_km);
      const maxOdoDist = parseFloat(sorted[sorted.length - 1].odometer_km);
      const totalDistanceDist = maxOdoDist - minOdoDist;
      const avgMonthlyDistance = totalDistanceDist / monthsSpan;
      
      document.getElementById('stat-monthly-distance').innerText = `${Math.round(avgMonthlyDistance).toLocaleString()} ${userSettings.unit_system === 'imperial' ? 'mi' : 'km'}`;
    }

    // Average Efficiency (Lifetime)
    if (entries.length < 2) {
      document.getElementById('stat-avg-efficiency').innerText = '--';
      return;
    }

    const minOdo = parseFloat(sorted[0].odometer_km);
    const maxOdo = parseFloat(sorted[sorted.length - 1].odometer_km);
    const totalDistance = maxOdo - minOdo;

    let totalLitres = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalLitres += parseFloat(sorted[i].litres);
    }

    if (totalDistance > 0 && totalLitres > 0) {
      if (userSettings.unit_system === 'imperial') {
        const mpg = totalDistance / (totalLitres * 0.264172); // rough conversion
        document.getElementById('stat-avg-efficiency').innerText = `${mpg.toFixed(1)} mpg`;
      } else {
        const kmpl = totalDistance / totalLitres;
        document.getElementById('stat-avg-efficiency').innerText = `${kmpl.toFixed(1)} km/l`;
      }
    } else {
      document.getElementById('stat-avg-efficiency').innerText = '--';
    }
  };

  // Handle form submit
  addEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalAlertContainer.innerHTML = '';
    saveEntryBtn.disabled = true;

    const newEntry = {
      user_id: user.id,
      entry_date: entryDateInput.value,
      odometer_km: parseFloat(odometerInput.value),
      litres: parseFloat(litresInput.value),
      price_per_litre: parseFloat(priceInput.value),
      total_cost: parseFloat(totalCostInput.value),
      station_name: document.getElementById('station_name').value.trim() || null,
      notes: document.getElementById('notes').value.trim() || null,
    };

    try {
      const { data, error } = await supabaseClient
        .from('fuel_entries')
        .insert([newEntry]);
      
      if (error) throw error;
      
      // Reset form and close modal
      addEntryForm.reset();
      entryDateInput.valueAsDate = new Date();
      addEntryModal.hide();
      
      // Refresh table
      fetchEntries();
    } catch (error) {
      showModalAlert(error.message);
    } finally {
      saveEntryBtn.disabled = false;
    }
  });

  // Handle carousel slide to resize Chart.js charts
  const analyticsCarouselEl = document.getElementById('analyticsCarousel');
  if (analyticsCarouselEl) {
    analyticsCarouselEl.addEventListener('slid.bs.carousel', () => {
      if (priceChart) priceChart.resize();
      if (runningCostChart) runningCostChart.resize();
      if (efficiencyChart) efficiencyChart.resize();
    });
  }

  // Initialize
  await fetchSettings();
  fetchEntries();
});
