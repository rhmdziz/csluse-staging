"use client";


import type { ComponentPropsWithoutRef } from "react";

import { useEffect, useState } from "react";

import { Eye, EyeOff, Loader2 } from "lucide-react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import {
  AlertMessage,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  Input,
} from "@/components/ui";

import { useSignupGuest } from "@/hooks/auth";

import { cn } from "@/lib/core";

type SignupGuestFormProps = ComponentPropsWithoutRef<"form">;

export default function SignupGuestPage({ className, ...props }: SignupGuestFormProps) {
  const { formData, status, errorMessage, handleChange, handleSubmit } =
    useSignupGuest();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const router = useRouter();

  const passwordErrors: string[] = [];
  if (formData.password.length > 0 && formData.password.length < 8) {
    passwordErrors.push("Password minimal 8 karakter.");
  }
  if (formData.password.length > 0 && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
    passwordErrors.push("Password harus mengandung huruf besar, huruf kecil, dan angka.");
  }
  const confirmPasswordError =
    formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword
      ? "Password dan konfirmasi password tidak sama."
      : null;

  const hasValidationError = passwordErrors.length > 0 || !!confirmPasswordError;

  useEffect(() => {
    if (status === "success") {
      setSuccessOpen(true);
      const timer = window.setTimeout(() => {
        router.push("/login");
      }, 3000);

      return () => window.clearTimeout(timer);
    }
  }, [status, router]);

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold">Selamat datang di CSL USE!</h1>
          <div>
            <p className="text-sm text-muted-foreground">
              Create your account to get started <i>as Guest</i>
            </p>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="fullname">Nama Lengkap</FieldLabel>
          <Input
            id="fullname"
            name="fullName"
            type="text"
            placeholder="Masukkan nama lengkap"
            className="placeholder:text-muted-foreground/50"
            required
            value={formData.fullName}
            onChange={handleChange}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="institution">Institusi</FieldLabel>
          <Input
            id="institution"
            name="institution"
            type="text"
            placeholder="Asal institusi"
            className="placeholder:text-muted-foreground/50"
            required
            value={formData.institution}
            onChange={handleChange}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Masukkan email"
            className="placeholder:text-muted-foreground/50"
            required
            value={formData.email}
            onChange={handleChange}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Buat password"
              required
              value={formData.password}
              onChange={handleChange}
              className="pr-10 placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {passwordErrors.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {passwordErrors.map((err) => (
                <li key={err} className="text-xs text-red-500">{err}</li>
              ))}
            </ul>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">Konfirmasi Password</FieldLabel>
          <div className="relative">
            <Input
              id="confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Ulangi password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="pr-10 placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {confirmPasswordError && (
            <p className="mt-1 text-xs text-red-500">{confirmPasswordError}</p>
          )}
        </Field>

        <Field>
          <Button type="submit" disabled={status === "submitting" || hasValidationError}>
            {status === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mendaftar...
              </>
            ) : (
              "Sign Up"
            )}
          </Button>
        </Field>

        {status === "success" && successOpen && (
          <Field>
            <AlertMessage variant="success">
              Berhasil registrasi. Silakan cek email Anda untuk verifikasi.
            </AlertMessage>
          </Field>
        )}

        {status === "error" && (
          <Field>
            <AlertMessage variant="error">{errorMessage}</AlertMessage>
          </Field>
        )}

        <Field>
          <FieldDescription className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-center">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Login
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
