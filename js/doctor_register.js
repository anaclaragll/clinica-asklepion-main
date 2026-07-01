(() => {
  const auth = window.AsklepionAuth;
  const API_BASE = auth.apiBase;

  const form      = document.getElementById('doctorForm');
  const submitBtn = document.getElementById('submitBtn');
  const result    = document.getElementById('result');

  submitBtn.addEventListener('click', async () => {
    result.textContent = '';
    result.className = 'form-message';

    const senha    = document.getElementById('senha').value.trim();
    const confirmar = document.getElementById('confirmar').value.trim();

    if (!senha) {
      result.textContent = 'Informe uma senha.';
      return;
    }
    if (senha !== confirmar) {
      result.textContent = 'As senhas não coincidem.';
      return;
    }

    const payload = {
      name:      document.getElementById('name').value.trim(),
      email:     document.getElementById('email').value.trim(),
      cpf:       document.getElementById('cpf').value.replace(/\D/g, ''),
      specialty: document.getElementById('specialty').value.trim(),
      crm:       document.getElementById('crm').value.trim(),
      bio:       document.getElementById('bio').value.trim(),
      senha
    };

    if (!payload.name || !payload.email) {
      result.textContent = 'Nome e e-mail são obrigatórios.';
      return;
    }

    submitBtn.disabled = true;
    try {
      const r = await fetch(`${API_BASE}/api/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!r.ok) {
        result.textContent = 'Erro: ' + (j.error || JSON.stringify(j));
        result.classList.add('error');
      } else {
        result.textContent = `${payload.name} cadastrado(a) com sucesso!`;
        form.reset();
      }
    } catch (e) {
      result.textContent = 'Erro de conexão: ' + e.message;
      result.classList.add('error');
    }
    submitBtn.disabled = false;
  });
})();
