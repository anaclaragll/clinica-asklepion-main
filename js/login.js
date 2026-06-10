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

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const result = auth.authenticate(cpfInput.value, senhaInput.value, selectedRole);
    if (!result.ok) {
      message.textContent = result.message;
      message.classList.add('error');
      return;
    }

    auth.setSession(result.user);
    window.location.href = auth.pageForUser(result.user);
  });
})();
