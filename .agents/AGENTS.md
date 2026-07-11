### 🎨 UI/UX Refactoring Strategy
- **NEVER use global regex or string replacement scripts** to blindly sweep and replace UI/UX classes (like colors, margins, or Tailwind tags) across multiple files.
- **ALWAYS audit and refactor page-by-page.** When performing broad UI updates, manually inspect the context of each component and make targeted modifications using code editing tools.
- Consult the user before making major design system changes and walk down the feature list systematically.
