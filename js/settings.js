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
  
  // Appearance Elements
  const orbVisibilityInput = document.getElementById('orb_visibility');
  const orbVisibilityVal = document.getElementById('orb_visibility_val');
  const orbSpeedInput = document.getElementById('orb_speed');
  const orbSpeedVal = document.getElementById('orb_speed_val');

  // Live preview for sliders
  orbVisibilityInput.addEventListener('input', (e) => {
    const val = e.target.value;
    orbVisibilityVal.innerText = `${val}%`;
    document.documentElement.style.setProperty('--orb-opacity', val / 100);
  });

  orbSpeedInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    orbSpeedVal.innerText = `${val}x`;
    document.documentElement.style.setProperty('--orb-speed', val);
  });

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
        
        if (data.orb_visibility !== null && data.orb_visibility !== undefined) {
          orbVisibilityInput.value = data.orb_visibility;
          orbVisibilityVal.innerText = `${data.orb_visibility}%`;
        }
        
        if (data.orb_speed !== null && data.orb_speed !== undefined) {
          orbSpeedInput.value = data.orb_speed;
          orbSpeedVal.innerText = `${parseFloat(data.orb_speed).toFixed(1)}x`;
        }
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
      currency: currencyInput.value,
      orb_visibility: parseFloat(orbVisibilityInput.value),
      orb_speed: parseFloat(orbSpeedInput.value)
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
