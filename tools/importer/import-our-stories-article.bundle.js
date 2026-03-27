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

  // tools/importer/import-our-stories-article.js
  var import_our_stories_article_exports = {};
  __export(import_our_stories_article_exports, {
    default: () => import_our_stories_article_default
  });

  // tools/importer/parsers/hero-article.js
  function parse(element, { document }) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const heroImg = element.querySelector(".cmp-container__bg-image, img");
    const overlapEl = element.nextElementSibling;
    const isOverlap = overlapEl && (overlapEl.classList.contains("overlap-predecessor") || overlapEl.className.includes("overlap-predecessor"));
    const headerEl = isOverlap ? overlapEl : null;
    const backLinkEl = headerEl == null ? void 0 : headerEl.querySelector(".button.back-cta .cmp-button, .back-cta a");
    const backLinkText = ((_b = (_a = backLinkEl == null ? void 0 : backLinkEl.querySelector(".cmp-button__text")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_c = backLinkEl == null ? void 0 : backLinkEl.textContent) == null ? void 0 : _c.trim()) || "All Stories";
    const backLinkHref = (backLinkEl == null ? void 0 : backLinkEl.getAttribute("href")) || "/who-we-are/our-stories.html";
    const storyInfo = headerEl == null ? void 0 : headerEl.querySelector(".storyinfo");
    const storyParagraphs = storyInfo ? [...storyInfo.querySelectorAll("p")] : [];
    const firstP = storyParagraphs[0];
    let dateText = "";
    let categoryText = "";
    if (firstP) {
      const catLink = firstP.querySelector("a");
      categoryText = ((_d = catLink == null ? void 0 : catLink.textContent) == null ? void 0 : _d.trim()) || "";
      const fullText = firstP.textContent.trim();
      if (catLink && categoryText) {
        dateText = fullText.replace(categoryText, "").trim();
      } else {
        dateText = fullText;
      }
    }
    const readTimeText = ((_f = (_e = storyParagraphs[1]) == null ? void 0 : _e.textContent) == null ? void 0 : _f.trim()) || "";
    const h1 = headerEl == null ? void 0 : headerEl.querySelector("h1, .cmp-title__text");
    const titleText = ((_g = h1 == null ? void 0 : h1.textContent) == null ? void 0 : _g.trim()) || "";
    const subtitleEl = headerEl == null ? void 0 : headerEl.querySelector(".text.cmp-text-xx-large .cmp-text, .body-unica-32-reg");
    const subtitleText = ((_h = subtitleEl == null ? void 0 : subtitleEl.textContent) == null ? void 0 : _h.trim()) || "";
    const cells = [];
    if (heroImg) {
      const img = document.createElement("img");
      img.src = heroImg.src || heroImg.getAttribute("src") || "";
      img.alt = heroImg.alt || heroImg.getAttribute("alt") || "";
      cells.push([img]);
    }
    const backTextEl = document.createTextNode(backLinkText);
    const backUrlLink = document.createElement("a");
    backUrlLink.href = backLinkHref;
    backUrlLink.textContent = backLinkHref;
    cells.push([backTextEl, backUrlLink]);
    cells.push([dateText, categoryText, readTimeText]);
    const titleEl = document.createElement("h1");
    titleEl.textContent = titleText;
    cells.push([titleEl]);
    const subtitleP = document.createElement("p");
    subtitleP.textContent = subtitleText;
    cells.push([subtitleP]);
    const block = WebImporter.Blocks.createBlock(document, {
      name: "hero-article",
      cells
    });
    element.replaceWith(block);
    if (headerEl) {
      headerEl.remove();
    }
  }

  // tools/importer/parsers/cards-related.js
  function parse2(element, { document }) {
    var _a, _b, _c, _d, _e, _f;
    const img = element.querySelector(".card-image, img");
    const dateEl = element.querySelector(".card-metadata-date");
    const categoryEl = element.querySelector(".card-metadata-tag");
    const titleEl = element.querySelector(".card-title, h4");
    const descEl = element.querySelector(".card-description, p.card-description");
    const ctaEl = element.querySelector(".card-cta-read-article");
    const cardLink = element.closest("a") || element.querySelector("a");
    const cardHref = (cardLink == null ? void 0 : cardLink.getAttribute("href")) || "";
    const imageCell = [];
    if (img) {
      const newImg = document.createElement("img");
      const srcset = (_b = (_a = img.closest("picture")) == null ? void 0 : _a.querySelector("source")) == null ? void 0 : _b.getAttribute("srcset");
      newImg.src = srcset || img.src || img.getAttribute("src") || "";
      newImg.alt = img.alt || img.getAttribute("alt") || "";
      imageCell.push(newImg);
    }
    const contentCell = [];
    const category = ((_c = categoryEl == null ? void 0 : categoryEl.textContent) == null ? void 0 : _c.trim()) || "";
    if (category) {
      const catP = document.createElement("p");
      catP.textContent = category;
      contentCell.push(catP);
    }
    const title = ((_d = titleEl == null ? void 0 : titleEl.textContent) == null ? void 0 : _d.trim()) || "";
    if (title) {
      const titleP = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = title;
      titleP.append(strong);
      contentCell.push(titleP);
    }
    const desc = ((_e = descEl == null ? void 0 : descEl.textContent) == null ? void 0 : _e.trim()) || "";
    if (desc) {
      const descP = document.createElement("p");
      descP.textContent = desc;
      contentCell.push(descP);
    }
    if (cardHref) {
      const ctaP = document.createElement("p");
      const link = document.createElement("a");
      link.href = cardHref;
      link.textContent = ((_f = ctaEl == null ? void 0 : ctaEl.textContent) == null ? void 0 : _f.trim()) || "Read story";
      ctaP.append(link);
      contentCell.push(ctaP);
    }
    const cells = [[imageCell, contentCell]];
    const block = WebImporter.Blocks.createBlock(document, {
      name: "cards-related",
      cells
    });
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

  // tools/importer/import-our-stories-article.js
  var parsers = {
    "hero-article": parse,
    "cards-related": parse2
  };
  var transformers = [
    transform
  ];
  var PAGE_TEMPLATE = {
    name: "our-stories-article",
    description: "AbbVie Our Stories article page - long-form story/article content under /who-we-are/our-stories/",
    blocks: [
      {
        name: "hero-article",
        instances: [
          ".container.large-radius.cmp-container-full-width"
        ]
      },
      {
        name: "cards-related",
        instances: [
          ".cardpagestory"
        ]
      }
    ],
    sections: [
      {
        id: "section-1",
        name: "Hero & Story Header",
        selector: [
          ".container.large-radius.cmp-container-full-width",
          ".container.overlap-predecessor"
        ],
        style: null,
        blocks: ["hero-article"],
        defaultContent: []
      },
      {
        id: "section-2",
        name: "Article Body",
        selector: ".grid-row__col-with-8",
        style: null,
        blocks: [],
        defaultContent: [
          ".title h2",
          ".text .cmp-text p",
          ".separator",
          ".image .cmp-image",
          ".title h5",
          ".text.cmp-text-x-large .cmp-text"
        ]
      },
      {
        id: "section-3",
        name: "Related Content",
        selector: ".grid-row__col-with-2:last-child",
        style: null,
        blocks: ["cards-related"],
        defaultContent: [
          ".header .cmp-header__text"
        ]
      },
      {
        id: "section-4",
        name: "Metadata",
        selector: "head",
        style: null,
        blocks: [],
        defaultContent: []
      }
    ]
  };
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
    if (hookName === "afterTransform" && PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1) {
      try {
        transform2.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error("Sections transformer failed:", e);
      }
    }
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
  var import_our_stories_article_default = {
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
  return __toCommonJS(import_our_stories_article_exports);
})();
