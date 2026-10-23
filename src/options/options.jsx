// src/options/options.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/ui/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { Switch } from "@/ui/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/ui/components/ui/toggle-group";
import { Separator } from "@/ui/components/ui/separator";
import { Badge } from "@/ui/components/ui/badge";
import { ScrollArea } from "@/ui/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/ui/components/ui/alert-dialog";
import {
  Sliders,
  Coins,
  Globe,
  Palette,
  Database,
  Info,
  Sun,
  Moon,
  Laptop,
  Check,
  ChevronsUpDown,
  Search,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  RotateCcw,
  AlertCircle,
  Plus,
  Command as CommandIcon,
} from "lucide-react";
import { CURRENCIES_DATA } from "../shared/currencies-data.js";
import { getAllCurrencies, getCurrencyMeta } from "../shared/currencies.js";
import { MSG } from "../shared/messaging.js";
import { sendMessage, getBrowser } from "../shared/browser.js";
import {
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  getSiteMode,
  setSiteMode,
  normalizeHost,
  migrateSettings,
  validateSettings,
  SettingsManager,
} from "../shared/settings.js";

const api = getBrowser();

const SECTIONS = [
  {
    id: "general",
    title: "General",
    description: "Default target currency, visual formatting, and interface triggers.",
    icon: Sliders,
  },
  {
    id: "currencies",
    title: "Currencies",
    description: "Pinned currencies, context menu shortcuts, and quick access.",
    icon: Coins,
  },
  {
    id: "sites",
    title: "Sites",
    description: "Per-domain automatic conversion rules and behavior overrides.",
    icon: Globe,
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Theme preferences, price display modes, and color options.",
    icon: Palette,
  },
  {
    id: "data",
    title: "Data",
    description: "Export configuration, restore backups, or reset to factory defaults.",
    icon: Database,
  },
  {
    id: "about",
    title: "About",
    description: "Extension information, exchange rate providers, and documentation.",
    icon: Info,
  },
];

const SUGGESTED_PINNED = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "NGN", "INR"];
const DOLLAR_CURRENCIES = ["USD", "CAD", "AUD", "NZD", "SGD", "HKD", "MXN"];

function applyTheme(theme) {
  try {
    localStorage.setItem("currency_converter_theme", theme);
  } catch {}
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    root.classList.add("dark");
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
  }
}

export function OptionsApp() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentSection, setCurrentSection] = useState(() => {
    const hash = window.location.hash.replace(/^#/, "").toLowerCase();
    const match = SECTIONS.find((s) => s.id === hash);
    return match ? match.id : "general";
  });

  // Rates & Shortcuts for About section
  const [ratesInfo, setRatesInfo] = useState(null);
  const [shortcutKey, setShortcutKey] = useState("Alt+Shift+C");

  // Combobox popover states
  const [targetComboboxOpen, setTargetComboboxOpen] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");
  const [pinnedComboboxOpen, setPinnedComboboxOpen] = useState(false);
  const [pinnedSearch, setPinnedSearch] = useState("");

  // Sites section state
  const [newSiteDomain, setNewSiteDomain] = useState("");
  const [newSiteMode, setNewSiteMode] = useState("always");
  const [newSiteCurrency, setNewSiteCurrency] = useState("");
  const [newSiteError, setNewSiteError] = useState("");
  const [rulesSearch, setRulesSearch] = useState("");

  const importFileInputRef = useRef(null);

  // 1. Hash routing listener
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "").toLowerCase();
      const match = SECTIONS.find((s) => s.id === hash);
      if (match) {
        setCurrentSection(match.id);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Sync document.title and URL hash with currentSection
  useEffect(() => {
    const active = SECTIONS.find((s) => s.id === currentSection) || SECTIONS[0];
    document.title = `${active.title} — Currency Convertr`;
    if (window.location.hash !== `#${currentSection}`) {
      window.location.hash = `#${currentSection}`;
    }
  }, [currentSection]);

  // 2. Load settings on mount
  const loadInitialSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      let loaded = null;
      try {
        loaded = await sendMessage({ type: MSG.GET_SETTINGS });
      } catch (err) {
        console.warn("[Options] Messaging GET_SETTINGS failed, trying SettingsManager:", err);
        const mgr = new SettingsManager();
        loaded = await mgr.getSettings();
      }
      if (!loaded) throw new Error("No settings returned from service worker or storage");
      const validated = validateSettings(loaded);
      setSettings(validated);
      applyTheme(validated.theme);
    } catch (err) {
      console.error("[Options] Failed to load settings:", err);
      setLoadError(err.message || "Failed to load preferences");
      // Fallback
      setSettings({ ...DEFAULT_SETTINGS });
      applyTheme(DEFAULT_SETTINGS.theme);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialSettings();
  }, [loadInitialSettings]);

  // 3. Storage change listener (syncs popup edits live)
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if (area === "local" && changes[SETTINGS_STORAGE_KEY]) {
        const next = changes[SETTINGS_STORAGE_KEY].newValue;
        if (next) {
          const validated = validateSettings(next);
          setSettings(validated);
          applyTheme(validated.theme);
        }
      }
    };

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    } else if (typeof browser !== "undefined" && browser.storage && browser.storage.onChanged) {
      browser.storage.onChanged.addListener(handleStorageChange);
      return () => browser.storage.onChanged.removeListener(handleStorageChange);
    }
  }, []);

  // 4. System theme listener
  useEffect(() => {
    if (!settings || settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add("dark");
        root.setAttribute("data-theme", "dark");
      } else {
        root.classList.remove("dark");
        root.setAttribute("data-theme", "light");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [settings?.theme]);

  // 5. Fetch live rates and shortcut for About section
  useEffect(() => {
    async function fetchMetadata() {
      try {
        const ratesRes = await sendMessage({ type: MSG.GET_RATES });
        if (ratesRes) {
          setRatesInfo(ratesRes);
        }
      } catch (e) {
        console.warn("[Options] Could not fetch rates metadata:", e);
      }

      try {
        if (typeof chrome !== "undefined" && chrome.commands && chrome.commands.getAll) {
          chrome.commands.getAll((commands) => {
            const cmd = commands.find((c) => c.name === "toggle-page-conversion");
            if (cmd && cmd.shortcut) {
              setShortcutKey(cmd.shortcut);
            }
          });
        }
      } catch (e) {
        console.warn("[Options] Could not query commands:", e);
      }
    }
    fetchMetadata();
  }, []);

  // Central update function
  const updateSettings = useCallback(
    async (partial, successMessage = "Saved") => {
      if (!settings) return;
      const nextSettings = validateSettings({ ...settings, ...partial });
      setSettings(nextSettings);

      if (partial.theme) {
        applyTheme(partial.theme);
      }

      try {
        let res = null;
        try {
          res = await sendMessage({
            type: MSG.UPDATE_SETTINGS,
            payload: partial,
          });
        } catch {
          const mgr = new SettingsManager();
          res = { settings: await mgr.updateSettings(partial) };
        }
        if (res && res.settings) {
          setSettings(validateSettings(res.settings));
        }
        toast.success(successMessage, { duration: 1600 });
      } catch (err) {
        console.error("[Options] Update settings error:", err);
        toast.error("Failed to save changes", { description: err.message });
      }
    },
    [settings]
  );

  // Available currencies
  const allCurrencies = useMemo(() => {
    const showCrypto = Boolean(settings?.showCrypto);
    return getAllCurrencies({ includeCrypto: showCrypto }).sort((a, b) =>
      a.code.localeCompare(b.code)
    );
  }, [settings?.showCrypto]);

  const filteredTargetCurrencies = useMemo(() => {
    if (!targetSearch) return allCurrencies;
    const q = targetSearch.toLowerCase().trim();
    return allCurrencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [allCurrencies, targetSearch]);

  const availableUnpinnedCurrencies = useMemo(() => {
    const pinned = settings?.pinnedCurrencies || [];
    const unpinned = allCurrencies.filter((c) => !pinned.includes(c.code));
    if (!pinnedSearch) return unpinned;
    const q = pinnedSearch.toLowerCase().trim();
    return unpinned.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [allCurrencies, settings?.pinnedCurrencies, pinnedSearch]);

  // Handlers for Pinned Currencies
  const handleRemovePinned = (code) => {
    const current = settings.pinnedCurrencies || [];
    const next = current.filter((c) => c !== code);
    updateSettings({ pinnedCurrencies: next }, `Removed ${code} from pinned`);
  };

  const handleAddPinned = (code) => {
    const current = settings.pinnedCurrencies || [];
    if (current.length >= 8) {
      toast.error("Pinned limit reached", { description: "Maximum 8 currencies can be pinned." });
      return;
    }
    if (!current.includes(code)) {
      updateSettings({ pinnedCurrencies: [...current, code] }, `Pinned ${code}`);
    }
    setPinnedComboboxOpen(false);
  };

  // Handlers for Site Rules
  const handleAddSiteRule = (e) => {
    e.preventDefault();
    setNewSiteError("");
    const raw = newSiteDomain.trim();
    if (!raw) {
      setNewSiteError("Please enter a domain name (e.g. amazon.de)");
      return;
    }
    const clean = normalizeHost(raw);
    if (!clean || !clean.includes(".")) {
      setNewSiteError("Please enter a valid domain containing an extension (e.g. amazon.de)");
      return;
    }
    if (settings.perSite && settings.perSite[clean]) {
      setNewSiteError(`A rule for "${clean}" already exists`);
      return;
    }

    const updatedPerSite = { ...(settings.perSite || {}) };
    updatedPerSite[clean] = {
      mode: newSiteMode,
      assumedCurrency: newSiteCurrency || null,
    };
    updateSettings({ perSite: updatedPerSite }, `Rule added for ${clean}`);
    setNewSiteDomain("");
    setNewSiteMode("always");
    setNewSiteCurrency("");
    setNewSiteError("");
  };

  const handleUpdateSiteMode = (host, mode) => {
    const updated = { ...(settings.perSite || {}) };
    setSiteMode({ perSite: updated }, host, mode);
    updateSettings({ perSite: updated }, `Updated ${host} to ${mode.toUpperCase()}`);
  };

  const handleResetSiteMode = (host) => {
    const updated = { ...(settings.perSite || {}) };
    setSiteMode({ perSite: updated }, host, null);
    updateSettings({ perSite: updated }, `Reset ${host} to default behavior`);
  };

  const handleSetAssumedCurrency = (host, currency) => {
    const updated = { ...(settings.perSite || {}) };
    if (!updated[host]) {
      updated[host] = {};
    }
    updated[host] = {
      ...updated[host],
      assumedCurrency: currency || null,
    };
    updateSettings({ perSite: updated }, `Updated assumed currency for ${host}`);
  };

  const handleRemoveSiteRule = (host) => {
    const updated = { ...(settings.perSite || {}) };
    delete updated[host];
    updateSettings({ perSite: updated }, `Rule for ${host} removed`);
  };

  // Handlers for Data Export/Import/Reset
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `currency-convertr-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Settings exported to JSON");
  };

  const handleImportJson = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("File content must be a JSON object");
        }
        const migrated = migrateSettings(parsed);
        await updateSettings(migrated, "Settings restored from backup");
      } catch (err) {
        console.error("[Options] Import failed:", err);
        toast.error("Failed to import settings", { description: err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetDefaults = async () => {
    try {
      const mgr = new SettingsManager();
      const defaults = await mgr.resetDefaults();
      setSettings(defaults);
      applyTheme(defaults.theme);
      toast.success("All settings reset to factory defaults");
    } catch (err) {
      console.error("[Options] Reset defaults failed:", err);
      toast.error("Failed to reset defaults", { description: err.message });
    }
  };

  const activeSection = SECTIONS.find((s) => s.id === currentSection) || SECTIONS[0];

  // Loading state
  if (loading && !settings) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans">
        <div className="space-y-3 text-center">
          <div className="w-8 h-8 mx-auto rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-sm animate-pulse">
            fx
          </div>
          <p className="text-sm text-muted-foreground">Loading preferences...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError && !settings) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-sans p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Failed to load preferences</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={loadInitialSettings} variant="default" className="mt-2">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const selectedTargetMeta = getCurrencyMeta(settings.targetCurrency);

  // Filter site rules
  const perSiteEntries = Object.entries(settings.perSite || {});
  const filteredSiteEntries = rulesSearch
    ? perSiteEntries.filter(([host]) => host.toLowerCase().includes(rulesSearch.toLowerCase()))
    : perSiteEntries;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/20">
        {/* Header Shell */}
        <header className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-sm">
                fx
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-md tracking-tight">Currency Convertr</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    v{typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "2.0.0"} ({typeof __BUILD_GIT_SHA__ !== "undefined" ? __BUILD_GIT_SHA__ : "dev"})
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Preferences and Configuration</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <ToggleGroup
                type="single"
                value={settings.theme}
                onValueChange={(val) => val && updateSettings({ theme: val })}
                className="bg-secondary p-0.5 rounded-lg border border-border"
                aria-label="Theme quick switcher"
              >
                <ToggleGroupItem value="light" aria-label="Light theme" className="h-7 px-2 text-xs">
                  <Sun className="h-3.5 w-3.5 mr-1" /> Light
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label="Dark theme" className="h-7 px-2 text-xs">
                  <Moon className="h-3.5 w-3.5 mr-1" /> Dark
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label="System theme" className="h-7 px-2 text-xs">
                  <Laptop className="h-3.5 w-3.5 mr-1" /> System
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </header>

        {/* Main Two-Column Layout */}
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-8">
          {/* Sidebar (~220px on desktop; horizontal scrollable nav on mobile <760px) */}
          <aside className="w-full md:w-[220px] shrink-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2 hidden md:block">
              Preferences
            </div>
            <nav
              className="flex md:flex-col overflow-x-auto md:overflow-visible gap-1 pb-2 md:pb-0"
              aria-label="Settings sections"
            >
              {SECTIONS.map((sec) => {
                const Icon = sec.icon;
                const isActive = currentSection === sec.id;
                return (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setCurrentSection(sec.id)}
                    className={`group flex items-center space-x-2.5 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-secondary text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground font-normal"
                    }`}
                  >
                    <Icon
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 ${
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    <span>{sec.title}</span>
                  </a>
                );
              })}
            </nav>
          </aside>

          {/* Settings Column (~640px, NO CARDS) */}
          <main className="flex-1 max-w-[640px] space-y-6">
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {activeSection.title}
              </h1>
              <p className="text-sm text-muted-foreground">{activeSection.description}</p>
            </div>
            <Separator />

            {/* SECTION 1: GENERAL */}
            {currentSection === "general" && (
              <div className="space-y-6">
                {/* Default Target Currency */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium text-foreground">
                      Default Target Currency
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatic conversions and context menus will always convert to this currency.
                    </p>
                  </div>

                  <Popover
                    open={targetComboboxOpen}
                    onOpenChange={(open) => {
                      setTargetComboboxOpen(open);
                      if (!open) setTargetSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="select-target-currency"
                        variant="outline"
                        role="combobox"
                        aria-label="Default target currency"
                        aria-expanded={targetComboboxOpen}
                        className="w-[200px] justify-between font-mono text-xs h-9 bg-background"
                      >
                        <span className="truncate">
                          {settings.targetCurrency} ({selectedTargetMeta?.symbol || settings.targetCurrency})
                        </span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-0" align="end">
                      <Command>
                        <CommandInput
                          placeholder="Search currencies by code or name..."
                          value={targetSearch}
                          onValueChange={setTargetSearch}
                          className="h-9 text-xs"
                        />
                        <CommandList>
                          <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            No currency found.
                          </CommandEmpty>
                          <CommandGroup heading="Currencies">
                            <ScrollArea className="h-60">
                              {filteredTargetCurrencies.map((c) => (
                                <CommandItem
                                  key={c.code}
                                  data-currency-code={c.code}
                                  value={`${c.code} ${c.name} ${c.symbol}`}
                                  onSelect={() => {
                                    updateSettings(
                                      { targetCurrency: c.code, lastUsedTarget: c.code },
                                      `Target currency set to ${c.code}`
                                    );
                                    setTargetComboboxOpen(false);
                                  }}
                                  onClick={() => {
                                    updateSettings(
                                      { targetCurrency: c.code, lastUsedTarget: c.code },
                                      `Target currency set to ${c.code}`
                                    );
                                    setTargetComboboxOpen(false);
                                  }}
                                  className="text-xs font-mono flex items-center justify-between py-1.5 cursor-pointer"
                                >
                                  <div className="flex items-center min-w-0">
                                    <Check
                                      className={`mr-2 h-3.5 w-3.5 shrink-0 ${
                                        settings.targetCurrency === c.code
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
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
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Separator />

                {/* Ambiguous Dollar Default */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium text-foreground">
                      Ambiguous "$" Symbol Default
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Default currency when a bare "$" has no page or domain context.
                    </p>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="select-ambiguous-dollar"
                        variant="outline"
                        role="combobox"
                        aria-label="Ambiguous dollar currency default"
                        className="w-[200px] justify-between font-mono text-xs h-9 bg-background"
                      >
                        <span>{settings.ambiguousDollar} — {getCurrencyMeta(settings.ambiguousDollar)?.name || "Dollar"}</span>
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-0" align="end">
                      <Command>
                        <CommandList>
                          <CommandGroup heading="Dollar Currencies">
                            {DOLLAR_CURRENCIES.map((code) => {
                              const meta = getCurrencyMeta(code);
                              return (
                                <CommandItem
                                  key={code}
                                  data-currency-code={code}
                                  value={code}
                                  onSelect={() => {
                                    updateSettings({ ambiguousDollar: code });
                                  }}
                                  onClick={() => {
                                    updateSettings({ ambiguousDollar: code });
                                  }}
                                  className="text-xs font-mono flex items-center justify-between py-1.5 cursor-pointer"
                                >
                                  <div className="flex items-center">
                                    <Check
                                      className={`mr-2 h-3.5 w-3.5 ${
                                        settings.ambiguousDollar === code
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                    <span>{code}</span>
                                    <span className="ml-2 font-sans text-muted-foreground">
                                      {meta?.symbol}
                                    </span>
                                  </div>
                                  <span className="text-muted-foreground text-[11px] truncate max-w-[80px]">
                                    {meta?.name}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Separator />

                {/* Default for sites without a rule */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium text-foreground">
                      Default for sites without a rule
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Choose whether unconfigured websites should prompt with an offer (Ask) or convert automatically (Always).
                    </p>
                  </div>

                  <ToggleGroup
                    type="single"
                    value={settings.autoConvertAll ? "always" : "ask"}
                    onValueChange={async (val) => {
                      if (!val) return;
                      const isAlways = val === "always";
                      if (isAlways && api?.permissions?.request) {
                        try {
                          const granted = await new Promise((resolve) => {
                            api.permissions.request({ origins: ["<all_urls>"] }, resolve);
                          });
                          if (!granted) {
                            toast.error("Permission not granted", {
                              description: "Cannot enable Always without permissions.",
                            });
                            return;
                          }
                        } catch {}
                      }
                      updateSettings(
                        { autoConvertAll: isAlways },
                        `Default site behavior set to ${isAlways ? "Always" : "Ask"}`
                      );
                    }}
                    className="bg-secondary p-0.5 rounded-lg border border-border shrink-0"
                    aria-label="Default site behavior"
                  >
                    <ToggleGroupItem value="ask" aria-label="Default Ask" className="h-8 px-3 text-xs">
                      Ask
                    </ToggleGroupItem>
                    <ToggleGroupItem value="always" aria-label="Default Always" className="h-8 px-3 text-xs">
                      Always
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <Separator />

                {/* Show in-page pill */}
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5 pr-4">
                    <Label
                      htmlFor="switch-show-pill"
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      Show in-page pill
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Display the OLED Dynamic Island capsule at the top of web pages when prices are converted.
                    </p>
                  </div>
                  <Switch
                    id="switch-show-pill"
                    checked={settings.showInPageBar !== false}
                    onCheckedChange={(checked) => updateSettings({ showInPageBar: checked })}
                  />
                </div>
                <Separator />

                {/* Round to whole numbers */}
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5 pr-4">
                    <Label
                      htmlFor="switch-round-whole"
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      Round to whole numbers
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Omit decimal fractions on converted amounts (e.g. $25 instead of $25.43).
                    </p>
                  </div>
                  <Switch
                    id="switch-round-whole"
                    checked={Boolean(settings.roundWhole)}
                    onCheckedChange={(checked) => updateSettings({ roundWhole: checked })}
                  />
                </div>
                <Separator />

                {/* Show cryptocurrencies */}
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5 pr-4">
                    <Label
                      htmlFor="switch-show-crypto"
                      className="text-sm font-medium text-foreground cursor-pointer"
                    >
                      Show cryptocurrencies
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Include major crypto assets (BTC, ETH, SOL, DOGE) in currency selection menus.
                    </p>
                  </div>
                  <Switch
                    id="switch-show-crypto"
                    checked={Boolean(settings.showCrypto)}
                    onCheckedChange={(checked) => updateSettings({ showCrypto: checked })}
                  />
                </div>
              </div>
            )}

            {/* SECTION 2: CURRENCIES */}
            {currentSection === "currencies" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Pinned Currencies</h2>
                      <p className="text-xs text-muted-foreground">
                        Pinned currencies appear in the right-click menu and top of the quick converter.
                      </p>
                    </div>
                    <Badge
                      variant={settings.pinnedCurrencies.length >= 8 ? "destructive" : "secondary"}
                      className="font-mono text-xs"
                    >
                      {settings.pinnedCurrencies.length} of 8
                    </Badge>
                  </div>

                  {/* Chips container */}
                  <div
                    className="flex flex-wrap gap-2 p-3 bg-secondary/30 rounded-lg border border-border min-h-[48px] items-center"
                    aria-label="Pinned currencies list"
                  >
                    {settings.pinnedCurrencies.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No pinned currencies. Use the combobox or quick suggestions below to pin currencies.
                      </span>
                    ) : (
                      settings.pinnedCurrencies.map((code) => {
                        const meta = getCurrencyMeta(code);
                        return (
                          <div
                            key={code}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary border border-border text-xs text-foreground"
                          >
                            <span className="font-mono font-semibold">{code}</span>
                            {meta?.symbol && (
                              <span className="text-muted-foreground">({meta.symbol})</span>
                            )}
                            <button
                              type="button"
                              aria-label={`Remove ${code} from pinned`}
                              onClick={() => handleRemovePinned(code)}
                              className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Limit message */}
                  {settings.pinnedCurrencies.length >= 8 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Maximum 8 pinned currencies reached. Remove a currency to add another.
                    </p>
                  )}
                </div>
                <Separator />

                {/* Add pinned currency combobox */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">Add to Pinned</Label>
                  <div className="flex gap-3">
                    <Popover
                      open={pinnedComboboxOpen}
                      onOpenChange={(open) => {
                        setPinnedComboboxOpen(open);
                        if (!open) setPinnedSearch("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="select-add-pinned"
                          variant="outline"
                          role="combobox"
                          disabled={settings.pinnedCurrencies.length >= 8}
                          aria-label="Add currency to pinned"
                          className="w-[260px] justify-between font-mono text-xs h-9 bg-background"
                        >
                          <span>
                            {settings.pinnedCurrencies.length >= 8
                              ? "Pinned limit reached (8 max)"
                              : "Search currency to pin..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[260px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Type currency code or name..."
                            value={pinnedSearch}
                            onValueChange={setPinnedSearch}
                            className="h-9 text-xs"
                          />
                          <CommandList>
                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                              No unpinned currency found.
                            </CommandEmpty>
                            <CommandGroup heading="Unpinned Currencies">
                              <ScrollArea className="h-56">
                                {availableUnpinnedCurrencies.map((c) => (
                                  <CommandItem
                                    key={c.code}
                                    data-currency-code={c.code}
                                    value={`${c.code} ${c.name} ${c.symbol}`}
                                    onSelect={() => handleAddPinned(c.code)}
                                    onClick={() => handleAddPinned(c.code)}
                                    className="text-xs font-mono flex items-center justify-between py-1.5 cursor-pointer"
                                  >
                                    <div className="flex items-center min-w-0">
                                      <span className="font-semibold">{c.code}</span>
                                      <span className="ml-2 font-sans text-muted-foreground truncate max-w-[120px]">
                                        {c.name}
                                      </span>
                                    </div>
                                    <span className="font-sans font-bold ml-1">{c.symbol}</span>
                                  </CommandItem>
                                ))}
                              </ScrollArea>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Quick suggestions */}
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground block">Quick add frequent currencies:</span>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_PINNED.map((code) => {
                      const isPinned = settings.pinnedCurrencies.includes(code);
                      if (isPinned) return null;
                      return (
                        <Button
                          key={code}
                          variant="secondary"
                          size="sm"
                          disabled={settings.pinnedCurrencies.length >= 8}
                          onClick={() => handleAddPinned(code)}
                          className="h-7 text-xs font-mono"
                          aria-label={`Quick pin ${code}`}
                        >
                          {code}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: SITES */}
            {currentSection === "sites" && (
              <div className="space-y-6">
                {/* Add Site Inline Row */}
                <form onSubmit={handleAddSiteRule} className="space-y-2">
                  <Label htmlFor="input-new-site" className="text-sm font-medium text-foreground">
                    Add Site Rule
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Configure domain-specific automatic conversion behavior and native currency.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Input
                      id="input-new-site"
                      aria-label="Domain name"
                      placeholder="Domain (e.g. amazon.de or asos.com)"
                      value={newSiteDomain}
                      aria-invalid={Boolean(newSiteError)}
                      aria-describedby={newSiteError ? "new-site-error-msg" : undefined}
                      onChange={(e) => {
                        setNewSiteDomain(e.target.value);
                        if (newSiteError) setNewSiteError("");
                      }}
                      className="font-mono text-xs h-9 bg-background flex-1"
                    />

                    <ToggleGroup
                      type="single"
                      value={newSiteMode}
                      onValueChange={(val) => val && setNewSiteMode(val)}
                      className="bg-secondary p-0.5 rounded-lg border border-border shrink-0"
                      aria-label="New rule conversion mode"
                    >
                      <ToggleGroupItem value="ask" aria-label="Mode Ask" className="h-8 px-2.5 text-xs">
                        Ask
                      </ToggleGroupItem>
                      <ToggleGroupItem value="always" aria-label="Mode Always" className="h-8 px-2.5 text-xs">
                        Always
                      </ToggleGroupItem>
                      <ToggleGroupItem value="never" aria-label="Mode Never" className="h-8 px-2.5 text-xs">
                        Never
                      </ToggleGroupItem>
                    </ToggleGroup>

                    <Button
                      type="submit"
                      size="sm"
                      aria-label="Add site"
                      className="h-9 text-xs px-3 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                      Add site
                    </Button>
                  </div>
                  {newSiteError && (
                    <p
                      id="new-site-error-msg"
                      role="alert"
                      className="text-xs text-destructive font-medium flex items-center gap-1 pt-1"
                    >
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {newSiteError}
                    </p>
                  )}
                </form>
                <Separator />

                {/* Filter and Rules Count */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-sm font-semibold text-foreground">Configured Rules</h2>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {perSiteEntries.length} {perSiteEntries.length === 1 ? "rule" : "rules"}
                    </Badge>
                  </div>
                  {perSiteEntries.length > 3 && (
                    <div className="w-48">
                      <Input
                        placeholder="Filter domains..."
                        value={rulesSearch}
                        onChange={(e) => setRulesSearch(e.target.value)}
                        className="h-8 text-xs font-mono"
                        aria-label="Filter rules list by domain"
                      />
                    </div>
                  )}
                </div>

                {/* Plain List of Site Rules with 1px Hairlines (NO BORDERED BOXES) */}
                <div className="divide-y divide-border border-y border-border">
                  {perSiteEntries.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm space-y-1">
                      <p className="font-medium text-foreground">No custom site rules configured.</p>
                      <p className="text-xs">
                        Websites default to {settings.autoConvertAll ? "Always" : "Ask"} unless customized here or via the extension popup.
                      </p>
                    </div>
                  ) : filteredSiteEntries.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No rules match "{rulesSearch}".
                    </div>
                  ) : (
                    filteredSiteEntries.map(([host, rule]) => (
                      <div
                        key={host}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-sm font-medium text-foreground truncate max-w-[240px]">
                                {host}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="font-mono text-xs">{host}</TooltipContent>
                          </Tooltip>
                          {!rule.mode && (
                            <span className="text-xs text-muted-foreground mt-0.5">
                              Uses default ({settings.autoConvertAll ? "Always" : "Ask"})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {/* Three-way segmented control */}
                          <ToggleGroup
                            type="single"
                            value={rule.mode || ""}
                            onValueChange={(val) => {
                              if (!val) return;
                              handleUpdateSiteMode(host, val);
                            }}
                            className="bg-secondary p-0.5 rounded-lg border border-border"
                            aria-label={`Conversion mode for ${host}`}
                          >
                            <ToggleGroupItem
                              value="ask"
                              aria-label={`Ask on ${host}`}
                              className="text-xs h-7 px-2"
                            >
                              Ask
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="always"
                              aria-label={`Always convert ${host}`}
                              className="text-xs h-7 px-2"
                            >
                              Always
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="never"
                              aria-label={`Never convert ${host}`}
                              className="text-xs h-7 px-2"
                            >
                              Never
                            </ToggleGroupItem>
                          </ToggleGroup>

                          {/* Reset mode to default if an explicit mode is set */}
                          {rule.mode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => handleResetSiteMode(host)}
                              title="Reset mode to default"
                              aria-label={`Reset ${host} mode to default`}
                            >
                              Reset
                            </Button>
                          )}

                          {/* Assumed Currency Combobox */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs font-mono bg-background"
                                aria-label={`Assumed currency for ${host}`}
                              >
                                {rule.assumedCurrency || "Auto"}
                                <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-0" align="end">
                              <Command>
                                <CommandInput
                                  placeholder="Assumed currency..."
                                  className="h-8 text-xs font-mono"
                                />
                                <CommandList>
                                  <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                                    None found
                                  </CommandEmpty>
                                  <CommandGroup>
                                    <CommandItem
                                      onSelect={() => handleSetAssumedCurrency(host, null)}
                                      className="text-xs py-1.5"
                                    >
                                      <Check
                                        className={`mr-2 h-3.5 w-3.5 ${
                                          !rule.assumedCurrency ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      <span>Auto-detect</span>
                                    </CommandItem>
                                    <ScrollArea className="h-48">
                                      {allCurrencies.map((c) => (
                                        <CommandItem
                                          key={c.code}
                                          value={`${c.code} ${c.name}`}
                                          onSelect={() => handleSetAssumedCurrency(host, c.code)}
                                          className="text-xs font-mono py-1.5 flex items-center justify-between"
                                        >
                                          <div className="flex items-center">
                                            <Check
                                              className={`mr-2 h-3.5 w-3.5 ${
                                                rule.assumedCurrency === c.code
                                                  ? "opacity-100"
                                                  : "opacity-0"
                                              }`}
                                            />
                                            <span>{c.code}</span>
                                          </div>
                                          <span className="text-muted-foreground text-xs">
                                            {c.symbol}
                                          </span>
                                        </CommandItem>
                                      ))}
                                    </ScrollArea>
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {/* Ghost Remove button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveSiteRule(host)}
                            aria-label={`Remove rule for ${host}`}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* SECTION 4: APPEARANCE */}
            {currentSection === "appearance" && (
              <div className="space-y-6">
                {/* Theme Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium text-foreground">Theme</Label>
                    <p className="text-xs text-muted-foreground">
                      Choose between light paper, dark night canvas, or follow system appearance.
                    </p>
                  </div>

                  <ToggleGroup
                    type="single"
                    value={settings.theme}
                    onValueChange={(val) => val && updateSettings({ theme: val })}
                    className="bg-secondary p-0.5 rounded-lg border border-border shrink-0"
                    aria-label="Theme selector"
                  >
                    <ToggleGroupItem value="light" aria-label="Light theme" className="h-8 px-3 text-xs">
                      <Sun className="h-3.5 w-3.5 mr-1.5" /> Light
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dark" aria-label="Dark theme" className="h-8 px-3 text-xs">
                      <Moon className="h-3.5 w-3.5 mr-1.5" /> Dark
                    </ToggleGroupItem>
                    <ToggleGroupItem value="system" aria-label="System theme" className="h-8 px-3 text-xs">
                      <Laptop className="h-3.5 w-3.5 mr-1.5" /> System
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <Separator />

                {/* Display Mode */}
                <div className="space-y-3 py-2">
                  <Label className="text-sm font-medium text-foreground">Display Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Choose how converted prices are rendered directly on host web pages.
                  </p>

                  <div role="radiogroup" aria-label="Display mode" className="space-y-2 pt-1">
                    {[
                      {
                        value: "replace",
                        title: "Replace original price",
                        desc: "Replaces original price text in-place with native currency; hover displays original in tooltip.",
                      },
                      {
                        value: "append",
                        title: "Append converted price",
                        desc: "Displays converted amount alongside original price (e.g. $20.00 ≈ ₦30,512).",
                      },
                      {
                        value: "replace_highlight",
                        title: "Replace and highlight",
                        desc: "Replaces price and applies a subtle highlight background to converted figures.",
                      },
                    ].map((opt) => (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={settings.displayMode === opt.value}
                        key={opt.value}
                        onClick={() => updateSettings({ displayMode: opt.value })}
                        className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          settings.displayMode === opt.value
                            ? "border-accent bg-secondary/50"
                            : "border-border hover:bg-secondary/20"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{opt.title}</span>
                          {settings.displayMode === opt.value && (
                            <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: DATA */}
            {currentSection === "data" && (
              <div className="space-y-6">
                {/* Export JSON */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium text-foreground">Export Settings</Label>
                    <p className="text-xs text-muted-foreground">
                      Download a complete backup of your preferences, site rules, and pinned currencies.
                    </p>
                  </div>
                  <Button
                    id="btn-export-settings"
                    variant="outline"
                    onClick={handleExportJson}
                    className="text-xs h-9 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export Settings JSON
                  </Button>
                </div>
                <Separator />

                {/* Import JSON */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium text-foreground">Import Settings</Label>
                    <p className="text-xs text-muted-foreground">
                      Restore preferences from a previously exported backup file.
                    </p>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={importFileInputRef}
                      id="input-import-settings"
                      accept=".json"
                      onChange={handleImportJson}
                      style={{ display: "none" }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => importFileInputRef.current?.click()}
                      className="text-xs h-9 shrink-0"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Import Settings JSON
                    </Button>
                  </div>
                </div>
                <Separator />

                {/* Reset Defaults */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium text-foreground">Reset to Defaults</Label>
                    <p className="text-xs text-muted-foreground">
                      Reset all preferences, delete custom site rules, and restore factory defaults.
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button id="btn-reset-defaults" variant="destructive" className="text-xs h-9 shrink-0">
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Reset Defaults...
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reset All Preferences to Defaults?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete all custom per-site conversion rules, reset your pinned currencies list, and return all settings to factory defaults. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          id="btn-confirm-reset"
                          variant="destructive"
                          onClick={handleResetDefaults}
                        >
                          Reset Everything
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* SECTION 6: ABOUT */}
            {currentSection === "about" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">Extension Version</h2>
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version:</span>
                      <span className="font-semibold text-foreground">
                        {typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "2.0.0"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Git Commit:</span>
                      <span className="text-foreground">
                        {typeof __BUILD_GIT_SHA__ !== "undefined" ? __BUILD_GIT_SHA__ : "dev"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Build Timestamp:</span>
                      <span className="text-foreground">
                        {typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "development"}
                      </span>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Exchange Rates Metadata */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">Exchange Rate Providers</h2>
                  <p className="text-xs text-muted-foreground">
                    Exchange rates are cached locally for 6 hours using a 3-tier resilient fallback architecture.
                  </p>
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Primary Tier:</span>
                      <span className="font-medium">European Central Bank (Frankfurter API)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Secondary Tier:</span>
                      <span className="font-medium">Fawaz Ahmed Currency API (jsDelivr CDN)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Fallback Tier:</span>
                      <span className="font-medium">Cloudflare Pages Hosted Mirror</span>
                    </div>
                    {ratesInfo && ratesInfo.timestamp && (
                      <div className="flex items-center justify-between pt-1 border-t border-border font-mono text-[11px]">
                        <span className="text-muted-foreground">Last Updated:</span>
                        <span>{new Date(ratesInfo.timestamp).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />

                {/* Keyboard Shortcut */}
                <div className="flex items-center justify-between py-1">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium text-foreground">Keyboard Shortcut</Label>
                    <p className="text-xs text-muted-foreground">
                      Toggle currency conversion on the active browser tab.
                    </p>
                  </div>
                  <kbd className="px-2.5 py-1 text-xs font-mono font-semibold bg-secondary border border-border rounded shadow-sm text-foreground">
                    {shortcutKey}
                  </kbd>
                </div>
                <Separator />

                {/* Links */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">Privacy & Source Code</h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href="https://github.com/richmondsogo/currency-converter-v2/blob/main/PRIVACY_POLICY.md"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition-colors"
                    >
                      <span>Privacy Policy</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                    <a
                      href="https://github.com/richmondsogo/currency-converter-v2"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary/40 transition-colors"
                    >
                      <span>GitHub Repository</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        <Toaster position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<OptionsApp />);
}
