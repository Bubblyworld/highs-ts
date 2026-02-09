# highs-ts

A wasm build of the HiGHS (highs.dev) MILP solver with a convenient typescript interface. The goal is to run with zero dependencies in both node and web environments, and to support a high-level typescript interface for defining, configuring and solving mixed-integer linear programs.

## Code Style

### Comments

Use JSDoc for public API documentation:

- Inline `/** description */` when it fits on one line
- Expanded multi-line style for longer documentation
- Use prose-style comments (flowing sentences, not "Note: ..." bullet points)
- No AI-style explanatory comments - only explain *why* decisions were made, not *how* the code works (readers can see that themselves)
