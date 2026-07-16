document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const user = session.user;
  let userSettings = { currency: 'INR', unit_system: 'metric' };
  let allEntries = []; // Cache for editing

  const historyTableBody = document.getElementById('history-table-body');
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
      historyTableBody.innerHTML = `<tr><td colspan="8" class="text-danger text-center">Failed to load entries.</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No fuel entries found. Add one on the Dashboard!</td></tr>`;
      allEntries = [];
      return;
    }

    allEntries = data;

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
            <button class="btn btn-sm btn-outline-primary me-1" onclick="editEntry('${entry.id}')" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
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
