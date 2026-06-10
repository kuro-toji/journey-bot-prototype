async function loadPortfolio() {
  const listEl = document.getElementById('portfolioList');
  
  try {
    const res = await api.get('/journey/portfolio');
    
    if (res.bookings && res.bookings.length > 0) {
      listEl.innerHTML = res.bookings.map(booking => {
        const ratePct = (booking.interest_rate_bps / 100).toFixed(2);
        
        let stateLabel = booking.state;
        let stateColor = '#d1fae5'; // default green
        let stateTextColor = '#065f46';
        
        if (booking.state === 'fd_active') {
          stateLabel = 'Active';
        } else if (booking.state === 'fd_pending_vkyc') {
          stateLabel = 'Pending VKYC';
          stateColor = '#fef3c7';
          stateTextColor = '#92400e';
        } else if (booking.state === 'fd_matured') {
          stateLabel = 'Matured';
          stateColor = '#e0e7ff';
          stateTextColor = '#3730a3';
        }
        
        return `
          <div class="card">
            <div class="card-header" style="margin-bottom:0.5rem;">
              <div class="bank-name">${booking.bank_name}</div>
              <span class="status-badge" style="background-color: ${stateColor}; color: ${stateTextColor}">${stateLabel}</span>
            </div>
            <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem;">
              Ref: ${booking.bank_reference_id}
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: #4b5563;">Principal</span>
              <span style="font-weight: 600;">₹${parseFloat(booking.principal).toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: #4b5563;">Interest Rate</span>
              <span style="font-weight: 600;">${ratePct}% p.a.</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: #4b5563;">Maturity Amount</span>
              <span style="font-weight: 600; color: #059669;">₹${parseFloat(booking.maturity_amount).toLocaleString('en-IN')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
              <span style="color: #6b7280;">Maturity Date</span>
              <span>${new Date(booking.maturity_date).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem;">
          <p>You haven't booked any FDs yet.</p>
          <a href="/rates.html" class="btn">Discover FDs</a>
        </div>
      `;
    }
  } catch (err) {
    listEl.innerHTML = `<div class="error" style="display:block">Failed to load portfolio: ${err.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadPortfolio);
