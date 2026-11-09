import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Usa apenas APIs nativas do Node; não precisa instalar dependências.
const base = (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
const chave = process.env.SUPABASE_PUBLIC_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !chave || chave.startsWith('cole_')) {
  console.error('Configure as variáveis SUPABASE_URL/SUPABASE_PUBLIC_KEY ou EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  process.exit(1);
}
if (chave.startsWith('sb_secret_')) {
  console.error('Use somente a chave pública publishable ou anon.');
  process.exit(1);
}
if (chave.split('.').length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(chave.split('.')[1], 'base64url'));
    if (payload.role !== 'anon') throw new Error();
  } catch {
    console.error('A chave JWT deve ser a chave pública anon.');
    process.exit(1);
  }
}
const endereco = new URL(base);
if (endereco.protocol !== 'https:' || !endereco.hostname.endsWith('.supabase.co')) {
  console.error('Informe a URL HTTPS do seu projeto Supabase.');
  process.exit(1);
}

async function requisicao(caminho, { method = 'GET', token, body, prefer } = {}) {
  const resposta = await fetch(`${base}${caminho}`, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      apikey: chave,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const texto = await resposta.text();
  let data;
  try { data = texto ? JSON.parse(texto) : null; } catch { data = null; }
  return { ok: resposta.ok, status: resposta.status, data };
}

function sucesso(resposta, etapa) {
  const mensagem = resposta.data?.msg ?? resposta.data?.message ?? resposta.data?.error_description;
  assert.ok(resposta.ok, `${etapa}: HTTP ${resposta.status}, código ${resposta.data?.code ?? resposta.data?.error_code ?? 'não informado'}${mensagem ? `, mensagem: ${mensagem}` : ''}. Confira schema.sql e Anonymous Sign-Ins.`);
}

const sessoes = [];
const ids = [randomUUID(), randomUUID(), randomUUID()];
const tabela = '/rest/v1/medicamentos';
const filtro = `?sync_id=eq.${ids[0]}`;
let falhou = false;

try {
  const acessoPublico = await requisicao(`${tabela}?select=sync_id&limit=1`);
  assert.ok([401, 403].includes(acessoPublico.status), `A tabela deve negar leitura sem sessão (HTTP ${acessoPublico.status}, código ${acessoPublico.data?.code ?? acessoPublico.data?.error_code ?? 'não informado'}: ${acessoPublico.data?.message ?? 'sem mensagem'}). Confira URL, schema e permissões.`);
  console.log('OK: acesso sem sessão negado.');

  for (let i = 0; i < 2; i++) {
    const resposta = await requisicao('/auth/v1/signup', { method: 'POST', body: {} });
    sucesso(resposta, 'Autenticação anônima');
    assert.ok(resposta.data?.access_token && resposta.data?.user?.id, 'A autenticação não retornou uma sessão.');
    sessoes.push({ token: resposta.data.access_token, id: resposta.data.user.id });
  }
  const [a, b] = sessoes;
  console.log('OK: duas sessões anônimas criadas.');

  const registro = {
    sync_id: ids[0],
    nome: 'Teste de integração VidaMais',
    laboratorio: 'Laboratório temporário de teste',
    validade: '2030-12-31',
    indicacao: 'Indicação de teste',
    contraindicacoes: 'Contraindicação de teste',
    posologia: 'Uma dose de teste',
    efeitos_adversos: 'Efeito adverso de teste',
    precaucoes: 'Precaução de teste',
    observacoes: 'Registro temporário de teste automatizado.',
    texto_ocr: 'Teste OCR VAL 12/2030',
    leitura_em: new Date().toISOString(),
  };
  const criar = await requisicao(tabela, { method: 'POST', token: a.token, body: registro, prefer: 'return=representation' });
  sucesso(criar, 'Cadastro');
  assert.equal(criar.data?.[0]?.user_id, a.id, 'O proprietário deve vir da sessão.');
  const criado = criar.data[0];
  for (const campo of ['sync_id', 'nome', 'laboratorio', 'validade', 'indicacao', 'contraindicacoes', 'posologia', 'efeitos_adversos', 'precaucoes', 'observacoes', 'texto_ocr', 'leitura_em']) {
    assert.equal(criado[campo], registro[campo], `O campo ${campo} deve persistir no cadastro.`);
  }
  console.log('OK: cadastro e proprietário automático.');

  const registroEditado = { ...registro, nome: 'Teste editado', laboratorio: 'Laboratório revisado', posologia: 'Duas doses de teste' };
  const editar = await requisicao(`${tabela}?on_conflict=sync_id`, {
    method: 'POST', token: a.token,
    body: { ...registroEditado, created_at: '2000-01-01T00:00:00Z', updated_at: '2000-01-01T00:00:00Z' },
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  sucesso(editar, 'Upsert');
  const atualizacao = await requisicao(`${tabela}${filtro}`, {
    method: 'PATCH', token: a.token,
    body: { indicacao: 'Indicação atualizada via PATCH', created_at: '2000-01-01T00:00:00Z', updated_at: '2000-01-01T00:00:00Z' },
    prefer: 'return=representation',
  });
  sucesso(atualizacao, 'Atualização PATCH');
  assert.equal(atualizacao.data?.length, 1, 'O proprietário deve atualizar exatamente o próprio registro.');
  assert.equal(atualizacao.data[0].created_at, criado.created_at, 'A edição deve preservar created_at.');
  assert.ok(Date.parse(atualizacao.data[0].updated_at) > Date.parse('2000-01-01'), 'A edição deve atualizar updated_at no servidor.');
  registroEditado.indicacao = 'Indicação atualizada via PATCH';
  const consulta = await requisicao(`${tabela}${filtro}`, { token: a.token });
  sucesso(consulta, 'Consulta');
  assert.equal(consulta.data.length, 1, 'O upsert não deve duplicar o cadastro.');
  for (const campo of ['sync_id', 'nome', 'laboratorio', 'validade', 'indicacao', 'contraindicacoes', 'posologia', 'efeitos_adversos', 'precaucoes', 'observacoes', 'texto_ocr', 'leitura_em']) {
    assert.equal(consulta.data[0][campo], registroEditado[campo], `O campo ${campo} deve permanecer compatível no upsert/consulta.`);
  }
  assert.equal(consulta.data[0].created_at, criado.created_at);
  assert.ok(Date.parse(consulta.data[0].updated_at) > Date.parse('2000-01-01'));
  console.log('OK: edição sem duplicação e timestamps protegidos.');

  const invalido = await requisicao(tabela, { method: 'POST', token: a.token, body: { ...registro, sync_id: ids[1], nome: '   ' } });
  assert.equal(invalido.data?.code, '23514', 'Nome vazio deve ser recusado.');
  const validadeInvalida = await requisicao(tabela, { method: 'POST', token: a.token, body: { ...registro, sync_id: ids[1], validade: 'infinity' } });
  assert.equal(validadeInvalida.data?.code, '23514', 'Validade infinita deve ser recusada.');
  const forjado = await requisicao(tabela, { method: 'POST', token: a.token, body: { ...registro, sync_id: ids[2], user_id: b.id } });
  assert.equal(forjado.data?.code, '42501', 'Cadastro em nome de outro usuário deve ser recusado.');
  const identidadeAlterada = await requisicao(`${tabela}${filtro}`, {
    method: 'PATCH', token: a.token, body: { sync_id: ids[1] }, prefer: 'return=representation',
  });
  assert.equal(identidadeAlterada.data?.code, '23514', 'O sync_id não pode ser alterado depois da inclusão.');
  console.log('OK: constraints de nome/data/identidade e bloqueio de proprietário forjado.');

  const leituraB = await requisicao(`${tabela}${filtro}`, { token: b.token });
  sucesso(leituraB, 'Isolamento de leitura');
  assert.deepEqual(leituraB.data, [], 'Outro usuário não pode ler o registro.');
  for (const method of ['PATCH', 'DELETE']) {
    const resposta = await requisicao(`${tabela}${filtro}`, {
      method, token: b.token, prefer: 'return=representation',
      ...(method === 'PATCH' ? { body: { nome: 'Alteração indevida' } } : {}),
    });
    sucesso(resposta, `Isolamento ${method}`);
    assert.deepEqual(resposta.data, [], `Outro usuário não pode executar ${method} no registro.`);
  }
  console.log('OK: outro usuário não consulta, altera nem exclui os dados.');

  const excluir = await requisicao(`${tabela}${filtro}`, { method: 'DELETE', token: a.token, prefer: 'return=representation' });
  sucesso(excluir, 'Exclusão');
  assert.equal(excluir.data?.length, 1, 'O proprietário deve conseguir excluir seu registro.');
  const vazio = await requisicao(`${tabela}${filtro}`, { token: a.token });
  sucesso(vazio, 'Consulta após exclusão');
  assert.deepEqual(vazio.data, []);
  console.log('OK: exclusão confirmada.');
} catch (erro) {
  falhou = true;
  const causa = erro instanceof Error ? erro.cause : undefined;
  const codigo = causa && typeof causa === 'object' && 'code' in causa ? ` (${causa.code})` : '';
  console.error(`FALHA: ${erro.message}${codigo}`);
} finally {
  // Remove somente os IDs gerados por esta execução, inclusive após falha.
  for (const sessao of sessoes) {
    try {
      const limpeza = await requisicao(`${tabela}?sync_id=in.(${ids.join(',')})`, { method: 'DELETE', token: sessao.token });
      sucesso(limpeza, 'Limpeza dos registros temporários');
    } catch {
      falhou = true;
      console.error(`Não foi possível confirmar a limpeza dos IDs de teste: ${ids.join(', ')}.`);
    }
  }
}
if (sessoes.length) console.log('Os usuários anônimos de teste permanecem em Authentication > Users; os tokens não foram salvos.');
if (!falhou) console.log('Integração do backend validada com sucesso.');
process.exitCode = falhou ? 1 : 0;
