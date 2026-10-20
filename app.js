(async () => {
  const loginView = document.getElementById('loginView');
  const appShell = document.getElementById('appShell');
  const loginForm = document.getElementById('loginForm');
  const loginCpf = document.getElementById('loginCpf');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const recoverPasswordForm = document.getElementById('recoverPasswordForm');
  const recoveryEmail = document.getElementById('recoveryEmail');
  const recoveryMessage = document.getElementById('recoveryMessage');
  const backToLoginBtn = document.getElementById('backToLoginBtn');
  const sessionLabel = document.getElementById('sessionLabel');
  const logoutBtn = document.getElementById('logoutBtn');
  let currentUser = null;

  function normalizeCpf(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function applyCpfMask(value) {
    const digits = normalizeCpf(value).slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  loginCpf.addEventListener('input', event => {
    event.target.value = applyCpfMask(event.target.value);
  });

  function hasLevel(requiredLevel) {
    return currentUser && currentUser.level >= requiredLevel;
  }

  function requireLevel(requiredLevel) {
    if (hasLevel(requiredLevel)) return true;
    alert('Seu nível de acesso não permite esta ação.');
    return false;
  }

  function setAuthenticatedUser(user) {
    currentUser = user;
    loginView.classList.add('hidden');
    appShell.classList.remove('hidden');
    sessionLabel.textContent = `${user.label} (Nível ${user.level})`;
    loginError.textContent = '';
  }

  logoutBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      alert('Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente.');
      return;
    }
    currentUser = null;
    window.location.reload();
  });

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginError.textContent = '';
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cpf: normalizeCpf(loginCpf.value), password: loginPassword.value })
      });
      const result = await response.json();
      if (!response.ok) {
        loginError.textContent = result.error || 'Não foi possível entrar no sistema.';
        return;
      }
      setAuthenticatedUser(result.user);
      applyAccessRules();
      await renderTable();
      await renderQueue();
      await renderInProgress();
      await renderAppointments();
      await renderDashboard();
      await renderCallPanel();
      await renderDoctors();
      showView(result.user.level >= 2 ? 'register' : 'search');
    } catch (error) {
      console.error('Erro ao autenticar usuário:', error);
      loginError.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
    }
  });

  forgotPasswordBtn.addEventListener('click', () => {
    loginError.textContent = '';
    recoveryMessage.textContent = '';
    recoveryMessage.classList.remove('error');
    loginForm.classList.add('hidden');
    forgotPasswordBtn.classList.add('hidden');
    recoverPasswordForm.classList.remove('hidden');
    recoveryEmail.focus();
  });

  backToLoginBtn.addEventListener('click', () => {
    recoverPasswordForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    forgotPasswordBtn.classList.remove('hidden');
    recoveryMessage.textContent = '';
    recoveryMessage.classList.remove('error');
    loginCpf.focus();
  });

  recoverPasswordForm.addEventListener('submit', async event => {
    event.preventDefault();
    recoveryMessage.textContent = '';
    recoveryMessage.classList.remove('error');
    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail.value.trim() })
      });
      const result = await response.json();
      if (!response.ok) {
        recoveryMessage.textContent = result.error || 'Não foi possível solicitar a recuperação.';
        recoveryMessage.classList.add('error');
        return;
      }
      recoveryMessage.textContent = result.message;
    } catch (error) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      recoveryMessage.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
      recoveryMessage.classList.add('error');
    }
  });

  async function restoreSession() {
    try {
      const response = await fetch('/api/auth/session');
      if (response.status === 401) return;
      const result = await response.json();
      if (!response.ok) {
        loginError.textContent = result.error || 'Não foi possível validar a sessão.';
        return;
      }
      setAuthenticatedUser(result.user);
    } catch (error) {
      console.error('Erro ao validar sessão:', error);
      loginError.textContent = 'Não foi possível conectar ao servidor para validar a sessão.';
    }
  }

  const form = document.getElementById('patientForm');
  const generateBtn = document.getElementById('generateBtn');
  const patientIdEl = document.getElementById('patientId');
  const queueNumberEl = document.getElementById('queueNumber');
  const patientsTableBody = document.querySelector('#patientsTable tbody');
  const dashboardPatientsTableBody = document.querySelector('#dashboardPatientsTable tbody');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');

  const STORAGE_KEY = 'recepcao.pacientes.v1';
  const APPOINTMENTS_KEY = 'recepcao.agendamentos.v1';
  const DOCTORS_KEY = 'recepcao.medicos.v1';
  const DOCTOR_SPECIALTY_MAP = {
    'Dra. Ana Beatriz': 'Cardiologia',
    'Dr. Carlos Mendes': 'Dermatologia',
    'Dra. Fernanda Lima': 'Endocrinologia',
    'Dr. Rafael Souza': 'Ginecologia',
    'Dra. Patrícia Alves': 'Neurologia',
    'Dr. Eduardo Costa': 'Clínica Geral',
    'Dr. João Martins': 'Clínica Geral',
    'Dra. Camila Nunes': 'Clínica Geral',
    'Dra. Mariana Rocha': 'Pediatria',
    'Dr. Henrique Almeida': 'Ortopedia',
    'Dra. Lúcia Ferreira': 'Psiquiatria',
    'Dr. Vinícius Prado': 'Urologia',
    'Dr. André Oliveira': 'Cardiologia',
    'Dra. Beatriz Martins': 'Dermatologia',
    'Dr. Lucas Ribeiro': 'Endocrinologia',
    'Dra. Juliana Castro': 'Ginecologia',
    'Dr. Marcelo Azevedo': 'Neurologia',
    'Dra. Renata Gomes': 'Clínica Geral',
    'Dr. Felipe Moreira': 'Pediatria',
    'Dra. Carolina Mendes': 'Ortopedia',
    'Dr. Gustavo Nogueira': 'Psiquiatria',
    'Dra. Isabela Freitas': 'Urologia',
    'Dr. Roberto Lima': 'Emergencista',
    'Dra. Simone Alves': 'Emergencista',
    'Dr. Thiago Martins': 'Emergencista'
  };
  const DEFAULT_DOCTOR_SCHEDULES = [
    { name: 'Dra. Ana Beatriz', specialty: 'Cardiologia', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dr. Carlos Mendes', specialty: 'Dermatologia', days: ['Terça', 'Quinta'], startTime: '09:00', endTime: '13:00' },
    { name: 'Dra. Fernanda Lima', specialty: 'Endocrinologia', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '13:00', endTime: '17:00' },
    { name: 'Dr. Rafael Souza', specialty: 'Ginecologia', days: ['Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dra. Patrícia Alves', specialty: 'Neurologia', days: ['Segunda', 'Quarta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dr. Eduardo Costa', specialty: 'Clínica Geral', days: ['Segunda', 'Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dr. João Martins', specialty: 'Clínica Geral', days: ['Quarta', 'Sexta'], startTime: '09:00', endTime: '13:00' },
    { name: 'Dra. Camila Nunes', specialty: 'Clínica Geral', days: ['Terça', 'Quinta', 'Sábado'], startTime: '13:00', endTime: '17:00' },
    { name: 'Dra. Mariana Rocha', specialty: 'Pediatria', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dr. Henrique Almeida', specialty: 'Ortopedia', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dra. Lúcia Ferreira', specialty: 'Psiquiatria', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '9:00', endTime: '13:00' },
    { name: 'Dr. Vinícius Prado', specialty: 'Urologia', days: ['Quarta', 'Sábado'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dr. André Oliveira', specialty: 'Cardiologia', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dra. Beatriz Martins', specialty: 'Dermatologia', days: ['Segunda', 'Quarta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dr. Lucas Ribeiro', specialty: 'Endocrinologia', days: ['Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dra. Juliana Castro', specialty: 'Ginecologia', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dr. Marcelo Azevedo', specialty: 'Neurologia', days: ['Terça', 'Quinta'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dra. Renata Gomes', specialty: 'Clínica Geral', days: ['Segunda', 'Quarta', 'Sexta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dr. Felipe Moreira', specialty: 'Pediatria', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dra. Carolina Mendes', specialty: 'Ortopedia', days: ['Segunda', 'Quarta'], startTime: '08:00', endTime: '12:00' },
    { name: 'Dr. Gustavo Nogueira', specialty: 'Psiquiatria', days: ['Terça', 'Quinta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dra. Isabela Freitas', specialty: 'Urologia', days: ['Segunda', 'Sexta'], startTime: '14:00', endTime: '18:00' },
    { name: 'Dr. Roberto Lima', specialty: 'Emergencista', days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], startTime: '08:00', endTime: '20:00' },
    { name: 'Dra. Simone Alves', specialty: 'Emergencista', days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], startTime: '08:00', endTime: '20:00' },
    { name: 'Dr. Thiago Martins', specialty: 'Emergencista', days: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'], startTime: '08:00', endTime: '20:00' }
  ];
  const DOCTOR_ROOM_MAP = {
    'Dr. Eduardo Costa': 'Sala 01', 'Dr. João Martins': 'Sala 02', 'Dra. Camila Nunes': 'Sala 03',
    'Dra. Ana Beatriz': 'Sala 04', 'Dr. Carlos Mendes': 'Sala 05', 'Dra. Fernanda Lima': 'Sala 06',
    'Dr. Rafael Souza': 'Sala 07', 'Dra. Patrícia Alves': 'Sala 08', 'Dra. Mariana Rocha': 'Sala 09',
    'Dr. Henrique Almeida': 'Sala 10', 'Dra. Lúcia Ferreira': 'Sala 11', 'Dr. Vinícius Prado': 'Sala 12',
    'Dr. André Oliveira': 'Sala 13', 'Dra. Beatriz Martins': 'Sala 14', 'Dr. Lucas Ribeiro': 'Sala 15',
    'Dra. Juliana Castro': 'Sala 16', 'Dr. Marcelo Azevedo': 'Sala 17', 'Dra. Renata Gomes': 'Sala 18',
    'Dr. Felipe Moreira': 'Sala 19', 'Dra. Carolina Mendes': 'Sala 20', 'Dr. Gustavo Nogueira': 'Sala 21',
    'Dra. Isabela Freitas': 'Sala 22', 'Dr. Roberto Lima': 'Sala de Emergência 01',
    'Dra. Simone Alves': 'Sala de Emergência 02', 'Dr. Thiago Martins': 'Sala de Emergência 03'
  };
  const SPECIALTY_DOCTORS = Object.entries(DOCTOR_SPECIALTY_MAP).reduce((groups, [doctor, specialty]) => {
    if (!groups[specialty]) groups[specialty] = [];
    groups[specialty].push(doctor);
    return groups;
  }, {});
  const SPECIALTY_DURATION = {
    'Clínica Geral': 20,
    'Dermatologia': 20,
    'Ortopedia': 20,
    'Urologia': 20,
    'Ginecologia': 30,
    'Pediatria': 30,
    'Cardiologia': 30,
    'Endocrinologia': 40,
    'Psiquiatria': 40,
    'Neurologia': 40,
    'Emergencista': 20
  };
  let doctorsCatalog = [];
  let serverAvailable = false;

  function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function isValidDateString(dateString) {
    if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return false;
    const [day, month, year] = dateString.split('/').map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function applyDateMask(value) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function applyDateTimeMask(value) {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    if (!digits) return '';

    const day = digits.slice(0, 2);
    const month = digits.slice(2, 4);
    const year = digits.slice(4, 8);
    const hour = digits.slice(8, 10);
    const minute = digits.slice(10, 12);

    let out = '';
    if (day) out += day;
    if (month) out += '/' + month;
    if (year) out += '/' + year;
    if (hour) out += ' ' + hour;
    if (minute) out += ':' + minute;
    return out;
  }

  function applyTimeMask(value) {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (!digits) return '';
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  function timeToMinutes(value) {
    const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  function appointmentTimeToMinutes(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.getHours() * 60 + date.getMinutes();
  }

  function normalizeAppointmentDateTime(value) {
    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2})$/);
    if (!match) return '';
    const [, day, month, year, hour, minute] = match;
    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    const h = Number(hour);
    const mi = Number(minute);
    if (m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || mi < 0 || mi > 59) return '';
    const date = new Date(y, m - 1, d, h, mi);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d || date.getHours() !== h || date.getMinutes() !== mi) return '';
    return date.toISOString();
  }

  function dateInputToKey(value) {
    const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
  }

  function formatSlotTime(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function formatAppointmentDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function applyPhoneMask(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);

    if (rest.length <= 4) {
      return `(${ddd}) ${rest}`.trim();
    }

    if (rest.length <= 8) {
      return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }

    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
  }

  function validateField(input, rule) {
    const value = input.value.trim();
    let ok = true;

    if (rule === 'email') {
      ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    } else if (rule === 'phone') {
      ok = /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(value);
    } else if (rule === 'name') {
      ok = /^[A-Za-zÀ-ÿ\s.'-]{3,}$/.test(value);
    } else if (rule === 'address') {
      ok = value.length >= 5;
    } else if (rule === 'dob') {
      ok = isValidDateString(value);
    }

    input.classList.toggle('invalid', !ok);
    const error = input.parentElement.querySelector('.error-text');
    if (error) {
      error.textContent = getErrorMessage(rule, input.id);
      error.classList.toggle('visible', !ok);
    }

    return ok;
  }

  function getErrorMessage(rule, fieldId) {
    if (rule === 'email') return 'Informe um e-mail válido com @.';
    if (rule === 'phone') return 'Use o formato (DD) 91234-5678 ou (DD) 1234-5678.';
    if (rule === 'name') return 'Nome deve ter pelo menos 3 letras.';
    if (rule === 'address') return 'Endereço deve conter pelo menos 5 caracteres.';
    if (rule === 'dob') return 'Informe uma data válida.';
    return `${fieldId} inválido.`;
  }

  async function checkServer(){
    try{
      const res = await fetch('/api/ping');
      serverAvailable = res.ok;
    }catch(e){ serverAvailable = false }
  }

  function randomPatientNumber(existing){
    for(let i=0;i<20;i++){
      const num = Math.floor(10000000 + Math.random()*90000000).toString();
      const id = 'P' + num;
      if(!existing.has(id)) return id;
    }
    return 'P' + Date.now();
  }

  function nextQueueNumber(existingNumbers){
    const numbers = existingNumbers.filter(v => /^Q\d{3,}$/.test(v));
    const currentMax = numbers.reduce((max, value) => {
      const n = Number(value.replace(/^Q/, ''));
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    return `Q${String(currentMax + 1).padStart(3, '0')}`;
  }

  function readLocalPatients(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){ return []; }
  }

  function writeLocalPatients(list){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function readLocalAppointments(){
    try{ return JSON.parse(localStorage.getItem(APPOINTMENTS_KEY) || '[]'); }catch(e){ return []; }
  }

  function writeLocalAppointments(list){
    localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(list));
  }

  function readLocalDoctors(){
    try {
      const saved = JSON.parse(localStorage.getItem(DOCTORS_KEY) || 'null');
      const defaultDoctors = [...DEFAULT_DOCTOR_SCHEDULES];
      const byName = new Map(defaultDoctors.map(doctor => [String(doctor.name).toLowerCase(), { ...doctor }]));

      if (Array.isArray(saved)) {
        saved.forEach(doctor => {
          if (!doctor || !doctor.name) return;
          const key = String(doctor.name).toLowerCase();
          const existing = byName.get(key);
          if (existing) {
            byName.set(key, {
              ...existing,
              ...doctor,
              days: Array.isArray(doctor.days) && doctor.days.length ? doctor.days : existing.days,
              specialty: doctor.specialty || existing.specialty,
              startTime: doctor.startTime || existing.startTime,
              endTime: doctor.endTime || existing.endTime
            });
          } else {
            byName.set(key, {
              ...doctor,
              days: Array.isArray(doctor.days) ? doctor.days : []
            });
          }
        });
      }

      const finalDoctors = defaultDoctors.map(doctor => byName.get(String(doctor.name).toLowerCase()) || { ...doctor });
      const extraDoctors = [...byName.values()].filter(doctor => !defaultDoctors.some(item => String(item.name).toLowerCase() === String(doctor.name).toLowerCase()));
      finalDoctors.push(...extraDoctors);

      const nextValue = JSON.stringify(finalDoctors);
      if (localStorage.getItem(DOCTORS_KEY) !== nextValue) {
        localStorage.setItem(DOCTORS_KEY, nextValue);
      }
      return finalDoctors;
    } catch (e) {
      const fallback = [...DEFAULT_DOCTOR_SCHEDULES];
      try { localStorage.setItem(DOCTORS_KEY, JSON.stringify(fallback)); } catch (error) { /* ignore */ }
      return fallback;
    }
  }

  function writeLocalDoctors(list){
    localStorage.setItem(DOCTORS_KEY, JSON.stringify(list));
  }

  function weekdayNameFromDate(dateString){
    const match = String(dateString || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return '';
    const [, day, month, year] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (Number.isNaN(date.getTime())) return '';
    return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
  }

  function formatDateForDisplay(date){
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function getDoctorAvailableDates(doctorName, maxDays = 60){
    const doctors = doctorsCatalog.length ? doctorsCatalog : readLocalDoctors();
    const doctor = doctors.find(item => item.name === doctorName);
    if (!doctor || !Array.isArray(doctor.days) || !doctor.days.length) return [];

    const scheduledDays = new Set(doctor.days.map(day => String(day).trim()));
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let offset = 0; offset <= maxDays; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const weekday = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
      if (scheduledDays.has(weekday)) {
        dates.push(formatDateForDisplay(date));
      }
    }

    return dates;
  }

  function isDoctorAvailableOnDate(doctorName, dateString){
    const doctors = doctorsCatalog.length ? doctorsCatalog : readLocalDoctors();
    const doctor = doctors.find(item => item.name === doctorName);
    if (!doctor) return false;
    if (!dateString) return true;
    const weekday = weekdayNameFromDate(dateString);
    return Array.isArray(doctor.days) ? doctor.days.includes(weekday) : false;
  }

  function getAvailableDoctorsForSpecialty(specialty, dateString){
    const doctors = doctorsCatalog.length ? doctorsCatalog : readLocalDoctors();
    return doctors.filter(doctor =>
      doctor.specialty === specialty && (!dateString || isDoctorAvailableOnDate(doctor.name, dateString))
    );
  }

  function getDoctorRoom(doctorName){
    const doctors = doctorsCatalog.length ? doctorsCatalog : readLocalDoctors();
    const doctor = doctors.find(item => item.name === doctorName);
    return (doctor && doctor.room) || DOCTOR_ROOM_MAP[doctorName] || '';
  }

  async function loadDoctors(){
    if (serverAvailable) {
      try {
        const res = await fetch('/api/doctors');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            const localDoctors = readLocalDoctors();
            const localByName = new Map(localDoctors.map(item => [String(item.name).toLowerCase(), item]));
            const merged = data.map(item => ({
              ...(localByName.get(String(item.name).toLowerCase()) || {}),
              ...item,
              room: item.room || localByName.get(String(item.name).toLowerCase())?.room || DOCTOR_ROOM_MAP[item.name] || ''
            }));
            const serverNames = new Set(merged.map(item => String(item.name).toLowerCase()));
            merged.push(...localDoctors.filter(item => !serverNames.has(String(item.name).toLowerCase())));
            doctorsCatalog = merged;
            writeLocalDoctors(merged);
            return merged;
          }
        }
      } catch (e) {
        // fallback local
      }
    }
    doctorsCatalog = readLocalDoctors();
    return doctorsCatalog;
  }

  async function saveDoctor(doctor){
    if (serverAvailable) {
      try {
        const response = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(doctor)
        });
        if (response.ok) {
          const result = await response.json();
          doctorsCatalog = doctorsCatalog.filter(item => item.name.toLowerCase() !== doctor.name.toLowerCase());
          doctorsCatalog.push(result.doctor || doctor);
          writeLocalDoctors(doctorsCatalog);
          return result;
        }
        let details = 'Não foi possível salvar o médico.';
        try { details = (await response.json()).error || details; } catch (error) { /* use default */ }
        throw new Error(details);
      } catch (e) {
        if (e instanceof Error && e.message !== 'Failed to fetch') throw e;
        // fallback local when the server is unavailable
      }
    }

    const list = readLocalDoctors();
    const index = list.findIndex(item => item.name.toLowerCase() === doctor.name.toLowerCase());
    if (index >= 0) {
      list[index] = { ...list[index], ...doctor };
    } else {
      list.push({ id: doctor.id || String(Date.now()), ...doctor });
    }
    writeLocalDoctors(list);
    doctorsCatalog = list;
    return { ok: true, doctor: list[index >= 0 ? index : list.length - 1] };
  }

  async function loadPatients(){
    if(serverAvailable){
      try{
        const res = await fetch('/api/patients');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data;
        }
      }catch(e){ /* fallthrough */ }
    }
    return readLocalPatients();
  }

  async function savePatient(patient){
    if(serverAvailable){
      try{ await fetch('/api/patients',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(patient)}); return; }catch(e){ /* fallback */ }
    }
    const list = readLocalPatients();
    const index = list.findIndex(item => item.id === patient.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...patient };
    } else {
      list.unshift(patient);
    }
    writeLocalPatients(list);
  }

  async function renderTable(){
    const list = await loadPatients();
    const tableBodies = [patientsTableBody, dashboardPatientsTableBody].filter(Boolean);
    tableBodies.forEach(body => { body.innerHTML = ''; });
    list.forEach(p => {
      tableBodies.forEach(body => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.id}</td><td>${p.name}</td><td>${p.dob||''}</td><td>${p.priority||''}</td><td>${p.phone||p.email||''}</td>`;
        tr.addEventListener('click', ()=> showPatientDetails(p));
        body.appendChild(tr);
      });
    });
  }

  function showPatientDetails(p){
    alert(`ID: ${p.id}\nSenha: ${p.queueNumber || '—'}\nNome: ${p.name}\nData de nascimento: ${p.dob || ''}\nTelefone: ${p.phone || ''}\nE-mail: ${p.email||''}\nConvênio: ${p.insurance||''}\nPrioridade: ${p.priority||''}\nSala: ${p.room||''}\nObservações: ${p.notes||''}`);
  }

  document.getElementById('phone').addEventListener('input', (event) => {
    event.target.value = applyPhoneMask(event.target.value);
  });

  document.getElementById('dob').addEventListener('input', (event) => {
    event.target.value = applyDateMask(event.target.value);
  });

  const apptDoctor = document.getElementById('apptDoctor');
  const apptSpecialty = document.getElementById('apptSpecialty');
  const apptDate = document.getElementById('apptDate');
  const apptTime = document.getElementById('apptTime');
  const apptDurationLabel = document.getElementById('apptDurationLabel');

  document.getElementById('apptDob').addEventListener('input', (event) => {
    event.target.value = applyDateMask(event.target.value);
  });

  document.getElementById('apptPhone').addEventListener('input', (event) => {
    event.target.value = applyPhoneMask(event.target.value);
  });

  ['name', 'email', 'phone', 'address', 'dob'].forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    const rule = fieldId === 'phone' ? 'phone' : fieldId === 'email' ? 'email' : fieldId === 'name' ? 'name' : fieldId === 'address' ? 'address' : 'dob';

    input.addEventListener('blur', () => validateField(input, rule));
    input.addEventListener('input', () => {
      if (input.classList.contains('invalid')) validateField(input, rule);
    });

    const error = document.createElement('div');
    error.className = 'error-text';
    input.parentElement.appendChild(error);
  });

  await checkServer();
  await loadDoctors();

  const prioritySelect = document.getElementById('priority');
  const registrationDoctorField = document.querySelector('.emergency-doctor-field');
  const registrationDoctorSelect = document.getElementById('registrationDoctor');
  const emergencyDoctors = doctorsCatalog.filter(doctor => doctor.specialty === 'Emergencista');
  emergencyDoctors.forEach(doctor => {
    const option = document.createElement('option');
    option.value = doctor.name;
    option.textContent = doctor.name;
    registrationDoctorSelect.appendChild(option);
  });
  const updateEmergencyDoctorField = () => {
    const needsEmergencyDoctor = prioritySelect.value === 'Urgente' || prioritySelect.value === 'Emergência';
    registrationDoctorField.classList.toggle('hidden', !needsEmergencyDoctor);
    registrationDoctorSelect.required = needsEmergencyDoctor;
    if (!needsEmergencyDoctor) registrationDoctorSelect.value = '';
  };
  prioritySelect.addEventListener('change', updateEmergencyDoctorField);
  updateEmergencyDoctorField();

  generateBtn.addEventListener('click', async ()=>{
    const list = await loadPatients();
    const existingIds = new Set(list.map(p=>p.id));
    const nextId = randomPatientNumber(existingIds);
    const existingQueue = list.map(p => p.queueNumber).filter(Boolean);
    const nextQueue = nextQueueNumber(existingQueue);
    patientIdEl.textContent = nextId;
    queueNumberEl.textContent = nextQueue;
  });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const formData = new FormData(form);
    const patientName = normalizeText(formData.get('name') || '');
    const patientDob = formData.get('dob');
    const normalizedDob = patientDob ? applyDateMask(patientDob) : '';
    const patientGender = formData.get('gender');
    const patientPhone = normalizeText(formData.get('phone') || '');
    const patientEmail = normalizeText(formData.get('email') || '');
    const patientInsurance = normalizeText(formData.get('insurance') || '');
    const patientAddress = normalizeText(formData.get('address') || '');
    const patientPriority = formData.get('priority') || 'Normal';
    const patientDoctor = formData.get('registrationDoctor') || '';
    const patientNotes = normalizeText(formData.get('notes') || '');

    const isValid = [
      validateField(document.getElementById('name'), 'name'),
      validateField(document.getElementById('dob'), 'dob'),
      validateField(document.getElementById('phone'), 'phone'),
      validateField(document.getElementById('email'), 'email'),
      validateField(document.getElementById('address'), 'address')
    ].every(Boolean);

    if (!patientGender) {
      alert('Selecione o gênero do paciente.');
      return;
    }

    if (!patientInsurance) {
      alert('Selecione o convênio do paciente.');
      return;
    }

    if ((patientPriority === 'Urgente' || patientPriority === 'Emergência') && !patientDoctor) {
      alert('Selecione o médico Emergencista responsável.');
      return;
    }

    if (!isValid || !patientName || !normalizedDob || !patientPhone || !patientEmail || !patientAddress) {
      alert('Preencha todos os campos obrigatórios corretamente antes de salvar.');
      return;
    }

    const list = await loadPatients();
    const existingIds = new Set(list.map(p=>p.id));
    const id = patientIdEl.textContent === '—' ? randomPatientNumber(existingIds) : patientIdEl.textContent;
    const existingQueue = list.map(p => p.queueNumber).filter(Boolean);
    const queueNumber = queueNumberEl.textContent === '—' ? nextQueueNumber(existingQueue) : queueNumberEl.textContent;

    const patient = {
      id,
      queueNumber,
      name: patientName,
      dob: normalizedDob,
      gender: patientGender,
      phone: patientPhone,
      email: patientEmail,
      insurance: patientInsurance,
      address: patientAddress,
      priority: patientPriority,
      doctor: patientDoctor,
      specialty: patientDoctor ? 'Emergencista' : '',
      room: patientDoctor ? DOCTOR_ROOM_MAP[patientDoctor] || '' : '',
      notes: patientNotes,
      source: 'registration',
      createdAt: new Date().toISOString(),
      status: 'waiting'
    };

    await savePatient(patient);
    await renderTable();
    form.reset();
    patientIdEl.textContent = '—';
    queueNumberEl.textContent = '—';
    document.getElementById('name').focus();
    alert(`Paciente salvo com sucesso. Senha: ${queueNumber}`);
  });

  exportBtn.addEventListener('click', async ()=>{
    const list = await loadPatients();
    if(!list.length){ alert('Nenhum paciente para exportar'); return }
    const headers = ['id','queueNumber','name','dob','gender','phone','email','insurance','address','priority','notes','createdAt'];
    const rows = list.map(p => headers.map(h=>`"${String(p[h]||'').replace(/"/g,'""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pacientes.csv'; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  clearBtn.addEventListener('click', async ()=>{
    if (!requireLevel(3)) return;
    if(confirm('Apagar todos os pacientes salvos?')){
      if(serverAvailable){
        alert('Limpeza remota ainda não implementada. Você pode apagar manualmente no banco de dados.');
      }
      localStorage.removeItem(STORAGE_KEY);
      await renderTable();
    }
  });

  await renderTable();

  const navButtons = document.querySelectorAll('.topnav button');
  const VIEW_LEVELS = {
    register: 2,
    queue: 2,
    'in-progress': 2,
    search: 1,
    appointments: 2,
    doctors: 1,
    dashboard: 1,
    callpanel: 1
  };

  function applyAccessRules(){
    const level = currentUser ? currentUser.level : 0;
    navButtons.forEach(button => {
      button.classList.toggle('hidden', level < (VIEW_LEVELS[button.dataset.view] || 99));
    });
    const adminOnly = document.querySelectorAll('.admin-only');
    adminOnly.forEach(element => element.classList.toggle('hidden', level < 3));
    clearBtn.classList.toggle('hidden', level < 3);
    const doctorFormWrap = document.querySelector('.doctor-form-wrap');
    if (doctorFormWrap) doctorFormWrap.classList.toggle('hidden', level < 3);
  }

  function showView(name){
    if (!requireLevel(VIEW_LEVELS[name] || 99)) return;
    document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
    document.querySelectorAll('.topnav button').forEach(b=>b.classList.remove('active'));
    const btn = document.querySelector(`.topnav button[data-view="${name}"]`);
    if(btn) btn.classList.add('active');
    const el = document.getElementById('view-' + name);
    if(el) el.classList.remove('hidden');
    if (name === 'doctors') {
      renderDoctors();
    }
  }
  navButtons.forEach(b=>b.addEventListener('click', ()=> showView(b.dataset.view)));

  const urgentQueueListEl = document.getElementById('urgentQueueList');
  const scheduledQueueListEl = document.getElementById('scheduledQueueList');
  const inProgressListEl = document.getElementById('inProgressList');
  const callBtn = document.getElementById('callBtn');
  const finishBtn = document.getElementById('finishBtn');
  const callRoomInput = document.getElementById('callRoom');
  let selectedTicket = null;

  async function renderQueue(){
    urgentQueueListEl.innerHTML = '';
    scheduledQueueListEl.innerHTML = '';
    const list = await loadPatients();
    const waiting = list.filter(p => p.status === 'waiting').sort((a, b) => {
      const priorityOrder = { 'Emergência': 1, 'Urgente': 2, 'Normal': 3 };
      return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    });

    const renderSection = (target, patients, emptyMessage) => {
      if (!patients.length) {
        target.innerHTML = `<div class="muted">${emptyMessage}</div>`;
        return;
      }
      patients.forEach(item=>{
      const div = document.createElement('div');
      div.className = 'ticket';
      const removeButton = hasLevel(3) ? '<button type="button" class="danger remove-patient-btn">Remover</button>' : '';
      div.innerHTML = `<div><span class="dot priority-${item.priority || 'Normal'}"></span><span class="id">${item.queueNumber || '—'}</span></div><div class="meta">${item.name} — ${item.specialty || 'Clínica Geral'}${item.doctor ? ` — ${item.doctor}` : ''} — ${item.room || 'Sala a definir'}</div>${removeButton}`;
      div.addEventListener('click', ()=>{
        selectedTicket = item;
        callRoomInput.value = item.room || getDoctorRoom(item.doctor);
        document.querySelectorAll('.ticket').forEach(t=>t.classList.remove('selected'));
        div.classList.add('selected');
      });
      const removePatientButton = div.querySelector('.remove-patient-btn');
      if (removePatientButton) removePatientButton.addEventListener('click', event => {
          event.stopPropagation();
          removePatient(item.id);
        });
      target.appendChild(div);
      });
    };

    renderSection(
      urgentQueueListEl,
      waiting.filter(item => item.source !== 'appointment'),
      'Nenhum paciente do Registro aguardando.'
    );
    renderSection(
      scheduledQueueListEl,
      waiting.filter(item => item.source === 'appointment'),
      'Nenhum paciente agendado aguardando.'
    );
  }

  async function removePatient(patientId){
    if (!requireLevel(3)) return;
    if (!confirm('Remover este paciente da fila?')) return;
    if (serverAvailable) {
      const response = await fetch(`/api/patients/${encodeURIComponent(patientId)}`, { method: 'DELETE' });
      if (!response.ok) {
        let details = 'Não foi possível remover o paciente.';
        try { details = (await response.json()).error || details; } catch (error) { /* use default */ }
        throw new Error(details);
      }
    }
    writeLocalPatients(readLocalPatients().filter(item => String(item.id) !== String(patientId)));
    if (selectedTicket && String(selectedTicket.id) === String(patientId)) selectedTicket = null;
    await renderQueue();
    await renderDashboard();
  }

  async function finishPatient(patientId){
    const patients = await loadPatients();
    const patient = patients.find(item => item.id === patientId);
    if (!patient) {
      alert('Paciente não encontrado.');
      return;
    }

    patient.status = 'finished';
    patient.finishedAt = new Date().toISOString();
    await savePatient(patient);
    if (selectedTicket && selectedTicket.id === patientId) selectedTicket = null;
    await renderQueue();
    await renderInProgress();
    await renderDashboard();
    await renderCallPanel();
    alert(`Atendimento finalizado: ${patient.queueNumber || patient.id} - ${patient.name}`);
  }

  async function renderInProgress(){
    const patients = await loadPatients();
    const inService = patients
      .filter(patient => patient.status === 'in_service')
      .sort((a, b) => new Date(b.calledAt || 0) - new Date(a.calledAt || 0));

    inProgressListEl.innerHTML = '';
    if (!inService.length) {
      inProgressListEl.innerHTML = '<div class="muted">Nenhum paciente em atendimento.</div>';
      return;
    }

    inService.forEach(patient => {
      const item = document.createElement('div');
      item.className = 'ticket in-progress-ticket';
      item.innerHTML = `<div><span class="id">${patient.queueNumber || patient.id}</span></div><div class="meta">${patient.name} — ${patient.specialty || 'Especialidade não informada'}${patient.doctor ? ` — ${patient.doctor}` : ''} — ${patient.room || 'Sala a definir'}</div><button type="button" class="primary">Finalizar atendimento</button>`;
      item.querySelector('button').addEventListener('click', () => finishPatient(patient.id));
      inProgressListEl.appendChild(item);
    });
  }

  callBtn.addEventListener('click', async ()=>{
    if(!selectedTicket){ alert('Selecione uma senha da fila para chamar'); return }
    const room = callRoomInput.value.trim();
    if (!room) {
      alert('Informe o número da sala antes de chamar o paciente.');
      callRoomInput.focus();
      return;
    }
    const patients = await loadPatients();
    const currentPatient = patients.find(p => p.id === selectedTicket.id);
    if (!currentPatient) {
      alert('Paciente não encontrado.');
      return;
    }

    currentPatient.status = 'in_service';
    currentPatient.calledAt = new Date().toISOString();
    currentPatient.doctor = currentPatient.doctor || selectedTicket.doctor || '';
    currentPatient.room = room;
    await savePatient(currentPatient);
    await renderQueue();
    await renderInProgress();
    await renderCallPanel();
    await renderDashboard();
    alert('Paciente chamado: ' + currentPatient.queueNumber + ' - ' + currentPatient.name);
  });

  finishBtn.addEventListener('click', async ()=>{
    if(!selectedTicket){ alert('Selecione uma senha para finalizar'); return }
    const patients = await loadPatients();
    const currentPatient = patients.find(p => p.id === selectedTicket.id);
    if (!currentPatient) {
      alert('Paciente não encontrado.');
      return;
    }

    await finishPatient(currentPatient.id);
  });

  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  let searchTimer = null;
  searchInput.addEventListener('input', ()=>{
    clearTimeout(searchTimer); searchTimer = setTimeout(doSearch, 350);
  });

  async function doSearch(){
    const q = searchInput.value.trim();
    if(!q){ searchResults.innerHTML = ''; return }
    const rows = (await loadPatients()).filter(p => [p.id, p.name, p.phone, p.email, p.dob].some(value => String(value || '').toLowerCase().includes(q.toLowerCase())));
    if(!rows.length){ searchResults.innerHTML = '<div class="muted">Nenhum resultado</div>'; return }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>ID</th><th>Nome</th><th>Contato</th><th>Prioridade</th></tr></thead>';
    const tb = document.createElement('tbody');
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.id}</td><td>${r.name}</td><td>${r.phone||r.email||''}</td><td>${r.priority||''}</td>`;
      tr.addEventListener('click', ()=> showPatientDetails(r));
      tb.appendChild(tr);
    });
    table.appendChild(tb); searchResults.innerHTML=''; searchResults.appendChild(table);
  }

  const doctorForm = document.getElementById('doctorForm');
  const doctorList = document.getElementById('doctorList');
  const resetDoctorFormBtn = document.getElementById('resetDoctorForm');

  async function renderDoctors(){
    const doctors = await loadDoctors();
    const finalDoctors = Array.isArray(doctors) && doctors.length ? doctors : readLocalDoctors();
    if (!doctorList) return;
    doctorList.innerHTML = '';

    if (!finalDoctors.length) {
      doctorList.innerHTML = '<div class="muted">Nenhum médico cadastrado.</div>';
      return;
    }

    finalDoctors.forEach(doctor => {
      const item = document.createElement('div');
      item.className = 'doctor-card';
      item.innerHTML = `
        <h4>${doctor.name}</h4>
        <div class="doctor-meta">
          <div><strong>Especialidade:</strong> ${doctor.specialty}</div>
          <div><strong>Dias:</strong> ${(doctor.days || []).join(', ') || '—'}</div>
          <div><strong>Horário:</strong> ${doctor.startTime || '—'} às ${doctor.endTime || '—'}</div>
          <div><strong>Sala:</strong> ${doctor.room || DOCTOR_ROOM_MAP[doctor.name] || '—'}</div>
        </div>
        ${hasLevel(3) ? '<button type="button" class="danger remove-doctor-btn">Remover médico</button>' : ''}
      `;
      const removeDoctorButton = item.querySelector('.remove-doctor-btn');
      if (removeDoctorButton) removeDoctorButton.addEventListener('click', () => removeDoctor(doctor));
      doctorList.appendChild(item);
    });
  }

  doctorForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireLevel(3)) return;
    const name = document.getElementById('doctorName').value.trim();
    const specialty = document.getElementById('doctorSpecialty').value;
    const selectedDays = [...document.querySelectorAll('input[name="doctorDays"]:checked')].map(item => item.value);
    const startTime = document.getElementById('doctorStartTime').value;
    const endTime = document.getElementById('doctorEndTime').value;
    const room = document.getElementById('doctorRoom').value.trim();

    if (!name || !specialty || !selectedDays.length || !startTime || !endTime || !room) {
      alert('Preencha o nome, especialidade, dias, horários e sala do médico.');
      return;
    }

    if (timeToMinutes(startTime) === null || timeToMinutes(endTime) === null) {
      alert('Informe horários válidos no formato HH:MM.');
      return;
    }

    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      alert('O horário final deve ser maior que o inicial.');
      return;
    }

    const doctor = {
      name,
      specialty,
      days: selectedDays,
      startTime,
      endTime,
      room
    };

    await saveDoctor(doctor);
    await renderDoctors();
    doctorForm.reset();
    alert(`Médico salvo com sucesso: ${name}`);
  });

  resetDoctorFormBtn.addEventListener('click', () => doctorForm.reset());

  async function removeDoctor(doctor){
    if (!requireLevel(3) || !confirm(`Remover o médico ${doctor.name}?`)) return;
    if (serverAvailable && doctor.id) {
      const response = await fetch(`/api/doctors/${encodeURIComponent(doctor.id)}`, { method: 'DELETE' });
      if (!response.ok) {
        let details = 'Não foi possível remover o médico.';
        try { details = (await response.json()).error || details; } catch (error) { /* use default */ }
        throw new Error(details);
      }
    }
    doctorsCatalog = doctorsCatalog.filter(item => String(item.name).toLowerCase() !== String(doctor.name).toLowerCase());
    writeLocalDoctors(doctorsCatalog);
    await renderDoctors();
    await refreshDoctorOptions();
  }

  const apptForm = document.getElementById('apptForm');
  const agendaDay = document.getElementById('agendaDay');

  async function refreshDoctorOptions(){
    const specialty = apptSpecialty.value;
    const selectedDoctor = apptDoctor.value;

    apptDoctor.innerHTML = '<option value="">Selecione o médico</option>';
    apptDate.innerHTML = '<option value="">Selecione o médico primeiro</option>';
    apptTime.innerHTML = '<option value="">Selecione médico e data</option>';
    apptDate.disabled = true;
    apptTime.disabled = true;
    apptDurationLabel.textContent = '';

    if (!specialty) {
      apptDoctor.disabled = true;
      return;
    }

    const doctors = getAvailableDoctorsForSpecialty(specialty, '');
    if (!doctors.length) {
      apptDoctor.innerHTML = '<option value="">Nenhum médico disponível para esta especialidade</option>';
      apptDoctor.disabled = true;
      return;
    }

    doctors.forEach(doctor => {
      const option = document.createElement('option');
      option.value = doctor.name;
      option.textContent = doctor.name;
      apptDoctor.appendChild(option);
    });

    apptDoctor.disabled = false;
    if (selectedDoctor && doctors.some(doc => doc.name === selectedDoctor)) {
      apptDoctor.value = selectedDoctor;
    }
  }

  async function refreshAppointmentDates(){
    const doctor = apptDoctor.value;
    const selectedDate = apptDate.value;
    apptDate.innerHTML = '<option value="">Selecione a data</option>';
    apptTime.innerHTML = '<option value="">Selecione médico e data</option>';
    apptTime.disabled = true;
    apptDate.disabled = true;

    if (!doctor) {
      return;
    }

    const dates = getDoctorAvailableDates(doctor, 90);
    if (!dates.length) {
      apptDate.innerHTML = '<option value="">Nenhuma data disponível para este médico</option>';
      return;
    }

    dates.forEach(date => {
      const option = document.createElement('option');
      option.value = date;
      option.textContent = date;
      apptDate.appendChild(option);
    });

    apptDate.disabled = false;
    if (selectedDate && dates.includes(selectedDate)) {
      apptDate.value = selectedDate;
    }
  }

  async function refreshAppointmentTimes(){
    const specialty = apptSpecialty.value;
    const doctor = apptDoctor.value;
    const dateKey = dateInputToKey(apptDate.value);
    const duration = SPECIALTY_DURATION[specialty];
    apptTime.innerHTML = '<option value="">Selecione um horário</option>';
    if (!specialty || !doctor || !dateKey || !duration || !isDoctorAvailableOnDate(doctor, apptDate.value)) {
      apptTime.disabled = true;
      apptDurationLabel.textContent = duration ? `(${duration} min)` : '';
      return;
    }

    apptTime.disabled = false;
    apptDurationLabel.textContent = duration ? `(${duration} min)` : '';

    const appointments = await loadAppointments();
    const occupied = new Set(appointments
      .filter(item => item.doctor === doctor && item.datetime && localDateKey(new Date(item.datetime)) === dateKey)
      .map(item => formatSlotTime(new Date(item.datetime).getHours() * 60 + new Date(item.datetime).getMinutes())));

    const doctors = doctorsCatalog.length ? doctorsCatalog : readLocalDoctors();
    const doctorConfig = doctors.find(item => item.name === doctor);
    const workStart = doctorConfig ? timeToMinutes(doctorConfig.startTime) : 8 * 60;
    const workEnd = doctorConfig ? timeToMinutes(doctorConfig.endTime) : 18 * 60;

    for (let start = workStart; start + duration <= workEnd; start += duration + 5) {
      const value = formatSlotTime(start);
      const option = document.createElement('option');
      option.value = value;
      option.textContent = occupied.has(value) ? `${value} (ocupado)` : value;
      option.disabled = occupied.has(value);
      apptTime.appendChild(option);
    }
  }

  if (apptDoctor && apptSpecialty) {
    apptSpecialty.addEventListener('change', async () => {
      await refreshDoctorOptions();
      await refreshAppointmentDates();
      await refreshAppointmentTimes();
    });
  }

  apptDoctor.addEventListener('change', async () => {
    await refreshAppointmentDates();
    await refreshAppointmentTimes();
  });
  apptDate.addEventListener('change', refreshAppointmentTimes);

  apptForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const dateValue = apptDate.value.trim();
    const timeValue = apptTime.value;
    const patientName = document.getElementById('apptPatientName').value.trim();
    const selectedDoctor = document.getElementById('apptDoctor').value;
    const selectedSpecialty = document.getElementById('apptSpecialty').value;
    const chosenDate = dateInputToKey(dateValue);

    if (selectedDoctor && !isDoctorAvailableOnDate(selectedDoctor, dateValue)) {
      alert('Este médico não atua no dia selecionado para a consulta. Escolha outro médico ou outra data.');
      return;
    }

    const a = {
      id: Date.now(),
      patientId: document.getElementById('apptPatientId').value.trim() || `A${Date.now()}`,
      patientName,
      patientDob: document.getElementById('apptDob').value.trim(),
      patientGender: document.getElementById('apptGender').value,
      patientPhone: document.getElementById('apptPhone').value.trim(),
      patientEmail: document.getElementById('apptEmail').value.trim(),
      patientInsurance: document.getElementById('apptInsurance').value,
      patientAddress: document.getElementById('apptAddress').value.trim(),
      patientPriority: 'Normal',
      patientNotes: document.getElementById('apptNotes').value.trim(),
      doctor: selectedDoctor,
      specialty: selectedSpecialty,
      room: getDoctorRoom(selectedDoctor),
      datetime: normalizeAppointmentDateTime(`${dateValue} ${timeValue}`),
      arrivalTime: ''
    };
    if (!a.patientName || !a.patientDob || !a.patientGender || !a.patientPhone || !a.patientEmail || !a.patientInsurance || !a.patientAddress || !a.doctor || !a.specialty || !chosenDate || !timeValue || !a.datetime) {
      alert('Preencha todos os campos do agendamento.');
      return;
    }
    try {
      await saveAppointment(a);
      alert('Consulta agendada e salva com sucesso.');
      apptForm.reset();
      await refreshDoctorOptions();
      await renderAppointments();
    } catch (error) {
      alert(`Não foi possível salvar o agendamento: ${error.message}`);
    }
  });
  document.getElementById('cancelAppt').addEventListener('click', ()=> apptForm.reset());

  async function loadAppointments(){
    if(serverAvailable){
      try{
        const res = await fetch('/api/appointments');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) return data;
        }
      }catch(e){ /* fallthrough */ }
    }
    return readLocalAppointments();
  }

  async function saveAppointment(appointment){
    if(serverAvailable){
      const response = await fetch('/api/appointments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(appointment) });
      if (!response.ok) {
        let details = 'Não foi possível salvar o agendamento.';
        try { details = (await response.json()).error || details; } catch(e) { /* use default message */ }
        throw new Error(details);
      }
      return;
    }

    const list = readLocalAppointments();
    const index = list.findIndex(item => String(item.id) === String(appointment.id));
    if (index >= 0) list[index] = { ...list[index], ...appointment };
    else list.push(appointment);
    writeLocalAppointments(list);
  }

  async function removeAppointment(appointmentId){
    if (!requireLevel(3)) return;
    if (!confirm('Remover este agendamento?')) return;
    if (serverAvailable) {
      const response = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}`, { method: 'DELETE' });
      if (!response.ok) {
        let details = 'Não foi possível remover o agendamento.';
        try { details = (await response.json()).error || details; } catch (error) { /* use default */ }
        throw new Error(details);
      }
    }
    const list = readLocalAppointments().filter(item => String(item.id) !== String(appointmentId));
    writeLocalAppointments(list);
    await renderAppointments();
  }

  async function updateAppointment(appointment){
    const list = readLocalAppointments();
    const index = list.findIndex(item => String(item.id) === String(appointment.id));
    if (index >= 0) list[index] = { ...list[index], ...appointment };
    else list.push(appointment);
    writeLocalAppointments(list);
    if(serverAvailable){
      try { await fetch(`/api/appointments/${appointment.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(appointment) }); } catch(e) { /* local storage remains available */ }
    }
  }

  async function updateAppointmentArrivalTime(appointmentId, arrivalTimeValue){
    const appointment = (await loadAppointments()).find(item => String(item.id) === String(appointmentId));
    if (!appointment) return;
    appointment.arrivalTime = arrivalTimeValue || '';
    await updateAppointment(appointment);
  }

  async function sendAppointmentToQueue(appointmentId, arrivalTimeValue = ''){
    const appointment = (await loadAppointments()).find(item => String(item.id) === String(appointmentId));
    if (!appointment) { alert('Agendamento não encontrado.'); return; }
    if (appointment.status === 'queued') {
      alert('Este paciente já foi enviado para a fila.');
      return;
    }

    const arrivalMinutes = timeToMinutes(arrivalTimeValue);
    const appointmentMinutes = appointmentTimeToMinutes(appointment.datetime);
    if (arrivalMinutes === null) {
      alert('Informe a hora de chegada no formato HH:MM antes de enviar o paciente para a fila.');
      return;
    }
    if (appointmentMinutes === null || arrivalMinutes > appointmentMinutes) {
      alert('A hora de chegada deve ser menor ou igual ao horário da consulta.');
      return;
    }

    appointment.arrivalTime = arrivalTimeValue;
    appointment.room = appointment.room || getDoctorRoom(appointment.doctor);
    appointment.status = 'queued';
    await updateAppointment(appointment);

    const patientsList = await loadPatients();
    let patient = patientsList.find(item => item.id === appointment.patientId || String(item.name || '').toLowerCase() === String(appointment.patientName || '').toLowerCase());
    if (!patient) {
      patient = {
        id: appointment.patientId || randomPatientNumber(new Set(patientsList.map(item => item.id))),
        queueNumber: nextQueueNumber(patientsList.map(item => item.queueNumber).filter(Boolean)),
        name: appointment.patientName,
        dob: appointment.patientDob || '',
        gender: appointment.patientGender || '',
        phone: appointment.patientPhone || '',
        email: appointment.patientEmail || '',
        insurance: appointment.patientInsurance || 'Particular',
        address: appointment.patientAddress || '',
        priority: appointment.patientPriority || 'Normal',
        source: 'appointment',
        doctor: appointment.doctor,
        specialty: appointment.specialty,
        room: appointment.room,
        notes: appointment.patientNotes || 'Paciente enviado da agenda para fila',
        createdAt: new Date().toISOString(),
        status: 'waiting'
      };
    } else {
      patient.status = 'waiting';
      patient.source = 'appointment';
      patient.doctor = appointment.doctor;
      patient.specialty = appointment.specialty;
      patient.room = appointment.room;
      if (!patient.queueNumber) patient.queueNumber = nextQueueNumber(patientsList.map(item => item.queueNumber).filter(Boolean));
    }
    await savePatient(patient);
    await renderQueue();
    await renderDashboard();
    await renderAppointments();
    alert(`Paciente enviado para a fila: ${patient.queueNumber || patient.id} - ${patient.name}`);
  }

  async function renderAppointments(){
    try {
      const agendaTitle = document.getElementById('agendaTitle');
      if (agendaTitle) agendaTitle.textContent = 'Todos os agendamentos';
      const rows = (await loadAppointments()).filter(item => item.datetime).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
      if (!rows.length) { agendaDay.innerHTML = '<div class="muted">Nenhum agendamento salvo.</div>'; return; }
      const ul = document.createElement('ul');
      rows.forEach(r => {
        const li = document.createElement('li');
        const queuedLabel = r.status === 'queued' ? '<span class="status-badge queued">Já enviado à fila</span>' : '';
        const action = r.status === 'queued' ? '' : '<button type="button" class="primary send-queue-btn">Enviar para fila</button>';
        const removeAppointmentButton = hasLevel(3) ? '<button type="button" class="danger remove-appt-btn">Remover</button>' : '';
        li.innerHTML = `<div><strong>${r.patientName}</strong><br>${formatAppointmentDateTime(r.datetime)} — ${r.doctor} / ${r.specialty} — ${r.room || getDoctorRoom(r.doctor) || 'Sala a definir'} ${queuedLabel}</div><div class="appt-queue-actions"><label>Hora de chegada <input type="text" data-arrival-id="${r.id}" value="${r.arrivalTime || ''}" maxlength="5" inputmode="numeric" placeholder="HH:MM"></label>${action}${removeAppointmentButton}</div>`;
        const arrivalInput = li.querySelector('input');
        arrivalInput.addEventListener('input', event => { event.target.value = applyTimeMask(event.target.value); });
        arrivalInput.addEventListener('change', event => updateAppointmentArrivalTime(r.id, event.target.value.trim()));
        const sendButton = li.querySelector('.send-queue-btn');
        if (sendButton) sendButton.addEventListener('click', () => sendAppointmentToQueue(r.id, arrivalInput.value.trim()));
        const removeAppointmentButtonElement = li.querySelector('.remove-appt-btn');
        if (removeAppointmentButtonElement) removeAppointmentButtonElement.addEventListener('click', () => removeAppointment(r.id));
        ul.appendChild(li);
      });
      agendaDay.innerHTML = '';
      agendaDay.appendChild(ul);
    } catch(e) { agendaDay.innerHTML = '<div class="muted">Erro ao carregar agenda</div>'; }
  }

  let agendaDate = localDateKey();
  setInterval(async () => {
    const currentDate = localDateKey();
    if (currentDate !== agendaDate) {
      agendaDate = currentDate;
      await renderAppointments();
    }
  }, 30000);

  async function renderDashboard(){
    const patients = await loadPatients();
    const today = new Date().toISOString().slice(0,10);
    const patientsToday = patients.filter(p => p.createdAt && p.createdAt.slice(0,10) === today).length;
    const awaiting = patients.filter(p => p.status === 'waiting' || !p.status).length;
    const inService = patients.filter(p => p.status === 'in_service').length;
    const finished = patients.filter(p => p.status === 'finished').length;
    const emergencies = patients.filter(p => p.priority === 'Emergência').length;

    document.getElementById('cardToday').textContent = patientsToday;
    document.getElementById('cardAwaiting').textContent = awaiting;
    document.getElementById('cardInService').textContent = inService;
    document.getElementById('cardFinished').textContent = finished;
    document.getElementById('cardEmerg').textContent = emergencies;

  }

  async function renderCallPanel(){
    const patients = await loadPatients();
    const inService = patients.filter(p => p.status === 'in_service').sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt));
    const panelId = document.getElementById('panelId');
    const panelRoom = document.getElementById('panelRoom');
    const panelDoctor = document.getElementById('panelDoctor');
    const history = document.getElementById('callHistory');

    if (inService.length) {
      panelId.textContent = inService[0].queueNumber || inService[0].id;
      panelRoom.textContent = inService[0].room || '—';
      panelDoctor.textContent = inService[0].doctor || 'Não informado';
    } else {
      panelId.textContent = '—';
      panelRoom.textContent = '—';
      panelDoctor.textContent = '—';
    }

    history.innerHTML = '';
    patients.filter(p => p.calledAt).sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt)).slice(0, 8).forEach(p => {
      const d = document.createElement('div');
      d.textContent = `${p.queueNumber || p.id} — ${p.doctor || 'Médico não informado'} — ${p.room || '—'} — ${new Date(p.calledAt).toLocaleTimeString()}`;
      history.appendChild(d);
    });
  }

  await restoreSession();
  applyAccessRules();
  if (currentUser) {
    await loadDoctors();
    await renderTable();
    await renderQueue();
    await renderInProgress();
    await renderAppointments();
    await renderDashboard();
    await renderCallPanel();
    await renderDoctors();
    showView(currentUser.level >= 2 ? 'register' : 'search');
  }
})();
