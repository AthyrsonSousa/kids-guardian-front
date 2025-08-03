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

const openModal = id => getEl(id)?.classList.remove('hidden');
const closeModal = id => getEl(id)?.classList.add('hidden');

function renderLista(element, dados, templateFn, vazioMsg) {
  if (!dados.length) {
    element.innerHTML = `<li>${vazioMsg}</li>`;
    return;
  }
  element.innerHTML = '';
  dados.forEach(dado => {
    const li = document.createElement('li');
    li.innerHTML = templateFn(dado);
    element.appendChild(li);
  });
}

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
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        const text = await response.text();
        errorData = { message: text || 'Erro desconhecido' };
      }
      return { success: false, message: errorData.message || 'Erro na requisição.' };
    }

    return await response.json();
  } catch (error) {
    console.error('Erro na requisição da API:', error);
    return { success: false, message: 'Erro de conexão com o servidor.' };
  }
}

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

  if (!user || !user.nome || !user.tipo) {
    localStorage.clear();
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    return;
  }

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
  closeModal('modalCadastroCrianca');
  closeModal('modalGerenciarUsuarios');
  closeModal('modalRelatorio');

  if (token && user) {
    updateDashboardUI();
  } else {
    localStorage.clear();
    getEl('loginSection').classList.remove('hidden');
    getEl('dashboardSection').classList.add('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = getEl('inputLoginUsuario').value;
  const password = getEl('inputLoginSenha').value;
  const res = await makeApiRequest('/login', 'POST', { username, password });

  if (res.success) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    checkLoginStatus();
    showMessage('loginMessage', res.message, 'success');
  } else {
    showMessage('loginMessage', res.message || 'Erro ao fazer login.', 'error');
  }
}

async function carregarDadosDashboard() {
  await carregarListaCheckin();
  await carregarListaCheckout();
  await carregarEstatisticas();
}

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
  lista.innerHTML = '<li>Carregando...</li>';
  const res = await makeApiRequest('/criancas/checkin', 'GET');

  if (res.success && Array.isArray(res.criancas)) {
    renderLista(lista, res.criancas, c => `
      <span>${c.nome} (Sala ${c.sala})</span>
      <div class="crianca-actions">
        <button class="btn btn-checkin btn-small" data-id="${c.id}">Check-in</button>
        <button class="btn btn-danger btn-small" data-id="${c.id}" data-remover>Desativar</button>
      </div>`, 'Nenhuma criança encontrada para check-in.');
  } else {
    lista.innerHTML = '<li>Erro ao carregar lista de crianças.</li>';
  }
}

async function carregarListaCheckout() {
  const lista = getEl('listaCheckout');
  lista.innerHTML = '<li>Carregando...</li>';
  const res = await makeApiRequest(`/criancas/checkout?ts=${Date.now()}`, 'GET');

  if (res.success && Array.isArray(res.criancas)) {
    renderLista(lista, res.criancas, c => `
      <span>${c.nome} (Sala ${c.sala})</span>
      <div class="crianca-actions">
        <button class="btn btn-checkout btn-small" data-id="${c.id}">Check-out</button>
      </div>`, 'Nenhuma criança encontrada para check-out.');
  } else {
    lista.innerHTML = '<li>Erro ao carregar lista de crianças.</li>';
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
async function carregarUsuarios() {
  try {
    const res = await makeApiRequest('/usuarios', 'GET');
    const lista = getEl('listaUsuarios');
    if (!lista) return;

    if (!res.success) {
      lista.innerHTML = '<li>Erro ao carregar usuários.</li>';
      return;
    }

    // Verificar diferentes estruturas de resposta
    let usuarios = res.usuarios || res.data || res;
    
    if (!Array.isArray(usuarios)) {
      console.error('Resposta não é um array:', usuarios);
      lista.innerHTML = '<li>Formato de resposta inválido.</li>';
      return;
    }

    renderLista(lista, usuarios, usuario => `
      ${usuario.nome} - ${usuario.email || usuario.username || 'N/A'}
    `, 'Nenhum usuário encontrado.');
    
  } catch (erro) {
    console.error('Erro ao carregar usuários:', erro);
    showMessage('messageUsuarios', 'Erro ao carregar usuários.', 'error');
  }
}

async function gerarRelatorio(dia) {
  const token = localStorage.getItem('token');
  const endpoint = dia ? `/relatorio-dia?data=${dia}` : '/relatorio-geral';

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      const texto = await res.text();
      throw new Error(texto);
    }

    const relatorio = await res.json();
    const container = getEl('relatorioConteudo');
    if (!container) return;

    if (relatorio.length === 0) {
      container.textContent = 'Nenhum dado encontrado para o relatório.';
      return;
    }

    container.textContent = JSON.stringify(relatorio, null, 2);
  } catch (erro) {
    console.error('Erro ao gerar relatório:', erro);
    alert('Erro ao gerar relatório. Verifique se está logado.');
  }
}

// Seção: PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
  const installBtn = getEl('btnInstalarApp');
  if (installBtn) installBtn.style.display = 'block';
});

document.addEventListener('DOMContentLoaded', () => {
  const loginSection = getEl('loginSection');
  const dashboardSection = getEl('dashboardSection');
  const btnLogout = getEl('btnLogout');
  const installBtn = getEl('btnInstalarApp');
  const formLogin = getEl('formLogin');
  const formCadastroCrianca = getEl('formCadastroCrianca');
  const formCadastroUsuario = getEl('formCadastroUsuario');
  const formRelatorio = getEl('formRelatorio');

  if (localStorage.getItem('token')) {
    loginSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    carregarDadosDashboard();
    carregarUsuarios();
  } else {
    loginSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.reload();
    });
  }

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      const promptEvent = window.deferredPrompt;
      if (!promptEvent) return;

      promptEvent.prompt();
      const choiceResult = await promptEvent.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA instalado');
      }
      window.deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  }

  if (formLogin) {
    formLogin.addEventListener('submit', handleLogin);
  }

  if (formCadastroCrianca) {
    formCadastroCrianca.addEventListener('submit', cadastrarCrianca);
  }

  // Exemplo para cadastro de usuário (adapte conforme API)
  if (formCadastroUsuario) {
    formCadastroUsuario.addEventListener('submit', async e => {
      e.preventDefault();
      const nome = getEl('inputUsuarioNome').value;
      const senha = getEl('inputUsuarioSenha').value;
      const tipo = getEl('inputUsuarioTipo').value;
      const res = await makeApiRequest('/usuarios/cadastrar', 'POST', { nome, senha, tipo });
      showMessage('messageUsuarios', res.message || 'Erro ao cadastrar usuário.', res.success ? 'success' : 'error');
      if (res.success) {
        formCadastroUsuario.reset();
        carregarUsuarios();
      }
    });
  }

  if (formRelatorio) {
    formRelatorio.addEventListener('submit', e => {
      e.preventDefault();
      const data = getEl('inputDataRelatorio').value;
      gerarRelatorio(data);
    });
  }

  // Delegação para ações dinâmicas de checkin, checkout e remover
  document.body.addEventListener('click', e => {
    if (e.target.matches('.btn-checkin')) {
      const id = e.target.getAttribute('data-id');
      if (id) checkinCrianca(id);
    } else if (e.target.matches('.btn-checkout')) {
      const id = e.target.getAttribute('data-id');
      if (id) checkoutCrianca(id);
    } else if (e.target.matches('[data-remover]')) {
      const id = e.target.getAttribute('data-id');
      if (id) removerCrianca(id);
    } else if (e.target.classList.contains('close-btn')) {
      const modalId = e.target.getAttribute('data-close');
      if (modalId) closeModal(modalId);
    }
  });
});
