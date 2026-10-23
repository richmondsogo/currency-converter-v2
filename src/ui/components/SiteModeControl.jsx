// src/ui/components/SiteModeControl.jsx
import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/ui/components/ui/toggle-group";
import { cn } from "@/ui/lib/utils";

/**
 * Three-way segmented control for site conversion mode: Ask | Always | Never.
 *
 * @param {object} props
 * @param {"ask"|"always"|"never"|""} props.value - Active mode or empty string if unset/inheriting default
 * @param {(mode: "ask"|"always"|"never") => void} props.onChange - Selection handler
 * @param {string} [props.ariaLabel="Conversion mode"] - Accessible label for group
 * @param {string} [props.domain] - Optional domain name to provide contextual aria-labels
 * @param {"sm"|"default"} [props.size="sm"] - Size variant
 * @param {boolean} [props.disabled=false] - Whether control is disabled
 * @param {string} [props.className] - Additional classes
 */
export function SiteModeControl({
  value = "",
  onChange,
  ariaLabel = "Conversion mode",
  domain,
  size = "sm",
  disabled = false,
  className,
  id,
}) {
  const itemClasses = size === "sm" ? "text-xs h-7 px-2" : "text-xs h-8 px-2.5";

  const askLabel = domain ? `Ask on ${domain}` : "Mode Ask";
  const alwaysLabel = domain ? `Always convert ${domain}` : "Mode Always";
  const neverLabel = domain ? `Never convert ${domain}` : "Mode Never";

  return (
    <ToggleGroup
      id={id}
      type="single"
      value={value || ""}
      onValueChange={(val) => {
        if (!val || disabled) return;
        onChange?.(val);
      }}
      disabled={disabled}
      className={cn("bg-secondary p-0.5 rounded-lg border border-border shrink-0", className)}
      aria-label={ariaLabel}
    >
      <ToggleGroupItem
        value="ask"
        aria-label={askLabel}
        className={itemClasses}
      >
        Ask
      </ToggleGroupItem>
      <ToggleGroupItem
        value="always"
        aria-label={alwaysLabel}
        className={itemClasses}
      >
        Always
      </ToggleGroupItem>
      <ToggleGroupItem
        value="never"
        aria-label={neverLabel}
        className={itemClasses}
      >
        Never
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
