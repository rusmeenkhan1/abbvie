/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroArticleParser from './parsers/hero-article.js';
import cardsRelatedParser from './parsers/cards-related.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/abbvie-cleanup.js';
import sectionsTransformer from './transformers/abbvie-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-article': heroArticleParser,
  'cards-related': cardsRelatedParser,
};

// TRANSFORMER REGISTRY
const transformers = [
  cleanupTransformer,
];

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'our-stories-article',
  description: 'AbbVie Our Stories article page - long-form story/article content under /who-we-are/our-stories/',
  blocks: [
    {
      name: 'hero-article',
      instances: [
        '.container.large-radius.cmp-container-full-width',
      ],
    },
    {
      name: 'cards-related',
      instances: [
        '.cardpagestory',
      ],
    },
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Hero & Story Header',
      selector: [
        '.container.large-radius.cmp-container-full-width',
        '.container.overlap-predecessor',
      ],
      style: null,
      blocks: ['hero-article'],
      defaultContent: [],
    },
    {
      id: 'section-2',
      name: 'Article Body',
      selector: '.grid-row__col-with-8',
      style: null,
      blocks: [],
      defaultContent: [
        '.title h2',
        '.text .cmp-text p',
        '.separator',
        '.image .cmp-image',
        '.title h5',
        '.text.cmp-text-x-large .cmp-text',
      ],
    },
    {
      id: 'section-3',
      name: 'Related Content',
      selector: '.grid-row__col-with-2:last-child',
      style: null,
      blocks: ['cards-related'],
      defaultContent: [
        '.header .cmp-header__text',
      ],
    },
    {
      id: 'section-4',
      name: 'Metadata',
      selector: 'head',
      style: null,
      blocks: [],
      defaultContent: [],
    },
  ],
};

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = {
    ...payload,
    template: PAGE_TEMPLATE,
  };

  // Run cleanup transformers
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });

  // Run sections transformer in afterTransform only (needs template sections)
  if (hookName === 'afterTransform' && PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1) {
    try {
      sectionsTransformer.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error('Sections transformer failed:', e);
    }
  }
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
        console.warn(`Invalid selector for block "${blockDef.name}": ${selector}`);
      }
    });
  });

  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

// EXPORT DEFAULT CONFIGURATION
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
      new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.html$/, '')
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
