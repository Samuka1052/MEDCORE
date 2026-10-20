require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(bodyParser.json());
const PORT = process.env.PORT || 3005;

const patients = [];
const appointments = [];
const calls = [];
const doctors = [
  { id: 1, name: 'Dra. Ana Beatriz', specialty: 'Cardiologia', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '08:00', endTime: '12:00' },
  { id: 2, name: 'Dr. Carlos Mendes', specialty: 'Dermatologia', days: ['Terça', 'Quinta'], startTime: '09:00', endTime: '13:00' },
  { id: 3, name: 'Dra. Fernanda Lima', specialty: 'Endocrinologia', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '13:00', endTime: '17:00' },
  { id: 4, name: 'Dr. Rafael Souza', specialty: 'Ginecologia', days: ['Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
  { id: 5, name: 'Dra. Patrícia Alves', specialty: 'Neurologia', days: ['Segunda', 'Quarta'], startTime: '14:00', endTime: '18:00' },
  { id: 6, name: 'Dr. Eduardo Costa', specialty: 'Clínica Geral', days: ['Segunda', 'Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
  { id: 7, name: 'Dr. João Martins', specialty: 'Clínica Geral', days: ['Quarta', 'Sexta'], startTime: '09:00', endTime: '13:00' },
  { id: 8, name: 'Dra. Camila Nunes', specialty: 'Clínica Geral', days: ['Terça', 'Quinta', 'Sábado'], startTime: '13:00', endTime: '17:00' },
  { id: 9, name: 'Dra. Mariana Rocha', specialty: 'Pediatria', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '08:00', endTime: '12:00' },
  { id: 10, name: 'Dr. Henrique Almeida', specialty: 'Ortopedia', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
  { id: 11, name: 'Dra. Lúcia Ferreira', specialty: 'Psiquiatria', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '09:00', endTime: '13:00' },
  { id: 12, name: 'Dr. Vinícius Prado', specialty: 'Urologia', days: ['Quarta', 'Sábado'], startTime: '08:00', endTime: '12:00' },
  { id: 13, name: 'Dr. André Oliveira', specialty: 'Cardiologia', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
  { id: 14, name: 'Dra. Beatriz Martins', specialty: 'Dermatologia', days: ['Segunda', 'Quarta'], startTime: '14:00', endTime: '18:00' },
  { id: 15, name: 'Dr. Lucas Ribeiro', specialty: 'Endocrinologia', days: ['Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
  { id: 16, name: 'Dra. Juliana Castro', specialty: 'Ginecologia', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '14:00', endTime: '18:00' },
  { id: 17, name: 'Dr. Marcelo Azevedo', specialty: 'Neurologia', days: ['Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
  { id: 18, name: 'Dra. Renata Gomes', specialty: 'Clínica Geral', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '14:00', endTime: '18:00' },
  { id: 19, name: 'Dr. Felipe Moreira', specialty: 'Pediatria', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
  { id: 20, name: 'Dra. Carolina Mendes', specialty: 'Ortopedia', days: ['Segunda', 'Quarta'], startTime: '08:00', endTime: '12:00' },
  { id: 21, name: 'Dr. Gustavo Nogueira', specialty: 'Psiquiatria', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
  { id: 22, name: 'Dra. Isabela Freitas', specialty: 'Urologia', days: ['Segunda', 'Sexta'], startTime: '14:00', endTime: '18:00' },
  { id: 23, name: 'Dr. Roberto Lima', specialty: 'Emergencista', days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], startTime: '08:00', endTime: '20:00' },
  { id: 24, name: 'Dra. Simone Alves', specialty: 'Emergencista', days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], startTime: '08:00', endTime: '20:00' },
  { id: 25, name: 'Dr. Thiago Martins', specialty: 'Emergencista', days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], startTime: '08:00', endTime: '20:00' }
];
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const appUrl = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const authUsersPath = path.join(__dirname, 'auth-users.json');
const authSessionCache = new Map();
let authUsers = [];

if (fs.existsSync(authUsersPath)) {
  authUsers = JSON.parse(fs.readFileSync(authUsersPath, 'utf8'));
  if (!Array.isArray(authUsers) || authUsers.some(user =>
    !/^\d{11}$/.test(user.cpf) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
    !Number.isInteger(user.level) ||
    user.level < 1 ||
    user.level > 3 ||
    !user.label
  )) {
    throw new Error('auth-users.json contém usuários inválidos.');
  }
  const cpfs = authUsers.map(user => user.cpf);
  const emails = authUsers.map(user => user.email.toLowerCase());
  if (new Set(cpfs).size !== cpfs.length || new Set(emails).size !== emails.length) {
    throw new Error('auth-users.json não pode repetir CPF ou e-mail.');
  }
} else {
  console.warn('auth-users.json não encontrado; autenticação CPF/e-mail indisponível.');
}

function createAuthClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

function getAuthUserByEmail(email) {
  return authUsers.find(user => user.email.toLowerCase() === String(email || '').toLowerCase());
}

function getAuthProfile(user) {
  const account = getAuthUserByEmail(user.email);
  if (!account) return null;
  return { cpf: account.cpf, level: account.level, label: account.label };
}

function rememberAuthSession(session, user) {
  const profile = getAuthProfile(user);
  if (!profile) return null;
  const now = Date.now();
  for (const [token, cached] of authSessionCache) {
    if (cached.expiresAt <= now) authSessionCache.delete(token);
  }
  if (authSessionCache.size >= 1000) authSessionCache.delete(authSessionCache.keys().next().value);
  authSessionCache.set(session.access_token, {
    profile,
    expiresAt: now + Math.max(0, Number(session.expires_in) || 30) * 1000
  });
  return profile;
}

function readCookie(req, name) {
  const prefix = `${name}=`;
  const cookie = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
}

function writeAuthCookies(res, session) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const accessAge = Math.max(0, Number(session.expires_in) || 3600);
  const refreshAge = 60 * 60 * 24 * 30;
  res.setHeader('Set-Cookie', [
    `medcore_access=${encodeURIComponent(session.access_token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${accessAge}${secure}`,
    `medcore_refresh=${encodeURIComponent(session.refresh_token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${refreshAge}${secure}`
  ]);
}

function clearAuthCookies(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `medcore_access=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
    `medcore_refresh=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
  ]);
}

function authNotConfigured(res) {
  return res.status(503).json({ error: 'A autenticação ainda não está configurada no servidor.' });
}

function asyncAuthRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(error => {
      console.error('Falha inesperada no serviço de autenticação:', error.code || error.name || 'unknown');
      if (res.headersSent) return next(error);
      return res.status(502).json({ error: 'O serviço de autenticação está indisponível. Tente novamente.' });
    });
  };
}

app.post('/api/auth/login', asyncAuthRoute(async (req, res) => {
  const client = createAuthClient();
  if (!client || !authUsers.length) return authNotConfigured(res);

  const cpf = String(req.body?.cpf || '').replace(/\D/g, '');
  const password = String(req.body?.password || '');
  const account = authUsers.find(user => user.cpf === cpf);
  if (!account || !password) return res.status(401).json({ error: 'CPF ou senha inválidos.' });

  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password });
  if (error || !data.session) {
    if (error && error.status >= 500) {
      console.error('Erro do Supabase Auth no login:', error.code || error.status);
      return res.status(502).json({ error: 'Não foi possível autenticar agora. Tente novamente.' });
    }
    return res.status(401).json({ error: 'CPF ou senha inválidos.' });
  }

  const profile = rememberAuthSession(data.session, data.user);
  if (!profile) {
    await client.auth.signOut();
    return res.status(403).json({ error: 'Conta sem CPF associado neste sistema.' });
  }

  writeAuthCookies(res, data.session);
  res.json({ user: profile });
}));

app.get('/api/auth/session', asyncAuthRoute(async (req, res) => {
  const client = createAuthClient();
  const refreshToken = readCookie(req, 'medcore_refresh');
  if (!client) return authNotConfigured(res);
  if (!refreshToken) return res.status(401).json({ error: 'Sessão não encontrada.' });

  const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
  const profile = data.user && getAuthProfile(data.user);
  if (error || !data.session || !profile) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  }

  writeAuthCookies(res, data.session);
  rememberAuthSession(data.session, data.user);
  res.json({ user: profile });
}));

app.post('/api/auth/logout', asyncAuthRoute(async (req, res) => {
  const client = createAuthClient();
  const accessToken = readCookie(req, 'medcore_access');
  const refreshToken = readCookie(req, 'medcore_refresh');
  try {
    if (client && accessToken && refreshToken) {
      const { error: sessionError } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      if (!sessionError) {
        const { error } = await client.auth.signOut();
        if (error) console.error('Erro ao encerrar sessão do Supabase Auth:', error.code || error.status);
      }
    }
  } finally {
    clearAuthCookies(res);
  }
  res.status(204).end();
}));

app.post('/api/auth/recover', asyncAuthRoute(async (req, res) => {
  const client = createAuthClient();
  if (!client || !authUsers.length) return authNotConfigured(res);

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }

  const account = getAuthUserByEmail(email);
  if (account) {
    const { error } = await client.auth.resetPasswordForEmail(account.email, {
      redirectTo: `${appUrl}/reset-password.html`
    });
    if (error) {
      console.error('Erro ao solicitar recuperação no Supabase Auth:', error.code || error.status);
      return res.status(502).json({ error: 'Não foi possível enviar o e-mail agora. Tente novamente.' });
    }
  }

  res.json({ message: 'Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.' });
}));

app.post('/api/auth/password', asyncAuthRoute(async (req, res) => {
  const client = createAuthClient();
  if (!client || !authUsers.length) return authNotConfigured(res);

  const accessToken = String(req.body?.accessToken || '');
  const refreshToken = String(req.body?.refreshToken || '');
  const password = String(req.body?.password || '');
  if (!accessToken || !refreshToken) {
    return res.status(400).json({ error: 'O link de recuperação está inválido ou expirou.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 8 caracteres.' });
  }

  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (sessionError || !sessionData.user || !getAuthProfile(sessionData.user)) {
    return res.status(400).json({ error: 'O link de recuperação está inválido ou expirou.' });
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    console.error('Erro ao atualizar senha no Supabase Auth:', error.code || error.status);
    return res.status(502).json({ error: 'Não foi possível atualizar a senha agora. Tente novamente.' });
  }

  const { error: signOutError } = await client.auth.signOut();
  if (signOutError) console.error('Erro ao encerrar sessão de recuperação:', signOutError.code || signOutError.status);
  res.json({ message: 'Senha atualizada. Você já pode entrar com sua nova senha.' });
}));

async function getRequestAuthProfile(req, res) {
  const client = createAuthClient();
  if (!client) return null;

  const accessToken = readCookie(req, 'medcore_access');
  const cached = accessToken && authSessionCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;

  let user = null;
  if (accessToken) {
    const { data, error } = await client.auth.getUser(accessToken);
    if (error && (!error.status || error.status >= 500)) throw error;
    if (!error) user = data.user;
  }

  if (!user) {
    const refreshToken = readCookie(req, 'medcore_refresh');
    if (!refreshToken) return null;
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (error && (!error.status || error.status >= 500)) throw error;
    if (error || !data.session || !data.user) return null;
    writeAuthCookies(res, data.session);
    return rememberAuthSession(data.session, data.user);
  }

  const profile = getAuthProfile(user);
  if (!profile) return null;
  authSessionCache.set(accessToken, { profile, expiresAt: Date.now() + 30000 });
  return profile;
}

app.use('/api', asyncAuthRoute(async (req, res, next) => {
  if (req.path === '/ping') return next();
  if (!createAuthClient()) return authNotConfigured(res);

  const profile = await getRequestAuthProfile(req, res);
  if (!profile) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  req.authUser = profile;
  return next();
}));

function requireAuthLevel(level) {
  return (req, res, next) => {
    if (req.authUser && req.authUser.level >= level) return next();
    return res.status(403).json({ error: 'Seu nível de acesso não permite esta ação.' });
  };
}

if (supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  console.warn('SUPABASE_URL invalida. Use a Project URL, por exemplo: https://seu-id.supabase.co');
}

function mapAppointment(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientDob: row.patient_dob || '',
    patientGender: row.patient_gender || '',
    patientPhone: row.patient_phone || '',
    patientEmail: row.patient_email || '',
    patientInsurance: row.patient_insurance || '',
    patientAddress: row.patient_address || '',
    patientPriority: row.patient_priority || 'Normal',
    patientNotes: row.patient_notes || '',
    room: row.room || '',
    doctor: row.doctor,
    specialty: row.specialty,
    datetime: row.datetime,
    arrivalTime: row.arrival_time || '',
    createdAt: row.created_at,
    status: row.status || 'scheduled'
  };
}

function priorityOrder(value) {
  const map = { 'Emergência': 1, 'Urgente': 2, 'Normal': 3 };
  return map[value] || 99;
}

app.get('/api/ping', (req, res) => res.json({ ok: true }));

app.get('/api/doctors', (req, res) => {
  res.json(doctors);
});

app.post('/api/doctors', requireAuthLevel(3), (req, res) => {
  const doctor = req.body;
  const specialties = ['Cardiologia', 'Dermatologia', 'Endocrinologia', 'Ginecologia', 'Neurologia', 'Clínica Geral', 'Pediatria', 'Ortopedia', 'Psiquiatria', 'Urologia', 'Emergencista'];
  if (!doctor?.name || !doctor?.specialty || !specialties.includes(String(doctor.specialty).trim()) || !Array.isArray(doctor?.days) || !doctor?.days.length || !doctor?.startTime || !doctor?.endTime || !doctor?.room) {
    return res.status(400).json({ error: 'name, specialty, days, startTime, endTime and room are required' });
  }

  const normalized = {
    id: doctor.id || Date.now(),
    name: String(doctor.name).trim(),
    specialty: String(doctor.specialty).trim(),
    days: doctor.days.map(day => String(day).trim()).filter(Boolean),
    startTime: String(doctor.startTime).trim(),
    endTime: String(doctor.endTime).trim(),
    room: String(doctor.room).trim()
  };

  const index = doctors.findIndex(item => item.name.toLowerCase() === normalized.name.toLowerCase());
  if (index >= 0) {
    doctors[index] = { ...doctors[index], ...normalized };
  } else {
    doctors.push(normalized);
  }

  res.json({ ok: true, doctor: normalized });
});

app.delete('/api/doctors/:id', requireAuthLevel(3), (req, res) => {
  const index = doctors.findIndex(item => String(item.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'doctor not found' });
  doctors.splice(index, 1);
  res.json({ ok: true });
});

app.post('/api/patients', requireAuthLevel(2), (req, res) => {
  const patient = req.body;
  if (!patient?.id || !patient?.name) {
    return res.status(400).json({ error: 'id and name required' });
  }

  const index = patients.findIndex(item => item.id === patient.id);
  if (index >= 0) {
    patients[index] = { ...patients[index], ...patient };
  } else {
    patients.unshift({
      ...patient,
      createdAt: patient.createdAt || new Date().toISOString(),
      status: patient.status || 'waiting'
    });
  }

  res.json({ ok: true });
});

app.get('/api/patients', (req, res) => {
  res.json([...patients].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);

  const rows = patients.filter(patient => [
    patient.id,
    patient.name,
    patient.phone,
    patient.email,
    patient.dob
  ].some(value => String(value || '').toLowerCase().includes(q)));

  res.json(rows);
});

app.get('/api/queue', (req, res) => {
  const rows = patients
    .filter(patient => patient.status === 'waiting' || !patient.status)
    .sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority) || new Date(a.createdAt) - new Date(b.createdAt));

  res.json(rows.map(patient => ({
    id: patient.id,
    priority: patient.priority,
    createdAt: patient.createdAt,
    queueNumber: patient.queueNumber,
    name: patient.name
  })));
});

app.post('/api/queue/call', requireAuthLevel(2), (req, res) => {
  const { id, room } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });

  const patient = patients.find(item => item.id === id);
  if (!patient) return res.status(404).json({ error: 'patient not found' });

  patient.status = 'in_service';
  patient.calledAt = new Date().toISOString();
  patient.room = room || 'A definir';
  calls.unshift({ patientId: patient.id, room: patient.room, calledAt: patient.calledAt });
  res.json({ ok: true, calledAt: patient.calledAt });
});

app.post('/api/queue/finish', requireAuthLevel(2), (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });

  const patient = patients.find(item => item.id === id);
  if (!patient) return res.status(404).json({ error: 'patient not found' });

  patient.status = 'finished';
  patient.finishedAt = new Date().toISOString();
  res.json({ ok: true });
});

app.get('/api/calls', (req, res) => {
  res.json(calls.slice(0, 50));
});

app.post('/api/appointments', requireAuthLevel(2), async (req, res) => {
  const a = req.body;
  if (!a.patientId || !a.doctor || !a.specialty || !a.datetime) {
    return res.status(400).json({ error: 'missing appointment fields' });
  }

  if (supabase) {
    const { data: existing, error: duplicateError } = await supabase
      .from('appointments')
      .select('id, patient_id, patient_name')
      .eq('doctor', a.doctor)
      .eq('datetime', a.datetime)
      .limit(1);
    if (duplicateError) {
      console.error('Erro ao verificar agendamento duplicado:', duplicateError.message);
      return res.status(500).json({ error: duplicateError.message });
    }
    const samePatient = existing?.some(item => String(item.patient_id) === String(a.patientId) || String(item.patient_name || '').toLowerCase() === String(a.patientName || '').toLowerCase());
    if (samePatient) return res.status(409).json({ error: 'Este paciente já possui agendamento para este médico e horário.' });

    const { data, error } = await supabase.from('appointments').insert({
      patient_id: a.patientId,
      patient_name: a.patientName || a.patientId,
      patient_dob: a.patientDob || '',
      patient_gender: a.patientGender || '',
      patient_phone: a.patientPhone || '',
      patient_email: a.patientEmail || '',
      patient_insurance: a.patientInsurance || '',
      patient_address: a.patientAddress || '',
      patient_priority: a.patientPriority || 'Normal',
      patient_notes: a.patientNotes || '',
      doctor: a.doctor,
      specialty: a.specialty,
      datetime: a.datetime,
      arrival_time: a.arrivalTime || '',
      status: a.status || 'scheduled'
    }).select().single();
    if (error) {
      console.error('Erro ao salvar agendamento no Supabase:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.json({ ok: true, appointment: mapAppointment(data) });
  }

  const duplicate = appointments.find(item => item.doctor === a.doctor && item.datetime === a.datetime && (String(item.patientId) === String(a.patientId) || String(item.patientName).toLowerCase() === String(a.patientName || '').toLowerCase()));
  if (duplicate) return res.status(409).json({ error: 'Este paciente já possui agendamento para este médico e horário.' });

  const item = {
    id: Date.now(),
    ...a,
    createdAt: new Date().toISOString(),
    status: a.status || 'scheduled',
    arrivalTime: a.arrivalTime || ''
  };
  appointments.push(item);
  res.json({ ok: true, id: item.id });
});

app.delete('/api/appointments/:id', requireAuthLevel(3), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid appointment id' });
  if (supabase) {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  const index = appointments.findIndex(item => Number(item.id) === id);
  if (index === -1) return res.status(404).json({ error: 'appointment not found' });
  appointments.splice(index, 1);
  res.json({ ok: true });
});

app.delete('/api/patients/:id', requireAuthLevel(3), async (req, res) => {
  const index = patients.findIndex(item => String(item.id) === String(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'patient not found' });
  patients.splice(index, 1);
  res.json({ ok: true });
});

app.put('/api/appointments/:id', requireAuthLevel(2), async (req, res) => {
  const id = Number(req.params.id);
  const update = req.body;
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'invalid appointment id' });
  }

  if (supabase) {
    const { data, error } = await supabase.from('appointments').update({
      patient_id: update.patientId,
      patient_name: update.patientName,
      patient_dob: update.patientDob || '',
      patient_gender: update.patientGender || '',
      patient_phone: update.patientPhone || '',
      patient_email: update.patientEmail || '',
      patient_insurance: update.patientInsurance || '',
      patient_address: update.patientAddress || '',
      patient_priority: update.patientPriority || 'Normal',
      patient_notes: update.patientNotes || '',
      doctor: update.doctor,
      specialty: update.specialty,
      datetime: update.datetime,
      arrival_time: update.arrivalTime || '',
      status: update.status || 'scheduled'
    }).eq('id', id).select().single();
    if (error) {
      console.error('Erro ao atualizar agendamento no Supabase:', error.message);
      return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    }
    return res.json({ ok: true, appointment: mapAppointment(data) });
  }

  const index = appointments.findIndex(item => Number(item.id) === id);
  if (index === -1) {
    return res.status(404).json({ error: 'appointment not found' });
  }

  appointments[index] = { ...appointments[index], ...update, id, arrivalTime: update.arrivalTime || appointments[index].arrivalTime || '' };
  res.json({ ok: true, appointment: appointments[index] });
});

app.get('/api/appointments', async (req, res) => {
  const day = req.query.day;
  if (supabase) {
    let query = supabase.from('appointments').select('*').order('datetime', { ascending: Boolean(day) });
    if (day) query = query.gte('datetime', `${day}T00:00:00.000Z`).lt('datetime', `${day}T23:59:59.999Z`);
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao carregar agendamentos do Supabase:', error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.json(data.map(mapAppointment));
  }
  if (day) {
    const rows = appointments.filter(item => item.datetime && item.datetime.slice(0, 10) === day);
    return res.json(rows.sort((a, b) => new Date(a.datetime) - new Date(b.datetime)));
  }
  res.json(appointments.sort((a, b) => new Date(b.datetime) - new Date(a.datetime)));
});

app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const patientsToday = patients.filter(p => p.createdAt && p.createdAt.slice(0, 10) === today).length;
  const awaiting = patients.filter(p => p.status === 'waiting' || !p.status).length;
  const inService = patients.filter(p => p.status === 'in_service').length;
  const finished = patients.filter(p => p.status === 'finished').length;
  const emergencies = patients.filter(p => p.priority === 'Emergência').length;

  res.json({ patientsToday, awaiting, inService, finished, emergencies });
});

app.use('/auth-users.json', (req, res) => res.sendStatus(404));
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});


const wppconnect = require('@wppconnect-team/wppconnect');

// Inicializa a sessão do WhatsApp
wppconnect
  .create({
    session: 'sessao-troca-senha', // Nome da sessão
    catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
      console.log('Número de tentativas de ler o QR Code:', attempts);
    },
    statusFind: (statusSession, session) => {
      console.log('Status da Sessão:', statusSession);
    },
    headless: true, // Roda em segundo plano sem abrir interface gráfica do Chrome
  })
  .then((client) => start(client))
  .catch((error) => console.log(error));

// Função que gerencia o cliente após a conexão
function start(client) {
  console.log('WhatsApp conectado com sucesso!');

  // Exemplo de como você chamaria essa função no seu fluxo de redefinição de senha
  // Você pode criar uma rota HTTP (usando Express) para disparar isso sob demanda
  async function enviarLinkRedefinicao(numero, link) {
    try {
      const mensagem = `Olá! Recebemos uma solicitação para redefinir sua senha.\n\nClique no link abaixo para cadastrar uma nova senha:\n${link}\n\nSe não foi você que solicitou, ignore esta mensagem.`;

      // O número precisa estar no formato internacional: 55 + DDD + Número + @c.us
      await client.sendText(`${numero}@c.us`, mensagem);
      console.log(`Link de redefinição enviado para ${numero}`);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  }

  // Teste automático (remover ou comentar após testar)
  // enviarLinkRedefinicao('5581999998888', 'https://seusite.com');
}
