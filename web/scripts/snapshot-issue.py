"""Public reporting inputs for issue #1; no authentication or wallet access.

Retains only the fields used for reporting, with endpoint, receipt time and raw-response
SHA-256. Job creation timestamps are historical; live statuses are not.
Run from any directory: python3 web/scripts/snapshot-issue.py
"""
import datetime as dt
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
START = "2026-10-11T08:18:35Z"
END = "2026-10-12T08:18:35Z"
def timestamp(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
def in_window(value):
    return timestamp(START) < timestamp(value) <= timestamp(END)
def get(url):
    for attempt in range(4):
        try:
            requested = dt.datetime.now(dt.timezone.utc).isoformat()
            with urllib.request.urlopen(url, timeout=45) as response:
                raw = response.read()
                return json.loads(raw), {
                    "endpoint": url, "requestedAt": requested,
                    "receivedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "httpDate": response.headers.get("date"),
                    "bodySha256": hashlib.sha256(raw).hexdigest(),
                }
        except Exception:
            if attempt == 3:
                raise
            time.sleep(min(2 ** attempt, 16))

sources = []
jobs = []
# before is exclusive; include a job stamped exactly at the closing second.
before = "2026-10-12T08:18:35.001Z"
while True:
    data, source = get("https://api.imd.fun/jobs?" + urllib.parse.urlencode({"limit": 500, "before": before}))
    rows = data["jobs"]
    source["returned"] = len(rows)
    source["oldestCreatedAt"] = rows[-1]["createdAt"] if rows else None
    sources.append(source)
    jobs.extend({k: row[k] for k in ("id", "template", "createdAt")} for row in rows if in_window(row["createdAt"]))
    if not rows or timestamp(rows[-1]["createdAt"]) <= timestamp(START):
        break
    next_before = rows[-1]["createdAt"]
    if timestamp(next_before) >= timestamp(before):
        raise ValueError("Job cursor did not advance")
    before = next_before
assert len({row["id"] for row in jobs}) == len(jobs)
print(f"{len(jobs)} jobs created in the window", flush=True)

# Agent directories provide present-day totals, not a historical activity series.
# Retain the snapshot, but do not manufacture a daily active-agent count from it.
data, source = get("https://api.imd.fun/seats/records")
source["returned"] = len(data["seats"])
assert data["count"] == len(data["seats"])
sources.append(source)
agent_records = [{k: row[k] for k in ("tokenId", "agentId", "lastWorkedAt")} for row in data["seats"]]

# Token catalog: read all pages, retain token/contract identifiers instead of long objectives.
tokens = []
page = 1
while True:
    data, source = get(f"https://api.imd.fun/publications?type=tokens&pageSize=100&page={page}")
    source.update(returned=len(data["items"]), totalPages=data["totalPages"], count=data["count"])
    sources.append(source)
    for row in data["items"]:
        tokens.append({"id": row["id"], "contracts": [
            {key: value for key, value in contract.items() if key in ("id", "launchNumber", "chainId", "token", "artifacts", "createdAt")}
            for contract in row["contracts"]]})
    if page >= data["totalPages"]:
        break
    page += 1
assert len({row["id"] for row in tokens}) == len(tokens)

# Explorer corroboration is explicitly a later snapshot, not activity at the window's close.
explorer = []
for endpoint in ["https://explorer.imd.fun/api/search?q=SCOOP&part=published",
                 "https://explorer.imd.fun/api/activity",
                 "https://explorer.imd.fun/api/agents/912"]:
    data, source = get(endpoint)
    sources.append(source)
    explorer.append({"endpoint": endpoint, "data": data})

report = {
    "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    "window": {"after": START, "through": END},
    "method": "Jobs: createdAt in (after, through], all templates including oracle panels. Tokens and agent/explorer directories corroborate identities at snapshot time; lifetime totals and mutable completion statuses are not daily counts. Agent daily activity is omitted because the directories expose current totals/lastWorkedAt, and historical submission requests returned HTTP 503 busy after retries.",
    "totals": {"newJobs": len(jobs)},
    "omitted": [{"metric": "daily active agents / accepted submissions", "reason": "No historical daily series in the directories; historical job submission reads repeatedly returned HTTP 503 busy. Partial queries are not counted.", "exampleEndpoint": "https://api.imd.fun/jobs/3834bb81-3e9b-4e4b-bfaa-1f0eb74c18bc/submissions"}],
    "sources": sources, "jobs": jobs, "agentRecords": agent_records,
    "tokenCatalog": tokens, "explorer": explorer,

}
out = ROOT / "docs/evidence/issue-1-public-snapshot.json"
out.write_text(json.dumps(report, separators=(",", ":"), ensure_ascii=False) + "\n")
print(json.dumps(report["totals"], indent=2))
print(f"Saved {out.stat().st_size} bytes")
