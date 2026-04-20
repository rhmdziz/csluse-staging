"use client";


import type { ComponentPropsWithoutRef } from "react";

import { useEffect, useState } from "react";

import { Eye, EyeOff, Loader2 } from "lucide-react";

import Link from "next/link";

import { toast } from "sonner";

import {
  AlertMessage,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
} from "@/components/ui";

import { useLogin } from "@/hooks/auth";

import { cn } from "@/lib/core";

type LoginFormProps = ComponentPropsWithoutRef<"form">;

export default function LoginPage({ className, ...props }: LoginFormProps) {
  const { formData, status, errorMessage, handleChange, handleSubmit } =
    useLogin();
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (status === "error" && errorMessage) {
      toast.error(errorMessage);
    }
  }, [status, errorMessage]);

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="mb-4 flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold">Login ke akun Anda</h1>
          <div>
            <p className="text-sm text-muted-foreground">
              Enter your email below to login to your account
            </p>
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="username">Email</FieldLabel>
          <Input
            id="username"
            name="username"
            type="email"
            placeholder="nim@student.prasetiyamulya.ac.id"
            className="placeholder:text-muted-foreground/50"
            required
            value={formData.username}
            onChange={handleChange}
          />
        </Field>

        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan password"
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
          <div className="flex">
            <Link
              href="/forgot-password"
              className="ml-auto text-xs text-muted-foreground"
            >
              Forgot your password?
            </Link>
          </div>
        </Field>

        {status === "error" && (
          <Field>
            <AlertMessage variant="error">{errorMessage}</AlertMessage>
          </Field>
        )}

        <Field>
          <Button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </Button>
        </Field>
        <Field>
          <FieldDescription className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-center">
            Don&apos;t have an account?{" "}
            <Link href="/signup-guest" className="underline underline-offset-4">
              Sign up as Guest
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
