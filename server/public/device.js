const form = document.getElementById('deviceForm');
const statusEl = document.getElementById('status');
const userCodeInput = document.getElementById('userCode');

const params = new URLSearchParams(window.location.search);
const code = params.get('code');
if (code && userCodeInput) {
  userCodeInput.value = code;
}

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const userCode = String(formData.get('userCode') || '').trim().toUpperCase();
  const email = String(formData.get('email') || '').trim();

  if (!userCode || !email) {
    setStatus('Please fill in both fields.', 'error');
    return;
  }

  try {
    const response = await fetch('/v1/auth/device-code/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, email })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to approve device.');
    }
    setStatus('Device confirmed. Return to the extension to continue.', 'success');
  } catch (error) {
    setStatus(error.message || 'Something went wrong.', 'error');
  }
});
