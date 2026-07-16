document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const user = session.user;
  let userSettings = { currency: 'INR', unit_system: 'metric' };

  const historyTableBody = document.getElementById('history-table-body');
  const alertContainer = document.getElementById('alert-container');

  const showAlert = (message, type = 'danger') => {
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    setTimeout(() => { alertContainer.innerHTML = ''; }, 5000);
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

  const formatCurrency = (val) => {
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    return `${sym}${parseFloat(val).toFixed(2)}`;
  };

  window.deleteEntry = async (id) => {
    if (!confirm('Are you sure you want to delete this fuel entry?')) return;
    
    try {
      const { error } = await supabaseClient
        .from('fuel_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      showAlert('Entry deleted successfully.', 'success');
      fetchEntries(); // refresh
    } catch (err) {
      showAlert(err.message);
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
      historyTableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Failed to load entries.</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No fuel entries found. Add one on the Dashboard!</td></tr>`;
      return;
    }

    let html = '';
    data.forEach(entry => {
      const dateStr = new Date(entry.entry_date).toLocaleDateString();
      const station = entry.station_name || '-';
      const notes = entry.notes || '-';
      
      html += `
        <tr>
          <td>${dateStr}</td>
          <td>${parseFloat(entry.odometer_km).toLocaleString()}</td>
          <td>${parseFloat(entry.litres).toFixed(2)}</td>
          <td>${formatCurrency(entry.price_per_litre)}</td>
          <td>${formatCurrency(entry.total_cost)}</td>
          <td>${station}</td>
          <td class="text-truncate" style="max-width: 150px;" title="${notes}">${notes}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-danger" onclick="deleteEntry('${entry.id}')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
    
    historyTableBody.innerHTML = html;
  };

  await fetchSettings();
  fetchEntries();
});
