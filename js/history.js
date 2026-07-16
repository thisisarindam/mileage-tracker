document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const user = session.user;
  let userSettings = { currency: 'INR', unit_system: 'metric' };
  let allEntries = []; // Cache for editing

  const historyLogsContainer = document.getElementById('history-logs-container');
  const alertContainer = document.getElementById('alert-container');
  const modalAlertContainer = document.getElementById('modal-alert-container');

  // Edit Modal Elements
  const editEntryModalEl = document.getElementById('editEntryModal');
  const editEntryModal = new bootstrap.Modal(editEntryModalEl);
  const editEntryForm = document.getElementById('edit-entry-form');
  const updateEntryBtn = document.getElementById('update-entry-btn');

  // Edit Input Elements
  const editIdInput = document.getElementById('edit_entry_id');
  const editDateInput = document.getElementById('edit_entry_date');
  const editOdoInput = document.getElementById('edit_odometer_km');
  const editLitresInput = document.getElementById('edit_litres');
  const editPriceInput = document.getElementById('edit_price_per_litre');
  const editTotalInput = document.getElementById('edit_total_cost');
  const editStationInput = document.getElementById('edit_station_name');
  const editNotesInput = document.getElementById('edit_notes');

  // Auto-calculate total cost for edit form
  const calculateEditTotalCost = () => {
    const litres = parseFloat(editLitresInput.value) || 0;
    const price = parseFloat(editPriceInput.value) || 0;
    editTotalInput.value = (litres * price).toFixed(2);
  };
  editLitresInput.addEventListener('input', calculateEditTotalCost);
  editPriceInput.addEventListener('input', calculateEditTotalCost);

  const showAlert = (message, type = 'danger') => {
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    setTimeout(() => { alertContainer.innerHTML = ''; }, 5000);
  };

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

  window.editEntry = (id) => {
    const entry = allEntries.find(e => e.id === id);
    if (!entry) return;

    modalAlertContainer.innerHTML = '';
    
    // Populate form
    editIdInput.value = entry.id;
    editDateInput.value = entry.entry_date;
    editOdoInput.value = entry.odometer_km;
    editLitresInput.value = entry.litres;
    editPriceInput.value = entry.price_per_litre;
    editTotalInput.value = entry.total_cost;
    editStationInput.value = entry.station_name || '';
    editNotesInput.value = entry.notes || '';

    // Open modal
    editEntryModal.show();
  };

  // Handle Edit Form Submission
  editEntryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalAlertContainer.innerHTML = '';
    updateEntryBtn.disabled = true;

    const id = editIdInput.value;
    const updatedEntry = {
      entry_date: editDateInput.value,
      odometer_km: parseFloat(editOdoInput.value),
      litres: parseFloat(editLitresInput.value),
      price_per_litre: parseFloat(editPriceInput.value),
      total_cost: parseFloat(editTotalInput.value),
      station_name: editStationInput.value.trim() || null,
      notes: editNotesInput.value.trim() || null,
    };

    try {
      const { error } = await supabaseClient
        .from('fuel_entries')
        .update(updatedEntry)
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      editEntryModal.hide();
      showAlert('Entry updated successfully.', 'success');
      fetchEntries(); // refresh
    } catch (err) {
      showModalAlert(err.message);
    } finally {
      updateEntryBtn.disabled = false;
    }
  });

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
      historyLogsContainer.innerHTML = `<div class="text-danger text-center py-4">Failed to load entries.</div>`;
      return;
    }

    if (!data || data.length === 0) {
      historyLogsContainer.innerHTML = `<div class="text-center py-4 text-muted">No fuel entries found. Add one on the Dashboard!</div>`;
      allEntries = [];
      return;
    }

    allEntries = data;

    const sorted = [...data].sort((a, b) => parseFloat(b.odometer_km) - parseFloat(a.odometer_km));
    
    let html = '';
    sorted.forEach((entry, index) => {
      const dateObj = new Date(entry.entry_date);
      const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const station = entry.station_name || 'Unknown';
      const initial = station.charAt(0).toUpperCase();
      const notes = entry.notes ? `<div class="text-muted small mt-1"><i class="bi bi-card-text"></i> ${entry.notes}</div>` : '';
      
      const distUnit = userSettings.unit_system === 'imperial' ? 'mi' : 'km';
      const volUnit = userSettings.unit_system === 'imperial' ? 'gal' : 'L';
      const effSuffix = userSettings.unit_system === 'imperial' ? 'mpg' : 'km/L';
      
      let effBadgeHtml = '';
      if (index + 1 < sorted.length) {
        const prev = sorted[index + 1];
        const dist = parseFloat(entry.odometer_km) - parseFloat(prev.odometer_km);
        const litres = parseFloat(entry.litres);
        if (dist > 0 && litres > 0) {
          let eff = dist / litres;
          if (userSettings.unit_system === 'imperial') eff = dist / (litres * 0.264172);
          
          effBadgeHtml = `
            <div class="bg-success text-white rounded p-2 text-center ms-3" style="min-width: 60px;">
              <div class="fw-bold lh-1">${eff.toFixed(1)}</div>
              <div style="font-size: 0.65rem;" class="opacity-75 mt-1">${effSuffix}</div>
            </div>
          `;
        }
      }
      
      html += `
        <div class="card app-card mb-3 border-0">
          <div class="card-body p-3">
            <div class="d-flex align-items-center mb-2">
              <div class="bg-primary bg-opacity-10 text-primary rounded d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px;">
                <i class="bi bi-fuel-pump-fill fs-4"></i>
              </div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-baseline mb-1">
                  <span class="fw-bold fs-5 me-2">${formatCurrency(entry.total_cost)}</span>
                  <span class="text-muted small">${station}</span>
                </div>
                <div class="text-muted small">
                  <i class="bi bi-calendar3 me-1"></i> ${dateStr} &bull; ${parseFloat(entry.odometer_km).toLocaleString()}${distUnit}
                </div>
              </div>
              ${effBadgeHtml}
            </div>
            ${notes}
            <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-secondary border-opacity-25">
              <div class="small text-muted">
                ${parseFloat(entry.litres).toFixed(2)}${volUnit} @ ${formatCurrency(entry.price_per_litre)}/${volUnit}
              </div>
              <div>
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 me-1" onclick="editEntry('${entry.id}')" title="Edit">
                  <i class="bi bi-pencil" style="font-size: 0.8rem;"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1" onclick="deleteEntry('${entry.id}')" title="Delete">
                  <i class="bi bi-trash" style="font-size: 0.8rem;"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    historyLogsContainer.innerHTML = html;
  };

  await fetchSettings();
  fetchEntries();
});
