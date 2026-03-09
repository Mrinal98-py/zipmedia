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

// ─── FILE DATE DETECTION ──────────────────────────────────────────────────────
// Phones embed the capture date in the filename. Parsing it gives accurate
// results even when lastModified reflects the PC transfer date (not capture date).
//
// Patterns handled:
//   Android/Samsung  IMG_20240309_143022.jpg    VID_20240309_143022.mp4
//   Screenshot       Screenshot_20240309-143022.jpg
//   WhatsApp         IMG-20240309-WA0001.jpg    VID-20240309-WA0001.mp4
//   General          20240309_143022.jpg         2024-03-09 14.30.jpg
//   iPhone fallback  IMG_0001.HEIC              → uses lastModified
//
// Returns a millisecond timestamp (same type as file.lastModified).
function getFileDate(file) {
    const name = file.name;

    // Match YYYYMMDD or YYYY-MM-DD or YYYY_MM_DD anywhere in the filename
    const m = name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    if (m) {
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        const d = parseInt(m[3], 10);

        // Sanity-check: plausible year (2000-2035), valid month and day
        if (y >= 2000 && y <= 2035 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
            // Also parse time if present right after the date block
            const rest = name.slice(m.index + m[0].length);
            const timeM = rest.match(/[-_T ]?(\d{2})[-_:.]?(\d{2})[-_:.]?(\d{2})/);
            if (timeM) {
                return new Date(
                    y, mo - 1, d,
                    parseInt(timeM[1], 10),
                    parseInt(timeM[2], 10),
                    parseInt(timeM[3], 10)
                ).getTime();
            }
            return new Date(y, mo - 1, d).getTime();
        }
    }

    // Fallback: filesystem modification date
    return file.lastModified;
}
