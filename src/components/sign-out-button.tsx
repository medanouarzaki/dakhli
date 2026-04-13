"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

type Props = {
  locale: string;
  label: string;
};

export function SignOutButton({ locale, label }: Props) {
  return (
    <Button
      variant="outline"
      onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
    >
      {label}
    </Button>
  );
}
