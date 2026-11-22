// The plan waiting for Apply, the latest outcome, and Undo: shown by the Sends panel and the chat.

import { show } from "../core/setupPlan";
import type { Plans } from "./useOperator";

function Pending({ plans }: { plans: Plans }) {
  const plan = plans.pending;
  if (!plan) return null;
  return (
    <div className="pending" role="alertdialog" aria-label="Confirm plan">
      <p>
        <strong>{plan.summary}.</strong> <span className="dim">{plan.confirm}.</span>
      </p>
      <ul className="changes">
        {plan.changes.map((c) => (
          <li key={c.param.address}>
            {c.what} <span className="dim">({show(c.from, c.param.type)} → {show(c.value, c.param.type)})</span>
          </li>
        ))}
      </ul>
      <div className="buttons">
        <button type="button" disabled={plans.busy} onClick={() => void plans.confirm()}>Apply</button>
        <button type="button" disabled={plans.busy} onClick={plans.cancel}>Cancel</button>
      </div>
    </div>
  );
}

export function PlanView({ plans }: { plans: Plans }) {
  const last = plans.lastApplied;
  return (
    <div className="plan-view">
      <Pending plans={plans} />
      {plans.message && !(plans.pending && plans.message.kind === "waiting") && (
        <p className={`note outcome ${plans.message.bad ? "bad" : ""}`}>{plans.message.text}</p>
      )}
      {last && (
        <div className="undo">
          <button type="button" disabled={plans.busy} onClick={() => void plans.undo()}>Undo</button>
          <span className="dim"> {last.summary}</span>
        </div>
      )}
    </div>
  );
}
