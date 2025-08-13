const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
app.use(compression());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1d',
}));

// Health check
app.get('/health', (_req, res) => res.status(200).send('OK'));

// Fallback to index
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
