// ─── MEDIA TYPE HELPERS ───────────────────────────────────────────────────────

function fileExt(f) {
    return f.name.split('.').pop().toLowerCase();
}

function isImage(f) {
    return IMG_EXT.has(fileExt(f)) || f.type.startsWith('image/');
}

function isVideo(f) {
    return VID_EXT.has(fileExt(f)) || f.type.startsWith('video/');
}

function isMedia(f) {
    return isImage(f) || isVideo(f);
}

function isRaw(f) {
    return RAW_EXT.has(fileExt(f));
}

// ─── SIZE FORMATTER ───────────────────────────────────────────────────────────
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// ─── RANGE SLIDER LABEL ───────────────────────────────────────────────────────
function updateLabel(inputId, labelId, formatFn) {
    const v = parseFloat(document.getElementById(inputId).value);
    document.getElementById(labelId).textContent = formatFn(v);
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

/** Format a lastModified timestamp as "09 Mar 2026  14:32" */
function fmtDate(ts) {
    const d = new Date(ts);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return date + '  ' + time;
}

/** YYYY-MM-DD using local time (avoids UTC off-by-one on +05:30) */
function isoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** YYYY-MM using local time */
function isoMonth(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

// ─── HTML ESCAPING ────────────────────────────────────────────────────────────
function escHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
