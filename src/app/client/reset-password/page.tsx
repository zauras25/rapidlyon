import type { Metadata } from "next";
import { PasswordResetForm } from "@/components/client/password-reset-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-7xl items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <PasswordResetForm />
    </div>
  );
}
