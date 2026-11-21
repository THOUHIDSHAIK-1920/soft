"""
Self-Healing Locator Engine using TF-IDF + Cosine Similarity + DOM Tree Path Similarity
+ Agglomerative / KMeans Clustering (scikit-learn).
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _tokenize_identifier(val: str) -> str:
    """Split kebab-case, snake_case, and camelCase identifiers into searchable tokens."""
    if not val:
        return ""
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", str(val))
    tokens = re.split(r"[^a-zA-Z0-9]+", spaced.lower())
    return " ".join(t for t in tokens if t and t != "v2")


def _build_element_document(el: Dict[str, Any]) -> str:
    """Construct rich text document from DOM element tag, text, attributes, classes, and siblings."""
    parts: List[str] = []
    tag = str(el.get("tag", "")).lower()
    if tag:
        parts.extend([tag, tag])  # Slightly weight tag name

    text = str(el.get("text", "")).strip()
    if text:
        parts.extend([text.lower(), text.lower()])

    attrs: Dict[str, Any] = el.get("attributes") or {}
    high_signal_keys = [
        "aria-label",
        "placeholder",
        "name",
        "type",
        "role",
        "data-seat",
        "data-movie-id",
        "data-showtime-id",
        "data-action",
        "data-page",
    ]
    for k in high_signal_keys:
        if k in attrs and attrs[k]:
            val = str(attrs[k]).lower()
            parts.extend([f"{k}_{val}", _tokenize_identifier(val)])

    # Include tokenized id and classes (lower weight since they mutate in locator-change mode)
    if el.get("id"):
        parts.append(_tokenize_identifier(str(el["id"])))
    for cls in el.get("classes") or []:
        parts.append(_tokenize_identifier(str(cls)))

    # Include sibling context
    for sib in (el.get("siblings") or [])[:4]:
        parts.append(_tokenize_identifier(str(sib)))

    return " ".join(p for p in parts if p).strip() or tag or "element"


def _tree_path_similarity(path_a: str, path_b: str) -> float:
    """Compute structural DOM tree path similarity combining normalized LCS and suffix overlap."""
    if not path_a or not path_b:
        return 0.0
    segs_a = [s.strip().lower() for s in path_a.split(">") if s.strip()]
    segs_b = [s.strip().lower() for s in path_b.split(">") if s.strip()]
    if not segs_a or not segs_b:
        return 0.0

    # Strip dynamic id/class suffixes from path segments, keep structural tags
    clean_a = [re.split(r"[#.\[]", s)[0] for s in segs_a]
    clean_b = [re.split(r"[#.\[]", s)[0] for s in segs_b]

    # Longest Common Subsequence (DP)
    m, n = len(clean_a), len(clean_b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if clean_a[i - 1] == clean_b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    lcs_ratio = (2.0 * dp[m][n]) / (m + n)

    # Suffix similarity (parent chain closest to element matters most)
    suffix_matches = 0
    for a, b in zip(reversed(clean_a), reversed(clean_b)):
        if a == b:
            suffix_matches += 1
        else:
            break
    suffix_ratio = suffix_matches / max(m, n)

    return 0.65 * lcs_ratio + 0.35 * suffix_ratio


def _semantic_attribute_score(snap: Dict[str, Any], cand: Dict[str, Any]) -> float:
    """Direct exact-match score on stable semantic attributes (aria-label, name, placeholder, data-*, text)."""
    snap_attrs = snap.get("attributes") or {}
    cand_attrs = cand.get("attributes") or {}

    checks = [
        ("aria-label", 0.35),
        ("data-seat", 0.45),
        ("data-showtime-id", 0.40),
        ("data-movie-id", 0.35),
        ("placeholder", 0.30),
        ("name", 0.25),
        ("type", 0.15),
        ("role", 0.15),
    ]

    matched_weight = 0.0
    total_possible = 0.0

    for key, weight in checks:
        s_val = str(snap_attrs.get(key, "")).strip().lower()
        c_val = str(cand_attrs.get(key, "")).strip().lower()
        if s_val:
            total_possible += weight
            if s_val == c_val:
                matched_weight += weight
            elif key == "aria-label" and s_val and c_val and (s_val in c_val or c_val in s_val):
                matched_weight += weight * 0.7

    # Exact visible text match
    s_text = str(snap.get("text", "")).strip().lower()
    c_text = str(cand.get("text", "")).strip().lower()
    if s_text and len(s_text) <= 80:
        total_possible += 0.30
        if s_text == c_text:
            matched_weight += 0.30
        elif s_text in c_text or c_text in s_text:
            matched_weight += 0.18

    if total_possible == 0.0:
        return 0.0
    return min(1.0, matched_weight / total_possible)


def _sibling_similarity(snap_sibs: List[str], cand_sibs: List[str]) -> float:
    set_a = set(s.lower().strip() for s in (snap_sibs or []) if s)
    set_b = set(s.lower().strip() for s in (cand_sibs or []) if s)
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)


def heal_locator(
    snapshot: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    threshold: float = 0.42,
    clustering_algo: str = "agglomerative",
) -> Dict[str, Any]:
    """
    Match a broken locator's stored DOM snapshot against live DOM candidate elements.
    Combines:
      1. TF-IDF cosine similarity on attributes, text, tag, classes, and siblings
      2. DOM tree path structural similarity
      3. Semantic attribute stability score
      4. Clustering (AgglomerativeClustering or KMeans) to group semantically cohesive candidates
    """
    if not candidates:
        return {
            "healed": False,
            "bestSelector": None,
            "score": 0.0,
            "clusterId": -1,
            "method": "none",
            "topCandidates": [],
        }

    snap_doc = _build_element_document(snapshot)
    cand_docs = [_build_element_document(c) for c in candidates]
    corpus = [snap_doc] + cand_docs

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
    tfidf_matrix = vectorizer.fit_transform(corpus)
    dense_vectors = tfidf_matrix.toarray()

    # Cosine similarity between snapshot (index 0) and each candidate (indices 1..N)
    cos_sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()

    # Clustering on combined TF-IDF vectors (snapshot + candidates)
    n_items = len(corpus)
    cluster_labels = np.zeros(n_items, dtype=int)
    method_used = "tfidf-cosine"

    if n_items >= 3:
        n_clusters = max(2, min(6, int(np.sqrt(n_items))))
        try:
            if clustering_algo == "kmeans":
                model = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
                cluster_labels = model.fit_predict(dense_vectors)
                method_used = "tfidf-cosine+kmeans"
            else:
                model = AgglomerativeClustering(n_clusters=n_clusters, metric="euclidean", linkage="ward")
                cluster_labels = model.fit_predict(dense_vectors)
                method_used = "tfidf-cosine+agglomerative"
        except Exception:
            cluster_labels = np.zeros(n_items, dtype=int)

    snap_cluster = int(cluster_labels[0])
    snap_tag = str(snapshot.get("tag", "")).lower()
    snap_path = str(snapshot.get("parentPath", ""))
    snap_sibs = snapshot.get("siblings") or []

    scored: List[Dict[str, Any]] = []
    for idx, cand in enumerate(candidates):
        tfidf_score = float(cos_sims[idx])
        path_score = _tree_path_similarity(snap_path, str(cand.get("parentPath", "")))
        sem_score = _semantic_attribute_score(snapshot, cand)
        sib_score = _sibling_similarity(snap_sibs, cand.get("siblings") or [])
        cand_tag = str(cand.get("tag", "")).lower()
        tag_match = 1.0 if (snap_tag and cand_tag == snap_tag) else 0.0
        cand_cluster = int(cluster_labels[idx + 1])
        same_cluster = 1.0 if cand_cluster == snap_cluster else 0.0

        # Penalize tag mismatch strongly (e.g., input shouldn't match div)
        if snap_tag and cand_tag and snap_tag != cand_tag:
            final_score = (0.35 * tfidf_score + 0.20 * path_score + 0.25 * sem_score) * 0.45
        else:
            final_score = (
                0.34 * tfidf_score
                + 0.30 * sem_score
                + 0.16 * path_score
                + 0.08 * tag_match
                + 0.06 * sib_score
                + 0.06 * same_cluster
            )

        final_score = round(float(min(1.0, max(0.0, final_score))), 4)
        scored.append(
            {
                "selector": cand.get("selector"),
                "score": final_score,
                "tfidfScore": round(tfidf_score, 4),
                "semanticScore": round(sem_score, 4),
                "pathScore": round(path_score, 4),
                "clusterId": cand_cluster,
                "sameCluster": bool(same_cluster),
                "tag": cand_tag,
                "text": str(cand.get("text", ""))[:60],
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)
    best = scored[0]
    healed = bool(best["selector"] and best["score"] >= threshold)

    return {
        "healed": healed,
        "bestSelector": best["selector"] if healed else None,
        "score": best["score"],
        "clusterId": best["clusterId"],
        "method": method_used,
        "topCandidates": scored[:5],
    }
