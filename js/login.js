(() => {
  const auth = window.AsklepionAuth;
  auth.redirectIfLoggedIn();

  const form = document.getElementById('loginForm');
  const cpfInput = document.getElementById('cpf');
  const senhaInput = document.getElementById('senha');
  const message = document.getElementById('loginMessage');
  const segmentButtons = document.querySelectorAll('.segment-btn');

  let selectedRole = 'paciente';

  auth.attachCpfMask(cpfInput);

  segmentButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedRole = button.dataset.role;
      segmentButtons.forEach((item) => item.classList.toggle('active', item === button));
      message.textContent = '';
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    message.classList.remove('error');

    const cpf = auth.normalizeCpf(cpfInput.value);
    const senha = senhaInput.value;

    // Sempre tenta a API primeiro (admin, médico, recepção)
    // A aba selecionada é apenas uma dica visual; o banco determina o perfil real
    try {
      const r = await fetch(`${auth.apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, senha })
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        auth.setSession(j.user);
        window.location.href = auth.pageForUser(j.user);
        return;
      }
      // API retornou erro de autenticação — cai no fallback (paciente localStorage)
    } catch {
      // API indisponível — cai no fallback
    }

    // Fallback: autenticação local apenas para pacientes
    const result = auth.authenticate(cpf, senha, 'paciente');
    if (!result.ok) {
      message.textContent = 'CPF ou senha inválidos.';
      message.classList.add('error');
      return;
    }
    auth.setSession(result.user);
    window.location.href = auth.pageForUser(result.user);
  });
})();
