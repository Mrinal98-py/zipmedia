function renderAll() {
    const list = document.getElementById('fileList');
    const empty = document.getElementById('emptyState');
    list.innerHTML = '';
    results = [];

    if (files.length === 0) {
        empty.style.display = 'block';
        updateStats();
        document.getElementById('compressBtn').disabled = true;
        return;
    }

    empty.style.display = 'none';
    document.getElementById('compressBtn').disabled = false;

    files.forEach((f, idx) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = 'item-' + idx;
        const thumbId = 'thumb-' + idx;
        const isImg = isImage(f);
        const rawBadge = isRaw(f) ? '<span class="raw-badge">RAW</span>' : '';

        const detectedTs = getFileDate(f);
        const detectedDate = fmtDate(detectedTs);
        const dateSource = detectedTs !== f.lastModified ? '📅 ' : '🕒 ';

        item.innerHTML = `
      <div class="file-top">
        <div class="file-thumb" id="${thumbId}">${isImg ? '' : '🎬'}</div>
        <div class="file-info">
          <div class="file-name" title="${escHtml(f.name)}">${escHtml(f.name)} ${rawBadge}</div>
          <div class="file-meta">${formatSize(f.size)} · ${dateSource}${detectedDate}</div>
        </div>
        <div class="file-actions">
          <button class="remove-btn" onclick="removeFile(${idx})" title="Remove">✕</button>
        </div>
      </div>
      <div class="file-progress-wrap"><div class="file-progress" id="prog-${idx}"></div></div>
      <div class="file-result" id="res-${idx}"></div>
    `;

        list.appendChild(item);

        const ext = fileExt(f);
        const canPreview = isImg && !isRaw(f) && ext !== 'heic' && ext !== 'heif';

        if (canPreview) {
            const reader = new FileReader();
            reader.onload = e => {
                const th = document.getElementById(thumbId);
                if (th) th.innerHTML = `<img src="${e.target.result}" alt="${escHtml(f.name)}">`;
            };
            reader.readAsDataURL(f);
        } else if (isImg) {
            const th = document.getElementById(thumbId);
            if (th) th.textContent = ext === 'heic' || ext === 'heif' ? 'HEIC' : 'IMG';
        }
    });

    updateStats();
}

function removeFile(idx) {
    files.splice(idx, 1);
    renderAll();
    if (allScanned.length > 0) showDateResult();
}

function updateStats(savedBytes) {
    document.getElementById('statFiles').textContent = files.length;
    const total = files.reduce((s, f) => s + f.size, 0);
    document.getElementById('statSize').textContent = files.length ? formatSize(total) : '—';
    document.getElementById('statSaved').textContent = savedBytes != null ? formatSize(savedBytes) : '—';
}

function setProgress(idx, pct) {
    const el = document.getElementById('prog-' + idx);
    if (el) el.style.width = pct + '%';
}

function markDone(idx, before, after) {
    document.getElementById('item-' + idx)?.classList.add('done');
    const saved = before - after;
    const pct = before > 0 ? Math.round((saved / before) * 100) : 0;
    const res = document.getElementById('res-' + idx);
    if (res) res.textContent = `${formatSize(before)} → ${formatSize(after)} · ↓ ${pct}% saved`;
}

function markError(idx, msg) {
    document.getElementById('item-' + idx)?.classList.add('error');
    const res = document.getElementById('res-' + idx);
    if (res) { res.classList.add('err'); res.textContent = '⚠ ' + msg; }
}

function normalizeDownloadName(name, blob) {
    const trimmed = (name || '').trim();
    if (/\.[^.\s]+$/.test(trimmed)) return trimmed;

    const extByMime = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'video/webm': '.webm',
    };
    const ext = extByMime[blob?.type] || '.bin';
    return (trimmed || 'download') + ext;
}

function triggerBlobDownload(blob, name) {
    const fileName = normalizeDownloadName(name, blob);
    const downloadBlob = typeof File === 'function'
        ? new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
        : blob;
    const url = URL.createObjectURL(downloadBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showDownloads() {
    if (results.length === 0) return;
    const section = document.getElementById('downloadSection');
    const dlList = document.getElementById('dlList');
    const dlAll = document.getElementById('dlAllBtn');
    dlList.innerHTML = '';

    results.forEach((r, idx) => {
        const item = document.createElement('div');
        item.className = 'dl-item';
        item.innerHTML = `
      <span class="dl-name">${escHtml(normalizeDownloadName(r.name, r.blob))}</span>
      <span class="dl-size">${formatSize(r.blob.size)}</span>
      <button class="dl-btn" type="button" data-download-idx="${idx}">Download</button>
    `;
        const btn = item.querySelector('[data-download-idx]');
        btn.addEventListener('click', () => triggerBlobDownload(r.blob, r.name));
        dlList.appendChild(item);
    });

    dlAll.style.display = results.length > 1 ? 'block' : 'none';
    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadAll() {
    results.forEach(r => {
        triggerBlobDownload(r.blob, r.name);
    });
}
