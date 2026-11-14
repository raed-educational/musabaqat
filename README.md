# منصة المسابقات والألعاب العلمية (Arabic RTL quiz & games platform)

Fully static site (vanilla JS, classic scripts, hash routing). Works from `file://`, any sub-path, or any static host
(GitHub Pages, Netlify, S3). No server or build step is needed at runtime.

## Layout
| Path | What |
|---|---|
| `index.html` | player app (home, categories, catalog, play, leaderboard, about) |
| `admin.html` | question admin: browse/filter/search, add/edit/delete (localStorage overlay), JSON/CSV import & export |
| `js/core.js` | bank loader (lazy per-category), player, leaderboard, utils |
| `js/games.js` | game modes + generated catalog (configuration only) |
| `js/engine.js` | 6 engines (quiz, ladder, duel, buzzer, teams, study) + 6 question renderers (mcq, tf, fill, order, match, who) |
| `js/app.js` | routing and screens |
| `data/manifest.js` | categories + per-category counts (loaded at start, small) |
| `data/bank/<cat>.js` | questions per category, loaded on demand (script injection, works on file://) |
| `data/questions/<cat>.json` | same data as JSON (for tools / review) |
| `tools/` | build pipeline (not needed for hosting) |

## Question schema
`id, category, subcategory, type (mcq|tf|fill|order|match|who), question, options, answer, explanation, difficulty (1-3), source, verified, verificationLevel (primary|reference|none), verifiedAgainst`
plus type-specific `items` (order), `pairs` (match), `clues` (who), `accept` (fill).

* `primary` – generated from and checked against fetched primary text: Quran text/metadata (api.alquran.cloud), التفسير الميسر, Sahih al-Bukhari / Sahih Muslim Arabic text (fawazahmed0/hadith-api; hadith numbers = Fath al-Bari / Fuad Abdul-Baqi).
* `reference` – generated from an open reference: Wikidata (via the QLever SPARQL mirror) or the Quranic Arabic Corpus morphology.
* `none` – hand-written, pending scholarly review.

## Rebuild the bank
```
cd tools
python3 build_bank.py        # reads tools/manual/*.txt, tools/imports/*.csv and tools/cache/*, writes data/
python3 fetch_wd.py          # (optional) refresh Wikidata caches in tools/cache/wd
```
Manual line format (`tools/manual/*.txt`, `@cat <id>` header lines):
`type|subcategory|difficulty|question|answer|alternatives(;)|explanation|source|verify`
(`verify` = `bukhari:<phrase>` or `muslim:<phrase>`: the phrase is searched in the fetched text, the hadith number is filled into `{n}` and the question marked verified; not found ⇒ dropped).

CSV import (tools/imports/*.csv or admin page):
`category,subcategory,type,difficulty,question,options(|),answer,explanation,source,verified` — rows without a source are rejected.

## Deploy
Copy the contents of `site/` (or the project root minus `tools/`, `tests/`, `screenshots/`) to any static host.
GitHub Pages: push the folder to a repo branch and enable Pages; all paths are relative.

## Tests
`cd tests && node smoke.mjs` (playwright-core + Chrome; serves from http://localhost:8765). Screenshots go to `screenshots/`.


## ملفات اللاعبين والمسابقات أونلاين
- **ملفي** (`#/profile`): اسم ورمز، إحصاءات لكل قسم، إنجازات، سجل آخر الألعاب، وعدة لاعبين على الجهاز نفسه. الملف محفوظ في المتصفح، ويُنقل إلى جهاز آخر برمز نصي أو ملف JSON.
- **أونلاين** (`#/online`): ينشئ المضيف غرفة برمز من 5 خانات ورابط وQR، وينضم الآخرون من جوالاتهم دون حد لعدد اللاعبين. الأسئلة والمؤقت والنقاط يديرها جهاز المضيف.
  - الربط: WebRTC مباشر عبر خادم PeerJS المجاني، ومع تعذّره يُستخدم تلقائيًا وسيط MQTT عام مجاني عبر WebSocket آمن (shiftr.io / EMQX / HiveMQ).
  - يجب أن تبقى صفحة المضيف مفتوحة طوال المسابقة.

## لوحة الصدارة العامة (بدون حساب)
- الصفحة: `#/global` — تجمع نتائج اللاعبين من كل الأجهزة بدون أي تسجيل، مع تبويب لكل قسم وتمييز صفّك.
- بعد كل لعبة يُنشر سجلّ واحد لملفك (الاسم والرمز والنقاط والإحصاءات) كرسالة محفوظة (retained) على خوادم MQTT عامة مجانية: shiftr.io ثم EMQX ثم HiveMQ، على الموضوع `musabaqat/lb/v1/<معرّف الملف>`.
- يمكن إيقاف الظهور من «ملفي»، وعند الإيقاف يُحذف سجلّك من اللوحة.
- حدود: البيانات عامة وغير موثّقة (يمكن لأي أحد التلاعب بها نظريًا، والقيم الشاذة تُقصّ تلقائيًا)، وقد تمسح الخوادم المجانية البيانات في أي وقت.
- اختبار: `node tests/leaderboard.mjs`.
