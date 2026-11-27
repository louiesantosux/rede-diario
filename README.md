# Papel de Carta (nome provisório)

Rede social mental-health friendly em formato de diário: wikis de interesses, moodboards, playlists e conversas apenas entre amigos. Sem curtidas, sem algoritmo, sem IA.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + RLS, Auth, Storage) · Vercel.

## Estado atual: Etapa 1 (base)

- Banco completo do núcleo com Row Level Security em todas as tabelas (`supabase/migrations/0001_init.sql`)
- Cadastro, login por e-mail e senha, login com Google, confirmação de e-mail, recuperação e troca de senha (encerra as outras sessões)
- Proxy de sessão (`src/proxy.ts`) protegendo todas as rotas internas
- Quatro temas validados por script: Aero Claro, Aero Escuro, Papel e Alto contraste (texto corrido AAA 7:1)
- Aba de acessibilidade: tema, tamanho do texto, fonte Atkinson Hyperlegible, espaçamento, modo leitura, redução de movimento e de transparência, sincronizada com a conta
- Início com missão do dia (opcional, com "Pular hoje") e feed cronológico finito ("Você está em dia")
- Barra de tarefas estilo Windows 7; áreas futuras com telas provisórias

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo, `sa-east-1`).
2. Em **SQL Editor**, cole e execute, nesta ordem, o conteúdo de:
   `0001_init.sql`, `0002_media.sql`, `0003_events.sql`, `0004_playlists.sql` (pasta `supabase/migrations`).
   Alternativa com CLI: `supabase link` e depois `supabase db push`.
   Agende diariamente em **Integrations → Cron**: `select public.purge_old_event_locations();`
3. Em **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (depois, o domínio da Vercel)
   - Redirect URLs: `http://localhost:3000/**` e `https://SEU-DOMINIO/**`
4. Em **Authentication → Email Templates**, troque o link dos modelos:
   - *Confirm signup*:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/inicio`
   - *Reset password*:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nova-senha`
5. Em **Authentication → Providers → Email**, ative a confirmação de e-mail e a proteção contra senhas vazadas (se disponível no seu plano).
6. Google: em **Authentication → Providers → Google**, informe o Client ID e o Secret criados no Google Cloud Console (tipo "Aplicativo da Web"; URI de redirecionamento autorizado = a callback mostrada pelo Supabase).
7. Para produção, configure um SMTP próprio (ex.: Resend) em **Authentication → SMTP Settings**; o envio padrão do Supabase tem limite baixo.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com os dados de **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Importação de playlists do YouTube

1. No Google Cloud Console (projeto `rede-diario`), ative **YouTube Data API v3** em **APIs e serviços → Biblioteca**.
2. Em **Credenciais → Criar credenciais → Chave de API**, crie a chave e restrinja-a à **YouTube Data API v3**.
3. Na Vercel, cadastre a variável `YOUTUBE_API_KEY` (sem `NEXT_PUBLIC_`) e faça o redeploy.

### 3. Rodar localmente

```bash
npm install
npm run themes   # valida contraste e gera src/app/themes.css
npm run dev
```

### 4. Publicar na Vercel

1. Suba o projeto para um repositório no GitHub.
2. Na Vercel, **Add New → Project**, importe o repositório.
3. Cadastre as três variáveis de ambiente (com `NEXT_PUBLIC_SITE_URL` = domínio de produção).
4. Atualize Site URL e Redirect URLs no Supabase com o domínio final.

## Temas e contraste

As cores ficam somente em `scripts/tokens.mjs`. O comando `npm run themes` calcula o contraste WCAG de 14 pares por tema e falha o build se algum ficar abaixo da meta. Nunca edite `src/app/themes.css` à mão.

## Regras de privacidade no banco

| Situação | Quem vê |
| --- | --- |
| `private` | Apenas o dono |
| `friends` | Dono e amigos aceitos |
| `unlisted` | Apenas quem tem o link com `share_token` (funções `shared_wiki`, `shared_wiki_pages`, `shared_post`) |
| `public` | Qualquer usuário logado |
| Bloqueio | Bloqueado não vê nada do bloqueador, nem por link |
| Respostas a posts | Apenas quem respondeu e o autor do post |
| Mensagens | Apenas os dois participantes; só amigos podem enviar |

## Já entregue

Posts com texto rico e missões · wikis com blocos (texto, coleção, imagens, playlist, divisor, blog) e tema com verificação de contraste · imagens com editor e filtros, sem EXIF · moodboards · encontros privados no mapa · amigos · playlists do YouTube · respostas privadas a posts.

## Próximas etapas

| Etapa | Entrega |
| --- | --- |
| 1b | 2FA por app autenticador, confirmação de login em dispositivo novo por e-mail, login por telefone, lista de sessões |
| 4 | Mensagens privadas em tempo real, bloqueio, denúncias, ajustes de privacidade e bem-estar |
| — | Links de compartilhamento para conteúdo não listado, recorte de imagem, colagem livre no moodboard |
