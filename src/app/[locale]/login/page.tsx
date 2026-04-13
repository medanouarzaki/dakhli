"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { loginSchema, type LoginFormValues } from "@/lib/validations/auth";
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

export default function LoginPage({ params: { locale } }: Props) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (result?.error) {
      // Generic message — never leak whether the email exists or not
      setServerError(t("login.error_invalid"));
      return;
    }

    if (!result?.ok) {
      setServerError(t("login.error_server"));
      return;
    }

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
            <CardTitle className="text-xl">{t("login.title")}</CardTitle>
            <CardDescription>{t("login.subtitle")}</CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                noValidate
              >
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("login.email_label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("login.email_placeholder")}
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
                      <FormLabel>{t("login.password_label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={t("login.password_placeholder")}
                          autoComplete="current-password"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Server-level error */}
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
                      {t("login.submitting")}
                    </>
                  ) : (
                    t("login.submit")
                  )}
                </Button>
              </form>
            </Form>

            {/* Link to signup */}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("login.no_account")}{" "}
              <Link
                href={`/${locale}/signup`}
                className="font-medium text-primary hover:underline"
              >
                {t("login.sign_up_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
