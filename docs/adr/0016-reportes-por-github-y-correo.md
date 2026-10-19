# 0016. Reportes de error del público por formulario de issue de GitHub y por correo, sin backend

Status: proposed
Date: 2026-10-19
Related: docs/specs/05-error-report/design.md, docs/adr/0003-datos-sin-backend.md, docs/adr/0012-apps-script-canal-revision.md, docs/adr/0015-analitica-sin-cookies.md
Approved by: pendiente (se aprueba con design.md)

## Context
SPEC F12 pide que cualquier visitante pueda reportar un error desde una ficha: un issue de GitHub ya llenado con el id de la estructura, el idioma y la versión, o un correo para quien no tiene cuenta. AGENTS.md prohíbe el backend propio y los datos personales de usuarios en un servidor. La única excepción es el canal de los revisores docentes (ADR 0012), que acepta solo códigos del padrón y pide autorización de tratamiento de datos (Ley 1581). Un reporte del público trae texto libre y, según la vía, el usuario de GitHub o el correo de quien lo envía.

## Decision
La app no recibe reportes. Arma dos enlaces con los datos de la ficha y lo que escribe el visitante, y el navegador los abre:
- el formulario de issue del tipo elegido en `github.com/ragarciaga/3d_brain` (`.github/ISSUE_TEMPLATE/*.yml`), con los campos llenos desde la URL y una etiqueta `reporte:*` por tipo;
- un `mailto:` a info@maysasp.com con el asunto y el cuerpo llenos.

Los enlaces se arman solo desde props y `src/data`, nunca desde la URL ni el estado del revisor, y en modo revisión el botón no se muestra. El diálogo avisa que el reporte por GitHub queda público, y la página de Privacidad dice adónde va cada vía y que la app no guarda ninguna.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Recibir el reporte en el Apps Script del canal | Abre al público un endpoint de revisores y guarda datos de quien reporta en la hoja del editor; AGENTS.md lo prohíbe fuera de F24 |
| Formulario de Google público | Datos en la cuenta del editor, un proveedor más en Privacidad y reportes sin clasificar en GitHub |
| Issue en blanco prellenado, sin plantillas | Sin etiqueta automática ni formato fijo |

## Consequences
- Positive: no hay servidor, ni secretos, ni datos de visitantes en sistemas del proyecto. Cada reporte llega clasificado a GitHub con el mismo vocabulario de campos que F24.
- Negative: quien reporta por GitHub necesita una cuenta y queda visible con su usuario. El correo depende de que el visitante tenga un programa de correo. Los reportes por correo los clasifica el editor a mano.
- Revisit when: lleguen reportes con datos personales o spam que haya que moderar, o el editor quiera reportes sin cuenta de GitHub y sin correo. En ese caso haría falta un receptor propio, que exige un ADR nuevo y una revisión legal.
