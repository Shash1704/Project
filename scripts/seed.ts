import { loadRootEnv } from '@pulse/aiven/load-env';
loadRootEnv();

import { db, closeDb } from '@pulse/db';
import { seededUsers } from '@pulse/shared';

async function main() {
  console.log('Seeding users...');
  for (const user of seededUsers) {
    await db().query(
      `INSERT INTO users (id, email, name, avatar_seed, about, lang, is_demo) 
       VALUES (?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       email = VALUES(email), 
       name = VALUES(name), 
       avatar_seed = VALUES(avatar_seed), 
       about = VALUES(about), 
       lang = VALUES(lang), 
       is_demo = VALUES(is_demo)`,
      [
        user.id,
        user.email,
        user.name,
        user.avatarSeed,
        user.about,
        user.lang,
        user.isDemo ? 1 : 0,
      ],
    );
  }
  console.log('Done!');
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
