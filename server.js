import server from './api/ws.js';

const PORT = Number(process.env.PORT || 10000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`LinkLine call server running on port ${PORT}`);
});
