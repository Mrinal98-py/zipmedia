// ─── FORMAT DETECTION ─────────────────────────────────────────────────────────
// Maps file extension → { mime, outExt, lossless }
// Original format is ALWAYS preserved — JPG in → JPG out, etc.

function getMimeAndExt(file) {
    const e = fileExt(file);

    // ── Camera RAW — browser canvas cannot decode these ───────────────────────
    if (RAW_EXT.has(e)) return { mime: null, outExt: '.' + e, lossless: false, isRawFormat: true };

    // ── Lossless image formats ─────────────────────────────────────────────────
    if (e === 'png') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'tiff' || e === 'tif') return { mime: 'image/png', outExt: '.png', lossless: true }; // TIFF → PNG (browser can decode TIFF in some cases)
    if (e === 'bmp') return { mime: 'image/png', outExt: '.png', lossless: true }; // BMP → PNG

    // ── Lossy image formats ────────────────────────────────────────────────────
    if (e === 'webp') return { mime: 'image/webp', outExt: '.webp', lossless: false };
    if (e === 'gif') return { mime: 'image/png', outExt: '.png', lossless: true }; // canvas can't encode GIF animation
    if (e === 'heic' || e === 'heif') return { mime: 'image/jpeg', outExt: '.' + e, lossless: false }; // iOS reads HEIC by content signature

    // ── JPG / JPEG / everything else → JPEG ───────────────────────────────────
    return { mime: 'image/jpeg', outExt: '.jpg', lossless: false };
}

// ─── IMAGE COMPRESSION ────────────────────────────────────────────────────────
// Pipeline: FileReader → <img> → <canvas> → toBlob
// Quality is applied only to lossy formats; lossless formats ignore it.

function compressImage(file, quality, maxW, idx) {
    return new Promise((resolve, reject) => {
        const { mime, outExt, lossless, isRawFormat } = getMimeAndExt(file);

        // RAW camera formats — browser cannot decode
        if (isRawFormat) {
            reject(new Error(
                `RAW format (.${fileExt(file).toUpperCase()}) cannot be processed in the browser. ` +
                `Export as JPEG from your camera app first.`
            ));
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read file'));

        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error(`Could not decode image — format may not be supported by this browser`));

            img.onload = () => {
                // Compute output dimensions, respecting optional max-width cap
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                if (maxW > 0 && w > maxW) {
                    h = Math.round(h * (maxW / w));
                    w = maxW;
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                // Lossless formats always get quality=1 (the browser ignores it anyway)
                const q = lossless ? 1 : quality;

                setProgress(idx, 60);
                canvas.toBlob(blob => {
                    if (!blob) { reject(new Error('Compression failed — toBlob returned null')); return; }
                    const baseName = file.name.replace(/\.[^.]+$/, '');
                    resolve({ blob, name: baseName + outExt });
                }, mime, q);
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
}

// ─── VIDEO COMPRESSION ────────────────────────────────────────────────────────
// Pipeline: ObjectURL → <video> → canvas.captureStream() → MediaRecorder → WebM
// Works with: mp4, mov, avi, 3gp, mkv, mpeg, ts, wmv, etc.
// Output is always .webm (the only format MediaRecorder can encode in browsers).

function compressVideo(file, quality, idx) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.src = url;

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Video format (.${fileExt(file).toUpperCase()}) could not be decoded by this browser`));
        };

        video.onloadedmetadata = () => {
            const origW = video.videoWidth || 1280;
            const origH = video.videoHeight || 720;

            // Scale dimensions down proportional to quality (0.75 quality → 75% width/height)
            const w = Math.max(2, Math.round(origW * Math.sqrt(quality))); // sqrt keeps visual quality higher
            const h = Math.max(2, Math.round(origH * Math.sqrt(quality)));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            // Prefer VP9 (better quality/size), fall back to VP8, then bare webm
            const mimeType = (() => {
                for (const t of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
                    if (MediaRecorder.isTypeSupported(t)) return t;
                }
                return null;
            })();

            if (!mimeType) {
                URL.revokeObjectURL(url);
                reject(new Error('MediaRecorder is not supported in this browser'));
                return;
            }

            // Bitrate scales with quality: 4 Mbps at 100% → 0.4 Mbps at 10%
            const bitrate = Math.round(4_000_000 * quality);
            const rec = new MediaRecorder(canvas.captureStream(24), {
                mimeType,
                videoBitsPerSecond: bitrate,
            });
            const chunks = [];

            rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
            rec.onstop = () => {
                URL.revokeObjectURL(url);
                const blob = new Blob(chunks, { type: 'video/webm' });
                const baseName = file.name.replace(/\.[^.]+$/, '');
                // Keep original extension to signal original format; suffix _compressed so user can keep both
                resolve({ blob, name: baseName + '_compressed.webm' });
            };

            rec.start(100); // emit data every 100ms

            video.play().catch(err => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not play video: ' + err.message));
            });

            // Draw each frame to canvas while recording
            let rafId;
            function drawFrame() {
                if (video.paused || video.ended) return;
                ctx.drawImage(video, 0, 0, w, h);
                if (video.duration > 0) {
                    const pct = 10 + Math.round((video.currentTime / video.duration) * 85);
                    setProgress(idx, Math.min(pct, 95));
                }
                rafId = requestAnimationFrame(drawFrame);
            }

            video.onplay = () => drawFrame();
            video.onended = () => { cancelAnimationFrame(rafId); rec.stop(); };
        };
    });
}
