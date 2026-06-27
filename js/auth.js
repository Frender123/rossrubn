/* =========================================================
   auth.js — Login simple con localStorage
   ========================================================= */

const USERS = [
  { username: 'admin',   password: '1234',   name: 'Administrador', role: 'admin' },
  { username: 'ruben',   password: 'molle',  name: 'Ruben',         role: 'user'  },
  { username: 'planif',  password: 'planif', name: 'Planificación', role: 'user'  },
];

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('obrasSession')); } catch { return null; }
}

function setSession(user) {
  sessionStorage.setItem('obrasSession', JSON.stringify(user));
}

function clearSession() {
  sessionStorage.removeItem('obrasSession');
}

/* ------- Guard: si estamos en app.html y no hay sesión, redirigir ------- */
(function guardRoute() {
  const isApp = window.location.pathname.endsWith('app.html');
  const isLogin = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
  const session = getSession();

  if (isApp && !session) {
    window.location.replace('index.html');
    return;
  }
  if (isLogin && session) {
    window.location.replace('app.html');
    return;
  }

  /* Poblar navbar si estamos en app */
  if (isApp && session) {
    const av = document.getElementById('navAvatar');
    const un = document.getElementById('navUsername');
    if (av) av.textContent = session.name.slice(0, 2).toUpperCase();
    if (un) un.textContent = session.name;
  }
})();

/* ------- Login ------- */
function doLogin() {
  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('loginError');
  const errorMsg = document.getElementById('loginErrorMsg');
  const btn      = document.getElementById('loginBtn');

  if (!username || !password) {
    showLoginError('Completa usuario y contraseña.');
    return;
  }

  btn.classList.add('loading');
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .8s linear infinite"></i> Verificando...';

  setTimeout(() => {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
      setSession({ username: user.username, name: user.name, role: user.role });
      window.location.replace('app.html');
    } else {
      btn.classList.remove('loading');
      btn.innerHTML = '<i class="ti ti-login"></i> Ingresar';
      showLoginError('Usuario o contraseña incorrectos.');
    }
  }, 600);
}

function showLoginError(msg) {
  const el  = document.getElementById('loginError');
  const msg2 = document.getElementById('loginErrorMsg');
  if (!el) return;
  msg2.textContent = msg;
  el.style.display = 'flex';
}

/* ------- Logout ------- */
function logout() {
  clearSession();
  window.location.replace('index.html');
}

/* ------- Toggle password ------- */
function togglePwd() {
  const inp  = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'ti ti-eye-off';
  } else {
    inp.type = 'password';
    icon.className = 'ti ti-eye';
  }
}

/* ------- Enter en campos de login ------- */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const btn = document.getElementById('loginBtn');
    if (btn) doLogin();
  }
});

/* ------- CSS spin para loader ------- */
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
