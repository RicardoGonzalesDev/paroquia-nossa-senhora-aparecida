# Paróquia Nossa Senhora Aparecida — Andradas/MG

Site institucional com blog integrado ao Notion, construído com **Astro.js**.

---

## 🚀 Instalação

```bash
npm install
npm run dev
```

Acesse: http://localhost:4321

---

## 📝 Configuração do Notion (dois bancos de dados)

O site usa **uma única integração** do Notion conectada a **dois bancos** separados:

| Variável                    | Banco                | Finalidade              |
|-----------------------------|----------------------|-------------------------|
| `NOTION_DATABASE_ID`        | **Blog**             | Posts, reflexões, avisos |
| `NOTION_MISSAS_DATABASE_ID` | **Horários de Missa**| Grade semanal de missas  |
| `NOTION_AVISOS_DATABASE_ID` | **Avisos**           | Banner de avisos da home |

---

### 1. Criar a integração no Notion

1. Acesse https://www.notion.so/my-integrations
2. Clique em **"+ Nova integração"**
3. Nomeie (ex: "Site Paróquia") e clique em **Salvar**
4. Copie o **Token secreto** — será o mesmo `NOTION_TOKEN` para os dois bancos

---

### 2. Banco de Blog

Crie uma **Database** com as colunas:

| Coluna      | Tipo       | Obrigatório | Descrição |
|-------------|------------|:-----------:|-----------|
| `Título`    | Title      | ✅          | Título do post |
| `Publicado` | Checkbox   | ✅          | Marcar para publicar no site |
| `Data`      | Date       | ✅          | Data de publicação |
| `Resumo`    | Rich text  | —           | Trecho exibido no card |
| `Categoria` | Select     | —           | Ex: Eventos, Formação, Notícias |
| `Capa`      | Files/URL  | —           | Imagem de capa |
| `Slug`      | Rich text  | —           | URL amigável (se vazio, usa o ID) |

---

### 3. Banco de Horários de Missa

Crie uma **Database** com as colunas:

| Coluna       | Tipo          | Obrigatório | Descrição |
|--------------|---------------|:-----------:|-----------|
| `Horário`    | Title         | ✅          | Ex: `7h00`, `19h00` |
| `Dia`        | Multi-select  | ✅          | Dias da semana — use exatamente: `Segunda` `Terça` `Quarta` `Quinta` `Sexta` `Sábado` `Domingo` |
| `Ativo`      | Checkbox      | ✅          | Marcar para exibir no site |
| `Observação` | Rich text     | —           | Ex: `Novena`, `Missa das Famílias`, `Confissões` |
| `Ordem`      | Number        | —           | Número para ordenar dentro do dia (1, 2, 3…) |

**Exemplo de registros:**

| Horário | Dia                       | Observação              | Ativo | Ordem |
|---------|---------------------------|-------------------------|:-----:|:-----:|
| 7h00    | Segunda, Quarta, Quinta   |                         | ✓     | 1     |
| 7h00    | Terça, Sexta              |                         | ✓     | 1     |
| 19h00   | Terça                     | Novena de N. Sra. Aparecida | ✓ | 2     |
| 17h30   | Sexta                     | Confissões              | ✓     | 2     |
| 19h00   | Quarta, Sexta             |                         | ✓     | 3     |
| 7h30    | Sábado                    |                         | ✓     | 1     |
| 19h00   | Sábado                    | Missa de Vigília        | ✓     | 2     |
| 7h00    | Domingo                   |                         | ✓     | 1     |
| 9h00    | Domingo                   | 🏠 Missa das Famílias   | ✓     | 2     |
| 19h00   | Domingo                   |                         | ✓     | 3     |

> **Dica:** Um mesmo horário pode ser compartilhado por vários dias usando Multi-select. Para alterar um horário (ex: suspender uma missa), basta desmarcar **Ativo** — sem mexer no código.

---

### 4. Banco de Avisos

Crie uma **Database** com as colunas:

| Coluna  | Tipo     | Obrigatório | Descrição |
|---------|----------|:-----------:|-----------|
| `Texto` | Title    | ✅          | Texto exibido no banner da home |
| `Ativo` | Checkbox | ✅          | Marcar para exibir no site |
| `Ordem` | Number   | —           | Número para ordenar os avisos |
| `Link`  | URL      | —           | Link opcional do aviso |

---

### 5. Compartilhar os bancos com a integração

Para **cada banco**:
1. Abra o banco no Notion
2. Clique em **"..."** → **"Adicionar conexão"**
3. Selecione a integração criada no passo 1

---

### 6. Obter os IDs dos bancos

A URL de cada banco tem este formato:
```
https://www.notion.so/SEU_WORKSPACE/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...
```
O ID são os 32 caracteres entre a última `/` e o `?v=`.

---

### 7. Criar o arquivo `.env`

```bash
cp .env.example .env
```

Edite:
```env
NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_MISSAS_DATABASE_ID=yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
NOTION_AVISOS_DATABASE_ID=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz
```

Opcionalmente, para desenvolver sem acesso ao Notion:

```env
USE_NOTION_MOCKS=true
```

Em produção, deixe essa variável ausente ou como `false`. Assim, erros de token, ID ou permissão no Notion fazem o build falhar em vez de publicar conteúdo de exemplo sem perceber.

---

## 🏗️ Build para produção

```bash
npm run build
npm run preview
```

Este projeto gera páginas estáticas. Depois de alterar o `.env` ou os dados do Notion, rode `npm run build` novamente e publique a nova pasta `dist/`.

Se o build mostrar `Could not find database with ID`, abra o banco no Notion e confirme que ele foi compartilhado com a integração em **"..." → "Adicionar conexão"**. Faça isso separadamente para o banco do blog e para o banco de horários de missa.

---

## 📁 Estrutura do projeto

```
src/
├── layouts/
│   └── Layout.astro         # Layout principal (header + footer)
├── lib/
│   └── notion.js            # Integração com a API do Notion
├── pages/
│   ├── index.astro           # Página inicial
│   ├── sobre.astro           # A Paróquia
│   ├── horarios.astro        # Horários de Missa
│   ├── sacramentos.astro     # Sacramentos
│   ├── contato.astro         # Contato
│   └── blog/
│       ├── index.astro       # Lista de posts
│       └── [slug].astro      # Post individual
└── styles/
    └── global.css            # Design tokens e estilos globais
```

---

## 🌐 Deploy

Este projeto é **estático** (`output: 'static'`). Você pode publicar em:

- **Netlify** (recomendado): arraste a pasta `dist/` ou conecte ao GitHub
- **Vercel**: conecte ao repositório e defina as variáveis de ambiente
- **Hospedagem tradicional**: faça `npm run build` e envie a pasta `dist/`

> ⚠️ Para que o Notion funcione em produção, configure as variáveis de ambiente no painel do seu serviço de hospedagem.

---

## 🎨 Design

- **Cores:** Azul mariano `#1B3A6B` · Dourado `#C9A84C` · Creme `#F8F5EF`
- **Tipografia:** Playfair Display (títulos) + Inter (corpo)
- **Diocese:** Poços de Caldas

---

Desenvolvido com ❤️ para a comunidade paroquial de Andradas/MG.
