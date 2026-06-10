(() => {
  const auth = window.AsklepionAuth;
  auth.redirectIfLoggedIn();

  const form = document.getElementById('signupForm');
  const nomeInput = document.getElementById('nome');
  const cpfInput = document.getElementById('cpf');
  const senhaInput = document.getElementById('senha');
  const message = document.getElementById('signupMessage');

  auth.attachCpfMask(cpfInput);

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const result = auth.registerPatient({
      nome: nomeInput.value,
      cpf: cpfInput.value,
      senha: senhaInput.value
    });

    if (!result.ok) {
      message.textContent = result.message;
      message.classList.add('error');
      return;
    }

    auth.setSession(result.user);
    window.location.href = 'index.html';
  });
})();
