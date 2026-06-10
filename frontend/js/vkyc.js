async function startVkyc() {
  const params = new URLSearchParams(window.location.search);
  const rateId = params.get('rateId');
  if (!rateId) return window.location.href = '/rates.html';

  document.getElementById('vkycInit').style.display = 'none';
  document.getElementById('vkycLoading').style.display = 'block';

  // Simulate connecting to agent and auto-approval (mock)
  setTimeout(async () => {
    try {
      const res = await api.post('/kyc/vkyc/complete');
      if (res.approved) {
        window.location.href = `/book.html?rateId=${rateId}`;
      }
    } catch (err) {
      document.getElementById('vkycInit').style.display = 'block';
      document.getElementById('vkycLoading').style.display = 'none';
      const errorEl = document.getElementById('vkycError');
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  }, 2000);
}
