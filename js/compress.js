// ─── FORMAT DETECTION ─────────────────────────────────────────────────────────
// Maps each image file extension to the correct canvas output mime type.
// Format is always preserved — input JPG → output JPG, PNG → PNG, etc.

function getMimeAndExt(file) {
    const e = file.name.split('.').pop().toLowerCase();

    if (e === 'png') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'webp') return { mime: 'image/webp', outExt: '.webp', lossless: false };
    if (e === 'gif') return { mime: 'image/png', outExt: '.png', lossless: true }; // canvas can't encode GIF
    if (e === 'heic' || e === 'heif') return { mime: 'image/jpeg', outExt: '.' + e, lossless: false }; // keep original ext; iOS reads by content

    // jpg / jpeg / anything else → JPEG
    return { mime: 'image/jpeg', outExt: '.jpg', lossless: false };
}

// ─── IMAGE COMPRESSION ────────────────────────────────────────────────────────
// Pipeline: FileReader → <img> → <canvas> → toBlob()
// The output format is detected from the original file extension.

function compressImage(file, quality, maxW, idx) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read file'));

        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Could not decode image'));

            img.onload = () => {
                // Compute output dimensions
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                if (maxW > 0 && w > maxW) {
                    h = Math.round(h * (maxW / w));
                    w = maxW;
                }

                // Draw to canvas
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);

                // Pick output mime/extension from original extension
                const { mime, outExt, lossless } = getMimeAndExt(file);
                const q = lossless ? 1 : quality; // PNG is lossless; quality arg has no effect

                setProgress(idx, 60);
                canvas.toBlob(blob => {
                    if (!blob) { reject(new Error('toBlob returned null')); return; }
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
// Pipeline: ObjectURL → <video> → <canvas>.captureStream() → MediaRecorder → WebM blob

function compressVideo(file, quality, idx) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.src = url;

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Video decode failed'));
        };

        video.onloadedmetadata = () => {
            const origW = video.videoWidth || 640;
            const origH = video.videoHeight || 480;
            const w = Math.max(1, Math.round(origW * quality));
            const h = Math.max(1, Math.round(origH * quality));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            // Pick best supported mime type
            let mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    URL.revokeObjectURL(url);
                    reject(new Error('MediaRecorder is not supported in this browser'));
                    return;
                }
            }

            const bitrate = Math.round(1_000_000 * quality);
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
                resolve({ blob, name: baseName + '_compressed.webm' });
            };

            rec.start(100); // collect chunks every 100 ms
            video.play().catch(err => { URL.revokeObjectURL(url); reject(err); });

            // Draw each video frame to the canvas while recording
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
