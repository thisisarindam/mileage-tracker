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
  };

  const renderCharts = (entries) => {
    if (!entries || entries.length < 2) {
      showAlert('Not enough data to display analytics. Please add at least 2 fuel entries.', 'info');
      return;
    }

    // Sort entries oldest to newest for charts
    const sortedEntries = [...entries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));

    // Calculate Efficiency Over Time
    const efficiencyLabels = [];
    const efficiencyData = [];
    
    for (let i = 1; i < sortedEntries.length; i++) {
      const prev = sortedEntries[i-1];
      const curr = sortedEntries[i];
      
      const distance = parseFloat(curr.odometer_km) - parseFloat(prev.odometer_km);
      const litres = parseFloat(curr.litres);
      
      if (distance > 0 && litres > 0) {
        let efficiency;
        if (userSettings.unit_system === 'imperial') {
          efficiency = distance / (litres * 0.264172); // miles per gallon approx
        } else {
          efficiency = distance / litres; // km per litre
        }
        
        efficiencyLabels.push(new Date(curr.entry_date).toLocaleDateString());
        efficiencyData.push(efficiency.toFixed(2));
      }
    }

    // Cost Per Month
    const costByMonth = {};
    sortedEntries.forEach(entry => {
      const date = new Date(entry.entry_date);
      const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      if (!costByMonth[monthYear]) costByMonth[monthYear] = 0;
      costByMonth[monthYear] += parseFloat(entry.total_cost);
    });

    const costLabels = Object.keys(costByMonth);
    const costData = Object.values(costByMonth);

    // Chart Options
    Chart.defaults.color = '#6c757d'; 
    Chart.defaults.font.family = 'Outfit, sans-serif';

    // Render Efficiency Chart
    const effCtx = document.getElementById('efficiencyChart').getContext('2d');
    new Chart(effCtx, {
      type: 'line',
      data: {
        labels: efficiencyLabels,
        datasets: [{
          label: userSettings.unit_system === 'imperial' ? 'MPG' : 'km/l',
          data: efficiencyData,
          borderColor: '#28a745',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointBackgroundColor: '#1a1a1a',
          pointBorderColor: '#28a745',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3
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
            grid: { display: false } 
          },
          y: { 
            border: { display: false },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { maxTicksLimit: 6 }
          }
        }
      }
    });

    // Render Cost Chart
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    const costCtx = document.getElementById('costChart').getContext('2d');
    new Chart(costCtx, {
      type: 'bar',
      data: {
        labels: costLabels,
        datasets: [{
          label: `Total Cost (${sym})`,
          data: costData,
          backgroundColor: '#0d6efd',
          borderRadius: 4,
          borderWidth: 0
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
            grid: { display: false } 
          },
          y: { 
            border: { display: false },
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { maxTicksLimit: 6 }
          }
        }
      }
    });
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
    
    renderCharts(data);
  };

  await fetchSettings();
  fetchEntries();
});
