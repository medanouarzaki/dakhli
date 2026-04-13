"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { signupSchema, type SignupFormValues } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type Props = {
  params: { locale: string };
};

export default function SignupPage({ params: { locale } }: Props) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: SignupFormValues) {
    setServerError(null);

    // 1. Call signup API
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data: unknown = await res.json();
      const error =
        data !== null &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : null;

      if (res.status === 409 || error === "email_already_taken") {
        setServerError(t("signup.error_email_taken"));
      } else {
        setServerError(t("signup.error_server"));
      }
      return;
    }

    // 2. Auto sign-in after successful registration
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      // Signup succeeded but auto-login failed — send to login page
      router.push(`/${locale}/login`);
      return;
    }

    // 3. Redirect to dashboard
    router.push(`/${locale}/dashboard`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-[400px] space-y-6">
        {/* Logo */}
        <div className="text-center">
          <span className="text-2xl font-bold tracking-tight">Dakhli</span>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{t("signup.title")}</CardTitle>
            <CardDescription>{t("signup.subtitle")}</CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                {/* Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("signup.name_label")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("signup.name_placeholder")}
                          autoComplete="name"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("signup.email_label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("signup.email_placeholder")}
                          autoComplete="email"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("signup.password_label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("signup.password_placeholder")}
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Confirm password */}
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("signup.confirm_password_label")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("signup.confirm_password_placeholder")}
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Server-level error (409, 500) */}
                {serverError && (
                  <p className="text-sm text-destructive">{serverError}</p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t("signup.submitting")}
                    </>
                  ) : (
                    t("signup.submit")
                  )}
                </Button>
              </form>
            </Form>

            {/* Link to login */}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("signup.already_have_account")}{" "}
              <Link
                href={`/${locale}/login`}
                className="font-medium text-primary hover:underline"
              >
                {t("signup.sign_in_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
