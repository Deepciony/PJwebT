import { app } from './app';
import { env } from './env';
import { startJobs } from './jobs';

app.listen(env.port, () => console.log(`Arena Hub API: http://localhost:${env.port}  (docs: /docs)`));
startJobs();
