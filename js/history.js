document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const user = session.user;
  let userSettings = { currency: 'INR', unit_system: 'metric' };
  let allEntries = []; 
  let fuelDisplayLimit = 10;
  
  let allMaintenanceLogs = [];

  const historyLogsContainer = document.getElementById('history-logs-container');
  const maintenanceLogsContainer = document.getElementById('maintenance-logs-container');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const loadMoreContainer = document.getElementById('load-more-container');
  const alertContainer = document.getElementById('alert-container');
  const modalAlertContainer = document.getElementById('modal-alert-container');
  const serviceModalAlertContainer = document.getElementById('service-modal-alert-container');

  // Edit Modal Elements
  const editEntryModalEl = document.getElementById('editEntryModal');
  const editEntryModal = new bootstrap.Modal(editEntryModalEl);
  const editEntryForm = document.getElementById('edit-entry-form');
  const updateEntryBtn = document.getElementById('update-entry-btn');

  // Add Service Modal Elements
  const addServiceModalEl = document.getElementById('addServiceModal');
  const addServiceModal = new bootstrap.Modal(addServiceModalEl);
  const addServiceForm = document.getElementById('add-service-form');
  const saveServiceBtn = document.getElementById('save-service-btn');

  // Check URL Params for deep linking
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tab') === 'maintenance') {
    const maintenanceTabBtn = document.getElementById('maintenance-tab');
    if (maintenanceTabBtn) {
      const tab = new bootstrap.Tab(maintenanceTabBtn);
      tab.show();
    }
    if (urlParams.get('action') === 'add') {
      addServiceModal.show();
    }
    // Clean up URL without refreshing
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Load More Button
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      fuelDisplayLimit += 10;
      renderEntries();
    });
  }

  // Edit Fuel Input Elements
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

  const showModalAlert = (message, type = 'danger', container = modalAlertContainer) => {
    container.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show py-2" role="alert">
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
    if (data) {
      userSettings = data;
    }
  };

  const formatCurrency = (val) => {
    const sym = userSettings.currency === 'INR' ? '₹' : (userSettings.currency === 'USD' ? '$' : userSettings.currency);
    return `${sym}${parseFloat(val).toFixed(2)}`;
  };

  // Fuel Logs Logic
  window.deleteEntry = async (id) => {
    if (!confirm('Are you sure you want to delete this fuel entry?')) return;
    try {
      const { error } = await supabaseClient.from('fuel_entries').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      showAlert('Entry deleted successfully.', 'success');
      fetchEntries(); 
    } catch (err) {
      showAlert(err.message);
    }
  };

  window.editEntry = (id) => {
    const entry = allEntries.find(e => e.id === id);
    if (!entry) return;
    modalAlertContainer.innerHTML = '';
    editIdInput.value = entry.id;
    editDateInput.value = entry.entry_date;
    editOdoInput.value = entry.odometer_km;
    editLitresInput.value = entry.litres;
    editPriceInput.value = entry.price_per_litre;
    editTotalInput.value = entry.total_cost;
    editStationInput.value = entry.station_name || '';
    editNotesInput.value = entry.notes || '';
    editEntryModal.show();
  };

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
      const { error } = await supabaseClient.from('fuel_entries').update(updatedEntry).eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      editEntryModal.hide();
      showAlert('Entry updated successfully.', 'success');
      fetchEntries(); 
    } catch (err) {
      showModalAlert(err.message);
    } finally {
      updateEntryBtn.disabled = false;
    }
  });

  const renderLastMonthStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    document.getElementById('lm-month-name').innerText = `${monthNames[prevMonth]} ${prevYear}`;

    const prevMonthEntries = allEntries.filter(e => {
      const d = new Date(e.entry_date);
      return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
    });

    let spent = 0;
    let litres = 0;
    prevMonthEntries.forEach(e => {
      spent += parseFloat(e.total_cost) || 0;
      litres += parseFloat(e.litres) || 0;
    });

    const sorted = [...allEntries].sort((a, b) => parseFloat(a.odometer_km) - parseFloat(b.odometer_km));
    let distance = 0;
    
    if (prevMonthEntries.length > 0) {
      const pmSorted = [...prevMonthEntries].sort((a, b) => parseFloat(a.odometer_km) - parseFloat(b.odometer_km));
      if (pmSorted.length > 1) {
        distance = parseFloat(pmSorted[pmSorted.length - 1].odometer_km) - parseFloat(pmSorted[0].odometer_km);
      } else {
        const minOdo = parseFloat(pmSorted[0].odometer_km);
        const priorEntry = sorted.reverse().find(e => parseFloat(e.odometer_km) < minOdo);
        if (priorEntry) {
          distance = minOdo - parseFloat(priorEntry.odometer_km);
        }
      }
    }

    let efficiency = 0;
    if (distance > 0 && litres > 0) {
      if (userSettings.unit_system === 'imperial') {
        efficiency = distance / (litres * 0.264172);
      } else {
        efficiency = distance / litres;
      }
    }

    const distUnit = userSettings.unit_system === 'imperial' ? 'mi' : 'km';
    const volUnit = userSettings.unit_system === 'imperial' ? 'gal' : 'L';
    const effSuffix = userSettings.unit_system === 'imperial' ? 'mpg' : 'km/L';

    document.getElementById('lm-spent').innerText = formatCurrency(spent);
    document.getElementById('lm-distance').innerText = `${Math.round(distance)}${distUnit}`;
    document.getElementById('lm-litres').innerText = `${litres.toFixed(1)}${volUnit}`;
    document.getElementById('lm-efficiency').innerText = `${efficiency.toFixed(1)} ${effSuffix}`;
  };

  const renderEntries = () => {
    if (!allEntries || allEntries.length === 0) {
      historyLogsContainer.innerHTML = `<div class="text-center py-4 text-muted">No fuel entries found. Add one on the Dashboard!</div>`;
      if (loadMoreContainer) loadMoreContainer.classList.add('d-none');
      return;
    }

    const sorted = [...allEntries].sort((a, b) => parseFloat(b.odometer_km) - parseFloat(a.odometer_km));
    const displayEntries = sorted.slice(0, fuelDisplayLimit);
    
    let html = '';
    displayEntries.forEach((entry, index) => {
      const dateObj = new Date(entry.entry_date);
      const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const station = entry.station_name || 'Unknown';
      const notes = entry.notes ? `<div class="text-muted small mt-1"><i class="bi bi-card-text"></i> ${entry.notes}</div>` : '';
      
      const distUnit = userSettings.unit_system === 'imperial' ? 'mi' : 'km';
      const volUnit = userSettings.unit_system === 'imperial' ? 'gal' : 'L';
      const effSuffix = userSettings.unit_system === 'imperial' ? 'mpg' : 'km/L';
      
      let effBadgeHtml = '';
      const actualIndexInSorted = sorted.findIndex(e => e.id === entry.id);
      if (actualIndexInSorted + 1 < sorted.length) {
        const prev = sorted[actualIndexInSorted + 1];
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

    if (loadMoreContainer) {
      if (sorted.length > fuelDisplayLimit) {
        loadMoreContainer.classList.remove('d-none');
      } else {
        loadMoreContainer.classList.add('d-none');
      }
    }
  };

  const fetchEntries = async () => {
    const { data, error } = await supabaseClient
      .from('fuel_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('odometer_km', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
      historyLogsContainer.innerHTML = `<div class="text-danger text-center py-4">Failed to load entries.</div>`;
      return;
    }

    allEntries = data || [];
    renderLastMonthStats();
    renderEntries();
  };

  // Maintenance Logs Logic
  window.deleteServiceLog = async (id) => {
    if (!confirm('Are you sure you want to delete this service log?')) return;
    try {
      const { error } = await supabaseClient.from('maintenance_logs').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      showAlert('Service log deleted successfully.', 'success');
      fetchMaintenanceLogs(); 
    } catch (err) {
      showAlert(err.message);
    }
  };

  addServiceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    serviceModalAlertContainer.innerHTML = '';
    saveServiceBtn.disabled = true;

    const newLog = {
      user_id: user.id,
      service_date: document.getElementById('service_date').value,
      service_type: document.getElementById('service_type').value.trim(),
      odometer_km: parseFloat(document.getElementById('service_odometer').value),
      total_cost: parseFloat(document.getElementById('service_cost').value),
      notes: document.getElementById('service_notes').value.trim() || null,
    };

    try {
      const { error } = await supabaseClient.from('maintenance_logs').insert([newLog]);
      if (error) {
        if (error.code === '42P01') {
          throw new Error("maintenance_logs table does not exist. Please run the SQL setup script first.");
        }
        throw error;
      }
      
      addServiceModal.hide();
      addServiceForm.reset();
      showAlert('Service log added successfully!', 'success');
      fetchMaintenanceLogs(); 
    } catch (err) {
      showModalAlert(err.message, 'danger', serviceModalAlertContainer);
    } finally {
      saveServiceBtn.disabled = false;
    }
  });

  const renderMaintenanceLogs = () => {
    if (!allMaintenanceLogs || allMaintenanceLogs.length === 0) {
      maintenanceLogsContainer.innerHTML = `<div class="text-center py-4 text-muted">No maintenance logs found.</div>`;
      return;
    }

    const distUnit = userSettings.unit_system === 'imperial' ? 'mi' : 'km';
    let html = '';
    allMaintenanceLogs.forEach((log) => {
      const dateObj = new Date(log.service_date);
      const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const notes = log.notes ? `<div class="text-muted small mt-2"><i class="bi bi-card-text"></i> ${log.notes}</div>` : '';
      
      html += `
        <div class="card app-card mb-3 border-0">
          <div class="card-body p-3">
            <div class="d-flex align-items-center mb-2">
              <div class="bg-warning bg-opacity-10 text-warning rounded d-flex align-items-center justify-content-center me-3" style="width: 50px; height: 50px;">
                <i class="bi bi-tools fs-4"></i>
              </div>
              <div class="flex-grow-1">
                <div class="d-flex align-items-baseline mb-1">
                  <span class="fw-bold fs-5 me-2">${formatCurrency(log.total_cost)}</span>
                  <span class="text-muted small fw-medium text-uppercase">${log.service_type}</span>
                </div>
                <div class="text-muted small">
                  <i class="bi bi-calendar3 me-1"></i> ${dateStr} &bull; ${parseFloat(log.odometer_km).toLocaleString()}${distUnit}
                </div>
              </div>
            </div>
            ${notes}
            <div class="d-flex justify-content-end align-items-center mt-3 pt-3 border-top border-secondary border-opacity-25">
              <button class="btn btn-sm btn-outline-danger rounded-pill px-3 py-1" onclick="deleteServiceLog('${log.id}')" title="Delete">
                <i class="bi bi-trash" style="font-size: 0.8rem;"></i> Delete
              </button>
            </div>
          </div>
        </div>
      `;
    });
    
    maintenanceLogsContainer.innerHTML = html;
  };

  const fetchMaintenanceLogs = async () => {
    const { data, error } = await supabaseClient
      .from('maintenance_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('service_date', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
         maintenanceLogsContainer.innerHTML = `<div class="text-danger text-center py-4 px-3"><i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>Please run the Supabase SQL script to create the maintenance_logs table first.</div>`;
      } else {
         console.error('Error fetching maintenance logs:', error);
         maintenanceLogsContainer.innerHTML = `<div class="text-danger text-center py-4">Failed to load maintenance logs.</div>`;
      }
      return;
    }

    allMaintenanceLogs = data || [];
    renderMaintenanceLogs();
  };

  await fetchSettings();
  fetchEntries();
  fetchMaintenanceLogs();
});
