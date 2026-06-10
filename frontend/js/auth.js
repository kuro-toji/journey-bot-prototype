// Redirect if already logged in
if (window.location.pathname === '/login.html' && localStorage.getItem('token')) {
  window.location.href = '/rates.html';
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const phoneInput = document.getElementById('phone');
  const btn = document.getElementById('submitBtn');
  
  hideError('loginError');
  
  if (!phoneInput.value || !/^[6-9][0-9]{9}$/.test(phoneInput.value)) {
    showError('loginError', 'Please enter a valid 10-digit mobile number');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Sending OTP...';
    
    const res = await api.post('/auth/send-otp', { phone: phoneInput.value });
    
    if (res.success) {
      localStorage.setItem('temp_phone', phoneInput.value);
      window.location.href = '/otp.html';
    }
  } catch (err) {
    showError('loginError', err.message);
    btn.disabled = false;
    btn.textContent = 'Continue';
  }
}

async function handleOtp(event) {
  event.preventDefault();
  const otpInput = document.getElementById('otp');
  const btn = document.getElementById('submitBtn');
  const phone = localStorage.getItem('temp_phone');
  
  hideError('otpError');
  
  if (!phone) {
    window.location.href = '/login.html';
    return;
  }
  
  if (!otpInput.value || otpInput.value.length !== 6) {
    showError('otpError', 'Please enter a valid 6-digit OTP');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    
    const res = await api.post('/auth/verify-otp', { 
      phone, 
      otp: otpInput.value 
    });
    
    if (res.success && res.token) {
      localStorage.setItem('token', res.token);
      localStorage.removeItem('temp_phone');
      window.location.href = '/rates.html';
    }
  } catch (err) {
    showError('otpError', err.message);
    btn.disabled = false;
    btn.textContent = 'Verify OTP';
  }
}

// Prefill phone on OTP page
document.addEventListener('DOMContentLoaded', () => {
  const phoneSpan = document.getElementById('displayPhone');
  if (phoneSpan) {
    const phone = localStorage.getItem('temp_phone');
    if (!phone) {
      window.location.href = '/login.html';
    } else {
      phoneSpan.textContent = phone;
    }
  }
});
