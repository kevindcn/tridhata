import sys
import os
import re

def extract_task(plan_path, task_num, out_path=None):
    if not out_path:
        out_path = os.path.join(".git", "sdd", f"task-{task_num}-brief.md")
    
    with open(plan_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    task_lines = []
    in_target_task = False
    in_fence = False
    pattern_start = re.compile(rf"^###\s+Task\s+{task_num}:", re.IGNORECASE)
    pattern_next = re.compile(r"^###\s+Task\s+\d+:", re.IGNORECASE)

    for line in lines:
        if line.strip().startswith("```"):
            in_fence = not in_fence
        
        if not in_fence and pattern_start.match(line):
            in_target_task = True
            task_lines.append(line)
            continue
        
        if not in_fence and in_target_task and pattern_next.match(line):
            break
        
        if in_target_task:
            task_lines.append(line)
            
    if not task_lines:
        print(f"Error: Task {task_num} not found in {plan_path}", file=sys.stderr)
        sys.exit(1)
        
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.writelines(task_lines)
        
    print(f"wrote {out_path}: {len(task_lines)} lines")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python task_brief.py PLAN_FILE TASK_NUM [OUT_PATH]")
        sys.exit(1)
    extract_task(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
