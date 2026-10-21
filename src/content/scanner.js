// src/content/scanner.js
import { extractPrices, inferPageCurrency } from '../shared/parser.js';
import { formatCurrency, formatPriceDisplay } from '../shared/format.js';
import { calculateRate, convertAmount } from '../shared/rates.js';

export const IGNORED_SELECTOR = [
  'script', 'style', 'noscript', 'textarea', 'input', 'select',
  'option', 'code', 'pre', 'svg', 'canvas', '[contenteditable]',
  '[contenteditable="true"]', '[data-cc-ignore]',
  '#cc-dynamic-island-host', '#currency-convertr-root',
  '.currency-convertr-ui', '[data-cc-converted="true"]'
].join(', ');

export { inferPageCurrency };

export class PageScanner {
  constructor({
    doc = (typeof document !== 'undefined' ? document : null),
    targetCurrency = 'USD',
    ratesTable = null,
    displayMode = 'replace',
    roundWhole = false,
    context = {},
    rateDate = null,
    provider = null,
    onConvertedCountChange = null
  } = {}) {
    this.doc = doc;
    this.targetCurrency = (targetCurrency || 'USD').toUpperCase();
    this.ratesTable = ratesTable;
    this.displayMode = displayMode;
    this.roundWhole = roundWhole;
    this.context = { ...context };
    this.rateDate = rateDate;
    this.provider = provider;
    this.onConvertedCountChange = onConvertedCountChange;

    this.convertedCount = 0;
    this.isConverted = false;
    this.isMutatingOwnDOM = false;
    this.observer = null;
    this.debounceTimer = null;

    // Storage for byte-for-byte revert fidelity
    this.textOriginalData = new WeakMap(); // TextNode -> original text
    this.elementOriginalFragments = new WeakMap(); // Element -> DocumentFragment
    this.highlightSpans = new WeakMap(); // SpanElement -> original TextNode
    this.convertedElements = new Set();
    this.convertedTextNodes = new Set();
    this.conversionMetadata = new WeakMap(); // Node/Element -> { originalAmount, originalCurrency, convertedAmount, rate, date }
    this.detectedCurrencies = new Set();
    this.primarySourceCurrency = null;

    this._initializePageContext();
  }

  _initializePageContext() {
    if (!this.doc) return;

    // Fast cached helper for page native currency
    const inferred = inferPageCurrency(this.doc);
    if (inferred) {
      this.detectedCurrencies.add(inferred);
      if (!this.primarySourceCurrency) this.primarySourceCurrency = inferred;
      if (!this.context.pageContextISO) {
        this.context.pageContextISO = inferred;
      }
      if (!this.context.structuredHint) {
        this.context.structuredHint = inferred;
      }
    }

    // 1. Hostname for TLD
    if (!this.context.tld && this.doc.location && this.doc.location.hostname) {
      this.context.tld = this.doc.location.hostname;
    }

    // 2. HTML lang
    if (!this.context.htmlLang && this.doc.documentElement && this.doc.documentElement.lang) {
      this.context.htmlLang = this.doc.documentElement.lang;
    }

    // 3. Structured page hints (meta tags, json-ld)
    if (!this.context.structuredHint) {
      try {
        const meta = this.doc.querySelector(
          'meta[property="og:price:currency"], meta[property="product:price:currency"], meta[itemprop="priceCurrency"], [itemprop="priceCurrency"]'
        );
        if (meta) {
          const val = meta.getAttribute('content') || meta.textContent;
          if (val && val.trim()) {
            this.context.structuredHint = val.trim();
          }
        }
      } catch {}

      // Try JSON-LD
      if (!this.context.structuredHint) {
        try {
          const scripts = this.doc.querySelectorAll('script[type="application/ld+json"]');
          for (const s of scripts) {
            const txt = s.textContent;
            if (txt && txt.includes('priceCurrency')) {
              const match = txt.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/i);
              if (match) {
                this.context.structuredHint = match[1].toUpperCase();
                break;
              }
            }
          }
        } catch {}
      }
    }
  }

  _isNodeIgnored(node) {
    if (!node) return true;
    const el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return true;

    if (el.closest) {
      if (el.closest(IGNORED_SELECTOR)) return true;
      if (el.closest('[data-cc-converted]')) return true;
    }

    return false;
  }

  _findAllRoots(root) {
    const roots = [root];
    if (root.querySelectorAll) {
      const allEls = root.querySelectorAll('*');
      for (const el of allEls) {
        if (el.shadowRoot) {
          roots.push(...this._findAllRoots(el.shadowRoot));
        }
      }
    }
    return roots;
  }

  /**
   * Scans and converts prices in a given root (defaults to doc.body).
   */
  convert(rootNode = null) {
    if (!this.doc || !this.doc.body || !this.ratesTable) return 0;
    const initialRoot = rootNode || this.doc.body;
    const roots = this._findAllRoots(initialRoot);

    this.isMutatingOwnDOM = true;
    let newConversions = 0;

    try {
      for (const root of roots) {
        // Phase 1: Scan for split-price container elements (e.g. Amazon prices)
        const splitContainers = this._findSplitPriceElements(root);
        for (const el of splitContainers) {
          if (this._convertSplitElement(el)) {
            newConversions++;
          }
        }

        // Phase 2: Walk standard text nodes
        const textNodes = this._collectTextNodes(root);
        for (const textNode of textNodes) {
          if (this._convertTextNode(textNode)) {
            newConversions++;
          }
        }
      }
    } finally {
      this.isMutatingOwnDOM = false;
    }

    this.convertedCount += newConversions;
    this.isConverted = this.convertedCount > 0;

    if (this.onConvertedCountChange && newConversions > 0) {
      this.onConvertedCountChange(this.convertedCount);
    }

    return newConversions;
  }

  _collectTextNodes(root) {
    const textNodes = [];
    const walker = this.doc.createTreeWalker(
      root,
      4, // NodeFilter.SHOW_TEXT
      {
        acceptNode: (node) => {
          if (this._isNodeIgnored(node)) return 2; // FILTER_REJECT
          if (this.textOriginalData.has(node)) return 2; // already converted
          if (!node.nodeValue || !/\d/.test(node.nodeValue)) return 3; // FILTER_SKIP
          return 1; // FILTER_ACCEPT
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }
    return textNodes;
  }

  _findSplitPriceElements(root) {
    const splitElements = [];
    if (!root.querySelectorAll) return splitElements;

    // Target short inline or block elements with children
    const candidateElements = Array.from(root.querySelectorAll('span, div, p, b, strong, em, td'));

    // Sort by number of descendant elements ascending (innermost elements first)
    candidateElements.sort((a, b) => {
      const aCount = a.getElementsByTagName ? a.getElementsByTagName('*').length : 0;
      const bCount = b.getElementsByTagName ? b.getElementsByTagName('*').length : 0;
      return aCount - bCount;
    });

    for (const el of candidateElements) {
      if (this._isNodeIgnored(el)) continue;
      if (this.elementOriginalFragments.has(el)) continue;

      // Must have at least 1 child element
      if (el.children.length === 0) continue;

      const text = (el.textContent || '').trim();
      // Length must be reasonably short (<50 chars) and contain digits
      if (text.length === 0 || text.length > 50 || !/\d/.test(text)) continue;

      // Extract prices from combined text
      const prices = extractPrices(text, this.context);
      if (prices.length !== 1) continue;

      const sourceISO = prices[0].currency ? prices[0].currency.toUpperCase() : null;
      const targetISO = this.targetCurrency ? this.targetCurrency.toUpperCase() : 'USD';
      if (!sourceISO || sourceISO === targetISO) {
        continue;
      }

      // Verify that no individual descendant text node contained the full price
      const walker = this.doc.createTreeWalker(el, 4); // SHOW_TEXT
      let tNode;
      let hasFullChild = false;
      while ((tNode = walker.nextNode())) {
        if (tNode.nodeValue && extractPrices(tNode.nodeValue, this.context).length > 0) {
          hasFullChild = true;
          break;
        }
      }

      if (!hasFullChild) {
        splitElements.push(el);
      }
    }

    return splitElements;
  }

  _convertSplitElement(el) {
    if (!el.isConnected) return false;
    if (this._isNodeIgnored(el)) return false;
    if (el.closest && el.closest('[data-cc-converted]')) return false;
    if (el.querySelector && el.querySelector('[data-cc-converted]')) return false;
    if (this.elementOriginalFragments.has(el)) return false;

    const rawText = (el.textContent || '').trim();
    const prices = extractPrices(rawText, this.context);
    if (prices.length !== 1) return false;

    const price = prices[0];
    const sourceISO = price.currency ? price.currency.toUpperCase() : null;
    const targetISO = this.targetCurrency ? this.targetCurrency.toUpperCase() : 'USD';

    // HARD BAILOUT GATE
    if (!sourceISO || sourceISO === targetISO) {
      return false;
    }

    this.detectedCurrencies.add(sourceISO);
    if (!this.primarySourceCurrency) this.primarySourceCurrency = sourceISO;

    let convertedAmount;
    let rateUsed;
    try {
      rateUsed = calculateRate(sourceISO, targetISO, this.ratesTable);
      convertedAmount = convertAmount(price.amount, sourceISO, targetISO, this.ratesTable);
    } catch {
      return false;
    }

    const formattedConverted = formatCurrency(convertedAmount, this.targetCurrency, {
      roundWhole: this.roundWhole
    });

    const display = formatPriceDisplay({
      originalText: price.raw,
      convertedText: formattedConverted,
      displayMode: this.displayMode
    });

    // Save cloned DocumentFragment for 100% byte-for-byte revert
    const fragment = this.doc.createDocumentFragment();
    for (const child of Array.from(el.childNodes)) {
      fragment.appendChild(child.cloneNode(true));
    }
    this.elementOriginalFragments.set(el, fragment);
    this.convertedElements.add(el);

    // Save metadata for tooltip
    this.conversionMetadata.set(el, {
      originalAmount: price.amount,
      originalCurrency: price.currency,
      convertedAmount,
      targetCurrency: this.targetCurrency,
      rate: rateUsed,
      date: this.rateDate
    });

    // Replace element children
    el.textContent = '';
    const textNode = this.doc.createTextNode(display.text);
    if (display.highlight) {
      const mark = this.doc.createElement('mark');
      mark.className = 'cc-price-highlight';
      mark.setAttribute('data-cc-converted', 'true');
      mark.appendChild(textNode);
      el.appendChild(mark);
    } else {
      el.appendChild(textNode);
    }

    el.setAttribute('data-cc-converted', 'true');
    el.setAttribute('title', `Original: ${price.raw} (${price.currency})`);

    return true;
  }

  _convertTextNode(textNode) {
    if (this.textOriginalData.has(textNode)) return false;
    const originalText = textNode.nodeValue;
    if (!originalText || !/\d/.test(originalText)) return false;

    const prices = extractPrices(originalText, this.context);
    if (prices.length === 0) return false;

    const targetISO = this.targetCurrency ? this.targetCurrency.toUpperCase() : 'USD';

    // HARD BAILOUT GATE: Filter to convertible prices where sourceISO !== targetISO
    const validPrices = prices.filter(p => {
      const sourceISO = p.currency ? p.currency.toUpperCase() : null;
      return sourceISO && sourceISO !== targetISO;
    });
    if (validPrices.length === 0) return false;

    // Store original text
    this.textOriginalData.set(textNode, originalText);
    this.convertedTextNodes.add(textNode);

    // If highlight mode is active and parent element can accept span replacement
    if (this.displayMode === 'replace_highlight' && textNode.parentNode) {
      const parent = textNode.parentNode;
      const frag = this.doc.createDocumentFragment();
      let lastIndex = 0;

      for (const p of validPrices) {
        const sourceISO = p.currency ? p.currency.toUpperCase() : null;
        if (sourceISO) {
          this.detectedCurrencies.add(sourceISO);
          if (!this.primarySourceCurrency) this.primarySourceCurrency = sourceISO;
        }
        let convertedAmount;
        let rateUsed;
        try {
          rateUsed = calculateRate(sourceISO, targetISO, this.ratesTable);
          convertedAmount = convertAmount(p.amount, sourceISO, targetISO, this.ratesTable);
        } catch {
          continue;
        }

        const formattedConverted = formatCurrency(convertedAmount, this.targetCurrency, {
          roundWhole: this.roundWhole
        });

        // Slice before
        if (p.startIndex > lastIndex) {
          frag.appendChild(this.doc.createTextNode(originalText.slice(lastIndex, p.startIndex)));
        }

        // Highlight span
        const span = this.doc.createElement('span');
        span.className = 'cc-price-highlight';
        span.setAttribute('data-cc-converted', 'true');
        span.textContent = formattedConverted;
        span.setAttribute('title', `Original: ${p.raw} (${sourceISO})`);

        this.conversionMetadata.set(span, {
          originalAmount: p.amount,
          originalCurrency: sourceISO,
          convertedAmount,
          targetCurrency: this.targetCurrency,
          rate: rateUsed,
          date: this.rateDate
        });

        frag.appendChild(span);
        lastIndex = p.endIndex;
      }

      if (lastIndex < originalText.length) {
        frag.appendChild(this.doc.createTextNode(originalText.slice(lastIndex)));
      }

      this.highlightSpans.set(textNode, Array.from(frag.childNodes));
      parent.replaceChild(frag, textNode);
      return true;
    }

    // Standard in-place text replacement (Replace or Append mode)
    let modifiedText = originalText;
    // Replace backwards to preserve slice indexes
    for (let i = validPrices.length - 1; i >= 0; i--) {
      const p = validPrices[i];
      const sourceISO = p.currency ? p.currency.toUpperCase() : null;
      if (sourceISO) {
        this.detectedCurrencies.add(sourceISO);
        if (!this.primarySourceCurrency) this.primarySourceCurrency = sourceISO;
      }
      let convertedAmount;
      let rateUsed;
      try {
        rateUsed = calculateRate(sourceISO, targetISO, this.ratesTable);
        convertedAmount = convertAmount(p.amount, sourceISO, targetISO, this.ratesTable);
      } catch {
        continue;
      }

      const formattedConverted = formatCurrency(convertedAmount, this.targetCurrency, {
        roundWhole: this.roundWhole
      });

      const display = formatPriceDisplay({
        originalText: p.raw,
        convertedText: formattedConverted,
        displayMode: this.displayMode
      });

      modifiedText =
        modifiedText.slice(0, p.startIndex) +
        display.text +
        modifiedText.slice(p.endIndex);

      this.conversionMetadata.set(textNode, {
        originalAmount: p.amount,
        originalCurrency: sourceISO,
        convertedAmount,
        targetCurrency: this.targetCurrency,
        rate: rateUsed,
        date: this.rateDate
      });
    }

    textNode.nodeValue = modifiedText;
    return true;
  }

  /**
   * Reverts all converted elements and text nodes byte-for-byte to their original state.
   */
  revert() {
    this.isMutatingOwnDOM = true;
    try {
      // 1. Revert split-price elements
      for (const el of this.convertedElements) {
        const frag = this.elementOriginalFragments.get(el);
        if (frag) {
          el.textContent = '';
          el.appendChild(frag.cloneNode(true));
          el.removeAttribute('data-cc-converted');
          el.removeAttribute('title');
        }
        this.elementOriginalFragments.delete(el);
        this.conversionMetadata.delete(el);
      }
      this.convertedElements.clear();

      // 2. Revert text nodes
      for (const textNode of this.convertedTextNodes) {
        const originalText = this.textOriginalData.get(textNode);
        if (originalText !== undefined) {
          // Check if it was replaced with highlight nodes
          const replacementNodes = this.highlightSpans.get(textNode);
          if (replacementNodes && replacementNodes.length > 0 && replacementNodes[0].parentNode) {
            const parent = replacementNodes[0].parentNode;
            parent.insertBefore(textNode, replacementNodes[0]);
            for (const r of replacementNodes) {
              if (r.parentNode === parent) {
                parent.removeChild(r);
              }
              this.conversionMetadata.delete(r);
            }
          }
          textNode.nodeValue = originalText;
        }
        this.textOriginalData.delete(textNode);
        this.highlightSpans.delete(textNode);
        this.conversionMetadata.delete(textNode);
      }
      this.convertedTextNodes.clear();

      this.convertedCount = 0;
      this.isConverted = false;
      if (this.onConvertedCountChange) {
        this.onConvertedCountChange(0);
      }
    } finally {
      this.isMutatingOwnDOM = false;
    }
  }

  /**
   * Starts MutationObserver for dynamic SPAs and infinite scroll pages.
   */
  startObserving() {
    if (!this.doc || !this.doc.body) return;
    if (this.observer) return;

    const MutationObserverImpl =
      typeof MutationObserver !== 'undefined'
        ? MutationObserver
        : (this.doc.defaultView && this.doc.defaultView.MutationObserver);

    if (!MutationObserverImpl) return;

    const pendingAddedNodes = new Set();

    this.observer = new MutationObserverImpl((mutations) => {
      if (this.isMutatingOwnDOM || !this.isConverted) return;

      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && !this._isNodeIgnored(node)) {
              pendingAddedNodes.add(node);
            }
          }
        }
      }

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        const nodesToProcess = Array.from(pendingAddedNodes);
        pendingAddedNodes.clear();
        for (const node of nodesToProcess) {
          if (node.isConnected) {
            this.convert(node);
          }
        }
      }, 100);
    });

    this.observer.observe(this.doc.body, {
      childList: true,
      subtree: true
    });
  }

  stopObserving() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
