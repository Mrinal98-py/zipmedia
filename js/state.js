// ─── SHARED STATE ────────────────────────────────────────────────────────────
// All modules read/write these variables directly.

let currentTab  = 'photo';  // 'photo' | 'video' | 'both'
let dateMode    = 'single'; // 'single' | 'range' | 'month'

let allScanned  = [];  // File[] — every media file found in the scanned folder
let files       = [];  // File[] — subset filtered by date + tab
let results     = [];  // { name:string, blob:Blob, origSize:number }[]

// ─── MEDIA TYPE CONSTANTS ─────────────────────────────────────────────────────
const IMG_EXT = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp', 'gif']);
const VID_EXT = new Set(['mp4', 'mov', 'avi', 'webm', 'm4v']);
