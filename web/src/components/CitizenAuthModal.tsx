"use client";

import { useState } from "react";
import { ShieldCheck, CheckCircle2, X, AlertTriangle, ArrowRight } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: { phone: string; name: string }) => void;
};

export default function CitizenAuthModal({ isOpen, onClose, onLoginSuccess }: Props) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    setError(null);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 400);
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 4) {
      setError("Please enter a 4-digit OTP.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const citizenUser = {
        phone: phone.replace(/\D/g, ""),
        name: `Citizen (+91 ${phone.slice(-4)})`,
        loggedIn: true,
        loginAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem("namma_citizen_user", JSON.stringify(citizenUser));
        window.dispatchEvent(new CustomEvent("namma-auth-changed", { detail: citizenUser }));
      } catch {}

      if (onLoginSuccess) {
        onLoginSuccess(citizenUser);
      }
      onClose();
    }, 400);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#1E40AF]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#0F294A]">Citizen Login</h2>
            <p className="text-xs text-slate-600">Sync document checklists & track application roadmaps</p>
          </div>
        </div>

        {/* Clear Notice about Guest vs Login */}
        <div className="mb-5 rounded-xl bg-amber-50/90 border border-amber-200/90 p-3 text-xs text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Why Sign In?</p>
              <p className="text-amber-900 mt-0.5 leading-relaxed">
                Without login, your document checklist selections and application roadmap completion are stored only locally in this browser. Signing in lets you access your saved schemes and track progress from any phone or PC.
              </p>
            </div>
          </div>
        </div>

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="citizen-phone" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-slate-500">
                  +91
                </span>
                <input
                  id="citizen-phone"
                  type="tel"
                  autoFocus
                  maxLength={10}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, ""));
                    setError(null);
                  }}
                  placeholder="9876543210"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-12 pr-4 text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                You will receive a one-time OTP for citizen authentication.
              </p>
            </div>

            {error && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F294A] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#1E40AF] disabled:opacity-40 transition-all cursor-pointer"
            >
              <span>{loading ? "Sending OTP..." : "Get OTP Verification Code"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="citizen-otp" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Enter 4-Digit OTP
                </label>
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="text-xs font-semibold text-[#1E40AF] hover:underline"
                >
                  Change Number
                </button>
              </div>
              <input
                id="citizen-otp"
                type="text"
                autoFocus
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value);
                  setError(null);
                }}
                placeholder="Enter OTP (e.g. 1234)"
                className="w-full rounded-xl border border-slate-300 py-2.5 px-4 text-center text-lg tracking-widest font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-100 outline-none"
              />
              <p className="mt-1 text-center text-[11px] text-slate-500">
                Demo authentication active · Enter <strong>1234</strong> or any 4 digits to sign in
              </p>
            </div>

            {error && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otp.trim().length < 4}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F294A] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#1E40AF] disabled:opacity-40 transition-all cursor-pointer"
            >
              <span>{loading ? "Verifying..." : "Verify & Sign In"}</span>
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </form>
        )}

        <div className="mt-4 pt-3 border-t border-slate-200 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Continue as Guest (No Login)
          </button>
        </div>
      </div>
    </div>
  );
}
