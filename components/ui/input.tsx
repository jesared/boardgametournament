import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const isDate = type === "date";

  return (
    <input
      type={type}
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none ring-offset-background transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
        isDate && "[color-scheme:light] dark:[color-scheme:dark]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
