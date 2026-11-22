// General application steps for non-healthcare schemes. Presentational, no props.

const STEPS: { title: string; body: string }[] = [
  {
    title: "Confirm eligibility on the official portal (myscheme.gov.in).",
    body: "Check the eligibility conditions for this scheme before you apply.",
  },
  {
    title: "Gather the documents listed in the Document Checklist tab.",
    body: "Tick off each document you already have, then obtain the rest.",
  },
  {
    title: "Submit the application.",
    body: "Apply online on the scheme portal, or in person at an e-Sevai, MeeSeva or CSC centre, or at the department office.",
  },
  {
    title: "Keep the acknowledgement number and track the status.",
    body: "Use the acknowledgement number to check the status on the portal.",
  },
];

export default function ApplicationRoadmap() {
  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-lg font-bold text-white"
            >
              {index + 1}
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold text-navy">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </p>
              <p className="text-base text-slate-800">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-slate-700">
        Guidelines and procedural timelines vary by scheme; confirm details on the official portal.
      </p>
    </div>
  );
}
