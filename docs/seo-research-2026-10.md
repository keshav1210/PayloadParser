# SEO research: keywords and content for jsonxmleditor.com

Researched 2026-10-22. Demand signals come from Google autocomplete (what people actually type), competitor
site structures and Google's own documentation. Autocomplete shows that a query is common, not its exact
volume; confirm volumes in Google Search Console or a keyword tool before big investments.

## Top 10 actions, in order

| # | Action | Why | Effort |
|---|---|---|---|
| 1 | Check indexing in Google Search Console; add the site to **Bing Webmaster Tools** and submit the sitemap | Bing shows **no** jsonxmleditor.com pages for `site:jsonxmleditor.com`. Bing also feeds DuckDuckGo and Yahoo | 30 min |
| 2 | Split `/mapper` into one page per language: `/json-to-java`, `/json-to-typescript`, `/json-to-go`, `/json-to-python`, `/json-to-csharp`, `/json-to-kotlin`, `/json-to-dart` | "json to java pojo", "json to typescript interface", "json to dart" are top suggestions; one page titled with four languages can't rank for each | Low (same tool, preset language) |
| 3 | Add `/json-to-excel`, `/csv-to-excel`, `/xml-to-csv`, `/xml-to-excel` | "json to excel", "csv to excel", "xml to excel", "xml to csv" are top-3 suggestions for their prefixes; the converters already exist | Low |
| 4 | Add `/json-escape` (escape/unescape) and `/base64-decode` (with Base64 to image and to PDF) | "json escape unescape online", "base64 decode", "base64 to image", "base64 to pdf" | Low |
| 5 | Give each article its own URL (`/blog/<slug>`), with author, date and Article markup | All 6 articles sit on one `/blogs` page that has no canonical and isn't in the sitemap, so none can rank | Medium |
| 6 | Add `/xml-validator` with XSD validation | "xml validator with xsd", "against xsd", "validator and corrector" | Medium |
| 7 | Add `/jsonpath` (evaluator) and `/xpath-tester` | "jsonpath online evaluator", "jsonpath finder", "xpath finder", "xpath contains text" | Medium |
| 8 | Add 10-15 cron schedule pages and 10-15 regex pattern pages (see below), each with real, tested content | "cron expression for every 5 minutes / 1 hour / 10 minutes", "regex for email validation / password / phone number" | Medium |
| 9 | Cache static files for a year (`Cache-Control: public, max-age=31536000, immutable`) | CSS and JS are served without `Cache-Control`; Cloudflare reports `cf-cache-status: DYNAMIC`, so every visit hits Render | Low |
| 10 | Fix titles over 60 characters and descriptions over 160 (41 pages) | Long titles are cut off in results, and the project rule says 60/160 | Low |

## Progress (2026-10-22, on master)

Done:
- Static files cached (`StaticCacheFilter`: one year for `?v=` URLs, one hour otherwise) and no longer get a
  `Set-Cookie` or count against the rate limit, so Cloudflare can cache them.
- 41 titles and descriptions shortened to 60/160 characters.
- `/mapper` split: `/json-to-java`, `/json-to-typescript`, `/json-to-python`, `/json-to-go`, `/json-to-csharp`,
  `/json-to-kotlin`, each with the language preset, a real example, a type table and its own FAQ. Also fixed a
  bug where arrays produced uncompilable Go/Kotlin/Pydantic code (`type Root []Root`).
- Articles moved to their own URLs (`/blog/<slug>`, BlogPosting markup); `/blogs` is indexable with a
  canonical. Three old articles rewritten (one had code errors, one used an old JSON Schema draft), three new:
  what is JSON, JSON in Excel, what is a JWT.
- `/about` page; About and Articles links in the header and footer.
- Sitemap: 14 new URLs, lastmod updated. IndexNow key file plus `npm run indexnow` in `frontend-build/`.

Still to do (needs you): Search Console and Bing Webmaster Tools, then run `npm run indexnow` after deploying.
Next build steps: `/json-to-excel`, `/csv-to-excel`, `/xml-to-csv`, `/base64-decode`, `/json-escape`, XML validator
with XSD, JSONPath and XPath testers, cron and regex reference pages.

## What I measured

**Indexing.** Bing's `site:jsonxmleditor.com` returns about 65 results, none from the site. Google's status
isn't visible from outside; check Search Console → Pages.

**Speed.** Warm response times 0.3–1.2 s (Cloudflare in front of Render), gzip on, http and www redirect to
https://jsonxmleditor.com with 301. Static assets: no `Cache-Control` header, not cached by Cloudflare.

**Pages.** 50 URLs in the sitemap, ~46 tools. Tool pages already have 1,000–1,500 words of explanation, FAQs,
breadcrumbs and WebApplication markup, which is good.

**Gaps found.**
- `/blogs`: no canonical, not in the sitemap, all articles on one URL.
- `/claude-code-sdlc-generator` and `/guides/claude-code-sdlc-kit` are on the feature branch only; add them to
  the sitemap when merged.
- No About page: nothing says who builds the site or why it can be trusted (Google: "trust is most
  important" in E-E-A-T).
- `robots.txt` blocks GPTBot. That only stops AI training; ChatGPT search uses a separate crawler,
  OAI-SearchBot, which is allowed. Keep it that way.
- Brand confusion: a macOS app called "JsonXmlEditor" is listed on PeerPush. If it isn't yours, use the full
  domain or a distinct brand line in titles and listings.

## Keyword map: new pages

Rule for every new page (Google's spam policies): it must be a real tool or genuinely useful reference with its
own examples and explanation, not a copy with a changed keyword. Google calls many near-identical pages
"scaled content abuse" and "doorway abuse". A preset tool page (input fixed to JSON, output fixed to Java)
with Java-specific options, example and FAQ is fine; ten pages with the same text are not.

### Tier 1: intent pages for tools we already have (low effort)

| Page | Searches it targets (from autocomplete) | Built from |
|---|---|---|
| `/json-to-java` | json to java pojo, json to java class, json to java dto, json to java pojo online | `/mapper` |
| `/json-to-typescript` | json to typescript interface, type, model, converter | `/mapper` |
| `/json-to-go`, `/json-to-python`, `/json-to-csharp`, `/json-to-kotlin`, `/json-to-dart` | json to dart (top-10 for "json to"), json to go struct | `/mapper` (add Kotlin, Dart, C# if missing) |
| `/json-to-excel` | json to excel, json to excel converter (online) | `/json-to-csv` + XLSX export |
| `/csv-to-excel` | csv to excel, csv to xlsx (converter) | `/excel-converter` |
| `/xml-to-csv`, `/xml-to-excel` | xml to excel (converter), xml to csv (converter) | XML → table flattening from `/json-to-csv` |
| `/yaml-to-json`, `/json-to-yaml` | yaml to json (converter online) | `/yaml-converter` |
| `/yaml-to-properties` | yaml to properties (converter), properties to yaml | `/yaml-converter` (Spring Boot mode exists) |
| `/base64-decode` | base64 decode, base64 to text, base64 to image, base64 to pdf | `/encode-decode` |
| `/url-encode` | url encode / decode | `/encode-decode` |
| `/hex-to-decimal`, `/hex-to-ascii` | hex to decimal, hex to ascii, hex to text, hex to binary | `/number-base-converter` |
| `/soap-formatter` | soap xml formatter, beautifier, validator, soap xml to json | `/xml-parser` with SOAP sample and envelope tips |
| `/html-formatter` | html formatter (online), html formatter and viewer | `/code-beautifier` |
| `/json-escape` | json escape unescape (online), escape double quotes, escape remover | new, small |

### Tier 2: new tools with clear demand

| Tool | Searches | Notes |
|---|---|---|
| XML validator (well-formed + XSD) | xml validator with xsd, against xsd, xml validator online free | Validate in the browser or with the existing Java XML stack |
| XSD generator | xml to xsd converter | Pairs with the validator |
| JSONPath evaluator | jsonpath finder, online evaluator, expression, syntax, in restassured | Click a node → get its path (the "finder" intent) |
| XPath tester | xpath finder, contains text, axes, in selenium, in playwright | Strong with testers; link from the SDLC tester content |
| JSON / XML to PDF | json to pdf (converter), xml to pdf (converter) | Top-5 for both prefixes; render as a formatted table or tree and print to PDF in the browser |
| Swagger / OpenAPI viewer and swagger to Postman | swagger to postman (collection), swagger to json, swagger to openapi converter | Developer audience matches the site |
| JWT generator | jwt token generator, jwt secret key generator | Next to `/jwt-decoder` |
| Image to Excel (table OCR) | image to excel | Extends `/image-to-text` |

### Tier 3: long-tail reference pages (one useful page each)

- **Cron schedules**: `/cron/every-5-minutes`, every 1, 2, 10, 15, 30 minutes, every hour, every day at
  midnight, every Monday, first day of month. Each shows the expression for crontab, Spring, Quartz and AWS
  EventBridge, the next 5 run times, and common mistakes. Links to `/cron-expression`.
- **Regex patterns**: `/regex/email`, password (strength rules), phone number, numbers only, alphanumeric,
  name, URL, IPv4, date, postcode. Each with the pattern, what it accepts and rejects, tested examples, and
  code in JavaScript, Java and Python, opening in `/regex-tester` preloaded.

## Articles (informational searches)

Each article on its own URL, written from real experience with the tools, linking to the matching tool.

| Article | Searches |
|---|---|
| What is JSON? Full form, syntax and examples | json full form |
| What is XML? Full form and a practical guide | xml full form, xml file |
| What is a JWT and how do I decode it safely? | jwt full form, jwt means, jwt token |
| How to open a JSON file in Excel (3 ways) | json to excel |
| JSONPath cheat sheet (with REST Assured examples) | jsonpath syntax, jsonpath in restassured |
| XPath cheat sheet for Selenium and Playwright | xpath in selenium, xpath contains text, xpath axes |
| Cron expression cheat sheet: crontab vs Spring vs Quartz | cron expression in salesforce, evaluator |
| SOAP vs REST: XML vs JSON | soap xml vs rest json |
| Spring Boot: application.properties vs application.yml | yaml to properties |
| The existing 6 articles | JSON Schema, XML↔JSON, large payloads, YAML vs JSON, secure parsing, TOML |

## Technical checklist

- [ ] Search Console: check Pages and Core Web Vitals reports; request indexing for top pages.
- [ ] Bing Webmaster Tools: verify, submit sitemap (Bing can import from Search Console).
- [ ] IndexNow: host a key file and ping on deploy, so Bing and other participating engines pick up changes
      quickly (Google doesn't use it).
- [ ] `Cache-Control` for `/css`, `/js`, `/og`, `/vendor` (versioned with `?v=`): one year, immutable. HTML: short
      or no cache.
- [ ] `/blogs`: canonical, sitemap entry; move articles to `/blog/<slug>`.
- [ ] About page (`/about`): who builds the site, why, how data is handled; link it from the footer.
- [ ] Titles ≤ 60 and descriptions ≤ 160 characters on the 41 pages listed by the audit.
- [ ] Structured data: keep WebApplication and BreadcrumbList. FAQPage no longer produces rich results
      (Google restricted them in 2023 and has since deprecated them), but it's harmless; keep the visible FAQs,
      which help users. Don't add `aggregateRating` without real ratings: SoftwareApplication rich results
      require a rating or review, and fake ones break Google's rules.
- [ ] AI search: nothing extra needed (Google: "no additional requirements" for AI Overviews). Keep
      OAI-SearchBot allowed; keep important content as text, not only in scripts.

## Off-site visibility

- List the site on AlternativeTo, Product Hunt and relevant GitHub "awesome" lists (JSON tools, developer
  tools), with the full domain.
- Write 2-3 genuinely useful posts on dev.to or Hashnode (for example the JSONPath or cron cheat sheets) with a
  link to the tool.
- A small browser extension ("JSON formatter chrome extension" is a top suggestion) would bring branded
  searches and links; a bigger project, consider later.

## How to measure

Search Console, monthly: impressions and clicks per page, queries per page, pages indexed. Start each new page
with its target queries noted, and compare after 6-8 weeks.

## Sources

- Google: [Creating helpful, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- Google: [Spam policies (scaled content, doorway abuse)](https://developers.google.com/search/docs/essentials/spam-policies)
- Google: [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features)
- Google: [Software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)
- Google: [Changes to HowTo and FAQ rich results (2023)](https://developers.google.com/search/blog/2023/08/howto-faq-changes); later FAQ deprecation reported by [Search Engine Journal](https://www.searchenginejournal.com/google-drops-faq-rich-results/574429/)
- OpenAI: [Crawlers (GPTBot, OAI-SearchBot)](https://developers.openai.com/api/docs/bots)
- [IndexNow documentation](https://www.indexnow.org/documentation)
- Competitor structure: [jsonformatter.org](https://jsonformatter.org/), [codebeautify.org](https://codebeautify.org/)
- Demand: Google autocomplete (suggestqueries.google.com) for json, json to, json formatter, json escape,
  json to java, json to typescript, jsonpath, xml, xml to, xml validator, xpath, soap xml, csv to, csv viewer,
  excel to, yaml to, properties to, base64, hex to, html to, html formatter, swagger to, image to, cron
  expression, jwt, regex for, sql to, word counter, claude code; queried 2026-10-22.
