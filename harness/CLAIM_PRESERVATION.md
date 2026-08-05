# Claim Preservation

The word floor prevents obvious deletion-for-score, but equal or greater word count can still hide claim removal. The retry loop therefore supports explicit stable claim IDs.

Add an ID inside the Markdown block that contains the claim:

```html
The command in `tool.py` returns a receipt. <!-- claim-id: receipt-contract -->
```

Before the first mutation, `trigger.sh` writes a `claim-inventory@1.0.0` receipt. After every retry, `claim_guard.ts` classifies each baseline ID:

- `preserved` — the normalized block hash is unchanged;
- `corrected` — the ID remains and the block changed;
- `withdrawn` — the ID disappeared and the packet contains an explicit reason;
- `missing` — the ID disappeared without a disposition; the retry is restored and exits `2`.

Packet example:

```json
{
  "claim_dispositions": [
    {
      "claim_id": "receipt-contract",
      "disposition": "withdrawn",
      "reason": "the source no longer exposes this contract"
    }
  ]
}
```

IDs must be unique within a page. A correction keeps the same ID. A withdrawal reason is evidence for human review, not automatic proof that deletion was justified.

Pages without IDs continue to work. For those pages, the word floor remains a coarse compatibility fallback.
