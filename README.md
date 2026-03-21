# Allos Formação

Plataforma de cursos e formação continuada da Associação Allos.

## Stack

- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Deploy:** Vercel (frontend) + Supabase Cloud (backend)

## Setup local

### 1. Clone e instale dependências

```bash
cd "C:\Projetos de programação\Allos formação"
npm install
```

### 2. Configure o Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Copie `.env.local.example` para `.env.local`:

```bash
cp .env.local.example .env.local
```

3. Preencha as variáveis com as credenciais do seu projeto Supabase

### 3. Execute as migrations

No SQL Editor do Supabase Dashboard, execute os arquivos em ordem:

1. `supabase/migrations/001_initial_schema.sql` — Schema e tabelas
2. `supabase/migrations/002_rls_policies.sql` — Políticas de segurança
3. `supabase/seed.sql` — Dados de exemplo (opcional)

### 4. Configure Auth

No Supabase Dashboard > Authentication > Providers:

- Habilite **Email** (com confirmação por email)
- Habilite **Google** (configure OAuth credentials)

### 5. Rode o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000/formacao](http://localhost:3000/formacao)

## Estrutura

```
src/
├── app/formacao/          # Páginas (vitrine, auth, curso, admin)
├── components/            # Componentes (ui, course, auth, admin, etc.)
├── hooks/                 # Custom hooks (useAuth, etc.)
├── lib/                   # Supabase clients, utils, constants
├── types/                 # TypeScript types
└── styles/                # CSS global
supabase/
├── migrations/            # SQL schema + RLS
└── seed.sql               # Dados de exemplo
```

## Roles

| Role       | Permissões                                                    |
| ---------- | ------------------------------------------------------------- |
| student    | Ver cursos, matricular, assistir, provas, certificados        |
| instructor | + Criar/editar seus cursos, ver alunos e métricas             |
| admin      | Tudo. Gerenciar cursos, usuários, permissões, métricas        |

## Deploy

**Frontend (Vercel):**
- Conecte o repositório
- Configure as variáveis de ambiente
- Deploy automático a cada push

**Backend (Supabase Cloud):**
- Projeto já configurado com migrations
- Storage bucket `course-attachments` para arquivos
