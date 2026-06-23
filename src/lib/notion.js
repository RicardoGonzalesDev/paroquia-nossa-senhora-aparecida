// src/lib/notion.js
// Integração com a API do Notion — dois bancos de dados:
//   NOTION_DATABASE_ID       → Blog (posts)
//   NOTION_MISSAS_DATABASE_ID → Horários de Missa
//   NOTION_AVISOS_DATABASE_ID → Avisos do banner da home

const NOTION_TOKEN              = import.meta.env.NOTION_TOKEN;
const NOTION_DATABASE_ID        = import.meta.env.NOTION_DATABASE_ID;
const NOTION_MISSAS_DATABASE_ID = import.meta.env.NOTION_MISSAS_DATABASE_ID;
const NOTION_AVISOS_DATABASE_ID = import.meta.env.NOTION_AVISOS_DATABASE_ID;
const USE_NOTION_MOCKS          = import.meta.env.USE_NOTION_MOCKS === 'true';

const NOTION_API     = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const headers = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

/**
 * Busca todos os posts publicados do banco de dados Notion.
 * O banco deve ter as colunas:
 *   - Título (title)
 *   - Publicado (checkbox) → true para aparecer no site
 *   - Data (date)
 *   - Resumo (rich_text)
 *   - Categoria (select)
 *   - Capa (files/url) — opcional
 *   - Slug (rich_text) — opcional; se vazio, usa o ID da página
 */
export async function getPosts() {
  if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
    console.warn('⚠️  Variáveis NOTION_TOKEN e NOTION_DATABASE_ID não configuradas. Retornando posts de exemplo.');
    return getMockPosts();
  }

  try {
    const res = await fetch(`${NOTION_API}/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: 'Publicado',
          checkbox: { equals: true },
        },
        sorts: [{ property: 'Data', direction: 'descending' }],
      }),
    });

    if (!res.ok) {
      await handleNotionError(res, 'blog', NOTION_DATABASE_ID);
    }

    const data = await res.json();
    return data.results.map(normalizePost);
  } catch (err) {
    return handleConfiguredNotionFailure(err, getMockPosts);
  }
}

/**
 * Busca o conteúdo completo (blocos) de uma página do Notion.
 */
export async function getPostContent(pageId) {
  if (!NOTION_TOKEN) return '<p>Conteúdo não disponível em modo de demonstração.</p>';

  try {
    const res = await fetch(`${NOTION_API}/blocks/${pageId}/children?page_size=100`, {
      headers,
    });

    if (!res.ok) {
      await handleNotionError(res, 'conteúdo do post', pageId);
    }

    const data = await res.json();
    return blocksToHtml(data.results);
  } catch (err) {
    return handleConfiguredNotionFailure(err, () => '<p>Erro ao carregar conteúdo.</p>');
  }
}

/**
 * Busca um post pelo slug ou ID.
 */
export async function getPostBySlug(slug) {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug) || null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePost(page) {
  const props = page.properties;

  const title = props.Título?.title?.[0]?.plain_text
    || props.Nome?.title?.[0]?.plain_text
    || props.Name?.title?.[0]?.plain_text
    || 'Sem título';

  const slug = props.Slug?.rich_text?.[0]?.plain_text || page.id;
  const date = props.Data?.date?.start || page.created_time?.slice(0, 10);
  const summary = props.Resumo?.rich_text?.[0]?.plain_text || '';
  const category = props.Categoria?.select?.name || 'Notícias';
  const coverUrl = page.cover?.external?.url || page.cover?.file?.url || null;

  return { id: page.id, title, slug, date, summary, category, coverUrl };
}

/**
 * Converte blocos Notion em HTML simples.
 * Suporta: paragraph, heading_1-3, bulleted_list_item, numbered_list_item,
 *          image, quote, divider, callout.
 */
function blocksToHtml(blocks) {
  let html = '';
  let inBulletList = false;
  let inNumberList = false;

  for (const block of blocks) {
    const type = block.type;

    // Fecha listas abertas se o próximo item não é lista
    if (inBulletList && type !== 'bulleted_list_item') {
      html += '</ul>';
      inBulletList = false;
    }
    if (inNumberList && type !== 'numbered_list_item') {
      html += '</ol>';
      inNumberList = false;
    }

    switch (type) {
      case 'paragraph':
        html += `<p>${richTextToHtml(block.paragraph.rich_text)}</p>`;
        break;
      case 'heading_1':
        html += `<h2>${richTextToHtml(block.heading_1.rich_text)}</h2>`;
        break;
      case 'heading_2':
        html += `<h3>${richTextToHtml(block.heading_2.rich_text)}</h3>`;
        break;
      case 'heading_3':
        html += `<h4>${richTextToHtml(block.heading_3.rich_text)}</h4>`;
        break;
      case 'bulleted_list_item':
        if (!inBulletList) { html += '<ul>'; inBulletList = true; }
        html += `<li>${richTextToHtml(block.bulleted_list_item.rich_text)}</li>`;
        break;
      case 'numbered_list_item':
        if (!inNumberList) { html += '<ol>'; inNumberList = true; }
        html += `<li>${richTextToHtml(block.numbered_list_item.rich_text)}</li>`;
        break;
      case 'quote':
        html += `<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>`;
        break;
      case 'divider':
        html += '<hr />';
        break;
      case 'callout':
        html += `<div class="callout">${block.callout.icon?.emoji || '✝️'} ${richTextToHtml(block.callout.rich_text)}</div>`;
        break;
      case 'image': {
        const src = block.image?.external?.url || block.image?.file?.url || '';
        const caption = block.image?.caption?.[0]?.plain_text || '';
        html += `<figure><img src="${src}" alt="${caption}" loading="lazy" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
        break;
      }
      default:
        break;
    }
  }

  if (inBulletList) html += '</ul>';
  if (inNumberList) html += '</ol>';

  return html;
}

function richTextToHtml(richTexts = []) {
  return richTexts.map((t) => {
    let text = t.plain_text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (t.annotations?.bold) text = `<strong>${text}</strong>`;
    if (t.annotations?.italic) text = `<em>${text}</em>`;
    if (t.annotations?.underline) text = `<u>${text}</u>`;
    if (t.href) text = `<a href="${t.href}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join('');
}

// ─── Posts de exemplo (quando Notion não está configurado) ──────────────────

function getMockPosts() {
  return [
    {
      id: '1',
      slug: 'festa-patronal-nossa-senhora-aparecida',
      title: 'Programação da Festa Patronal de Nossa Senhora Aparecida',
      date: '2025-10-05',
      summary: 'Confira a programação completa das celebrações em honra à Padroeira do Brasil neste mês de outubro.',
      category: 'Eventos',
      coverUrl: null,
    },
    {
      id: '2',
      slug: 'retiro-de-advento',
      title: 'Retiro de Advento: Preparando o Coração para o Natal',
      date: '2025-11-28',
      summary: 'A paróquia convida todos os fiéis para o retiro de Advento que acontecerá no final de novembro.',
      category: 'Formação',
      coverUrl: null,
    },
    {
      id: '3',
      slug: 'catequese-2025',
      title: 'Inscrições Abertas para Catequese 2025',
      date: '2025-02-10',
      summary: 'As inscrições para a catequese de crianças e adultos estão abertas. Venha fazer parte da nossa comunidade.',
      category: 'Catequese',
      coverUrl: null,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// HORÁRIOS DE MISSA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca os horários de missa do banco de dados Notion (NOTION_MISSAS_DATABASE_ID).
 *
 * Estrutura esperada do banco:
 *   - Horário     (title)       ex: "7h00"
 *   - Dia         (multi_select) ex: ["Segunda", "Terça", "Quarta"]
 *   - Observação  (rich_text)   ex: "Novena de N. Sra. Aparecida" — opcional
 *   - Ativo       (checkbox)    true para exibir
 *   - Ordem       (number)      número para ordenação dentro do dia — opcional
 *
 * Dias válidos (multi_select):
 *   Segunda · Terça · Quarta · Quinta · Sexta · Sábado · Domingo
 *
 * Retorna um objeto indexado por dia da semana:
 *   {
 *     "Segunda": [ { horario: "7h00", observacao: "" }, ... ],
 *     "Domingo": [ { horario: "7h00", observacao: "" }, { horario: "9h00", observacao: "Família" }, ... ],
 *   }
 */
export async function getMissas() {
  if (!NOTION_TOKEN || !NOTION_MISSAS_DATABASE_ID) {
    console.warn('⚠️  NOTION_MISSAS_DATABASE_ID não configurado. Usando horários de exemplo.');
    return getMockMissas();
  }

  try {
    const res = await fetch(`${NOTION_API}/databases/${NOTION_MISSAS_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: 'Ativo',
          checkbox: { equals: true },
        },
        sorts: [{ property: 'Ordem', direction: 'ascending' }],
      }),
    });

    if (!res.ok) {
      await handleNotionError(res, 'horários de missa', NOTION_MISSAS_DATABASE_ID);
    }

    const data = await res.json();
    return normalizeMissas(data.results);
  } catch (err) {
    return handleConfiguredNotionFailure(err, getMockMissas);
  }
}

/**
 * Busca os avisos ativos do banner da home.
 *
 * Estrutura esperada:
 *   - Texto (title)
 *   - Ativo (checkbox)
 *   - Ordem (number)
 *   - Link (url) opcional
 */
export async function getAvisos() {
  if (!NOTION_TOKEN || !NOTION_AVISOS_DATABASE_ID) {
    console.warn('⚠️  NOTION_AVISOS_DATABASE_ID não configurado. Usando avisos de exemplo.');
    return getMockAvisos();
  }

  try {
    const res = await fetch(`${NOTION_API}/databases/${NOTION_AVISOS_DATABASE_ID}/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: {
          property: 'Ativo',
          checkbox: { equals: true },
        },
        sorts: [{ property: 'Ordem', direction: 'ascending' }],
      }),
    });

    if (!res.ok) {
      await handleNotionError(res, 'avisos', NOTION_AVISOS_DATABASE_ID);
    }

    const data = await res.json();
    return data.results.map(normalizeAviso).filter((aviso) => aviso.texto);
  } catch (err) {
    return handleConfiguredNotionFailure(err, getMockAvisos);
  }
}

async function handleNotionError(res, label, objectId) {
  const body = await res.text();
  let parsed = null;

  try {
    parsed = JSON.parse(body);
  } catch {
    // Keep the raw body below when Notion does not return JSON.
  }

  const notionMessage = parsed?.message || body || 'Sem detalhes retornados pela API.';
  const permissionHint = res.status === 404
    ? '\nDica: no Notion, abra o banco correspondente, clique em "..." > "Adicionar conexão" e selecione a integração usada pelo NOTION_TOKEN.'
    : '';

  throw new Error(
    `Erro ao carregar ${label} no Notion (HTTP ${res.status}).\n` +
    `ID usado: ${objectId}\n` +
    `${notionMessage}${permissionHint}`
  );
}

function handleConfiguredNotionFailure(err, fallback) {
  if (USE_NOTION_MOCKS) {
    console.warn('⚠️  Falha no Notion, mas USE_NOTION_MOCKS=true está ativo. Usando dados de exemplo.', err);
    return fallback();
  }

  throw err;
}

const ORDEM_DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function normalizeMissas(pages) {
  // Monta um mapa dia → lista de horários
  const mapa = Object.fromEntries(ORDEM_DIAS.map(d => [d, []]));

  for (const page of pages) {
    const props = page.properties;

    const horario = plainText(props.Horário?.title)
      || plainText(props.Horario?.title)
      || '';

    const dias = props.Dia?.multi_select?.map(s => s.name) ?? [];

    const observacao = plainText(props.Observação?.rich_text)
      || plainText(props.Observacao?.rich_text)
      || '';

    for (const dia of dias) {
      if (mapa[dia] !== undefined) {
        mapa[dia].push({ horario, observacao });
      }
    }
  }

  return mapa;
}

function normalizeAviso(page) {
  const props = page.properties;

  const texto = plainText(props.Texto?.title)
    || plainText(props.Aviso?.title)
    || plainText(props.Name?.title)
    || plainText(props.Nome?.title)
    || '';

  const link = props.Link?.url || '';

  return { texto, link };
}

function plainText(richTexts = []) {
  return richTexts.map((text) => text.plain_text).join('');
}

function getMockAvisos() {
  return [
    { texto: 'Confissões: sexta-feira às 17h30', link: '' },
    { texto: 'Missa de 7ª de Finados: confira o calendário', link: '' },
    { texto: 'Novena de N. Sra. Aparecida: toda terça-feira às 19h', link: '' },
  ];
}

function getMockMissas() {
  return {
    Segunda:  [{ horario: '7h00',  observacao: '' }],
    Terça:    [{ horario: '7h00',  observacao: '' }, { horario: '19h00', observacao: 'Novena de N. Sra. Aparecida' }],
    Quarta:   [{ horario: '7h00',  observacao: '' }, { horario: '19h00', observacao: '' }],
    Quinta:   [{ horario: '7h00',  observacao: '' }],
    Sexta:    [{ horario: '7h00',  observacao: '' }, { horario: '17h30', observacao: 'Confissões' }, { horario: '19h00', observacao: '' }],
    Sábado:   [{ horario: '7h30',  observacao: '' }, { horario: '19h00', observacao: 'Missa de Vigília' }],
    Domingo:  [{ horario: '7h00',  observacao: '' }, { horario: '9h00',  observacao: '🏠 Missa das Famílias' }, { horario: '19h00', observacao: '' }],
  };
}
