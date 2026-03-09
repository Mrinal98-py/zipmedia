#!/usr/bin/env python3
"""Compress phone media while preserving format and quality.

Usage examples:
  python tools/compress_media.py --input ./media --output ./media_compressed --recursive
  python tools/compress_media.py --input ./media --output ./out --mode lossy --quality high --recursive
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    from PIL import Image, ImageOps
except Exception:
    print("Missing dependency: Pillow. Install with: pip install pillow", file=sys.stderr)
    raise

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIF_ENABLED = True
except Exception:
    HEIF_ENABLED = False


IMAGE_EXTS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".heif",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
}
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".3gp", ".3gpp", ".3g2", ".avi", ".mkv", ".webm"}
AUDIO_EXTS = {".m4a", ".aac", ".mp3", ".wav", ".flac", ".caf", ".amr", ".aiff"}


@dataclass(frozen=True)
class QualityProfile:
    image_jpeg_quality: int
    image_webp_quality: int
    png_quant_colors: int
    video_crf: int
    video_preset: str


QUALITY_PROFILES = {
    "max": QualityProfile(
        image_jpeg_quality=92,
        image_webp_quality=92,
        png_quant_colors=256,
        video_crf=19,
        video_preset="slow",
    ),
    "high": QualityProfile(
        image_jpeg_quality=88,
        image_webp_quality=88,
        png_quant_colors=224,
        video_crf=21,
        video_preset="slow",
    ),
    "balanced": QualityProfile(
        image_jpeg_quality=82,
        image_webp_quality=82,
        png_quant_colors=192,
        video_crf=24,
        video_preset="medium",
    ),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compress phone media with format preservation")
    parser.add_argument("--input", required=True, type=Path, help="Input file or folder")
    parser.add_argument("--output", required=True, type=Path, help="Output folder")
    parser.add_argument(
        "--mode",
        choices=["lossless", "lossy"],
        default="lossless",
        help="Compression mode (default: lossless)",
    )
    parser.add_argument(
        "--quality",
        choices=sorted(QUALITY_PROFILES.keys()),
        default="high",
        help="Quality profile for lossy mode (default: high)",
    )
    parser.add_argument("--recursive", action="store_true", help="Scan folders recursively")
    parser.add_argument("--drop-audio", action="store_true", help="Drop audio stream from video output")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite output files if they exist")
    parser.add_argument("--dry-run", action="store_true", help="Show actions without writing files")
    return parser.parse_args()


def iter_input_files(src: Path, recursive: bool) -> Iterable[Path]:
    if src.is_file():
        yield src
        return
    pattern = "**/*" if recursive else "*"
    for p in src.glob(pattern):
        if p.is_file():
            yield p


def ensure_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def output_path_for(src_root: Path, src_file: Path, out_root: Path) -> Path:
    if src_root.is_file():
        return out_root / src_file.name
    rel = src_file.relative_to(src_root)
    return out_root / rel


def compress_image(src: Path, dst: Path, profile: QualityProfile, mode: str, dry_run: bool) -> None:
    ext = src.suffix.lower()
    if dry_run:
        print(f"[dry-run] image: {src} -> {dst}")
        return

    dst.parent.mkdir(parents=True, exist_ok=True)

    if ext == ".gif":
        # Preserve animation and quality; many GIF re-encodes are lossy or break frames.
        shutil.copy2(src, dst)
        return

    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)

        if ext in {".jpg", ".jpeg"}:
            rgb = im.convert("RGB")
            if mode == "lossless":
                rgb.save(
                    dst,
                    format="JPEG",
                    quality="keep",
                    subsampling="keep",
                    optimize=True,
                    progressive=True,
                )
            else:
                rgb.save(
                    dst,
                    format="JPEG",
                    quality=profile.image_jpeg_quality,
                    optimize=True,
                    progressive=True,
                    subsampling="4:2:0",
                )
            return

        if ext == ".webp":
            if mode == "lossless":
                webp_img = im.convert("RGBA") if im.mode not in {"RGB", "RGBA"} else im
                webp_img.save(dst, format="WEBP", lossless=True, quality=100, method=6)
            else:
                rgb = im.convert("RGB") if im.mode in {"P", "L", "LA", "RGBA"} else im
                rgb.save(
                    dst,
                    format="WEBP",
                    quality=profile.image_webp_quality,
                    method=6,
                )
            return

        if ext == ".png":
            if mode == "lossless":
                png_img = im.convert("RGBA") if im.mode not in {"RGB", "RGBA", "P"} else im
                png_img.save(dst, format="PNG", optimize=True, compress_level=9)
            else:
                if im.mode not in {"RGB", "RGBA", "P"}:
                    im = im.convert("RGBA")
                method = Image.Quantize.FASTOCTREE if im.mode == "RGBA" else Image.Quantize.MEDIANCUT
                quantized = im.quantize(colors=profile.png_quant_colors, method=method)
                quantized.save(dst, format="PNG", optimize=True)
            return

        if ext in {".heic", ".heif"}:
            if not HEIF_ENABLED:
                shutil.copy2(src, dst)
                return
            if mode == "lossless":
                im.save(dst, format="HEIF", quality=100)
            else:
                im.save(dst, format="HEIF", quality=profile.image_jpeg_quality)
            return

        if ext in {".bmp", ".tif", ".tiff"}:
            if mode == "lossless":
                im.save(dst)
            else:
                out = im.convert("RGB") if im.mode not in {"RGB", "RGBA"} else im
                out.save(dst, optimize=True)
            return

        shutil.copy2(src, dst)


def compress_video(src: Path, dst: Path, profile: QualityProfile, mode: str, keep_audio: bool, dry_run: bool) -> None:
    if dry_run:
        print(f"[dry-run] video: {src} -> {dst}")
        return

    dst.parent.mkdir(parents=True, exist_ok=True)

    ext = src.suffix.lower()
    cmd = ["ffmpeg", "-y", "-i", str(src)]

    if mode == "lossless":
        cmd.extend(["-map", "0", "-map_metadata", "-1", "-c", "copy"])
        if ext in {".mp4", ".mov", ".m4v"}:
            cmd.extend(["-movflags", "+faststart"])
        if not keep_audio:
            cmd.append("-an")
        cmd.append(str(dst))
    else:
        if ext in {".mp4", ".mov", ".m4v", ".mkv", ".3gp", ".3gpp", ".3g2"}:
            cmd.extend(["-c:v", "libx264", "-preset", profile.video_preset, "-crf", str(profile.video_crf)])
            if ext in {".mp4", ".mov", ".m4v"}:
                cmd.extend(["-movflags", "+faststart"])
        elif ext == ".webm":
            cmd.extend(["-c:v", "libvpx-vp9", "-crf", str(max(24, profile.video_crf + 8)), "-b:v", "0", "-deadline", "good"])
        elif ext == ".avi":
            cmd.extend(["-c:v", "mpeg4", "-q:v", str(max(2, min(6, profile.video_crf // 5)))])
        else:
            cmd.extend(["-c:v", "libx264", "-preset", profile.video_preset, "-crf", str(profile.video_crf)])

        if keep_audio:
            if ext == ".webm":
                cmd.extend(["-c:a", "libopus", "-b:a", "96k"])
            elif ext == ".avi":
                cmd.extend(["-c:a", "libmp3lame", "-b:a", "128k"])
            else:
                cmd.extend(["-c:a", "aac", "-b:a", "128k"])
        else:
            cmd.append("-an")

        cmd.append(str(dst))

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {src.name}: {result.stderr.strip()}")


def compress_audio(src: Path, dst: Path, mode: str, dry_run: bool) -> None:
    if dry_run:
        print(f"[dry-run] audio: {src} -> {dst}")
        return

    dst.parent.mkdir(parents=True, exist_ok=True)

    if mode == "lossless":
        cmd = ["ffmpeg", "-y", "-i", str(src), "-map", "0", "-map_metadata", "-1", "-c", "copy", str(dst)]
    else:
        ext = src.suffix.lower()
        cmd = ["ffmpeg", "-y", "-i", str(src)]
        if ext in {".m4a", ".aac"}:
            cmd.extend(["-c:a", "aac", "-b:a", "128k"])
        elif ext == ".mp3":
            cmd.extend(["-c:a", "libmp3lame", "-b:a", "160k"])
        elif ext in {".wav", ".aiff", ".caf"}:
            cmd.extend(["-c:a", "pcm_s16le"])
        else:
            cmd.extend(["-c:a", "copy"])
        cmd.append(str(dst))

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {src.name}: {result.stderr.strip()}")


def human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024 or unit == "TB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{num_bytes} B"


def main() -> int:
    args = parse_args()

    src = args.input.resolve()
    out = args.output.resolve()

    if not src.exists():
        print(f"Input path does not exist: {src}", file=sys.stderr)
        return 2

    profile = QUALITY_PROFILES[args.quality]
    ffmpeg_ok = ensure_ffmpeg()

    files = list(iter_input_files(src, args.recursive))
    if not files:
        print("No files found.")
        return 0

    processed = 0
    skipped = 0
    errors = 0
    before_total = 0
    after_total = 0

    if not HEIF_ENABLED:
        print("[note] HEIC/HEIF plugin not found; these files will be copied as-is.")

    for f in files:
        ext = f.suffix.lower()
        dst = output_path_for(src, f, out)

        if dst.exists() and not args.overwrite:
            skipped += 1
            print(f"[skip] exists: {dst}")
            continue

        try:
            if ext in IMAGE_EXTS:
                before_total += f.stat().st_size
                compress_image(f, dst, profile, args.mode, args.dry_run)
                if not args.dry_run and dst.exists():
                    after_total += dst.stat().st_size
                processed += 1
                print(f"[ok] image {f.name}")
            elif ext in VIDEO_EXTS:
                if not ffmpeg_ok:
                    skipped += 1
                    print(f"[skip] ffmpeg not found, cannot compress video: {f.name}")
                    continue
                before_total += f.stat().st_size
                compress_video(f, dst, profile, args.mode, not args.drop_audio, args.dry_run)
                if not args.dry_run and dst.exists():
                    after_total += dst.stat().st_size
                processed += 1
                print(f"[ok] video {f.name}")
            elif ext in AUDIO_EXTS:
                if not ffmpeg_ok:
                    skipped += 1
                    print(f"[skip] ffmpeg not found, cannot compress audio: {f.name}")
                    continue
                before_total += f.stat().st_size
                compress_audio(f, dst, args.mode, args.dry_run)
                if not args.dry_run and dst.exists():
                    after_total += dst.stat().st_size
                processed += 1
                print(f"[ok] audio {f.name}")
            else:
                before_total += f.stat().st_size
                if args.dry_run:
                    print(f"[dry-run] copy unsupported: {f} -> {dst}")
                else:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(f, dst)
                    after_total += dst.stat().st_size
                processed += 1
                print(f"[ok] copied {f.name}")
        except Exception as exc:
            errors += 1
            print(f"[error] {f.name}: {exc}", file=sys.stderr)

    print("\nSummary")
    print(f"Processed: {processed}")
    print(f"Skipped:   {skipped}")
    print(f"Errors:    {errors}")

    if not args.dry_run and before_total > 0 and after_total > 0:
        saved = max(0, before_total - after_total)
        ratio = (saved / before_total) * 100
        print(f"Input size:  {human_size(before_total)}")
        print(f"Output size: {human_size(after_total)}")
        print(f"Saved:       {human_size(saved)} ({ratio:.1f}%)")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
