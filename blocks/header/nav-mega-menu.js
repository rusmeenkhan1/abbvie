/**
 * Mega-menu navigation data.
 *
 * This data mirrors what should be authored in the DA nav document
 * using nested lists and description paragraphs.
 *
 * When the DA nav document is updated with the nested structure
 * (see content/nav.plain.html for the expected format),
 * the header.js will read from the DOM and this file becomes unused.
 */
const NAV_MEGA_MENU = {
  'Who We Are': {
    href: '/who-we-are.html',
    description: 'AbbVie discovers and delivers innovative medicines and solutions that enhance people\'s lives.',
    items: [
      { text: 'Our Principles', href: '/who-we-are/our-principles.html' },
      { text: 'Operating with Integrity', href: '/who-we-are/operating-with-integrity.html' },
      { text: 'Key Facts', href: '/who-we-are/key-facts.html' },
      { text: 'Our Leaders', href: '/who-we-are/our-leaders.html' },
      { text: 'Policies & Disclosures', href: '/who-we-are/policies-disclosures.html' },
      { text: 'Our Stories', href: '/who-we-are/our-stories.html' },
    ],
  },
  Science: {
    href: '/science.html',
    description: 'We take on the world\'s toughest health challenges.',
    items: [
      { text: 'Areas of Focus', href: '/science/areas-of-focus.html' },
      { text: 'Areas of Innovation', href: '/science/areas-of-innovation.html' },
      { text: 'Pipeline', href: '/science/pipeline.html' },
      { text: 'Our People', href: '/science/our-people.html' },
      { text: 'Research Publications', href: '/science/publications.html' },
      { text: 'Partner with Us', href: '/science/partner-with-us.html' },
      { text: 'Clinical Trials', href: '/science/clinical-trials.html' },
      { text: 'R&D Sites', href: '/science/rd-sites.html' },
      { text: 'Independent Educational Grants', href: '/science/independent-educational-grants.html' },
    ],
  },
  Patients: {
    href: '/patients.html',
    description: 'We strive to meet patient needs at each step of their health journey.',
    items: [
      { text: 'Patient Support', href: '/patients/patient-support.html' },
      { text: 'Product Quality & Safety', href: '/patients/product-quality-and-safety.html' },
      { text: 'Products', href: '/patients/products.html' },
    ],
  },
  'Join Us': {
    href: '/join-us.html',
    description: 'You want to make a difference. We accept that challenge.',
    items: [
      { text: 'Opportunities', href: '/join-us/opportunities.html' },
      { text: 'Life at AbbVie', href: '/join-us/life-at-abbvie.html' },
      { text: 'Why AbbVie', href: '/join-us/why-abbvie.html' },
      { text: 'Students & New Graduates', href: '/join-us/student-and-new-graduates.html' },
      { text: 'Postdoctoral Program', href: '/join-us/postdoctoral-program.html' },
      { text: 'Internships', href: '/join-us/internships.html' },
      { text: 'Student Programs', href: '/join-us/student-programs.html' },
    ],
  },
  Sustainability: {
    href: '/sustainability.html',
    description: 'Leading with purpose, we are willing to make the tough choices that deliver a lasting impact.',
    items: [
      { text: 'AbbVie Foundation', href: '/sustainability/abbvie-foundation.html' },
      { text: 'Disaster Relief', href: '/sustainability/disaster-relief.html' },
      { text: 'Environmental, Social & Governance', href: '/sustainability/environmental-social-and-governance.html' },
    ],
  },
};

export default NAV_MEGA_MENU;
