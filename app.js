/* =====================================================================
   Portal de Relatórios de Ensaio — Éllu Ambiental
   Vanilla JS + Supabase (Auth, Postgres/RLS, Storage)
   ===================================================================== */
'use strict';

// Captura o fragmento de retorno do Auth (convite/recuperação) antes do Supabase limpá-lo
const HASH_INICIAL = new URLSearchParams(location.hash.slice(1));
const CFG = window.PORTAL_CONFIG || {};
const DEMO = !CFG.SUPABASE_URL;
const POR_PAG = CFG.ITENS_POR_PAGINA || 25;
const sb = DEMO || !window.supabase ? null : supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

/* ---------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtData = d => { if (!d) return '—'; const [a, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${a}`; };
const fmtDataHora = d => d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtBytes = b => !b ? '—' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const hoje = () => new Date().toISOString().slice(0, 10);
const baseUrl = () => CFG.URL_PUBLICA || (location.origin + location.pathname);
const linkValidacao = cod => `${baseUrl()}?validar=${encodeURIComponent(cod)}`;
const nomeArquivo = r => `${String(r.numero).replace(/[^\w.-]+/g, '_')}_rev${r.revisao}.pdf`;
const safe = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_');
const extDe = n => (String(n || '').match(/\.[a-z0-9]{1,5}$/i) || [''])[0].toLowerCase();
const nomeUnico = (r, a) => `${safe(r.numero)}_rev${r.revisao}${extDe(a.arquivo_nome) || '.pdf'}`;
const TIPOS_OK = /\.(pdf|xlsx?|docx?|csv|jpe?g|png|zip)$/i;
const ACCEPT = '.pdf,.xls,.xlsx,.doc,.docx,.csv,.jpg,.jpeg,.png,.zip';
const MAX_ARQ = 52428800;
const achaHash = h => { for (const r of S.relatorios) { const a = r.arquivos.find(a => a.hash_sha256 === h); if (a) return { r, a }; } return null; };
const iniciais = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

async function sha256(blob) {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function baixarBlob(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  upload: '<path d="M12 21V9m0 0-4 4m4-4 4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
  clip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  xc: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
};
const ic = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24">${P[n]}</svg>`;

function toast(msg, tipo = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + tipo; t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 6000 : 3500);
}

function modal(titulo, corpo, rodape = '', cls = '') {
  const root = $('#modal-root');
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">
    <div class="modal-h"><h2>${titulo}</h2><button class="icon-btn" data-fechar aria-label="Fechar">${ic('x')}</button></div>
    <div class="modal-b">${corpo}</div>${rodape ? `<div class="modal-f">${rodape}</div>` : ''}</div>`;
  const fechar = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') fechar(); };
  ov.addEventListener('mousedown', e => { if (e.target === ov) fechar(); });
  $$('[data-fechar]', ov).forEach(b => b.onclick = fechar);
  document.addEventListener('keydown', onKey);
  root.appendChild(ov);
  return { el: ov, fechar };
}

function confirmar(titulo, texto, rotulo = 'Confirmar', perigo = false) {
  return new Promise(res => {
    const m = modal(titulo, `<p style="margin:0">${texto}</p>`,
      `<button class="btn" data-fechar>Cancelar</button><button class="btn ${perigo ? 'btn-perigo' : 'btn-pri'}" id="ok">${rotulo}</button>`, 'sm');
    let ok = false;
    $('#ok', m.el).onclick = () => { ok = true; m.fechar(); };
    new MutationObserver((_, o) => { if (!m.el.isConnected) { o.disconnect(); res(ok); } }).observe($('#modal-root'), { childList: true });
  });
}

async function comBotao(btn, fn) {
  const orig = btn.innerHTML; btn.disabled = true;
  btn.innerHTML = `<span class="spin${btn.classList.contains('btn-pri') || btn.classList.contains('btn-verde') ? '' : ' dark'}"></span>`;
  try { return await fn(); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = orig; } }
}

function traduzErro(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (/Password should be at least/i.test(m)) return 'A senha deve ter pelo menos 8 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (/codigo_validacao/i.test(m)) return 'Esse código de validação já está em uso.';
  if (/duplicate key.*numero/i.test(m)) return 'Já existe esse número de relatório com essa revisão.';
  if (/already been registered|already registered/i.test(m)) return 'Esse e-mail já possui cadastro.';
  if (/Edge Function/i.test(m)) return 'A função de convite (criar-usuario) não está instalada no Supabase. Instale-a em Edge Functions ou convide pelo painel do Supabase (Authentication → Users → Invite).';
  if (/mime type|not supported/i.test(m)) return 'Tipo de arquivo não aceito. Rode a migração v2 no Supabase para liberar Excel, Word e imagens.';
  if (/arquivo_path|hash_sha256/i.test(m) && /null value|not-null/i.test(m)) return 'Falta rodar a migração v2 (supabase/migracao-v2.sql) no SQL Editor do Supabase.';
  if (/relatorio_arquivos/i.test(m) && /does not exist|schema cache/i.test(m)) return 'Falta rodar a migração v2 (supabase/migracao-v2.sql) no SQL Editor do Supabase.';
  if (/exceeded the maximum|too large/i.test(m)) return 'Arquivo acima do limite de 50 MB.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor.';
  return m;
}

/* ---------------------------------------------------------------------
   Camada de dados — Supabase
   --------------------------------------------------------------------- */
function SupaAPI() {
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const uid = async () => (await sb.auth.getSession()).data.session?.user?.id;
  const bucket = () => sb.storage.from('relatorios');
  async function todos(q) { // pagina de 1000 em 1000
    let out = [], i = 0;
    for (;;) { const d = ok(await q().range(i, i + 999)); out = out.concat(d); if (d.length < 1000) return out; i += 1000; }
  }
  async function fn(body) { // Edge Function de usuários
    const { data, error } = await sb.functions.invoke('criar-usuario', { body: { ...body, redirectTo: baseUrl() } });
    if (error) { let msg = error.message; try { msg = (await error.context.json()).error || msg; } catch (_) {} throw new Error(msg); }
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function subir(pasta, itens, ordem0 = 0) {
    const feitos = [];
    try {
      for (const [i, it] of itens.entries()) {
        const path = `${pasta}/${ordem0 + i + 1}_${safe(it.file.name)}`;
        ok(await bucket().upload(path, it.file, { contentType: it.file.type || 'application/octet-stream', upsert: false }));
        feitos.push({ path, it, ordem: ordem0 + i });
      }
      return feitos;
    } catch (e) { if (feitos.length) await bucket().remove(feitos.map(f => f.path)); throw e; }
  }
  const linhas = (relId, feitos) => feitos.map(f => ({
    relatorio_id: relId, arquivo_path: f.path, arquivo_nome: f.it.file.name, tamanho_bytes: f.it.file.size,
    content_type: f.it.file.type || null, hash_sha256: f.it.hash, ordem: f.ordem,
  }));
  return {
    async session() { return (await sb.auth.getSession()).data.session; },
    async login(email, senha) { ok(await sb.auth.signInWithPassword({ email, password: senha })); },
    async logout() { await sb.auth.signOut(); },
    async recuperar(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: baseUrl() })); },
    async novaSenha(senha) { ok(await sb.auth.updateUser({ password: senha })); },
    async meuPerfil() {
      const s = await this.session();
      const p = ok(await sb.from('perfis').select('*, cliente:clientes(id,nome,cnpj,ativo)').eq('id', s.user.id).maybeSingle());
      return p || { id: s.user.id, email: s.user.email, papel: 'cliente', ativo: true };
    },
    async relatorios() {
      const l = await todos(() => sb.from('relatorios').select('*, cliente:clientes(nome), arquivos:relatorio_arquivos(*)')
        .order('data_emissao', { ascending: false }).order('numero').order('revisao', { ascending: false }));
      return l.map(normRel);
    },
    async abrirUrl(a) { return ok(await bucket().createSignedUrl(a.arquivo_path, 300)).signedUrl; },
    async blob(a) { return ok(await bucket().download(a.arquivo_path)); },
    async log(r, acao, a) {
      try { await sb.from('acessos_log').insert({ relatorio_id: r.id, user_id: await uid(), acao, ...(a && !a.legado ? { arquivo_id: a.id } : {}) }); } catch (_) {}
    },
    async validar(codigo) { return ok(await sb.rpc('validar_relatorio', { p_codigo: codigo }))[0] || null; },
    async validarHash(hash) { return ok(await sb.rpc('validar_por_hash', { p_hash: hash }))[0] || null; },
    // ---- admin
    async clientes() { return ok(await sb.from('clientes').select('*').order('nome')); },
    async salvarCliente(c) { return ok(await sb.from('clientes').upsert(c).select().single()); },
    async perfis() { return ok(await sb.from('perfis').select('*, cliente:clientes(nome)').order('created_at', { ascending: false })); },
    async salvarPerfil(id, patch) { ok(await sb.from('perfis').update(patch).eq('id', id)); },
    convidar: d => fn({ acao: 'convidar', ...d }),
    reenviar: id => fn({ acao: 'reenviar', id }),
    excluirUsuario: id => fn({ acao: 'excluir', id }),
    statusUsuarios: () => fn({ acao: 'status' }),
    async publicar(meta, itens) {
      const feitos = await subir(`${meta.cliente_id}/${safe(meta.numero)}_rev${meta.revisao}_${Date.now()}`, itens);
      const { data: rel, error } = await sb.from('relatorios').insert({ ...meta, publicado_por: await uid() }).select('*, cliente:clientes(nome)').single();
      if (error) { await bucket().remove(feitos.map(f => f.path)); throw error; }
      const { data: arqs, error: e2 } = await sb.from('relatorio_arquivos').insert(linhas(rel.id, feitos)).select();
      if (e2) { await sb.from('relatorios').delete().eq('id', rel.id); await bucket().remove(feitos.map(f => f.path)); throw e2; }
      rel.arquivos = arqs; return normRel(rel);
    },
    async adicionarArquivos(r, itens) {
      const ordem0 = Math.max(-1, ...r.arquivos.map(a => a.ordem ?? 0)) + 1;
      const feitos = await subir(`${r.cliente_id}/${safe(r.numero)}_rev${r.revisao}_${Date.now()}`, itens, ordem0);
      const { data, error } = await sb.from('relatorio_arquivos').insert(linhas(r.id, feitos)).select();
      if (error) { await bucket().remove(feitos.map(f => f.path)); throw error; }
      return data;
    },
    async removerArquivo(a) {
      ok(await sb.from('relatorio_arquivos').delete().eq('id', a.id));
      await bucket().remove([a.arquivo_path]);
    },
    async atualizarRelatorio(id, patch) { ok(await sb.from('relatorios').update(patch).eq('id', id)); },
    async acessos() { return ok(await sb.from('acessos_log').select('*').order('created_at', { ascending: false }).limit(500)); },
  };
}

// Garante r.arquivos ordenado (e compatibilidade com relatórios de 1 arquivo antes da migração v2)
function normRel(r) {
  let arq = (r.arquivos || []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || String(a.created_at).localeCompare(String(b.created_at)));
  if (!arq.length && r.arquivo_path) arq = [{ id: 'legado-' + r.id, arquivo_path: r.arquivo_path, arquivo_nome: r.arquivo_nome || nomeArquivo(r),
    tamanho_bytes: r.tamanho_bytes, hash_sha256: r.hash_sha256, ordem: 0, legado: true }];
  r.arquivos = arq;
  return r;
}

/* ---------------------------------------------------------------------
   Camada de dados — Demonstração (em memória)
   --------------------------------------------------------------------- */
function DemoAPI() {
  const pdf = txt => {
    const linhas = norm(txt).split('\n');
    const c = 'BT /F1 13 Tf 60 780 Td 20 TL ' + linhas.map(l => '(' + l.replace(/[()\\]/g, '\\$&') + ') Tj T*').join(' ') + ' ET';
    const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${c.length} >>\nstream\n${c}\nendstream`];
    let out = '%PDF-1.4\n'; const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const x = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
      `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
    return new Blob([out], { type: 'application/pdf' });
  };
  const cod = () => Math.random().toString(16).slice(2, 12).toUpperCase();
  let seq = 1; const nid = p => p + (seq++);
  const clientes = [
    { id: 'c1', nome: 'Raizcon Consultoria Ambiental Ltda', cnpj: '12.345.678/0001-90', email_contato: 'contato@raizcon.exemplo', ativo: true },
    { id: 'c2', nome: 'Indústria Vale Verde S.A.', cnpj: '98.765.432/0001-10', email_contato: 'meio.ambiente@valeverde.exemplo', ativo: true },
  ];
  const perfis = [
    { id: 'u1', nome: 'Ana Souza', email: 'cliente@demo.com', cliente_id: 'c1', papel: 'cliente', ativo: true, created_at: '2026-03-02T10:00:00Z' },
    { id: 'u2', nome: 'Carlos Lima', email: 'carlos@raizcon.exemplo', cliente_id: 'c1', papel: 'cliente', ativo: true, created_at: '2026-04-11T10:00:00Z' },
    { id: 'u3', nome: 'Equipe Éllu', email: 'admin@demo.com', cliente_id: null, papel: 'admin', ativo: true, created_at: '2026-01-05T10:00:00Z' },
    { id: 'u4', nome: 'Marina Prado', email: 'marina@valeverde.exemplo', cliente_id: 'c2', papel: 'cliente', ativo: true, created_at: '2026-05-20T10:00:00Z' },
  ];
  const status = { u1: { confirmado: true, ultimo_acesso: '2026-09-20T13:10:00Z' }, u2: { confirmado: false, ultimo_acesso: null },
    u3: { confirmado: true, ultimo_acesso: new Date().toISOString() }, u4: { confirmado: true, ultimo_acesso: '2026-08-02T09:00:00Z' } };
  const matrizes = ['Água superficial', 'Água subterrânea', 'Efluente líquido', 'Solo', 'Água para consumo'];
  const pontos = ['P-01 Montante', 'P-02 Jusante', 'PM-03 Poço de monitoramento', 'ETE — Saída', 'ETE — Entrada', 'S-04 Sondagem'];
  const projetos = ['Monitoramento trimestral LO 1234/2025', 'Investigação confirmatória — Área B', 'Automonitoramento ETE'];
  const blobs = new Map();
  const rel = [];
  const novoArq = (nome, blob, ordem) => { const a = { id: nid('a'), arquivo_path: nid('p'), arquivo_nome: nome, tamanho_bytes: blob.size, content_type: blob.type, ordem }; blobs.set(a.arquivo_path, blob); return a; };
  let n = 380;
  for (let i = 0; i < 22; i++) {
    const cli = i % 4 === 3 ? clientes[1] : clientes[0];
    const dt = new Date(2026, 8, 20 - i * 17);
    const coleta = new Date(dt); coleta.setDate(dt.getDate() - 9);
    const numero = `RE-${dt.getFullYear()}-${String(n + (22 - i)).padStart(4, '0')}`;
    rel.push({
      id: 'r' + i, cliente_id: cli.id, cliente: { nome: cli.nome }, numero, revisao: 0,
      titulo: 'Relatório de Ensaio', projeto: projetos[i % 3], ponto_coleta: pontos[i % pontos.length], matriz: matrizes[i % matrizes.length],
      data_coleta: coleta.toISOString().slice(0, 10), data_emissao: dt.toISOString().slice(0, 10), status: 'vigente',
      codigo_validacao: cod(), created_at: dt.toISOString(), arquivos: [],
    });
  }
  const orig = rel[2]; orig.status = 'substituido';
  rel.unshift({ ...orig, id: 'r2b', revisao: 1, status: 'vigente', codigo_validacao: cod(), motivo_revisao: 'Correção do ponto de coleta', arquivos: [] });
  rel[8].status = 'cancelado';
  rel.forEach((r, i) => {
    const txt = x => `${CFG.EMPRESA || 'Ellu Ambiental'} - ${x}\n\nNumero: ${r.numero}  Revisao: ${r.revisao}\nCliente: ${r.cliente.nome}\nPonto: ${r.ponto_coleta}\nMatriz: ${r.matriz}\nColeta: ${fmtData(r.data_coleta)}\n\nCodigo de validacao: ${r.codigo_validacao}\n\n(Documento ficticio - modo demonstracao)`;
    r.arquivos.push(novoArq(`${r.numero}_rev${r.revisao}.pdf`, pdf(txt('RELATORIO DE ENSAIO')), 0));
    if (i % 3 === 0) r.arquivos.push(novoArq('Cadeia de custodia.pdf', pdf(txt('CADEIA DE CUSTODIA')), 1));
    if (i % 5 === 0) r.arquivos.push(novoArq('Anexo - Laudo de campo.pdf', pdf(txt('LAUDO DE CAMPO')), 2));
  });
  const pronto = Promise.all(rel.flatMap(r => r.arquivos).map(async a => { a.hash_sha256 = await sha256(blobs.get(a.arquivo_path)); }));
  const log = [];
  let atual = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  const pub = (r, arquivo = null) => {
    if (!r) return null;
    const c = clientes.find(c => c.id === r.cliente_id);
    return { numero: r.numero, revisao: r.revisao, cliente: c.nome, data_emissao: r.data_emissao, data_coleta: r.data_coleta, status: r.status,
      arquivos: r.arquivos.map(a => ({ nome: a.arquivo_nome, hash: a.hash_sha256 })), arquivo,
      revisao_vigente: Math.max(...rel.filter(x => x.numero === r.numero && x.status !== 'cancelado').map(x => x.revisao)) };
  };
  const guardar = async (itens, ordem0) => Promise.all(itens.map((it, i) => {
    const a = novoArq(it.file.name, it.file, ordem0 + i); a.hash_sha256 = it.hash; return a;
  }));
  return {
    async session() { await pronto; return atual ? { user: { id: atual.id, email: atual.email } } : null; },
    async login(email) {
      const p = perfis.find(p => p.email.toLowerCase() === email.trim().toLowerCase());
      if (!p) throw new Error('Invalid login credentials'); atual = p;
    },
    async logout() { atual = null; },
    async recuperar() {}, async novaSenha() {},
    async meuPerfil() { return { ...clone(atual), cliente: clone(clientes.find(c => c.id === atual.cliente_id) || null) }; },
    async relatorios() {
      await pronto;
      const vis = atual.papel === 'admin' ? rel : rel.filter(r => r.cliente_id === atual.cliente_id && r.status !== 'cancelado');
      return clone(vis).map(normRel).sort((a, b) => b.data_emissao.localeCompare(a.data_emissao) || a.numero.localeCompare(b.numero) || b.revisao - a.revisao);
    },
    async abrirUrl(a) { return URL.createObjectURL(blobs.get(a.arquivo_path)); },
    async blob(a) { return blobs.get(a.arquivo_path); },
    async log(r, acao, a) { log.unshift({ id: log.length + 1, relatorio_id: r.id, arquivo_id: a?.id, user_id: atual.id, acao, created_at: new Date().toISOString() }); },
    async validar(c) { await pronto; return pub(rel.find(r => r.codigo_validacao === c.trim().toUpperCase())); },
    async validarHash(h) {
      await pronto;
      for (const r of rel) { const a = r.arquivos.find(a => a.hash_sha256 === h); if (a) return pub(r, a.arquivo_nome); }
      return null;
    },
    async clientes() { return clone(clientes); },
    async salvarCliente(c) {
      if (c.id) Object.assign(clientes.find(x => x.id === c.id), c);
      else { c.id = 'c' + (clientes.length + 1); c.ativo = c.ativo ?? true; clientes.push(c); }
      rel.forEach(r => { r.cliente = { nome: clientes.find(x => x.id === r.cliente_id).nome }; });
      return clone(c);
    },
    async perfis() { return clone(perfis.map(p => ({ ...p, cliente: p.cliente_id ? { nome: clientes.find(c => c.id === p.cliente_id)?.nome } : null }))); },
    async salvarPerfil(id, patch) { Object.assign(perfis.find(p => p.id === id), patch); },
    async convidar(d) {
      if (perfis.some(p => p.email === d.email)) throw new Error('already been registered');
      const id = nid('u');
      perfis.push({ id, ...d, cliente_id: d.papel === 'admin' ? null : d.cliente_id, ativo: true, created_at: new Date().toISOString() });
      status[id] = { confirmado: false, ultimo_acesso: null };
    },
    async reenviar(id) { return { ok: true, tipo: status[id]?.confirmado ? 'senha' : 'convite' }; },
    async excluirUsuario(id) {
      if (id === atual.id) throw new Error('Você não pode excluir o próprio usuário');
      perfis.splice(perfis.findIndex(p => p.id === id), 1); delete status[id];
    },
    async statusUsuarios() { return clone(status); },
    async publicar(meta, itens) {
      if (rel.some(r => r.numero === meta.numero && r.revisao === meta.revisao)) throw new Error('duplicate key numero');
      const r = { id: nid('r'), ...meta, codigo_validacao: meta.codigo_validacao || cod(), status: 'vigente', created_at: new Date().toISOString(),
        cliente: { nome: clientes.find(c => c.id === meta.cliente_id).nome }, arquivos: await guardar(itens, 0) };
      rel.forEach(x => { if (x.numero === r.numero && x.revisao < r.revisao && x.status === 'vigente') x.status = 'substituido'; });
      rel.unshift(r); return normRel(clone(r));
    },
    async adicionarArquivos(r, itens) {
      const alvo = rel.find(x => x.id === r.id);
      const novos = await guardar(itens, Math.max(-1, ...alvo.arquivos.map(a => a.ordem)) + 1);
      alvo.arquivos.push(...novos); return clone(novos);
    },
    async removerArquivo(a) { rel.forEach(r => { r.arquivos = r.arquivos.filter(x => x.id !== a.id); }); },
    async atualizarRelatorio(id, patch) { Object.assign(rel.find(r => r.id === id), patch); },
    async acessos() { return clone(log); },
  };
}

const API = DEMO ? DemoAPI() : SupaAPI();

/* ---------------------------------------------------------------------
   Estado
   --------------------------------------------------------------------- */
const S = {
  perfil: null, relatorios: [], clientes: [], perfis: [],
  filtros: { q: '', ano: '', matriz: '', status: 'vigente', cliente: '' },
  sort: { k: 'data_emissao', dir: -1 }, pagina: 1, sel: new Set(), aba: 'relatorios', statusU: null,
};
const isAdmin = () => S.perfil?.papel === 'admin';
const app = () => $('#app');

/* ---------------------------------------------------------------------
   Inicialização / roteamento
   --------------------------------------------------------------------- */
async function iniciar() {
  const qs = new URLSearchParams(location.search);
  if (qs.has('validar')) return viewValidar(qs.get('validar'));

  const tipo = HASH_INICIAL.get('type');
  const erroUrl = HASH_INICIAL.get('error_description');
  if (!DEMO) sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') viewDefinirSenha('recovery'); });

  try {
    const s = await API.session();
    if (s && (tipo === 'invite' || tipo === 'recovery')) { history.replaceState(null, '', location.pathname); return viewDefinirSenha(tipo); }
    if (!s) return viewLogin(erroUrl ? { erro: erroUrl.replace(/\+/g, ' ') } : {});
    await entrar();
  } catch (e) {
    viewLogin({ erro: traduzErro(e) });
  }
}

async function entrar() {
  app().innerHTML = '<div class="loading"><div class="spin dark"></div></div>';
  S.perfil = await API.meuPerfil();
  if (!S.perfil.ativo) { await API.logout(); return viewLogin({ erro: 'Seu acesso está desativado. Fale com a Éllu Ambiental.' }); }
  if (isAdmin()) return viewAdmin();
  if (!S.perfil.cliente_id || S.perfil.cliente?.ativo === false) return viewPendente();
  return viewCliente();
}

async function sair() {
  await API.logout();
  Object.assign(S, { perfil: null, relatorios: [], sel: new Set(), pagina: 1 });
  viewLogin({ ok: 'Você saiu do portal.' });
}

/* ---------------------------------------------------------------------
   Telas de acesso
   --------------------------------------------------------------------- */
const logoHtml = `<div class="logo"><span class="marca">ÉLLU <b>AMBIENTAL</b></span></div>`;
const demoFlag = () => DEMO ? '<div class="demo-flag">Modo demonstração — dados fictícios. Configure o Supabase em <b>config.js</b>.</div>' : '';

function viewLogin({ erro = '', ok = '' } = {}) {
  app().innerHTML = `${demoFlag()}<div class="auth-wrap"><div>
    <div class="auth-card">
      ${logoHtml}<p class="auth-sub">Portal de Relatórios de Ensaio</p>
      <form id="f-login" novalidate>
        ${erro ? `<div class="msg erro">${esc(erro)}</div>` : ''}${ok ? `<div class="msg ok">${esc(ok)}</div>` : ''}
        ${DEMO ? `<div class="msg info">Demonstração: entre com <b>cliente@demo.com</b> ou <b>admin@demo.com</b> (qualquer senha).</div>` : ''}
        <label class="f">E-mail<input class="in" type="email" name="email" autocomplete="username" required autofocus></label>
        <label class="f">Senha<input class="in" type="password" name="senha" autocomplete="current-password" required></label>
        <button class="btn btn-pri" style="justify-content:center;padding:11px">Entrar</button>
      </form>
      <div class="auth-links">
        <button class="btn-link" id="l-esqueci">Esqueci minha senha</button>
        <button class="btn-link" id="l-validar">${ic('shield')} Validar um relatório</button>
      </div>
    </div>
    <div class="auth-rodape">Dúvidas ou novo acesso: ${esc(CFG.CONTATO_EMAIL || '')}</div>
  </div></div>`;
  $('#l-esqueci').onclick = viewEsqueci;
  $('#l-validar').onclick = () => viewValidar();
  $('#f-login').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = $('button', f);
    if (!f.email.value || !f.senha.value) return viewLoginErro('Informe e-mail e senha.');
    await comBotao(btn, async () => {
      try { await API.login(f.email.value.trim(), f.senha.value); await entrar(); }
      catch (err) { viewLoginErro(traduzErro(err)); }
    });
  };
  function viewLoginErro(m) {
    $$('.msg.erro,.msg.ok', $('#f-login')).forEach(x => x.remove());
    $('#f-login').insertAdjacentHTML('afterbegin', `<div class="msg erro">${esc(m)}</div>`);
  }
}

function viewEsqueci() {
  app().innerHTML = `${demoFlag()}<div class="auth-wrap"><div class="auth-card">
    ${logoHtml}<p class="auth-sub">Recuperar senha</p>
    <form id="f-rec"><p style="margin:0;color:var(--muted)">Informe seu e-mail. Enviaremos um link para você criar uma nova senha.</p>
      <label class="f">E-mail<input class="in" type="email" name="email" required autofocus></label>
      <button class="btn btn-pri" style="justify-content:center;padding:11px">Enviar link</button></form>
    <div class="auth-links"><button class="btn-link" id="voltar">← Voltar ao login</button></div></div></div>`;
  $('#voltar').onclick = () => viewLogin();
  $('#f-rec').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    await comBotao($('button', f), async () => {
      try { await API.recuperar(f.email.value.trim()); viewLogin({ ok: 'Se o e-mail estiver cadastrado, você receberá o link em instantes.' }); }
      catch (err) { toast(traduzErro(err), 'erro'); }
    });
  };
}

function formSenhaHtml() {
  return `<label class="f">Nova senha<input class="in" type="password" name="s1" minlength="8" autocomplete="new-password" required></label>
    <label class="f">Confirmar senha<input class="in" type="password" name="s2" minlength="8" autocomplete="new-password" required></label>`;
}
function validarSenha(f) {
  if (f.s1.value.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (f.s1.value !== f.s2.value) return 'As senhas não conferem.';
  return '';
}

function viewDefinirSenha(tipo) {
  app().innerHTML = `<div class="auth-wrap"><div class="auth-card">
    ${logoHtml}<p class="auth-sub">${tipo === 'invite' ? 'Bem-vindo! Crie sua senha de acesso.' : 'Defina sua nova senha.'}</p>
    <form id="f-senha">${formSenhaHtml()}<button class="btn btn-pri" style="justify-content:center;padding:11px">Salvar e entrar</button></form></div></div>`;
  $('#f-senha').onsubmit = async e => {
    e.preventDefault(); const f = e.target; const v = validarSenha(f);
    if (v) return toast(v, 'erro');
    await comBotao($('button', f), async () => {
      try { await API.novaSenha(f.s1.value); toast('Senha definida.', 'ok'); await entrar(); }
      catch (err) { toast(traduzErro(err), 'erro'); }
    });
  };
}

function viewPendente() {
  app().innerHTML = `<div class="auth-wrap"><div class="auth-card">${logoHtml}
    <p class="auth-sub">Acesso em configuração</p>
    <div class="msg info">Seu usuário (${esc(S.perfil.email)}) ainda não está vinculado a um cliente. A equipe da Éllu Ambiental fará a liberação em breve.</div>
    <div class="auth-links"><button class="btn-link" id="sair">Sair</button><span>${esc(CFG.CONTATO_EMAIL || '')}</span></div></div></div>`;
  $('#sair').onclick = sair;
}

/* ---------------------------------------------------------------------
   Validação pública
   --------------------------------------------------------------------- */
function viewValidar(codigoInicial = '') {
  const logado = !!S.perfil;
  app().innerHTML = `${demoFlag()}<div class="auth-wrap"><div class="auth-card largo">
    ${logoHtml}<p class="auth-sub">Validação de Relatório de Ensaio</p>
    <form id="f-val">
      <label class="f">Código de validação <span class="opt">(impresso no relatório)</span>
        <div style="display:flex;gap:8px"><input class="in" name="codigo" placeholder="Ex.: 7F3A9C21B0" style="text-transform:uppercase;font-family:ui-monospace,monospace;letter-spacing:1px" value="${esc(codigoInicial)}" required>
        <button class="btn btn-pri">${ic('search')} Validar</button></div></label>
    </form>
    <div class="sep">ou confira a integridade do arquivo</div>
    <div class="drop" id="drop-val">${ic('file')}<div><b>Arraste o arquivo recebido aqui</b> ou clique para selecionar</div>
      <small>O arquivo não é enviado — apenas sua impressão digital (SHA-256) é comparada.</small>
      <input type="file" hidden></div>
    <div id="res-val"></div>
    <div class="auth-links"><button class="btn-link" id="voltar">← ${logado ? 'Voltar ao portal' : 'Ir para o login'}</button></div>
  </div></div>`;
  $('#voltar').onclick = () => { history.replaceState(null, '', location.pathname); logado ? entrar() : viewLogin(); };
  const res = $('#res-val');
  const mostrar = (r, origem) => {
    if (!r) {
      res.innerHTML = `<div class="valid-res erro"><h3>${ic('xc')} ${origem === 'hash' ? 'Arquivo não reconhecido' : 'Código não encontrado'}</h3>
        <p style="margin:0">${origem === 'hash' ? 'Este arquivo não corresponde a nenhum documento emitido — ele pode ter sido alterado.' : 'Confira o código digitado. Se o problema persistir, entre em contato com a Éllu Ambiental.'}</p></div>`;
      return;
    }
    const subst = r.status === 'substituido' || r.revisao < r.revisao_vigente;
    const cls = r.status === 'cancelado' ? 'erro' : subst ? 'alerta' : 'ok';
    const tit = r.status === 'cancelado' ? `${ic('xc')} Relatório cancelado`
      : subst ? `${ic('alert')} Autêntico, porém substituído pela revisão ${r.revisao_vigente}`
      : `${ic('shield')} Relatório autêntico e vigente`;
    res.innerHTML = `<div class="valid-res ${cls}"><h3>${tit}</h3><dl>
      <dt>Relatório</dt><dd>${esc(r.numero)} — Rev. ${r.revisao}</dd>
      <dt>Cliente</dt><dd>${esc(r.cliente)}</dd>
      <dt>Data da coleta</dt><dd>${fmtData(r.data_coleta)}</dd>
      <dt>Data de emissão</dt><dd>${fmtData(r.data_emissao)}</dd>
      <dt>Arquivos</dt><dd>${(r.arquivos || []).map(a => `<div style="margin-bottom:6px">${esc(a.nome)}<br><span class="codigo" style="font-size:10px">${esc(a.hash)}</span></div>`).join('') || '—'}</dd></dl>
      ${origem === 'hash' ? `<p style="margin:10px 0 0;font-size:13px">O arquivo <b>${esc(r.arquivo || '')}</b> é idêntico ao emitido pelo laboratório.</p>` : ''}</div>`;
  };
  const porCodigo = async () => {
    const c = $('#f-val').codigo.value.trim(); if (!c) return;
    await comBotao($('#f-val button'), async () => { try { mostrar(await API.validar(c), 'codigo'); } catch (e) { toast(traduzErro(e), 'erro'); } });
  };
  $('#f-val').onsubmit = e => { e.preventDefault(); porCodigo(); };
  ligarDrop($('#drop-val'), async f => {
    res.innerHTML = '<div class="loading"><div class="spin dark"></div></div>';
    try { mostrar(await API.validarHash(await sha256(f)), 'hash'); } catch (e) { res.innerHTML = ''; toast(traduzErro(e), 'erro'); }
  });
  if (codigoInicial) porCodigo();
}

function ligarDrop(el, onFile, multi = false) {
  const inp = $('input[type=file]', el);
  inp.accept = ACCEPT; if (multi) inp.multiple = true;
  const entregar = lista => {
    const fs = [...lista].filter(f => TIPOS_OK.test(f.name));
    if (fs.length < lista.length) toast('Tipo de arquivo não aceito (use PDF, Excel, Word, CSV, imagem ou ZIP).', 'erro');
    if (fs.length) multi ? onFile(fs) : onFile(fs[0]);
  };
  el.onclick = e => { if (!e.target.closest('[data-rm]')) inp.click(); };
  inp.onclick = e => e.stopPropagation();
  inp.onchange = () => { entregar(inp.files); inp.value = ''; };
  el.ondragover = e => { e.preventDefault(); el.classList.add('over'); };
  el.ondragleave = () => el.classList.remove('over');
  el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); entregar(e.dataTransfer.files); };
}

/* ---------------------------------------------------------------------
   Estrutura do app (topo + menu)
   --------------------------------------------------------------------- */
function shell(conteudo) {
  const p = S.perfil;
  app().innerHTML = `${demoFlag()}<header class="topbar">
    <div class="marca">ÉLLU <b>AMBIENTAL</b><small>${isAdmin() ? 'Administração de relatórios' : 'Portal do Cliente'}</small></div>
    <div class="user-menu"><button class="user-btn" id="ub"><span class="avatar">${esc(iniciais(p.nome || p.email))}</span>
      <span class="hide-sm">${esc(p.nome || p.email)}</span>${ic('chev')}</button>
      <div class="dropdown hidden" id="dd">
        <div class="dd-head"><b>${esc(p.nome || '')}</b><small>${esc(p.email || '')}</small>${p.cliente ? `<small>${esc(p.cliente.nome)}</small>` : ''}</div>
        <button id="m-senha">${ic('key')} Alterar senha</button>
        <button id="m-validar">${ic('shield')} Validar relatório</button>
        <button id="m-sair">${ic('logout')} Sair</button>
      </div></div></header>
    <main class="main">${conteudo}</main>`;
  const dd = $('#dd');
  $('#ub').onclick = e => { e.stopPropagation(); dd.classList.toggle('hidden'); };
  document.onclick = e => { if (!dd.contains(e.target)) dd.classList.add('hidden'); };
  $('#m-sair').onclick = sair;
  $('#m-validar').onclick = () => viewValidar();
  $('#m-senha').onclick = modalSenha;
}

function modalSenha() {
  const m = modal('Alterar senha', `<form id="f-ns" style="display:flex;flex-direction:column;gap:12px">${formSenhaHtml()}</form>`,
    `<button class="btn" data-fechar>Cancelar</button><button class="btn btn-pri" id="salvar">Salvar</button>`, 'sm');
  $('#salvar', m.el).onclick = async e => {
    const f = $('#f-ns', m.el); const v = validarSenha(f); if (v) return toast(v, 'erro');
    await comBotao(e.currentTarget, async () => {
      try { await API.novaSenha(f.s1.value); m.fechar(); toast('Senha alterada.', 'ok'); } catch (err) { toast(traduzErro(err), 'erro'); }
    });
  };
}

/* ---------------------------------------------------------------------
   Lista de relatórios (compartilhada cliente/admin)
   --------------------------------------------------------------------- */
function filtrados() {
  const f = S.filtros, q = norm(f.q);
  let l = S.relatorios.filter(r =>
    (f.status === 'todos' || r.status === f.status) &&
    (!f.ano || (r.data_emissao || '').startsWith(f.ano)) &&
    (!f.matriz || r.matriz === f.matriz) &&
    (!f.cliente || r.cliente_id === f.cliente) &&
    (!q || norm([r.numero, r.titulo, r.projeto, r.ponto_coleta, r.matriz, r.cliente?.nome, r.codigo_validacao].join(' ')).includes(q)));
  const { k, dir } = S.sort;
  l.sort((a, b) => String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'pt-BR', { numeric: true }) * dir || b.revisao - a.revisao);
  return l;
}

function toolbarHtml() {
  const anos = [...new Set(S.relatorios.map(r => (r.data_emissao || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const matrizes = [...new Set(S.relatorios.map(r => r.matriz).filter(Boolean))].sort();
  const f = S.filtros;
  const opt = (v, t, sel) => `<option value="${esc(v)}"${v === sel ? ' selected' : ''}>${esc(t)}</option>`;
  return `<div class="toolbar">
    <div class="busca">${ic('search')}<input class="in" id="f-q" placeholder="Buscar por nº, projeto, ponto, matriz${isAdmin() ? ', cliente' : ''}…" value="${esc(f.q)}"></div>
    ${isAdmin() ? `<select class="in" id="f-cliente">${opt('', 'Todos os clientes', f.cliente)}${S.clientes.map(c => opt(c.id, c.nome, f.cliente)).join('')}</select>` : ''}
    <select class="in" id="f-ano">${opt('', 'Todos os anos', f.ano)}${anos.map(a => opt(a, a, f.ano)).join('')}</select>
    <select class="in" id="f-matriz">${opt('', 'Todas as matrizes', f.matriz)}${matrizes.map(m => opt(m, m, f.matriz)).join('')}</select>
    <select class="in" id="f-status">${opt('vigente', 'Vigentes', f.status)}${opt('substituido', 'Substituídos', f.status)}${isAdmin() ? opt('cancelado', 'Cancelados', f.status) : ''}${opt('todos', 'Todos os status', f.status)}</select>
  </div><div id="sel-bar"></div><div id="lista"></div>`;
}

function ligarToolbar() {
  let t;
  $('#f-q').oninput = e => { clearTimeout(t); t = setTimeout(() => { S.filtros.q = e.target.value; S.pagina = 1; renderLista(); }, 180); };
  ['cliente', 'ano', 'matriz', 'status'].forEach(k => {
    const el = $('#f-' + k); if (el) el.onchange = () => { S.filtros[k] = el.value; S.pagina = 1; renderLista(); };
  });
}

const statusBadge = s => `<span class="badge b-${s}">${{ vigente: 'Vigente', substituido: 'Substituído', cancelado: 'Cancelado' }[s] || s}</span>`;

function renderLista() {
  const l = filtrados();
  const paginas = Math.max(1, Math.ceil(l.length / POR_PAG));
  if (S.pagina > paginas) S.pagina = paginas;
  const pag = l.slice((S.pagina - 1) * POR_PAG, S.pagina * POR_PAG);
  const revs = n => S.relatorios.filter(x => x.numero === n).length;
  const th = (k, t) => `<th class="sort" data-k="${k}">${t}${S.sort.k === k ? (S.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  const todosSel = pag.length && pag.every(r => S.sel.has(r.id));
  const adm = isAdmin();

  $('#lista').innerHTML = !l.length
    ? `<div class="vazio">${ic('file')}<div>${S.relatorios.length ? 'Nenhum relatório encontrado com esses filtros.' : 'Ainda não há relatórios disponíveis.'}</div></div>`
    : `<div class="tb-wrap"><table class="tb resp"><thead><tr>
        <th style="width:32px"><input type="checkbox" id="ck-all"${todosSel ? ' checked' : ''} aria-label="Selecionar página"></th>
        ${th('numero', 'Relatório')}${adm ? th('cliente_id', 'Cliente') : ''}${th('projeto', 'Projeto / Ponto')}${th('matriz', 'Matriz')}
        ${th('data_coleta', 'Coleta')}${th('data_emissao', 'Emissão')}<th>Status</th><th></th></tr></thead><tbody>
      ${pag.map(r => `<tr data-id="${r.id}">
        <td class="ck"><input type="checkbox" class="ck-r"${S.sel.has(r.id) ? ' checked' : ''} aria-label="Selecionar"></td>
        <td data-l="Relatório"><div class="num">${esc(r.numero)}</div><div class="sub">Rev. ${r.revisao}${r.titulo ? ' · ' + esc(r.titulo) : ''}${r.arquivos.length > 1 ? ` · <span title="Arquivos">${ic('clip', 'i i-sm')}${r.arquivos.length}</span>` : ''}</div></td>
        ${adm ? `<td data-l="Cliente">${esc(r.cliente?.nome || '—')}</td>` : ''}
        <td data-l="Projeto / Ponto"><div>${esc(r.projeto || '—')}</div><div class="sub">${esc(r.ponto_coleta || '')}</div></td>
        <td data-l="Matriz">${esc(r.matriz || '—')}</td>
        <td data-l="Coleta">${fmtData(r.data_coleta)}</td>
        <td data-l="Emissão">${fmtData(r.data_emissao)}</td>
        <td data-l="Status">${statusBadge(r.status)}</td>
        <td class="acoes">
          <button class="icon-btn" data-a="ver" title="${r.arquivos.length > 1 ? 'Ver arquivos' : 'Visualizar'}">${ic('eye')}</button>
          <button class="icon-btn" data-a="baixar" title="${r.arquivos.length > 1 ? 'Baixar todos (ZIP)' : 'Baixar'}">${ic('download')}</button>
          ${revs(r.numero) > 1 ? `<button class="icon-btn" data-a="hist" title="Histórico de revisões">${ic('history')}</button>` : ''}
          <button class="icon-btn" data-a="info" title="Detalhes e código de validação">${ic('qr')}</button>
          ${adm ? `<button class="icon-btn" data-a="rev" title="Publicar nova revisão">${ic('upload')}</button>
            ${r.status === 'cancelado' ? `<button class="icon-btn" data-a="reativar" title="Reativar">${ic('undo')}</button>`
              : `<button class="icon-btn" data-a="cancelar" title="Cancelar relatório">${ic('ban')}</button>`}` : ''}
        </td></tr>`).join('')}
      </tbody></table></div>
      <div class="paginacao"><span>${l.length} relatório${l.length > 1 ? 's' : ''}${paginas > 1 ? ` · página ${S.pagina} de ${paginas}` : ''}</span>
        ${paginas > 1 ? `<span style="display:flex;gap:6px"><button class="btn btn-sm" id="pg-a"${S.pagina === 1 ? ' disabled' : ''}>Anterior</button>
        <button class="btn btn-sm" id="pg-p"${S.pagina === paginas ? ' disabled' : ''}>Próxima</button></span>` : ''}</div>`;

  $$('#lista th.sort').forEach(h => h.onclick = () => {
    const k = h.dataset.k; S.sort = { k, dir: S.sort.k === k ? -S.sort.dir : (k.startsWith('data') ? -1 : 1) }; renderLista();
  });
  $('#pg-a') && ($('#pg-a').onclick = () => { S.pagina--; renderLista(); });
  $('#pg-p') && ($('#pg-p').onclick = () => { S.pagina++; renderLista(); });
  $('#ck-all') && ($('#ck-all').onchange = e => { pag.forEach(r => e.target.checked ? S.sel.add(r.id) : S.sel.delete(r.id)); renderLista(); });
  $$('#lista tr[data-id]').forEach(tr => {
    const r = S.relatorios.find(x => x.id === tr.dataset.id);
    $('.ck-r', tr).onchange = e => { e.target.checked ? S.sel.add(r.id) : S.sel.delete(r.id); renderSelBar(); $('#ck-all').checked = pag.every(x => S.sel.has(x.id)); };
    $$('[data-a]', tr).forEach(b => b.onclick = () => acao(b.dataset.a, r, b));
  });
  renderSelBar();
}

function renderSelBar() {
  const n = S.sel.size, bar = $('#sel-bar');
  bar.innerHTML = n ? `<div class="sel-bar">${n} selecionado${n > 1 ? 's' : ''}
    <button class="btn btn-sm btn-pri" id="zip">${ic('download')} Baixar ZIP</button>
    <button class="btn-link" id="limpar-sel">Limpar seleção</button></div>` : '';
  if (n) { $('#zip').onclick = e => baixarZip(e.currentTarget); $('#limpar-sel').onclick = () => { S.sel.clear(); renderLista(); }; }
}

async function abrirArquivo(r, a) {
  const w = window.open('', '_blank');
  try {
    const url = await API.abrirUrl(a);
    if (w) w.location = url; else location.href = url;
    API.log(r, 'visualizar', a);
  } catch (e) { if (w) w.close(); throw e; }
}

async function baixarArquivo(r, a, nome) {
  baixarBlob(await API.blob(a), nome || a.arquivo_nome);
  API.log(r, 'download', a);
}

async function zipRelatorios(lista, nomeZip) {
  const zip = new JSZip();
  for (const r of lista) {
    if (r.arquivos.length === 1) { zip.file(nomeUnico(r, r.arquivos[0]), await API.blob(r.arquivos[0])); API.log(r, 'download', r.arquivos[0]); continue; }
    const pasta = lista.length === 1 ? zip : zip.folder(`${safe(r.numero)}_rev${r.revisao}`);
    for (const a of r.arquivos) { pasta.file(safe(a.arquivo_nome), await API.blob(a)); API.log(r, 'download', a); }
  }
  baixarBlob(await zip.generateAsync({ type: 'blob' }), nomeZip);
}

async function acao(a, r, btn) {
  try {
    if (!r.arquivos.length && (a === 'ver' || a === 'baixar')) return toast('Este relatório não possui arquivos.', 'erro');
    if (a === 'ver') {
      if (r.arquivos.length === 1) await abrirArquivo(r, r.arquivos[0]); else modalInfo(r);
    } else if (a === 'baixar') {
      await comBotao(btn, async () => {
        if (r.arquivos.length === 1) await baixarArquivo(r, r.arquivos[0], nomeUnico(r, r.arquivos[0]));
        else await zipRelatorios([r], `${safe(r.numero)}_rev${r.revisao}.zip`);
      });
    } else if (a === 'hist') modalHistorico(r.numero);
    else if (a === 'info') modalInfo(r);
    else if (a === 'rev') modalPublicar(r);
    else if (a === 'cancelar') {
      if (!await confirmar('Cancelar relatório', `O relatório <b>${esc(r.numero)} rev. ${r.revisao}</b> deixará de aparecer para o cliente e a validação pública indicará <b>cancelado</b>.`, 'Cancelar relatório', true)) return;
      await API.atualizarRelatorio(r.id, { status: 'cancelado' }); r.status = 'cancelado'; toast('Relatório cancelado.'); renderLista();
    } else if (a === 'reativar') {
      const temMaior = S.relatorios.some(x => x.numero === r.numero && x.revisao > r.revisao && x.status !== 'cancelado');
      await API.atualizarRelatorio(r.id, { status: temMaior ? 'substituido' : 'vigente' });
      r.status = temMaior ? 'substituido' : 'vigente'; toast('Relatório reativado.', 'ok'); renderLista();
    }
  } catch (e) { toast(traduzErro(e), 'erro'); }
}

async function baixarZip(btn) {
  const itens = S.relatorios.filter(r => S.sel.has(r.id) && r.arquivos.length);
  await comBotao(btn, async () => {
    try { await zipRelatorios(itens, `relatorios_${hoje()}.zip`); toast(`${itens.length} relatório(s) baixado(s).`, 'ok'); }
    catch (e) { toast(traduzErro(e), 'erro'); }
  });
}

function modalHistorico(numero) {
  const l = S.relatorios.filter(r => r.numero === numero).sort((a, b) => b.revisao - a.revisao);
  const m = modal(`Histórico — ${esc(numero)}`, `<div class="hist">${l.map(r => `<div class="hist-item" data-id="${r.id}">
      <div><b>Revisão ${r.revisao}</b> ${statusBadge(r.status)}<div class="sub" style="color:var(--muted);font-size:12px">Emitido em ${fmtData(r.data_emissao)}${r.motivo_revisao ? ' · ' + esc(r.motivo_revisao) : ''}</div></div>
      <div><button class="icon-btn" data-a="ver" title="Visualizar">${ic('eye')}</button><button class="icon-btn" data-a="baixar" title="Baixar">${ic('download')}</button></div>
    </div>`).join('')}</div>`, '', 'sm');
  $$('.hist-item', m.el).forEach(it => {
    const r = l.find(x => x.id === it.dataset.id);
    $$('[data-a]', it).forEach(b => b.onclick = () => acao(b.dataset.a, r, b));
  });
}

function arquivosHtml(r) {
  const adm = isAdmin();
  return r.arquivos.map((a, i) => `<div class="hist-item" data-aid="${a.id}">
      <div style="min-width:0"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">${ic('file')}<b style="word-break:break-all">${esc(a.arquivo_nome)}</b>${i === 0 ? '<span class="badge b-admin">Principal</span>' : ''}</div>
        <div style="color:var(--muted);font-size:12px;margin-top:2px">${fmtBytes(a.tamanho_bytes)} · SHA-256 <span class="codigo" style="font-size:10px;word-break:break-all">${esc(a.hash_sha256 || '')}</span></div></div>
      <div style="white-space:nowrap"><button class="icon-btn" data-fa="ver" title="Visualizar">${ic('eye')}</button><button class="icon-btn" data-fa="baixar" title="Baixar">${ic('download')}</button>
        ${adm && r.arquivos.length > 1 ? `<button class="icon-btn" data-fa="rm" title="Remover arquivo">${ic('trash')}</button>` : ''}</div>
    </div>`).join('');
}

function modalInfo(r, titulo = 'Detalhes do relatório') {
  const link = linkValidacao(r.codigo_validacao);
  const m = modal(titulo, `
    <div class="qr-box"><div id="qr"></div><div style="flex:1;min-width:200px">
      <div style="color:var(--muted);font-size:12px">Código de validação</div>
      <div style="font-size:22px;font-weight:700;font-family:ui-monospace,monospace;letter-spacing:2px;color:var(--azul)">${esc(r.codigo_validacao)}</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-sm" id="cp-cod">${ic('copy')} Copiar código</button><button class="btn btn-sm" id="cp-link">${ic('copy')} Copiar link</button></div>
      <div style="color:var(--muted);font-size:12px;margin-top:8px">Terceiros podem conferir a autenticidade deste relatório pelo QR code ou pelo código.</div>
    </div></div>
    <div class="valid-res" style="background:#fafbfc;border:1px solid var(--borda)"><dl>
      <dt>Relatório</dt><dd>${esc(r.numero)} — Rev. ${r.revisao} ${statusBadge(r.status)}</dd>
      ${isAdmin() ? `<dt>Cliente</dt><dd>${esc(r.cliente?.nome || '')}</dd>` : ''}
      <dt>Título</dt><dd>${esc(r.titulo || '—')}</dd><dt>Projeto</dt><dd>${esc(r.projeto || '—')}</dd>
      <dt>Ponto</dt><dd>${esc(r.ponto_coleta || '—')}</dd><dt>Matriz</dt><dd>${esc(r.matriz || '—')}</dd>
      <dt>Coleta</dt><dd>${fmtData(r.data_coleta)}</dd><dt>Emissão</dt><dd>${fmtData(r.data_emissao)}</dd>
      ${r.motivo_revisao ? `<dt>Motivo da revisão</dt><dd>${esc(r.motivo_revisao)}</dd>` : ''}</dl></div>
    <div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <b>Arquivos (${r.arquivos.length})</b>
      ${isAdmin() ? `<span><button class="btn btn-sm" id="add-arq">${ic('plus')} Adicionar arquivo</button><input type="file" id="inp-add" multiple hidden accept="${ACCEPT}"></span>` : ''}</div>
      <div class="hist" id="lst-arq">${arquivosHtml(r)}</div></div>`,
    `<button class="btn" data-fechar>Fechar</button><button class="btn btn-pri" id="dl">${ic('download')} ${r.arquivos.length > 1 ? 'Baixar todos (ZIP)' : 'Baixar'}</button>`);
  try { new QRCode($('#qr', m.el), { text: link, width: 116, height: 116, correctLevel: QRCode.CorrectLevel.M }); } catch (_) {}
  const copiar = (t, msg) => navigator.clipboard.writeText(t).then(() => toast(msg, 'ok'), () => prompt('Copie:', t));
  $('#cp-cod', m.el).onclick = () => copiar(r.codigo_validacao, 'Código copiado.');
  $('#cp-link', m.el).onclick = () => copiar(link, 'Link de validação copiado.');
  $('#dl', m.el).onclick = e => acao('baixar', r, e.currentTarget);
  const reabrir = () => { m.fechar(); renderLista(); modalInfo(r, titulo); };
  $$('#lst-arq [data-aid]', m.el).forEach(it => {
    const a = r.arquivos.find(x => String(x.id) === it.dataset.aid);
    $$('[data-fa]', it).forEach(b => b.onclick = async () => {
      try {
        if (b.dataset.fa === 'ver') await abrirArquivo(r, a);
        else if (b.dataset.fa === 'baixar') await comBotao(b, () => baixarArquivo(r, a));
        else if (b.dataset.fa === 'rm') {
          if (!await confirmar('Remover arquivo', `Remover <b>${esc(a.arquivo_nome)}</b> do relatório ${esc(r.numero)} rev. ${r.revisao}? O arquivo será apagado definitivamente.`, 'Remover', true)) return;
          await API.removerArquivo(a); r.arquivos = r.arquivos.filter(x => x !== a); toast('Arquivo removido.'); reabrir();
        }
      } catch (e) { toast(traduzErro(e), 'erro'); }
    });
  });
  if (isAdmin()) {
    const inp = $('#inp-add', m.el);
    $('#add-arq', m.el).onclick = () => inp.click();
    inp.onchange = async () => {
      const fs = [...inp.files]; inp.value = '';
      const itens = await prepararItens(fs); if (!itens.length) return;
      await comBotao($('#add-arq', m.el), async () => {
        try { const novos = await API.adicionarArquivos(r, itens); r.arquivos.push(...novos); toast(`${novos.length} arquivo(s) adicionado(s).`, 'ok'); reabrir(); }
        catch (e) { toast(traduzErro(e), 'erro'); }
      });
    };
  }
}

// valida tipo/tamanho, calcula SHA-256 e avisa sobre arquivos já publicados
async function prepararItens(files, jaNaLista = []) {
  const out = [];
  for (const f of files) {
    if (!TIPOS_OK.test(f.name)) { toast(`${f.name}: tipo não aceito.`, 'erro'); continue; }
    if (f.size > MAX_ARQ) { toast(`${f.name}: acima de 50 MB.`, 'erro'); continue; }
    const hash = await sha256(f);
    if (jaNaLista.some(x => x.hash === hash) || out.some(x => x.hash === hash)) { toast(`${f.name} já está na lista.`, 'erro'); continue; }
    const dup = achaHash(hash);
    if (dup) toast(`Atenção: ${f.name} já foi publicado em ${dup.r.numero} rev. ${dup.r.revisao}.`, 'erro');
    out.push({ file: f, hash });
  }
  return out;
}

/* ---------------------------------------------------------------------
   Área do cliente
   --------------------------------------------------------------------- */
async function viewCliente() {
  S.relatorios = await API.relatorios();
  const c = S.perfil.cliente || {};
  const vig = S.relatorios.filter(r => r.status === 'vigente');
  const ano = String(new Date().getFullYear());
  const ultimo = vig.map(r => r.data_emissao).sort().pop();
  shell(`<div class="page-head"><div><h1>Relatórios de ensaio</h1><p>${esc(c.nome || '')}${c.cnpj ? ' · CNPJ ' + esc(c.cnpj) : ''}</p></div></div>
    <div class="stats">
      <div class="stat"><div class="v">${vig.length}</div><div class="l">Relatórios vigentes</div></div>
      <div class="stat"><div class="v">${vig.filter(r => (r.data_emissao || '').startsWith(ano)).length}</div><div class="l">Emitidos em ${ano}</div></div>
      <div class="stat"><div class="v">${fmtData(ultimo)}</div><div class="l">Última emissão</div></div>
      <div class="stat"><div class="v">${S.relatorios.filter(r => r.status === 'substituido').length}</div><div class="l">Revisões anteriores</div></div>
    </div>
    <div class="card">${toolbarHtml()}</div>`);
  ligarToolbar(); renderLista();
}

/* ---------------------------------------------------------------------
   Área administrativa
   --------------------------------------------------------------------- */
async function viewAdmin() {
  [S.relatorios, S.clientes, S.perfis] = await Promise.all([API.relatorios(), API.clientes(), API.perfis()]);
  S.filtros.status = S.filtros.status || 'vigente';
  shell(`<div class="page-head"><div><h1>Administração</h1><p>Publicação de relatórios, clientes e acessos</p></div>
      <div id="head-acoes"></div></div>
    <nav class="tabs">${[['relatorios', 'Relatórios'], ['clientes', 'Clientes'], ['usuarios', 'Usuários'], ['acessos', 'Registro de acessos']]
      .map(([k, t]) => `<button class="tab${S.aba === k ? ' ativo' : ''}" data-aba="${k}">${t}</button>`).join('')}</nav>
    <div id="aba"></div>`);
  $$('.tab').forEach(b => b.onclick = () => { S.aba = b.dataset.aba; $$('.tab').forEach(x => x.classList.toggle('ativo', x === b)); renderAba(); });
  renderAba();
}

function renderAba() {
  const head = $('#head-acoes'), aba = $('#aba');
  if (S.aba === 'relatorios') {
    head.innerHTML = `<button class="btn btn-verde" id="novo-rel">${ic('plus')} Publicar relatório</button>`;
    $('#novo-rel').onclick = () => modalPublicar();
    aba.innerHTML = `<div class="card">${toolbarHtml()}</div>`;
    ligarToolbar(); renderLista();
  } else if (S.aba === 'clientes') {
    head.innerHTML = `<button class="btn btn-verde" id="novo-cli">${ic('plus')} Novo cliente</button>`;
    $('#novo-cli').onclick = () => modalCliente();
    const cont = id => ({ rel: S.relatorios.filter(r => r.cliente_id === id && r.status === 'vigente').length, usu: S.perfis.filter(p => p.cliente_id === id).length });
    aba.innerHTML = `<div class="card"><div class="tb-wrap"><table class="tb resp"><thead><tr><th>Cliente</th><th>CNPJ</th><th>Contato</th><th>Relatórios</th><th>Usuários</th><th>Situação</th><th></th></tr></thead><tbody>
      ${S.clientes.map(c => { const n = cont(c.id); return `<tr data-id="${c.id}"><td data-l="Cliente"><b>${esc(c.nome)}</b></td><td data-l="CNPJ">${esc(c.cnpj || '—')}</td>
        <td data-l="Contato">${esc(c.email_contato || '—')}</td><td data-l="Relatórios">${n.rel}</td><td data-l="Usuários">${n.usu}</td>
        <td data-l="Situação">${c.ativo ? '<span class="badge b-vigente">Ativo</span>' : '<span class="badge b-inativo">Inativo</span>'}</td>
        <td class="acoes"><button class="icon-btn" data-a="ver-rel" title="Ver relatórios">${ic('file')}</button><button class="icon-btn" data-a="edit" title="Editar">${ic('edit')}</button></td></tr>`; }).join('')
      || '<tr><td colspan="7" class="vazio">Nenhum cliente cadastrado.</td></tr>'}</tbody></table></div></div>`;
    $$('#aba tr[data-id]').forEach(tr => {
      const c = S.clientes.find(x => x.id === tr.dataset.id);
      $('[data-a=edit]', tr).onclick = () => modalCliente(c);
      $('[data-a=ver-rel]', tr).onclick = () => { S.filtros.cliente = c.id; S.aba = 'relatorios'; $$('.tab').forEach(x => x.classList.toggle('ativo', x.dataset.aba === 'relatorios')); renderAba(); };
    });
  } else if (S.aba === 'usuarios') {
    head.innerHTML = `<button class="btn btn-verde" id="novo-usu">${ic('plus')} Convidar usuário</button>`;
    $('#novo-usu').onclick = () => modalUsuario();
    const st = S.statusU || {};
    const acesso = p => {
      if (!S.statusU) return '<span class="sub" style="color:var(--muted)">…</span>';
      const x = st[p.id]; if (!x) return '—';
      return x.confirmado ? (x.ultimo_acesso ? `<span class="sub" style="color:var(--muted)">Último acesso ${fmtDataHora(x.ultimo_acesso)}</span>` : 'Ativado')
        : '<span class="badge b-substituido">Convite pendente</span>';
    };
    aba.innerHTML = `<div class="card"><div class="tb-wrap"><table class="tb resp"><thead><tr><th>Nome</th><th>E-mail</th><th>Cliente</th><th>Perfil</th><th>Acesso</th><th>Situação</th><th></th></tr></thead><tbody>
      ${S.perfis.map(p => `<tr data-id="${p.id}"><td data-l="Nome"><b>${esc(p.nome || '—')}</b></td><td data-l="E-mail">${esc(p.email || '')}</td>
        <td data-l="Cliente">${p.papel === 'admin' ? '—' : p.cliente ? esc(p.cliente.nome) : '<span class="badge b-substituido">Sem vínculo</span>'}</td>
        <td data-l="Perfil">${p.papel === 'admin' ? '<span class="badge b-admin">Admin Éllu</span>' : 'Cliente'}</td>
        <td data-l="Acesso">${acesso(p)}</td>
        <td data-l="Situação">${p.ativo ? '<span class="badge b-vigente">Ativo</span>' : '<span class="badge b-inativo">Inativo</span>'}</td>
        <td class="acoes"><button class="icon-btn" data-a="edit" title="Editar">${ic('edit')}</button>
          <button class="icon-btn" data-a="reenviar" title="${st[p.id]?.confirmado ? 'Enviar link para redefinir senha' : 'Reenviar convite'}">${ic('mail')}</button>
          ${p.id !== S.perfil.id ? `<button class="icon-btn" data-a="excluir" title="Excluir usuário">${ic('trash')}</button>` : ''}</td></tr>`).join('')
      || '<tr><td colspan="7" class="vazio">Nenhum usuário.</td></tr>'}</tbody></table></div></div>`;
    $$('#aba tr[data-id]').forEach(tr => {
      const p = S.perfis.find(x => x.id === tr.dataset.id);
      $('[data-a=edit]', tr).onclick = () => modalUsuario(p);
      $('[data-a=reenviar]', tr).onclick = async e => {
        const btn = e.currentTarget;
        await comBotao(btn, async () => {
          try {
            const r = await API.reenviar(p.id);
            toast(r?.tipo === 'senha' ? `Link para definir senha enviado para ${p.email}.` : `Convite reenviado para ${p.email}.`, 'ok');
          } catch (err) { toast(traduzErro(err), 'erro'); }
        });
      };
      const ex = $('[data-a=excluir]', tr);
      if (ex) ex.onclick = async () => {
        if (!await confirmar('Excluir usuário', `<b>${esc(p.nome || p.email)}</b> (${esc(p.email)}) perderá o acesso ao portal definitivamente.<br><br>Os relatórios e o registro de acessos são mantidos. Se quiser apenas bloquear temporariamente, use <b>Editar → Acesso ativo</b>.`, 'Excluir usuário', true)) return;
        try {
          await API.excluirUsuario(p.id);
          S.perfis = S.perfis.filter(x => x.id !== p.id); renderAba(); toast('Usuário excluído.', 'ok');
        } catch (err) { toast(traduzErro(err), 'erro'); }
      };
    });
    if (!S.statusU) API.statusUsuarios().then(x => { S.statusU = x || {}; if (S.aba === 'usuarios') renderAba(); })
      .catch(() => { S.statusU = {}; if (S.aba === 'usuarios') renderAba(); });
  } else if (S.aba === 'acessos') {
    head.innerHTML = '';
    aba.innerHTML = '<div class="card"><div class="loading"><div class="spin dark"></div></div></div>';
    API.acessos().then(log => {
      const usu = id => S.perfis.find(p => p.id === id);
      const rel = id => S.relatorios.find(r => r.id === id);
      aba.innerHTML = `<div class="card"><div class="tb-wrap"><table class="tb resp"><thead><tr><th>Data/hora</th><th>Usuário</th><th>Cliente</th><th>Relatório</th><th>Ação</th></tr></thead><tbody>
        ${log.map(l => { const u = usu(l.user_id), r = rel(l.relatorio_id); return `<tr><td data-l="Data/hora">${fmtDataHora(l.created_at)}</td>
          <td data-l="Usuário">${esc(u?.nome || u?.email || '—')}</td><td data-l="Cliente">${esc(r?.cliente?.nome || '—')}</td>
          <td data-l="Relatório">${r ? esc(r.numero) + ' rev. ' + r.revisao : '—'}${(() => { const a = r?.arquivos.find(x => x.id === l.arquivo_id); return a && r.arquivos.length > 1 ? `<div class="sub">${esc(a.arquivo_nome)}</div>` : ''; })()}</td><td data-l="Ação">${l.acao === 'download' ? 'Download' : 'Visualização'}</td></tr>`; }).join('')
        || '<tr><td colspan="5" class="vazio">Nenhum acesso registrado ainda.</td></tr>'}</tbody></table></div>
        <div class="paginacao"><span>Últimos ${log.length} registros</span></div></div>`;
    }).catch(e => toast(traduzErro(e), 'erro'));
  }
}

function modalPublicar(base = null) {
  const revAtual = base ? Math.max(...S.relatorios.filter(r => r.numero === base.numero).map(r => r.revisao)) : null;
  const clientesAtivos = S.clientes.filter(c => c.ativo || c.id === base?.cliente_id);
  const v = (k, d = '') => esc(base ? base[k] ?? d : d);
  const m = modal(base ? `Nova revisão — ${esc(base.numero)}` : 'Publicar relatório de ensaio', `
    <form id="f-pub" style="display:flex;flex-direction:column;gap:12px">
      <div id="aviso-rev">${base ? `<div class="msg info">Revisão atual: <b>${revAtual}</b>. A nova revisão substituirá a anterior para o cliente; o histórico é mantido.</div>` : ''}</div>
      <label class="f">Cliente<select class="in" name="cliente_id" required${base ? ' disabled' : ''}><option value="">Selecione…</option>
        ${clientesAtivos.map(c => `<option value="${c.id}"${(base?.cliente_id || S.filtros.cliente) === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
      <div class="grid2">
        <label class="f">Nº do relatório<input class="in" name="numero" required value="${v('numero')}"${base ? ' readonly' : ''} placeholder="RE-${new Date().getFullYear()}-0001"></label>
        <label class="f">Revisão<input class="in" type="number" min="0" name="revisao" required value="${base ? revAtual + 1 : 0}"></label>
      </div>
      <label class="f">Título <span class="opt">(opcional)</span><input class="in" name="titulo" value="${v('titulo', 'Relatório de Ensaio')}"></label>
      <div class="grid2">
        <label class="f">Projeto / campanha <span class="opt">(opcional)</span><input class="in" name="projeto" value="${v('projeto')}" list="dl-proj"></label>
        <label class="f">Ponto de coleta <span class="opt">(opcional)</span><input class="in" name="ponto_coleta" value="${v('ponto_coleta')}" list="dl-ponto"></label>
      </div>
      <div class="grid3">
        <label class="f">Matriz<input class="in" name="matriz" value="${v('matriz')}" list="dl-matriz"></label>
        <label class="f">Data da coleta<input class="in" type="date" name="data_coleta" value="${v('data_coleta')}"></label>
        <label class="f">Data de emissão<input class="in" type="date" name="data_emissao" required value="${hoje()}"></label>
      </div>
      <label class="f">Código de validação <span class="opt">(opcional — use se já imprimiu um código no PDF; vazio = gerar automaticamente)</span>
        <input class="in" name="codigo_validacao" maxlength="20" style="text-transform:uppercase;font-family:ui-monospace,monospace" placeholder="Gerado automaticamente"></label>
      <label class="f" id="lb-motivo"${base ? '' : ' style="display:none"'}>Motivo da revisão<input class="in" name="motivo_revisao" placeholder="Ex.: correção da identificação da amostra"></label>
      <div><div style="font-weight:500;font-size:13px;margin-bottom:4px">Arquivos</div>
        <div class="drop" id="drop-pub">${ic('upload')}<div><b>Arraste os arquivos</b> ou clique para selecionar</div><small>PDF, Excel, Word, CSV, imagem ou ZIP · até 50 MB cada · o 1º é o relatório principal</small><input type="file" hidden></div>
        <div class="hist" id="lista-pub" style="margin-top:8px"></div></div>
      ${['projeto', 'ponto_coleta', 'matriz'].map(k => `<datalist id="dl-${k === 'ponto_coleta' ? 'ponto' : k === 'projeto' ? 'proj' : 'matriz'}">${[...new Set(S.relatorios.map(r => r[k]).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>`).join('')}
    </form>`,
    `<button class="btn" data-fechar>Cancelar</button><button class="btn btn-verde" id="pub">${ic('upload')} Publicar</button>`);
  const f = $('#f-pub', m.el);

  if (!base) f.numero.onblur = () => {
    const n = f.numero.value.trim(); const ex = S.relatorios.filter(r => r.numero === n);
    if (ex.length) {
      const mx = Math.max(...ex.map(r => r.revisao));
      f.revisao.value = mx + 1; f.cliente_id.value = ex[0].cliente_id;
      $('#aviso-rev', m.el).innerHTML = `<div class="msg info">Este número já existe (rev. ${mx}). Será publicada como <b>revisão ${mx + 1}</b>.</div>`;
      $('#lb-motivo', m.el).style.display = '';
    } else { $('#aviso-rev', m.el).innerHTML = ''; $('#lb-motivo', m.el).style.display = 'none'; }
  };

  let itens = [];
  const lista = $('#lista-pub', m.el);
  const renderItens = () => {
    lista.innerHTML = itens.map((it, i) => `<div class="hist-item"><div style="min-width:0">${ic('file')} <b style="word-break:break-all">${esc(it.file.name)}</b>
        ${i === 0 ? '<span class="badge b-admin">Principal</span>' : ''}<div style="color:var(--muted);font-size:12px">${fmtBytes(it.file.size)}</div></div>
      <div style="white-space:nowrap">${i > 0 ? `<button type="button" class="icon-btn" data-up="${i}" title="Tornar principal">${ic('undo')}</button>` : ''}
        <button type="button" class="icon-btn" data-rm="${i}" title="Remover">${ic('x')}</button></div></div>`).join('');
    $$('[data-rm]', lista).forEach(b => b.onclick = () => { itens.splice(+b.dataset.rm, 1); renderItens(); });
    $$('[data-up]', lista).forEach(b => b.onclick = () => { const [x] = itens.splice(+b.dataset.up, 1); itens.unshift(x); renderItens(); });
  };
  ligarDrop($('#drop-pub', m.el), async files => { itens = itens.concat(await prepararItens(files, itens)); renderItens(); }, true);

  $('#pub', m.el).onclick = async e => {
    const cliente_id = base ? base.cliente_id : f.cliente_id.value;
    const numero = f.numero.value.trim(), revisao = parseInt(f.revisao.value, 10);
    if (!cliente_id) return toast('Selecione o cliente.', 'erro');
    if (!numero) return toast('Informe o número do relatório.', 'erro');
    if (isNaN(revisao) || revisao < 0) return toast('Revisão inválida.', 'erro');
    if (!f.data_emissao.value) return toast('Informe a data de emissão.', 'erro');
    if (!itens.length) return toast('Adicione ao menos um arquivo.', 'erro');
    const outroCliente = S.relatorios.find(r => r.numero === numero && r.cliente_id !== cliente_id);
    if (outroCliente) return toast(`O nº ${numero} já pertence a outro cliente (${outroCliente.cliente?.nome}).`, 'erro');
    const ex = S.relatorios.filter(r => r.numero === numero);
    if (ex.length && revisao <= Math.max(...ex.map(r => r.revisao))) return toast('A revisão deve ser maior que a última publicada.', 'erro');
    if (ex.length && !f.motivo_revisao.value.trim()) return toast('Informe o motivo da revisão.', 'erro');
    const meta = {
      cliente_id, numero, revisao, titulo: f.titulo.value.trim() || null, projeto: f.projeto.value.trim() || null,
      ponto_coleta: f.ponto_coleta.value.trim() || null, matriz: f.matriz.value.trim() || null,
      data_coleta: f.data_coleta.value || null, data_emissao: f.data_emissao.value, motivo_revisao: f.motivo_revisao.value.trim() || null,
    };
    const codigo = f.codigo_validacao.value.trim().toUpperCase().replace(/\s+/g, '');
    if (codigo) {
      if (!/^[A-Z0-9-]{6,20}$/.test(codigo)) return toast('Código de validação: use 6 a 20 letras/números.', 'erro');
      if (S.relatorios.some(r => r.codigo_validacao === codigo)) return toast('Esse código de validação já está em uso.', 'erro');
      meta.codigo_validacao = codigo;
    }
    await comBotao(e.currentTarget, async () => {
      try {
        const novo = await API.publicar(meta, itens);
        S.relatorios.forEach(r => { if (r.numero === numero && r.revisao < revisao && r.status === 'vigente') r.status = 'substituido'; });
        S.relatorios.unshift(novo);
        m.fechar(); renderLista();
        toast('Relatório publicado.', 'ok');
        modalInfo(novo, 'Relatório publicado ✓');
      } catch (err) { toast(traduzErro(err), 'erro'); }
    });
  };
}

function modalCliente(c = null) {
  const m = modal(c ? 'Editar cliente' : 'Novo cliente', `<form id="f-cli" style="display:flex;flex-direction:column;gap:12px">
      <label class="f">Razão social / nome<input class="in" name="nome" required value="${esc(c?.nome || '')}"></label>
      <div class="grid2"><label class="f">CNPJ <span class="opt">(opcional)</span><input class="in" name="cnpj" value="${esc(c?.cnpj || '')}" placeholder="00.000.000/0000-00"></label>
      <label class="f">E-mail de contato <span class="opt">(opcional)</span><input class="in" type="email" name="email_contato" value="${esc(c?.email_contato || '')}"></label></div>
      ${c ? `<label class="chk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="ativo"${c.ativo ? ' checked' : ''}> Cliente ativo (desmarcar bloqueia o acesso de todos os usuários dele)</label>` : ''}
    </form>`, `<button class="btn" data-fechar>Cancelar</button><button class="btn btn-pri" id="salvar">Salvar</button>`, 'sm');
  const f = $('#f-cli', m.el);
  f.cnpj.oninput = () => {
    const d = f.cnpj.value.replace(/\D/g, '').slice(0, 14);
    f.cnpj.value = d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  };
  $('#salvar', m.el).onclick = async e => {
    if (!f.nome.value.trim()) return toast('Informe o nome do cliente.', 'erro');
    const dados = { nome: f.nome.value.trim(), cnpj: f.cnpj.value.trim() || null, email_contato: f.email_contato.value.trim() || null };
    if (c) { dados.id = c.id; dados.ativo = f.ativo.checked; }
    await comBotao(e.currentTarget, async () => {
      try {
        const salvo = await API.salvarCliente(dados);
        const i = S.clientes.findIndex(x => x.id === salvo.id);
        i >= 0 ? S.clientes[i] = salvo : S.clientes.push(salvo);
        S.clientes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        S.relatorios.forEach(r => { if (r.cliente_id === salvo.id) r.cliente = { nome: salvo.nome }; });
        m.fechar(); renderAba(); toast('Cliente salvo.', 'ok');
      } catch (err) { toast(traduzErro(err), 'erro'); }
    });
  };
}

function modalUsuario(p = null) {
  const opts = S.clientes.filter(c => c.ativo || c.id === p?.cliente_id).map(c => `<option value="${c.id}"${p?.cliente_id === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
  const m = modal(p ? 'Editar usuário' : 'Convidar usuário', `<form id="f-usu" style="display:flex;flex-direction:column;gap:12px">
      ${p ? '' : '<div class="msg info">O usuário receberá um e-mail com link para criar a própria senha.</div>'}
      <label class="f">Nome<input class="in" name="nome" required value="${esc(p?.nome || '')}"></label>
      <label class="f">E-mail<input class="in" type="email" name="email" required value="${esc(p?.email || '')}"${p ? ' readonly' : ''}></label>
      <label class="f">Perfil<select class="in" name="papel"><option value="cliente"${p?.papel !== 'admin' ? ' selected' : ''}>Cliente — vê apenas os relatórios da própria empresa</option>
        <option value="admin"${p?.papel === 'admin' ? ' selected' : ''}>Administrador Éllu — publica e gerencia tudo</option></select></label>
      <label class="f" id="lb-cli">Cliente<select class="in" name="cliente_id"><option value="">Selecione…</option>${opts}</select></label>
      ${p ? `<label class="chk" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="ativo"${p.ativo ? ' checked' : ''}> Acesso ativo</label>` : ''}
    </form>`, `<button class="btn" data-fechar>Cancelar</button><button class="btn btn-pri" id="salvar">${p ? 'Salvar' : 'Enviar convite'}</button>`, 'sm');
  const f = $('#f-usu', m.el);
  const sync = () => { $('#lb-cli', m.el).style.display = f.papel.value === 'admin' ? 'none' : ''; };
  f.papel.onchange = sync; sync();
  $('#salvar', m.el).onclick = async e => {
    const papel = f.papel.value, cliente_id = papel === 'admin' ? null : f.cliente_id.value || null;
    if (!f.nome.value.trim() || !f.email.value.trim()) return toast('Informe nome e e-mail.', 'erro');
    if (papel === 'cliente' && !cliente_id) return toast('Selecione o cliente.', 'erro');
    if (p && p.id === S.perfil.id && (papel !== 'admin' || !f.ativo.checked)) return toast('Você não pode remover seu próprio acesso de administrador.', 'erro');
    await comBotao(e.currentTarget, async () => {
      try {
        if (p) await API.salvarPerfil(p.id, { nome: f.nome.value.trim(), papel, cliente_id, ativo: f.ativo.checked });
        else await API.convidar({ nome: f.nome.value.trim(), email: f.email.value.trim().toLowerCase(), papel, cliente_id });
        S.perfis = await API.perfis(); if (!p) S.statusU = null;
        m.fechar(); renderAba(); toast(p ? 'Usuário atualizado.' : 'Convite enviado.', 'ok');
      } catch (err) { toast(traduzErro(err), 'erro'); }
    });
  };
}

if (DEMO || sb) iniciar().catch(e => { app().innerHTML = `<p style="padding:40px;color:#c0392b">Erro ao iniciar: ${esc(e.message || e)}</p>`; });
