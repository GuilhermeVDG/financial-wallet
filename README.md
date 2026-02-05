# Financial Wallet API

API RESTful para sistema de carteira financeira com operações de depósito, transferência e reversão de transações.

---

## 📋 Índice

- [Stack Tecnológica](#stack-tecnológica)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Instalação e Execução](#instalação-e-execução)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [API Documentation](#api-documentation)
- [Endpoints](#endpoints)
- [Testes](#testes)
- [Coverage](#coverage)
- [Design Patterns](#design-patterns)
- [Decisões Técnicas](#decisões-técnicas)

---

## 🛠 Stack Tecnológica

| Categoria | Tecnologia |
|-----------|------------|
| **Runtime** | Node.js 20 (Alpine) |
| **Framework** | NestJS 10 |
| **Linguagem** | TypeScript 5 |
| **Banco de Dados** | PostgreSQL 16 |
| **ORM** | TypeORM 0.3 |
| **Autenticação** | JWT (Passport.js) |
| **Message Broker** | RabbitMQ 3 |
| **Validação** | class-validator + class-transformer |
| **Documentação** | Swagger/OpenAPI |
| **Testes** | Jest 29 |
| **Containerização** | Docker + Docker Compose |

---

## 🏗 Arquitetura

O projeto segue **Clean Architecture** com separação de responsabilidades em camadas:

```
src/
├── domain/                      # Camada de Domínio
│   └── entities/                # Entidades (User, Transaction)
│
├── infrastructure/              # Camada de Infraestrutura
│   └── database/                # TypeORM config, migrations
│
├── shared/                      # Compartilhado
│   ├── decorators/              # @PublicRoute, @DisableTimeout
│   ├── enums/                   # TransactionType, TransactionStatus
│   ├── exceptions/              # GlobalExceptionFilter
│   ├── interceptors/            # TimeoutInterceptor
│   ├── pipes/                   # CustomValidationPipe
│   ├── swagger/                 # Swagger schemas
│
├── modules/                     # Módulos de Negócio
│   ├── auth/                    # Autenticação (JWT)
│   │   ├── dto/
│   │   ├── guards/              # JwtAuthGuard
│   │   ├── strategies/          # JwtStrategy
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   ├── users/                   # Gestão de Usuários
│   │   ├── dto/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   │
│   └── wallet/                  # Carteira Financeira
│       ├── dto/                 # Request/Response DTOs
│       ├── events/              # Eventos (RabbitMQ)
│       ├── factories/           # TransactionFactory
│       ├── repositories/        # Repository Pattern
│       ├── strategies/          # Strategy Pattern
│       ├── wallet.controller.ts
│       ├── wallet.service.ts
│       └── wallet.module.ts
│
├── app.module.ts                # Módulo Raiz
└── main.ts                      # Bootstrap
```

---

## ✨ Funcionalidades

### Autenticação
- [x] Registro de novos usuários
- [x] Login com geração de JWT
- [x] Proteção de rotas com `@PublicRoute()` decorator
- [x] Guard global JwtAuthGuard com suporte a rotas públicas

### Carteira Financeira
- [x] **Depósito**: Adicionar fundos à carteira
- [x] **Transferência**: Enviar dinheiro para outros usuários (atómica)
- [x] **Reversão**: Reverter depósitos e transferências
- [x] **Consulta de saldo**
- [x] **Histórico de transações** com paginação

### Regras de Negócio
- [x] Validação de saldo suficiente antes da transferência
- [x] Bloqueio de depósitos quando saldo está negativo
- [x] Transações atómicas (Unit of Work com QueryRunner)
- [x] Pessimistic locking (`SELECT FOR UPDATE`) para evitar race conditions
- [x] Ordenação determinística de locks para prevenir deadlocks

### Segurança
- [x] Senhas hasheadas com bcrypt (cost 10)
- [x] JWT com expiração configurável
- [x] Validação de entrada com class-validator
- [x] Sanitização de erros (sem stack traces em produção)
- [x] Timeout global de requisições (configurável)

### Observabilidade
- [x] Logger estruturado (NestJS Logger)
- [x] Global exception filter com formato padronizado
- [x] Timeout interceptor com tratamento de erros
- [x] Eventos de domínio publicados no RabbitMQ

---

## 🚀 Instalação e Execução

### Pré-requisitos

- Docker e Docker Compose

### Via Docker (Recomendado)

**Desenvolvimento:**
```bash
# Copiar arquivo de ambiente
cp .env.example .env

# Subir containers
docker compose -f docker-compose.dev.yml up --build

# Executar migrations
docker compose exec api npm run migration:run
```

**Produção:**
```bash
docker compose up -d
```

### Portas

| Serviço | Porta |
|---------|-------|
| API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/docs |
| PostgreSQL | 5433 |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |

---

## ⚙️ Variáveis de Ambiente

```bash
# Application
APP_PORT=3000
NODE_ENV=development
TIMEOUT=5000

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d

# Database
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=financial_wallet

# RabbitMQ
RABBITMQ_URI=amqp://guest:guest@localhost:5672
RABBITMQ_EXCHANGE=wallet_events
```

---

## 📚 API Documentation

### Swagger UI

A documentação interativa da API está disponível em:

```
http://localhost:3000/api/docs
```

Inclui:
- Descrição de todos os endpoints
- Schema de requests/responses
- Exemplos de uso
- Autenticação via Bearer JWT

---

## 🔌 Endpoints

### Autenticação

| Método | Rota | Pública | Descrição |
|--------|------|---------|-----------|
| POST | `/auth/login` | ✅ | Autentica usuário e retorna JWT |
| GET | `/auth/me` | ❌ | Retorna perfil do usuário autenticado |

### Usuários

| Método | Rota | Pública | Descrição |
|--------|------|---------|-----------|
| POST | `/users` | ✅ | Cria novo usuário (retorna JWT) |

### Carteira

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/wallet/balance` | Consulta saldo atual |
| POST | `/wallet/deposit` | Realiza depósito |
| POST | `/wallet/transfer` | Transfere para outro usuário |
| POST | `/wallet/reverse/:transactionId` | Reverte uma transação |
| GET | `/wallet/transactions` | Histórico paginado |

---

## 🧪 Testes

### Executar Todos os Testes

```bash
# Unit tests
npm run test

# Com coverage
npm run test:cov

# E2E tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Executar Testes no Docker

```bash
# Unit tests
docker compose exec api npm run test

# Coverage
docker compose exec api npm run test:cov

# E2E tests
docker compose exec api npm run test:e2e
```

---

## 📊 Coverage



**Resumo:**

- **21 test suites** (17 unit + 4 e2e)
- **140+ testes**
- Cobertura abrangendo controllers, services, strategies, repositories, factories, pipes, interceptors, filters e decorators

### Estrutura de Testes

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.spec.ts
│   │   ├── auth.service.spec.ts
│   │   ├── guards/jwt-auth.guard.spec.ts
│   │   └── strategies/jwt.strategy.spec.ts
│   ├── users/
│   │   ├── users.controller.spec.ts
│   │   └── users.service.spec.ts
│   └── wallet/
│       ├── wallet.controller.spec.ts
│       ├── wallet.service.spec.ts
│       ├── strategies/*.spec.ts
│       ├── factories/*.spec.ts
│       ├── repositories/*.spec.ts
│       ├── events/*.spec.ts
│       └── dto/*.spec.ts
├── shared/
│   ├── decorators/*.spec.ts
│   ├── filters/*.spec.ts
│   ├── interceptors/*.spec.ts
│   └── pipes/*.spec.ts
└── test/
    └── app.e2e-spec.ts
```

---

## 🎨 Design Patterns

| Pattern | Onde | Justificativa |
|---------|------|---------------|
| **Strategy** | `wallet/strategies/` | Cada tipo de transação tem lógica própria (deposit, transfer, reversal). Open/Closed Principle. |
| **Repository** | `wallet/repositories/` | Abstrai TypeORM. Encapsula `SELECT FOR UPDATE`. Dependency Inversion. |
| **Factory** | `wallet/factories/` | Centraliza criação de Transactions. Evita erros de campos. |
| **Unit of Work** | `WalletService.executeTransaction()` | Gerencia ciclo de vida do QueryRunner (begin, commit, rollback). |
| **Observer/Event** | `wallet/events/` + RabbitMQ | Eventos publicados após commit. Desacopla operações de consumidores downstream. |
| **Dependency Injection** | AppModule (APP_GUARD) | Guard global JWT com decorator @PublicRoute para rotas públicas. |
| **Decorator** | `@PublicRoute()`, `@DisableTimeout()` | Metadados para modificar comportamento de guards/interceptors. |

---

## 🧠 Decisões Técnicas

### 1. Armazenamento em Centavos (Integer)
- **Decisão**: `amount` armazenado como `bigint` em centavos
- **Motivo**: Evita problemas de precisão de ponto flutuante com valores monetários
- **Implementação**: Transformer TypeORM converte automaticamente para number

### 2. Pessimistic Locking
- **Decisão**: `SELECT FOR UPDATE` via `findByIdWithLock()`
- **Motivo**: Previnir race conditions em operações concorrentes
- **Implementação**: Ordenação determinística de IDs para prevenir deadlocks

### 3. Unit of Work com QueryRunner
- **Decisão**: Transações gerenciadas manualmente via QueryRunner
- **Motivo**: Garantir atomicidade em operações complexas (transferência)
- **Benefício**: Rollback automático em caso de erro

### 4. RabbitMQ para Eventos
- **Decisão**: Eventos publicados fire-and-forget após commit
- **Motivo**: Desacoplar lógica de negócio de consumidores downstream
- **Benefício**: Falha no broker não bloqueia resposta ao usuário

### 5. Guard Global JWT
- **Decisão**: JwtAuthGuard registrado globalmente via APP_GUARD
- **Motivo**: Secure by default — rotas são protegidas automaticamente
- **Exceção**: Decorator `@PublicRoute()` marca rotas públicas

### 6. Custom Validation Pipe
- **Decisão**: Pipe global com tradução de erros
- **Motivo**: Formatar mensagens de validação consistentemente
- **Benefício**: Experiência de desenvolvedor melhorada

### 7. Timeout Global
- **Decisão**: Interceptor global configurável via TIMEOUT env var
- **Motivo**: Prevenir requisições longas indefinidamente
- **Exceção**: Decorator `@DisableTimeout()` para operações de longa duração

---

## 🗄 Modelagem de Dados

### User
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| name | varchar(255) | Nome completo |
| email | varchar(255) | Unique |
| password | varchar(255) | Hash bcrypt |
| balance | bigint | Saldo em centavos |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Última atualização |

### Transaction
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | PK |
| user_id | UUID | FK → User |
| type | enum | DEPOSIT, TRANSFER, REVERSAL |
| amount | bigint | Valor em centavos (sempre positivo) |
| related_user_id | UUID | FK → User (nullable) |
| related_transaction_id | UUID | FK → Transaction (nullable) |
| status | enum | COMPLETED, REVERSED |
| description | varchar(500) | Descrição opcional |
| created_at | timestamp | Data de criação |
| updated_at | timestamp | Última atualização |

---

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento
npm run start:dev      # Hot reload
npm run start:debug    # Debug mode
npm run start:prod     # Produção

# Build
npm run build          # Compila TypeScript

# Testes
npm run test           # Unit tests
npm run test:cov       # Com coverage
npm run test:e2e       # E2E tests
npm run test:watch     # Watch mode

# Migrations
npm run migration:run       # Executa migrations pendentes
npm run migration:revert    # Reverte última migration
npm run typeorm -- migration:show    # Mostra migrations

# Qualidade
npm run lint            # ESLint
npm run format          # Prettier
```

---