---
name: rscss
description: Structure CSS stylesheets and class names for reusable UI components, elements, variants, layouts, and helper classes.
---

# RSCSS (Reasonable System for CSS Stylesheet Structure)

RSCSS is a system for CSS stylesheet organization. This system organizes UI styles into components, elements, variants, layouts, and helper classes. These conventions prevent class name collisions. As a result, stylesheets stay maintainable as a project grows.

## 1. Core Summary

When you write HTML and CSS with RSCSS, obey these five primary rules:

1. Name each component with at least two words separated by a dash (`.screenshot-image` or `.search-form`).
2. Name each internal element with one word inside a child combinator selector (`.blog-post > .title`).
3. Prefix each component variant and element variant with a dash (`.shop-banner.-with-icon` or `.shopping-card > .title.-small`).
4. Customize nested child components through variant classes on the child component.
5. Place one component in each stylesheet file without external layout properties.

## 2. Components

A component is a self-contained piece of the user interface. Common examples include a search form, a navigation bar, an article card, and a like button.

When you create component class names, obey these rules:

1. Name each component with at least two words separated by a dash (`-`).
2. If a component name includes a namespace, join the namespace and component words with dashes (`.rico-custom-header`).
3. If one word describes the component, append a suffix to form a two-word class name.
4. For block-level components, append a suffix such as `-box`, `-card`, or `-block` (`.alert-box`, `.alert-card`, `.alert-block`).
5. For inline components, append a suffix such as `-button` or `-span` (`.link-button`, `.link-span`).

```html
<form class="search-form">
  <input class="field" type="text">
  <button class="action" type="submit">Search</button>
</form>
```

## 3. Elements

An element is an internal part of a component. An element cannot exist independently outside its parent component.

When you name and select elements, obey these rules:

1. Name each element with one word, such as `.field`, `.action`, `.title`, or `.author`.
2. If an element name requires multiple words, join the words without dashes or underscores (`.firstname`, `.lastname`).
3. Select each element with the direct child combinator (`>`) instead of a descendant combinator.
4. Select each element by class name instead of HTML tag name (`> .name` instead of `> h3`).

The direct child combinator (`>`) prevents style bleed into nested components. This combinator also improves selector performance. Class selectors are more descriptive than HTML tag selectors.

```scss
.profile-box {
  > .firstname { /* Element styles */ }
  > .lastname { /* Element styles */ }
  > .avatar { /* Element styles */ }
}

.article-card {
  > .title { /* Preferred child class selector */ }
  > .author { /* Preferred child class selector */ }
}
```

## 4. Variants

A variant is a modifier class that alters the appearance or state of a component or an element. A dash prefix (`-`) distinguishes variants from elements and components. This prefix also prevents ambiguity with element class names.

When you define and apply variants, obey these rules:

1. Prefix every variant class name with a single dash (`-`), such as `.-wide`, `.-short`, `.-disabled`, or `.-small`.
2. Attach the variant class directly to the component node or element node that it modifies.
3. In SCSS, reference component variants with the parent selector (`&.-wide`).
4. In SCSS, attach element variants directly to the element selector (`> .title.-small`).

```html
<button class="like-button -wide -disabled">Like</button>

<div class="shopping-card">
  <h3 class="title -small">Item Title</h3>
</div>
```

```scss
.like-button {
  &.-wide { /* Component variant styles */ }
  &.-short { /* Component variant styles */ }
  &.-disabled { /* Component variant styles */ }
}

.shopping-card {
  > .title { /* Base element styles */ }
  > .title.-small { /* Element variant styles */ }
}
```

## 5. Nested Components

Complex user interfaces often contain one component inside another component. For example, an `.article-link` component can contain a `.vote-box` component alongside `.title` and `.meta` elements.

### 5.1 Nested Component Customization

If a nested component requires custom styles inside a parent component, do not modify child internals from the parent stylesheet.

```scss
/* Incorrect: parent component modifies child component internals */
.article-header {
  > .vote-box > .up { /* Do not use this selector pattern */ }
}
```

To customize a nested component cleanly, obey these steps:

1. Define a variant class on the child component itself (`.vote-box.-highlight`).
2. Scope the custom element rules under that variant inside the child component stylesheet.
3. Apply that variant class to the child component in the HTML markup of the parent component.

```html
<div class="article-header">
  <div class="vote-box -highlight">
    <button class="up"></button>
    <button class="down"></button>
    <span class="count">4</span>
  </div>
  <h3 class="title">Article Title</h3>
  <p class="meta">Published today</p>
</div>
```

```scss
.vote-box {
  > .up { /* Base element styles */ }
  &.-highlight > .up { /* Variant element styles */ }
}
```

### 5.2 Preprocessor Inheritance with `@extend`

If a nested component requires multiple variant classes in HTML, simplify the markup with the `@extend` directive:

1. Assign a single-word element class (such as `.submit`) to the HTML node inside the parent component.
2. In the parent component stylesheet, select that element with the direct child combinator (`> .submit`).
3. Apply `@extend` for the base component class and each required variant class.

```html
<div class="search-form">
  <input class="input" type="text">
  <button class="submit"></button>
</div>
```

```scss
.search-form {
  > .submit {
    @extend .search-button;
    @extend .search-button.-red;
    @extend .search-button.-large;
  }
}
```

## 6. Layouts and Component Placement

A component must remain reusable across different containers and page layouts. External layout properties inside a component break reusability.

### 6.1 Prohibited Component Properties

Do not put these external layout properties on a root component selector:

1. Position coordinates (`position`, `top`, `left`, `right`, `bottom`).
2. Float declarations (`float`, `clear`).
3. Outer margins (`margin`).
4. Explicit dimensions (`width`, `height`), except for fixed-size elements such as avatars and logos.

### 6.2 Parent Layout Context

To position or size a component inside a layout, obey these steps:

1. Create a parent layout or list component, such as `.article-list`.
2. Select the child component with the direct child combinator (`> .article-card`) inside the parent component.
3. Define `width`, `float`, `margin`, and position declarations inside that child selector block.

```scss
.article-list {
  @include clearfix;

  > .article-card {
    width: 33.3%;
    float: left;
  }
}

.article-card {
  > .image { /* Internal element styles */ }
  > .title { /* Internal element styles */ }
  > .category { /* Internal element styles */ }
}
```

## 7. Helper Classes

Helper classes are general-purpose utility classes that override single style properties. The underscore prefix (`_`) distinguishes helper classes from component variants.

When you define and apply helper classes, obey these rules:

1. Prefix every helper class name with an underscore (`_`), such as `._unmargin`, `._center`, `._pull-left`, and `._pull-right`.
2. Add `!important` to the property declaration inside each helper class so that the override succeeds.
3. Place all helper classes in a single file named `helpers`.
4. Use helper classes sparingly to keep the total number of overrides minimal.

```css
._unmargin { margin: 0 !important; }
._center { text-align: center !important; }
._pull-left { float: left !important; }
._pull-right { float: right !important; }
```

```html
<div class="order-graphs -slim _unmargin"></div>
```

## 8. Stylesheet Files and Selector Depth

Consistent file organization and shallow selector depth keep stylesheets readable.

When you structure stylesheet files, obey these rules:

1. Place each component in its own dedicated file, such as `css/components/search-form.scss`.
2. If the build tool supports glob imports, import component files with a glob pattern (`@import 'components/*';`).
3. Limit selector depth to one level inside a component block (two levels total).
4. If an element contains a sub-element, write a flat child selector (`> .description > .icon`) at the first level.

```scss
/* css/components/image-frame.scss */
.image-frame {
  > .description { /* Direct element styles */ }
  > .description > .icon { /* Sub-element styles at shallow depth */ }

  &.-small { /* Variant styles */ }
  &.-wide { /* Variant styles */ }
}
```

## 9. Style Bleed Prevention

If a parent component and a nested child component share an element name (`.count`), descendant selectors cause style bleed. In that case, a `.article-link .count` selector unintentionally styles `.vote-box > .count`.

To prevent style bleed across nested components, obey these rules:

1. Use the direct child combinator (`>`) on all element selectors (`.article-link > .count` and `.vote-box > .count`).
2. Do not write bare descendant selectors for component elements.
3. If a nested component shares an element name with its parent, scope each element to its immediate component root.

```html
<article class="article-link">
  <div class="vote-box">
    <button class="up"></button>
    <button class="down"></button>
    <span class="count">4</span>
  </div>
  <h3 class="title">Article title</h3>
  <p class="count">3 votes</p>
</article>
```

```scss
.article-link {
  > .title { /* Applies only to direct child .title */ }
  > .count { /* Applies only to direct child .count */ }
}

.vote-box {
  > .up { /* Applies only to .vote-box > .up */ }
  > .down { /* Applies only to .vote-box > .down */ }
  > .count { /* Applies only to .vote-box > .count */ }
}
```

## 10. Terminology Comparison (RSCSS, BEM, and SMACSS)

RSCSS shares structural concepts with BEM and SMACSS, but uses concise class names and child combinators.

| Concept | RSCSS | BEM | SMACSS |
| --- | --- | --- | --- |
| UI Block | Component (`.site-search`) | Block (`.site-search`) | Module |
| Internal Part | Element (`> .field`) | Element (`.site-search__field`) | Sub-Component |
| Style Modifier | Variant (`.-full`) | Modifier (`.site-search--full`) | Sub-Module / State |
| Layout Wrapper | Layout (`.article-list > .article-card`) | Mix / Parent Block | Layout |
| Utility Override | Helper (`._unmargin`) | Utility | State / Helper |

```html
<!-- BEM Markup -->
<form class="site-search site-search--full">
  <input class="site-search__field" type="text">
  <button class="site-search__button"></button>
</form>

<!-- RSCSS Markup -->
<form class="site-search -full">
  <input class="field" type="text">
  <button class="button"></button>
</form>
```
