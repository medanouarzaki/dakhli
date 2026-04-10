// Allow side-effect imports of CSS files (e.g. `import "./globals.css"`).
// Needed because TypeScript doesn't recognize CSS imports as modules by default,
// even though Next.js handles them natively at build time.
declare module "*.css";
