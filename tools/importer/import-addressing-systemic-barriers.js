/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroInteriorParser from './parsers/hero-interior.js';
import embedVideoParser from './parsers/embed-video.js';
import cardsRelatedParser from './parsers/cards-related.js';
import columnsImpactParser from './parsers/columns-impact.js';

// TRANSFORMER IMPORTS
import abbvieCleanupTransformer from './transformers/abbvie-cleanup.js';
import abbvieSectionsTransformer from './transformers/abbvie-sections.js';

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'addressing-systemic-barriers',
  urls: [
    'https://www.abbvie.com/sustainability/abbvie-foundation/addressing-systemic-barriers.html',
  ],
  description: 'AbbVie Foundation page about addressing systemic barriers in sustainability initiatives',
  blocks: [
    {
      name: 'hero-interior',
      instances: [
        '#maincontent .abbvie-container.large-radius.cmp-container-full-width.height-default:not(.footer-overlap)',
      ],
    },
    {
      name: 'embed-video',
      instances: [
        '#container-d677408707 .video.cmp-video-full-width',
      ],
    },
    {
      name: 'cards-related',
      instances: [
        '.abbvie-container.float',
      ],
    },
    {
      name: 'columns-impact',
      instances: [
        '#maincontent .abbvie-container.default-radius.cmp-container-full-width.height-default',
      ],
    },
  ],
  sections: [
    {
      id: 'section-1',
      name: 'Hero',
      selector: '#maincontent .abbvie-container.large-radius.cmp-container-full-width.height-default:not(.footer-overlap)',
      style: null,
      blocks: ['hero-interior'],
      defaultContent: [],
    },
    {
      id: 'section-2',
      name: 'Maternal Health Content',
      selector: '.grid.no-bottom-margin:has(#container-d677408707)',
      style: null,
      blocks: ['embed-video', 'cards-related'],
      defaultContent: [
        '#container-d677408707 .cmp-title',
        '#container-d677408707 .cmp-text',
      ],
    },
    {
      id: 'section-3',
      name: 'Program Impact',
      selector: '#maincontent .abbvie-container.default-radius.cmp-container-full-width.height-default',
      style: null,
      blocks: ['columns-impact'],
      defaultContent: [],
    },
  ],
};

// PARSER REGISTRY
const parsers = {
  'hero-interior': heroInteriorParser,
  'embed-video': embedVideoParser,
  'cards-related': cardsRelatedParser,
  'columns-impact': columnsImpactParser,
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
          });
        });
      } catch (e) {
        console.warn(`Invalid selector for block "${blockDef.name}": ${selector}`);
      }
    });
  });

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
