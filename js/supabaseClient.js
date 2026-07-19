// IMPORTANT: Replace these two placeholders with your actual Supabase project URL and anon key.
// The anon key is safe to be exposed in the frontend as security is handled via Row Level Security (RLS).
const SUPABASE_URL = 'https://jijmohgmkfgkruqmvwtp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UZ62JjEPqdBvn0OZW0ECmg_-u99zm-r';

// Create a single supabase client for interacting with your database
// This constant will be exposed globally and used by all other scripts.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auto-logout after 15 minutes of inactivity
let inactivityTimer;
const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    const { data } = await supabaseClient.auth.getSession();
    if (data && data.session) {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    }
  }, INACTIVITY_LIMIT);
}

// Track user activity to reset the timer
['mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// Initialize the timer
resetInactivityTimer();

// Theme Manager
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-bs-theme', savedTheme);
  document.documentElement.setAttribute('data-theme', savedTheme);
}
initTheme();

window.toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-bs-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  const applyTheme = () => {
    document.documentElement.setAttribute('data-bs-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  if (document.startViewTransition) {
    document.startViewTransition(applyTheme);
  } else {
    applyTheme();
  }
};

// Inject animated background orbs
document.addEventListener('DOMContentLoaded', () => {
  const orb1 = document.createElement('div');
  orb1.className = 'bg-orb orb-1';
  const orb2 = document.createElement('div');
  orb2.className = 'bg-orb orb-2';
  document.body.prepend(orb1);
  document.body.prepend(orb2);
  
  applyUserSettings();
});

// Fetch and apply user settings globally (e.g. appearance sliders)
async function applyUserSettings() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    const { data, error } = await supabaseClient
      .from('user_settings')
      .select('orb_visibility, orb_speed')
      .eq('user_id', session.user.id)
      .single();
      
    if (data && !error) {
      if (data.orb_visibility !== null && data.orb_visibility !== undefined) {
        document.documentElement.style.setProperty('--orb-opacity', data.orb_visibility / 100);
      }
      if (data.orb_speed !== null && data.orb_speed !== undefined) {
        document.documentElement.style.setProperty('--orb-speed', data.orb_speed);
      }
    }
  }
}
