---
name: new::rscss
description: >-
  Structure CSS and SCSS stylesheets into RSCSS components, elements, variants,
  layouts, and helper classes. Activate this skill only when the user explicitly
  requests RSCSS or when the target repository already uses RSCSS conventions.
---

# RSCSS (Reasonable System for CSS Stylesheet Structure)

RSCSS organizes UI stylesheets into components, elements, variants, layouts, and helper classes to prevent class name collisions as a project grows.

## 1. Project Precedence

Check the target repository's existing styling system before applying RSCSS. Do not apply RSCSS in codebases that standardize on Tailwind CSS, CSS Modules, BEM, CSS-in-JS, or another convention unless the user explicitly asks to migrate to RSCSS.

---

## 2. Five Core Rules

When writing HTML and CSS/SCSS with RSCSS, obey these five rules:

1. **Components (two or more words, kebab-case)**: Name every self-contained UI block with at least two words separated by a dash (`.search-form`, `.article-card`, `.alert-box`). Append `-box`, `-card`, `-block`, `-button`, or `-span` when one word describes the component, and join namespaces with dashes (`.app-custom-header`).
2. **Elements (one word + direct child combinator `>`)**: Name internal parts with one word (`.title`, `.field`, `.firstname`) and select them by class name using `>` (`> .title`, not descendant `.title` or tag `> h3`). This rule prevents style bleed when a parent and nested child share an element name such as `.count`.
3. **Variants (leading dash `-`)**: Prefix component and element modifiers with a single dash (`&.-wide`, `> .title.-small`) and attach the modifier class directly to the target node.
4. **Nested component customization**: Never style a child component's internals from a parent stylesheet (avoid `.article-header > .vote-box > .up`). Define a variant on the child component (`.vote-box.-highlight > .up`) and apply that variant in the parent markup.
5. **Reusable component boundaries (one file per component)**: Keep external layout properties off root component selectors: `position`, `top`/`left`/`right`/`bottom`, `margin`, `float`, and explicit `width`/`height` (except on fixed avatars or logos). Place each component in its own file (`styles/components/search-form.scss`) and keep selector depth to one level inside a component block (use flat `> .description > .icon` for sub-elements).

---

## 3. Complete Pattern Example (Components, Elements, Variants, and Layout)

Define external sizing and spacing in a parent layout component using modern CSS Grid or Flexbox, while child components define only their internal structure and variants:

```html
<section class="article-list">
  <article class="article-card -featured">
    <div class="vote-box -highlight">
      <button class="up" type="button">Up</button>
      <span class="count">4</span>
    </div>
    <h3 class="title -large">Article Title</h3>
    <p class="count">3 comments</p>
  </article>
</section>
```

```scss
/* styles/components/article-list.scss: defines layout and child placement */
.article-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;

  > .article-card {
    min-width: 0;
  }
}

/* styles/components/article-card.scss: reusable component with no outer margins or grid rules */
.article-card {
  > .title { /* Direct child element */ }
  > .title.-large { /* Element variant */ }
  > .count { /* Does not bleed into .vote-box > .count */ }

  &.-featured { /* Component variant */ }
}

/* styles/components/vote-box.scss: defines its own nested customization variant */
.vote-box {
  > .up { /* Base button styles */ }
  > .count { /* Scoped to .vote-box only */ }

  &.-highlight > .up { /* Variant styling for nested parent contexts */ }
}
```

---

## 4. Helper Classes and Legacy Preprocessor Notes

- **Helper classes (leading underscore `_`)**: Prefix single-property utility overrides with `_` (`._unmargin`, `._center`), place them in one `helpers` file, add `!important` so overrides take precedence over component selectors, and use them sparingly.
- **Preprocessor imports and `@extend`**: Prefer standard Sass `@use` / `@forward` modules and explicit variant classes in HTML. Avoid deprecated Sass `@import` globs and chained `@extend` rules in new codebases unless maintaining an existing legacy Sass setup.

---

## 5. Terminology Comparison (RSCSS, BEM, and SMACSS)

| Concept | RSCSS | BEM | SMACSS |
|---|---|---|---|
| UI Block | Component (`.site-search`) | Block (`.site-search`) | Module |
| Internal Part | Element (`> .field`) | Element (`.site-search__field`) | Sub-Component |
| Style Modifier | Variant (`.-full`) | Modifier (`.site-search--full`) | Sub-Module / State |
| Layout Wrapper | Layout (`.article-list > .article-card`) | Mix / Parent Block | Layout |
| Utility Override | Helper (`._unmargin`) | Utility | State / Helper |

---

## 6. Sources

- Rico Sta. Cruz. [*RSCSS (Reasonable System for CSS Stylesheet Structure)*](https://ricostacruz.com/rscss/).
