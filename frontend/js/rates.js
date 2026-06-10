async function loadRates() {
  const listEl = document.getElementById('ratesList');
  
  try {
    const res = await api.get('/rates');
    
    if (res.rates && res.rates.length > 0) {
      listEl.innerHTML = res.rates.map(rate => {
        const ratePct = (rate.interest_rate_bps / 100).toFixed(2);
        return `
          <div class="card">
            <div class="card-header">
              <div class="bank-name">${rate.bank_name}</div>
              <div class="rate-highlight">${ratePct}% p.a.</div>
            </div>
            <div class="rate-details">
              <span>Tenure: ${rate.tenure_months} months</span>
              <span>Min: ₹${rate.min_fd_amount}</span>
            </div>
            <button class="btn" onclick="bookFd(${rate.rate_id})">Book Now</button>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = '<p>No rates available at the moment.</p>';
    }
  } catch (err) {
    listEl.innerHTML = `<div class="error" style="display:block">Failed to load rates: ${err.message}</div>`;
  }
}

function bookFd(rateId) {
  window.location.href = `/pan.html?rateId=${rateId}`;
}

document.addEventListener('DOMContentLoaded', loadRates);
