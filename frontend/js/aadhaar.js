let currentRequestId = null;

async function handleAadhaar(event) {
  event.preventDefault();
  
  const aadhaar = document.getElementById('aadhaar').value;
  const btn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('aadhaarError');
  
  errorEl.style.display = 'none';
  
  if (aadhaar.length !== 12) {
    errorEl.textContent = 'Please enter a valid 12-digit Aadhaar number';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  
  try {
    const res = await api.post('/kyc/aadhaar/initiate', { aadhaar });
    if (res.success) {
      currentRequestId = res.request_id;
      document.getElementById('stepInitiate').style.display = 'none';
      document.getElementById('stepVerify').style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Send OTP';
  }
}

async function handleOtp(event) {
  event.preventDefault();
  
  const params = new URLSearchParams(window.location.search);
  const rateId = params.get('rateId');
  if (!rateId) return window.location.href = '/rates.html';

  const otp = document.getElementById('otp').value;
  const btn = document.getElementById('verifyBtn');
  const errorEl = document.getElementById('otpError');
  
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verifying...';
  
  try {
    const res = await api.post('/kyc/aadhaar/verify', { request_id: currentRequestId, otp });
    if (res.verified) {
      window.location.href = `/vkyc.html?rateId=${rateId}`;
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify & Continue';
  }
}
