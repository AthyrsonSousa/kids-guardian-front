const API_BASE_URL = 'https://kids-guardian.onrender.com/api';
let relatorioAtual = [];

// Utilitários DOM
const getEl = id => document.getElementById(id);
const showMessage = (id, msg, tipo = '') => {
  const el = getEl(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'message';
  if (tipo) el.classList.add(tipo);
  el.classList.add('active');
  setTimeout(() => {
    el.classList.remove('active');
    el.textContent = '';
  }, 5000);
};

// Refatorado para usar .hidden para consistência
const openModal = id => getEl(id)?.classList.remove('hidden');
const closeModal = id => getEl(id)?.classList.add('hidden');

async function makeApiRequest(endpoint, method, data = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : null,
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.clear();
      checkLoginStatus();
      showMessage('loginMessage', 'Sessão expirada. Faça login novamente.', 'error');
      return { success: false, message: 'Sessão expirada.' };
    }

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, message: errorData.message || 'Erro na requisição.' };
    }

    return response.json();
  } catch (error) {
    console.error('Erro na requisição da API:', error);
    return { success: false, message: 'Erro de conexão com o servidor.' };
  }
}

// Sessão
async function handleLogin(e) {
  e.preventDefault();
  const username = getEl('inputLoginUsuario').value;
  const password = getEl('inputLoginSenha').value;
  const res = await makeApiRequest('/login', 'POST', { username, password });

  if (res.success) {
    showMessage('loginMessage', res.message, 'success');
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    checkLoginStatus();
  } else {
    showMessage('loginMessage', res.message || 'Erro ao fazer login.', 'error');
  }
}

// Refatorado para usar a mesma lógica de checkLoginStatus para consistência
function logoutUsuario() {
  localStorage.clear();
  checkLoginStatus();
  showMessage('loginMessage', 'Sessão encerrada.', 'success');
}

function updateDashboardUI() {
  const userStr = localStorage.getItem('user');
  let user = null;

  try {
    user = JSON.parse(userStr);
  } catch (e) {
    console.error("Erro ao processar dados do usuário do localStorage.", e);
    user = null;
  }

  const loginSection = getEl('loginSection');
  const dashboardSection = getEl('dashboardSection');

  // Se os dados do usuário não puderem ser recuperados, exibe a tela de login
  if (!user || !user.nome || !user.tipo) {
      localStorage.clear();
      loginSection.classList.remove('hidden');
      dashboardSection.classList.add('hidden');
      return;
  }

  // Se os dados do usuário estiverem válidos, exibe o dashboard
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');

  getEl('displayUsuarioLogado').textContent = user.nome;
  getEl('displayCargoUsuario').textContent = user.tipo.charAt(0).toUpperCase() + user.tipo.slice(1);

  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user.tipo === 'administrador' ? 'block' : 'none';
  });

  carregarDadosDashboard();
}

function checkLoginStatus() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  const loginSection = getEl('loginSection');
  const dashboardSection = getEl('dashboardSection');

  // Adicionado: Oculta todos os modais no início para garantir o estado correto
  closeModal('modalCadastroCrianca');
  closeModal('modalGerenciarUsuarios');
  closeModal('modalRelatorio');

  if (token && user) {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    updateDashboardUI();
  } else {
    localStorage.clear();
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
  }
}

// Dashboard
async function carregarDadosDashboard() {
  await carregarListaCheckin();
  await carregarListaCheckout();
  await carregarEstatisticas();
}

// Crianças
async function cadastrarCrianca(e) {
  e.preventDefault();

  const data = {
    nome: getEl('inputCriancaNome').value,
    nome_responsavel: getEl('inputCriancaResponsavel').value,
    numero_responsavel: getEl('inputCriancaNumero').value,
    idade: parseInt(getEl('inputCriancaIdade').value),
    sala: parseInt(getEl('inputCriancaSala').value),
    observacoes: getEl('inputCriancaObs').value
  };

  const res = await makeApiRequest('/criancas/cadastrar', 'POST', data);
  showMessage('messageCadastroCrianca', res.message || 'Erro ao cadastrar.', res.success ? 'success' : 'error');

  if (res.success) {
    getEl('formCadastroCrianca').reset();
    closeModal('modalCadastroCrianca');
    carregarDadosDashboard();
  }
}

async function carregarListaCheckin() {
  const lista = getEl('listaCheckin');
  if (!lista) return;
  lista.innerHTML = '<li>Carregando...</li>';
  try {
    const res = await makeApiRequest('/criancas/checkin', 'GET');
    lista.innerHTML = '';
    if (res.success && res.criancas.length) {
      res.criancas.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${c.nome} (Sala ${c.sala})</span>
          <div class="crianca-actions">
            <button class="btn btn-checkin btn-small" data-id="${c.id}">Check-in</button>
            <button class="btn btn-danger btn-small" data-id="${c.id}" data-remover>Desativar</button>
          </div>`;
        lista.appendChild(li);
      });
    } else {
      lista.innerHTML = '<li>Nenhuma criança encontrada para check-in.</li>';
    }
  } catch {
    lista.innerHTML = '<li>Erro ao carregar lista para check-in.</li>';
  }
}

async function carregarListaCheckout() {
  const lista = getEl('listaCheckout');
  if (!lista) return;
  lista.innerHTML = '<li>Carregando...</li>';
  try {
    const res = await makeApiRequest(`/criancas/checkout?ts=${Date.now()}`, 'GET');
    lista.innerHTML = '';
    if (res.success && res.criancas.length) {
      res.criancas.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${c.nome} (Sala ${c.sala})</span>
          <div class="crianca-actions">
            <button class="btn btn-checkout btn-small" data-id="${c.id}">Check-out</button>
          </div>`;
        lista.appendChild(li);
      });
    } else {
      lista.innerHTML = '<li>Nenhuma criança encontrada para check-out.</li>';
    }
  } catch {
    lista.innerHTML = '<li>Erro ao carregar lista para check-out.</li>';
  }
}

async function carregarEstatisticas() {
  const res = await makeApiRequest('/registros/estatisticas', 'GET');
  if (res.success) {
    getEl('statCadastradas').textContent = res.totalCriancasCadastradas;
    getEl('statPresentes').textContent = res.totalPresentesHoje;
    getEl('statCheckins').textContent = res.totalCheckInsHoje;
    getEl('statCheckouts').textContent = res.totalCheckOutsHoje;
  }
}

async function checkinCrianca(id) {
  const res = await makeApiRequest('/registros/checkin', 'POST', { crianca_id: id });
  showMessage('checkinMessage', res.message || 'Erro no check-in.', res.success ? 'success' : 'error');
  if (res.success) carregarDadosDashboard();
}

async function checkoutCrianca(id) {
  const res = await makeApiRequest('/registros/checkout', 'POST', { crianca_id: id });
  showMessage('checkoutMessage', res.message || 'Erro no check-out.', res.success ? 'success' : 'error');
  if (res.success) carregarDadosDashboard();
}

async function removerCrianca(id) {
  if (!confirm('Deseja desativar esta criança?')) return;
  const res = await makeApiRequest(`/criancas/${id}`, 'DELETE');
  showMessage('gerenciarCriancasMessage', res.message || 'Erro ao remover.', res.success ? 'success' : 'error');
  if (res.success) carregarDadosDashboard();
}

// Usuários
async function adicionarUsuario(e) {
  e.preventDefault();
  const data = {
    nome: getEl('inputUsuarioNome').value,
    senha: getEl('inputUsuarioSenha').value,
    tipo: getEl('inputUsuarioTipo').value
  };
  const res = await makeApiRequest('/usuarios/cadastrar', 'POST', data);
  showMessage('messageUsuarios', res.message || 'Erro ao cadastrar.', res.success ? 'success' : 'error');
  if (res.success) {
    getEl('formCadastroUsuario').reset();
    carregarUsuarios();
  }
}

async function carregarUsuarios() {
  const lista = getEl('listaUsuarios');
  const res = await makeApiRequest('/usuarios', 'GET');
  lista.innerHTML = '';
  if (res.success && res.usuarios.length) {
    res.usuarios.forEach(u => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${u.nome} (${u.tipo})</span><button class="btn btn-danger btn-small" data-id="${u.id}" data-remover-usuario>Remover</button>`;
      lista.appendChild(li);
    });
  } else {
    lista.innerHTML = '<li>Nenhum usuário encontrado.</li>';
  }
}

async function removerUsuario(id) {
  if (!confirm('Remover este usuário?')) return;
  const res = await makeApiRequest(`/usuarios/${id}`, 'DELETE');
  showMessage('messageUsuarios', res.message || 'Erro ao remover.', res.success ? 'success' : 'error');
  if (res.success) carregarUsuarios();
}

// Relatórios
async function gerarRelatorio() {
  const data = getEl('inputDataRelatorio').value;
  if (!data) return showMessage('messageRelatorio', 'Selecione uma data.', 'warning');
  const res = await makeApiRequest(`/registros/relatorio-dia?data=${data}`, 'GET');
  if (res.success) {
    relatorioAtual = res.relatorio;
    getEl('relatorioConteudo').textContent = JSON.stringify(relatorioAtual, null, 2);
    showMessage('messageRelatorio', 'Relatório gerado!', 'success');
  } else {
    showMessage('messageRelatorio', res.message || 'Erro ao gerar.', 'error');
  }
}

async function exportarRelatorio() {
  const data = getEl('inputDataRelatorio').value;
  if (!data || !relatorioAtual.length) return showMessage('messageRelatorio', 'Gere o relatório antes.', 'warning');
  if (window.electronAPI?.exportReport) {
    const result = await window.electronAPI.exportReport({ data, dados: relatorioAtual });
    showMessage('messageRelatorio', result.message || 'Erro ao exportar.', result.success ? 'success' : 'error');
  } else {
    showMessage('messageRelatorio', 'Exportação só no app desktop.', 'warning');
  }
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('[PWA] Service Worker registrado:', reg.scope))
      .catch(err => console.error('[PWA] Falha ao registrar Service Worker:', err));
  });
}

// Instalação PWA
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const btnInstall = getEl('btnInstalarApp');
  if (btnInstall) {
    if (!btnInstall.dataset.listenerAttached) {
      btnInstall.style.display = 'block';
      btnInstall.addEventListener('click', async () => {
        btnInstall.style.display = 'none';
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('[PWA] Instalação aceita');
        } else {
          console.log('[PWA] Instalação recusada');
          btnInstall.style.display = 'block';
        }
        deferredPrompt = null;
      });
      btnInstall.dataset.listenerAttached = 'true';
    }
  }
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] Aplicativo instalado com sucesso');
  const btn = getEl('btnInstalarApp');
  if (btn) {
    btn.style.display = 'none';
    delete btn.dataset.listenerAttached;
  }
});

window.addEventListener('appinstalled', () => {
  console.log('[PWA] Aplicativo instalado com sucesso');
  const btn = getEl('btnInstalarApp');
  if (btn) {
    btn.classList.remove('show');
    btn.style.display = 'none'; // Esconde o botão após instalação
  }
});

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  checkLoginStatus();
  getEl('formLogin')?.addEventListener('submit', handleLogin);
  getEl('formCadastroCrianca')?.addEventListener('submit', cadastrarCrianca);
  getEl('formCadastroUsuario')?.addEventListener('submit', adicionarUsuario);
  getEl('btnLogout')?.addEventListener('click', logoutUsuario);
  getEl('btnAbrirCadastroCrianca')?.addEventListener('click', () => openModal('modalCadastroCrianca'));
  getEl('btnAbrirGerenciarUsuarios')?.addEventListener('click', () => {
    openModal('modalGerenciarUsuarios');
    carregarUsuarios();
  });
  getEl('btnAbrirRelatorio')?.addEventListener('click', () => openModal('modalRelatorio'));
  getEl('btnGerarRelatorio')?.addEventListener('click', gerarRelatorio);
  getEl('btnExportarRelatorio')?.addEventListener('click', exportarRelatorio);

  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  ['listaCheckin', 'listaCheckout'].forEach(id => {
    getEl(id)?.addEventListener('click', e => {
      const idCrianca = e.target.dataset.id;
      if (!idCrianca) return;
      if (e.target.classList.contains('btn-checkin')) checkinCrianca(idCrianca);
      else if (e.target.classList.contains('btn-checkout')) checkoutCrianca(idCrianca);
      else if (e.target.hasAttribute('data-remover')) removerCrianca(idCrianca);
    });
  });

  getEl('listaUsuarios')?.addEventListener('click', e => {
    const userId = e.target.dataset.id;
    if (e.target.hasAttribute('data-remover-usuario')) removerUsuario(userId);
  });
});
