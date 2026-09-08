import { appendFile, readFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, digest, stateDigest } from "./canonical.mjs";

export function makeReceipt(state, details) {
  const body = {
    seq: state.next_event_seq,
    generation: state.generation,
    cell_id: details.cellId,
    need_id: details.needId,
    policy: details.policy,
    policy_trace: details.policyTrace ?? null,
    local_view_hash: details.localViewHash,
    proposal: details.proposal,
    decision: details.decision,
    state_digest_after: stateDigest(state),
    prev_hash: state.ledger_head,
  };
  return { ...body, hash: digest(body) };
}

export async function appendReceipt(path, receipt) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${canonicalJson(receipt)}\n`, "utf8");
}

export async function readReceipts(path) {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export function validateLedger(receipts, expectedHead = undefined) {
  let previous = null;
  let expectedSeq = 1;
  for (const receipt of receipts) {
    if (receipt.seq !== expectedSeq) throw new Error(`ledger sequence mismatch at ${receipt.seq}`);
    if (receipt.prev_hash !== previous) throw new Error(`ledger previous hash mismatch at ${receipt.seq}`);
    const { hash, ...body } = receipt;
    if (digest(body) !== hash) throw new Error(`ledger hash mismatch at ${receipt.seq}`);
    previous = hash;
    expectedSeq += 1;
  }
  if (expectedHead !== undefined && previous !== expectedHead) throw new Error("ledger head does not match state");
  return true;
}
