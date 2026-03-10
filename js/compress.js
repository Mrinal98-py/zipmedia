function isHeicFile(file) {
    const e = file.name.split('.').pop().toLowerCase();
    return e === 'heic' || e === 'heif';
}

async function getBrowserReadableImage(file) {
    if (!isHeicFile(file)) return file;
    if (typeof heic2any !== 'function') {
        throw new Error('HEIC converter failed to load. Refresh the page and try again.');
    }

    const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!(blob instanceof Blob)) {
        throw new Error('HEIC conversion failed.');
    }
    return blob;
}

function getMimeAndExt(file) {
    const e = file.name.split('.').pop().toLowerCase();

    if (e === 'png') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'webp') return { mime: 'image/webp', outExt: '.webp', lossless: false };
    if (e === 'gif') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'heic' || e === 'heif') {
        return { mime: 'image/jpeg', outExt: '.jpg', lossless: false, browserLimitedFormat: true };
    }

    return { mime: 'image/jpeg', outExt: '.jpg', lossless: false };
}

function compressImage(file, quality, maxW, idx) {
    return new Promise((resolve, reject) => {
        const { mime, outExt, lossless, browserLimitedFormat } = getMimeAndExt(file);
        getBrowserReadableImage(file).then(sourceBlob => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Could not read file'));

            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error(
                    browserLimitedFormat
                        ? 'HEIC conversion succeeded, but the browser still could not decode the result.'
                        : 'Could not decode image'
                ));

                img.onload = () => {
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

                    const q = lossless ? 1 : quality;

                    setProgress(idx, 60);
                    canvas.toBlob(blob => {
                        if (!blob) { reject(new Error('toBlob returned null')); return; }
                        const baseName = file.name.replace(/\.[^.]+$/, '');
                        resolve({ blob, name: baseName + outExt });
                    }, mime, q);
                };

                img.src = e.target.result;
            };

            reader.readAsDataURL(sourceBlob);
        }).catch(err => {
            reject(new Error(err.message || 'HEIC conversion failed.'));
        });
    });
}

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

            rec.start(100);
            video.play().catch(err => { URL.revokeObjectURL(url); reject(err); });

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
