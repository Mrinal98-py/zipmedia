// ─── SHARED STATE ─────────────────────────────────────────────────────────────
let currentTab = 'photo';   // 'photo' | 'video' | 'both'
let dateMode = 'range';     // locked to 'range' (single day & full month removed)

let allScanned = [];        // File[] — every media file found in the scanned folder
let files = [];        // File[] — subset filtered by date + tab
let results = [];        // { name, blob, origSize }[]

// ─── PHOTO FORMATS ────────────────────────────────────────────────────────────
// Standard + RAW formats from iPhone, Android, and DSLR cameras.
// Note: RAW variants (dng, arw, nef, cr2, etc.) are detected and listed,
//       but the browser Canvas API cannot decode them — a helpful error is shown.
const IMG_EXT = new Set([
    // Standard web + iPhone
    'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif',
    // RAW / lossless
    'dng', 'tiff', 'tif', 'bmp',
    // Camera RAW (listed but show graceful error at compress time)
    'raw', 'arw', 'nef', 'cr2', 'cr3', 'orf', 'rw2', 'pef', 'srw',
]);

// ─── VIDEO FORMATS ────────────────────────────────────────────────────────────
// Covers iPhone (mov, m4v), Android (3gp, 3g2), and universal formats.
const VID_EXT = new Set([
    // iPhone / Apple
    'mp4', 'mov', 'm4v',
    // Android
    '3gp', '3g2',
    // Universal
    'avi', 'webm', 'mkv', 'flv', 'mpeg', 'mpg',
    'ts', 'mts', 'm2ts', 'wmv', 'asf', 'rmvb',
]);

// ─── CAMERA RAW EXTENSIONS ────────────────────────────────────────────────────
// These cannot be decoded by the browser's Canvas API.
const RAW_EXT = new Set([
    'raw', 'arw', 'nef', 'cr2', 'cr3', 'orf', 'rw2', 'pef', 'srw', 'dng',
]);
