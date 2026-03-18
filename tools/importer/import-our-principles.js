/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroInteriorParser from './parsers/hero-interior.js';
import embedVideoParser from './parsers/embed-video.js';
import accordionPrinciplesParser from './parsers/accordion-principles.js';
import quoteCeoParser from './parsers/quote-ceo.js';
import cardsRelatedParser from './parsers/cards-related.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/abbvie-cleanup.js';
import sectionsTransformer from './transformers/abbvie-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-interior': heroInteriorParser,
  'embed-video': embedVideoParser,
  'accordion-principles': accordionPrinciplesParser,
  'quote-ceo': quoteCeoParser,
  'cards-related': cardsRelatedParser,
};

// PAGE TEMPLATE CONFIGURATION
const PAGE_TEMPLATE = {
  name: 'our-principles',
  description: 'AbbVie Our Principles page - corporate values and principles content page under Who We Are section',
  urls: [
    'https://www.abbvie.com/who-we-are/our-principles.html',
  ],
  blocks: [
    {
      name: 'hero-interior',
      instances: [
        '.abbvie-container.large-radius.cmp-container-full-width.height-default',
        '.abbvie-container.overlap-predecessor',
      ],
    },
    {
      name: 'embed-video',
      instances: [
        '.video.cmp-video-full-width',
      ],
    },
    {
      name: 'accordion-principles',
      instances: [
        '.accordion.cmp-accordion-medium',
      ],
    },
    {
      name: 'quote-ceo',
      instances: [
        '.abbvie-container.semi-transparent-layer .quote.cmp-quote-large',
      ],
    },
    {
      name: 'cards-related',
      instances: [
        '#container-71624373e4 .grid-row:has(.cardpagestory)',
      ],
    },
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Hero',
      selector: [
        '.abbvie-container.large-radius.cmp-container-full-width.height-default',
        '.abbvie-container.overlap-predecessor',
      ],
      style: null,
      blocks: ['hero-interior'],
      defaultContent: [],
    },
    {
      id: 'section-2',
      name: 'Principles Intro',
      selector: '#container-19b96aeaf5',
      style: null,
      blocks: [],
      defaultContent: [
        '#container-19b96aeaf5 .cmp-title__text',
        '#container-19b96aeaf5 .cmp-text p',
      ],
    },
    {
      id: 'section-3',
      name: 'Video',
      selector: '.video.cmp-video-full-width',
      style: null,
      blocks: ['embed-video'],
      defaultContent: [],
    },
    {
      id: 'section-4',
      name: 'Body Text',
      selector: '#container-14eb95722c',
      style: null,
      blocks: [],
      defaultContent: [
        '#container-14eb95722c .cmp-text p',
      ],
    },
    {
      id: 'section-5',
      name: 'Accordion Principles',
      selector: '.accordion.cmp-accordion-medium',
      style: null,
      blocks: ['accordion-principles'],
      defaultContent: [],
    },
    {
      id: 'section-6',
      name: 'CEO Quote',
      selector: '.abbvie-container.semi-transparent-layer',
      style: 'dark-overlay',
      blocks: ['quote-ceo'],
      defaultContent: [],
    },
    {
      id: 'section-7',
      name: 'Related Content',
      selector: '.abbvie-container.cmp-container-full-width.no-bottom-margin:has(#container-71624373e4)',
      style: null,
      blocks: ['cards-related'],
      defaultContent: [
        '#title-8d51d53c2c .cmp-title__text',
      ],
    },
  ],
};

// TRANSFORMER REGISTRY
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = {
    ...payload,
    template: PAGE_TEMPLATE,
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
            section: blockDef.section || null,
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

    // 4. Execute afterTransform transformers (final cleanup + section breaks/metadata)
    executeTransformers('afterTransform', main, payload);

    // 5. Apply WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Generate sanitized path
    const path = WebImporter.FileUtils.sanitizePath(
      new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.html$/, ''),
    );

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
