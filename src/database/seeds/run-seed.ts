import 'dotenv/config';

function run(): Promise<void> {
  console.log('No seeds registered yet.');
  return Promise.resolve();
}

run()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
