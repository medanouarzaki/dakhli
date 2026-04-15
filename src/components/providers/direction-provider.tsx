"use client";

import { Direction } from "radix-ui";

type Props = {
  dir: "ltr" | "rtl";
  children: React.ReactNode;
};

export function RadixDirectionProvider({ dir, children }: Props) {
  return (
    <Direction.DirectionProvider dir={dir}>
      {children}
    </Direction.DirectionProvider>
  );
}
