document.addEventListener('DOMContentLoaded', async () => {
  const formTitle = document.getElementById('form-title');
  const authForm = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const passwordContainer = document.getElementById('password-container');
  const submitBtn = document.getElementById('submit-btn');
  const magicLinkBtn = document.getElementById('magic-link-btn');
  const resendVerificationBtn = document.getElementById('resend-verification-btn');
  const toggleModeBtn = document.getElementById('toggle-mode');
  const toggleText = document.getElementById('toggle-text');
  const alertContainer = document.getElementById('alert-container');

  let isSignUpMode = false;

  // Check if session exists on load
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Display Bootstrap alerts
  const showAlert = (message, type = 'danger') => {
    alertContainer.innerHTML = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>
    `;
  };

  // Toggle between Sign In and Sign Up modes
  toggleModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
      formTitle.textContent = 'Sign Up';
      submitBtn.textContent = 'Sign Up';
      toggleText.textContent = 'Already have an account?';
      toggleModeBtn.textContent = 'Sign In';
      magicLinkBtn.classList.add('d-none'); // Hide magic link on signup mode
    } else {
      formTitle.textContent = 'Sign In';
      submitBtn.textContent = 'Sign In';
      toggleText.textContent = "Don't have an account?";
      toggleModeBtn.textContent = 'Sign Up';
      magicLinkBtn.classList.remove('d-none');
    }
    resendVerificationBtn.classList.add('d-none');
    alertContainer.innerHTML = '';
  });

  // Handle form submission (Sign In / Sign Up)
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertContainer.innerHTML = ''; // clear previous alerts
    const email = emailInput.value;
    const password = passwordInput.value;

    if (!password) {
      showAlert('Password is required.');
      return;
    }

    try {
      submitBtn.disabled = true;
      if (isSignUpMode) {
        const { data, error } = await supabaseClient.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.href
          }
        });
        if (error) throw error;
        if (data.session) {
          window.location.href = 'dashboard.html';
        } else {
          showAlert('Please check your email to confirm your account.', 'success');
        }
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes('Email not confirmed')) {
            resendVerificationBtn.classList.remove('d-none');
          }
          throw error;
        }
        if (data.session) {
          window.location.href = 'dashboard.html';
        }
      }
    } catch (error) {
      showAlert(error.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Handle Magic Link Login
  magicLinkBtn.addEventListener('click', async () => {
    alertContainer.innerHTML = ''; // clear previous alerts
    const email = emailInput.value;
    if (!email) {
      showAlert('Please enter your email to send a magic link.');
      return;
    }

    try {
      magicLinkBtn.disabled = true;
      const { error } = await supabaseClient.auth.signInWithOtp({ 
        email,
        options: {
          emailRedirectTo: window.location.href
        }
      });
      if (error) throw error;
      showAlert('Magic link sent! Check your email.', 'success');
    } catch (error) {
      showAlert(error.message);
    } finally {
      magicLinkBtn.disabled = false;
    }
  });

  // Handle Resend Verification Email
  resendVerificationBtn.addEventListener('click', async () => {
    alertContainer.innerHTML = ''; // clear previous alerts
    const email = emailInput.value;
    if (!email) {
      showAlert('Please enter your email to resend the verification link.');
      return;
    }

    try {
      resendVerificationBtn.disabled = true;
      const { error } = await supabaseClient.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: window.location.href
        }
      });
      if (error) throw error;
      showAlert('Verification email resent! Please check your inbox.', 'success');
      resendVerificationBtn.classList.add('d-none');
    } catch (error) {
      showAlert(error.message);
    } finally {
      resendVerificationBtn.disabled = false;
    }
  });
});

// Global logout function available to other pages
window.logoutUser = async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Error logging out:', error.message);
  }
};
