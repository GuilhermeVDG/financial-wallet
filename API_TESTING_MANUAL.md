# Manual de Testagem da API - Financial Wallet

> **Base URL**: `http://localhost:3000`
>
> Todos os exemplos utilizam `curl`. Substitua os valores entre `< >` pelos dados reais obtidos nas respostas.

---

## Sumario

1. [Usuarios](#1-usuarios)
2. [Autenticacao](#2-autenticacao)
3. [Carteira](#3-carteira)
   - [Consultar Saldo](#31-consultar-saldo)
   - [Deposito](#32-deposito)
   - [Transferencia](#33-transferencia)
   - [Reversao](#34-reversao)
   - [Historico de Transacoes](#35-historico-de-transacoes)
4. [Fluxo Completo de Teste](#4-fluxo-completo-de-teste)
5. [Cenarios de Erro](#5-cenarios-de-erro)

---

## 1. Usuarios

### POST /users - Criar usuario

Cria um novo usuario e retorna um JWT para uso imediato.

**Body:**

| Campo      | Tipo     | Obrigatorio | Regras                       |
|------------|----------|-------------|------------------------------|
| `name`     | string   | sim         | nao pode ser vazio           |
| `email`    | string   | sim         | formato de email valido      |
| `password` | string   | sim         | minimo 6 caracteres          |
| `balance`  | number   | nao         | >= 0, max 2 casas decimais   |

**Requisicao - sem saldo inicial:**

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Silva",
    "email": "alice@email.com",
    "password": "senha123"
  }' | jq
```

**Requisicao - com saldo inicial:**

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Santos",
    "email": "bob@email.com",
    "password": "senha123",
    "balance": 1000.00
  }' | jq
```

**Resposta esperada (201):**

```json
{
  "user": {
    "id": "uuid-do-usuario",
    "name": "Bob Santos",
    "email": "bob@email.com",
    "balance": 1000.00
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Erros possiveis:**

| Status | Cenario                          | Mensagem                    |
|--------|----------------------------------|-----------------------------|
| 400    | campos invalidos/faltando        | detalhes de validacao       |
| 409    | email ja cadastrado              | `Email already registered`  |

---

## 2. Autenticacao

### POST /auth/login - Login

Autentica um usuario existente e retorna um JWT.

**Body:**

| Campo      | Tipo   | Obrigatorio | Regras                  |
|------------|--------|-------------|-------------------------|
| `email`    | string | sim         | formato de email valido |
| `password` | string | sim         | string nao vazia        |

**Requisicao:**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@email.com",
    "password": "senha123"
  }' | jq
```

**Resposta esperada (201):**

```json
{
  "user": {
    "id": "uuid-do-usuario",
    "name": "Alice Silva",
    "email": "alice@email.com"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Erros possiveis:**

| Status | Cenario              | Mensagem              |
|--------|----------------------|-----------------------|
| 401    | email nao encontrado | `Invalid credentials` |
| 401    | senha incorreta      | `Invalid credentials` |

---

### GET /auth/me - Perfil do usuario autenticado

Retorna os dados do usuario autenticado, incluindo saldo.

**Headers:** `Authorization: Bearer <token>`

**Requisicao:**

```bash
curl -s -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <TOKEN>" | jq
```

**Resposta esperada (200):**

```json
{
  "id": "uuid-do-usuario",
  "name": "Alice Silva",
  "email": "alice@email.com",
  "balance": 1000.00,
  "createdAt": "2026-02-04T03:00:00.000Z"
}
```

**Erros possiveis:**

| Status | Cenario           | Mensagem       |
|--------|-------------------|----------------|
| 401    | token ausente     | `Unauthorized` |
| 401    | token invalido    | `Unauthorized` |
| 401    | token expirado    | `Unauthorized` |

---

## 3. Carteira

> Todos os endpoints de carteira exigem autenticacao.
> Header obrigatorio: `Authorization: Bearer <token>`

---

### 3.1 Consultar Saldo

### GET /wallet/balance

Retorna o saldo atual do usuario autenticado.

**Requisicao:**

```bash
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN>" | jq
```

**Resposta esperada (200):**

```json
{
  "balance": 1000.00
}
```

---

### 3.2 Deposito

### POST /wallet/deposit

Adiciona fundos a carteira do usuario autenticado.

**Body:**

| Campo         | Tipo   | Obrigatorio | Regras                     |
|---------------|--------|-------------|----------------------------|
| `amount`      | number | sim         | > 0, max 2 casas decimais  |
| `description` | string | nao         | texto livre                |

**Requisicao:**

```bash
curl -s -X POST http://localhost:3000/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "amount": 500.50,
    "description": "Deposito inicial"
  }' | jq
```

**Resposta esperada (201):**

```json
{
  "transaction": {
    "id": "uuid-da-transacao",
    "userId": "uuid-do-usuario",
    "type": "DEPOSIT",
    "amount": 500.50,
    "relatedUserId": null,
    "relatedTransactionId": null,
    "status": "COMPLETED",
    "description": "Deposito inicial",
    "createdAt": "2026-02-04T03:00:00.000Z",
    "updatedAt": "2026-02-04T03:00:00.000Z"
  }
}
```

**Erros possiveis:**

| Status | Cenario                           | Mensagem                                              |
|--------|-----------------------------------|-------------------------------------------------------|
| 400    | amount <= 0 ou ausente            | detalhes de validacao                                 |
| 400    | amount com mais de 2 decimais     | detalhes de validacao                                 |
| 401    | nao autenticado                   | `Unauthorized`                                        |
| 409    | saldo negativo                    | `Deposits are not allowed when balance is negative`   |

---

### 3.3 Transferencia

### POST /wallet/transfer

Transfere fundos do usuario autenticado para outro usuario.

**Body:**

| Campo         | Tipo   | Obrigatorio | Regras                        |
|---------------|--------|-------------|-------------------------------|
| `recipientId` | string | sim         | UUID valido de usuario        |
| `amount`      | number | sim         | > 0, max 2 casas decimais    |
| `description` | string | nao         | texto livre                   |

**Requisicao:**

```bash
curl -s -X POST http://localhost:3000/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_ALICE>" \
  -d '{
    "recipientId": "<UUID_BOB>",
    "amount": 250.00,
    "description": "Pagamento"
  }' | jq
```

**Resposta esperada (201):**

A resposta retorna a transacao de debito (do remetente). Uma segunda transacao de credito e criada automaticamente para o destinatario.

```json
{
  "transaction": {
    "id": "uuid-transacao-debito",
    "userId": "uuid-alice",
    "type": "TRANSFER",
    "amount": 250.00,
    "relatedUserId": "uuid-bob",
    "relatedTransactionId": null,
    "status": "COMPLETED",
    "description": "Pagamento",
    "createdAt": "2026-02-04T03:00:00.000Z",
    "updatedAt": "2026-02-04T03:00:00.000Z"
  }
}
```

**Erros possiveis:**

| Status | Cenario                          | Mensagem                     |
|--------|----------------------------------|------------------------------|
| 400    | recipientId nao e UUID           | detalhes de validacao        |
| 400    | amount <= 0                      | detalhes de validacao        |
| 401    | nao autenticado                  | `Unauthorized`               |
| 404    | destinatario nao existe          | `Recipient not found`        |
| 409    | transferencia para si mesmo      | `Cannot transfer to yourself`|
| 409    | saldo insuficiente               | `Insufficient balance`       |

---

### 3.4 Reversao

### POST /wallet/reverse/:transactionId

Reverte uma transacao existente, restaurando os saldos ao estado anterior.

**Parametros de rota:**

| Parametro       | Tipo   | Regras        |
|-----------------|--------|---------------|
| `transactionId` | string | UUID valido   |

**Requisicao - reverter deposito:**

```bash
curl -s -X POST http://localhost:3000/wallet/reverse/<UUID_TRANSACAO_DEPOSITO> \
  -H "Authorization: Bearer <TOKEN>" | jq
```

**Requisicao - reverter transferencia:**

```bash
curl -s -X POST http://localhost:3000/wallet/reverse/<UUID_TRANSACAO_TRANSFER> \
  -H "Authorization: Bearer <TOKEN_REMETENTE>" | jq
```

**Resposta esperada (201):**

```json
{
  "transaction": {
    "id": "uuid-transacao-reversal",
    "userId": "uuid-do-usuario",
    "type": "REVERSAL",
    "amount": 500.50,
    "relatedUserId": null,
    "relatedTransactionId": "uuid-transacao-original",
    "status": "COMPLETED",
    "description": "Reversal of deposit uuid-transacao-original",
    "createdAt": "2026-02-04T03:00:00.000Z",
    "updatedAt": "2026-02-04T03:00:00.000Z"
  }
}
```

**Regras de reversao:**

- Depositos: subtrai o valor do saldo do usuario
- Transferencias: devolve o valor ao remetente e subtrai do destinatario. Ambas as transacoes (debito e credito) sao marcadas como `REVERSED`
- Apenas o dono da transacao original pode reverter
- Uma transacao so pode ser revertida uma vez
- Transacoes do tipo `REVERSAL` nao podem ser revertidas

**Erros possiveis:**

| Status | Cenario                             | Mensagem                                    |
|--------|-------------------------------------|---------------------------------------------|
| 400    | transactionId nao e UUID            | `Validation failed (uuid is expected)`      |
| 401    | nao autenticado                     | `Unauthorized`                              |
| 404    | transacao nao encontrada            | `Transaction not found`                     |
| 404    | transacao pertence a outro usuario  | `Transaction not found`                     |
| 409    | ja foi revertida                    | `Transaction has already been reversed`     |
| 409    | tentar reverter uma reversao        | `Cannot reverse a reversal transaction`     |

---

### 3.5 Historico de Transacoes

### GET /wallet/transactions

Lista as transacoes do usuario autenticado com paginacao e filtro por tipo.

**Query Parameters:**

| Parametro | Tipo   | Obrigatorio | Padrao | Regras                                |
|-----------|--------|-------------|--------|---------------------------------------|
| `page`    | number | nao         | 1      | inteiro >= 1                          |
| `limit`   | number | nao         | 20     | inteiro >= 1 e <= 100                 |
| `type`    | string | nao         | -      | `DEPOSIT`, `TRANSFER` ou `REVERSAL`  |

**Requisicao - todas as transacoes:**

```bash
curl -s -X GET "http://localhost:3000/wallet/transactions" \
  -H "Authorization: Bearer <TOKEN>" | jq
```

**Requisicao - filtrar por tipo + paginacao:**

```bash
curl -s -X GET "http://localhost:3000/wallet/transactions?type=DEPOSIT&page=1&limit=10" \
  -H "Authorization: Bearer <TOKEN>" | jq
```

**Resposta esperada (200):**

```json
{
  "data": [
    {
      "id": "uuid-transacao",
      "userId": "uuid-do-usuario",
      "type": "DEPOSIT",
      "amount": 500.50,
      "relatedUserId": null,
      "relatedTransactionId": null,
      "status": "COMPLETED",
      "description": "Deposito inicial",
      "createdAt": "2026-02-04T03:00:00.000Z",
      "updatedAt": "2026-02-04T03:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

---

## 4. Fluxo Completo de Teste

Script sequencial que exercita todos os endpoints. Copie e execute bloco a bloco, substituindo os valores obtidos.

### Passo 1 - Criar Usuario A (com saldo)

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Silva",
    "email": "alice@email.com",
    "password": "senha123",
    "balance": 1000.00
  }' | jq
```

> Anote o `access_token` como `TOKEN_A` e o `user.id` como `USER_A_ID`.

### Passo 2 - Criar Usuario B (com saldo)

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Santos",
    "email": "bob@email.com",
    "password": "senha123",
    "balance": 500.00
  }' | jq
```

> Anote o `access_token` como `TOKEN_B` e o `user.id` como `USER_B_ID`.

### Passo 3 - Login (validar que funciona independente do registro)

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@email.com",
    "password": "senha123"
  }' | jq
```

### Passo 4 - Consultar perfil (GET /auth/me)

```bash
curl -s -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Espera-se `balance: 1000.00`.

### Passo 5 - Consultar saldo

```bash
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Espera-se `{ "balance": 1000.00 }`.

### Passo 6 - Depositar R$ 250,00

```bash
curl -s -X POST http://localhost:3000/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{
    "amount": 250.00,
    "description": "Deposito extra"
  }' | jq
```

> Anote o `transaction.id` como `DEPOSIT_TX_ID`.

### Passo 7 - Verificar saldo atualizado

```bash
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Espera-se `{ "balance": 1250.00 }`.

### Passo 8 - Transferir R$ 300,00 de A para B

```bash
curl -s -X POST http://localhost:3000/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{
    "recipientId": "<USER_B_ID>",
    "amount": 300.00,
    "description": "Pagamento de servico"
  }' | jq
```

> Anote o `transaction.id` como `TRANSFER_TX_ID`.

### Passo 9 - Verificar saldos apos transferencia

```bash
# Saldo de A (esperado: 950.00)
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN_A>" | jq

# Saldo de B (esperado: 800.00)
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN_B>" | jq
```

### Passo 10 - Listar transacoes de A

```bash
curl -s -X GET "http://localhost:3000/wallet/transactions" \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Deve conter 2 transacoes: 1 DEPOSIT + 1 TRANSFER.

### Passo 11 - Listar transacoes de B

```bash
curl -s -X GET "http://localhost:3000/wallet/transactions" \
  -H "Authorization: Bearer <TOKEN_B>" | jq
```

> Deve conter 1 transacao: 1 TRANSFER (credito recebido).

### Passo 12 - Reverter a transferencia

```bash
curl -s -X POST http://localhost:3000/wallet/reverse/<TRANSFER_TX_ID> \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

### Passo 13 - Verificar saldos apos reversao da transferencia

```bash
# Saldo de A (esperado: 1250.00 - voltou ao estado pre-transferencia)
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN_A>" | jq

# Saldo de B (esperado: 500.00 - voltou ao estado pre-transferencia)
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN_B>" | jq
```

### Passo 14 - Reverter o deposito

```bash
curl -s -X POST http://localhost:3000/wallet/reverse/<DEPOSIT_TX_ID> \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

### Passo 15 - Verificar saldo final

```bash
curl -s -X GET http://localhost:3000/wallet/balance \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Espera-se `{ "balance": 1000.00 }` (voltou ao saldo inicial do cadastro).

### Passo 16 - Verificar historico completo

```bash
curl -s -X GET "http://localhost:3000/wallet/transactions" \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Deve conter 4 transacoes:
> 1. DEPOSIT (status: REVERSED)
> 2. TRANSFER (status: REVERSED)
> 3. REVERSAL (da transferencia)
> 4. REVERSAL (do deposito)

---

## 5. Cenarios de Erro

Testes para validar que as regras de negocio sao aplicadas corretamente.

### 5.1 Criar usuario com email duplicado

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Duplicada",
    "email": "alice@email.com",
    "password": "senha123"
  }' | jq
```

> Esperado: **409** - `Email already registered`

### 5.2 Login com senha errada

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@email.com",
    "password": "senhaerrada"
  }' | jq
```

> Esperado: **401** - `Invalid credentials`

### 5.3 Acessar rota protegida sem token

```bash
curl -s -X GET http://localhost:3000/wallet/balance | jq
```

> Esperado: **401** - `Unauthorized`

### 5.4 Depositar valor invalido

```bash
# Valor zero
curl -s -X POST http://localhost:3000/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{ "amount": 0 }' | jq

# Valor negativo
curl -s -X POST http://localhost:3000/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{ "amount": -100 }' | jq

# Mais de 2 casas decimais
curl -s -X POST http://localhost:3000/wallet/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{ "amount": 10.999 }' | jq
```

> Esperado: **400** para todos

### 5.5 Transferir para si mesmo

```bash
curl -s -X POST http://localhost:3000/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{
    "recipientId": "<USER_A_ID>",
    "amount": 100.00
  }' | jq
```

> Esperado: **409** - `Cannot transfer to yourself`

### 5.6 Transferir com saldo insuficiente

```bash
curl -s -X POST http://localhost:3000/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{
    "recipientId": "<USER_B_ID>",
    "amount": 999999.00
  }' | jq
```

> Esperado: **409** - `Insufficient balance`

### 5.7 Transferir para usuario inexistente

```bash
curl -s -X POST http://localhost:3000/wallet/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_A>" \
  -d '{
    "recipientId": "00000000-0000-0000-0000-000000000000",
    "amount": 10.00
  }' | jq
```

> Esperado: **404** - `Recipient not found`

### 5.8 Reverter transacao ja revertida

```bash
curl -s -X POST http://localhost:3000/wallet/reverse/<TRANSFER_TX_ID> \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Esperado: **409** - `Transaction has already been reversed`

### 5.9 Reverter transacao de outro usuario

```bash
# Usando o token de B para reverter uma transacao de A
curl -s -X POST http://localhost:3000/wallet/reverse/<DEPOSIT_TX_ID> \
  -H "Authorization: Bearer <TOKEN_B>" | jq
```

> Esperado: **404** - `Transaction not found`

### 5.10 Reverter uma reversao

```bash
# Primeiro obtenha o ID de uma transacao REVERSAL no historico
curl -s -X POST http://localhost:3000/wallet/reverse/<UUID_TRANSACAO_REVERSAL> \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Esperado: **409** - `Cannot reverse a reversal transaction`

### 5.11 Reverter com UUID invalido

```bash
curl -s -X POST http://localhost:3000/wallet/reverse/nao-e-uuid \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Esperado: **400** - `Validation failed (uuid is expected)`

### 5.12 Filtrar transacoes por tipo

```bash
# Apenas depositos
curl -s -X GET "http://localhost:3000/wallet/transactions?type=DEPOSIT" \
  -H "Authorization: Bearer <TOKEN_A>" | jq

# Apenas transferencias
curl -s -X GET "http://localhost:3000/wallet/transactions?type=TRANSFER" \
  -H "Authorization: Bearer <TOKEN_A>" | jq

# Apenas reversoes
curl -s -X GET "http://localhost:3000/wallet/transactions?type=REVERSAL" \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

### 5.13 Paginacao invalida

```bash
# Pagina 0
curl -s -X GET "http://localhost:3000/wallet/transactions?page=0" \
  -H "Authorization: Bearer <TOKEN_A>" | jq

# Limite acima de 100
curl -s -X GET "http://localhost:3000/wallet/transactions?limit=200" \
  -H "Authorization: Bearer <TOKEN_A>" | jq
```

> Esperado: **400** para ambos

---

## Tabela de Referencia Rapida

| Metodo | Endpoint                          | Auth  | Descricao                      |
|--------|-----------------------------------|-------|--------------------------------|
| POST   | `/users`                          | nao   | Criar usuario                  |
| POST   | `/auth/login`                     | nao   | Login                          |
| GET    | `/auth/me`                        | sim   | Perfil do usuario autenticado  |
| GET    | `/wallet/balance`                 | sim   | Consultar saldo                |
| POST   | `/wallet/deposit`                 | sim   | Realizar deposito              |
| POST   | `/wallet/transfer`                | sim   | Realizar transferencia         |
| POST   | `/wallet/reverse/:transactionId`  | sim   | Reverter transacao             |
| GET    | `/wallet/transactions`            | sim   | Historico com paginacao/filtro |
