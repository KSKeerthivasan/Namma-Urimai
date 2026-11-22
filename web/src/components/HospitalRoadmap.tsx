// Presentational step-by-step guide for the hospital cashless-treatment journey.
// Plain wording; no props, no client state.

const STEPS: { title: string; body: string; note?: string }[] = [
  {
    title: "Choose an empanelled network hospital in your district.",
    body: "Pick a hospital that is on the scheme's approved list. Ask the front desk if you are not sure.",
  },
  {
    title: "Go to the Arogya Mitra / CMCHIS Insurance Helpdesk in the hospital.",
    body: "Tell the helpdesk staff that you want treatment under the scheme.",
  },
  {
    title: "Present your Ration Card and Aadhaar for pre-authorization.",
    body: "Pre-authorization typically takes 2 to 24 hours.",
    note: "This timeline comes from the project specification. Confirm it locally with the hospital.",
  },
  {
    title: "Cashless admission and discharge.",
    body: "Bed, surgery, medicines and food are covered with zero out-of-pocket cost under the scheme, up to the scheme limit.",
  },
];

export default function HospitalRoadmap() {
  return (
    <div className="space-y-4">
      <p className="text-base text-slate-800">
        This is a guide to the hospital steps. Follow the hospital&apos;s own instructions too.
      </p>
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
              {step.note && (
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Note:</span> {step.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
