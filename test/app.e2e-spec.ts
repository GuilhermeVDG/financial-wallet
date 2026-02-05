import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { WalletEventPublisher } from '../src/modules/wallet/events/wallet-event.publisher';

describe('Financial Wallet API (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const testId = Date.now();
  const emailA = `e2e_${testId}_a@test.com`;
  const emailB = `e2e_${testId}_b@test.com`;
  const emailC = `e2e_${testId}_c@test.com`;
  const password = 'password123';

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let userAId: string;
  let userBId: string;

  let depositTx1Id: string;
  let transferDebit1Id: string;
  let transferDebit2Id: string;
  let creditTxForReceiverReversal: string;
  let depositTx2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WalletEventPublisher)
      .useValue({
        publish: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(
        `DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
        [`e2e_${testId}%`],
      );
      await dataSource.query(`DELETE FROM users WHERE email LIKE $1`, [
        `e2e_${testId}%`,
      ]);
    }
    await app?.close();
  });

  // ─── Users ───────────────────────────────────────────────────────────

  describe('POST /users', () => {
    it('should create user A with initial balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'User A', email: emailA, password, balance: 1000 })
        .expect(201);

      expect(res.body.user).toMatchObject({
        name: 'User A',
        email: emailA,
        balance: 1000,
      });
      expect(res.body.user.id).toBeDefined();
      expect(res.body.access_token).toBeDefined();

      userAId = res.body.user.id;
      tokenA = res.body.access_token;
    });

    it('should create user B with initial balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'User B', email: emailB, password, balance: 500 })
        .expect(201);

      userBId = res.body.user.id;
      tokenB = res.body.access_token;

      expect(res.body.user.balance).toBe(500);
    });

    it('should create user C without initial balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'User C', email: emailC, password })
        .expect(201);

      tokenC = res.body.access_token;

      expect(res.body.user.balance).toBe(0);
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Duplicate', email: emailA, password })
        .expect(409);
    });

    it('should return 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Bad', email: 'not-an-email', password })
        .expect(400);
    });

    it('should return 400 for short password', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Bad', email: 'short@test.com', password: '123' })
        .expect(400);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer()).post('/users').send({}).expect(400);
    });
  });

  // ─── Auth ────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('should login user A and return JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailA, password })
        .expect(201);

      expect(res.body.user).toMatchObject({ id: userAId, email: emailA });
      expect(res.body.access_token).toBeDefined();

      tokenA = res.body.access_token;
    });

    it('should login user B', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailB, password })
        .expect(201);

      tokenB = res.body.access_token;
    });

    it('should login user C', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailC, password })
        .expect(201);

      tokenC = res.body.access_token;
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: emailA, password: 'wrongpassword' })
        .expect(401);
    });

    it('should return 401 for non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return authenticated user profile with balance', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: userAId,
        name: 'User A',
        email: emailA,
        balance: 1000,
      });
      expect(res.body.createdAt).toBeDefined();
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  // ─── Wallet: Balance ─────────────────────────────────────────────────

  describe('GET /wallet/balance', () => {
    it('should return current balance for user A', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toEqual({ balance: 1000 });
    });

    it('should return 0 balance for user C', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(200);

      expect(res.body).toEqual({ balance: 0 });
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/wallet/balance').expect(401);
    });
  });

  // ─── Wallet: Deposit ─────────────────────────────────────────────────
  // A: 1000 → 1200

  describe('POST /wallet/deposit', () => {
    it('should deposit successfully', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 200, description: 'Test deposit' })
        .expect(201);

      expect(res.body.transaction).toMatchObject({
        type: 'DEPOSIT',
        amount: 200,
        status: 'COMPLETED',
        description: 'Test deposit',
        userId: userAId,
      });
      expect(res.body.transaction.id).toBeDefined();

      depositTx1Id = res.body.transaction.id;
    });

    it('should reflect updated balance after deposit', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.balance).toBe(1200);
    });

    it('should return 400 for zero amount', async () => {
      await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 0 })
        .expect(400);
    });

    it('should return 400 for negative amount', async () => {
      await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: -10 })
        .expect(400);
    });

    it('should return 400 for more than 2 decimal places', async () => {
      await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 10.555 })
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/wallet/deposit')
        .send({ amount: 100 })
        .expect(401);
    });
  });

  // ─── Wallet: Transfer ────────────────────────────────────────────────
  // A: 1200 → 900, B: 500 → 800

  describe('POST /wallet/transfer', () => {
    it('should transfer from A to B', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          recipientId: userBId,
          amount: 300,
          description: 'Payment to B',
        })
        .expect(201);

      expect(res.body.transaction).toMatchObject({
        type: 'TRANSFER',
        amount: 300,
        status: 'COMPLETED',
        userId: userAId,
        relatedUserId: userBId,
      });

      transferDebit1Id = res.body.transaction.id;
    });

    it('should verify A balance decreased', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.balance).toBe(900);
    });

    it('should verify B balance increased', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body.balance).toBe(800);
    });

    it('should return 409 for insufficient funds', async () => {
      await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userBId, amount: 999999 })
        .expect(409);
    });

    it('should return 409 for self-transfer', async () => {
      await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userAId, amount: 10 })
        .expect(409);
    });

    it('should return 404 for non-existent recipient', async () => {
      await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          recipientId: '00000000-0000-0000-0000-000000000000',
          amount: 10,
        })
        .expect(404);
    });

    it('should return 400 for invalid recipient UUID', async () => {
      await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: 'not-a-uuid', amount: 10 })
        .expect(400);
    });

    it('should return 400 for missing amount', async () => {
      await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userBId })
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/wallet/transfer')
        .send({ recipientId: userBId, amount: 10 })
        .expect(401);
    });
  });

  // ─── Wallet: Deposit Reversal ────────────────────────────────────────
  // A: 900 → 700

  describe('POST /wallet/reverse/:transactionId (deposit)', () => {
    it('should reverse the deposit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/wallet/reverse/${depositTx1Id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      expect(res.body.transaction).toMatchObject({
        type: 'REVERSAL',
        amount: 200,
        status: 'COMPLETED',
        userId: userAId,
        relatedTransactionId: depositTx1Id,
      });
    });

    it('should verify balance after deposit reversal', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.balance).toBe(700);
    });

    it('should return 409 when reversing already reversed deposit', async () => {
      await request(app.getHttpServer())
        .post(`/wallet/reverse/${depositTx1Id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(409);
    });
  });

  // ─── Wallet: Transfer Reversal (Sender Side) ────────────────────────
  // A: 700 → 550 (transfer), then 550 → 700 (reversal)
  // B: 800 → 950 (transfer), then 950 → 800 (reversal)

  describe('POST /wallet/reverse/:transactionId (transfer - sender)', () => {
    it('should create a transfer to reverse', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userBId, amount: 150 })
        .expect(201);

      transferDebit2Id = res.body.transaction.id;
      expect(res.body.transaction.amount).toBe(150);
    });

    it('should reverse the transfer from sender side', async () => {
      const res = await request(app.getHttpServer())
        .post(`/wallet/reverse/${transferDebit2Id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      expect(res.body.transaction).toMatchObject({
        type: 'REVERSAL',
        amount: 150,
        status: 'COMPLETED',
      });
    });

    it('should verify A balance restored after transfer reversal', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.balance).toBe(700);
    });

    it('should verify B balance restored after transfer reversal', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body.balance).toBe(800);
    });
  });

  // ─── Wallet: Transfer Reversal (Receiver Side - Security Fix) ───────
  // A: 700 → 600 (transfer 100 to B), B: 800 → 900
  // B reverses their credit → A: 700, B: 800

  describe('POST /wallet/reverse/:transactionId (transfer - receiver)', () => {
    it('should create a transfer from A to B', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userBId, amount: 100 })
        .expect(201);

      expect(res.body.transaction.amount).toBe(100);
    });

    it('should get B credit transaction ID from transaction history', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions?type=TRANSFER&limit=1')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);

      const creditTx = res.body.data[0];
      expect(creditTx.amount).toBe(100);
      expect(creditTx.status).toBe('COMPLETED');
      expect(creditTx.relatedTransactionId).toBeDefined();

      creditTxForReceiverReversal = creditTx.id;
    });

    it('should reverse the transfer from receiver side', async () => {
      const res = await request(app.getHttpServer())
        .post(`/wallet/reverse/${creditTxForReceiverReversal}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(201);

      expect(res.body.transaction).toMatchObject({
        type: 'REVERSAL',
        amount: 100,
        status: 'COMPLETED',
      });
    });

    it('should verify A got money back (not B)', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.balance).toBe(700);
    });

    it('should verify B returned money (not gained)', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body.balance).toBe(800);
    });
  });

  // ─── Wallet: Negative Balance Blocks Deposits ────────────────────────
  // A: 700 → 800 (deposit), 800 → 20 (transfer 780), 20 → -80 (reverse deposit)

  describe('Negative balance blocks deposits', () => {
    it('should deposit 100 to user A', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 100 })
        .expect(201);

      depositTx2Id = res.body.transaction.id;
    });

    it('should transfer 780 from A to B', async () => {
      await request(app.getHttpServer())
        .post('/wallet/transfer')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userBId, amount: 780 })
        .expect(201);
    });

    it('should reverse the 100 deposit making A balance negative', async () => {
      await request(app.getHttpServer())
        .post(`/wallet/reverse/${depositTx2Id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);
    });

    it('should confirm A has negative balance', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.balance).toBeLessThan(0);
    });

    it('should return 409 when trying to deposit with negative balance', async () => {
      const res = await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 50 })
        .expect(409);

      expect(res.body.message).toContain('negative');
    });
  });

  // ─── Wallet: Reversal Error Scenarios ────────────────────────────────

  describe('POST /wallet/reverse/:transactionId (errors)', () => {
    it('should return 404 for non-existent transaction', async () => {
      await request(app.getHttpServer())
        .post('/wallet/reverse/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('should return 404 when reversing another user transaction', async () => {
      // transferDebit1Id belongs to A and is still COMPLETED (never reversed)
      await request(app.getHttpServer())
        .post(`/wallet/reverse/${transferDebit1Id}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID format', async () => {
      await request(app.getHttpServer())
        .post('/wallet/reverse/not-a-uuid')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post(`/wallet/reverse/${depositTx1Id}`)
        .expect(401);
    });
  });

  // ─── Wallet: Transaction History ─────────────────────────────────────

  describe('GET /wallet/transactions', () => {
    it('should list transactions for user A', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);

      for (const tx of res.body.data) {
        expect(tx.id).toBeDefined();
        expect(tx.type).toBeDefined();
        expect(typeof tx.amount).toBe('number');
        expect(tx.status).toBeDefined();
      }
    });

    it('should paginate with limit and page', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
      expect(res.body.total).toBeGreaterThan(2);
    });

    it('should return page 2 with different results', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/wallet/transactions?page=1&limit=2')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get('/wallet/transactions?page=2&limit=2')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      if (page2.body.data.length > 0) {
        expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
      }
    });

    it('should filter by DEPOSIT type', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions?type=DEPOSIT')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      for (const tx of res.body.data) {
        expect(tx.type).toBe('DEPOSIT');
      }
    });

    it('should filter by TRANSFER type', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions?type=TRANSFER')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const tx of res.body.data) {
        expect(tx.type).toBe('TRANSFER');
      }
    });

    it('should filter by REVERSAL type', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions?type=REVERSAL')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      for (const tx of res.body.data) {
        expect(tx.type).toBe('REVERSAL');
      }
    });

    it('should return empty data for user C (no transactions)', async () => {
      const res = await request(app.getHttpServer())
        .get('/wallet/transactions')
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/wallet/transactions')
        .expect(401);
    });

    it('should return 400 for invalid type filter', async () => {
      await request(app.getHttpServer())
        .get('/wallet/transactions?type=INVALID')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);
    });
  });
});
