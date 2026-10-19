Español: [Cómo aportar](README.es.md#-cómo-aportar)

# Contributing to Maysa Brain

Thank you for helping a free atlas get better. Anatomy is the one thing nobody changes alone, so this page says where each kind of help goes.

## Report a content error

Open the structure card on https://brain.maysasp.com/ and press **Report an error**. It offers the four GitHub issue forms or an email. You can also pick a form directly in [New issue](https://github.com/ragarciaga/3d_brain/issues/new/choose):

- [Content error](.github/ISSUE_TEMPLATE/contenido.yml): a name, fact or source is wrong or incomplete.
- [Translation error](.github/ISSUE_TEMPLATE/traduccion.yml): the other language does not say the same thing.
- [Broken link](.github/ISSUE_TEMPLATE/enlace-roto.yml): a link on the card does not open.
- [Misplaced piece](.github/ISSUE_TEMPLATE/pieza-mal-ubicada.yml): the 3D piece is not the structure or is in the wrong place.

## Review as a teacher

Write to info@maysasp.com. The editor sends you a personal review link, and you go through each card field by field. Your review is never applied automatically: it becomes a proposed change that the editor approves.

## Code

1. Install with `npm ci` and run the app with `npm run dev` (http://localhost:3000).
2. Work on a branch and open a pull request using [the template](.github/pull_request_template.md).
3. Before you push, run:

```bash
npm run typecheck
npm run lint
npm test
npm run check:i18n
npm run check:modelo
npm run build
```

No visible text is hard-coded. Every string goes through i18next in `src/i18n/es.json` and `src/i18n/en.json`, and `npm run check:i18n` fails if one language is missing a key.

## Rules you will hit

- Changes to `src/data/**`, `pipeline/mapeo.csv`, `pipeline/cajas.json`, `public/modelos/**` and `SPEC.md` need the editor's approval.
- The GLB is never edited by hand. It is regenerated with `pipeline/` (see [pipeline/README.md](pipeline/README.md)).
- If there is no source or no certainty, the field says `PENDIENTE`. Never invent anatomy.
- Do not copy text from StatPearls, Kenhub or any other site. Write your own and cite it, or link it.
- Human-facing text in Spanish uses "tú" (Bogotá Spanish), and nobody uses the long dash.

## Translations

The interface lives in `src/i18n/es.json` and `src/i18n/en.json`; card content lives in `src/data/*.json` with its source in the same record. A third language needs code changes first (see "Replicate it" in the [README](README.md#-replicate-it)).

## License of contributions

Code is MIT ([LICENSE](LICENSE)). Content and the model are CC BY-SA 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)). By contributing you accept those terms.
