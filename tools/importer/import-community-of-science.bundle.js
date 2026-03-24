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

  // tools/importer/import-community-of-science.js
  var import_community_of_science_exports = {};
  __export(import_community_of_science_exports, {
    default: () => import_community_of_science_default
  });

  // tools/importer/parsers/hero-interior.js
  function parse(element, { document }) {
    const bgImage = element.querySelector('.cmp-container__bg-image, img[class*="bg-image"]');
    const heading = element.querySelector(".cmp-title__text, h1");
    const textBlocks = element.querySelectorAll(".cmp-text");
    const paragraphs = [];
    textBlocks.forEach((textBlock) => {
      const ps = textBlock.querySelectorAll("p");
      ps.forEach((p) => {
        const clone = p.cloneNode(true);
        clone.querySelectorAll("span").forEach((span) => {
          span.replaceWith(...span.childNodes);
        });
        paragraphs.push(clone);
      });
    });
    const cells = [];
    if (bgImage) {
      cells.push([bgImage]);
    }
    const contentCell = [];
    if (heading) contentCell.push(heading);
    contentCell.push(...paragraphs);
    if (contentCell.length > 0) {
      cells.push(contentCell);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-interior", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-stats.js
  function parse2(element, { document }) {
    const cards = element.querySelectorAll(".cmp-dashboardcard, .dashboard-card-facts");
    const cells = [];
    cards.forEach((card) => {
      const eyebrow = card.querySelector(".eyebrow");
      const dataPoint = card.querySelector(".data-point");
      const dataSuffix = card.querySelector(".data-point-suffix");
      const description = card.querySelector(".description");
      const contentCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        contentCell.push(p);
      }
      if (dataPoint) {
        const h4 = document.createElement("h4");
        let numberText = dataPoint.textContent.trim();
        if (dataSuffix) numberText += dataSuffix.textContent.trim();
        h4.textContent = numberText;
        contentCell.push(h4);
      }
      if (description) {
        const p = document.createElement("p");
        p.textContent = description.textContent.trim();
        contentCell.push(p);
      }
      if (contentCell.length > 0) {
        cells.push(contentCell);
      }
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-stats", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-showcase.js
  function parse3(element, { document }) {
    const grids = element.querySelectorAll(":scope .grid");
    const cells = [];
    grids.forEach((grid) => {
      const row = grid.querySelector(".grid-row");
      if (!row) return;
      const cols = row.querySelectorAll(':scope > .grid-cell, :scope > [class*="grid-row__col"]');
      if (cols.length < 2) return;
      let imageCol = null;
      let textCol = null;
      let imageFirst = false;
      cols.forEach((col, idx) => {
        const img = col.querySelector(".cmp-image__image, img");
        const hasText = col.querySelector(".cmp-header, .cmp-title, .cmp-text, h5, h4, h3");
        if (img && !imageCol) {
          imageCol = col;
          if (!textCol) imageFirst = true;
        }
        if (hasText && !textCol) {
          textCol = col;
        }
      });
      if (!imageCol && !textCol) return;
      const imgCell = [];
      if (imageCol) {
        const img = imageCol.querySelector("img");
        if (img) imgCell.push(img);
      }
      const txtCell = [];
      if (textCol) {
        const eyebrow = textCol.querySelector(".cmp-header__text, .cmp-header span");
        const heading = textCol.querySelector("h5, h4, h3, .cmp-title__text");
        const textContent = textCol.querySelector(".cmp-text p");
        const ctaLink = textCol.querySelector('.cmp-button, a[class*="cmp-button"]');
        if (eyebrow) {
          const p = document.createElement("p");
          p.textContent = eyebrow.textContent.trim();
          txtCell.push(p);
        }
        if (heading) txtCell.push(heading);
        if (textContent) txtCell.push(textContent);
        if (ctaLink) txtCell.push(ctaLink);
      }
      if (imgCell.length > 0 || txtCell.length > 0) {
        cells.push([imgCell.length > 0 ? imgCell : "", txtCell.length > 0 ? txtCell : ""]);
      }
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-showcase", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-programs.js
  function parse4(element, { document }) {
    const row = element.querySelector(".grid-row");
    if (!row) {
      element.replaceWith(document.createElement("div"));
      return;
    }
    const cols = row.querySelectorAll(':scope > .grid-cell, :scope > [class*="grid-row__col"]');
    let imageCol = null;
    let textCol = null;
    cols.forEach((col) => {
      const img = col.querySelector(".cmp-image__image, img");
      const hasText = col.querySelector(".cmp-title, h5, h4");
      if (img && !imageCol) imageCol = col;
      if (hasText && !textCol) textCol = col;
    });
    const imgCell = [];
    if (imageCol) {
      const img = imageCol.querySelector("img");
      if (img) imgCell.push(img);
    }
    const txtCell = [];
    if (textCol) {
      const titles = textCol.querySelectorAll("h5, h4, .cmp-title__text");
      const texts = textCol.querySelectorAll(".cmp-text p");
      titles.forEach((title, idx) => {
        if (idx > 0) {
          const hr = document.createElement("hr");
          txtCell.push(hr);
        }
        txtCell.push(title);
        if (texts[idx]) {
          txtCell.push(texts[idx]);
        }
      });
    }
    const cells = [];
    if (imgCell.length > 0 || txtCell.length > 0) {
      cells.push([imgCell.length > 0 ? imgCell : "", txtCell.length > 0 ? txtCell : ""]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-programs", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-cta.js
  function parse5(element, { document }) {
    const row = element.querySelector(".grid-row");
    if (!row) {
      element.replaceWith(document.createElement("div"));
      return;
    }
    const cols = row.querySelectorAll(':scope > .grid-cell, :scope > [class*="grid-row__col"]');
    let imageCol = null;
    let textCol = null;
    cols.forEach((col) => {
      const img = col.querySelector(".cmp-image__image, img");
      const hasText = col.querySelector(".cmp-title, h2, h3, .cmp-text");
      if (img && !imageCol) imageCol = col;
      if (hasText && !textCol) textCol = col;
    });
    const imgCell = [];
    if (imageCol) {
      const img = imageCol.querySelector("img");
      if (img) imgCell.push(img);
    }
    const txtCell = [];
    if (textCol) {
      const heading = textCol.querySelector("h2, h3, .cmp-title__text");
      const para = textCol.querySelector(".cmp-text p");
      const ctaLink = textCol.querySelector('.cmp-button, a[class*="cmp-button"]');
      if (heading) txtCell.push(heading);
      if (para) txtCell.push(para);
      if (ctaLink) txtCell.push(ctaLink);
    }
    const cells = [];
    if (imgCell.length > 0 || txtCell.length > 0) {
      cells.push([imgCell.length > 0 ? imgCell : "", txtCell.length > 0 ? txtCell : ""]);
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-cta", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/footer.js
  function parse6(element, { document }) {
    const cells = [];
    const seenHrefs = /* @__PURE__ */ new Set();
    function createLink(href, text) {
      if (!href || seenHrefs.has(href)) return null;
      seenHrefs.add(href);
      const a = document.createElement("a");
      a.href = href;
      a.textContent = text || href;
      return a;
    }
    const primaryLinks = [];
    const navLinks = element.querySelectorAll(".footer-nav a, .cmp-list a");
    navLinks.forEach((link) => {
      const text = link.textContent.trim();
      const href = link.href;
      if (text && href) {
        const a = createLink(href, text);
        if (a) primaryLinks.push(a);
      }
    });
    if (primaryLinks.length === 0) {
      element.querySelectorAll("a[href]").forEach((link) => {
        const text = link.textContent.trim();
        const href = link.href;
        if (text && href && !href.includes("#") && !href.includes("facebook") && !href.includes("twitter") && !href.includes("instagram") && !href.includes("linkedin") && !href.includes("youtube") && !href.includes("tiktok")) {
          const a = createLink(href, text);
          if (a) primaryLinks.push(a);
        }
      });
    }
    if (primaryLinks.length > 0) cells.push([primaryLinks]);
    const socialLinks = [];
    element.querySelectorAll("a[href]").forEach((link) => {
      const href = link.href || "";
      if (href.includes("facebook.com") || href.includes("twitter.com") || href.includes("instagram.com") || href.includes("linkedin.com") || href.includes("youtube.com") || href.includes("tiktok.com")) {
        const text = link.textContent.trim() || link.getAttribute("aria-label") || new URL(href).hostname.replace("www.", "");
        const a = createLink(href, text);
        if (a) socialLinks.push(a);
      }
    });
    if (socialLinks.length > 0) cells.push([socialLinks]);
    const legalTexts = [];
    element.querySelectorAll("p").forEach((p) => {
      const text = p.textContent.trim();
      if (text.length > 50 && (text.includes("trademark") || text.includes("Copyright") || text.includes("AbbVie Inc"))) {
        if (!legalTexts.some((t) => t.textContent === text)) {
          legalTexts.push(p);
        }
      }
    });
    legalTexts.forEach((p) => cells.push([p]));
    const block = WebImporter.Blocks.createBlock(document, { name: "footer", cells });
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
        if (src.startsWith("blob:")) {
          const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-lazy") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src");
          if (dataSrc) {
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
          img.removeAttribute("src");
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

  // tools/importer/import-community-of-science.js
  var parsers = {
    "hero-interior": parse,
    "cards-stats": parse2,
    "columns-showcase": parse3,
    "columns-programs": parse4,
    "columns-cta": parse5,
    "footer": parse6
  };
  var PAGE_TEMPLATE = {
    name: "community-of-science",
    description: "Science community page showcasing AbbVie's scientific people and community initiatives",
    urls: [
      "https://www.abbvie.com/science/our-people/community-of-science.html"
    ],
    blocks: [
      {
        name: "hero-interior",
        instances: [
          "#maincontent .abbvie-container.large-radius.cmp-container-full-width.height-default:not(.footer-overlap)"
        ]
      },
      {
        name: "cards-stats",
        instances: [
          ".abbvie-container.large-radius.cmp-container-full-width:has(.cmp-grid-full-page-5-v1)"
        ]
      },
      {
        name: "columns-showcase",
        instances: [
          "#maincontent > .aem-Grid > .responsivegrid > .aem-Grid > .container:has(.grid-row):has(.cmp-header):not(:has(.separator-divider)):not(:has(.cmp-teaser))"
        ]
      },
      {
        name: "columns-programs",
        instances: [
          ".grid:has(.grid-row__col-with-6):has(.separator-divider)"
        ]
      },
      {
        name: "columns-cta",
        instances: [
          "#container-789c79eb77"
        ]
      },
      {
        name: "footer",
        instances: [
          ".cmp-experiencefragment--footer"
        ]
      }
    ],
    sections: [
      {
        id: "section-1",
        name: "Hero",
        selector: "#maincontent .abbvie-container.large-radius.cmp-container-full-width.height-default:not(.footer-overlap)",
        style: null,
        blocks: ["hero-interior"],
        defaultContent: []
      },
      {
        id: "section-2",
        name: "Stats Dashboard",
        selector: ".abbvie-container.large-radius.cmp-container-full-width:has(.cmp-grid-full-page-5-v1)",
        style: "dark",
        blocks: ["cards-stats"],
        defaultContent: []
      },
      {
        id: "section-3",
        name: "Programs Showcase",
        selector: "#maincontent > .aem-Grid > .responsivegrid > .aem-Grid > .container:has(.grid-row):has(.cmp-header):not(:has(.separator-divider)):not(:has(.cmp-teaser))",
        style: null,
        blocks: ["columns-showcase"],
        defaultContent: []
      },
      {
        id: "section-4",
        name: "Programs at a Glance",
        selector: "#teaser-b1d0863457",
        style: null,
        blocks: ["columns-programs"],
        defaultContent: [
          "#teaser-b1d0863457 .cmp-teaser__pretitle",
          "#teaser-b1d0863457 .cmp-teaser__title",
          "#teaser-b1d0863457 .cmp-teaser__description"
        ]
      },
      {
        id: "section-5",
        name: "CTA",
        selector: "#container-789c79eb77",
        style: null,
        blocks: ["columns-cta"],
        defaultContent: []
      },
      {
        id: "section-6",
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
          console.warn(`Invalid selector for block "${blockDef.name}": ${selector}`);
        }
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_community_of_science_default = {
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
  return __toCommonJS(import_community_of_science_exports);
})();
