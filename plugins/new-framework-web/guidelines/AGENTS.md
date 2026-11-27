# AGENTS.md - Web Framework and Stylesheet Rules

Apply web frontend framework and stylesheet conventions while respecting target repository standards first.

## 1. Precedence

Resolve stylesheet and frontend conventions in this order:

1. **Target repository guides and configs**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CONTRIBUTING.md`,
   and styling tool configurations (such as Tailwind CSS, CSS Modules, PostCSS, Stylelint, or Sass configs) override all
   defaults in this plugin.
2. **Neighboring stylesheet conventions**: Match existing component class naming, file layout, and preprocessor imports
   in
   adjacent stylesheets.
3. **Bundled `new-framework-web` defaults**: Apply bundled rules only when the repository establishes no local standard
   or when explicitly requested.

## 2. Skill Router

| Name         | Kind  | Activate When                                                                                                   |
|--------------|-------|-----------------------------------------------------------------------------------------------------------------|
| `new::rscss` | Skill | Writing or reviewing CSS/SCSS when the user explicitly requests RSCSS or when the target repository uses RSCSS. |
