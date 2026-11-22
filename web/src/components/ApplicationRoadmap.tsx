// General application steps for non-healthcare schemes. Presentational, no props.

const STEPS: { num: string; title: string; body: string }[] = [
  {
    num: "01",
    title: "Confirm eligibility on the official portal (myscheme.gov.in).",
    body: "Check the eligibility conditions for this scheme before you apply.",
  },
  {
    num: "02",
    title: "Gather the documents listed in the Document Checklist tab.",
    body: "Tick off each document you already have, then obtain the rest.",
  },
  {
    num: "03",
    title: "Submit the application.",
    body: "Apply online on the scheme portal, or in person at an e-Sevai, MeeSeva or CSC centre, or at the department office.",
  },
  {
    num: "04",
    title: "Keep the acknowledgement number and track the status.",
    body: "Use the acknowledgement number to check the status on the portal.",
  },
];

export default function ApplicationRoadmap() {
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className="flex items-start gap-4 rounded-2xl border border-stone-200/90 bg-white p-5 shadow-2xs hover:border-[#C5D9C7] transition-all"
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F0F5F1] border border-[#D5E3D6] font-serif-display text-sm font-bold text-[#132A1D]"
            >
              {step.num}
            </span>
            <div className="space-y-1 pt-0.5">
              <p className="font-serif-display text-base font-bold text-[#132A1D]">
                <span className="sr-only">Step {step.num}: </span>
                {step.title}
              </p>
              <p className="text-sm text-stone-600 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-stone-500 font-medium pt-1">
        Guidelines and procedural timelines vary by scheme; confirm details on the official government portal.
      </p>
    </div>
  );
}
