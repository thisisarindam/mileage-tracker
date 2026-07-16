document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return; // Handled by inline script in dashboard.html

  const user = session.user;
  let userSettings = { currency: 'INR', unit_system: 'metric' };

  // Elements
  const entriesTableBody = document.getElementById('entries-table-body');
  const addEntryForm = document.getElementById('add-entry-form');
  const addEntryModalEl = document.getElementById('addEntryModal');
  const addEntryModal = new bootstrap.Modal(addEntryModalEl);
  const saveEntryBtn = document.getElementById('save-entry-btn');
  const modalAlertContainer = document.getElementById('modal-alert-container');
  let dashboardCostChart = null;

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
      entriesTableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Failed to load entries.</td></tr>`;
      return;
    }

    renderEntriesTable(data);
    updateQuickStats(data);
    renderDashboardChart(data);
  };

  const renderDashboardChart = (entries) => {
    if (dashboardCostChart) {
      dashboardCostChart.destroy();
    }

    if (!entries || entries.length === 0) return;

    // Sort entries oldest to newest
    const sortedEntries = [...entries].sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));

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
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    
    Chart.defaults.color = '#adb5bd'; // bootstrap dark theme text muted
    const costCtx = document.getElementById('dashboardCostChart').getContext('2d');
    
    dashboardCostChart = new Chart(costCtx, {
      type: 'bar',
      data: {
        labels: costLabels,
        datasets: [{
          label: `Total Cost (${sym})`,
          data: costData,
          backgroundColor: '#198754',
          borderWidth: 1
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  };

  const formatCurrency = (val) => {
    // Basic formatting based on settings
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    return `${sym}${parseFloat(val).toFixed(2)}`;
  };

  const renderEntriesTable = (entries) => {
    if (!entries || entries.length === 0) {
      entriesTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No fuel entries found. Add one above!</td></tr>`;
      return;
    }

    let html = '';
    const displayLimit = 10; // Only show 10 on dashboard
    
    entries.slice(0, displayLimit).forEach(entry => {
      const dateObj = new Date(entry.entry_date);
      const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const station = entry.station_name || '-';
      
      const distUnit = userSettings.unit_system === 'imperial' ? 'mi' : 'km';
      const volUnit = userSettings.unit_system === 'imperial' ? 'gal' : 'L';
      
      html += `
        <tr>
          <td>${dateStr}</td>
          <td>${parseFloat(entry.odometer_km).toLocaleString()} ${distUnit}</td>
          <td>${parseFloat(entry.litres).toFixed(2)} ${volUnit}</td>
          <td>${formatCurrency(entry.price_per_litre)}</td>
          <td>${formatCurrency(entry.total_cost)}</td>
          <td>${station}</td>
        </tr>
      `;
    });
    
    entriesTableBody.innerHTML = html;
  };

  const updateQuickStats = (entries) => {
    let totalSpent = 0;
    
    if (!entries || entries.length === 0) {
      document.getElementById('stat-total-spent').innerText = formatCurrency(0);
      document.getElementById('stat-total-distance').innerText = `0 ${userSettings.unit_system === 'imperial' ? 'mi' : 'km'}`;
      document.getElementById('stat-avg-efficiency').innerText = '--';
      return;
    }

    entries.forEach(e => {
      totalSpent += parseFloat(e.total_cost);
    });
    
    document.getElementById('stat-total-spent').innerText = formatCurrency(totalSpent);

    if (entries.length < 2) {
      document.getElementById('stat-total-distance').innerText = `0 ${userSettings.unit_system === 'imperial' ? 'mi' : 'km'}`;
      document.getElementById('stat-avg-efficiency').innerText = '--';
      return;
    }

    // Sort entries by odometer ascending
    const sorted = [...entries].sort((a, b) => parseFloat(a.odometer_km) - parseFloat(b.odometer_km));
    
    const minOdo = parseFloat(sorted[0].odometer_km);
    const maxOdo = parseFloat(sorted[sorted.length - 1].odometer_km);
    const totalDistance = maxOdo - minOdo;

    // Fuel consumed is sum of all fill-ups EXCEPT the first one (baseline)
    let totalLitres = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalLitres += parseFloat(sorted[i].litres);
    }

    document.getElementById('stat-total-distance').innerText = `${totalDistance.toLocaleString()} ${userSettings.unit_system === 'imperial' ? 'mi' : 'km'}`;
    
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

  // Initialize
  await fetchSettings();
  fetchEntries();
});
