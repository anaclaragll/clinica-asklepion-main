(() => {
  const STORAGE_KEYS = {
    authUser: 'auth_user',
    users: 'auth_users'
  };

  // API base:
  // - porta 3000 (Node.js ou PHP built-in): usa paths relativos ao subdiretório
  // - porta 80 / Apache: aponta direto para o Node.js em localhost:3000
  const _port = window.location.port;
  const API_BASE = (_port === '3000')
    ? window.location.pathname.replace(/\/[^/]*$/, '')
    : 'http://localhost:3000';

  // Seed local apenas para pacientes (equipe/medicos autenticam via API/banco)
  const seedUsers = [
    { cpf: '12345678901', senha: 'paciente123', nome: 'Joao da Silva', tipo: 'paciente' }
  ];

  function normalizeCpf(cpf) {
    return String(cpf || '').replace(/\D/g, '');
  }

  function formatCpf(cpf) {
    const digits = normalizeCpf(cpf).slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  function encodeValue(value) {
    // Base64 é apenas ofuscação para demo local; não é criptografia de segurança.
    const utf8 = encodeURIComponent(JSON.stringify(value));
    return btoa(utf8);
  }

  function decodeValue(rawValue) {
    const utf8 = atob(rawValue);
    return JSON.parse(decodeURIComponent(utf8));
  }

  function readStorage(key, fallback) {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) return fallback;

    try {
      return decodeValue(rawValue);
    } catch {
      try {
        return JSON.parse(rawValue);
      } catch {
        return fallback;
      }
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, encodeValue(value));
  }

  function parseArrayStorage(key) {
    const stored = readStorage(key, []);
    return Array.isArray(stored) ? stored : [];
  }

  function getRegisteredUsers() {
    return parseArrayStorage(STORAGE_KEYS.users);
  }

  function saveRegisteredUsers(users) {
    writeStorage(STORAGE_KEYS.users, users);
  }

  function getUsers() {
    const merged = [...seedUsers, ...getRegisteredUsers()];
    const uniqueByCpf = new Map();
    merged.forEach((user) => {
      const cpf = normalizeCpf(user.cpf);
      if (cpf.length === 11) {
        uniqueByCpf.set(cpf, { ...user, cpf });
      }
    });
    return [...uniqueByCpf.values()];
  }

  function isEquipeType(tipo) {
    return tipo === 'medico' || tipo === 'recepcao' || tipo === 'equipe';
  }

  function matchesSelectedRole(user, selectedRole) {
    if (selectedRole === 'paciente') {
      return user.tipo === 'paciente';
    }
    return isEquipeType(user.tipo);
  }

  function authenticate(cpf, senha, selectedRole) {
    const normalizedCpf = normalizeCpf(cpf);
    // Comparação em texto plano é somente para mock local; em produção use hash seguro no backend.
    const user = getUsers().find((item) => item.cpf === normalizedCpf && item.senha === senha);

    if (!user) {
      return { ok: false, message: 'CPF ou senha inválidos.' };
    }

    if (!matchesSelectedRole(user, selectedRole)) {
      return { ok: false, message: 'Tipo de acesso não corresponde ao perfil informado.' };
    }

    return { ok: true, user };
  }

  function setSession(user) {
    writeStorage(STORAGE_KEYS.authUser, user);
  }

  function getSession() {
    const user = readStorage(STORAGE_KEYS.authUser, null);
    return user && user.cpf ? user : null;
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.authUser);
  }

  function pageForUser(user) {
    if (user.tipo === 'paciente') return 'index.html';
    if (user.tipo === 'medico') return 'medico.html';
    return 'equipe.html';
  }

  function redirectToLogin() {
    window.location.href = 'login.html';
  }

  function requireAuth(allowedTypes) {
    const user = getSession();
    if (!user) {
      redirectToLogin();
      return null;
    }

    if (Array.isArray(allowedTypes) && allowedTypes.length > 0 && !allowedTypes.includes(user.tipo)) {
      window.location.href = pageForUser(user);
      return null;
    }

    return user;
  }

  function redirectIfLoggedIn() {
    const user = getSession();
    if (user) {
      window.location.href = pageForUser(user);
    }
  }

  function registerPatient(payload) {
    const nome = String(payload.nome || '').trim();
    const cpf = normalizeCpf(payload.cpf);
    const senha = String(payload.senha || '');

    if (nome.length < 3) {
      return { ok: false, message: 'Informe o nome completo.' };
    }

    if (cpf.length !== 11) {
      return { ok: false, message: 'Informe um CPF válido com 11 dígitos.' };
    }

    if (senha.length < 8) {
      return { ok: false, message: 'A senha deve ter pelo menos 8 caracteres.' };
    }
    if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      return { ok: false, message: 'A senha deve conter letras e números.' };
    }

    const users = getUsers();
    if (users.some((user) => user.cpf === cpf)) {
      return { ok: false, message: 'Já existe cadastro para este CPF.' };
    }

    const registeredUsers = getRegisteredUsers();
    const newUser = { nome, cpf, senha, tipo: 'paciente' };
    registeredUsers.push(newUser);
    saveRegisteredUsers(registeredUsers);

    return { ok: true, user: newUser };
  }

  function attachCpfMask(input) {
    input.addEventListener('input', () => {
      input.value = formatCpf(input.value);
    });
  }

  window.AsklepionAuth = {
    apiBase: API_BASE,
    normalizeCpf,
    formatCpf,
    attachCpfMask,
    authenticate,
    setSession,
    getSession,
    clearSession,
    requireAuth,
    redirectIfLoggedIn,
    pageForUser,
    registerPatient,
    isEquipeType
  };
})();
