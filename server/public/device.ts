const form = document.getElementById('deviceForm') as HTMLFormElement | null;
const statusEl = document.getElementById('status') as HTMLElement | null;
const userCodeInput = document.getElementById('userCode') as HTMLInputElement | null;

const params = new URLSearchParams(window.location.search);
const code = params.get('code');
if (code && userCodeInput) {
  userCodeInput.value = code;
}

function setStatus(message: string, type = ''): void {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form) return;
  const formData = new FormData(form);
  const userCode = String(formData.get('userCode') || '')
    .trim()
    .toUpperCase();
  const email = String(formData.get('email') || '').trim();

  if (!userCode || !email) {
    setStatus('Please fill in both fields.', 'error');
    return;
  }

  try {
    const response = await fetch('/v1/auth/device-code/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, email }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to approve device.');
    }
    setStatus('Device confirmed. Return to the extension to continue.', 'success');
  } catch (error) {
    const err = error as Error;
    setStatus(err.message || 'Something went wrong.', 'error');
  }
});
