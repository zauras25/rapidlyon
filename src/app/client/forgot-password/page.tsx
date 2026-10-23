import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/client/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <ForgotPasswordForm />
    </div>
  );
}
