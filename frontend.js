const API_BASE_URL = 'https://kids-guardian.onrender.com/api'; // substitua pela sua real
let relatorioAtual = [];

// Utils
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

const openModal = id => getEl(id)?.classList.add('active');
const closeModal = id => getEl(id)?.classList.remove('active');

async function makeApiRequest(endpoint, method, data = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : null,
  });

  if (response.status === 401 || response.status === 403) {
    localStorage.clear();
    checkLoginStatus();
    showMessage('loginMessage', 'Sessão expirada. Faça login novamente.', 'error');
  }

  return response.json();
}

// Login e Sessão
async function handleLogin(e) {
  e.preventDefault();
  const username = getEl('inputLoginUsuario').value;
  const password = getEl('inputLoginSenha').value;
  const res = await makeApiRequest('/login', 'POST', { username, password });

  if (res.success) {
    showMessage('loginMessage', res.message, 'success');
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    updateDashboardUI();
  } else {
    showMessage('loginMessage', res.message || 'Erro ao fazer login.', 'error');
  }
}

function logoutUsuario() {
  localStorage.clear();
  getEl('dashboardSection').classList.remove('active');
  getEl('loginSection').style.display = 'flex';
  showMessage('loginMessage', 'Sessão encerrada.', 'success');
}

function updateDashboardUI() {
  const loginSection = getEl('loginSection');
  const dashboardSection = getEl('dashboardSection');
  const user = JSON.parse(localStorage.getItem('user'));

  if (user) {
    loginSection.style.display = 'none';
    dashboardSection.classList.add('active');
    getEl('displayUsuarioLogado').textContent = user.nome;
    getEl('displayCargoUsuario').textContent = user.tipo.charAt(0).toUpperCase() + user.tipo.slice(1);

    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = user.tipo === 'administrador' ? 'block' : 'none';
    });

    carregarDadosDashboard();
  } else {
    loginSection.style.display = 'flex';
    dashboardSection.classList.remove('active');
  }
}

function checkLoginStatus() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  token && user ? updateDashboardUI() : updateDashboardUI();
}

// Dashboard - Carregamento de dados
async function carregarDadosDashboard() {
  await carregarListaCheckin();
  await carregarListaCheckout();
  await carregarEstatisticas();
}

async function cadastrarCrianca(e) {
  e.preventDefault();

  const nome = document.getElementById('inputCriancaNome').value;
  const nome_responsavel = document.getElementById('inputCriancaResponsavel').value;
  const numero_responsavel = document.getElementById('inputCriancaNumero').value;
  const idade = parseInt(document.getElementById('inputCriancaIdade').value);
  const sala = parseInt(document.getElementById('inputCriancaSala').value);
  const observacoes = document.getElementById('inputCriancaObs').value;

  const res = await makeApiRequest('/criancas/cadastrar', 'POST', {
    nome,
    nome_responsavel,
    numero_responsavel,
    idade,
    sala,
    observacoes
  });

  showMessage('messageCadastroCrianca', res.message || 'Erro ao cadastrar.', res.success ? 'success' : 'error');

  if (res.success) {
    document.getElementById('formCadastroCrianca').reset();
    closeModal('modalCadastroCrianca');
    carregarDadosDashboard(); // atualiza check-in/check-out
  }
}

// Carregar lista de crianças para check-in
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
  } catch (err) {
    lista.innerHTML = '<li>Erro ao carregar lista para check-in.</li>';
  }
}

// Carregar lista de crianças para check-out
async function carregarListaCheckout() {
  const lista = getEl('listaCheckout');
  if (!lista) return;
  lista.innerHTML = '<li>Carregando...</li>';
  try {
    // Evita cache da API
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
  } catch (err) {
    console.error('Erro no carregarListaCheckout:', err);
    lista.innerHTML = '<li>Erro ao carregar lista para check-out.</li>';
  }
}

// Carregar estatísticas para o dashboard
async function carregarEstatisticas() {
  const res = await makeApiRequest('/registros/estatisticas', 'GET');
  if (res.success) {
    getEl('statCadastradas').textContent = res.totalCriancasCadastradas;
    getEl('statPresentes').textContent = res.totalPresentesHoje;
    getEl('statCheckins').textContent = res.totalCheckInsHoje;
    getEl('statCheckouts').textContent = res.totalCheckOutsHoje;
  }
}

// Ações: Check-in da criança
async function checkinCrianca(id) {
  const res = await makeApiRequest('/registros/checkin', 'POST', { crianca_id: id });
  showMessage('checkinMessage', res.message || 'Erro no check-in.', res.success ? 'success' : 'error');

  if (res.success) {
    // Remove da lista de check-in
    const liCheckin = document.querySelector(`#listaCheckin [data-id="${id}"]`)?.closest('li');
    if (liCheckin) liCheckin.remove();

    // Recarrega apenas a criança recém adicionada no check-out
    const resAtualizado = await makeApiRequest('/criancas', 'GET');
    if (resAtualizado.success) {
      const crianca = resAtualizado.criancas.find(c => c.id === parseInt(id));
      if (crianca) {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${crianca.nome} (Sala ${crianca.sala})</span>
          <div class="crianca-actions">
            <button class="btn btn-checkout btn-small" data-id="${crianca.id}">Check-out</button>
          </div>`;
        getEl('listaCheckout').appendChild(li);
      }
    }

    await carregarEstatisticas();
  }
}

// Ações: Check-out da criança
async function checkoutCrianca(id) {
  const res = await makeApiRequest('/registros/checkout', 'POST', { crianca_id: id });
  showMessage('checkoutMessage', res.message || 'Erro no check-out.', res.success ? 'success' : 'error');

  if (res.success) {
    // Remove da lista de check-out
    const liCheckout = document.querySelector(`#listaCheckout [data-id="${id}"]`)?.closest('li');
    if (liCheckout) liCheckout.remove();

    // Recarrega apenas a criança recém adicionada ao check-in
    const resAtualizado = await makeApiRequest('/criancas', 'GET');
    if (resAtualizado.success) {
      const crianca = resAtualizado.criancas.find(c => c.id === parseInt(id));
      if (crianca && crianca.is_active) {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${crianca.nome} (Sala ${crianca.sala})</span>
          <div class="crianca-actions">
            <button class="btn btn-checkin btn-small" data-id="${crianca.id}">Check-in</button>
            <button class="btn btn-danger btn-small" data-id="${crianca.id}" data-remover>Desativar</button>
          </div>`;
        getEl('listaCheckin').appendChild(li);
      }
    }

    await carregarEstatisticas();
  }
}

// Ações: Remover/desativar criança
async function removerCrianca(id) {
  if (!confirm('Deseja desativar esta criança?')) return;
  const res = await makeApiRequest(`/criancas/${id}`, 'DELETE');
  showMessage('gerenciarCriancasMessage', res.message || 'Erro ao remover.', res.success ? 'success' : 'error');
  if (res.success) {
    carregarDadosDashboard();
  }
}

// Usuários - Adicionar novo usuário
async function adicionarUsuario(e) {
  e.preventDefault();
  const nome = getEl('inputUsuarioNome').value;
  const senha = getEl('inputUsuarioSenha').value;
  const tipo = getEl('inputUsuarioTipo').value;
  const res = await makeApiRequest('/usuarios/cadastrar', 'POST', { nome, senha, tipo });
  showMessage('messageUsuarios', res.message || 'Erro ao cadastrar.', res.success ? 'success' : 'error');
  if (res.success) {
    getEl('formCadastroUsuario').reset();
    carregarUsuarios();
  }
}

// Usuários - Carregar lista de usuários
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

// Usuários - Remover usuário
async function removerUsuario(id) {
  if (!confirm('Remover este usuário?')) return;
  const res = await makeApiRequest(`/usuarios/${id}`, 'DELETE');
  showMessage('messageUsuarios', res.message || 'Erro ao remover.', res.success ? 'success' : 'error');
  if (res.success) carregarUsuarios();
}

// Relatório - Gerar relatório do dia
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

// Relatório - Exportar relatório (app desktop)
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

// Eventos DOM
document.addEventListener('DOMContentLoaded', () => {
  checkLoginStatus();

  // Formulários
  getEl('formLogin')?.addEventListener('submit', handleLogin);
  getEl('formCadastroCrianca')?.addEventListener('submit', cadastrarCrianca);
  getEl('formCadastroUsuario')?.addEventListener('submit', adicionarUsuario);

  // Botões principais
  getEl('btnLogout')?.addEventListener('click', logoutUsuario);
  getEl('btnAbrirCadastroCrianca')?.addEventListener('click', () => openModal('modalCadastroCrianca'));
  getEl('btnAbrirGerenciarUsuarios')?.addEventListener('click', () => {
    openModal('modalGerenciarUsuarios');
    carregarUsuarios();
  });
  getEl('btnAbrirRelatorio')?.addEventListener('click', () => openModal('modalRelatorio'));
  getEl('btnGerarRelatorio')?.addEventListener('click', gerarRelatorio);
  getEl('btnExportarRelatorio')?.addEventListener('click', exportarRelatorio);

  // Fechar modais
  document.querySelectorAll('.close-btn').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Ações em listas de crianças (check-in, check-out, desativar)
  ['listaCheckin', 'listaCheckout'].forEach(listaId => {
    getEl(listaId)?.addEventListener('click', e => {
      const criancaId = e.target.dataset.id;
      if (!criancaId) return;

      if (e.target.classList.contains('btn-checkin')) {
        checkinCrianca(criancaId);
      } else if (e.target.classList.contains('btn-checkout')) {
        checkoutCrianca(criancaId);
      } else if (e.target.hasAttribute('data-remover')) {
        removerCrianca(criancaId);
      }
    });
  });

  // Ações em lista de usuários
  getEl('listaUsuarios')?.addEventListener('click', e => {
    const userId = e.target.dataset.id;
    if (e.target.hasAttribute('data-remover-usuario')) {
      removerUsuario(userId);
    }
  });

});

  // Registrar Service Worker (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        console.log('[Service Worker] Registrado com sucesso:', reg.scope);
      })
      .catch(err => {
        console.error('[Service Worker] Falha ao registrar:', err);
      });
  });
}
