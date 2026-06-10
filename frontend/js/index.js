function bankInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const BANK_LOGO_BG = {
  MARO: '#FDE7CB', SUNE: '#FFF5E9', NOMN: '#FDE7CB',
  IONB: '#ECF7FF', MUTE: '#FFF5E9'
};
const BANK_LOGO_FG = {
  MARO: '#CE912D', SUNE: '#CE912D', NOMN: '#CE912D',
  IONB: '#026B9A', MUTE: '#CE912D'
};

function renderStars(rating) {
  // 4 gold stars to mirror the JioFinance listing
  const filled = '★'.repeat(rating);
  const empty  = '☆'.repeat(5 - rating);
  return `<span class="rating" aria-label="${rating}/5">${filled}${empty}</span>`;
}

async function loadBanks() {
  const listEl = document.getElementById('bankList');

  // If user is signed in, swap sign-in for portfolio link
  const token = localStorage.getItem('token');
  if (token) {
    document.getElementById('signinLink').textContent = 'Portfolio';
    document.getElementById('signinLink').href = '/portfolio.html';
    document.getElementById('mobileSignin').textContent = 'Portfolio';
    document.getElementById('mobileSignin').href = '/portfolio.html';
    document.getElementById('mobilePortfolio').style.display = '';
  }

  try {
    const res = await fetch('/api/banks');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Failed to load');

    if (data.banks && data.banks.length > 0) {
      listEl.innerHTML = data.banks.map(b => {
        const isSenior = b.max_senior_pct !== b.max_rate_pct;
        return `
          <div class="card">
            <div class="card-header">
              <div class="bank-logo" style="background-color: ${BANK_LOGO_BG[b.bank_code] || '#FDE7CB'}; color: ${BANK_LOGO_FG[b.bank_code] || '#CE912D'};">
                ${bankInitials(b.bank_name)}
              </div>
              <div class="bank-name">${b.bank_name}</div>
            </div>
            <p class="card-description">${b.blurb} <a class="read-more" href="#" onclick="return false">Read more</a></p>
            <hr class="card-divider" />
            <div class="card-meta">
              <div class="meta-item">
                <span class="meta-label">Interest rate</span>
                <span class="meta-value meta-value--accent">${b.min_rate_pct}% - ${b.max_rate_pct}%</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Senior citizen</span>
                <span class="meta-value">up to ${b.max_senior_pct}%</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Min. investment</span>
                <span class="meta-value">₹${Number(b.min_fd_amount).toLocaleString('en-IN')}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Tenures</span>
                <span class="meta-value">${b.tenures_count} options</span>
              </div>
            </div>
            <div class="card-footer">
              <div class="chip-row">
                <span class="chip">${b.bank_code}</span>
                <span class="chip">${b.type_label}</span>
                <span class="chip">${b.dicgc_insured ? 'DICGC Insured' : 'No DICGC'}</span>
              </div>
              ${renderStars(4)}
              <a class="btn btn-sm" href="/login.html" onclick="${token ? `event.preventDefault(); window.location.href='/rates.html';` : ''}">Invest now</a>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = '<p>No partner banks available.</p>';
    }
  } catch (err) {
    listEl.innerHTML = `<div class="error show">Failed to load: ${err.message}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadBanks);
