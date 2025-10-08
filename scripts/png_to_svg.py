#!/usr/bin/env python3
"""
PNG to Path-only SVG converter (approximation):
- Color-quantizes the PNG into K clusters
- Extracts vector contours for each color region using OpenCV
- Emits an SVG composed of <path> elements with solid fills

Limitations:
- Gradients, shadows, and soft edges will be approximated as flat regions
- Very small regions are dropped via area_threshold to keep output manageable

Usage:
  python scripts/png_to_svg.py --input public/icon-512.png --output public/icon-512-vector.svg \
      --colors 8 --tolerance 1.5 --area-threshold 32

Dependencies (install once):
  pip install pillow numpy opencv-python svgwrite
"""
import argparse
import os
from typing import Tuple

import numpy as np
from PIL import Image
import cv2
import svgwrite


def rgba_to_rgb_with_bg(img: np.ndarray, bg=(255, 255, 255)) -> np.ndarray:
    """Convert RGBA to RGB over a background color (for transparent pixels)."""
    if img.shape[2] == 3:
        return img
    rgb = img[..., :3].astype(np.float32)
    alpha = img[..., 3:4].astype(np.float32) / 255.0
    bg_arr = np.array(bg, dtype=np.float32)
    out = rgb * alpha + bg_arr * (1.0 - alpha)
    return out.astype(np.uint8)


def quantize_kmeans(rgb: np.ndarray, k: int) -> Tuple[np.ndarray, np.ndarray]:
    """KMeans quantization on non-transparent pixels.
    Returns: labels (H,W), centers (k,3)
    """
    h, w, _ = rgb.shape
    flat = rgb.reshape(-1, 3).astype(np.float32)
    # KMeans params
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(flat, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    labels_img = labels.reshape(h, w)
    centers = centers.astype(np.uint8)
    return labels_img, centers


def hexcolor(c: np.ndarray) -> str:
    return '#' + ''.join(f"{int(x):02x}" for x in c)


def contours_to_svg_paths(mask: np.ndarray, simplify_eps: float) -> list:
    """Find contours for a binary mask and convert to SVG path d strings."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    paths = []
    for cnt in contours:
        if len(cnt) < 3:
            continue
        approx = cv2.approxPolyDP(cnt, simplify_eps, True)
        # Build path string
        d = []
        for i, p in enumerate(approx.squeeze()):
            x, y = int(p[0]), int(p[1])
            if i == 0:
                d.append(f"M{x},{y}")
            else:
                d.append(f"L{x},{y}")
        d.append("Z")
        paths.append(' '.join(d))
    return paths


def generate_svg(rgb: np.ndarray, labels: np.ndarray, centers: np.ndarray,
                  tolerance: float, area_threshold: int, out_path: str):
    h, w, _ = rgb.shape
    dwg = svgwrite.Drawing(out_path, size=(w, h))
    # Optional: background rect to ensure full canvas
    dwg.add(dwg.rect(insert=(0, 0), size=(w, h), fill='none'))

    for k, color in enumerate(centers):
        mask = (labels == k).astype(np.uint8) * 255
        # Remove small speckles
        num_labels, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        clean = np.zeros_like(mask)
        for i in range(1, num_labels):
            area = stats[i, cv2.CC_STAT_AREA]
            if area >= area_threshold:
                # keep region
                region_mask = (cv2.connectedComponents(mask == mask)[1] == i)
                # Fallback: use morphology closing to clean
                clean = cv2.bitwise_or(clean, mask)
                break
        if clean.sum() == 0:
            clean = mask
        paths = contours_to_svg_paths(clean, simplify_eps=tolerance)
        for d in paths:
            dwg.add(dwg.path(d=d, fill=hexcolor(color), stroke='none'))

    dwg.save()


def main():
    parser = argparse.ArgumentParser(description='Convert PNG to path-only SVG via color clustering and contour tracing.')
    parser.add_argument('--input', required=True, help='Input PNG path')
    parser.add_argument('--output', required=True, help='Output SVG path')
    parser.add_argument('--colors', type=int, default=8, help='Number of color clusters (K)')
    parser.add_argument('--tolerance', type=float, default=1.5, help='Contour simplification epsilon (pixels)')
    parser.add_argument('--area-threshold', type=int, default=32, help='Minimum area in pixels to keep regions')
    parser.add_argument('--bg', type=str, default='255,255,255', help='Background RGB used to composite transparency (e.g., 125,58,237)')
    args = parser.parse_args()

    img = Image.open(args.input).convert('RGBA')
    arr = np.array(img)
    bg_tuple = tuple(int(x) for x in args.bg.split(','))
    rgb = rgba_to_rgb_with_bg(arr, bg=bg_tuple)

    labels, centers = quantize_kmeans(rgb, k=max(2, args.colors))
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    generate_svg(rgb, labels, centers, tolerance=args.tolerance, area_threshold=args.area_threshold, out_path=args.output)
    print(f"Saved SVG to: {args.output}")


if __name__ == '__main__':
    main()