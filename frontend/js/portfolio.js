function bankInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

async function loadPortfolio() {
  const listEl = document.getElementById('portfolioList');

  try {
    const res = await api.get('/journey/portfolio');

    if (res.bookings && res.bookings.length > 0) {
      listEl.innerHTML = res.bookings.map(booking => {
        const ratePct = (booking.interest_rate_bps / 100).toFixed(2);

        let stateLabel = booking.state;
        let stateClass = '';
        if (booking.state === 'fd_active') {
          stateLabel = 'Active';
        } else if (booking.state === 'fd_pending_vkyc') {
          stateLabel = 'Pending VKYC';
          stateClass = 'status-badge--pending';
        } else if (booking.state === 'fd_matured') {
          stateLabel = 'Matured';
          stateClass = 'status-badge--matured';
        }

        return `
          <div class="card">
            <div class="card-header">
              <div class="bank-logo">${bankInitials(booking.bank_name)}</div>
              <div class="bank-name">${booking.bank_name}</div>
              <span class="status-badge ${stateClass}" style="margin-left: auto;">${stateLabel}</span>
            </div>
            <p class="card-description" style="font-size: 0.82rem;">Ref: <strong>${booking.bank_reference_id}</strong></p>
            <hr class="card-divider" />
            <div class="card-meta">
              <div class="meta-item">
                <span class="meta-label">Principal</span>
                <span class="meta-value">₹${Number(booking.principal).toLocaleString('en-IN')}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Interest rate</span>
                <span class="meta-value meta-value--accent">${ratePct}% p.a.</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Tenure</span>
                <span class="meta-value">${booking.tenure_months} months</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Maturity Date</span>
                <span class="meta-value" style="font-size: 0.85rem;">${new Date(booking.maturity_date).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
            <div class="card-divider"></div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.25rem;">
              <span style="color: var(--text-secondary); font-size: 0.82rem;">Maturity Amount</span>
              <span style="font-weight: 700; color: #059669;">₹${Number(booking.maturity_amount).toLocaleString('en-IN')}</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
          <p style="margin: 0 0 1rem 0;">You haven't booked any FDs yet.</p>
          <a href="/rates.html" class="btn">Explore FDs</a>
        </div>
      `;
    }
  } catch (err) {
    listEl.innerHTML = `<div class="error show">Failed to load portfolio: ${err.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadPortfolio);
