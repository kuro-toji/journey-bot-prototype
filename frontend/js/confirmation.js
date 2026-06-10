async function loadConfirmation() {
  const params = new URLSearchParams(window.location.search);
  const journeyId = params.get('id');
  
  if (!journeyId) {
    window.location.href = '/portfolio.html';
    return;
  }
  
  try {
    const res = await api.get(`/journey/${journeyId}`);
    
    if (res.booking) {
      document.getElementById('bookingDetails').style.display = 'block';
      document.getElementById('bankRef').textContent = res.booking.bank_reference_id;
      document.getElementById('principal').textContent = `₹${parseFloat(res.booking.principal).toLocaleString('en-IN')}`;
      document.getElementById('maturityDate').textContent = new Date(res.booking.maturity_date).toLocaleDateString('en-IN');
      
      document.getElementById('confirmMessage').textContent = `Your ${res.booking.tenure_months}-month FD with ${res.booking.bank_name} is active.`;
    }
  } catch (err) {
    console.error('Failed to load booking details', err);
    document.getElementById('confirmMessage').textContent = 'Your FD has been booked, but we could not load the details right now.';
  }
}

document.addEventListener('DOMContentLoaded', loadConfirmation);
