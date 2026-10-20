(() => {
  const form = document.getElementById('resetPasswordForm');
  const password = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const message = document.getElementById('resetMessage');
  const loginLink = document.getElementById('loginLink');
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');

  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  if (parameters.get('error_description')) {
    message.textContent = 'O link de recuperação está inválido ou expirou. Solicite outro link.';
    message.classList.add('error');
  } else if (!['recovery', 'invite'].includes(parameters.get('type')) || !accessToken || !refreshToken) {
    message.textContent = 'O link de recuperação está inválido ou expirou. Solicite outro link.';
    message.classList.add('error');
  } else {
    form.classList.remove('hidden');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    message.classList.remove('error');
    if (password.value !== confirmPassword.value) {
      message.textContent = 'As senhas não coincidem.';
      message.classList.add('error');
      return;
    }

    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          password: password.value
        })
      });
      const result = await response.json();
      if (!response.ok) {
        message.textContent = result.error || 'Não foi possível atualizar a senha.';
        message.classList.add('error');
        return;
      }
      form.classList.add('hidden');
      message.textContent = result.message;
      loginLink.classList.remove('hidden');
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      message.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
      message.classList.add('error');
    }
  });
})();
