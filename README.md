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
2. Coloque a pasta do projeto em `C:\xampp\htdocs\clinica-asklepion-main` (já está neste local no seu ambiente).

O projeto suporta duas formas de execução:

- PHP + XAMPP (recomendado para Windows)
- Node.js (opcional, apenas se você quiser rodar o servidor Node)

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

## Banco de dados

Adicionei um esquema SQLite e um script de inicialização para facilitar testes locais com persistência simples.

- Arquivos adicionados:
  - `db/schema.sql` — esquema e dados de exemplo.
  - `db/init_db.js` — script Node.js que cria `db/clinica.db` a partir do schema.
  - `package.json` — script `npm run init-db` para inicializar o banco.

Instruções rápidas (PHP/XAMPP):

Abra o XAMPP Control Panel e inicie `Apache` e `MySQL`. Então execute:

PowerShell (ou CMD):
```powershell
cd C:\xampp\htdocs\clinica-asklepion-main
C:\xampp\php\php.exe php_api\init_db.php
```

Ou simplesmente clique duas vezes em `open_site.bat` (criado para Windows) — ele inicializa o DB usando o PHP do XAMPP e abre o site.

O banco SQLite será criado em `db/clinica.db`.

## Executando localmente (API + front-end)

Node.js (opcional):

Se quiser usar o fluxo Node (requer Node.js e npm instalados):

```powershell
cd C:\xampp\htdocs\clinica-asklepion-main
npm install
npm run init-db
npm start
```

O servidor Node expõe a aplicação normalmente em `http://localhost:3000`.

### Usando PHP (sem Node)

Se preferir rodar a API em PHP (não precisa do Node), certifique-se de ter:

- PHP 8+ instalado
- Extensão PDO_SQLITE habilitada

Com PHP instalado, inicie o servidor built-in na raiz do projeto:

Windows CMD:
```bat
start_php.bat
```

PowerShell:
```powershell
.\start_php.ps1
```

Isso inicializa um servidor em `http://localhost:3000` que serve o front-end e os endpoints em `/api/*` implementados em `php_api/api.php`. O banco usado é `db/clinica.db`.
