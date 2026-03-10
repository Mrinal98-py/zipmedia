function isHeicFile(file) {
    const e = fileExt(file);
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
    const e = fileExt(file);

    if (RAW_EXT.has(e)) return { mime: null, outExt: '.' + e, lossless: false, isRawFormat: true };
    if (e === 'png') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'tiff' || e === 'tif') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'bmp') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'webp') return { mime: 'image/webp', outExt: '.webp', lossless: false };
    if (e === 'gif') return { mime: 'image/png', outExt: '.png', lossless: true };
    if (e === 'heic' || e === 'heif') {
        return { mime: 'image/jpeg', outExt: '.jpg', lossless: false, browserLimitedFormat: true };
    }

    return { mime: 'image/jpeg', outExt: '.jpg', lossless: false };
}

function compressImage(file, quality, maxW, idx) {
    return new Promise((resolve, reject) => {
        const { mime, outExt, lossless, isRawFormat, browserLimitedFormat } = getMimeAndExt(file);

        if (isRawFormat) {
            reject(new Error(
                `RAW format (.${fileExt(file).toUpperCase()}) cannot be processed in the browser. ` +
                `Export as JPEG from your camera app first.`
            ));
            return;
        }

        getBrowserReadableImage(file).then(sourceBlob => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Could not read file'));

            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error(
                    browserLimitedFormat
                        ? 'HEIC conversion succeeded, but the browser still could not decode the result.'
                        : 'Could not decode image in this browser.'
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
                        if (!blob) {
                            reject(new Error('Compression failed: toBlob returned null'));
                            return;
                        }
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
            reject(new Error(`Video format (.${fileExt(file).toUpperCase()}) could not be decoded by this browser`));
        };

        video.onloadedmetadata = () => {
            const origW = video.videoWidth || 1280;
            const origH = video.videoHeight || 720;
            const w = Math.max(2, Math.round(origW * Math.sqrt(quality)));
            const h = Math.max(2, Math.round(origH * Math.sqrt(quality)));

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

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
                resolve({ blob, name: baseName + '_compressed.webm' });
            };

            rec.start(100);

            video.play().catch(err => {
                URL.revokeObjectURL(url);
                reject(new Error('Could not play video: ' + err.message));
            });

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
