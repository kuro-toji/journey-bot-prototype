async function handlePan(event) {
  event.preventDefault();
  
  const params = new URLSearchParams(window.location.search);
  const rateId = params.get('rateId');
  if (!rateId) return window.location.href = '/rates.html';
  
  const pan = document.getElementById('pan').value.toUpperCase();
  const dob = document.getElementById('dob').value;
  const btn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('panError');
  
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verifying...';
  
  try {
    const res = await api.post('/kyc/verify-pan', { pan, dob });
    if (res.verified) {
      window.location.href = `/aadhaar.html?rateId=${rateId}`;
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify PAN';
  }
}
