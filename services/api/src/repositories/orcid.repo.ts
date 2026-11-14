import type { Env } from '@/types/env';
import { requireD1 } from '@/types/env';

export interface OrcidLinkIntent {
  userId: string;
  stateHash: string;
  sessionId: string;
  portalOrigin: string;
  expiresAt: number;
}

export interface OrcidRepository {
  saveIntent(intent: OrcidLinkIntent): Promise<void>;
  getIntent(stateHash: string): Promise<OrcidLinkIntent | null>;
  connect(intent: OrcidLinkIntent, identifier: string): Promise<boolean>;
  disconnect(userId: string): Promise<void>;
  getForUser(userId: string): Promise<string | null>;
  getForUsername(username: string): Promise<string | null>;
}

const PROVIDER = 'orcid';

function d1Repository(db: D1Database): OrcidRepository {
  return {
    async saveIntent(intent) {
      await db
        .prepare(
          `INSERT INTO orcid_link_intent ("userId", "stateHash", "sessionId", "portalOrigin", "expiresAt") VALUES (?, ?, ?, ?, ?)
        ON CONFLICT("userId") DO UPDATE SET "stateHash"=excluded."stateHash", "sessionId"=excluded."sessionId", "portalOrigin"=excluded."portalOrigin", "expiresAt"=excluded."expiresAt"`
        )
        .bind(
          intent.userId,
          intent.stateHash,
          intent.sessionId,
          intent.portalOrigin,
          intent.expiresAt
        )
        .run();
    },
    async getIntent(stateHash) {
      return db
        .prepare('SELECT * FROM orcid_link_intent WHERE "stateHash" = ?')
        .bind(stateHash)
        .first<OrcidLinkIntent>();
    },
    async connect(intent, identifier) {
      const now = Date.now();
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
          SELECT ?, ?, ?, "userId", ?, ? FROM orcid_link_intent
          WHERE "userId"=? AND "stateHash"=? AND "sessionId"=? AND "expiresAt">?
          ON CONFLICT("userId", "providerId") WHERE "providerId"='orcid'
          DO UPDATE SET "accountId"=excluded."accountId", "updatedAt"=excluded."updatedAt"`
          )
          .bind(
            crypto.randomUUID(),
            identifier,
            PROVIDER,
            now,
            now,
            intent.userId,
            intent.stateHash,
            intent.sessionId,
            now
          ),
        db
          .prepare(
            'DELETE FROM orcid_link_intent WHERE "userId"=? AND "stateHash"=?'
          )
          .bind(intent.userId, intent.stateHash),
      ]);
      return (results[0]?.meta.changes ?? 0) === 1;
    },
    async disconnect(userId) {
      await db.batch([
        db
          .prepare('DELETE FROM orcid_link_intent WHERE "userId"=?')
          .bind(userId),
        db
          .prepare('DELETE FROM account WHERE "userId"=? AND "providerId"=?')
          .bind(userId, PROVIDER),
      ]);
    },
    async getForUser(userId) {
      const row = await db
        .prepare(
          'SELECT "accountId" FROM account WHERE "userId"=? AND "providerId"=?'
        )
        .bind(userId, PROVIDER)
        .first<{ accountId: string }>();
      return row?.accountId ?? null;
    },
    async getForUsername(username) {
      const rows = await db
        .prepare(
          `SELECT a."accountId" FROM "user" u LEFT JOIN account a ON a."userId"=u.id AND a."providerId"=?
        WHERE lower(substr(u.email,1,instr(u.email,'@')-1))=? LIMIT 2`
        )
        .bind(PROVIDER, username)
        .all<{ accountId: string | null }>();
      return rows.results.length === 1
        ? (rows.results[0]?.accountId ?? null)
        : null;
    },
  };
}

function postgresRepository(
  pool: NonNullable<Env['AUTH_DATABASE']>
): OrcidRepository {
  return {
    async saveIntent(intent) {
      await pool.query(
        `INSERT INTO orcid_link_intent ("userId", "stateHash", "sessionId", "portalOrigin", "expiresAt") VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT("userId") DO UPDATE SET "stateHash"=excluded."stateHash", "sessionId"=excluded."sessionId", "portalOrigin"=excluded."portalOrigin", "expiresAt"=excluded."expiresAt"`,
        [
          intent.userId,
          intent.stateHash,
          intent.sessionId,
          intent.portalOrigin,
          intent.expiresAt,
        ]
      );
    },
    async getIntent(stateHash) {
      const result = await pool.query<OrcidLinkIntent>(
        'SELECT * FROM orcid_link_intent WHERE "stateHash"=$1',
        [stateHash]
      );
      return result.rows[0] ?? null;
    },
    async connect(intent, identifier) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // The user row serializes connect and disconnect across concurrent callbacks.
        await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
          intent.userId,
        ]);
        const pending = await client.query(
          'SELECT 1 FROM orcid_link_intent WHERE "userId"=$1 AND "stateHash"=$2 AND "sessionId"=$3 AND "expiresAt">$4 FOR UPDATE',
          [intent.userId, intent.stateHash, intent.sessionId, Date.now()]
        );
        if (!pending.rowCount) {
          await client.query('ROLLBACK');
          return false;
        }
        await client.query(
          `INSERT INTO account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())
          ON CONFLICT("userId", "providerId") WHERE "providerId"='orcid'
          DO UPDATE SET "accountId"=excluded."accountId", "updatedAt"=NOW()`,
          [crypto.randomUUID(), identifier, PROVIDER, intent.userId]
        );
        await client.query('DELETE FROM orcid_link_intent WHERE "userId"=$1', [
          intent.userId,
        ]);
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async disconnect(userId) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [
          userId,
        ]);
        await client.query('DELETE FROM orcid_link_intent WHERE "userId"=$1', [
          userId,
        ]);
        await client.query(
          'DELETE FROM account WHERE "userId"=$1 AND "providerId"=$2',
          [userId, PROVIDER]
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async getForUser(userId) {
      const result = await pool.query<{ accountId: string }>(
        'SELECT "accountId" FROM account WHERE "userId"=$1 AND "providerId"=$2',
        [userId, PROVIDER]
      );
      return result.rows[0]?.accountId ?? null;
    },
    async getForUsername(username) {
      const result = await pool.query<{ accountId: string | null }>(
        `SELECT a."accountId" FROM "user" u LEFT JOIN account a ON a."userId"=u.id AND a."providerId"=$1
        WHERE lower(split_part(u.email,'@',1))=$2 LIMIT 2`,
        [PROVIDER, username]
      );
      return result.rows.length === 1
        ? (result.rows[0]?.accountId ?? null)
        : null;
    },
  };
}

export function orcidRepository(env: Env): OrcidRepository {
  return env.AUTH_DATABASE
    ? postgresRepository(env.AUTH_DATABASE)
    : d1Repository(requireD1(env));
}
