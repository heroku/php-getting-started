-- Demo content for pixelcoda Search testing

-- Create root pages
INSERT INTO pages (uid, pid, title, slug, doktype, hidden, starttime, endtime, sorting, crdate, tstamp, cruser_id) VALUES 
(1, 0, 'Home', '/', 1, 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(2, 1, 'About Us', '/about', 1, 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(3, 1, 'Products', '/products', 1, 0, 0, 0, 512, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(4, 1, 'News', '/news', 1, 0, 0, 0, 768, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(5, 1, 'Contact', '/contact', 1, 0, 0, 0, 1024, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(6, 1, 'Search', '/search', 1, 0, 0, 0, 1280, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1);

-- Create content elements
INSERT INTO tt_content (uid, pid, CType, header, bodytext, hidden, starttime, endtime, sorting, crdate, tstamp, cruser_id) VALUES
(1, 1, 'textmedia', 'Welcome to pixelcoda', 'This is a demo installation of TYPO3 with the pixelcoda Search plugin. Test the search functionality with different terms and explore AI-powered answers.', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(2, 2, 'textmedia', 'About pixelcoda', 'pixelcoda is an innovative company developing AI-powered search solutions for TYPO3. Our platform combines traditional keyword search with modern vector search and AI-powered answers.', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(3, 3, 'textmedia', 'Our Products', 'Discover our innovative search solutions: Headless Search API, TYPO3 Integration, React Widgets, and AI-powered answers. All products are fully accessible and multilingual.', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1),
(4, 6, 'pixelcodasearch_search', 'pixelcoda Search', '', 0, 0, 0, 256, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1);

-- Configure search plugin with FlexForm
UPDATE tt_content SET pi_flexform = '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<T3FlexForms>
    <data>
        <sheet index="sDEF">
            <language index="lDEF">
                <field index="settings.mode">
                    <value index="vDEF">classic</value>
                </field>
                <field index="settings.template">
                    <value index="vDEF">Default</value>
                </field>
                <field index="settings.collections">
                    <value index="vDEF">pages,news</value>
                </field>
                <field index="settings.resultsPerPage">
                    <value index="vDEF">10</value>
                </field>
                <field index="settings.enableSuggestions">
                    <value index="vDEF">1</value>
                </field>
                <field index="settings.enableAsk">
                    <value index="vDEF">1</value>
                </field>
            </language>
        </sheet>
    </data>
</T3FlexForms>' WHERE uid = 4;

-- Create sample news entries
INSERT INTO tx_news_domain_model_news (uid, pid, title, teaser, bodytext, datetime, crdate, tstamp, cruser_id, hidden, deleted) VALUES
(1, 4, 'pixelcoda Search v2.0 Released', 'The new version brings AI-powered answers and improved performance.', 'With the new version 2.0 of pixelcoda Search, we introduce revolutionary AI features. The platform now supports RAG (Retrieval-Augmented Generation) for precise answers based on your content.', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1, 0, 0),
(2, 4, 'TYPO3 Headless Integration', 'Seamless integration with TYPO3-Headless and nuxt-typo3.', 'Our search platform is now fully compatible with TYPO3-Headless and nuxt-typo3. JSON:API 1.0 compliant responses enable direct usage in modern frontend frameworks.', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1, 0, 0),
(3, 4, 'Accessible Search', 'BITV 2.0 compliant search functions for all users.', 'Accessibility is a core feature of our platform. All search components are BITV 2.0 compliant and provide optimal user experience for people with disabilities.', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 1, 0, 0);
