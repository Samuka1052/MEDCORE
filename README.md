# Recepção Hospitalar

Pequeno sistema de recepção hospitalar em HTML/CSS/JS (frontend-only). Coleta dados do paciente, gera um número aleatório único e salva no `localStorage` do navegador.

Como usar (modo sem servidor)
- Abra o arquivo `index.html` no navegador.
- Preencha os campos e clique em `Gerar Número` para obter um ID ou `Salvar Paciente` para gravar os dados no `localStorage`.
- Use `Exportar CSV` para baixar todos os registros.

Como usar com servidor
1. Abra um terminal na pasta do projeto.
2. Instale dependências:

```bash
npm install
```

3. Inicie o servidor:

```bash
npm start
```

4. Abra `http://localhost:3000` no navegador.

## Supabase para agendamentos

### 1. Criar o projeto

Entre em https://supabase.com, faça login e clique em **New project**. Aguarde o projeto terminar de ser criado.

### 2. Criar a tabela

No painel do Supabase:

1. Abra **SQL Editor** no menu lateral.
2. Clique em **New query**.
3. Abra o arquivo `supabase.sql` deste projeto, copie todo o conteúdo e cole na consulta. Se `appointments` já existia, execute o arquivo novamente: os comandos `add column if not exists` adicionam os novos campos do paciente sem apagar os agendamentos existentes.
4. Clique em **Run**.

### 3. Encontrar as chaves

No Supabase, abra **Project Settings > API** e copie:

- **Project URL**: será usado em `SUPABASE_URL`.
- **service_role key**: será usada em `SUPABASE_SERVICE_ROLE_KEY`, somente no servidor para operações de dados.
- **anon/public key**: será usada em `SUPABASE_ANON_KEY` pelo servidor para login e recuperação de senha.

A chave `service_role` é secreta: não a publique nem a coloque no `index.html`. A chave `anon/public` não concede acesso administrativo, mas também ficará somente no servidor nesta aplicação.

### 4. Criar o arquivo `.env` no Windows

O arquivo `.env` ainda não aparece porque ele precisa ser criado. O arquivo existente `.env.example` é apenas um modelo.

No VS Code, abra o terminal com **Terminal > New Terminal** e confirme que o caminho termina em `123456789`. Execute:

```powershell
Copy-Item .env.example .env
```

Depois, no Explorer do VS Code, clique em atualizar. Deve aparecer um arquivo chamado `.env` na mesma pasta de `server.js` e `package.json`.

Abra `.env` e substitua os textos de exemplo:

```env
SUPABASE_URL=https://abcdefghijklmnop.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_ANON_KEY=******
PORT=3000
APP_URL=http://localhost:3000
```

Não coloque aspas, espaços antes ou depois do sinal `=` e não deixe os textos `seu-projeto` ou `cole_a_service_role_key_aqui`.

Se o Explorer não mostrar arquivos iniciados por ponto, use **File > Open File** e digite `.env`, ou execute no terminal:

```powershell
code .env
```

### 5. Reiniciar o servidor

Pare o servidor atual com `Ctrl+C` e execute novamente:

```powershell
npm start
```

Quando a configuração estiver correta, o terminal exibirá `Supabase enabled` na mensagem de inicialização. Depois abra `http://localhost:3000`.

Com as credenciais configuradas, os agendamentos, horários de chegada e status da fila são gravados no Supabase e continuam disponíveis depois que o servidor reiniciar. Sem credenciais, o sistema usa o armazenamento local ou a memória do servidor como fallback de desenvolvimento.

## Login por CPF e recuperação de senha

O login usa o Supabase Auth; o CPF é associado ao e-mail no arquivo local `auth-users.json`. Esse arquivo contém dados pessoais e está no `.gitignore`: não o publique nem o envie ao repositório. Para criar sua cópia a partir do modelo:

```powershell
if (-not (Test-Path auth-users.json)) { Copy-Item auth-users.example.json auth-users.json }
```

Edite a cópia com um objeto por funcionário (`cpf`, `email`, `level` e `label`). Esse arquivo local associa o CPF ao e-mail, sem armazenar senhas. Com SMTP configurado, execute `npm run auth:invite` para o Supabase enviar um convite a cada endereço listado. O funcionário abre o link, define sua senha na página do sistema e passa a entrar com o CPF correspondente.

No `.env`, configure também `SUPABASE_ANON_KEY` usando a chave pública (anon/publishable) em **Project Settings > API Keys** e `APP_URL` com a URL pública do sistema. A chave `SUPABASE_SERVICE_ROLE_KEY` continua somente no servidor e nunca deve ser usada no navegador.

Para enviar mensagens reais, configure um provedor SMTP em **Authentication > SMTP Settings**. Em **Authentication > URL Configuration**, adicione `${APP_URL}/reset-password.html` às Redirect URLs permitidas. A recuperação informa uma mensagem genérica, sem revelar se um endereço está cadastrado.

O funcionário informa o e-mail associado à sua conta e recebe o link do Supabase. A nova senha passa a ser usada no login pelo CPF correspondente.

Funcionalidades adicionadas
- Endpoints REST para pacientes, fila, chamadas e agendamentos.
- Persistência de agendamentos no Supabase.

Notas
- A interface ainda é a mesma SPA simples; adições como dashboard, painel de chamada e agenda foram expostas via API para serem consumidas pela UI. Posso integrar as telas à interface front se desejar.
