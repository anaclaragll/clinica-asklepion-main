# Clínica Asklepion

Front-end estático em **HTML, CSS e JavaScript puro**, com autenticação mock, perfis por tipo de usuário e fluxo de agendamento integrado ao paciente logado.

## Estrutura

- `login.html` (acesso com tabs Paciente/Equipe)
- `cadastro.html` (cadastro mínimo de paciente)
- `index.html` (dashboard do paciente)
- `medico.html` (dashboard médico)
- `equipe.html` (dashboard recepção/equipe)
- `css/styles.css`
- `js/auth.js`
- `js/login.js`
- `js/cadastro.js`
- `js/app.js`
- `js/medico.js`
- `js/equipe.js`

## Como executar

1. Clone ou baixe o repositório.
2. Abra o arquivo `login.html` diretamente no navegador.

Não há backend nem dependências externas.

## Usuários mock para teste

- Paciente: `123.456.789-01` / `paciente123`
- Médico: `222.333.444-55` / `medico123`
- Recepção: `999.888.777-66` / `recepcao123`

> Credenciais acima são apenas para demonstração local (mock), sem uso em produção e nunca devem ser usadas em ambientes expostos (incluindo staging público).

## Fluxos

- **Login e sessão**: valida CPF, senha e tipo selecionado (Paciente/Equipe) e persiste sessão em `localStorage` (`auth_user`).
- **Proteção de páginas**: dashboards internos redirecionam para login quando não há sessão.
- **Direcionamento por perfil**:
  - paciente → `index.html`
  - médico → `medico.html`
  - recepção/equipe → `equipe.html`
- **Agendamento**: no dashboard do paciente, consultas confirmadas são salvas em `localStorage` (`appointments`) vinculadas ao CPF do paciente.
- **Minhas Consultas**: lista apenas consultas do paciente logado.
