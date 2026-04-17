var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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
    const video = element.querySelector("video");
    const posterSrc = video ? video.getAttribute("poster") : null;
    const bgImage = element.querySelector(".cmp-home-hero__bg-image img, .cmp-image__image, .vjs-poster img");
    const vjsPoster = element.querySelector(".vjs-poster");
    let vjsPosterUrl = null;
    if (vjsPoster) {
      const style = vjsPoster.getAttribute("style") || "";
      const match = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/);
      if (match) vjsPosterUrl = match[1];
    }
    const anyImg = element.querySelector('img[src]:not([src=""])');
    const heading = element.querySelector(".cmp-title__text, h1, h2");
    const description = element.querySelector(".cmp-text p, .cmp-home-hero__description");
    const ctaLink = element.querySelector('.cmp-button, a[class*="cta"], a[class*="button"]');
    const cells = [];
    if (posterSrc && !posterSrc.startsWith("blob:")) {
      const img = document.createElement("img");
      img.src = posterSrc;
      img.alt = "Hero background";
      cells.push([img]);
    } else if (bgImage && bgImage.getAttribute("src") && !bgImage.getAttribute("src").startsWith("blob:")) {
      cells.push([bgImage]);
    } else if (vjsPosterUrl && !vjsPosterUrl.startsWith("blob:")) {
      const img = document.createElement("img");
      img.src = vjsPosterUrl;
      img.alt = "Hero background";
      cells.push([img]);
    } else if (anyImg && anyImg.getAttribute("src") && !anyImg.getAttribute("src").startsWith("blob:")) {
      cells.push([anyImg]);
    } else if (posterSrc) {
      const img = document.createElement("img");
      img.src = posterSrc;
      img.alt = "Hero background";
      cells.push([img]);
    }
    const contentCell = [];
    if (heading) contentCell.push(heading);
    if (description) contentCell.push(description);
    if (ctaLink) contentCell.push(ctaLink);
    if (contentCell.length > 0) cells.push(contentCell);
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-homepage", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-news.js
  function parse2(element, { document }) {
    const cells = [];
    const carouselItems = element.querySelectorAll(".carousel-rss__link, .splide__slide a");
    carouselItems.forEach((item) => {
      const eyebrow = item.querySelector(".carousel-rss__eyebrow, .card-eyebrow");
      const title = item.querySelector(".carousel-rss__title, .card-title, p, h4");
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) {
        const h = document.createElement("h4");
        h.textContent = title.textContent.trim();
        textCell.push(h);
      }
      if (item.href) {
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = "Read more";
        textCell.push(a);
      }
      if (textCell.length > 0) cells.push(["", textCell]);
    });
    const storyCards = element.querySelectorAll(".cardpagestory");
    storyCards.forEach((card) => {
      const image = card.querySelector("img.card-image, .card-image-container img");
      const eyebrow = card.querySelector(".card-eyebrow, .card-metadata-tag");
      const date = card.querySelector(".card-metadata-date");
      const title = card.querySelector(".card-title, h4, h3");
      const description = card.querySelector(".card-description, p.card-description");
      const cta = card.querySelector(".card-cta, .card-cta-read-article");
      const link = card.closest("a") || card.querySelector("a");
      const imageCell = image ? [image] : [];
      const textCell = [];
      if (date) {
        const p = document.createElement("p");
        p.textContent = date.textContent.trim();
        textCell.push(p);
      }
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) textCell.push(title);
      if (description && description.textContent.trim()) textCell.push(description);
      if (cta && link) {
        const a = document.createElement("a");
        a.href = link.href || "#";
        a.textContent = cta.textContent.trim();
        textCell.push(a);
      }
      if (imageCell.length > 0 || textCell.length > 0) {
        cells.push([imageCell.length > 0 ? imageCell : "", textCell]);
      }
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-news", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/hero-video.js
  function parse3(element, { document }) {
    const posterImg = element.querySelector(".cmp-video__poster img, img.cmp-video__poster-image, img");
    const title = element.querySelector(".cmp-video__title, h3, h4, .cmp-title__text");
    const subtitle = element.querySelector(".cmp-video__description, .cmp-text p, p");
    const videoIframe = element.querySelector('iframe[src*="youtube"], iframe[src*="brightcove"]');
    const videoSrc = videoIframe ? videoIframe.src : null;
    const dataVideoId = element.getAttribute("data-video-id") || element.querySelector("[data-video-id]")?.getAttribute("data-video-id");
    const cells = [];
    if (posterImg) {
      cells.push([posterImg]);
    }
    const contentCell = [];
    if (title) contentCell.push(title);
    if (subtitle) contentCell.push(subtitle);
    if (videoSrc) {
      const videoLink = document.createElement("a");
      videoLink.href = videoSrc;
      videoLink.textContent = videoSrc;
      contentCell.push(videoLink);
    } else if (dataVideoId) {
      const videoLink = document.createElement("a");
      videoLink.href = "https://www.youtube.com/watch?v=" + dataVideoId;
      videoLink.textContent = "Video";
      contentCell.push(videoLink);
    }
    if (contentCell.length > 0) cells.push(contentCell);
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-video", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-dashboard.js
  function parse4(element, { document }) {
    const cells = [];
    const storyCards = element.querySelectorAll(".cardpagestory");
    storyCards.forEach((card) => {
      const image = card.querySelector("img.card-image, .card-image-container img");
      const eyebrow = card.querySelector(".card-eyebrow");
      const title = card.querySelector(".card-title, h4");
      const description = card.querySelector(".card-description");
      const cta = card.querySelector(".card-cta");
      const link = card.closest("a") || card.querySelector("a");
      const imageCell = image ? [image] : [];
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) textCell.push(title);
      if (description && description.textContent.trim()) textCell.push(description);
      if (cta && link) {
        const a = document.createElement("a");
        a.href = link.href || "#";
        a.textContent = cta.textContent.trim();
        textCell.push(a);
      }
      cells.push([imageCell, textCell]);
    });
    const dashCards = element.querySelectorAll(".dashboardcards .dashboard-card-facts");
    dashCards.forEach((card) => {
      const eyebrow = card.querySelector(".eyebrow");
      const dataPoint = card.querySelector(".data-point");
      const dataSuffix = card.querySelector(".data-point-suffix");
      const description = card.querySelector(".description");
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (dataPoint) {
        const h = document.createElement("h4");
        h.textContent = (dataPoint.textContent.trim() || "") + (dataSuffix ? dataSuffix.textContent.trim() : "");
        textCell.push(h);
      }
      if (description) {
        const p = document.createElement("p");
        p.textContent = description.textContent.trim();
        textCell.push(p);
      }
      cells.push(["", textCell]);
    });
    const linkCards = element.querySelectorAll(".dashboardcards .dashboard-card_link__list");
    linkCards.forEach((card) => {
      const eyebrow = card.querySelector(".linkcard-eyebrow");
      const title = card.querySelector(".linkcard-title, h5");
      const links = card.querySelectorAll(".linkcard-link");
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) textCell.push(title);
      links.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.href || "#";
        a.textContent = link.querySelector(".link-text")?.textContent.trim() || link.textContent.trim();
        textCell.push(a);
      });
      cells.push(["", textCell]);
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-dashboard", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-intro.js
  function parse5(element, { document }) {
    let image = null;
    const imgEl = element.querySelector(".cmp-image--small img, .cmp-image img");
    if (imgEl) {
      const src = imgEl.getAttribute("src") || "";
      if (src && !src.startsWith("blob:") && !src.startsWith("data:image/svg")) {
        image = imgEl;
      } else {
        const picture = imgEl.closest("picture");
        if (picture) {
          const source = picture.querySelector("source[srcset]");
          if (source) {
            const srcset = source.getAttribute("srcset");
            if (srcset && !srcset.startsWith("blob:")) {
              image = document.createElement("img");
              image.src = srcset.split(",")[0].trim().split(" ")[0];
              image.alt = imgEl.alt || "";
            }
          }
        }
      }
    }
    if (!image) {
      element.querySelectorAll("img").forEach((img) => {
        if (image) return;
        const src = img.getAttribute("src") || "";
        if (src && !src.startsWith("blob:") && !src.startsWith("data:image/svg")) {
          image = img;
        }
      });
    }
    const eyebrow = element.querySelector(".cmp-teaser__pretitle, .cmp-text p:first-child");
    const heading = element.querySelector(".cmp-title__text, h3, h4, h5");
    const descriptions = element.querySelectorAll(".cmp-text p");
    let description = null;
    if (descriptions.length > 1) {
      description = descriptions[descriptions.length - 1];
    } else if (descriptions.length === 1 && !eyebrow) {
      description = descriptions[0];
    }
    const cta = element.querySelector('a.cmp-button, a[class*="cta"], .cmp-button');
    const imageCell = image ? [image] : [];
    const textCell = [];
    if (eyebrow && eyebrow.textContent.trim()) {
      const p = document.createElement("p");
      p.textContent = eyebrow.textContent.trim();
      textCell.push(p);
    }
    if (heading) textCell.push(heading);
    if (description) textCell.push(description);
    if (cta) {
      const a = document.createElement("a");
      a.href = cta.href || cta.closest("a")?.href || "#";
      a.textContent = cta.textContent.trim() || "Learn more";
      textCell.push(a);
    }
    const cells = [[imageCell, textCell]];
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-intro", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-info.js
  function findValidImage(container, document) {
    const imgs = container.querySelectorAll("img");
    for (const img of imgs) {
      const src = img.getAttribute("src") || "";
      if (src && !src.startsWith("blob:") && !src.startsWith("data:image/svg")) {
        return img;
      }
    }
    const pictures = container.querySelectorAll("picture");
    for (const picture of pictures) {
      const source = picture.querySelector("source[srcset]");
      if (source) {
        const srcset = source.getAttribute("srcset");
        if (srcset && !srcset.startsWith("blob:")) {
          const img = document.createElement("img");
          img.src = srcset.split(",")[0].trim().split(" ")[0];
          img.alt = picture.querySelector("img")?.alt || "";
          return img;
        }
      }
    }
    return null;
  }
  function parse6(element, { document }) {
    const gridCols = element.querySelectorAll(".grid-row__col-with-4.grid-cell");
    const colCells = [];
    gridCols.forEach((col) => {
      const image = findValidImage(col, document);
      const text = col.querySelector(".cmp-text p, p");
      const cta = col.querySelector("a.cmp-button, .cmp-button");
      const ctaLink = cta ? cta.closest("a") || cta : null;
      const cellContent = [];
      if (image) cellContent.push(image);
      if (text) cellContent.push(text);
      if (ctaLink) {
        const a = document.createElement("a");
        a.href = ctaLink.href || "#";
        a.textContent = ctaLink.textContent.trim();
        cellContent.push(a);
      }
      colCells.push(cellContent);
    });
    const cells = colCells.length > 0 ? [colCells] : [];
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-info", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-media.js
  function parse7(element, { document }) {
    const heading = element.querySelector(".cmp-title__text, h4, h3, h2");
    const description = element.querySelector(".cmp-text p, p");
    const cta = element.querySelector("a.cmp-button, .cmp-button");
    const ctaLink = cta ? cta.closest("a") || cta : null;
    const leftCell = [];
    if (heading) leftCell.push(heading);
    if (description) leftCell.push(description);
    const rightCell = [];
    if (ctaLink) {
      const a = document.createElement("a");
      a.href = ctaLink.href || "#";
      a.textContent = ctaLink.textContent.trim();
      rightCell.push(a);
    }
    const cells = [[leftCell, rightCell]];
    const block = WebImporter.Blocks.createBlock(document, { name: "columns-media", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-cta.js
  function parse8(element, { document }) {
    const cells = [];
    const storyCards = element.querySelectorAll(".cardpagestory");
    storyCards.forEach((card) => {
      const image = card.querySelector("img.card-image, .card-image-container img");
      const eyebrow = card.querySelector(".card-eyebrow");
      const title = card.querySelector(".card-title, h4");
      const description = card.querySelector(".card-description");
      const cta = card.querySelector(".card-cta");
      const link = card.closest("a") || card.querySelector("a");
      const imageCell = image ? [image] : [];
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) textCell.push(title);
      if (description && description.textContent.trim()) textCell.push(description);
      if (cta && link) {
        const a = document.createElement("a");
        a.href = link.href || "#";
        a.textContent = cta.textContent.trim();
        textCell.push(a);
      }
      cells.push([imageCell, textCell]);
    });
    const linkCards = element.querySelectorAll(".dashboardcards .dashboard-card_link__list");
    linkCards.forEach((card) => {
      const eyebrow = card.querySelector(".linkcard-eyebrow");
      const title = card.querySelector(".linkcard-title, h5");
      const links = card.querySelectorAll(".linkcard-link");
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) textCell.push(title);
      links.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.href || "#";
        a.textContent = link.querySelector(".link-text")?.textContent.trim() || link.textContent.trim();
        textCell.push(a);
      });
      cells.push(["", textCell]);
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-cta", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-esg.js
  function parse9(element, { document }) {
    const cells = [];
    const bgImage = element.querySelector('.cmp-container__bg-image, img[class*="bg"]');
    if (bgImage) {
      cells.push([bgImage]);
    }
    const statCards = element.querySelectorAll(".dashboard-card-facts");
    statCards.forEach((card) => {
      const eyebrow = card.querySelector(".eyebrow");
      const dataPoint = card.querySelector(".data-point");
      const dataSuffix = card.querySelector(".data-point-suffix");
      const description = card.querySelector(".description");
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (dataPoint) {
        const h = document.createElement("h4");
        h.textContent = (dataPoint.textContent.trim() || "") + (dataSuffix ? dataSuffix.textContent.trim() : "");
        textCell.push(h);
      }
      if (description) {
        const p = document.createElement("p");
        p.textContent = description.textContent.trim();
        textCell.push(p);
      }
      cells.push(["", textCell]);
    });
    const storyCards = element.querySelectorAll(".cardpagestory");
    storyCards.forEach((card) => {
      const image = card.querySelector("img.card-image, .card-image-container img");
      const eyebrow = card.querySelector(".card-eyebrow");
      const title = card.querySelector(".card-title, h4");
      const description = card.querySelector(".card-description");
      const cta = card.querySelector(".card-cta");
      const link = card.closest("a") || card.querySelector("a");
      const imageCell = image ? [image] : [];
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) textCell.push(title);
      if (description && description.textContent.trim()) textCell.push(description);
      if (cta && link) {
        const a = document.createElement("a");
        a.href = link.href || "#";
        a.textContent = cta.textContent.trim();
        textCell.push(a);
      }
      cells.push([imageCell, textCell]);
    });
    const linkCards = element.querySelectorAll(".dashboard-card_link__list");
    linkCards.forEach((card) => {
      const eyebrow = card.querySelector(".linkcard-eyebrow");
      const title = card.querySelector(".linkcard-title, h5");
      const links = card.querySelectorAll(".linkcard-link");
      const textCell = [];
      if (eyebrow) {
        const p = document.createElement("p");
        p.textContent = eyebrow.textContent.trim();
        textCell.push(p);
      }
      if (title) textCell.push(title);
      links.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.href || "#";
        a.textContent = link.querySelector(".link-text")?.textContent.trim() || link.textContent.trim();
        textCell.push(a);
      });
      cells.push(["", textCell]);
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-esg", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/footer.js
  function parse10(element, { document }) {
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
          const noscript = img.parentElement?.querySelector("noscript");
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

  // tools/importer/import-homepage.js
  var parsers = {
    "hero-homepage": parse,
    "cards-news": parse2,
    "hero-video": parse3,
    "cards-dashboard": parse4,
    "columns-intro": parse5,
    "columns-info": parse6,
    "columns-media": parse7,
    "cards-cta": parse8,
    "cards-esg": parse9,
    "footer": parse10
  };
  var transformers = [
    transform
  ];
  var PAGE_TEMPLATE = {
    name: "homepage",
    description: "AbbVie corporate homepage with hero, news cards, video hero, dashboard cards, columns sections, and footer",
    urls: [
      "https://www.abbvie.com/"
    ],
    blocks: [
      { name: "hero-homepage", instances: [".cmp-home-hero"] },
      { name: "cards-news", instances: [".homepage-overlap"] },
      { name: "hero-video", instances: [".cmp-video--youtube"] },
      { name: "cards-dashboard", instances: [".grid-row:has(.cardpagestory):has(.dashboardcards):not(:has(.dashboard-card_link__list))"] },
      { name: "columns-intro", instances: [".cmp-container:has(.cmp-image--small):has(.cmp-title)"] },
      { name: "columns-info", instances: [".cmp-grid-custom:has(.grid-row__col-with-4)"] },
      { name: "columns-media", instances: [".abbvie-container.medium-radius:has(.dark-theme)"] },
      { name: "cards-cta", instances: [".grid:not(.cmp-grid-custom):has(.cardpagestory):has(.dashboard-card_link__list)"] },
      { name: "cards-esg", instances: [".cmp-container:has(.cmp-container__bg-image):has(.dashboard-card-facts)"] },
      { name: "footer", instances: [".cmp-experiencefragment--footer"] }
    ],
    sections: [
      { id: "section-1", name: "Hero", selector: ".homepage-hero-controller", style: null, blocks: ["hero-homepage"], defaultContent: [] },
      { id: "section-2", name: "News & Featured", selector: ".homepage-overlap", style: null, blocks: ["cards-news"], defaultContent: [] },
      { id: "section-3", name: "Patients Teaser", selector: "#section01.cmp-teaser", style: null, blocks: [], defaultContent: ["#section01 .cmp-teaser__title", "#section01 .cmp-teaser__description", "#section01 .cmp-teaser__action-link"] },
      { id: "section-4", name: "Video Feature", selector: ".video.cmp-video-xx-large", style: null, blocks: ["hero-video"], defaultContent: [] },
      { id: "section-5", name: "Science & Innovation", selector: "#teaser-a2987e48b8", style: null, blocks: ["cards-dashboard"], defaultContent: ["#teaser-a2987e48b8 .cmp-teaser__pretitle", "#teaser-a2987e48b8 .cmp-teaser__title", "#teaser-a2987e48b8 .cmp-teaser__description"] },
      { id: "section-6", name: "Podcast", selector: ".abbvie-container.default-radius.cmp-container-xxx-large", style: null, blocks: ["columns-intro"], defaultContent: [] },
      { id: "section-7", name: "Culture of Curiosity", selector: "#section02.cmp-teaser", style: null, blocks: ["columns-info"], defaultContent: ["#section02 .cmp-teaser__pretitle", "#section02 .cmp-teaser__title", "#section02 .cmp-teaser__description"] },
      { id: "section-8", name: "Explore Opportunities CTA", selector: ".abbvie-container.medium-radius:has(.dark-theme)", style: "navy-gradient", blocks: ["columns-media"], defaultContent: [] },
      { id: "section-9", name: "Investor Resources", selector: "#section03.cmp-teaser", style: null, blocks: ["cards-cta"], defaultContent: ["#section03 .cmp-teaser__pretitle", "#section03 .cmp-teaser__title", "#section03 .cmp-teaser__description"] },
      { id: "section-10", name: "ESG", selector: "#section04.cmp-teaser", style: null, blocks: ["cards-esg"], defaultContent: ["#section04 .cmp-teaser__pretitle", "#section04 .cmp-teaser__title", "#section04 .cmp-teaser__description"] },
      { id: "section-11", name: "Footer", selector: ".cmp-experiencefragment--footer", style: "dark", blocks: ["footer"], defaultContent: [] }
    ]
  };
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
    const allTransformers = [...transformers];
    if (hookName === "afterTransform" && PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1) {
      allTransformers.push(transform2);
    }
    allTransformers.forEach((transformerFn) => {
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
          console.warn(`Invalid selector for "${blockDef.name}": ${selector}`);
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
