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
  document.documentElement.setAttribute('data-bs-theme', newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
};
