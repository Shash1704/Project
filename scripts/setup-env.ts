// Interactive .env filler: values are typed into the terminal (hidden), never shown or logged.
// Then creates any missing Kafka topics and runs the health check.
import { readFileSync, writeFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { ALL_TOPICS } from '@pulse/shared';

const ENV = new URL('../.env', import.meta.url);

function ask(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = '';
    const raw = stdin.isTTY;
    if (raw) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.off('data', onData);
          if (raw) stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          return resolve(value.replace(/\[20[01]~/g, '').trim());
        }
        if (ch === '\u0003') process.exit(1);
        if (ch === '\u007f') {
          if (value) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
        } else if (ch >= ' ') {
          value += ch;
          stdout.write(hidden ? '•' : ch);
        }
      }
    };
    stdin.on('data', onData);
  });
}

function setVar(text: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  return new RegExp(`^${key}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${key}=.*$`, 'm'), line) : `${text.trimEnd()}\n${line}\n`;
}

const fields: { key: string; q: string; hidden: boolean; check: (v: string) => string | null }[] = [
  { key: 'VALKEY_URL', q: 'Valkey Service URI (rediss://…): ', hidden: true, check: (v) => (v.startsWith('rediss://') ? null : 'must start with rediss://') },
  {
    key: 'KAFKA_BROKERS',
    q: 'Kafka host:port (SASL): ',
    hidden: false,
    check: (v) => (/^[^\s:]+:\d+(,[^\s:]+:\d+)*$/.test(v) ? null : 'expected host:port'),
  },
  { key: 'KAFKA_SASL_USERNAME', q: 'Kafka SASL user: ', hidden: false, check: (v) => (v ? null : 'required') },
  { key: 'KAFKA_SASL_PASSWORD', q: 'Kafka SASL password: ', hidden: true, check: (v) => (v ? null : 'required') },
  { key: 'AI_API_KEY', q: 'Anthropic API key (Enter to skip): ', hidden: true, check: () => null },
];

let text = readFileSync(ENV, 'utf8');
console.log('Paste each value and press Enter. Leave blank to keep what is already in .env.\n');
for (const f of fields) {
  for (;;) {
    const v = await ask(f.q, f.hidden);
    if (!v) break;
    const err = f.check(v);
    if (err) {
      console.log(`  ✗ ${err}, try again`);
      continue;
    }
    text = setVar(text, f.key, v);
    break;
  }
}
writeFileSync(ENV, text);
console.log('\nSaved .env.\n');

process.loadEnvFile(ENV);
if (process.env.KAFKA_BROKERS?.trim()) {
  const { createKafka, errorMessage } = await import('@pulse/aiven');
  const admin = createKafka().admin();
  try {
    await admin.connect();
    const have = new Set(await admin.listTopics());
    const missing = ALL_TOPICS.filter((t) => !have.has(t));
    if (missing.length) {
      await admin.createTopics({ topics: missing.map((topic) => ({ topic, numPartitions: 3, replicationFactor: -1 })) });
      console.log(`Created Kafka topics: ${missing.join(', ')}`);
    } else console.log('Kafka topics already exist.');
  } catch (e) {
    console.log(`Could not create topics automatically (${errorMessage(e)}). Create them in the Aiven console → Topics.`);
  } finally {
    await admin.disconnect().catch(() => {});
  }
}
