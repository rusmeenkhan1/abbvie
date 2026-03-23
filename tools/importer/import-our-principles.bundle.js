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

  // tools/importer/import-our-principles.js
  var import_our_principles_exports = {};
  __export(import_our_principles_exports, {
    default: () => import_our_principles_default
  });

  // tools/importer/parsers/hero-interior.js
  function parse(element, { document }) {
    var _a, _b;
    const bgImage = element.querySelector('.cmp-container__bg-image, img[class*="bg"]');
    const overlapContainer = ((_b = (_a = element.nextElementSibling) == null ? void 0 : _a.classList) == null ? void 0 : _b.contains("overlap-predecessor")) ? element.nextElementSibling : element.querySelector(".overlap-predecessor");
    const contentSource = overlapContainer || element;
    const heading = contentSource.querySelector("h1.cmp-title__text, h1, h2.cmp-title__text, h2");
    const subtitle = contentSource.querySelector(".cmp-text p, .body-unica-32-reg, p");
    const cells = [];
    if (bgImage) {
      cells.push([bgImage]);
    }
    const contentCell = [];
    if (heading) contentCell.push(heading);
    if (subtitle) contentCell.push(subtitle);
    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-interior", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/embed-video.js
  function parse2(element, { document }) {
    const iframe = element.querySelector('iframe.youtube-video, iframe[src*="youtube"], iframe[data-iframesrc*="youtube"]');
    const videoDiv = !iframe ? element.querySelector('div.youtube-video[data-iframesrc], [data-iframesrc*="youtube"]') : null;
    let youtubeUrl = "";
    const videoEl = iframe || videoDiv;
    if (videoEl) {
      const src = videoEl.getAttribute("src") || videoEl.getAttribute("data-iframesrc") || "";
      const match = src.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&]+)/);
      if (match) {
        youtubeUrl = `https://www.youtube.com/watch?v=${match[1]}`;
      }
    }
    const posterImg = element.querySelector(".cmp-video__image img, .cmp-image__image, img");
    const contentCell = [];
    if (posterImg) {
      contentCell.push(posterImg);
    }
    if (youtubeUrl) {
      const link = document.createElement("a");
      link.href = youtubeUrl;
      link.textContent = youtubeUrl;
      contentCell.push(link);
    }
    const cells = [];
    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "embed-video", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/accordion-principles.js
  function parse3(element, { document }) {
    const items = element.querySelectorAll(".cmp-accordion__item");
    const cells = [];
    items.forEach((item) => {
      const titleEl = item.querySelector(".cmp-accordion__title");
      const title = titleEl ? titleEl.textContent.trim() : "";
      const panel = item.querySelector(".cmp-accordion__panel");
      const contentText = panel ? panel.querySelector(".cmp-text p, p") : null;
      const titleCell = document.createElement("p");
      titleCell.textContent = title;
      if (contentText) {
        cells.push([titleCell, contentText]);
      } else if (panel) {
        cells.push([titleCell, panel]);
      } else {
        const emptyContent = document.createElement("p");
        emptyContent.textContent = "";
        cells.push([titleCell, emptyContent]);
      }
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "accordion-principles", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/quote-ceo.js
  function parse4(element, { document }) {
    const quoteTextEl = element.querySelector(".cmp-quote__text");
    let quoteText = "";
    if (quoteTextEl) {
      const clone = quoteTextEl.cloneNode(true);
      const iconSpan = clone.querySelector(".abbvie-icon-quote");
      if (iconSpan) iconSpan.remove();
      quoteText = clone.textContent.trim();
    }
    const authorNameEl = element.querySelector(".author-name");
    const authorTitleEl = element.querySelector(".author-title");
    const authorName = authorNameEl ? authorNameEl.textContent.trim() : "";
    const authorTitle = authorTitleEl ? authorTitleEl.textContent.trim() : "";
    const cells = [];
    const quoteP = document.createElement("p");
    quoteP.textContent = quoteText;
    cells.push([quoteP]);
    const attributionCell = [];
    if (authorName) {
      const nameP = document.createElement("p");
      const nameEm = document.createElement("em");
      nameEm.textContent = authorName;
      nameP.appendChild(nameEm);
      attributionCell.push(nameP);
    }
    if (authorTitle) {
      const titleP = document.createElement("p");
      titleP.textContent = authorTitle;
      attributionCell.push(titleP);
    }
    if (attributionCell.length > 0) {
      cells.push(attributionCell);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "quote-ceo", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-related.js
  function parse5(element, { document }) {
    const cards = element.querySelectorAll('.cardpagestory, [class*="cardpagestory"]');
    const cells = [];
    cards.forEach((card) => {
      const img = card.querySelector(".card-image, img");
      const eyebrow = card.querySelector(".card-eyebrow");
      const heading = card.querySelector(".card-title, h4, h3");
      const description = card.querySelector(".card-description, p");
      const cta = card.querySelector(".card-cta, a.card-cta");
      const cardLink = card.querySelector("a[href]");
      const imageCell = img || document.createElement("span");
      const textCell = [];
      if (eyebrow) {
        const eyebrowP = document.createElement("p");
        eyebrowP.textContent = eyebrow.textContent.trim();
        textCell.push(eyebrowP);
      }
      if (heading) {
        const headingEl = document.createElement("strong");
        headingEl.textContent = heading.textContent.trim();
        const headingP = document.createElement("p");
        headingP.appendChild(headingEl);
        textCell.push(headingP);
      }
      if (description) {
        const descP = document.createElement("p");
        descP.textContent = description.textContent.trim();
        textCell.push(descP);
      }
      if (cardLink) {
        const link = document.createElement("a");
        link.href = cardLink.getAttribute("href") || "";
        link.textContent = cta ? cta.textContent.trim() : "Learn More";
        const linkP = document.createElement("p");
        linkP.appendChild(link);
        textCell.push(linkP);
      }
      if (textCell.length > 0) {
        cells.push([imageCell, textCell]);
      }
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-related", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/abbvie-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, [
        "#onetrust-consent-sdk",
        "#onetrust-banner-sdk",
        "#onetrust-pc-sdk"
      ]);
      WebImporter.DOMUtils.remove(element, [".skip-link", 'a[href="#maincontent"]']);
      element.querySelectorAll("img").forEach((img) => {
        var _a;
        const src = img.getAttribute("src") || "";
        const isPlaceholder = src.startsWith("data:image/gif") || src.startsWith("data:image/svg");
        const isBlob = src.startsWith("blob:");
        const isEmpty = !src;
        if (isPlaceholder || isBlob || isEmpty) {
          const cmpImage = img.closest(".cmp-image, [data-cmp-src]");
          if (cmpImage) {
            const cmpSrc = cmpImage.getAttribute("data-cmp-src");
            if (cmpSrc && !cmpSrc.startsWith("blob:") && !cmpSrc.startsWith("data:")) {
              let normalizedSrc = cmpSrc;
              if (cmpSrc.includes("scene7.com/is/image/")) {
                const baseUrl = cmpSrc.split("?")[0];
                normalizedSrc = `${baseUrl}?fmt=webp`;
              }
              img.setAttribute("src", normalizedSrc);
              return;
            }
          }
          const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-lazy") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src");
          if (dataSrc && !dataSrc.startsWith("blob:") && !dataSrc.startsWith("data:")) {
            img.setAttribute("src", dataSrc);
            return;
          }
          const picture = img.closest("picture");
          if (picture) {
            const sources = picture.querySelectorAll("source[srcset]");
            for (const source of sources) {
              const srcset = source.getAttribute("srcset");
              if (srcset && !srcset.startsWith("blob:") && !srcset.startsWith("data:")) {
                img.setAttribute("src", srcset.split(",")[0].trim().split(" ")[0]);
                return;
              }
            }
          }
          const noscript = (_a = img.parentElement) == null ? void 0 : _a.querySelector("noscript");
          if (noscript) {
            const match = noscript.textContent.match(/src=["']([^"']+)["']/);
            if (match) {
              img.setAttribute("src", match[1]);
              return;
            }
          }
          if (isBlob || isPlaceholder) {
            img.removeAttribute("src");
          }
        }
      });
      element.querySelectorAll("video").forEach((video) => {
        const src = video.getAttribute("src") || "";
        if (src.startsWith("blob:")) {
          video.removeAttribute("src");
        }
      });
      WebImporter.DOMUtils.remove(element, [
        ".xf-popup",
        ".cmp-xfpopup",
        '[class*="popup"]',
        '[role="alertdialog"]',
        '[role="dialog"]',
        "#onetrust-consent-sdk"
      ]);
      element.querySelectorAll("button, span, p, h5, a").forEach((el) => {
        const text = el.textContent.trim();
        if (text === "CLOSE" || text === "Yes, I agree" || text === "No, I disagree" || text.includes("You are about to leave") || text.includes("product-specific site Internet site") || text === "Cookies Settings") {
          el.remove();
        }
      });
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, [
        "header.nav-bar",
        ".cmp-experiencefragment--header",
        ".cmp-experiencefragment--footer",
        "noscript",
        "link",
        "iframe"
      ]);
      element.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src") || "";
        if (src.includes("t.co/i/adsct") || src.includes("analytics.twitter.com") || src.includes("metrics.brightcove.com") || src.includes("adservice.google.com") || src.includes("reddit.com/rp.gif") || src.includes("siteimproveanalytics") || src.includes("adsrvr.org") || src.includes("casalemedia.com") || src.includes("google.com/pagead") || src.includes("insight.adsrvr.org")) {
          img.remove();
        }
      });
      element.querySelectorAll("button, span, h5, p, a").forEach((el) => {
        const text = el.textContent.trim();
        if (text.includes("You are about to leave") || text === "CLOSE" || text === "No, I disagree" || text === "Yes, I agree" || text === "Cookies Settings" || text.includes("product-specific site Internet site")) {
          el.remove();
        }
      });
      element.querySelectorAll("*").forEach((el) => {
        el.removeAttribute("data-track");
        el.removeAttribute("data-analytics");
        el.removeAttribute("onclick");
      });
    }
  }

  // tools/importer/transformers/abbvie-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform2(hookName, element, payload) {
    if (hookName === TransformHook2.afterTransform) {
      const { template } = payload;
      if (!template || !template.sections || template.sections.length < 2) return;
      const { document } = element.ownerDocument ? { document: element.ownerDocument } : { document };
      const doc = element.ownerDocument || document;
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
          const sectionMetadata = WebImporter.Blocks.createBlock(doc, {
            name: "Section Metadata",
            cells: { style: section.style }
          });
          sectionEl.after(sectionMetadata);
        }
        if (i > 0 && sectionEl.previousElementSibling) {
          const hr = doc.createElement("hr");
          sectionEl.before(hr);
        }
      }
    }
  }

  // tools/importer/import-our-principles.js
  var parsers = {
    "hero-interior": parse,
    "embed-video": parse2,
    "accordion-principles": parse3,
    "quote-ceo": parse4,
    "cards-related": parse5
  };
  var PAGE_TEMPLATE = {
    name: "our-principles",
    description: "AbbVie Our Principles page - corporate values and principles content page under Who We Are section",
    urls: [
      "https://www.abbvie.com/who-we-are/our-principles.html"
    ],
    blocks: [
      {
        name: "hero-interior",
        instances: [
          ".abbvie-container.large-radius.cmp-container-full-width.height-default",
          ".abbvie-container.overlap-predecessor"
        ]
      },
      {
        name: "embed-video",
        instances: [
          ".video.cmp-video-full-width"
        ]
      },
      {
        name: "accordion-principles",
        instances: [
          ".accordion.cmp-accordion-medium"
        ]
      },
      {
        name: "quote-ceo",
        instances: [
          ".abbvie-container.semi-transparent-layer .quote.cmp-quote-large"
        ]
      },
      {
        name: "cards-related",
        instances: [
          "#container-71624373e4 .grid-row:has(.cardpagestory)"
        ]
      }
    ],
    sections: [
      {
        id: "section-1",
        name: "Hero",
        selector: [
          ".abbvie-container.large-radius.cmp-container-full-width.height-default",
          ".abbvie-container.overlap-predecessor"
        ],
        style: null,
        blocks: ["hero-interior"],
        defaultContent: []
      },
      {
        id: "section-2",
        name: "Principles Intro",
        selector: "#container-19b96aeaf5",
        style: null,
        blocks: [],
        defaultContent: [
          "#container-19b96aeaf5 .cmp-title__text",
          "#container-19b96aeaf5 .cmp-text p"
        ]
      },
      {
        id: "section-3",
        name: "Video",
        selector: ".video.cmp-video-full-width",
        style: null,
        blocks: ["embed-video"],
        defaultContent: []
      },
      {
        id: "section-4",
        name: "Body Text",
        selector: "#container-14eb95722c",
        style: null,
        blocks: [],
        defaultContent: [
          "#container-14eb95722c .cmp-text p"
        ]
      },
      {
        id: "section-5",
        name: "Accordion Principles",
        selector: ".accordion.cmp-accordion-medium",
        style: null,
        blocks: ["accordion-principles"],
        defaultContent: []
      },
      {
        id: "section-6",
        name: "CEO Quote",
        selector: ".abbvie-container.semi-transparent-layer",
        style: "dark-overlay",
        blocks: ["quote-ceo"],
        defaultContent: []
      },
      {
        id: "section-7",
        name: "Related Content",
        selector: ".abbvie-container.cmp-container-full-width.no-bottom-margin:has(#container-71624373e4)",
        style: null,
        blocks: ["cards-related"],
        defaultContent: [
          "#title-8d51d53c2c .cmp-title__text"
        ]
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
          console.warn(`Block "${blockDef.name}" selector failed: ${selector}`, e);
        }
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_our_principles_default = {
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
        new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html$/, "")
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
  return __toCommonJS(import_our_principles_exports);
})();
