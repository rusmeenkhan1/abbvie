/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS - Import all parsers needed for this template
import heroInteriorParser from './parsers/hero-interior.js';
import quoteCeoParser from './parsers/quote-ceo.js';
import columnsContentParser from './parsers/columns-content.js';
import embedVideoParser from './parsers/embed-video.js';
import cardsRelatedParser from './parsers/cards-related.js';

// TRANSFORMER IMPORTS - Import all transformers found in tools/importer/transformers/
import abbvieCleanupTransformer from './transformers/abbvie-cleanup.js';
import abbvieSectionsTransformer from './transformers/abbvie-sections.js';

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'why-abbvie',
  description: 'AbbVie Why AbbVie page - Join Us career recruitment page showcasing company culture, benefits, and employee experience',
  urls: [
    'https://www.abbvie.com/join-us/why-abbvie.html',
  ],
  blocks: [
    {
      name: 'hero-interior',
      instances: [
        '.abbvie-container.large-radius.cmp-container-full-width.height-default.no-bottom-margin',
        '.abbvie-container.overlap-predecessor',
      ],
    },
    {
      name: 'quote-ceo',
      instances: [
        '.abbvie-container.semi-transparent-layer .quote.cmp-quote-x-large',
      ],
    },
    {
      name: 'columns-content',
      instances: [
        '.grid.cmp-grid-custom.aem-GridColumn:has(.grid-row__col-with-5)',
        '.grid.cmp-grid-custom.no-bottom-margin.aem-GridColumn:has(.grid-row__col-with-5)',
        '#container-8a03b815bf .grid:has(.grid-row__col-with-6)',
      ],
    },
    {
      name: 'embed-video',
      instances: [
        '.video.cmp-video-full-width',
      ],
    },
    {
      name: 'cards-related',
      instances: [
        '#container-48e385c3cb .grid-row:has(.cardpagestory)',
      ],
    },
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Hero',
      selector: [
        '.abbvie-container.large-radius.cmp-container-full-width.height-default.no-bottom-margin',
        '.abbvie-container.overlap-predecessor',
      ],
      style: null,
      blocks: ['hero-interior'],
      defaultContent: [],
    },
    {
      id: 'section-2',
      name: 'Employee Quote',
      selector: '.abbvie-container.semi-transparent-layer',
      style: 'dark-overlay',
      blocks: ['quote-ceo'],
      defaultContent: [],
    },
    {
      id: 'section-3',
      name: 'Purpose and Statistics',
      selector: [
        '.teaser.aem-GridColumn',
        '.grid.cmp-grid-custom.aem-GridColumn:has(.cmp-header)',
      ],
      style: null,
      blocks: ['columns-content'],
      defaultContent: [
        '#teaser-848789944f .cmp-teaser__pretitle',
        '#teaser-848789944f .cmp-teaser__title',
        '#teaser-848789944f .cmp-teaser__description',
      ],
    },
    {
      id: 'section-4',
      name: 'Culture Video',
      selector: '.video.cmp-video-full-width',
      style: null,
      blocks: ['embed-video'],
      defaultContent: [],
    },
    {
      id: 'section-5',
      name: 'Diversity and Recognition',
      selector: [
        '.grid.cmp-grid-custom.no-bottom-margin.aem-GridColumn:has(#image-e57f81e7d6)',
        '.grid.cmp-grid-custom.no-bottom-margin.aem-GridColumn:has(#image-20b8d7055d)',
      ],
      style: null,
      blocks: ['columns-content'],
      defaultContent: [
        '#title-4c12278885 .cmp-title__text',
        '#text-a43bba9e51 .cmp-text p',
        '#button-7cf701b8a6',
      ],
    },
    {
      id: 'section-6',
      name: 'Benefits',
      selector: '#container-76c182b4c4',
      style: 'light-grey',
      blocks: ['cards-related'],
      defaultContent: [
        '#title-7967251ed1 .cmp-title__text',
        '#text-6c3e472352 .cmp-text p',
      ],
    },
    {
      id: 'section-7',
      name: 'Growth and Learning',
      selector: '#container-8a03b815bf',
      style: null,
      blocks: ['columns-content'],
      defaultContent: [],
    },
    {
      id: 'section-8',
      name: 'CTA Banner',
      selector: '.abbvie-container.medium-radius.cmp-container-xxx-large.height-short',
      style: 'navy-blue',
      blocks: [],
      defaultContent: [
        '#title-01ad0bf01a .cmp-title__text',
        '#text-8f05388d27 .cmp-text p',
        '#button-c9789a0bdb',
      ],
    },
  ],
};

// PARSER REGISTRY - Map parser names to functions
const parsers = {
  'hero-interior': heroInteriorParser,
  'quote-ceo': quoteCeoParser,
  'columns-content': columnsContentParser,
  'embed-video': embedVideoParser,
  'cards-related': cardsRelatedParser,
};

// TRANSFORMER REGISTRY - Array of transformer functions
// Section transformer runs after cleanup in afterTransform hook
const transformers = [
  abbvieCleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [abbvieSectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 * @param {string} hookName - 'beforeTransform' or 'afterTransform'
 * @param {Element} element - The DOM element to transform
 * @param {Object} payload - { document, url, html, params }
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
 * @param {Document} document - The DOM document
 * @param {Object} template - The embedded PAGE_TEMPLATE object
 * @returns {Array} Array of block instances found on the page
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];

  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
  });

  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

// EXPORT DEFAULT CONFIGURATION
export default {
  /**
   * Main transformation function for why-abbvie template
   */
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
