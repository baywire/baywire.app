import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { cardTitleClasses } from "../variants";

export type CardTitleProps = Omit<ComponentProps<"h3">, "className"> & {
  interactive?: boolean;
  className?: string;
};

export function CardTitle({ interactive = false, className, ...props }: CardTitleProps) {
  return <h3 className={cn(cardTitleClasses(interactive), className)} {...props} />;
}
