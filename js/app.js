// ─── FOLDER SCANNING ─────────────────────────────────────────────────────────

function triggerScan() {
    const inp = document.getElementById('folderInput');
    inp.value = ''; // allow re-selecting the same folder
    inp.click();
}

function handleFolder(fileList) {
    const scanProg = document.getElementById('scanProgress');
    const scanStatus = document.getElementById('scanStatus');

    scanProg.style.display = 'block';
    document.getElementById('dateResult').style.display = 'none';
    scanStatus.textContent = 'Scanning ' + fileList.length + ' files…';

    // Small delay so the progress animation is visible before the sync loop runs
    setTimeout(() => {
        allScanned = [];
        for (let i = 0; i < fileList.length; i++) {
            if (isMedia(fileList[i])) allScanned.push(fileList[i]);
        }
        scanStatus.textContent = 'Found ' + allScanned.length + ' media files';

        setTimeout(() => {
            scanProg.style.display = 'none';
            applyFilter();
        }, 600);
    }, 700);
}

// ─── COMPRESS ALL ─────────────────────────────────────────────────────────────

async function compressAll() {
    if (files.length === 0) return;

    const btn = document.getElementById('compressBtn');
    btn.disabled = true;
    btn.textContent = 'Compressing…';

    results = [];
    let totalSaved = 0;

    const photoQuality = parseFloat(document.getElementById('photoQuality').value);
    const videoQuality = parseFloat(document.getElementById('videoQuality').value);
    const maxW = parseInt(document.getElementById('maxWidth').value, 10);

    for (let idx = 0; idx < files.length; idx++) {
        const f = files[idx];
        setProgress(idx, 10);

        try {
            const res = isImage(f)
                ? await compressImage(f, photoQuality, maxW, idx)
                : await compressVideo(f, videoQuality, idx);
            const outFile = typeof File === 'function'
                ? new File([res.blob], res.name, { type: res.blob.type || 'application/octet-stream' })
                : res.blob;

            setProgress(idx, 100);
            markDone(idx, f.size, outFile.size);
            totalSaved += Math.max(0, f.size - outFile.size);
            results.push({ name: res.name, blob: outFile, origSize: f.size });

        } catch (err) {
            markError(idx, err.message || 'Compression failed');
        }
    }

    updateStats(totalSaved);
    btn.textContent = 'Compress Filtered Files';
    btn.disabled = false;
    showDownloads();
}

// ─── CLEAR & RESET ────────────────────────────────────────────────────────────

function clearAll() {
    files = [];
    results = [];
    allScanned = [];

    document.getElementById('fileList').innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('downloadSection').style.display = 'none';
    document.getElementById('dateResult').style.display = 'none';
    document.getElementById('compressBtn').disabled = true;

    updateStats();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
// Pre-fill today's date so the "Scan Folder" button is immediately enabled.

(function init() {
    setPreset('today');
})();
