# Ibejinhos ERP

Sistema da Ibejinhos para loja online, pedidos, clientes, fidelidade, estoque, producao, financeiro e ERP administrativo.

## Status De Deploy

O projeto ja recebeu os arquivos de preparacao para Vercel, Prisma e Supabase:

- `vercel.json`
- `.env.example`
- `prisma/schema.prisma`
- `prisma/migrations/0001_init/migration.sql`
- `prisma/seed.ts`
- scripts de Prisma no `package.json`

Importante: a versao atual da aplicacao ainda tem partes do codigo usando SQLite local em:

- `lib/db.ts`
- `lib/inventory.ts`
- `lib/erp.ts`

Para producao real com dados persistentes, essas camadas precisam ser migradas para Prisma/PostgreSQL antes de liberar clientes usando o site. O banco Supabase ja esta modelado, mas a troca completa do motor de dados ainda deve ser finalizada antes do deploy definitivo.

## Links Locais

Depois de iniciar o projeto:

- Loja: `http://localhost:3000`
- Area da cliente: `http://localhost:3000/cliente`
- Carrinho: `http://localhost:3000/carrinho`
- Entrada da gestao: `http://localhost:3000/gestao`
- Pedidos e cardapio: `http://localhost:3000/admin`
- Estoque: `http://localhost:3000/estoque`
- ERP: `http://localhost:3000/erp`

Senha padrao local, caso `ADMIN_PASSWORD` nao esteja configurado:

```text
ibejinhos123
```

## Como Rodar Localmente

1. Instale o Node.js.

Use a versao LTS mais recente no site:

```text
https://nodejs.org
```

2. Instale as dependencias:

```bash
npm install
```

3. Copie o arquivo de variaveis:

```bash
cp .env.example .env.local
```

4. Edite o arquivo `.env.local`.

Para teste local simples, preencha pelo menos:

```env
ADMIN_PASSWORD="uma-senha-segura"
NEXT_PUBLIC_WHATSAPP_NUMBER="5511964918434"
NEXT_PUBLIC_GAS_PRICE_PER_LITER="6.20"
NEXT_PUBLIC_VEHICLE_KM_PER_LITER="28"
NEXT_PUBLIC_DELIVERY_SERVICE_FEE="6.00"
NEXT_PUBLIC_MIN_DELIVERY_FEE="8.00"
NEXT_PUBLIC_ALLOW_TEST_ORDERS="false"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

5. Inicie o projeto:

```bash
npm run dev
```

6. Abra:

```text
http://localhost:3000/gestao
```

## Variaveis De Ambiente

Crie estas variaveis tanto no `.env.local` quanto na Vercel:

```env
DATABASE_URL="postgresql://postgres.xxxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:SENHA@db.xxxxx.supabase.co:5432/postgres"
ADMIN_PASSWORD="troque-esta-senha"
NEXT_PUBLIC_WHATSAPP_NUMBER="5511964918434"
NEXT_PUBLIC_GAS_PRICE_PER_LITER="6.20"
NEXT_PUBLIC_VEHICLE_KM_PER_LITER="28"
NEXT_PUBLIC_DELIVERY_SERVICE_FEE="6.00"
NEXT_PUBLIC_MIN_DELIVERY_FEE="8.00"
NEXT_PUBLIC_ALLOW_TEST_ORDERS="false"
NEXT_PUBLIC_SITE_URL="https://seudominio.com.br"
```

### O Que Cada Variavel Faz

`DATABASE_URL`

URL do banco Supabase usada pela aplicacao online. Na Vercel, prefira a URL com pooler.

`DIRECT_URL`

URL direta do banco Supabase. O Prisma usa esta URL para rodar migrations.

`ADMIN_PASSWORD`

Senha da area interna da Ibejinhos.

`NEXT_PUBLIC_WHATSAPP_NUMBER`

Numero que recebe pedidos no WhatsApp.

`NEXT_PUBLIC_GAS_PRICE_PER_LITER`

Preco da gasolina usado para calcular entrega.

`NEXT_PUBLIC_VEHICLE_KM_PER_LITER`

Quantos km o veiculo faz por litro.

`NEXT_PUBLIC_DELIVERY_SERVICE_FEE`

Taxa de servico da entrega.

`NEXT_PUBLIC_MIN_DELIVERY_FEE`

Frete minimo.

`NEXT_PUBLIC_ALLOW_TEST_ORDERS`

Use `true` apenas para testes fora do horario de pedidos.

`NEXT_PUBLIC_SITE_URL`

URL final do site.

## Criar Banco No Supabase

1. Acesse:

```text
https://supabase.com
```

2. Crie uma conta ou entre.

3. Clique em `New project`.

4. Escolha:

- Organization: sua organizacao
- Project name: `ibejinhos`
- Database password: crie uma senha forte e guarde
- Region: escolha Sao Paulo, se estiver disponivel

5. Aguarde o Supabase terminar de criar o projeto.

6. Va em:

```text
Project Settings > Database
```

7. Copie duas conexoes:

- `Connection string` com `Transaction pooler`: use em `DATABASE_URL`
- `Direct connection`: use em `DIRECT_URL`

8. No seu computador, cole essas URLs no `.env.local`.

## Rodar Migrations Do Prisma

Depois de configurar `DATABASE_URL` e `DIRECT_URL`:

1. Gere o Prisma Client:

```bash
npm run db:generate
```

2. Rode as migrations no Supabase:

```bash
npm run db:migrate
```

3. Coloque dados iniciais:

```bash
npm run db:seed
```

4. Se quiser abrir uma tela visual do banco:

```bash
npm run db:studio
```

## Subir O Projeto Para O GitHub

1. Crie uma conta em:

```text
https://github.com
```

2. Crie um repositorio novo.

Nome sugerido:

```text
ibejinhos-erp
```

3. No terminal, dentro da pasta do projeto, rode:

```bash
git init
git add .
git commit -m "Primeira versao do ERP Ibejinhos"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/ibejinhos-erp.git
git push -u origin main
```

Troque `SEU-USUARIO` pelo seu usuario do GitHub.

Se aparecer pedido de login, entre com sua conta do GitHub.

## Publicar Na Vercel

1. Acesse:

```text
https://vercel.com
```

2. Entre usando sua conta do GitHub.

3. Clique em `Add New...`.

4. Clique em `Project`.

5. Escolha o repositorio `ibejinhos-erp`.

6. Em `Framework Preset`, confira se esta como:

```text
Next.js
```

7. Em `Environment Variables`, cadastre todas as variaveis do `.env.example`.

8. Clique em `Deploy`.

9. Aguarde a Vercel terminar.

10. Ao final, a Vercel mostrara um link parecido com:

```text
https://ibejinhos-erp.vercel.app
```

11. Abra:

```text
https://ibejinhos-erp.vercel.app/gestao
```

## Criar Um Site De Teste Antes Do Oficial

Use este fluxo para testar mudancas sem mexer no site principal.

### Como Vai Funcionar

- `main`: versao oficial, ligada ao site principal.
- `teste`: versao de teste, usada para validar alteracoes antes de publicar.

Quando voce envia a branch `teste` para o GitHub, a Vercel cria automaticamente um link de Preview. Esse link e separado do site oficial.

### Criar A Versao De Teste

Dentro da pasta do projeto, rode:

```bash
git checkout -b teste
git push -u origin teste
```

Depois disso:

1. Abra a Vercel.
2. Entre no projeto `ibejinhos-erp`.
3. Clique em `Deployments`.
4. Procure o deploy da branch `teste`.
5. Abra o link de Preview.

Esse link sera o seu site de teste.

### Testar Mudancas No Site De Teste

Sempre que quiser testar uma alteracao:

```bash
git checkout teste
git add .
git commit -m "Teste de ajustes"
git push
```

A Vercel vai gerar uma nova versao de teste automaticamente.

### Aprovar E Jogar Para O Site Oficial

Quando a versao de teste estiver certa:

```bash
git checkout main
git merge teste
git push origin main
```

A Vercel vai atualizar o site oficial.

### Importante

Use variaveis de ambiente tambem para Preview na Vercel:

1. Abra `Settings > Environment Variables`.
2. Confira cada variavel.
3. Marque tambem o ambiente `Preview`.
4. Salve.

Sem isso, o site de teste pode abrir mas nao conseguir acessar Supabase, senha da gestao ou configuracoes de entrega.

## Configurar Dominio Proprio

1. Na Vercel, abra o projeto.

2. Va em:

```text
Settings > Domains
```

3. Digite seu dominio:

```text
www.seudominio.com.br
```

4. Clique em `Add`.

5. A Vercel vai mostrar instrucoes de DNS.

6. Entre no site onde voce comprou o dominio.

7. Procure a area de DNS.

8. Crie os registros que a Vercel pediu.

Normalmente sera algo como:

```text
Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
```

Para dominio sem `www`, a Vercel pode pedir:

```text
Tipo: A
Nome: @
Valor: 76.76.21.21
```

9. Volte para a Vercel e aguarde validar.

10. Depois que validar, atualize `NEXT_PUBLIC_SITE_URL` na Vercel para seu dominio final:

```env
NEXT_PUBLIC_SITE_URL="https://www.seudominio.com.br"
```

11. Faca um novo deploy.

## Comandos Principais

Instalar dependencias:

```bash
npm install
```

Rodar local:

```bash
npm run dev
```

Gerar Prisma:

```bash
npm run db:generate
```

Rodar migrations:

```bash
npm run db:migrate
```

Popular dados iniciais:

```bash
npm run db:seed
```

Testar build de producao:

```bash
npm run build
```

Rodar versao de producao local:

```bash
npm run start
```

## Checklist Antes De Publicar Para Clientes

- Criar projeto Supabase.
- Configurar `DATABASE_URL`.
- Configurar `DIRECT_URL`.
- Rodar `npm run db:migrate`.
- Rodar `npm run db:seed`.
- Finalizar a migracao das camadas `lib/db.ts`, `lib/inventory.ts` e `lib/erp.ts` para Prisma.
- Rodar `npm run build`.
- Publicar na Vercel.
- Testar loja, carrinho, pedido, gestao, estoque e ERP.
- Configurar dominio proprio.
- Fazer um pedido teste real.

## Observacao Importante Sobre Produção

SQLite local funciona para desenvolvimento, mas nao deve ser usado como banco definitivo na Vercel, porque arquivos locais em deploy serverless nao sao persistentes como um banco real.

Para a Ibejinhos operar de forma profissional online, use Supabase PostgreSQL com Prisma.
