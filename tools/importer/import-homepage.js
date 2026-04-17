/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroHomepageParser from './parsers/hero-homepage.js';
import cardsNewsParser from './parsers/cards-news.js';
import heroVideoParser from './parsers/hero-video.js';
import cardsDashboardParser from './parsers/cards-dashboard.js';
import columnsIntroParser from './parsers/columns-intro.js';
import columnsInfoParser from './parsers/columns-info.js';
import columnsMediaParser from './parsers/columns-media.js';
import cardsCtaParser from './parsers/cards-cta.js';
import cardsEsgParser from './parsers/cards-esg.js';
import footerParser from './parsers/footer.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/abbvie-cleanup.js';
import sectionsTransformer from './transformers/abbvie-sections.js';

// PARSER REGISTRY
const parsers = {
  'hero-homepage': heroHomepageParser,
  'cards-news': cardsNewsParser,
  'hero-video': heroVideoParser,
  'cards-dashboard': cardsDashboardParser,
  'columns-intro': columnsIntroParser,
  'columns-info': columnsInfoParser,
  'columns-media': columnsMediaParser,
  'cards-cta': cardsCtaParser,
  'cards-esg': cardsEsgParser,
  'footer': footerParser,
};

// TRANSFORMER REGISTRY
const transformers = [
  cleanupTransformer,
];

// PAGE TEMPLATE CONFIGURATION
const PAGE_TEMPLATE = {
  name: 'homepage',
  description: 'AbbVie corporate homepage with hero, news cards, video hero, dashboard cards, columns sections, and footer',
  urls: [
    'https://www.abbvie.com/',
  ],
  blocks: [
    { name: 'hero-homepage', instances: ['.cmp-home-hero'] },
    { name: 'cards-news', instances: ['.homepage-overlap'] },
    { name: 'hero-video', instances: ['.cmp-video--youtube'] },
    { name: 'cards-dashboard', instances: ['.grid-row:has(.cardpagestory):has(.dashboardcards):not(:has(.dashboard-card_link__list))'] },
    { name: 'columns-intro', instances: ['.cmp-container:has(.cmp-image--small):has(.cmp-title)'] },
    { name: 'columns-info', instances: ['.cmp-grid-custom:has(.grid-row__col-with-4)'] },
    { name: 'columns-media', instances: ['.abbvie-container.medium-radius:has(.dark-theme)'] },
    { name: 'cards-cta', instances: ['.grid:not(.cmp-grid-custom):has(.cardpagestory):has(.dashboard-card_link__list)'] },
    { name: 'cards-esg', instances: ['.cmp-container:has(.cmp-container__bg-image):has(.dashboard-card-facts)'] },
    { name: 'footer', instances: ['.cmp-experiencefragment--footer'] },
  ],
  sections: [
    { id: 'section-1', name: 'Hero', selector: '.homepage-hero-controller', style: null, blocks: ['hero-homepage'], defaultContent: [] },
    { id: 'section-2', name: 'News & Featured', selector: '.homepage-overlap', style: null, blocks: ['cards-news'], defaultContent: [] },
    { id: 'section-3', name: 'Patients Teaser', selector: '#section01.cmp-teaser', style: null, blocks: [], defaultContent: ['#section01 .cmp-teaser__title', '#section01 .cmp-teaser__description', '#section01 .cmp-teaser__action-link'] },
    { id: 'section-4', name: 'Video Feature', selector: '.video.cmp-video-xx-large', style: null, blocks: ['hero-video'], defaultContent: [] },
    { id: 'section-5', name: 'Science & Innovation', selector: '#teaser-a2987e48b8', style: null, blocks: ['cards-dashboard'], defaultContent: ['#teaser-a2987e48b8 .cmp-teaser__pretitle', '#teaser-a2987e48b8 .cmp-teaser__title', '#teaser-a2987e48b8 .cmp-teaser__description'] },
    { id: 'section-6', name: 'Podcast', selector: '.abbvie-container.default-radius.cmp-container-xxx-large', style: null, blocks: ['columns-intro'], defaultContent: [] },
    { id: 'section-7', name: 'Culture of Curiosity', selector: '#section02.cmp-teaser', style: null, blocks: ['columns-info'], defaultContent: ['#section02 .cmp-teaser__pretitle', '#section02 .cmp-teaser__title', '#section02 .cmp-teaser__description'] },
    { id: 'section-8', name: 'Explore Opportunities CTA', selector: '.abbvie-container.medium-radius:has(.dark-theme)', style: 'navy-gradient', blocks: ['columns-media'], defaultContent: [] },
    { id: 'section-9', name: 'Investor Resources', selector: '#section03.cmp-teaser', style: null, blocks: ['cards-cta'], defaultContent: ['#section03 .cmp-teaser__pretitle', '#section03 .cmp-teaser__title', '#section03 .cmp-teaser__description'] },
    { id: 'section-10', name: 'ESG', selector: '#section04.cmp-teaser', style: null, blocks: ['cards-esg'], defaultContent: ['#section04 .cmp-teaser__pretitle', '#section04 .cmp-teaser__title', '#section04 .cmp-teaser__description'] },
    { id: 'section-11', name: 'Footer', selector: '.cmp-experiencefragment--footer', style: 'dark', blocks: ['footer'], defaultContent: [] },
  ],
};

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  const allTransformers = [...transformers];

  // Add section transformer in afterTransform if template has 2+ sections
  if (hookName === 'afterTransform' && PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1) {
    allTransformers.push(sectionsTransformer);
  }

  allTransformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on embedded template configuration
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
        console.warn(`Invalid selector for "${blockDef.name}": ${selector}`);
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
      new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/index'
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
