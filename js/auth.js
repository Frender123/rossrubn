/* ===================================================
   auth.js — Login / sesión / logout
   =================================================== */
const USERS = [
  { username: 'admin',  password: '1234',   name: 'Administrador', role: 'admin' },
  { username: 'ruben',  password: 'molle',  name: 'Ruben',         role: 'user'  },
  { username: 'planif', password: 'planif', name: 'Planificación', role: 'user'  },
];

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('obrasSession')); } catch { return null; }
}
function setSession(user) { sessionStorage.setItem('obrasSession', JSON.stringify(user)); }
function clearSession()   { sessionStorage.removeItem('obrasSession'); }

/* Guard de ruta */
(function() {
  const path    = window.location.pathname;
  const isApp   = path.endsWith('app.html');
  const isLogin = path.endsWith('index.html') || path.endsWith('/');
  const session = getSession();
  if (isApp   && !session) { window.location.replace('index.html'); return; }
  if (isLogin &&  session) { window.location.replace('app.html');   return; }
  if (isApp   &&  session) {
    const av = document.getElementById('navAvatar');
    const un = document.getElementById('navUsername');
    if (av) av.textContent = session.name.slice(0, 2).toUpperCase();
    if (un) un.textContent = session.name;
  }
})();

function doLogin() {
  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('loginBtn');
  if (!username || !password) { showLoginError('Completa usuario y contraseña.'); return; }
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
  }, 500);
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  const ms = document.getElementById('loginErrorMsg');
  if (!el) return;
  ms.textContent = msg;
  el.style.display = 'flex';
}

function logout() { clearSession(); window.location.replace('index.html'); }

function togglePwd() {
  const inp  = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  if (!inp) return;
  if (inp.type === 'password') { inp.type = 'text';     icon.className = 'ti ti-eye-off'; }
  else                         { inp.type = 'password'; icon.className = 'ti ti-eye';     }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginBtn')) doLogin();
});

const _s = document.createElement('style');
_s.textContent = '@keyframes spin{to{transform:rotate(360deg);}}';
document.head.appendChild(_s);
