// src/ui/components/CurrencyCombobox.jsx
import * as React from "react";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/components/ui/command";
import { Button } from "@/ui/components/ui/button";
import { ScrollArea } from "@/ui/components/ui/scroll-area";
import { Check, ChevronsUpDown } from "lucide-react";
import { getCurrencyMeta, getAllCurrencies } from "../../shared/currencies.js";
import { cn } from "@/ui/lib/utils";

/**
 * Accessible searchable Currency Combobox with Popover + Command.
 *
 * @param {object} props
 * @param {string|null} props.value - Selected currency code (e.g. "USD") or empty/null
 * @param {(code: string|null) => void} props.onChange - Selection handler
 * @param {Array<{code: string, name: string, symbol: string}>} [props.currencies] - Optional filtered currency list
 * @param {boolean} [props.allowAutoDetect=false] - When true, provides an "Auto-detect" item
 * @param {string} [props.autoDetectLabel="Auto-detect"] - Label for auto-detect option
 * @param {string} [props.placeholder="Search code or name..."] - Search input placeholder
 * @param {string} [props.triggerText] - Custom trigger text override
 * @param {string} [props.triggerId] - HTML id for trigger button
 * @param {string} [props.searchInputId] - HTML id for search input
 * @param {string} [props.ariaLabel="Select currency"] - Accessible label for trigger
 * @param {"start"|"end"|"center"} [props.align="start"] - Popover alignment
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.className] - Trigger button class name
 * @param {string} [props.popoverClassName] - Popover content class name
 * @param {string} [props.scrollHeight="h-56"] - Height for scrollable item list
 */
export function CurrencyCombobox({
  value,
  onChange,
  currencies,
  allowAutoDetect = false,
  autoDetectLabel = "Auto-detect",
  placeholder = "Search code or name...",
  triggerText,
  triggerId,
  searchInputId,
  ariaLabel = "Select currency",
  align = "start",
  disabled = false,
  className,
  popoverClassName,
  scrollHeight = "h-56",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const list = useMemo(() => {
    if (currencies && Array.isArray(currencies)) return currencies;
    return getAllCurrencies({ includeCrypto: true }).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
  }, [currencies]);

  const filteredCurrencies = useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.symbol && c.symbol.toLowerCase().includes(q))
    );
  }, [list, search]);

  const selectedMeta = value ? getCurrencyMeta(value) : null;

  const displayLabel = useMemo(() => {
    if (triggerText) return triggerText;
    if (!value) return allowAutoDetect ? autoDetectLabel : "Select currency...";
    const sym = selectedMeta?.symbol || value;
    return `${value} (${sym})`;
  }, [triggerText, value, selectedMeta, allowAutoDetect, autoDetectLabel]);

  const handleSelect = (code) => {
    onChange?.(code);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return;
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={triggerId}
          variant="outline"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "justify-between font-mono text-xs h-9 bg-background",
            className
          )}
        >
          <span
            id={triggerId === "picker-to-btn" ? "selected-target-text" : undefined}
            className="truncate"
          >
            {displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[260px] p-0", popoverClassName)}
        align={align}
      >
        <Command>
          <CommandInput
            id={searchInputId}
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
            className="search-input h-9 text-xs"
            aria-label={placeholder}
          />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
              No currency found.
            </CommandEmpty>

            {allowAutoDetect && (
              <CommandGroup>
                <CommandItem
                  data-currency-code=""
                  value={`auto ${autoDetectLabel}`}
                  onSelect={() => handleSelect(null)}
                  onClick={() => handleSelect(null)}
                  className="option-item text-xs py-1.5 cursor-pointer font-sans"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5 shrink-0",
                      !value ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                  <span>{autoDetectLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Currencies">
              <ScrollArea className={scrollHeight}>
                {filteredCurrencies.map((c) => {
                  const isSelected = value === c.code;
                  return (
                    <CommandItem
                      key={c.code}
                      data-currency-code={c.code}
                      value={`${c.code} ${c.name} ${c.symbol}`}
                      onSelect={() => handleSelect(c.code)}
                      onClick={() => handleSelect(c.code)}
                      className="option-item text-xs font-mono flex items-center justify-between py-1.5 cursor-pointer"
                    >
                      <div className="flex items-center min-w-0">
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5 shrink-0",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                          aria-hidden="true"
                        />
                        <span className="font-semibold">{c.code}</span>
                        <span className="ml-2 font-sans text-muted-foreground truncate max-w-[120px]">
                          {c.name}
                        </span>
                      </div>
                      <span className="font-sans font-bold ml-1 shrink-0">
                        {c.symbol}
                      </span>
                    </CommandItem>
                  );
                })}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
