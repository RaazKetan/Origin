import numpy as np
from typing import List, Dict

def cosine_similarity(a: List[float], b: List[float]) -> float:
    a_np = np.array(a, dtype=float)
    b_np = np.array(b, dtype=float)
    if a_np.size == 0 or b_np.size == 0:
        return 0.0
    denom = (np.linalg.norm(a_np) * np.linalg.norm(b_np))
    if denom == 0:
        return 0.0
    return float(np.dot(a_np, b_np) / denom)
