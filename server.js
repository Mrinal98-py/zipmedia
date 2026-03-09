'use strict';

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// ─── SECURITY HEADERS ─────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            mediaSrc: ["'self'", 'blob:'],
            connectSrc: ["'self'"],
            workerSrc: ["'self'", 'blob:'],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // required for SharedArrayBuffer / blob: URLs
}));

// ─── GZIP COMPRESSION ─────────────────────────────────────────────────────────
app.use(compression());

// ─── REQUEST LOGGING ──────────────────────────────────────────────────────────
app.use(morgan(ENV === 'production' ? 'combined' : 'dev'));

// ─── STATIC ASSETS ────────────────────────────────────────────────────────────
// Serve everything in /public with aggressive caching for versioned assets.
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: ENV === 'production' ? '1y' : 0,
    etag: true,
    index: 'index.html',
}));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
// Used by load balancers / Docker HEALTHCHECK / uptime monitors.
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: require('./package.json').version, env: ENV });
});

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
// Any GET that isn't a static asset routes to index.html.
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n  ✦ ZipMedia running`);
    console.log(`  → Local:   http://localhost:${PORT}`);
    console.log(`  → Env:     ${ENV}\n`);
});

module.exports = app; // exported for testing
