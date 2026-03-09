// filter.js — Date Range only (Single Day and Full Month removed)

// ─── DATE RANGE ───────────────────────────────────────────────────────────────
function getRange() {
    const vf = document.getElementById('dateRangeFrom').value;
    const vt = document.getElementById('dateRangeTo').value;
    if (!vf || !vt) return null;
    return {
        from: new Date(vf + 'T00:00:00'),
        to: new Date(vt + 'T23:59:59.999'),
    };
}

function hasDate() { return getRange() !== null; }

// ─── PRESETS ─────────────────────────────────────────────────────────────────
// All presets now fill the From/To range inputs directly.
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

    onDateChange();
}

// ─── setMode (stub — kept so no ReferenceError if anything calls it) ─────────
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

// ─── ON DATE INPUT CHANGE ─────────────────────────────────────────────────────
function onDateChange() {
    document.getElementById('scanBtn').disabled = !hasDate();
    if (allScanned.length > 0) applyFilter();
}

// ─── FILTER ───────────────────────────────────────────────────────────────────
function applyFilter() {
    const range = getRange();
    if (!range || allScanned.length === 0) {
        if (allScanned.length === 0) return;
        files = filterByTab(allScanned);
        renderAll();
        return;
    }
    const byDate = allScanned.filter(f => {
        const d = new Date(f.lastModified);
        return d >= range.from && d <= range.to;
    });
    files = filterByTab(byDate);
    renderAll();
    showDateResult();
}

function filterByTab(arr) {
    if (currentTab === 'photo') return arr.filter(isImage);
    if (currentTab === 'video') return arr.filter(isVideo);
    return arr;
}

// ─── DATE RESULT PILL ─────────────────────────────────────────────────────────
function showDateResult() {
    const photos = files.filter(isImage).length;
    const videos = files.filter(isVideo).length;
    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    document.getElementById('resultCount').textContent =
        files.length + ' file' + (files.length === 1 ? '' : 's') + ' found';
    document.getElementById('resultDetail').textContent =
        photos + ' photo' + (photos === 1 ? '' : 's')
        + ' · ' + videos + ' video' + (videos === 1 ? '' : 's')
        + ' · ' + formatSize(totalBytes) + ' total';
    document.getElementById('dateResult').style.display = 'flex';
}
