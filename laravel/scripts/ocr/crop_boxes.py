#!/usr/bin/env python3
"""
Crop Boxes: Corner Marker Detection & Perspective Transform for Stock Opname Forms.

Detects the 4 black square registration markers in the corners of the printed form,
computes perspective transform, warps the image to standard A4 ratio (2000x2800 px),
and isolates table row cells for OCR processing.
"""

import sys
import os
import argparse
import json
import shutil

try:
    import cv2
    import numpy as np
    HAVE_CV2 = True
except ImportError:
    HAVE_CV2 = False


def order_points(pts):
    """
    Orders 4 points in clockwise order:
    [top-left, top-right, bottom-right, bottom-left]
    """
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def detect_corner_markers(image_path, target_width=2000, target_height=2800):
    """
    Detects 4 corner markers and warps perspective to standard A4 dimensions.
    Gracefully handles missing cv2 or unreadable image.
    """
    if not HAVE_CV2 or not os.path.exists(image_path):
        return None

    try:
        image = cv2.imread(image_path)
        if image is None:
            return None

        orig_h, orig_w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )

        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        candidates = []

        for c in contours:
            area = cv2.contourArea(c)
            if area < (orig_w * orig_h * 0.0001) or area > (orig_w * orig_h * 0.05):
                continue
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.04 * peri, True)
            if len(approx) == 4:
                x, y, w, h = cv2.boundingRect(approx)
                aspect_ratio = float(w) / h
                if 0.7 <= aspect_ratio <= 1.3:
                    M = cv2.moments(c)
                    if M["m00"] != 0:
                        cX = int(M["m10"] / M["m00"])
                        cY = int(M["m01"] / M["m00"])
                        candidates.append((cX, cY))

        # Need at least 4 markers
        if len(candidates) >= 4:
            corners = [(0, 0), (orig_w, 0), (orig_w, orig_h), (0, orig_h)]
            best_pts = []
            for cx, cy in corners:
                closest = min(candidates, key=lambda pt: (pt[0] - cx)**2 + (pt[1] - cy)**2)
                best_pts.append(closest)

            src_pts = order_points(np.array(best_pts, dtype="float32"))
            dst_pts = np.array([
                [0, 0],
                [target_width - 1, 0],
                [target_width - 1, target_height - 1],
                [0, target_height - 1]
            ], dtype="float32")

            M = cv2.getPerspectiveTransform(src_pts, dst_pts)
            warped = cv2.warpPerspective(image, M, (target_width, target_height))
            return warped

        return None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(description="Crop and warp stock opname form")
    parser.add_argument("--input", "--image", dest="image", required=True, help="Input image path")
    parser.add_argument("--output", required=False, help="Output warped image path")
    parser.add_argument("--output-dir", required=False, help="Output directory for cropped images")
    parser.add_argument("--opname-id", required=False, help="Opname ID for naming")
    args = parser.parse_args()

    input_path = os.path.abspath(args.image)
    output_path = None

    if args.output:
        output_path = os.path.abspath(args.output)
    elif args.output_dir:
        os.makedirs(args.output_dir, exist_ok=True)
        filename = f"{args.opname_id}.jpg" if args.opname_id else os.path.basename(input_path)
        output_path = os.path.abspath(os.path.join(args.output_dir, filename))

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

    warped = detect_corner_markers(input_path)
    if warped is not None and output_path and HAVE_CV2:
        cv2.imwrite(output_path, warped)
        print(json.dumps({"status": "success", "output": output_path, "straightened": True}))
    elif output_path and os.path.exists(input_path):
        # Fallback copy for environments without OpenCV or synthetic fixtures
        shutil.copy2(input_path, output_path)
        print(json.dumps({"status": "success", "output": output_path, "straightened": False}))
    else:
        print(json.dumps({"status": "skipped", "reason": "No output path or input missing"}))


if __name__ == "__main__":
    main()
