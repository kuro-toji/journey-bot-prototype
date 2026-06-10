const BANK_BLURBS = {
  MARO: 'A leading Small Finance Bank offering competitive deposit rates with a focus on customer-first banking.',
  SUNE: 'A New-Age Digital First Bank providing seamless, technology-driven savings experiences to retail customers.',
  NOMN: 'A scheduled Small Finance Bank serving the underserved with a strong microfinance and banking portfolio.',
  IONB: 'A new-generation private sector bank offering comprehensive retail and digital banking services.',
  MUTE: 'A leading financial services NBFC, part of the trusted Shriram group, offering fixed deposit products.'
};

const BANK_TYPE_LABEL = {
  sfb: 'Small Finance Bank',
  commercial: 'Commercial Bank',
  nbfc: 'NBFC'
};

function bankInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function bankLogoColor(code) {
  // Different gold-tone variants so each bank has its own visual identity
  const palette = {
    MARO: '#FDE7CB',
    SUNE: '#FFF5E9',
    NOMN: '#FDE7CB',
    IONB: '#ECF7FF',
    MUTE: '#FFF5E9'
  };
  return palette[code] || '#FDE7CB';
}

function bankLogoTextColor(code) {
  const palette = {
    MARO: '#CE912D',
    SUNE: '#CE912D',
    NOMN: '#CE912D',
    IONB: '#026B9A',
    MUTE: '#CE912D'
  };
  return palette[code] || '#CE912D';
}

function shortDesc(blurb) {
  // Truncate to ~140 chars + "Read more" link
  if (blurb.length <= 140) return { text: blurb, hasMore: false };
  return { text: blurb.slice(0, 140) + '…', hasMore: true };
}

async function loadRates() {
  const listEl = document.getElementById('ratesList');

  try {
    const res = await api.get('/rates');

    if (res.rates && res.rates.length > 0) {
      // Group rates by bank so we show one card per bank with the best tenure
      // OR show every rate (5 banks × 3 tenures = 15). Let's show every rate.
      listEl.innerHTML = res.rates.map(rate => {
        const ratePct = (rate.interest_rate_bps / 100).toFixed(2);
        const seniorPct = (rate.senior_citizen_rate_bps / 100).toFixed(2);
        const blurb = BANK_BLURBS[rate.bank_code] || 'A trusted banking partner offering competitive fixed deposit products.';
        const d = shortDesc(blurb);
        const typeLabel = BANK_TYPE_LABEL[rate.bank_type] || 'Bank';
        return `
          <div class="card">
            <div class="card-header">
              <div class="bank-logo" style="background-color: ${bankLogoColor(rate.bank_code)}; color: ${bankLogoTextColor(rate.bank_code)};">
                ${bankInitials(rate.bank_name)}
              </div>
              <div class="bank-name">${rate.bank_name}</div>
            </div>
            <p class="card-description">${d.text}${d.hasMore ? ' <a class="read-more" href="#" onclick="return false">Read more</a>' : ''}</p>
            <hr class="card-divider" />
            <div class="card-meta">
              <div class="meta-item">
                <span class="meta-label">Interest rate</span>
                <span class="meta-value meta-value--accent">${ratePct}% - ${seniorPct}%</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Min. investment</span>
                <span class="meta-value">₹${Number(rate.min_fd_amount).toLocaleString('en-IN')}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Tenure</span>
                <span class="meta-value">${rate.tenure_months} months</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Type</span>
                <span class="meta-value" style="font-size: 0.85rem;">${typeLabel}</span>
              </div>
            </div>
            <div class="card-footer">
              <div class="chip-row">
                <span class="chip">${rate.bank_code}</span>
                <span class="chip">DICGC${rate.dicgc_insured ? ' Insured' : ' N/A'}</span>
              </div>
              <button class="btn btn-sm" onclick="bookFd(${rate.rate_id})">Invest now</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = '<p>No rates available at the moment.</p>';
    }
  } catch (err) {
    listEl.innerHTML = `<div class="error show">Failed to load rates: ${err.message}</div>`;
  }
}

function bookFd(rateId) {
  window.location.href = `/pan.html?rateId=${rateId}`;
}

document.addEventListener('DOMContentLoaded', loadRates);
