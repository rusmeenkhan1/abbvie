/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroHomepageParser from './parsers/hero-homepage.js';
import cardsNewsParser from './parsers/cards-news.js';
import columnsIntroParser from './parsers/columns-intro.js';
import heroVideoParser from './parsers/hero-video.js';
import cardsDashboardParser from './parsers/cards-dashboard.js';
import columnsMediaParser from './parsers/columns-media.js';
import cardsTextParser from './parsers/cards-text.js';
import cardsCtaParser from './parsers/cards-cta.js';
import columnsInfoParser from './parsers/columns-info.js';
import cardsEsgParser from './parsers/cards-esg.js';
import footerParser from './parsers/footer.js';

// TRANSFORMER IMPORTS
import abbvieCleanupTransformer from './transformers/abbvie-cleanup.js';
import abbvieSectionsTransformer from './transformers/abbvie-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-homepage': heroHomepageParser,
  'cards-news': cardsNewsParser,
  'columns-intro': columnsIntroParser,
  'hero-video': heroVideoParser,
  'cards-dashboard': cardsDashboardParser,
  'columns-media': columnsMediaParser,
  'cards-text': cardsTextParser,
  'cards-cta': cardsCtaParser,
  'columns-info': columnsInfoParser,
  'cards-esg': cardsEsgParser,
  'footer': footerParser,
};

// PAGE TEMPLATE CONFIGURATION
const PAGE_TEMPLATE = {
  name: 'homepage',
  description: 'AbbVie corporate homepage with hero, featured content sections, and corporate navigation',
  urls: [
    'https://www.abbvie.com/'
  ],
  blocks: [
    {
      name: 'hero-homepage',
      instances: ['.homepage-hero-controller .cmp-home-hero__primary.active .container.linear-gradient']
    },
    {
      name: 'cards-news',
      instances: ['.container.homepage-overlap']
    },
    {
      name: 'columns-intro',
      instances: ['.container.cmp-container-xxx-large.height-default.align-center > .cmp-container > .grid > .grid-container > .grid-row']
    },
    {
      name: 'hero-video',
      instances: ['.video-js.bc-player-default_default']
    },
    {
      name: 'cards-dashboard',
      instances: ['#maincontent .cardpagestory.card-dashboard.show-image-hide-desc, #maincontent .dashboardcards.medium-theme.hide-image, #maincontent .dashboardcards.dark-theme.hide-image']
    },
    {
      name: 'columns-media',
      instances: ['.container.cmp-container-xxx-large.height-short > .cmp-container > .grid']
    },
    {
      name: 'cards-text',
      instances: ['.container.cmp-container-xxx-large.height-short .grid-row .grid-cell .text']
    },
    {
      name: 'cards-cta',
      instances: ['.container.large-radius.cmp-container-full-width.height-default.no-bottom-margin']
    },
    {
      name: 'columns-info',
      instances: ['.container.medium-radius.cmp-container-medium.height-short.align-center']
    },
    {
      name: 'cards-esg',
      instances: ['.container.large-radius.cmp-container-full-width.height-short.footer-overlap .grid-row']
    },
    {
      name: 'footer',
      instances: ['.cmp-experiencefragment--footer']
    }
  ],
  sections: [
    {
      id: 'header',
      name: 'Header',
      selector: '.cmp-experiencefragment--header',
      style: null,
      blocks: [],
      defaultContent: []
    },
    {
      id: 'hero',
      name: 'Homepage Hero',
      selector: '.homepage-hero-controller',
      style: 'dark',
      blocks: ['hero-homepage'],
      defaultContent: []
    },
    {
      id: 'news-feed',
      name: 'News Feed',
      selector: '.container.homepage-overlap',
      style: null,
      blocks: ['cards-news'],
      defaultContent: []
    },
    {
      id: 'patient-stories',
      name: 'Patient Stories',
      selector: '.container.cmp-container-xxx-large.height-default.align-center',
      style: null,
      blocks: ['columns-intro', 'hero-video'],
      defaultContent: []
    },
    {
      id: 'science-innovation',
      name: 'Science and Innovation',
      selector: '#maincontent > .aem-Grid > .responsivegrid:nth-child(3)',
      style: null,
      blocks: ['columns-intro', 'cards-dashboard'],
      defaultContent: []
    },
    {
      id: 'podcast',
      name: 'Podcast',
      selector: '.container.cmp-container-xxx-large.height-short',
      style: null,
      blocks: ['columns-media'],
      defaultContent: []
    },
    {
      id: 'culture-community',
      name: 'Culture of Community',
      selector: '#maincontent > .aem-Grid > .responsivegrid:nth-child(5)',
      style: null,
      blocks: ['columns-intro', 'cards-text', 'cards-cta'],
      defaultContent: []
    },
    {
      id: 'invest-creating',
      name: 'Investor Relations',
      selector: '.container.medium-radius.cmp-container-medium.height-short.align-center',
      style: null,
      blocks: ['columns-intro', 'columns-info'],
      defaultContent: []
    },
    {
      id: 'esg-impact',
      name: 'ESG Impact',
      selector: '.container.large-radius.cmp-container-full-width.height-short.footer-overlap',
      style: 'dark',
      blocks: ['columns-intro', 'cards-esg'],
      defaultContent: []
    },
    {
      id: 'footer',
      name: 'Footer',
      selector: '.cmp-experiencefragment--footer',
      style: 'dark',
      blocks: ['footer'],
      defaultContent: []
    }
  ]
};

// TRANSFORMER REGISTRY
const transformers = [
  abbvieCleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [abbvieSectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = {
    ...payload,
    template: PAGE_TEMPLATE
  };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration
 */
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

export default {
  transform: (payload) => {
    const { document, url, html, params } = payload;
    const main = document.body;

    // 1. Execute beforeTransform transformers (initial cleanup)
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page using embedded template
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block using registered parsers
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

    // 4. Execute afterTransform transformers (final cleanup + section breaks)
    executeTransformers('afterTransform', main, payload);

    // 5. Apply WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Generate sanitized path
    const path = WebImporter.FileUtils.sanitizePath(
      new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/index'
    );

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      }
    }];
  }
};
