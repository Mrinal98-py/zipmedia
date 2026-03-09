// filter.js — Date Range filter (optional; scanning always works)

// ─── DATE RANGE ───────────────────────────────────────────────────────────────
// Returns { from, to } if both fields are filled, otherwise null (= no filter).
function getRange() {
    const vf = document.getElementById('dateRangeFrom').value;
    const vt = document.getElementById('dateRangeTo').value;
    if (!vf || !vt) return null;
    return {
        from: new Date(vf + 'T00:00:00'),
        to: new Date(vt + 'T23:59:59.999'),
    };
}

// ─── PRESETS ──────────────────────────────────────────────────────────────────
// Fills From and To inputs; Today/Yesterday set both to the same day.
function setPreset(key) {
    const now = new Date();
    const today = isoDate(now);
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

    const from = document.getElementById('dateRangeFrom');
    const to = document.getElementById('dateRangeTo');

    if (key === 'today') {
        from.value = today; to.value = today;
    } else if (key === 'yesterday') {
        const y = isoDate(addDays(now, -1));
        from.value = y; to.value = y;
    } else if (key === 'last7') {
        from.value = isoDate(addDays(now, -6)); to.value = today;
    } else if (key === 'last30') {
        from.value = isoDate(addDays(now, -29)); to.value = today;
    }

    // Re-filter if already scanned
    if (allScanned.length > 0) applyFilter();
}

// setMode stub — kept so nothing throws if called indirectly
function setMode(m) { dateMode = m; }

// ─── TAB SWITCH ───────────────────────────────────────────────────────────────
function switchTab(t) {
    currentTab = t;
    ['photo', 'video', 'both'].forEach(id => {
        const btn = document.getElementById('tab-' + id);
        btn.classList.toggle('active', id === t);
        btn.setAttribute('aria-selected', id === t);
    });
    document.getElementById('photoSettings').style.display = (t !== 'video') ? '' : 'none';
    document.getElementById('videoSettings').style.display = (t !== 'photo') ? '' : 'none';
    applyFilter();
}

// ─── ON DATE CHANGE ───────────────────────────────────────────────────────────
// Date is optional — changing it re-filters already-scanned files if present.
function onDateChange() {
    if (allScanned.length > 0) applyFilter();
}

// ─── FILTER ───────────────────────────────────────────────────────────────────
// If no date range is set → show ALL scanned files.
// If a range is set → filter to that window.
function applyFilter() {
    if (allScanned.length === 0) return;

    const range = getRange();

    let filtered;
    if (!range) {
        // No date filter — show everything
        filtered = allScanned;
    } else {
        filtered = allScanned.filter(f => {
            const d = new Date(f.lastModified);
            return d >= range.from && d <= range.to;
        });
    }

    files = filterByTab(filtered);
    renderAll();
    showDateResult(range);
}

function filterByTab(arr) {
    if (currentTab === 'photo') return arr.filter(isImage);
    if (currentTab === 'video') return arr.filter(isVideo);
    return arr;
}

// ─── DATE RESULT PILL ─────────────────────────────────────────────────────────
function showDateResult(range) {
    const photos = files.filter(isImage).length;
    const videos = files.filter(isVideo).length;
    const totalBytes = files.reduce((s, f) => s + f.size, 0);

    document.getElementById('resultCount').textContent =
        files.length + ' file' + (files.length === 1 ? '' : 's') + ' found'
        + (range ? '' : ' (all dates)');

    document.getElementById('resultDetail').textContent =
        photos + ' photo' + (photos === 1 ? '' : 's')
        + ' · ' + videos + ' video' + (videos === 1 ? '' : 's')
        + ' · ' + formatSize(totalBytes) + ' total';

    document.getElementById('dateResult').style.display = 'flex';
}
