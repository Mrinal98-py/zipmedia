// ─── DATE RANGE ───────────────────────────────────────────────────────────────

/**
 * Returns { from: Date, to: Date } for the current mode/inputs.
 * Returns null if the required input is not yet filled.
 */
function getRange() {
    if (dateMode === 'single') {
        const v = document.getElementById('dateFrom').value;
        if (!v) return null;
        return {
            from: new Date(v + 'T00:00:00'),
            to: new Date(v + 'T23:59:59.999'),
        };
    }

    if (dateMode === 'range') {
        const vf = document.getElementById('dateRangeFrom').value;
        const vt = document.getElementById('dateRangeTo').value;
        if (!vf || !vt) return null;
        return {
            from: new Date(vf + 'T00:00:00'),
            to: new Date(vt + 'T23:59:59.999'),
        };
    }

    if (dateMode === 'month') {
        const v = document.getElementById('dateMonth').value;
        if (!v) return null;
        const [y, m] = v.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        return {
            from: new Date(y, m - 1, 1, 0, 0, 0),
            to: new Date(y, m - 1, lastDay, 23, 59, 59, 999),
        };
    }

    return null;
}

function hasDate() {
    return getRange() !== null;
}

// ─── DATE PRESETS ─────────────────────────────────────────────────────────────

function setPreset(key) {
    const now = new Date();
    const today = isoDate(now);
    const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

    if (key === 'today') {
        setMode('single');
        document.getElementById('dateFrom').value = today;

    } else if (key === 'yesterday') {
        setMode('single');
        document.getElementById('dateFrom').value = isoDate(addDays(now, -1));

    } else if (key === 'last7') {
        setMode('range');
        document.getElementById('dateRangeFrom').value = isoDate(addDays(now, -6));
        document.getElementById('dateRangeTo').value = today;

    } else if (key === 'last30') {
        setMode('range');
        document.getElementById('dateRangeFrom').value = isoDate(addDays(now, -29));
        document.getElementById('dateRangeTo').value = today;

    } else if (key === 'thismonth') {
        setMode('month');
        document.getElementById('dateMonth').value = isoMonth(now);
    }

    onDateChange();
}

// ─── MODE SWITCH ──────────────────────────────────────────────────────────────

function setMode(m) {
    dateMode = m;

    ['single', 'range', 'month'].forEach(id => {
        document.getElementById('mode-' + id).classList.toggle('active', id === m);
    });

    document.getElementById('ig-single').style.display = m === 'single' ? '' : 'none';
    document.getElementById('ig-range-from').style.display = m === 'range' ? '' : 'none';
    document.getElementById('ig-range-to').style.display = m === 'range' ? '' : 'none';
    document.getElementById('ig-month').style.display = m === 'month' ? '' : 'none';

    onDateChange();
}

// ─── TAB SWITCH ───────────────────────────────────────────────────────────────

function switchTab(t) {
    currentTab = t;

    ['photo', 'video', 'both'].forEach(id => {
        const btn = document.getElementById('tab-' + id);
        btn.classList.toggle('active', id === t);
        btn.setAttribute('aria-selected', id === t);
    });

    // Show/hide settings panels
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
