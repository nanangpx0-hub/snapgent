// SPDX-License-Identifier: GPL-3.0-or-later
// Shared adapter for Perplexity, Mistral Vibe, Microsoft Copilot, and Poe.
// The core remains provider-agnostic; keep site-specific selectors in CONFIG.
// eslint-disable-next-line no-unused-vars
const ZSProvider = (() => {
  "use strict";
  const HOSTS = {
    "perplexity.ai": {
      id: "perplexity", name: "Perplexity",
      user: '[data-testid="user-query"],[data-testid="user-message"],[data-message-author-role="user"],[class*="query" i],[class*="Query"],h1[class*="font-"],header h1',
      assistant: '[data-testid="answer"],[data-testid="assistant-message"],[data-message-author-role="assistant"],[class*="answer" i],[class*="Answer"],.prose,[class*="prose"]',
      editor: 'textarea[placeholder*="Ask" i],textarea[placeholder*="follow" i],textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"]',
      send: /\b(send|submit|search|ask|kirim|tanya)\b/i,
    },
    "chat.mistral.ai": {
      id: "vibe", name: "Mistral Vibe",
      user: '[data-message-author-role="user"],[data-testid*="user-message"],[data-role="user"]',
      assistant: '[data-message-author-role="assistant"],[data-testid*="assistant-message"],[data-role="assistant"]',
      editor: 'textarea[placeholder*="Ask" i],textarea[placeholder*="Message" i],[contenteditable="true"][role="textbox"],[contenteditable="true"]',
      send: /\b(send|submit)\b/i,
    },
    "copilot.com": {
      id: "copilot", name: "Microsoft Copilot",
      user: '[data-message-author-role="user"],[data-testid*="user-message"],[data-testid*="human-message"],[data-author="user"]',
      assistant: '[data-message-author-role="assistant"],[data-testid*="assistant-message"],[data-testid*="bot-message"],[data-author="assistant"]',
      editor: 'textarea[placeholder*="message" i],textarea[placeholder*="ask" i],textarea[aria-label*="message" i],[contenteditable="true"][role="textbox"]',
      send: /\b(send|submit)\b/i,
    },
    "copilot.microsoft.com": {
      id: "copilot", name: "Microsoft Copilot",
      user: '[data-message-author-role="user"],[data-testid*="user-message"],[data-testid*="human-message"],[data-author="user"]',
      assistant: '[data-message-author-role="assistant"],[data-testid*="assistant-message"],[data-testid*="bot-message"],[data-author="assistant"]',
      editor: 'textarea[placeholder*="message" i],textarea[placeholder*="ask" i],textarea[aria-label*="message" i],[contenteditable="true"][role="textbox"]',
      send: /\b(send|submit)\b/i,
    },
    "copilot.cloud.microsoft": {
      id: "copilot", name: "Microsoft Copilot",
      user: '[data-message-author-role="user"],[data-testid*="user-message"],[data-testid*="human-message"],[data-author="user"]',
      assistant: '[data-message-author-role="assistant"],[data-testid*="assistant-message"],[data-testid*="bot-message"],[data-author="assistant"]',
      editor: 'textarea[placeholder*="message" i],textarea[placeholder*="ask" i],textarea[aria-label*="message" i],[contenteditable="true"][role="textbox"]',
      send: /\b(send|submit)\b/i,
    },
    "poe.com": {
      id: "poe", name: "Poe",
      user: '[data-message-author-role="user"],[data-testid*="human-message"],[data-testid*="user-message"],[data-author="user"]',
      assistant: '[data-message-author-role="assistant"],[data-testid*="bot-message"],[data-testid*="assistant-message"],[data-author="assistant"]',
      editor: 'textarea[placeholder*="Talk" i],textarea[placeholder*="Message" i],textarea[placeholder*="Ask" i],[contenteditable="true"][role="textbox"],[contenteditable="true"]',
      send: /\b(send|submit)\b/i,
    },
  };
  const host = location.hostname.replace(/^www\./, "");
  const C = HOSTS[host] || HOSTS[location.hostname] ||
    (host.endsWith(".microsoft.com") ? HOSTS["copilot.com"] : null);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const timings = {
    GEN_IDLE_MS: 1800, REASON_IDLE_MS: 15000, WARMUP_MS: 60000,
    REASON_NOREPLY_MS: 120000, STABLE_MS: 6000, RESPONSE_TIMEOUT_MS: 300000,
  };
  let diag = () => {};
  let lockedEditor = null;
  let sampledItem = null, sampledLen = 0, grewAt = 0;
  const ids = new WeakMap();
  let nextId = 0;
  const visible = (el) => !!el && el.isConnected && (typeof el.getClientRects === "function" ? el.getClientRects().length > 0 : false);
  const outsideSnapgent = (el) => !!el && !el.closest("#zs-root");
  function isExcludedUi(item) {
    if (!item || !item.closest) return false;
    return !!item.closest("aside, nav, header, footer, [role='navigation'], [aria-label*='sidebar' i], a, button, [role='button'], form, #zs-root");
  }
  function roleOf(item) {
    if (!item || isExcludedUi(item)) return "";
    if (C.user && item.matches && item.matches(C.user)) return "user";
    if (C.assistant && item.matches && item.matches(C.assistant)) return "assistant";
    const markers = ["data-message-author-role", "data-author-role", "data-author", "data-testid", "aria-label"]
      .map((name) => (item.getAttribute ? item.getAttribute(name) || "" : ""))
      .join(" ").toLowerCase();
    if (/\b(user|human)\b/.test(markers)) return "user";
    if (/\b(assistant|bot|answer)\b/.test(markers)) return "assistant";
    if (item.querySelector) {
      if (item.querySelector(C.assistant) || item.querySelector('.prose, .markdown, [class*="answer" i]')) return "assistant";
      if (item.querySelector(C.user)) return "user";
    }
    return "";
  }
  const isUserItem = (item) => roleOf(item) === "user";
  const isAssistantItem = (item) => roleOf(item) === "assistant";
  const allItems = () => {
    const editor = getEditor();
    const candidates = [...document.querySelectorAll(
      `${C.user},${C.assistant},[data-testid*="message"],[data-testid*="answer"],[data-message-author-role],[data-author],.prose`
    )].filter((item) => {
      if (!outsideSnapgent(item) || isExcludedUi(item)) return false;
      if (editor && (item === editor || item.contains(editor) || editor.contains(item))) return false;
      return !!roleOf(item);
    });
    return candidates.filter((item) => !candidates.some((parent) =>
      parent !== item && parent.contains(item) && roleOf(parent) === roleOf(item)));
  };
  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;
  const lastAssistant = () => assistantItems().at(-1) || null;

  function getEditor() {
    if (visible(lockedEditor) && outsideSnapgent(lockedEditor)) return lockedEditor;
    const candidates = [...document.querySelectorAll(C.editor)];
    for (const editor of candidates) {
      if (outsideSnapgent(editor) && visible(editor) && !editor.disabled &&
          !editor.readOnly && editor.getAttribute("aria-hidden") !== "true") return editor;
    }
    return null;
  }
  const editorText = () => {
    const editor = getEditor();
    return editor ? ("value" in editor ? editor.value : editor.innerText || editor.textContent || "") : "";
  };
  const chatIsEmpty = () => {
    if (C.id === "perplexity" && /^\/?$/.test(location.pathname)) return true;
    return allItems().length === 0;
  };
  const isFreshChat = () => {
    if (C.id === "perplexity" && /^\/?$/.test(location.pathname) && !!getEditor()) return true;
    return chatIsEmpty() && !!getEditor();
  };
  const composerFrame = () => {
    const editor = getEditor();
    if (!editor) return null;
    return editor.closest("form") ||
      editor.closest("[class*='search' i], [class*='query' i], [class*='input' i], [class*='box' i], [class*='composer' i]") ||
      editor.parentElement?.parentElement ||
      editor.parentElement ||
      editor;
  };
  const barAnchor = () => composerFrame();

  function textWithout(root, excludeSel) {
    if (!root) return "";
    const skip = [".zs-chip", "button", excludeSel]
      .filter(Boolean).join(",");
    let text = "";
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) { text += node.nodeValue || ""; return; }
      if (node.nodeType !== Node.ELEMENT_NODE || (skip && node.matches(skip))) return;
      if (node.tagName === "BR") { text += "\n"; return; }
      const block = /^(ARTICLE|BLOCKQUOTE|DIV|LI|P|PRE|SECTION)$/.test(node.tagName);
      if (block && text && !text.endsWith("\n")) text += "\n";
      for (const child of node.childNodes) walk(child);
      if (block && !text.endsWith("\n")) text += "\n";
    };
    walk(root);
    return text;
  }
  const itemText = (item) => textWithout(item);
  const classifyText = (item, excludeSel) => textWithout(item, excludeSel);
  const bodyOf = (item) => item && (item.querySelector('[data-testid*="content"],.markdown,.prose') || item);
  const streamText = (item) => textWithout(bodyOf(item));
  const streamLen = (item) => streamText(item === undefined ? lastAssistant() : item).length;
  const lastAssistantId = () => {
    const item = lastAssistant();
    if (!item) return null;
    const id = item.getAttribute("data-message-id") || item.getAttribute("data-testid") || item.id;
    if (id) return id;
    if (!ids.has(item)) ids.set(item, ++nextId);
    return ids.get(item);
  };
  function sampleStream() {
    const item = lastAssistant(), length = streamLen(item), now = Date.now();
    if (item !== sampledItem || length < sampledLen - 400) {
      sampledItem = item; sampledLen = length; grewAt = now;
    } else if (length > sampledLen) { sampledLen = length; grewAt = now; }
  }
  const form = () => { const editor = getEditor(); return editor && editor.closest("form"); };
  const composerArea = () => form() || composerFrame();
  const controls = (root) => [...(root || composerArea() || document).querySelectorAll("button,[role='button']")]
    .filter((button) => outsideSnapgent(button) && visible(button));
  const labelOf = (button) => [button.getAttribute("aria-label"), button.getAttribute("title"),
    button.getAttribute("data-testid"), button.textContent].filter(Boolean).join(" ");
  const stopButton = () => {
    const direct = document.querySelector('button[data-testid*="stop" i], button[aria-label*="stop generating" i], button[aria-label="Stop" i]');
    if (direct && outsideSnapgent(direct) && visible(direct)) return direct;
    const list = controls(composerArea());
    return list.find((button) => /\b(stop|halt)\b/i.test(labelOf(button))) || null;
  };
  const sendButton = () => {
    // 1. Label/regex match across visible controls (check composer area first, fallback to document)
    const list = controls(composerArea()).length > 0 ? controls(composerArea()) : controls(document);
    const byLabel = list.find((button) => {
      const label = labelOf(button);
      return (C.send.test(label) || /\b(kirim|tanya|arrow|submit|search|ask)\b/i.test(label)) &&
        !/stop|cancel|clear/i.test(label) &&
        !button.disabled && button.getAttribute("aria-disabled") !== "true";
    });
    if (byLabel) return byLabel;

    // 2. Submit or arrow button inside the form or query container
    const f = composerArea();
    if (f) {
      const submitBtn = f.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && outsideSnapgent(submitBtn) && visible(submitBtn) && !submitBtn.disabled) return submitBtn;
      const formBtns = [...f.querySelectorAll("button,[role='button']")].filter(
        (b) => outsideSnapgent(b) && visible(b) && !b.disabled && b.getAttribute("aria-disabled") !== "true"
      );
      const withSvg = formBtns.find((b) => b.querySelector("svg") && !/stop|cancel/i.test(labelOf(b)));
      if (withSvg) return withSvg;
    }

    // 3. Fallback: button with svg or last button adjacent to editor
    const editor = getEditor();
    const parent = editor ? (editor.closest("form") || editor.closest("[class*='search'], [class*='query'], [class*='input']") || editor.parentElement?.parentElement || editor.parentElement) : null;
    if (parent) {
      const pBtns = [...parent.querySelectorAll("button,[role='button']")].filter(
        (b) => outsideSnapgent(b) && visible(b) && !b.disabled && b.getAttribute("aria-disabled") !== "true"
      );
      const action = pBtns.find((b) => b.querySelector("svg") && !/stop|cancel/i.test(labelOf(b))) || pBtns.at(-1);
      if (action) return action;
    }

    return null;
  };
  const isHardGenerating = () => !!stopButton();
  const isGenerating = () => {
    sampleStream();
    return isHardGenerating() || (sampledLen > 0 && Date.now() - grewAt < timings.GEN_IDLE_MS);
  };
  const isBusyNow = isGenerating;
  const snapshot = () => ({ th: 0, rp: streamLen() });
  const readAssistant = () => {
    const item = lastAssistant();
    return { present: !!item, reply: item ? streamText(item).trim() : "", thinking: "", item };
  };
  async function waitFor(predicate, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) { if (predicate()) return true; await sleep(120); }
    return false;
  }
  function setInputLock(on) {
    const editor = on ? getEditor() : (lockedEditor || getEditor());
    lockedEditor = on ? editor : null;
    if (!editor) return;
    if ("value" in editor) {
      if (on) editor.setAttribute("readonly", ""); else editor.removeAttribute("readonly");
    } else editor.setAttribute("contenteditable", on ? "false" : "true");
  }
  function writeText(editor, value) {
    if ("value" in editor) {
      editor.removeAttribute("readonly");
      editor.focus();
      let ok = false;
      try {
        editor.select();
        ok = document.execCommand("insertText", false, value);
      } catch {}
      if (!ok || editor.value !== value) {
        const proto = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value");
        if (setter && setter.set) setter.set.call(editor, value); else editor.value = value;
        try {
          const tracker = editor._valueTracker;
          if (tracker) tracker.setValue("");
        } catch {}
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (lockedEditor === editor) editor.setAttribute("readonly", "");
      return;
    }
    editor.focus();
    editor.setAttribute("contenteditable", "true");
    const selection = window.getSelection();
    if (selection) { const range = document.createRange(); range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range); }
    if (!document.execCommand("insertText", false, value)) {
      editor.textContent = value;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (lockedEditor === editor) editor.setAttribute("contenteditable", "false");
  }
  async function typeAndSend(value) {
    const editor = getEditor();
    if (!editor) throw new Error(`${C.name} input box not found`);
    const beforeUsers = userCount();
    writeText(editor, value);
    await sleep(200);

    // Wait briefly for send button to be ready
    await waitFor(() => {
      const b = sendButton();
      return !!b && !b.disabled && b.getAttribute("aria-disabled") !== "true";
    }, 4000);

    const button = sendButton();
    if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") {
      try { button.click(); } catch {}
    }

    // Dispatch Enter (required for React / Perplexity query submission)
    const o = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    editor.dispatchEvent(new KeyboardEvent("keydown", o));
    editor.dispatchEvent(new KeyboardEvent("keypress", o));
    editor.dispatchEvent(new KeyboardEvent("keyup", o));

    const f = form();
    if (f && typeof f.requestSubmit === "function" && editorText().trim() !== "") {
      try { f.requestSubmit(); } catch {}
    }

    // Wait for text to clear or new turn to land; let submitAndGetBase manage retries
    await waitFor(() => editorText().trim() === "" || userCount() > beforeUsers || isHardGenerating(), 5000);
    dismissCommandPalette();
  }
  function dismissCommandPalette() {
    if (C.id !== "perplexity") return;
    const input = document.querySelector('input[placeholder*="command or search" i]');
    if (input) {
      const esc = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true };
      input.dispatchEvent(new KeyboardEvent("keydown", esc));
      input.dispatchEvent(new KeyboardEvent("keyup", esc));
      document.dispatchEvent(new KeyboardEvent("keydown", esc));
      document.dispatchEvent(new KeyboardEvent("keyup", esc));
      try { input.blur(); } catch {}
      const dialog = input.closest('[role="dialog"], [class*="modal" i], [class*="dialog" i]');
      if (dialog) {
        const backdrop = dialog.parentElement?.querySelector('[class*="backdrop" i], [class*="overlay" i]') || dialog.parentElement;
        if (backdrop && backdrop !== dialog) {
          try { backdrop.click(); } catch {}
        }
      }
    }
  }
  const stopGeneration = () => { const button = stopButton(); if (button) button.click(); };
  const enforceComposer = () => {
    dismissCommandPalette();
    return { ready: !!getEditor() };
  };
  async function ensureComposerReady(reason) {
    dismissCommandPalette();
    const ready = !!getEditor();
    diag("mode_ready", { reason, provider: C.id, ready });
    return { ready };
  }
  function scanError() {
    if (getEditor()) return null;
    return `The ${C.name} input box is not available. Sign in and open a chat if required.`;
  }
  const isTooLongMsg = (text) => /conversation.{0,30}(too long|limit)|context.{0,20}limit/i.test(text);
  const isBusyMsg = (text) => /try again later|temporarily unavailable|rate limit|too many requests/i.test(text);
  const turnHalted = () => false;
  const findContinueBtn = () => null;
  const clickContinueBtn = () => false;
  const conversationKey = () => {
    const key = `${C.id}:${location.pathname}${location.search || ""}`;
    return /^\w+:\/?$/.test(key) || /\/(?:new|chat|app)\/?$/.test(key.slice(C.id.length + 1)) ? "" : key;
  };
  function installSendHooks(handlers) {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      const editor = getEditor();
      if (!editor || !(editor === event.target || editor.contains(event.target)) || !editorText().trim()) return;
      if (handlers.isBlocked()) return;
      if (!handlers.isStarted()) { if (chatIsEmpty()) handlers.onBlockedAttempt(); return; }
      handlers.onUserMessage(assistantCount());
    }, true);
    document.addEventListener("click", (event) => {
      const button = event.target && event.target.closest ? event.target.closest("button,[role='button']") : null;
      if (!button || !getEditor()) return;
      if (stopButton() === button) { handlers.onNativeStop(); return; }
      if (sendButton() !== button || handlers.isBlocked()) return;
      if (!handlers.isStarted()) { if (chatIsEmpty()) handlers.onBlockedAttempt(); return; }
      handlers.onUserMessage(assistantCount());
    }, true);
  }
  const commandShape = /"(?:command|tool)"\s*:\s*"|###\s*(?:lua|mcp_tool)/i;
  function findToolBlockSpot(item) {
    let found = null;
    item.querySelectorAll("pre,code,p,li").forEach((el) => {
      if (el.closest(".zs-chip,.zs-tool-hide")) return;
      const text = (el.textContent || "").trim();
      if (text && commandShape.test(text)) {
        el.classList.add("zs-tool-hide");
        found = found || { parent: el.parentElement, ref: el };
      }
    });
    return found;
  }
  return {
    id: C.id, displayName: C.name, sendRetryLimit: 1, supportsVision: false,
    timings, chipAtItemLevel: true, reliableCounts: true,
    init({ diag: d } = {}) { if (d) diag = d; },
    allItems, isUserItem, isAssistantItem, itemText, classifyText,
    assistantCount, userCount, lastAssistant, lastAssistantId, readAssistant,
    streamLen, snapshot, getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barAnchor,
    setInputLock, typeAndSend, stopGeneration, isGenerating, isBusyNow, isHardGenerating,
    enforceComposer, ensureComposerReady, turnHalted, findContinueBtn, clickContinueBtn,
    scanError, isTooLongMsg, isBusyMsg, attachImages: () => false, clearAttachments: () => {},
    conversationKey, installSendHooks, findToolBlockSpot,
  };
})();
