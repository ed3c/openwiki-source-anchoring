# Evaluation Result Contract

Every model-backed or human-backed run should preserve raw items before computing totals.

Minimum per-item record:

```json
{
  "schema_version": "openwiki-evaluation-result/v1",
  "study_id": "study-id",
  "repository_id": "target-001",
  "source_commit": "0000000000000000000000000000000000000000",
  "output_id": "target-001-baseline-run-01",
  "generation_run_id": "run-01",
  "task_id": "gates-001",
  "task_category": "repository_qa",
  "answer_sample_id": "answer-01",
  "answerer": {
    "provider": "provider",
    "model_id": "immutable-model-id",
    "config_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "anonymous_answer_id": "X",
  "raw_answer_path": "results/raw/answer.json",
  "judge": {
    "provider": "provider",
    "model_id": "immutable-judge-id",
    "config_sha256": "0000000000000000000000000000000000000000000000000000000000000000"
  },
  "criterion_results": [
    {
      "criterion_id": "c1",
      "result": "met",
      "reason": "brief evidence-bound reason"
    }
  ],
  "verdict": "PASS",
  "documentation_answerability": "answered",
  "unsupported_assertions": [],
  "test_receipt_path": null,
  "elapsed_seconds": 0,
  "tokens": null,
  "cost": null,
  "label_mapping_path": "results/mappings/batch-01.json"
}
```

Derived totals must be reproducible from these item records. Keep aggregate summaries out of judge inputs. Mark spent splits and preserve the exact mapping from anonymous IDs to outputs after grading is complete.
