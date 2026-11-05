import { createServer } from 'node:http';
import { once } from 'node:events';
import { createClient } from '../src/index.js';

const server = createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ message: 'Hello from Fetch Guard Kit!', path: request.url }));
});
server.listen(0, '127.0.0.1');
try {
  await once(server, 'listening');
  const api = createClient({ baseUrl: `http://127.0.0.1:${server.address().port}/api/` });
  console.log(await api.request('hello', { query: { name: 'developer' } }));
} finally {
  server.close();
}
