import app from '@/app';
import { env } from '@/config/env';

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
let stopping = false;

function handleSignal(): void {
  if (stopping) return;
  stopping = true;
  void server.stop().then(
    () => process.exit(0),
    (error: unknown) => {
      console.error('Mailer shutdown failed', error);
      process.exit(1);
    }
  );
}

process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);
console.log(`Mailer API listening on port ${env.PORT}`);
