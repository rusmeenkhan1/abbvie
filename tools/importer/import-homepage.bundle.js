var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-homepage.js
  var import_homepage_exports = {};
  __export(import_homepage_exports, {
    default: () => import_homepage_default
  });

  // tools/importer/parsers/hero-homepage.js
  function parse(element, { document }) {
    const bgImage = element.querySelector("img");
    const heading = element.querySelector("h1, h2, h3");
    const description = element.querySelector("p");
    const ctaLink = element.querySelector("a[href]");
    const cells = [];
    if (bgImage) {
      cells.push([bgImage]);
    }
    const contentCell = [];
    if (heading) contentCell.push(heading);
    if (description) contentCell.push(description);
    if (ctaLink) contentCell.push(ctaLink);
    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-homepage", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-news.js
  function parse2(element, { document }) {
    const cardItems = element.querySelectorAll(".cardpagestory, .card-standard");
    const cells = [];
    cardItems.forEach((card) => {
      const image = card.querySelector("img");
      const title = card.querySelector('h4, h3, h2, .card-title, [class*="title"]');
      const description = card.querySelector('p, .card-description, [class*="description"]');
      const date = card.querySelector('.card-metadata-date, [class*="date"]');
      const tag = card.querySelector('.card-metadata-tag, [class*="tag"]');
      const link = card.querySelector("a[href]");
      const imageCell = image || document.createTextNode("");
      const contentCell = [];
      if (tag) contentCell.push(tag);
      if (date) contentCell.push(date);
      if (title) contentCell.push(title);
      if (description) contentCell.push(description);
      if (link && !(title == null ? void 0 : title.closest("a"))) contentCell.push(link);
      cells.push([imageCell, contentCell]);
    });
    if (cells.length === 0) {
      const fallbackContent = element.querySelector("h2, h3, h4, p");
      if (fallbackContent) cells.push([document.createTextNode(""), fallbackContent]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-news", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-intro.js
  function parse3(element, { document }) {
    var _a;
    const eyebrow = element.querySelector('[class*="eyebrow"], .cmp-text p:first-child span.light-font');
    const heading = element.querySelector("h2, h1, h3");
    const paragraphs = Array.from(element.querySelectorAll("p")).filter((p) => {
      if (eyebrow && p.contains(eyebrow)) return false;
      return true;
    });
    const link = element.querySelector("a[href]");
    const col1 = [];
    if (eyebrow && !((_a = heading == null ? void 0 : heading.parentElement) == null ? void 0 : _a.contains(eyebrow))) col1.push(eyebrow);
    if (heading) col1.push(heading);
    const col2 = [];
    paragraphs.forEach((p) => {
      if (!col1.includes(p) && !p.contains(heading)) col2.push(p);
    });
    if (link && !(heading == null ? void 0 : heading.closest("a"))) col2.push(link);
    const cells = [];
    if (col1.length > 0 || col2.length > 0) {
      cells.push([col1.length > 0 ? col1 : document.createTextNode(""), col2.length > 0 ? col2 : document.createTextNode("")]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-intro", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/hero-video.js
  function parse4(element, { document }) {
    const bgImage = element.querySelector("img, video[poster]");
    const heading = element.querySelector("h1, h2, h3, h4");
    const description = element.querySelector("p");
    const ctaLink = element.querySelector("a[href]");
    const cells = [];
    if (bgImage) {
      cells.push([bgImage]);
    }
    const contentCell = [];
    if (heading) contentCell.push(heading);
    if (description) contentCell.push(description);
    if (ctaLink) contentCell.push(ctaLink);
    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-video", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-dashboard.js
  function parse5(element, { document }) {
    const cardItems = element.querySelectorAll(".cardpagestory, .dashboardcards");
    const cells = [];
    cardItems.forEach((card) => {
      const image = card.querySelector("img");
      const eyebrow = card.querySelector('.card-metadata-tag, [class*="eyebrow"], [class*="tag"]');
      const title = card.querySelector('h2, h3, h4, .card-title, [class*="title"]');
      const stat = card.querySelector('.card-stat, [class*="stat"], [class*="number"]');
      const description = card.querySelector('p, .card-description, [class*="description"]');
      const link = card.querySelector("a[href]");
      const imageCell = image || document.createTextNode("");
      const contentCell = [];
      if (eyebrow) contentCell.push(eyebrow);
      if (stat) contentCell.push(stat);
      if (title) contentCell.push(title);
      if (description) contentCell.push(description);
      if (link && !(title == null ? void 0 : title.closest("a"))) contentCell.push(link);
      cells.push([imageCell, contentCell]);
    });
    if (cells.length === 0) {
      const fallback = element.querySelector("h2, h3, h4, p");
      if (fallback) cells.push([document.createTextNode(""), fallback]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-dashboard", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-media.js
  function parse6(element, { document }) {
    const image = element.querySelector(".cmp-image__image, img");
    const eyebrow = element.querySelector('.cmp-header__text, [class*="eyebrow"]');
    const heading = element.querySelector("h1, h2, h3, h4, h5, h6, .cmp-title__text");
    const description = element.querySelector(".cmp-text p, .cmp-text");
    const link = element.querySelector("a.cmp-button, a[href]");
    const col1 = [];
    if (image) {
      const img = document.createElement("img");
      img.src = image.src || image.getAttribute("src");
      img.alt = image.alt || "";
      col1.push(img);
    }
    const col2 = [];
    if (eyebrow) {
      const em = document.createElement("em");
      em.textContent = eyebrow.textContent.trim();
      const p = document.createElement("p");
      p.appendChild(em);
      col2.push(p);
    }
    if (heading) col2.push(heading);
    if (description) col2.push(description);
    if (link) {
      const a = document.createElement("a");
      a.href = link.href || link.getAttribute("href");
      a.textContent = link.textContent.trim() || "Learn more";
      const p = document.createElement("p");
      p.appendChild(a);
      col2.push(p);
    }
    const cells = [];
    if (col1.length > 0 || col2.length > 0) {
      cells.push([col1.length > 0 ? col1 : document.createTextNode(""), col2.length > 0 ? col2 : document.createTextNode("")]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-media", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-text.js
  function parse7(element, { document }) {
    const textBlocks = element.querySelectorAll(".text, .cmp-text");
    const cells = [];
    textBlocks.forEach((textBlock) => {
      const heading = textBlock.querySelector("h2, h3, h4, h5");
      const paragraphs = textBlock.querySelectorAll("p");
      const link = textBlock.querySelector("a[href]");
      const contentCell = [];
      if (heading) contentCell.push(heading);
      paragraphs.forEach((p) => contentCell.push(p));
      if (link && !(heading == null ? void 0 : heading.closest("a"))) contentCell.push(link);
      if (contentCell.length > 0) {
        cells.push(contentCell);
      }
    });
    if (cells.length === 0) {
      const fallback = element.querySelector("p, h3, h4");
      if (fallback) cells.push([fallback]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-text", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-cta.js
  function parse8(element, { document }) {
    const heading = element.querySelector("h2, h3, h4");
    const description = element.querySelector("p");
    const ctaLink = element.querySelector("a[href]");
    const contentCell = [];
    if (heading) contentCell.push(heading);
    if (description) contentCell.push(description);
    if (ctaLink) contentCell.push(ctaLink);
    const cells = [];
    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-cta", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-info.js
  function parse9(element, { document }) {
    var _a;
    const teaser = element.querySelector(".cmp-teaser");
    const eyebrow = element.querySelector(".cmp-teaser__pretitle");
    const teaserTitle = element.querySelector(".cmp-teaser__title");
    const teaserDesc = element.querySelector(".cmp-teaser__description");
    const col1 = [];
    if (eyebrow) {
      const em = document.createElement("em");
      em.textContent = eyebrow.textContent.trim();
      const p = document.createElement("p");
      p.appendChild(em);
      col1.push(p);
    }
    if (teaserTitle) {
      const h2 = document.createElement("h2");
      h2.textContent = teaserTitle.textContent.trim();
      col1.push(h2);
    }
    if (teaserDesc) col1.push(teaserDesc);
    const col2 = [];
    const earningsCard = element.querySelector(".cardpagestory, .card-dashboard");
    if (earningsCard) {
      const cardTitle = earningsCard.querySelector(".card-title, h4");
      const cardEyebrow = earningsCard.querySelector(".card-eyebrow");
      const cardLink = earningsCard.querySelector("a[href]");
      if (cardEyebrow) {
        const em = document.createElement("em");
        em.textContent = cardEyebrow.textContent.trim();
        const p = document.createElement("p");
        p.appendChild(em);
        col2.push(p);
      }
      if (cardTitle) col2.push(cardTitle);
      if (cardLink) {
        const a = document.createElement("a");
        a.href = cardLink.href || cardLink.getAttribute("href");
        a.textContent = ((_a = cardLink.querySelector(".card-cta")) == null ? void 0 : _a.textContent.trim()) || cardLink.textContent.trim();
        const p = document.createElement("p");
        p.appendChild(a);
        col2.push(p);
      }
    }
    const linkCards = element.querySelectorAll(".linkcard-link");
    linkCards.forEach((lc) => {
      var _a2;
      const a = document.createElement("a");
      a.href = lc.href || lc.getAttribute("href");
      a.textContent = ((_a2 = lc.querySelector(".link-text")) == null ? void 0 : _a2.textContent.trim()) || lc.textContent.trim();
      const p = document.createElement("p");
      p.appendChild(a);
      col2.push(p);
    });
    const cells = [];
    if (col1.length > 0 || col2.length > 0) {
      cells.push([col1.length > 0 ? col1 : document.createTextNode(""), col2.length > 0 ? col2 : document.createTextNode("")]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-info", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-esg.js
  function parse10(element, { document }) {
    const cardItems = element.querySelectorAll('.dashboardcards, .cardpagestory, [class*="card"]');
    const cells = [];
    cardItems.forEach((card) => {
      const image = card.querySelector("img");
      const eyebrow = card.querySelector('.card-metadata-tag, [class*="tag"], [class*="eyebrow"]');
      const title = card.querySelector('h2, h3, h4, .card-title, [class*="title"]');
      const stat = card.querySelector('[class*="stat"], [class*="number"]');
      const description = card.querySelector('p, .card-description, [class*="description"]');
      const link = card.querySelector("a[href]");
      const imageCell = image || document.createTextNode("");
      const contentCell = [];
      if (eyebrow) contentCell.push(eyebrow);
      if (stat) contentCell.push(stat);
      if (title) contentCell.push(title);
      if (description) contentCell.push(description);
      if (link && !(title == null ? void 0 : title.closest("a"))) contentCell.push(link);
      if (contentCell.length > 0) {
        cells.push([imageCell, contentCell]);
      }
    });
    if (cells.length === 0) {
      const fallback = element.querySelector("h2, h3, h4, p");
      if (fallback) cells.push([document.createTextNode(""), fallback]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-esg", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/footer.js
  function parse11(element, { document }) {
    var _a, _b;
    const cells = [];
    const logo = element.querySelector(".cmp-image--abbvie-logo img, .cmp-image img");
    const primaryList = element.querySelector(".list-footer-primary .cmp-list");
    const row1Col1 = [];
    if (logo) {
      const img = document.createElement("img");
      img.src = logo.src || logo.getAttribute("src");
      img.alt = logo.alt || "AbbVie";
      row1Col1.push(img);
    }
    const row1Col2 = [];
    if (primaryList) {
      const links = primaryList.querySelectorAll(".cmp-list__item-link");
      links.forEach((link) => {
        var _a2;
        const a = document.createElement("a");
        a.href = link.href || link.getAttribute("href");
        a.textContent = ((_a2 = link.querySelector(".cmp-list__item-title")) == null ? void 0 : _a2.textContent.trim()) || link.textContent.trim();
        const p = document.createElement("p");
        p.appendChild(a);
        row1Col2.push(p);
      });
    }
    if (row1Col1.length > 0 || row1Col2.length > 0) {
      cells.push([row1Col1.length > 0 ? row1Col1 : document.createTextNode(""), row1Col2.length > 0 ? row1Col2 : document.createTextNode("")]);
    }
    const socialList = element.querySelector(".list-icons .cmp-list");
    if (socialList) {
      const socialLinks = socialList.querySelectorAll(".cmp-list__item-link");
      const socialCol = [];
      socialLinks.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.href || link.getAttribute("href");
        const iconImg = link.querySelector("img");
        if (iconImg) {
          const img = document.createElement("img");
          img.src = iconImg.src || iconImg.getAttribute("src");
          img.alt = iconImg.alt || "";
          a.appendChild(img);
        } else {
          a.textContent = link.textContent.trim();
        }
        socialCol.push(a);
      });
      if (socialCol.length > 0) {
        cells.push([socialCol, document.createTextNode("")]);
      }
    }
    const headers = element.querySelectorAll(".mini-header .cmp-header__text");
    const standardLists = element.querySelectorAll(".list-standard .cmp-list");
    const row3Col1 = [];
    const row3Col2 = [];
    if (headers.length >= 1 && standardLists.length >= 1) {
      const h3a = document.createElement("h3");
      h3a.textContent = ((_a = headers[0]) == null ? void 0 : _a.textContent.trim()) || "Popular pages";
      row3Col1.push(h3a);
      const links1 = standardLists[0].querySelectorAll(".cmp-list__item-link");
      links1.forEach((link) => {
        var _a2;
        const a = document.createElement("a");
        a.href = link.href || link.getAttribute("href");
        a.textContent = ((_a2 = link.querySelector(".cmp-list__item-title")) == null ? void 0 : _a2.textContent.trim()) || link.textContent.trim();
        const p = document.createElement("p");
        p.appendChild(a);
        row3Col1.push(p);
      });
    }
    if (headers.length >= 2 && standardLists.length >= 2) {
      const h3b = document.createElement("h3");
      h3b.textContent = ((_b = headers[1]) == null ? void 0 : _b.textContent.trim()) || "External links";
      row3Col2.push(h3b);
      const links2 = standardLists[1].querySelectorAll(".cmp-list__item-link");
      links2.forEach((link) => {
        var _a2;
        const a = document.createElement("a");
        a.href = link.href || link.getAttribute("href");
        a.textContent = ((_a2 = link.querySelector(".cmp-list__item-title")) == null ? void 0 : _a2.textContent.trim()) || link.textContent.trim();
        const p = document.createElement("p");
        p.appendChild(a);
        row3Col2.push(p);
      });
    }
    if (row3Col1.length > 0 || row3Col2.length > 0) {
      cells.push([row3Col1.length > 0 ? row3Col1 : document.createTextNode(""), row3Col2.length > 0 ? row3Col2 : document.createTextNode("")]);
    }
    const legalTexts = element.querySelectorAll(".cmp-text-xx-large .cmp-text p");
    if (legalTexts.length > 0) {
      const legalCol = [];
      legalTexts.forEach((p) => {
        const text = p.textContent.trim();
        if (text) {
          const para = document.createElement("p");
          para.textContent = text;
          legalCol.push(para);
        }
      });
      if (legalCol.length > 0) {
        cells.push([legalCol, document.createTextNode("")]);
      }
    }
    const legalList = element.querySelector(".list-footer-legal .cmp-list");
    if (legalList) {
      const legalLinks = legalList.querySelectorAll(".cmp-list__item-link");
      const legalLinksCol = [];
      legalLinks.forEach((link) => {
        var _a2;
        const a = document.createElement("a");
        a.href = link.href || link.getAttribute("href");
        a.textContent = ((_a2 = link.querySelector(".cmp-list__item-title")) == null ? void 0 : _a2.textContent.trim()) || link.textContent.trim();
        legalLinksCol.push(a);
        legalLinksCol.push(document.createTextNode(" | "));
      });
      if (legalLinksCol.length > 1) {
        legalLinksCol.pop();
        cells.push([legalLinksCol, document.createTextNode("")]);
      }
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "footer", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/abbvie-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      element.querySelectorAll("div[data-cmp-src]").forEach((div) => {
        const realSrc = div.getAttribute("data-cmp-src");
        const img = div.querySelector("img");
        if (img && realSrc) {
          img.src = realSrc;
        }
      });
      element.querySelectorAll("img[data-src], img[data-lazy]").forEach((img) => {
        const realSrc = img.getAttribute("data-src") || img.getAttribute("data-lazy");
        if (realSrc && !realSrc.startsWith("data:")) {
          img.src = realSrc;
        }
      });
      element.querySelectorAll("img").forEach((img) => {
        if (img.src.startsWith("data:") || img.src.startsWith("blob:")) {
          const parent = img.closest("[data-cmp-src]");
          if (parent) {
            img.src = parent.getAttribute("data-cmp-src");
          }
        }
      });
      element.querySelectorAll("img").forEach((img) => {
        if (img.src && img.src.includes("scene7.com/is/image/")) {
          try {
            const u = new URL(img.src);
            u.search = "";
            img.src = u.href;
          } catch (_) {
          }
        }
      });
      WebImporter.DOMUtils.remove(element, [
        "#onetrust-consent-sdk",
        "#onetrust-banner-sdk",
        ".optanon-alert-box-wrapper",
        '[class*="cookie"]'
      ]);
      WebImporter.DOMUtils.remove(element, [
        ".vjs-text-track-display",
        ".vjs-loading-spinner",
        ".vjs-control-bar",
        ".vjs-modal-dialog",
        ".vjs-error-display",
        ".vjs-caption-settings",
        ".vjs-poster"
      ]);
      WebImporter.DOMUtils.remove(element, [
        ".cmp-home-hero__alternative.hide"
      ]);
      WebImporter.DOMUtils.remove(element, [
        ".stories-empty-results-container",
        ".cmp-list-buttons"
      ]);
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, [
        ".cmp-experiencefragment--header",
        "header.nav-bar"
      ]);
      WebImporter.DOMUtils.remove(element, [
        ".cmp-experiencefragment--footer"
      ]);
      WebImporter.DOMUtils.remove(element, [
        ".separator",
        ".cmp-separator"
      ]);
      WebImporter.DOMUtils.remove(element, [
        "iframe",
        "noscript",
        "link"
      ]);
      element.querySelectorAll("img").forEach((img) => {
        const src = img.src || "";
        if (src.includes("t.co/") || src.includes("analytics.twitter.com") || src.includes("bing.com/c.gif") || src.includes("facebook.com/tr") || !img.alt && (src.includes("adsct") || src.includes("pixel"))) {
          img.remove();
        }
      });
      element.querySelectorAll('a[href^="blob:"]').forEach((a) => {
        const parent = a.parentElement;
        while (a.firstChild) parent.insertBefore(a.firstChild, a);
        a.remove();
      });
      element.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("data-track");
        el.removeAttribute("data-analytics");
        el.removeAttribute("onclick");
        el.removeAttribute("data-cmp-data-layer");
      });
    }
  }

  // tools/importer/transformers/abbvie-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform2(hookName, element, payload) {
    if (hookName === TransformHook2.afterTransform) {
      const template = payload && payload.template;
      if (!template || !template.sections || template.sections.length < 2) return;
      const document = element.ownerDocument;
      const sections = template.sections;
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
        let sectionEl = null;
        for (const sel of selectors) {
          try {
            sectionEl = element.querySelector(sel);
            if (sectionEl) break;
          } catch (e) {
          }
        }
        if (!sectionEl) continue;
        if (section.style) {
          const sectionMetadata = WebImporter.Blocks.createBlock(document, {
            name: "Section Metadata",
            cells: { style: section.style }
          });
          sectionEl.after(sectionMetadata);
        }
        if (i > 0) {
          const hr = document.createElement("hr");
          sectionEl.before(hr);
        }
      }
    }
  }

  // tools/importer/import-homepage.js
  var parsers = {
    "hero-homepage": parse,
    "cards-news": parse2,
    "columns-intro": parse3,
    "hero-video": parse4,
    "cards-dashboard": parse5,
    "columns-media": parse6,
    "cards-text": parse7,
    "cards-cta": parse8,
    "columns-info": parse9,
    "cards-esg": parse10,
    "footer": parse11
  };
  var PAGE_TEMPLATE = {
    name: "homepage",
    description: "AbbVie corporate homepage with hero, featured content sections, and corporate navigation",
    urls: [
      "https://www.abbvie.com/"
    ],
    blocks: [
      {
        name: "hero-homepage",
        instances: [".homepage-hero-controller .cmp-home-hero__primary.active .container.linear-gradient"]
      },
      {
        name: "cards-news",
        instances: [".container.homepage-overlap"]
      },
      {
        name: "columns-intro",
        instances: [".container.cmp-container-xxx-large.height-default.align-center > .cmp-container > .grid > .grid-container > .grid-row"]
      },
      {
        name: "hero-video",
        instances: [".video-js.bc-player-default_default"]
      },
      {
        name: "cards-dashboard",
        instances: ["#maincontent .cardpagestory.card-dashboard.show-image-hide-desc, #maincontent .dashboardcards.medium-theme.hide-image, #maincontent .dashboardcards.dark-theme.hide-image"]
      },
      {
        name: "columns-media",
        instances: [".container.cmp-container-xxx-large.height-short > .cmp-container > .grid"]
      },
      {
        name: "cards-text",
        instances: [".container.cmp-container-xxx-large.height-short .grid-row .grid-cell .text"]
      },
      {
        name: "cards-cta",
        instances: [".container.large-radius.cmp-container-full-width.height-default.no-bottom-margin"]
      },
      {
        name: "columns-info",
        instances: [".container.medium-radius.cmp-container-medium.height-short.align-center"]
      },
      {
        name: "cards-esg",
        instances: [".container.large-radius.cmp-container-full-width.height-short.footer-overlap .grid-row"]
      },
      {
        name: "footer",
        instances: [".cmp-experiencefragment--footer"]
      }
    ],
    sections: [
      {
        id: "header",
        name: "Header",
        selector: ".cmp-experiencefragment--header",
        style: null,
        blocks: [],
        defaultContent: []
      },
      {
        id: "hero",
        name: "Homepage Hero",
        selector: ".homepage-hero-controller",
        style: "dark",
        blocks: ["hero-homepage"],
        defaultContent: []
      },
      {
        id: "news-feed",
        name: "News Feed",
        selector: ".container.homepage-overlap",
        style: null,
        blocks: ["cards-news"],
        defaultContent: []
      },
      {
        id: "patient-stories",
        name: "Patient Stories",
        selector: ".container.cmp-container-xxx-large.height-default.align-center",
        style: null,
        blocks: ["columns-intro", "hero-video"],
        defaultContent: []
      },
      {
        id: "science-innovation",
        name: "Science and Innovation",
        selector: "#maincontent > .aem-Grid > .responsivegrid:nth-child(3)",
        style: null,
        blocks: ["columns-intro", "cards-dashboard"],
        defaultContent: []
      },
      {
        id: "podcast",
        name: "Podcast",
        selector: ".container.cmp-container-xxx-large.height-short",
        style: null,
        blocks: ["columns-media"],
        defaultContent: []
      },
      {
        id: "culture-community",
        name: "Culture of Community",
        selector: "#maincontent > .aem-Grid > .responsivegrid:nth-child(5)",
        style: null,
        blocks: ["columns-intro", "cards-text", "cards-cta"],
        defaultContent: []
      },
      {
        id: "invest-creating",
        name: "Investor Relations",
        selector: ".container.medium-radius.cmp-container-medium.height-short.align-center",
        style: null,
        blocks: ["columns-intro", "columns-info"],
        defaultContent: []
      },
      {
        id: "esg-impact",
        name: "ESG Impact",
        selector: ".container.large-radius.cmp-container-full-width.height-short.footer-overlap",
        style: "dark",
        blocks: ["columns-intro", "cards-esg"],
        defaultContent: []
      },
      {
        id: "footer",
        name: "Footer",
        selector: ".cmp-experiencefragment--footer",
        style: "dark",
        blocks: ["footer"],
        defaultContent: []
      }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), {
      template: PAGE_TEMPLATE
    });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
  function findBlocksOnPage(document, template) {
    const pageBlocks = [];
    template.blocks.forEach((blockDef) => {
      blockDef.instances.forEach((selector) => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((element) => {
            pageBlocks.push({
              name: blockDef.name,
              selector,
              element,
              section: blockDef.section || null
            });
          });
        } catch (e) {
          console.warn(`Invalid selector for block "${blockDef.name}": ${selector}`, e);
        }
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_homepage_default = {
    transform: (payload) => {
      const { document, url, html, params } = payload;
      const main = document.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        const parser = parsers[block.name];
        if (parser) {
          try {
            parser(block.element, { document, url, params });
          } catch (e) {
            console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
          }
        } else {
          console.warn(`No parser found for block: ${block.name}`);
        }
      });
      executeTransformers("afterTransform", main, payload);
      const hr = document.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document);
      WebImporter.rules.transformBackgroundImages(main, document);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const path = WebImporter.FileUtils.sanitizePath(
        new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/index"
      );
      return [{
        element: main,
        path,
        report: {
          title: document.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_homepage_exports);
})();
