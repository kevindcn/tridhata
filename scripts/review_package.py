import sys
import os
import subprocess

def create_review_package(base, head, out_path=None):
    if not out_path:
        base_short = subprocess.check_output(["git", "rev-parse", "--short", base], text=True).strip()
        head_short = subprocess.check_output(["git", "rev-parse", "--short", head], text=True).strip()
        out_path = os.path.join(".git", "sdd", f"review-{base_short}..{head_short}.diff")
        
    log_output = subprocess.check_output(["git", "log", "--oneline", f"{base}..{head}"], text=True)
    stat_output = subprocess.check_output(["git", "diff", "--stat", f"{base}..{head}"], text=True)
    diff_output = subprocess.check_output(["git", "diff", "-U10", f"{base}..{head}"], text=True)
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# Review package: {base}..{head}\n\n")
        f.write("## Commits\n")
        f.write(log_output + "\n")
        f.write("## Files changed\n")
        f.write(stat_output + "\n")
        f.write("## Diff\n")
        f.write(diff_output + "\n")
        
    print(f"wrote {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python review_package.py BASE HEAD [OUT_PATH]")
        sys.exit(1)
    create_review_package(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
