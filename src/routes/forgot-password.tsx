import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Bowlie" }] }),
  component: ForgotPasswordPage,
});

type Step = "phone" | "otp" | "password";

function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpResendTimer <= 0) return;
    const t = setTimeout(() => setOtpResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [otpResendTimer]);

  // ── Step 1: Send OTP ──────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = phone.replace(/\s/g, "");
    if (!cleaned || cleaned.length < 10) {
      toast.error("Enter a valid mobile number");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: cleaned,
        options: { channel: "sms" },
      });
      if (error) throw error;
      toast.success("OTP sent — check your messages");
      setStep("otp");
      setOtpResendTimer(60);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      toast.error("Enter the OTP sent to your phone");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });
      if (error) {
        if (/expired/i.test(error.message)) {
          toast.error("OTP has expired — request a new one");
          setStep("phone");
          setOtp("");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("Phone verified — set your new password");
      setStep("password");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Step 3: Update Password ───────────────────────────────────────
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error("Password must contain at least one lowercase letter");
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error("Password must contain at least one number");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated — signing you out");
      await supabase.auth.signOut();
      router.navigate({ to: "/auth", search: { mode: "signin" } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Resend OTP ────────────────────────────────────────────────────
  async function handleResendOtp() {
    if (otpResendTimer > 0) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { channel: "sms" },
      });
      if (error) throw error;
      toast.success("New OTP sent");
      setOtpResendTimer(60);
      setOtp("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Password strength indicator ───────────────────────────────────
  function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return { label: "Weak", color: "bg-destructive", width: "w-1/4" };
    if (score <= 3) return { label: "Fair", color: "bg-amber-500", width: "w-2/4" };
    if (score <= 4) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
    return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
  }

  const strength = getPasswordStrength(password);
  const stepIndex = step === "phone" ? 1 : step === "otp" ? 2 : 3;

  return (
    <PublicShell>
      <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
        <div className="mx-auto w-full max-w-md">
          {/* ── Header ──────────────────────────────────────────── */}
          <div className="mb-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10">
              <KeyRound className="h-5 w-5 text-primary" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
              Reset your password
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {step === "phone" && "Enter your registered mobile number to receive a one-time password."}
              {step === "otp" && `We sent a code to ${phone}`}
              {step === "password" && "Create a strong new password for your account."}
            </p>
          </div>

          {/* ── Step indicator ──────────────────────────────────── */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    n < stepIndex
                      ? "bg-emerald-500 text-white"
                      : n === stepIndex
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {n < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
                </div>
                {n < 3 && (
                  <div className={`h-px w-8 ${n < stepIndex ? "bg-emerald-500" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          {/* ── Card ────────────────────────────────────────────── */}
          <div className="surface-card p-7">
            {/* ── Step 1: Phone ──────────────────────────────── */}
            {step === "phone" && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <Label htmlFor="phone">Mobile number</Label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Include country code if not in India (+91)
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending OTP…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Send OTP <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            )}

            {/* ── Step 2: OTP ─────────────────────────────────── */}
            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <Label htmlFor="otp">One-time password</Label>
                  <div className="relative mt-1.5">
                    <ShieldCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="pl-10 font-mono text-lg tracking-[0.3em]"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Verify OTP <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => { setStep("phone"); setOtp(""); }}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    <ArrowLeft className="h-3 w-3" /> Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpResendTimer > 0}
                    className="hover:text-foreground disabled:opacity-50"
                  >
                    {otpResendTimer > 0 ? `Resend in ${otpResendTimer}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 3: New password ────────────────────────── */}
            {step === "password" && (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-destructive">
                      <ShieldAlert className="h-3 w-3" /> Passwords do not match
                    </p>
                  )}
                  {confirmPassword.length > 0 && password === confirmPassword && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                {/* Password requirements */}
                <div className="rounded-xl border border-border bg-surface/60 p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Password must contain
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className={`flex items-center gap-1.5 ${password.length >= 8 ? "text-emerald-600" : ""}`}>
                      {password.length >= 8 ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-border" />}
                      At least 8 characters
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[A-Z]/.test(password) ? "text-emerald-600" : ""}`}>
                      {/[A-Z]/.test(password) ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-border" />}
                      One uppercase letter
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[a-z]/.test(password) ? "text-emerald-600" : ""}`}>
                      {/[a-z]/.test(password) ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-border" />}
                      One lowercase letter
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? "text-emerald-600" : ""}`}>
                      {/[0-9]/.test(password) ? <CheckCircle2 className="h-3 w-3" /> : <span className="h-3 w-3 rounded-full border border-border" />}
                      One number
                    </li>
                  </ul>
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Updating password…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Update password <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* ── Back to sign in ──────────────────────────────────── */}
          <p className="mt-5 text-center text-xs text-muted-foreground">
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
