import dataSource from '../data-source';
import { seedCatalog } from './catalog.seed';

async function run(): Promise<void> {
  const source = await dataSource.initialize();
  try {
    await seedCatalog(source);
  } finally {
    await source.destroy();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
