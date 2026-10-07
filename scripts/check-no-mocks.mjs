// Fails if mock/fixture data appears in shipped source (CLAUDE.md: no mocks in features marked done).
// Test files are exempt. Also guards against files written into the repo by other tools.
import { execSync } from 'node:child_process';

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /^(apps|packages)\/[^/]+\/src\//.test(f))
  .filter((f) => !/\.test\.tsx?$/.test(f));

const bad = files.filter((f) =>
  /(^|\/)(mocks?|__mocks__|fixtures?|fake[-_]?data)(\/|\.|$)|seeded-?data/i.test(f),
);

if (bad.length) {
  console.error(
    'Mock/fixture data found in shipped source:\n' + bad.map((f) => `  ${f}`).join('\n'),
  );
  process.exit(1);
}
console.log(`no-mocks: ${files.length} source files clean`);
