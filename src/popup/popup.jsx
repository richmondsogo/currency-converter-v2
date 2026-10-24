// src/popup/popup.jsx
import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import { Separator } from "@/ui/components/ui/separator";
import { SiteModeControl } from "@/ui/components/SiteModeControl";
import { CurrencyCombobox } from "@/ui/components/CurrencyCombobox";
import { getEffectiveSiteCaption } from "@/ui/lib/site-rules";
import {
  Clock,
  Settings as SettingsIcon,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Check,
} from "lucide-react";
import { getAllCurrencies, getCurrencyMeta } from "../shared/currencies.js";
import { MSG } from "../shared/messaging.js";
import {
  sendMessage,
  sendTabMessage,
  getActiveTab,
  requestOriginPermission,
  ensureInjected,
  injectContentScript,
  getBrowser,
} from "../shared/browser.js";
import {
  getSiteMode,
  setSiteMode,
  normalizeHost,
  DEFAULT_SETTINGS,
} from "../shared/settings.js";
import {
  classifyConversionError,
  getConversionErrorMessage,
  isRestrictedPage,
  isRestrictedUrl,
} from "./popup-errors.js";
import { applyTheme, subscribeSystemTheme } from "../shared/theme.js";

const api = getBrowser();

function openOptionsPage(e) {
  if (e) e.preventDefault();
  if (api && api.runtime && api.runtime.openOptionsPage) {
    api.runtime.openOptionsPage();
  } else if (api && api.tabs && api.tabs.create) {
    api.tabs.create({ url: api.runtime.getURL("options/options.html") });
  }
}

export function PopupApp() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState(null);
  const [hostname, setHostname] = useState("");
  const [origin, setOrigin] = useState("");
  const [isRestricted, setIsRestricted] = useState(false);

  // Active page target currency (page-only override, does NOT write to settings.targetCurrency)
  const [pageTargetCurrency, setPageTargetCurrency] = useState("USD");
  const [isPageConverted, setIsPageConverted] = useState(false);
  const [converting, setConverting] = useState(false);

  // Live status
  const [statusMessage, setStatusMessage] = useState("Ready to convert");
  const [statusType, setStatusType] = useState("ready"); // "ready" | "converting" | "converted" | "error"

  // Rates & Shortcuts metadata
  const [ratesInfo, setRatesInfo] = useState(null);
  const [ratesError, setRatesError] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [shortcutKey, setShortcutKey] = useState("Alt+Shift+C");

  // Site rule local state
  const [siteMode, setSiteModeState] = useState(""); // explicit "ask"|"always"|"never" or ""
  const [assumedCurrency, setAssumedCurrencyState] = useState(null);

  // Fetch rates
  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError(false);
    try {
      const res = await sendMessage({ type: MSG.GET_RATES });
      if (res && res.rates) {
        setRatesInfo(res);
        setRatesError(false);
      } else {
        setRatesError(true);
      }
    } catch (e) {
      console.warn("[Popup] Failed to fetch rates:", e);
      setRatesError(true);
    } finally {
      setRatesLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      // Load independent extension state concurrently. Resolving the page target must
      // not wait on a network-backed rates request: Firefox can keep that request in
      // flight long enough for a user to click Convert before currentTab is set.
      const ratesP = loadRates();
      const settingsP = (async () => {
        try {
          const loaded = await sendMessage({ type: MSG.GET_SETTINGS });
          if (loaded) {
            setSettings(loaded);
            applyTheme(loaded.theme);
            if (loaded.targetCurrency) {
              setPageTargetCurrency(loaded.targetCurrency);
            }
            return loaded;
          }
        } catch (e) {
          console.warn("[Popup] Failed to load settings:", e);
        }
        return DEFAULT_SETTINGS;
      })();

      const tabP = getActiveTab().catch((error) => {
        console.warn("[Popup] Could not get active tab:", error);
        return null;
      });

      const [loadedSettings, tab] = await Promise.all([settingsP, tabP]);

      // 2. Query keyboard shortcut
      try {
        if (api && api.commands && api.commands.getAll) {
          api.commands.getAll((commands) => {
            const cmd = commands.find((c) => c.name === "toggle-page-conversion");
            if (cmd && cmd.shortcut) {
              setShortcutKey(cmd.shortcut);
            }
          });
        }
      } catch (e) {
        console.warn("[Popup] Could not query commands:", e);
      }

      // 3. Retain the active page before rates have finished loading.
      setCurrentTab(tab);

      const tabUrl = tab?.url || "";
      const restricted = isRestrictedPage(tabUrl);
      setIsRestricted(restricted);

      if (restricted) {
        setStatusType("ready");
        setStatusMessage("Extension permissions do not apply here");
        setLoading(false);
        return;
      }

      let host = "";
      let orig = "";
      if (tabUrl) {
        try {
          const parsed = new URL(tabUrl);
          host = parsed.hostname.replace(/^www\./, "");
          orig = parsed.origin;
          setHostname(host);
          setOrigin(orig);
        } catch {
          host = "";
          setHostname("");
        }
      }

      // 4. Initialize site rules from settings
      if (host && loadedSettings) {
        const norm = normalizeHost(host);
        const rule = (loadedSettings.perSite && loadedSettings.perSite[norm]) || {};
        setSiteModeState(rule.mode || "");
        setAssumedCurrencyState(rule.assumedCurrency || null);
      }

      // 5. Query active page conversion status
      if (tab && tab.id) {
        try {
          let status = await sendTabMessage(tab.id, { type: MSG.GET_PAGE_STATUS });
          if (!status) {
            await injectContentScript(tab.id);
            await new Promise((r) => setTimeout(r, 100));
            status = await sendTabMessage(tab.id, { type: MSG.GET_PAGE_STATUS });
          }

          if (status && status.isConverted) {
            setIsPageConverted(true);
            setStatusType("converted");
            setStatusMessage(
              `${status.count} prices converted to ${status.targetCurrency || "USD"}`
            );
            if (status.targetCurrency) {
              setPageTargetCurrency(status.targetCurrency);
            }
          } else {
            setIsPageConverted(false);
            setStatusType("ready");
            setStatusMessage("Ready to convert");
          }
        } catch (e) {
          setIsPageConverted(false);
          setStatusType("ready");
          setStatusMessage("Ready to convert");
        }
      }

      setLoading(false);
      // The request intentionally continues in the background. The converter can use
      // its result when ready or fetch it on demand when the user acts immediately.
      void ratesP;
    }

    init();
  }, [loadRates]);

  // Live system theme listener when theme is set to 'system'
  useEffect(() => {
    if (!settings || settings.theme !== "system") return;
    return subscribeSystemTheme(() => {
      applyTheme("system");
    });
  }, [settings?.theme]);

  // Sync settings when storage changes
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if ((area === "local" || area === "sync") && changes.currency_converter_settings_v2) {
        const next = changes.currency_converter_settings_v2.newValue;
        if (next) {
          setSettings(next);
          applyTheme(next.theme);
          if (hostname) {
            const norm = normalizeHost(hostname);
            const rule = (next.perSite && next.perSite[norm]) || {};
            setSiteModeState(rule.mode || "");
            setAssumedCurrencyState(rule.assumedCurrency || null);
          }
        }
      }
    };

    if (api && api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener(handleStorageChange);
      return () => api.storage.onChanged.removeListener(handleStorageChange);
    }
  }, [hostname]);

  // Handle conversion action
  const triggerConvert = useCallback(
    async (targetCur) => {
      // A toolbar popup can become interactive before its asynchronous initialization
      // completes. Re-resolve the page instead of silently ignoring the click.
      const activeTab = currentTab?.id ? currentTab : await getActiveTab();
      if (!activeTab?.id) {
        setStatusType("error");
        setStatusMessage("Could not find an open web page to convert");
        return;
      }
      if (!currentTab?.id) {
        setCurrentTab(activeTab);
      }
      if (isRestricted || isRestrictedPage(activeTab.url)) {
        setStatusType("error");
        setStatusMessage("Cannot run on browser system pages");
        return;
      }

      setConverting(true);
      setStatusType("converting");
      setStatusMessage("Scanning and converting...");

      try {
        const injected = await ensureInjected(activeTab.id);
        if (!injected) {
          throw new Error("Could not prepare this page for conversion");
        }

        const ratesData = ratesInfo || (await sendMessage({ type: MSG.GET_RATES }));
        const activeHostname = hostname || new URL(activeTab.url).hostname.replace(/^www\./, "");
        const norm = normalizeHost(activeHostname);
        const siteRule = settings?.perSite && settings.perSite[norm];

        const convertPayload = {
          manual: true,
          targetCurrency: targetCur,
          ratesTable: ratesData ? ratesData.rates : null,
          rateDate: ratesData ? ratesData.date : null,
          provider: ratesData ? ratesData.provider : null,
          displayMode: settings?.displayMode || "replace",
          roundWhole: settings?.roundWhole || false,
          showInPageBar: settings?.showInPageBar !== false,
          siteOverride: assumedCurrency || siteRule?.assumedCurrency || null,
        };

        let response = null;
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            response = await sendTabMessage(activeTab.id, {
              type: MSG.CONVERT_PAGE,
              payload: convertPayload,
            });
            if (response) break;
          } catch {}
          if (attempt === 1) {
            await injectContentScript(activeTab.id);
          }
          await new Promise((r) => setTimeout(r, 90 * (2 ** (attempt - 1))));
        }

        if (response && response.success) {
          const count =
            response.convertedCount !== undefined
              ? response.convertedCount
              : response.count;
          if (count === 0 || response.alreadyTarget) {
            setIsPageConverted(false);
            setStatusType("ready");
            setStatusMessage(`Page is already in ${targetCur}`);
          } else {
            setIsPageConverted(true);
            setStatusType("converted");
            const providerStr = ratesData?.provider || "ECB";
            setStatusMessage(`${count} prices converted · Rates: ${providerStr}`);
          }
        } else {
          setIsPageConverted(false);
          setStatusType("error");
          const errorClass = classifyConversionError({
            isRestricted: false,
            hasHostPermission: true,
            ratesAvailable: Boolean(ratesData?.rates),
            hasResponse: Boolean(response),
            rawError: response?.error,
          });
          setStatusMessage(
            getConversionErrorMessage(errorClass, response?.error ? `Conversion error: ${response.error}` : null)
          );
        }
      } catch (err) {
        setIsPageConverted(false);
        setStatusType("error");
        setStatusMessage(`Error: ${err.message}`);
      } finally {
        setConverting(false);
      }
    },
    [currentTab, isRestricted, hostname, settings, ratesInfo, assumedCurrency]
  );

  const triggerRevert = useCallback(async () => {
    if (!currentTab || !currentTab.id) return;
    setConverting(true);
    setStatusType("converting");
    setStatusMessage("Restoring original prices...");

    try {
      let response = await sendTabMessage(currentTab.id, { type: MSG.REVERT_PAGE });
      if (!response) {
        await injectContentScript(currentTab.id);
        await new Promise((r) => setTimeout(r, 100));
        response = await sendTabMessage(currentTab.id, { type: MSG.REVERT_PAGE });
      }

      if (response && response.success) {
        setIsPageConverted(false);
        setStatusType("ready");
        setStatusMessage("Showing original prices");
      } else {
        setStatusType("error");
        setStatusMessage("Could not restore original prices");
      }
    } catch (err) {
      setStatusType("error");
      setStatusMessage("Error restoring prices");
    } finally {
      setConverting(false);
    }
  }, [currentTab]);

  const handleConvertToggle = () => {
    if (isPageConverted) {
      triggerRevert();
    } else {
      triggerConvert(pageTargetCurrency);
    }
  };

  // Change active page target currency (page-only, never writes to settings.targetCurrency)
  const handlePageTargetCurrencyChange = (newCode) => {
    if (!newCode || newCode === pageTargetCurrency) return;
    setPageTargetCurrency(newCode);
    if (isPageConverted) {
      triggerConvert(newCode);
    }
  };

  // Site mode changes
  const handleSiteModeChange = async (newMode) => {
    if (!hostname || !settings) return;
    if (newMode === "always") {
      const granted = await requestOriginPermission(origin);
      if (!granted) {
        setStatusType("error");
        setStatusMessage("Permission denied for this site");
        return;
      }
    }

    const norm = normalizeHost(hostname);
    const updatedPerSite = { ...(settings.perSite || {}) };
    setSiteMode({ perSite: updatedPerSite }, hostname, newMode);
    setSiteModeState(newMode);

    try {
      await sendMessage({
        type: MSG.UPDATE_SETTINGS,
        payload: { perSite: updatedPerSite },
      });
      setSettings((prev) => ({ ...prev, perSite: updatedPerSite }));
    } catch (err) {
      console.warn("[Popup] Failed to update site mode:", err);
    }
  };

  const handleResetSiteMode = async () => {
    if (!hostname || !settings) return;
    const norm = normalizeHost(hostname);
    const updatedPerSite = { ...(settings.perSite || {}) };
    setSiteMode({ perSite: updatedPerSite }, hostname, null);
    setSiteModeState("");

    try {
      await sendMessage({
        type: MSG.UPDATE_SETTINGS,
        payload: { perSite: updatedPerSite },
      });
      setSettings((prev) => ({ ...prev, perSite: updatedPerSite }));
    } catch (err) {
      console.warn("[Popup] Failed to reset site mode:", err);
    }
  };

  // Site assumed currency changes
  const handleAssumedCurrencyChange = async (currency) => {
    if (!hostname || !settings) return;
    const norm = normalizeHost(hostname);
    const updatedPerSite = { ...(settings.perSite || {}) };
    if (!updatedPerSite[norm]) updatedPerSite[norm] = {};
    updatedPerSite[norm] = {
      ...updatedPerSite[norm],
      assumedCurrency: currency || null,
    };
    setAssumedCurrencyState(currency || null);

    try {
      await sendMessage({
        type: MSG.UPDATE_SETTINGS,
        payload: { perSite: updatedPerSite },
      });
      setSettings((prev) => ({ ...prev, perSite: updatedPerSite }));
    } catch (err) {
      console.warn("[Popup] Failed to update assumed currency:", err);
    }
  };

  const allCurrencies = useMemo(() => {
    return getAllCurrencies({ includeCrypto: Boolean(settings?.showCrypto) }).sort(
      (a, b) => a.code.localeCompare(b.code)
    );
  }, [settings?.showCrypto]);

  const pinnedCodes = useMemo(() => {
    return settings?.pinnedCurrencies || ["USD", "EUR", "GBP", "JPY"];
  }, [settings?.pinnedCurrencies]);

  const effectiveCaption = useMemo(() => {
    const autoConvertAll = Boolean(settings?.autoConvertAll);
    const norm = normalizeHost(hostname);
    const rule = settings?.perSite && settings.perSite[norm];
    return getEffectiveSiteCaption(rule, autoConvertAll);
  }, [settings, hostname]);

  // Rates text display
  const ratesFreshnessText = useMemo(() => {
    if (ratesLoading) return "Rates: Updating...";
    if (ratesError || !ratesInfo) return "Rates: Unavailable";
    const provider = ratesInfo.provider || "ECB";
    const date = ratesInfo.date || "Today";
    const staleNotice = ratesInfo.isStale ? " (cached)" : "";
    return `Rates: ${provider}, ${date}${staleNotice}`;
  }, [ratesLoading, ratesError, ratesInfo]);

  return (
    <div className="w-[360px] max-h-[560px] overflow-y-auto bg-background text-foreground font-sans p-4 flex flex-col gap-3.5 select-none selection:bg-accent/20">
      {/* 1. Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <span
            className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-xs shadow-sm"
            aria-hidden="true"
          >
            fx
          </span>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm tracking-tight text-foreground">
              Currency Convertr
            </span>
          </div>
        </div>

        <Button
          id="btn-open-options"
          variant="ghost"
          size="icon"
          onClick={openOptionsPage}
          title="Settings & Options"
          aria-label="Open settings"
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
        >
          <SettingsIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {/* 2. Unsupported / Restricted Notice */}
      {isRestricted && (
        <div
          id="unsupported-notice"
          className="rounded-lg bg-secondary/80 border border-border p-3 text-xs text-muted-foreground flex items-start gap-2.5"
        >
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <span className="leading-relaxed">
            Price conversion is unavailable on browser system or restricted extension pages.
          </span>
        </div>
      )}

      {/* 3. Main Controls */}
      <main id="main-controls" className="flex flex-col gap-3.5">
        {/* Converter / Target Currency Block */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground uppercase tracking-wider text-[11px]">
              Convert this page to
            </span>
            {pageTargetCurrency === settings?.targetCurrency && (
              <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                Default
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center shrink-0">
              <span
                id="from-display"
                className="h-9 px-2.5 rounded-md bg-secondary border border-border flex items-center text-xs font-mono text-muted-foreground"
              >
                Auto-detect
              </span>
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />

            <div className="flex-1 min-w-0">
              <CurrencyCombobox
                triggerId="picker-to-btn"
                searchInputId="currency-search-input"
                value={pageTargetCurrency}
                onChange={handlePageTargetCurrencyChange}
                currencies={allCurrencies}
                ariaLabel="Select target currency for this page"
                align="end"
                disabled={isRestricted}
                className="w-full h-9 font-mono text-xs"
                placeholder="Search code or name..."
              />
            </div>
          </div>

          {/* Pinned Currencies Quick Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-muted-foreground mr-0.5">Quick:</span>
            {pinnedCodes.map((code) => {
              const isSelected = pageTargetCurrency === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => handlePageTargetCurrencyChange(code)}
                  disabled={isRestricted}
                  aria-pressed={isSelected}
                  className={`h-6 px-2 text-[11px] font-mono rounded-md border transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                      : "bg-secondary text-foreground border-border hover:bg-secondary/70 font-normal"
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Action Button */}
        <Button
          id="btn-convert-toggle"
          type="button"
          disabled={converting || isRestricted}
          onClick={handleConvertToggle}
          className={`w-full h-10 text-xs font-semibold tracking-wide transition-colors ${
            isPageConverted
              ? "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {converting
            ? "Converting..."
            : isRestricted
            ? "Unavailable on this page"
            : isPageConverted
            ? "Show original"
            : "Convert this page"}
        </Button>

        {/* 5. Live Status Bar */}
        <div
          id="live-status"
          role="status"
          aria-live="polite"
          className="h-8 px-3 rounded-md bg-secondary/50 border border-border flex items-center gap-2 text-xs"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              statusType === "converted"
                ? "bg-accent"
                : statusType === "converting"
                ? "bg-muted-foreground animate-ping"
                : statusType === "error"
                ? "bg-destructive"
                : "bg-muted-foreground/60"
            }`}
            aria-hidden="true"
          />
          <span className="truncate text-foreground font-mono text-[11px]">
            {statusMessage}
          </span>
        </div>

        {/* 6. Site Rules Block (hidden on restricted pages) */}
        {!isRestricted && (
          <div className="pt-1 space-y-3">
            <Separator />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Site:
                  </span>
                  <span
                    id="current-domain-label"
                    className="font-mono text-xs font-semibold text-foreground truncate max-w-[200px]"
                    title={hostname || "Current site"}
                  >
                    {hostname || "Current site"}
                  </span>
                </div>

                {siteMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetSiteMode}
                    className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    title="Reset site rule to default"
                  >
                    Reset
                  </Button>
                )}
              </div>

              {/* Segmented Site Mode Control */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Automatic conversion:</span>
                <SiteModeControl
                  value={siteMode}
                  onChange={handleSiteModeChange}
                  domain={hostname}
                  size="sm"
                  ariaLabel={`Conversion rule for ${hostname || "current site"}`}
                />
              </div>

              {/* Default mode caption when inheriting default */}
              {!siteMode && (
                <div className="text-[11px] text-muted-foreground text-right">
                  {effectiveCaption}
                </div>
              )}

              {/* Site Assumed Currency Override */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label
                  htmlFor="site-currency-override"
                  className="text-xs text-muted-foreground"
                >
                  Prices on this site are in:
                </label>
                <CurrencyCombobox
                  triggerId="site-currency-override"
                  value={assumedCurrency}
                  onChange={handleAssumedCurrencyChange}
                  currencies={allCurrencies}
                  allowAutoDetect={true}
                  autoDetectLabel="Auto-detect"
                  triggerText={assumedCurrency || "Auto-detect"}
                  ariaLabel={`Prices on ${hostname || "this site"} are in`}
                  align="end"
                  className="h-7 px-2 text-xs font-mono bg-background w-[125px]"
                  popoverClassName="w-56"
                  scrollHeight="h-44"
                  placeholder="Assumed currency..."
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 7. Footer */}
      <Separator className="mt-1" />
      <footer className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
        <div id="rates-meta" className="flex items-center gap-1.5 min-w-0">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span id="rates-freshness-text" className="truncate text-[11px] font-mono">
            {ratesFreshnessText}
          </span>
          {ratesError && (
            <button
              id="btn-retry-rates"
              type="button"
              onClick={loadRates}
              className="text-primary font-medium hover:underline ml-1"
            >
              Retry
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {shortcutKey && (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-secondary text-muted-foreground border border-border">
              {shortcutKey}
            </kbd>
          )}
          <a
            id="link-options"
            href="#"
            onClick={openOptionsPage}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Options
          </a>
        </div>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<PopupApp />);
}
