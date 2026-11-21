"""
FastAPI AI Microservice for Hybrid AI Playwright Testing Framework.
Exposes:
  - GET  /health   : service liveness & model status
  - POST /heal     : TF-IDF + tree similarity + clustering self-healing locator engine
  - POST /train    : retrain RandomForest bug prediction model on historical runs
  - POST /predict  : predict per-module bug risk probability
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from fastapi import FastAPI
from pydantic import BaseModel, Field
import uvicorn

from healing_engine import heal_locator
from bug_predictor import BugPredictor

app = FastAPI(
    title="CineBook AI Testing Microservice",
    version="1.0.0",
    description="Self-healing DOM locator matcher (TF-IDF + Cosine + Clustering) & RandomForest Bug Predictor",
)

predictor = BugPredictor()


class ElementSnapshot(BaseModel):
    tag: str = ""
    id: str = ""
    classes: List[str] = Field(default_factory=list)
    text: str = ""
    attributes: Dict[str, Any] = Field(default_factory=dict)
    parentPath: str = ""
    siblings: List[str] = Field(default_factory=list)
    selector: Optional[str] = None


class HealRequest(BaseModel):
    oldLocator: str
    snapshot: ElementSnapshot
    candidates: List[ElementSnapshot]
    threshold: float = 0.42
    clustering: str = "agglomerative"


class HistoryRecord(BaseModel):
    module: str
    failure_count: int = 0
    healing_count: int = 0
    flakiness: float = 0.0
    has_bug: Optional[int] = None


class TrainRequest(BaseModel):
    history: List[HistoryRecord]


class PredictRequest(BaseModel):
    records: List[HistoryRecord]
    history: Optional[List[HistoryRecord]] = None


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "CineBook AI Microservice",
        "modelAccuracy": predictor.model_accuracy,
        "trainingSamples": predictor.training_samples,
    }


@app.post("/heal")
def heal(req: HealRequest) -> Dict[str, Any]:
    result = heal_locator(
        snapshot=req.snapshot.model_dump(),
        candidates=[c.model_dump() for c in req.candidates],
        threshold=req.threshold,
        clustering_algo=req.clustering,
    )
    return {
        "oldLocator": req.oldLocator,
        **result,
    }


@app.post("/train")
def train(req: TrainRequest) -> Dict[str, Any]:
    return predictor.train([r.model_dump() for r in req.history])


@app.post("/predict")
def predict(req: PredictRequest) -> Dict[str, Any]:
    return predictor.predict(
        records=[r.model_dump() for r in req.records],
        history=[h.model_dump() for h in req.history] if req.history else None,
    )


if __name__ == "__main__":
    port = int(os.environ.get("AI_PORT", "8100"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
