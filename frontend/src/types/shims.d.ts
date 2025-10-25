// Minimal shims to help TypeScript when some third-party packages don't
// provide types. Avoid overriding the `react` module so the installed
// @types/react package can be used for proper typing.

// If a dependency ships without types (or the type resolution fails),
// declare it as `any` to avoid blocking the build. Prefer adding real
// types or updating the package in a follow-up PR.
declare module 'recharts' {
  const anything: any;
  export = anything;
}

declare module 'intro.js/minified/intro.min.js' {
  import introJs from 'intro.js';
  export default introJs;
}

declare module 'intro.js/minified/introjs.min.css';

// Provide a permissive fallback for JSX intrinsic elements only when the
// TS server can't find the proper JSX types. This reduces noise; it's
// better to rely on the real `@types/react` when available.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
