document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const user = session.user;
  let userSettings = { currency: 'INR', unit_system: 'metric' };
  const alertContainer = document.getElementById('alert-container');

  const showAlert = (message, type = 'danger') => {
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  };

  const fetchSettings = async () => {
    const { data, error } = await supabaseClient
      .from('user_settings')
      .select('currency, unit_system')
      .eq('user_id', user.id)
      .single();
    if (data) userSettings = data;
    
    // Update currency icons globally
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    document.querySelectorAll('.currency-icon').forEach(el => {
      el.className = 'currency-icon'; // reset
      if (sym === '₹') el.classList.add('bi', 'bi-currency-rupee');
      else if (sym === '$') el.classList.add('bi', 'bi-currency-dollar');
      else if (sym === '€') el.classList.add('bi', 'bi-currency-euro');
      else if (sym === '£') el.classList.add('bi', 'bi-currency-pound');
      else { el.classList.add('bi', 'bi-cash'); }
    });
  };

  const formatCurrency = (val) => {
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    return `${sym}${Math.round(val)}`;
  };
  
  const formatMileage = (val) => {
    const unit = userSettings.unit_system === 'imperial' ? 'mpg' : 'km/l';
    return `${val.toFixed(1)} ${unit}`;
  };

  const formatDistance = (val) => {
    const unit = userSettings.unit_system === 'imperial' ? 'mi' : 'km';
    return `${Math.round(val)} ${unit}`;
  };

  const calculateStats = (entries) => {
    if (entries.length === 0) return { spent: 0, distance: 0, mileage: 0, fillups: 0, litres: 0 };
    
    let spent = 0;
    let litres = 0;
    let fillups = entries.length;

    entries.forEach(e => {
      spent += parseFloat(e.total_cost) || 0;
      litres += parseFloat(e.litres) || 0;
    });

    // Calculate distance
    const sorted = [...entries].sort((a, b) => parseFloat(a.odometer_km) - parseFloat(b.odometer_km));
    const distance = sorted.length > 1 ? parseFloat(sorted[sorted.length-1].odometer_km) - parseFloat(sorted[0].odometer_km) : 0;
    
    // Calculate mileage
    let mileage = 0;
    if (distance > 0 && litres > 0) {
      if (userSettings.unit_system === 'imperial') {
        mileage = distance / (litres * 0.264172);
      } else {
        mileage = distance / litres;
      }
    }

    return { spent, distance, mileage, fillups, litres };
  };

  const renderDashboard = (entries) => {
    if (!entries || entries.length === 0) {
      showAlert('Not enough data to display analytics. Please add fuel entries.', 'info');
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    const currentMonthEntries = entries.filter(e => {
      const d = new Date(e.entry_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const prevMonthEntries = entries.filter(e => {
      const d = new Date(e.entry_date);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    const cmStats = calculateStats(currentMonthEntries);
    const pmStats = calculateStats(prevMonthEntries);
    const allTimeStats = calculateStats(entries);
    
    // This Month
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    document.getElementById('current-month-badge').innerText = `${monthNames[currentMonth]}, ${currentYear}`;
    document.getElementById('tm-spent').innerText = formatCurrency(cmStats.spent);
    document.getElementById('tm-traveled').innerText = formatDistance(cmStats.distance);
    document.getElementById('tm-mileage').innerText = formatMileage(cmStats.mileage);
    document.getElementById('tm-fillups').innerText = cmStats.fillups;

    // Savings
    const diff = pmStats.spent - cmStats.spent;
    let percent = pmStats.spent > 0 ? (diff / pmStats.spent) * 100 : 0;
    
    const savingsTitle = document.getElementById('savings-title');
    const savingsSubtitle = document.getElementById('savings-subtitle');
    const savingsIcon = document.getElementById('savings-icon');
    
    if (diff > 0) {
      savingsTitle.innerText = "Great Savings!";
      savingsSubtitle.innerText = `Saved ${formatCurrency(diff)} (${Math.round(percent)}% less) compared to previous month.`;
      savingsIcon.className = "bi bi-graph-down-arrow fs-5 text-success";
    } else if (diff < 0) {
      savingsTitle.innerText = "Spending Increased";
      savingsSubtitle.innerText = `Spent ${formatCurrency(Math.abs(diff))} (${Math.round(Math.abs(percent))}% more) compared to previous month.`;
      savingsIcon.className = "bi bi-graph-up-arrow fs-5 text-danger";
    } else {
      savingsTitle.innerText = "On Track";
      savingsSubtitle.innerText = `Spending is exactly the same as previous month.`;
      savingsIcon.className = "bi bi-dash fs-5 text-white";
    }

    // Monthly Comparison
    document.getElementById('mc-cm-badge').innerText = `${monthNames[currentMonth]} ${currentYear.toString().slice(-2)}`;
    document.getElementById('mc-cm-spent').innerText = formatCurrency(cmStats.spent);
    document.getElementById('mc-cm-mileage').innerText = formatMileage(cmStats.mileage);
    document.getElementById('mc-cm-distance').innerText = formatDistance(cmStats.distance);
    document.getElementById('mc-cm-fillups').innerText = cmStats.fillups;

    document.getElementById('mc-pm-badge').innerText = `${monthNames[prevMonth]} ${prevYear.toString().slice(-2)}`;
    document.getElementById('mc-pm-spent').innerText = formatCurrency(pmStats.spent);
    document.getElementById('mc-pm-mileage').innerText = formatMileage(pmStats.mileage);
    document.getElementById('mc-pm-distance').innerText = formatDistance(pmStats.distance);
    document.getElementById('mc-pm-fillups').innerText = pmStats.fillups;

    // Year All-Time Overview
    document.getElementById('current-year-text').innerText = currentYear;
    const yearEntries = entries.filter(e => new Date(e.entry_date).getFullYear() === currentYear);
    const yearStats = calculateStats(yearEntries);
    
    document.getElementById('y-total-spend').innerText = formatCurrency(yearStats.spent);
    document.getElementById('y-distance').innerText = formatDistance(yearStats.distance);
    document.getElementById('y-mileage').innerText = formatMileage(yearStats.mileage);
    document.getElementById('y-fillups').innerText = yearStats.fillups;
    document.getElementById('y-avg-cost-fill').innerText = yearStats.fillups > 0 ? formatCurrency(yearStats.spent / yearStats.fillups) : formatCurrency(0);

    // All-Time Overview Detailed
    document.getElementById('at-total-spent').innerText = formatCurrency(allTimeStats.spent);
    document.getElementById('at-total-distance').innerText = formatDistance(allTimeStats.distance);
    document.getElementById('at-total-fillups').innerText = allTimeStats.fillups;
    document.getElementById('at-average-price').innerText = allTimeStats.litres > 0 ? `${formatCurrency(allTimeStats.spent / allTimeStats.litres)}/L` : `${formatCurrency(0)}/L`;
    
    // Most Used Station
    const stationCounts = {};
    let maxStation = 'Unknown';
    let maxCount = 0;
    entries.forEach(e => {
      const s = e.station_name || 'Unknown';
      stationCounts[s] = (stationCounts[s] || 0) + 1;
      if (stationCounts[s] > maxCount && s !== 'Unknown') {
        maxCount = stationCounts[s];
        maxStation = s;
      }
    });
    document.getElementById('at-most-used-station').innerText = maxStation;

    // Brand Efficiency Chart
    renderBrandChart(entries);
  };

  let brandChartInstance = null;
  const renderBrandChart = (entries) => {
    // Group by station and calculate efficiency
    const stationData = {};
    
    // Sort chronological to calculate distance per station
    const sorted = [...entries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i-1];
      const curr = sorted[i];
      const station = curr.station_name || 'Unknown';
      const distance = parseFloat(curr.odometer_km) - parseFloat(prev.odometer_km);
      const litres = parseFloat(curr.litres);
      
      if (distance > 0 && litres > 0 && station !== 'Unknown') {
        if (!stationData[station]) stationData[station] = { dist: 0, lit: 0 };
        stationData[station].dist += distance;
        stationData[station].lit += litres;
      }
    }

    const labels = [];
    const data = [];
    
    Object.keys(stationData).forEach(st => {
      const { dist, lit } = stationData[st];
      let eff = 0;
      if (userSettings.unit_system === 'imperial') {
        eff = dist / (lit * 0.264172);
      } else {
        eff = dist / lit;
      }
      labels.push(st);
      data.push(eff.toFixed(1));
    });

    const ctx = document.getElementById('brandChart').getContext('2d');
    
    if (brandChartInstance) {
      brandChartInstance.destroy();
    }

    Chart.defaults.color = '#6c757d'; 
    Chart.defaults.font.family = 'Outfit, sans-serif';

    brandChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Mileage',
          data: data,
          backgroundColor: '#e5e5e5',
          borderRadius: 4,
          barThickness: 20
        }]
      },
      options: { 
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { 
            grid: { display: false },
            ticks: { color: '#6c757d' }
          },
          y: { 
            border: { display: false },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { display: false } // Hide y-axis ticks to match screenshot
          }
        }
      }
    });

    const unit = userSettings.unit_system === 'imperial' ? 'avg mpg' : 'avg km/L';
    document.getElementById('brand-eff-unit').innerText = unit;
  };

  const fetchEntries = async () => {
    const { data, error } = await supabaseClient
      .from('fuel_entries')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching entries:', error);
      showAlert('Failed to load data for analytics.');
      return;
    }
    
    renderDashboard(data);
  };

  await fetchSettings();
  fetchEntries();
});
