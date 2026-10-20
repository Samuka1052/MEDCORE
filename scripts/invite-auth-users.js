require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (process.env.APP_URL || `http://localhost:${process.env.PORT || 3005}`).replace(/\/+$/, '');
const usersPath = path.join(__dirname, '..', 'auth-users.json');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env antes de enviar convites.');
  process.exit(1);
}
if (!fs.existsSync(usersPath)) {
  console.error('auth-users.json não encontrado. Crie o arquivo local a partir de auth-users.example.json.');
  process.exit(1);
}

const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
if (!Array.isArray(users) || users.some(user => !user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email))) {
  console.error('auth-users.json contém usuários inválidos.');
  process.exit(1);
}

const targetEmail = process.argv[2];
const targetUsers = targetEmail
  ? users.filter(user => user.email.toLowerCase() === targetEmail.toLowerCase())
  : users;
if (targetEmail && targetUsers.length === 0) {
  console.error('O e-mail informado não está cadastrado em auth-users.json.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
});

(async () => {
  let invited = 0;
  let failed = 0;
  for (const [index, user] of targetUsers.entries()) {
    const { error } = await supabase.auth.admin.inviteUserByEmail(user.email, {
      redirectTo: `${appUrl}/reset-password.html`
    });
    if (error) {
      failed += 1;
      console.error(`Convite ${index + 1} não enviado (${error.code || error.status || 'erro do Supabase'}).`);
    } else {
      invited += 1;
    }
  }

  console.log(`${invited} convite(s) enviado(s); ${failed} falha(s).`);
  if (failed) process.exitCode = 1;
})().catch(error => {
  console.error('Falha inesperada ao enviar convites:', error.code || error.name || 'unknown');
  process.exitCode = 1;
});
