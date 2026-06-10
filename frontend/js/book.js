let currentRateId = null;

async function initBook() {
  const params = new URLSearchParams(window.location.search);
  currentRateId = params.get('rateId');
  
  if (!currentRateId) {
    window.location.href = '/rates.html';
    return;
  }
  
  // Quick fetch to display rate details (we fetch all and find the one)
  try {
    const res = await api.get('/rates');
    const rate = res.rates.find(r => r.rate_id == currentRateId);
    
    if (rate) {
      document.getElementById('rateInfo').style.display = 'block';
      document.getElementById('bankName').textContent = rate.bank_name;
      document.getElementById('ratePct').textContent = `${(rate.interest_rate_bps / 100).toFixed(2)}% p.a.`;
      document.getElementById('tenure').textContent = rate.tenure_months;
      document.getElementById('principal').min = rate.min_fd_amount;
    }
  } catch (err) {
    console.error('Failed to load rate details', err);
  }
}

async function handleBook(event) {
  event.preventDefault();
  
  const principal = document.getElementById('principal').value;
  const nomineeName = document.getElementById('nomineeName').value;
  const nomineeRel = document.getElementById('nomineeRel').value;
  
  const btn = document.getElementById('submitBtn');
  const errorEl = document.getElementById('bookError');
  
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Processing...';
  
  try {
    const payload = {
      rateId: parseInt(currentRateId, 10),
      principal: parseFloat(principal),
      customerType: 'general'
    };
    
    if (nomineeName && nomineeRel) {
      payload.nomineeName = nomineeName;
      payload.nomineeRelationship = nomineeRel;
    }
    
    const res = await api.post('/journey/book', payload);
    
    if (res.success && res.booking) {
      window.location.href = `/confirmation.html?id=${res.booking.journey_id}`;
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
  }
}

document.addEventListener('DOMContentLoaded', initBook);
