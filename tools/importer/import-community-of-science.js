/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroInteriorParser from './parsers/hero-interior.js';
import cardsStatsParser from './parsers/cards-stats.js';
import columnsShowcaseParser from './parsers/columns-showcase.js';
import columnsProgramsParser from './parsers/columns-programs.js';
import columnsCtaParser from './parsers/columns-cta.js';
import footerParser from './parsers/footer.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/abbvie-cleanup.js';
import sectionsTransformer from './transformers/abbvie-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-interior': heroInteriorParser,
  'cards-stats': cardsStatsParser,
  'columns-showcase': columnsShowcaseParser,
  'columns-programs': columnsProgramsParser,
  'columns-cta': columnsCtaParser,
  'footer': footerParser,
};

// PAGE TEMPLATE CONFIGURATION
const PAGE_TEMPLATE = {
  name: 'community-of-science',
  description: 'Science community page showcasing AbbVie\'s scientific people and community initiatives',
  urls: [
    'https://www.abbvie.com/science/our-people/community-of-science.html',
  ],
  blocks: [
    {
      name: 'hero-interior',
      instances: [
        '#maincontent .abbvie-container.large-radius.cmp-container-full-width.height-default:not(.footer-overlap)',
      ],
    },
    {
      name: 'cards-stats',
      instances: [
        '.abbvie-container.large-radius.cmp-container-full-width:has(.cmp-grid-full-page-5-v1)',
      ],
    },
    {
      name: 'columns-showcase',
      instances: [
        '#maincontent > .aem-Grid > .responsivegrid > .aem-Grid > .container:has(.grid-row):has(.cmp-header):not(:has(.separator-divider)):not(:has(.cmp-teaser))',
      ],
    },
    {
      name: 'columns-programs',
      instances: [
        '.grid:has(.grid-row__col-with-6):has(.separator-divider)',
      ],
    },
    {
      name: 'columns-cta',
      instances: [
        '#container-789c79eb77',
      ],
    },
    {
      name: 'footer',
      instances: [
        '.cmp-experiencefragment--footer',
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
      name: 'Stats Dashboard',
      selector: '.abbvie-container.large-radius.cmp-container-full-width:has(.cmp-grid-full-page-5-v1)',
      style: 'dark',
      blocks: ['cards-stats'],
      defaultContent: [],
    },
    {
      id: 'section-3',
      name: 'Programs Showcase',
      selector: '#maincontent > .aem-Grid > .responsivegrid > .aem-Grid > .container:has(.grid-row):has(.cmp-header):not(:has(.separator-divider)):not(:has(.cmp-teaser))',
      style: null,
      blocks: ['columns-showcase'],
      defaultContent: [],
    },
    {
      id: 'section-4',
      name: 'Programs at a Glance',
      selector: '#teaser-b1d0863457',
      style: null,
      blocks: ['columns-programs'],
      defaultContent: [
        '#teaser-b1d0863457 .cmp-teaser__pretitle',
        '#teaser-b1d0863457 .cmp-teaser__title',
        '#teaser-b1d0863457 .cmp-teaser__description',
      ],
    },
    {
      id: 'section-5',
      name: 'CTA',
      selector: '#container-789c79eb77',
      style: null,
      blocks: ['columns-cta'],
      defaultContent: [],
    },
    {
      id: 'section-6',
      name: 'Footer',
      selector: '.cmp-experiencefragment--footer',
      style: 'dark',
      blocks: ['footer'],
      defaultContent: [],
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
 * Find all blocks on the page based on template configuration
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

    // 1. Execute beforeTransform transformers
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block
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

    // 4. Execute afterTransform transformers (cleanup + section breaks)
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
