document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const user = session.user;
  const alertContainer = document.getElementById('alert-container');
  const settingsForm = document.getElementById('settings-form');
  const saveBtn = document.getElementById('save-btn');
  const unitInput = document.getElementById('unit_system');
  const currencyInput = document.getElementById('currency');

  const showAlert = (message, type = 'danger') => {
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
    setTimeout(() => { alertContainer.innerHTML = ''; }, 5000);
  };

  // Fetch current settings
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        unitInput.value = data.unit_system;
        currencyInput.value = data.currency;
      }
    } catch (err) {
      console.error('Error fetching settings:', err.message);
      showAlert('Failed to load settings.');
    }
  };

  // Save settings
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    alertContainer.innerHTML = '';

    const payload = {
      user_id: user.id,
      unit_system: unitInput.value,
      currency: currencyInput.value
    };

    try {
      const { error } = await supabaseClient
        .from('user_settings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      showAlert('Settings saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving settings:', err.message);
      showAlert(err.message);
    } finally {
      saveBtn.disabled = false;
    }
  });

  fetchSettings();
});
